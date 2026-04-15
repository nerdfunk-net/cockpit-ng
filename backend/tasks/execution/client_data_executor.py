"""
Get Client Data executor.
Collects ARP table, MAC address table, and DNS hostnames from network devices.

Moved here to follow the same executor pattern as command_executor.py.
"""

import logging
import socket
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Commands to run on devices
CMD_SHOW_IP_ARP = "show ip arp"
CMD_SHOW_MAC_TABLE = "show mac address-table"


def execute_get_client_data(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute get_client_data job.

    Connects to each device via Netmiko, runs:
      - show ip arp         (TextFSM parsed)
      - show mac address-table (TextFSM parsed)
    Then DNS-resolves the collected IP addresses and stores
    all results in the three client data tables.

    Args:
        schedule_id: Job schedule ID
        credential_id: ID of SSH credential for device authentication
        job_parameters: Dict with collect_ip_address, collect_mac_address,
                        collect_hostname flags
        target_devices: List of Nautobot device UUIDs (empty = all devices)
        task_context: Celery task context (for progress updates)
        template: Job template dict (fallback source for collect_* flags)
        job_run_id: Job run DB record ID

    Returns:
        dict: Summary with session_id and row counts
    """
    import asyncio

    import credentials_manager
    import service_factory
    from repositories.client_data_repository import ClientDataRepository
    from services.network.automation.netmiko import NetmikoService

    # -------------------------------------------------------------------------
    # Determine collect_* flags (job_parameters > template > True default)
    # -------------------------------------------------------------------------
    params = job_parameters or {}
    tmpl = template or {}

    collect_ip_address = params.get(
        "collect_ip_address", tmpl.get("collect_ip_address", True)
    )
    collect_mac_address = params.get(
        "collect_mac_address", tmpl.get("collect_mac_address", True)
    )
    collect_hostname = params.get(
        "collect_hostname", tmpl.get("collect_hostname", True)
    )

    credential_info: Dict[str, Any] = {
        "credential_id": credential_id,
        "credential_name": None,
        "username": None,
    }

    try:
        logger.info("=" * 80)
        logger.info("GET CLIENT DATA EXECUTOR STARTED")
        logger.info("=" * 80)
        logger.info("Schedule ID: %s", schedule_id)
        logger.info("Credential ID: %s", credential_id)
        logger.info(
            "Collect IP: %s | MAC: %s | Hostname: %s",
            collect_ip_address,
            collect_mac_address,
            collect_hostname,
        )
        logger.info(
            "Target devices: %s", len(target_devices) if target_devices else "all"
        )

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing…"},
        )

        # -------------------------------------------------------------------------
        # Validate credential
        # -------------------------------------------------------------------------
        if not credential_id:
            return {
                "success": False,
                "error": "No credential_id specified. Please select credentials.",
                "credential_info": credential_info,
            }

        credential = credentials_manager.get_credential_by_id(credential_id)
        if not credential:
            return {
                "success": False,
                "error": f"Credential {credential_id} not found",
                "credential_info": credential_info,
            }

        username = credential.get("username")
        credential_name = credential.get("name")

        try:
            password = credentials_manager.get_decrypted_password(credential_id)
        except Exception as exc:
            return {
                "success": False,
                "error": f"Failed to decrypt credential password: {exc}",
                "credential_info": credential_info,
            }

        if not username or not password:
            return {
                "success": False,
                "error": "Credential does not contain username or password",
                "credential_info": credential_info,
            }

        credential_info["credential_name"] = credential_name
        credential_info["username"] = username
        logger.info("Credential OK: %s (user: %s)", credential_name, username)

        # -------------------------------------------------------------------------
        # Resolve device list
        # -------------------------------------------------------------------------
        device_ids = target_devices or []
        if not device_ids:
            logger.info("No target devices — fetching all from Nautobot")
            task_context.update_state(
                state="PROGRESS",
                meta={
                    "current": 5,
                    "total": 100,
                    "status": "Fetching devices from Nautobot…",
                },
            )
            device_query_service = service_factory.build_device_query_service()
            devices_result = asyncio.run(device_query_service.get_devices())
            if devices_result and devices_result.get("devices"):
                device_ids = [d.get("id") for d in devices_result["devices"]]
                logger.info("Fetched %s devices", len(device_ids))
            else:
                logger.warning("No devices found in Nautobot")

        if not device_ids:
            return {
                "success": False,
                "error": "No devices to collect data from",
                "credential_info": credential_info,
            }

        # -------------------------------------------------------------------------
        # Build command list based on flags
        # -------------------------------------------------------------------------
        commands: List[str] = []
        if collect_ip_address:
            commands.append(CMD_SHOW_IP_ARP)
        if collect_mac_address:
            commands.append(CMD_SHOW_MAC_TABLE)

        if not commands:
            return {
                "success": True,
                "message": "No commands to execute (all collect_* flags are False)",
                "session_id": None,
                "total_devices": 0,
                "success_count": 0,
                "failed_count": 0,
                "arp_entries": 0,
                "mac_entries": 0,
                "hostname_entries": 0,
                "credential_info": credential_info,
            }

        # -------------------------------------------------------------------------
        # Generate session_id — cross-table join key for this collection run
        # -------------------------------------------------------------------------
        session_id = str(uuid.uuid4())
        logger.info("Session ID: %s", session_id)

        nautobot_service = service_factory.build_nautobot_service()
        netmiko_service = NetmikoService()
        repo = ClientDataRepository()

        total_devices = len(device_ids)
        successful_devices: List[str] = []
        failed_devices: List[str] = []

        all_arp_rows: List[dict] = []
        all_mac_rows: List[dict] = []
        all_hostname_rows: List[dict] = []

        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": 10,
                "total": 100,
                "status": f"Collecting data from {total_devices} devices…",
            },
        )

        # -------------------------------------------------------------------------
        # Per-device loop
        # -------------------------------------------------------------------------
        for idx, device_id in enumerate(device_ids, 1):
            device_name = device_id  # fallback if Nautobot fetch fails
            device_type = "cisco_ios"

            try:
                # Fetch device details from Nautobot via GraphQL
                query = """
                    query getDevice($deviceId: ID!) {
                      device(id: $deviceId) {
                        name
                        primary_ip4 {
                          address
                          host
                        }
                        platform {
                          network_driver
                        }
                      }
                    }
                """
                device_data = asyncio.run(
                    nautobot_service.graphql_query(query, {"deviceId": device_id})
                )

                if (
                    not device_data
                    or "data" not in device_data
                    or not device_data["data"].get("device")
                ):
                    logger.warning(
                        "[%s/%s] Device %s not found in Nautobot",
                        idx,
                        total_devices,
                        device_id,
                    )
                    failed_devices.append(device_id)
                    continue

                device = device_data["data"]["device"]
                device_name = device.get("name", device_id)

                primary_ip4 = device.get("primary_ip4") or {}
                host_ip = (
                    primary_ip4.get("host")
                    or (primary_ip4.get("address", "").split("/")[0])
                    or ""
                )

                platform_obj = device.get("platform") or {}
                platform_slug = platform_obj.get("network_driver") or ""
                device_type = netmiko_service._map_platform_to_device_type(
                    platform_slug
                )

                if not host_ip:
                    logger.warning(
                        "[%s/%s] Device %s has no primary IP — skipping",
                        idx,
                        total_devices,
                        device_name,
                    )
                    failed_devices.append(device_name)
                    continue

                logger.info(
                    "[%s/%s] Connecting to %s (%s) type=%s",
                    idx,
                    total_devices,
                    device_name,
                    host_ip,
                    device_type,
                )

                # Update progress
                progress = 10 + int((idx / total_devices) * 80)
                task_context.update_state(
                    state="PROGRESS",
                    meta={
                        "current": progress,
                        "total": 100,
                        "status": f"[{idx}/{total_devices}] {device_name}…",
                    },
                )

                # Execute commands via Netmiko
                _session_id, results = asyncio.run(
                    netmiko_service.execute_commands(
                        devices=[
                            {
                                "ip": host_ip,
                                "platform": platform_slug,
                            }
                        ],
                        commands=commands,
                        username=username,
                        password=password,
                        use_textfsm=True,
                    )
                )

                if not results:
                    logger.warning(
                        "[%s/%s] No results returned for %s",
                        idx,
                        total_devices,
                        device_name,
                    )
                    failed_devices.append(device_name)
                    continue

                device_result = results[0]
                if not device_result.get("success", False):
                    err = device_result.get("error", "unknown error")
                    logger.warning(
                        "[%s/%s] Failed on %s: %s", idx, total_devices, device_name, err
                    )
                    failed_devices.append(device_name)
                    continue

                command_outputs = device_result.get("command_outputs", {})

                # Parse ARP output
                if collect_ip_address and CMD_SHOW_IP_ARP in command_outputs:
                    arp_output = command_outputs[CMD_SHOW_IP_ARP]
                    arp_rows = _parse_arp_output(
                        arp_output, device_name, host_ip, session_id, idx, total_devices
                    )
                    all_arp_rows.extend(arp_rows)

                # Parse MAC table output
                if collect_mac_address and CMD_SHOW_MAC_TABLE in command_outputs:
                    mac_output = command_outputs[CMD_SHOW_MAC_TABLE]
                    mac_rows = _parse_mac_output(
                        mac_output, device_name, host_ip, session_id, idx, total_devices
                    )
                    all_mac_rows.extend(mac_rows)

                # DNS resolve IPs collected from this device
                if collect_hostname and all_arp_rows:
                    device_arp_rows = [
                        r
                        for r in all_arp_rows
                        if r["device_name"] == device_name
                        and r["session_id"] == session_id
                    ]
                    unique_ips = {
                        r["ip_address"] for r in device_arp_rows if r.get("ip_address")
                    }
                    hostname_rows = _resolve_hostnames(
                        unique_ips, device_name, host_ip, session_id
                    )
                    all_hostname_rows.extend(hostname_rows)

                successful_devices.append(device_name)
                logger.info(
                    "[%s/%s] ✓ %s — ARP: %s, MAC: %s",
                    idx,
                    total_devices,
                    device_name,
                    len([r for r in all_arp_rows if r["device_name"] == device_name]),
                    len([r for r in all_mac_rows if r["device_name"] == device_name]),
                )

            except Exception as exc:
                logger.warning(
                    "[%s/%s] Error on %s: %s",
                    idx,
                    total_devices,
                    device_name,
                    exc,
                    exc_info=True,
                )
                failed_devices.append(device_name)

        # -------------------------------------------------------------------------
        # Bulk insert all collected data
        # -------------------------------------------------------------------------
        task_context.update_state(
            state="PROGRESS",
            meta={"current": 92, "total": 100, "status": "Saving data to database…"},
        )

        arp_count = repo.bulk_insert_ip_addresses(all_arp_rows)
        mac_count = repo.bulk_insert_mac_addresses(all_mac_rows)
        hostname_count = repo.bulk_insert_hostnames(all_hostname_rows)

        logger.info("=" * 80)
        logger.info("GET CLIENT DATA COMPLETE")
        logger.info("Session ID: %s", session_id)
        logger.info(
            "Devices: %s ok / %s failed out of %s",
            len(successful_devices),
            len(failed_devices),
            total_devices,
        )
        logger.info(
            "Rows stored: ARP=%s, MAC=%s, Hostname=%s",
            arp_count,
            mac_count,
            hostname_count,
        )
        logger.info("=" * 80)

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 100, "total": 100, "status": "Done"},
        )

        return {
            "success": True,
            "session_id": session_id,
            "total_devices": total_devices,
            "success_count": len(successful_devices),
            "failed_count": len(failed_devices),
            "arp_entries": arp_count,
            "mac_entries": mac_count,
            "hostname_entries": hostname_count,
            "successful_devices": successful_devices,
            "failed_devices": failed_devices,
            "credential_info": credential_info,
        }

    except Exception as exc:
        logger.error("GET CLIENT DATA EXECUTOR FAILED: %s", exc, exc_info=True)
        return {
            "success": False,
            "error": str(exc),
            "credential_info": credential_info,
        }


# =============================================================================
# Parsing helpers
# =============================================================================


def _normalise_mac(mac: str) -> str:
    """Normalise MAC address to lowercase dotted-quad (cisco format).

    Both 'show ip arp' and 'show mac address-table' output MACs in the same
    dotted-quad format on Cisco IOS (e.g. aabb.cc00.0100), so no conversion
    is needed — we just lowercase and strip.
    """
    return mac.lower().strip()


def _parse_arp_output(
    output: Any,
    device_name: str,
    device_ip: str,
    session_id: str,
    idx: int,
    total: int,
) -> List[dict]:
    """Parse TextFSM-structured ARP output into DB row dicts.

    Expected ntc-templates field names (cisco_ios show ip arp):
        protocol, ip_address, age, mac_address, type, interface

    Falls back gracefully when TextFSM template is unavailable.
    """
    if not isinstance(output, list):
        logger.warning(
            "[%s/%s] No TextFSM template for '%s' on %s — raw output skipped "
            "(first 200 chars: %s)",
            idx,
            total,
            CMD_SHOW_IP_ARP,
            device_name,
            str(output)[:200] if output else "<empty>",
        )
        return []

    rows: List[dict] = []
    for entry in output:
        # ntc-templates cisco_ios field names: ip_address, mac_address, interface
        ip = (entry.get("ip_address") or entry.get("address") or "").strip()
        mac = (entry.get("mac_address") or entry.get("mac") or "").strip()
        interface = (entry.get("interface") or "").strip()

        if not ip:
            continue  # skip incomplete entries

        rows.append(
            {
                "session_id": session_id,
                "ip_address": ip,
                "mac_address": _normalise_mac(mac) if mac else None,
                "interface": interface or None,
                "device_name": device_name,
                "device_ip": device_ip or None,
            }
        )

    return rows


def _parse_mac_output(
    output: Any,
    device_name: str,
    device_ip: str,
    session_id: str,
    idx: int,
    total: int,
) -> List[dict]:
    """Parse TextFSM-structured MAC address table output into DB row dicts.

    Expected ntc-templates field names (cisco_ios show mac address-table):
        destination_address, type, vlan_id, destination_port (list)

    Falls back gracefully when TextFSM template is unavailable.
    """
    if not isinstance(output, list):
        logger.warning(
            "[%s/%s] No TextFSM template for '%s' on %s — raw output skipped "
            "(first 200 chars: %s)",
            idx,
            total,
            CMD_SHOW_MAC_TABLE,
            device_name,
            str(output)[:200] if output else "<empty>",
        )
        return []

    rows: List[dict] = []
    for entry in output:
        mac = (
            entry.get("destination_address")
            or entry.get("DESTINATION_ADDRESS")
            or entry.get("mac_address")
            or entry.get("MAC_ADDRESS")
            or ""
        ).strip()
        # ntc-templates cisco_ios field names: vlan_id (not vlan), destination_port is a list
        vlan = (entry.get("vlan_id") or entry.get("vlan") or "").strip()
        raw_port = entry.get("destination_port") or entry.get("ports") or ""
        # destination_port is returned as a list by ntc-templates (e.g. ['Et0/0'])
        if isinstance(raw_port, list):
            port = raw_port[0].strip() if raw_port else ""
        else:
            port = raw_port.strip()

        if not mac:
            continue

        rows.append(
            {
                "session_id": session_id,
                "mac_address": _normalise_mac(mac),
                "vlan": vlan or None,
                "port": port or None,
                "device_name": device_name,
                "device_ip": device_ip or None,
            }
        )

    return rows


def _resolve_hostnames(
    ip_addresses: set,
    device_name: str,
    device_ip: str,
    session_id: str,
) -> List[dict]:
    """DNS-resolve a set of IP addresses.

    Uses socket.gethostbyaddr() which is synchronous but acceptable here
    since the Celery executor already runs in a thread.
    Silently skips IPs that cannot be resolved.
    """
    rows: List[dict] = []
    for ip in ip_addresses:
        try:
            hostname, _aliases, _addrs = socket.gethostbyaddr(ip)
            rows.append(
                {
                    "session_id": session_id,
                    "ip_address": ip,
                    "hostname": hostname,
                    "device_name": device_name,
                    "device_ip": device_ip or None,
                }
            )
        except (socket.herror, socket.gaierror, OSError):
            # DNS resolution failed — skip silently (no reverse DNS record)
            pass

    return rows
