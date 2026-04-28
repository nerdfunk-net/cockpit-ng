from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional, Tuple

from ..models import SSH_LOGIN_TIMEOUT

try:
    from netmiko import ConnectHandler  # type: ignore
except ImportError:
    ConnectHandler = None

logger = logging.getLogger(__name__)

_DEVICE_TYPES = [
    "cisco_ios",
    "cisco_nxos",
    "cisco_iosxr",
    "cisco_asa",
    "juniper_junos",
    "arista_eos",
    "hp_procurve",
    "linux",
]


class NetmikoAuthenticator:
    """Authenticates and identifies devices via Netmiko. Falls back to SSH if unavailable."""

    def __init__(self) -> None:
        from .ssh import SshAuthenticator

        self._ssh_fallback = SshAuthenticator()

    async def authenticate(
        self,
        ip: str,
        username: str,
        password: str,
        parser_templates: Optional[List[Tuple[int, str]]] = None,
        debug_enabled: bool = False,
    ) -> Optional[Dict[str, Any]]:
        if ConnectHandler is None:
            logger.warning("Netmiko is not installed, falling back to basic SSH")
            return await self._ssh_fallback.authenticate(
                ip, username, password, parser_templates
            )

        for device_type in _DEVICE_TYPES:
            try:
                result = await self._try_device_type(
                    ip, username, password, device_type, debug_enabled
                )
                if result:
                    return result
            except Exception as e:
                logger.debug(
                    "Netmiko connection failed for %s with %s: %s", ip, device_type, e
                )

        logger.debug("All netmiko device types failed for %s", ip)
        return None

    async def _try_device_type(
        self,
        ip: str,
        username: str,
        password: str,
        device_type: str,
        debug_enabled: bool,
    ) -> Optional[Dict[str, Any]]:
        device_config = {
            "device_type": device_type,
            "host": ip,
            "username": username,
            "password": password,
            "timeout": SSH_LOGIN_TIMEOUT,
            "session_timeout": SSH_LOGIN_TIMEOUT,
            "banner_timeout": SSH_LOGIN_TIMEOUT,
            "auth_timeout": SSH_LOGIN_TIMEOUT,
        }
        logger.debug(
            "Trying netmiko connection to %s with device_type: %s", ip, device_type
        )
        connection = await asyncio.to_thread(ConnectHandler, **device_config)
        try:
            if device_type.startswith("linux"):
                return self._detect_linux(connection, ip)
            return self._detect_network_device(
                connection, ip, device_type, debug_enabled
            )
        finally:
            try:
                connection.disconnect()
            except Exception:
                pass

    def _detect_linux(self, connection: Any, ip: str) -> Dict[str, str]:
        try:
            output = connection.send_command("hostname", read_timeout=3)
            hostname = output.strip() or ip
        except Exception:
            hostname = ip
        return {"device_type": "linux", "hostname": hostname, "platform": "linux"}

    def _detect_network_device(
        self,
        connection: Any,
        ip: str,
        device_type: str,
        debug_enabled: bool,
    ) -> Dict[str, Any]:
        debug_data: Dict[str, Any] = {}
        hostname: Optional[str] = None

        try:
            show_version_raw = connection.send_command("show version", read_timeout=10)
            show_version_structured = connection.send_command(
                "show version", use_textfsm=True, read_timeout=10
            )

            if debug_enabled:
                debug_data = {
                    "device_type_tried": device_type,
                    "show_version_raw": show_version_raw,
                    "show_version_structured": show_version_structured,
                    "parsing_method": "netmiko_ntc_templates",
                }

            if (
                show_version_structured
                and isinstance(show_version_structured, list)
                and len(show_version_structured) > 0
            ):
                parsed = show_version_structured[0]
                if isinstance(parsed, dict):
                    hostname = (
                        parsed.get("hostname")
                        or parsed.get("device_name")
                        or parsed.get("system_name")
                        or parsed.get("name")
                    )
                    if debug_data:
                        debug_data["hostname_extracted"] = hostname
                        debug_data["parsed_fields"] = list(parsed.keys())
                    logger.info(
                        "Netmiko TextFSM parsing successful for %s, hostname: %s",
                        ip,
                        hostname,
                    )

            if not hostname and show_version_raw:
                hostname = self._extract_hostname_from_raw(show_version_raw)
                if debug_data and hostname:
                    debug_data["hostname_extraction_method"] = "fallback_raw_parsing"

        except Exception as e:
            logger.debug("Show version failed for %s with %s: %s", ip, device_type, e)
            if debug_data:
                debug_data["error"] = str(e)

        logger.info("Netmiko connection successful to %s as %s", ip, device_type)
        result: Dict[str, Any] = {
            "device_type": "cisco",
            "hostname": hostname or ip,
            "platform": device_type,
        }
        if debug_data:
            result["debug_info"] = debug_data
        return result

    def _extract_hostname_from_raw(self, output: str) -> Optional[str]:
        for line in output.split("\n"):
            line = line.strip()
            if "hostname" in line.lower() or "system name" in line.lower():
                parts = line.split()
                if len(parts) >= 2:
                    return parts[-1]
            if line.endswith("#") and not line.startswith("#"):
                return line.rstrip("#").strip()
        return None
