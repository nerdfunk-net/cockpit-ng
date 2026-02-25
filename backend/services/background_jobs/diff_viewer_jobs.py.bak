"""
Diff Viewer Celery task.
Compares device inventories between Nautobot and CheckMK.
"""

import asyncio
import logging
from typing import Dict, Any, List
from celery import shared_task

logger = logging.getLogger(__name__)


def _get_checkmk_client():
    """Create CheckMK client from database settings."""
    from settings_manager import settings_manager
    from checkmk.client import CheckMKClient
    from urllib.parse import urlparse

    db_settings = settings_manager.get_checkmk_settings()
    if not db_settings or not all(
        key in db_settings for key in ["url", "site", "username", "password"]
    ):
        raise ValueError("CheckMK settings not configured")

    url = db_settings["url"].rstrip("/")
    if url.startswith(("http://", "https://")):
        parsed_url = urlparse(url)
        protocol = parsed_url.scheme
        host = parsed_url.netloc
    else:
        protocol = "https"
        host = url

    return CheckMKClient(
        host=host,
        site_name=db_settings["site"],
        username=db_settings["username"],
        password=db_settings["password"],
        protocol=protocol,
        verify_ssl=db_settings.get("verify_ssl", True),
        timeout=30,
    )


async def _fetch_nautobot_devices() -> List[Dict[str, Any]]:
    """Fetch all devices from Nautobot."""
    from services.nautobot.devices.query import device_query_service

    result = await device_query_service.get_devices()
    return result.get("devices", [])


def _fetch_checkmk_hosts() -> List[Dict[str, Any]]:
    """Fetch all hosts from CheckMK."""
    client = _get_checkmk_client()
    response = client.get_all_hosts()
    return response.get("value", [])


def _build_diff_device(
    name: str,
    source: str,
    nb_device: Dict[str, Any] = None,
    cmk_host: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """Build a unified DiffDevice dict from Nautobot and/or CheckMK data."""
    device = {
        "name": name,
        "source": source,
        "nautobot_id": None,
        "ip_address": None,
        "role": None,
        "location": None,
        "status": None,
        "device_type": None,
        "checkmk_folder": None,
        "checkmk_alias": None,
        "checkmk_ip": None,
    }

    if nb_device:
        device["nautobot_id"] = nb_device.get("id")
        primary_ip4 = nb_device.get("primary_ip4")
        if primary_ip4 and isinstance(primary_ip4, dict):
            device["ip_address"] = primary_ip4.get("address")
        role = nb_device.get("role")
        if role and isinstance(role, dict):
            device["role"] = role.get("name")
        location = nb_device.get("location")
        if location and isinstance(location, dict):
            device["location"] = location.get("name")
        status = nb_device.get("status")
        if status and isinstance(status, dict):
            device["status"] = status.get("name")
        device_type = nb_device.get("device_type")
        if device_type and isinstance(device_type, dict):
            device["device_type"] = device_type.get("model")

    if cmk_host:
        extensions = cmk_host.get("extensions", {})
        attributes = extensions.get("attributes", {})
        device["checkmk_folder"] = extensions.get("folder", None)
        device["checkmk_alias"] = attributes.get("alias", None)
        device["checkmk_ip"] = attributes.get("ipaddress", None)
        # Use CheckMK location if Nautobot location is not available
        if not device["location"]:
            cmk_location = attributes.get("tag_location") or attributes.get("location")
            if cmk_location:
                device["location"] = cmk_location

    return device


@shared_task(bind=True, name="get_diff_between_nb_checkmk")
def get_diff_between_nb_checkmk_task(self) -> Dict[str, Any]:
    """
    Celery task to compare device inventories between Nautobot and CheckMK.

    Fetches all devices from both systems and categorizes them into:
    - all_devices: union of both systems
    - nautobot_only: devices only in Nautobot
    - checkmk_only: devices only in CheckMK

    Device matching uses case-insensitive name comparison.

    Returns:
        Dictionary with categorized device lists and counts.
    """
    try:
        logger.info("Starting diff between Nautobot and CheckMK inventories")

        self.update_state(
            state="PROGRESS",
            meta={"status": "Fetching Nautobot devices..."},
        )

        # Fetch Nautobot devices (async)
        try:
            nb_devices = asyncio.run(_fetch_nautobot_devices())
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                nb_devices = loop.run_until_complete(_fetch_nautobot_devices())
            finally:
                loop.close()

        logger.info(f"Fetched {len(nb_devices)} devices from Nautobot")

        self.update_state(
            state="PROGRESS",
            meta={"status": "Fetching CheckMK hosts..."},
        )

        # Fetch CheckMK hosts (sync)
        cmk_hosts = _fetch_checkmk_hosts()
        logger.info(f"Fetched {len(cmk_hosts)} hosts from CheckMK")

        self.update_state(
            state="PROGRESS",
            meta={"status": "Comparing inventories..."},
        )

        # Build lookup dicts keyed by lowercase name
        nb_lookup: Dict[str, Dict[str, Any]] = {}
        for device in nb_devices:
            name = device.get("name", "")
            if name:
                nb_lookup[name.lower()] = device

        cmk_lookup: Dict[str, Dict[str, Any]] = {}
        for host in cmk_hosts:
            host_name = host.get("id", "") or host.get("host_name", "")
            if host_name:
                cmk_lookup[host_name.lower()] = host

        # Categorize devices
        all_devices: List[Dict[str, Any]] = []
        nautobot_only: List[Dict[str, Any]] = []
        checkmk_only: List[Dict[str, Any]] = []

        # Track processed CheckMK names
        processed_cmk_names = set()

        # Process Nautobot devices
        for name_lower, nb_device in nb_lookup.items():
            display_name = nb_device.get("name", name_lower)
            if name_lower in cmk_lookup:
                # Device in both systems
                cmk_host = cmk_lookup[name_lower]
                processed_cmk_names.add(name_lower)
                diff_device = _build_diff_device(
                    display_name, "both", nb_device=nb_device, cmk_host=cmk_host
                )
                all_devices.append(diff_device)
            else:
                # Nautobot only
                diff_device = _build_diff_device(
                    display_name, "nautobot", nb_device=nb_device
                )
                all_devices.append(diff_device)
                nautobot_only.append(diff_device)

        # Process CheckMK-only hosts
        for name_lower, cmk_host in cmk_lookup.items():
            if name_lower not in processed_cmk_names:
                display_name = cmk_host.get("id", "") or cmk_host.get(
                    "host_name", name_lower
                )
                diff_device = _build_diff_device(
                    display_name, "checkmk", cmk_host=cmk_host
                )
                all_devices.append(diff_device)
                checkmk_only.append(diff_device)

        total_both = len(all_devices) - len(nautobot_only) - len(checkmk_only)

        logger.info(
            f"Diff complete: {len(all_devices)} total, "
            f"{total_both} in both, "
            f"{len(nautobot_only)} Nautobot-only, "
            f"{len(checkmk_only)} CheckMK-only"
        )

        return {
            "success": True,
            "all_devices": all_devices,
            "nautobot_only": nautobot_only,
            "checkmk_only": checkmk_only,
            "total_nautobot": len(nb_lookup),
            "total_checkmk": len(cmk_lookup),
            "total_both": total_both,
        }

    except Exception as e:
        logger.error(f"Diff task failed: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "message": f"Failed to compare inventories: {e}",
            "all_devices": [],
            "nautobot_only": [],
            "checkmk_only": [],
            "total_nautobot": 0,
            "total_checkmk": 0,
            "total_both": 0,
        }
