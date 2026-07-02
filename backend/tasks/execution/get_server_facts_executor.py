"""
Get Server Facts executor.

Scans user-supplied CIDR prefixes, pings for reachable hosts, and for each
reachable host attempts an Ansible-agent facts gather. On success, the parsed
facts are stored as a Server record (created or updated by hostname).
"""

import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def execute_get_server_facts(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute get_server_facts job.

    Reads from job_parameters (falling back to template):
      - agent_id : ID of the Ansible-type cockpit agent to gather facts through
      - prefixes : list of CIDR strings to scan

    The authentication method is supplied by the job schedule via job_parameters:
      - facts_auth_type   : "ssh_key" | "ssh_key_passphrase" | "credentials" (default "credentials")
      - facts_ansible_user: SSH username, required only for "ssh_key" mode
      - credential_id (schedule-level): required for "ssh_key_passphrase" and "credentials" modes

    Returns:
        dict with success, total/reachable_count/scanned_ip_count,
        success_count, failed_count, and a per-host results list.
    """
    params = job_parameters or {}
    tmpl = template or {}

    agent_id = params.get("agent_id") or tmpl.get("facts_agent_id")
    if not agent_id:
        return {"success": False, "error": "No agent_id configured for this template"}

    raw_prefixes = params.get("prefixes") or tmpl.get("facts_prefixes")
    if isinstance(raw_prefixes, str):
        try:
            raw_prefixes = json.loads(raw_prefixes)
        except json.JSONDecodeError:
            raw_prefixes = None
    if not raw_prefixes:
        return {
            "success": False,
            "error": "No CIDR prefixes configured for this template",
        }

    import service_factory

    auth_type = (
        params.get("facts_auth_type") or tmpl.get("facts_auth_type") or "credentials"
    )
    if auth_type not in ("ssh_key", "ssh_key_passphrase", "credentials"):
        return {"success": False, "error": f"Invalid facts_auth_type: {auth_type}"}

    use_sshkey = auth_type in ("ssh_key", "ssh_key_passphrase")
    ansible_user: Optional[str] = None
    resolved_credential_id: Optional[int] = None

    if auth_type == "ssh_key":
        ansible_user = params.get("facts_ansible_user") or tmpl.get(
            "facts_ansible_user"
        )
        if not ansible_user:
            return {
                "success": False,
                "error": "SSH username is required for SSH key authentication",
            }
    else:
        if not credential_id:
            return {
                "success": False,
                "error": "No credential_id specified. Please select credentials on the schedule.",
            }

        credentials_manager = service_factory.build_credentials_service()
        credential = credentials_manager.get_credential_by_id(credential_id)
        if not credential:
            return {"success": False, "error": f"Credential {credential_id} not found"}
        ansible_user = credential.get("username")
        if not ansible_user:
            return {
                "success": False,
                "error": f"Credential {credential_id} has no username",
            }
        resolved_credential_id = credential_id

    sent_by = params.get("sent_by", "celery_scheduler")

    from tasks.ping_network_task import _expand_cidr_to_ips, _fping_networks

    all_ips: List[str] = []
    for cidr in raw_prefixes:
        try:
            all_ips.extend(_expand_cidr_to_ips(cidr))
        except ValueError as exc:
            return {"success": False, "error": str(exc)}
    all_ips = sorted(set(all_ips))

    if not all_ips:
        return {
            "success": True,
            "message": "No IPs to scan",
            "total": 0,
            "reachable_count": 0,
            "scanned_ip_count": 0,
            "success_count": 0,
            "failed_count": 0,
            "results": [],
        }

    task_context.update_state(
        state="PROGRESS",
        meta={"current": 5, "total": 100, "status": f"Pinging {len(all_ips)} IPs…"},
    )

    alive_ips = sorted(_fping_networks(all_ips))
    if not alive_ips:
        return {
            "success": True,
            "message": "No hosts reachable",
            "total": 0,
            "reachable_count": 0,
            "scanned_ip_count": len(all_ips),
            "success_count": 0,
            "failed_count": 0,
            "results": [],
        }

    from core.database import SessionLocal
    from models.servers import (
        AnsibleCredentials,
        CreateServerRequest,
        UpdateServerRequest,
    )
    from services.cockpit_agent.cockpit_agent_service import CockpitAgentService
    from services.servers.ansible_facts_parser import parse_ansible_facts

    servers_service = service_factory.build_servers_service()
    db = SessionLocal()
    results: List[Dict[str, Any]] = []
    success_count = 0
    failed_count = 0

    try:
        agent_service = CockpitAgentService(db)
        if not agent_service.check_agent_online(agent_id):
            return {
                "success": False,
                "error": f"Agent '{agent_id}' is offline or not responding",
            }

        total = len(alive_ips)
        for idx, ip in enumerate(alive_ips):
            task_context.update_state(
                state="PROGRESS",
                meta={
                    "current": 10 + int(80 * idx / total),
                    "total": 100,
                    "status": f"Gathering facts from {ip} ({idx + 1}/{total})",
                },
            )
            try:
                raw = agent_service.send_ansible_get_facts(
                    agent_id=agent_id,
                    ip_address=ip,
                    use_sshkey=use_sshkey,
                    sent_by=sent_by,
                    ansible_user=ansible_user if auth_type == "ssh_key" else None,
                    credential_id=resolved_credential_id,
                    timeout=90,
                )
                if raw.get("status") != "success":
                    failed_count += 1
                    results.append(
                        {
                            "hostname": ip,
                            "operation": "get_facts",
                            "success": False,
                            "error": raw.get("error") or "Agent returned an error",
                        }
                    )
                    continue

                parsed = parse_ansible_facts(raw.get("output"))
                hostname = parsed.hostname or ip

                # The Server model only supports storing a credential_id alongside
                # username/password auth (use_sshkey=False) — for both SSH-key modes
                # (with or without passphrase) no credential_id is persisted, matching
                # AnsibleCredentials' validation contract (see models/servers.py).
                ansible_creds = AnsibleCredentials(
                    target=ip,
                    agent_id=agent_id,
                    use_sshkey=use_sshkey,
                    ansible_user=ansible_user,
                    credential_id=None if use_sshkey else resolved_credential_id,
                )

                existing = servers_service.get_by_hostname(hostname)
                if existing:
                    servers_service.update(
                        existing.id,
                        UpdateServerRequest(
                            hostname=hostname,
                            primary_ipv4=parsed.primary_ipv4 or ip,
                            primary_interface=parsed.primary_interface or None,
                            os_family=parsed.os_family or None,
                            processor_count=parsed.processor_count,
                            memtotal_mb=parsed.memtotal_mb,
                            disk_count=parsed.disk_count,
                            architecture=parsed.architecture or None,
                            distribution_release=parsed.distribution_release or None,
                            distribution_version=parsed.distribution_version or None,
                            is_virtual=parsed.is_virtual,
                            ansible_facts=parsed.ansible_facts,
                            ansible_credentials=ansible_creds,
                        ),
                    )
                    operation = "update"
                    server_id = existing.id
                else:
                    server = servers_service.create(
                        CreateServerRequest(
                            hostname=hostname,
                            primary_ipv4=parsed.primary_ipv4 or ip,
                            primary_interface=parsed.primary_interface or None,
                            os_family=parsed.os_family or None,
                            processor_count=parsed.processor_count,
                            memtotal_mb=parsed.memtotal_mb,
                            disk_count=parsed.disk_count,
                            architecture=parsed.architecture or None,
                            distribution_release=parsed.distribution_release or None,
                            distribution_version=parsed.distribution_version or None,
                            is_virtual=parsed.is_virtual,
                            ansible_facts=parsed.ansible_facts,
                            ansible_credentials=ansible_creds,
                        )
                    )
                    operation = "create"
                    server_id = server.id

                success_count += 1
                results.append(
                    {
                        "hostname": hostname,
                        "operation": operation,
                        "success": True,
                        "message": f"Facts stored (server id {server_id})",
                    }
                )
            except Exception as exc:
                logger.warning("Failed to gather facts from %s: %s", ip, exc)
                failed_count += 1
                results.append(
                    {
                        "hostname": ip,
                        "operation": "get_facts",
                        "success": False,
                        "error": str(exc),
                    }
                )

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 100, "total": 100, "status": "Done"},
        )

        return {
            "success": True,
            "total": len(alive_ips),
            "reachable_count": len(alive_ips),
            "scanned_ip_count": len(all_ips),
            "success_count": success_count,
            "failed_count": failed_count,
            "results": results,
        }
    except Exception as exc:
        logger.error("Get server facts executor failed: %s", exc, exc_info=True)
        return {"success": False, "error": str(exc)}
    finally:
        db.close()
