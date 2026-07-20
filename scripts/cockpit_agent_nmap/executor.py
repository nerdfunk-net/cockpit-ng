"""
Command executor for Cockpit Nmap Agent.
Runs port scans via python-nmap against targets reachable from this host.
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import re
import time
from typing import Any, Callable, Dict, List, Optional

import nmap

from config import config

logger = logging.getLogger(__name__)

_PORT_SPEC_RE = re.compile(r"^[\d,\-\s]+$")
_VALID_SCAN_TYPES = frozenset({"syn", "connect", "udp"})


class CommandExecutor:
    """Pluggable command executor with handler registry."""

    def __init__(self):
        self.handlers: Dict[str, Callable] = {}
        self._register_builtin_commands()

    def _register_builtin_commands(self) -> None:
        self.register("echo", self._execute_echo)
        self.register("scan_ports", self._execute_scan_ports)

    def register(self, command_name: str, handler: Callable) -> None:
        self.handlers[command_name] = handler
        logger.info("Registered command handler: %s", command_name)

    async def execute(
        self,
        command: str,
        params: dict,
        publish_progress: Optional[Callable] = None,
    ) -> dict:
        start_time = time.time()

        if command not in self.handlers:
            return {
                "status": "error",
                "error": f"Unknown command: {command}",
                "output": None,
                "execution_time_ms": 0,
            }

        try:
            handler = self.handlers[command]
            result = await handler(params, publish_progress=publish_progress)
            result["execution_time_ms"] = int((time.time() - start_time) * 1000)
            return result
        except Exception as exc:
            logger.error("Command execution failed: %s", command, exc_info=True)
            return {
                "status": "error",
                "error": str(exc),
                "output": None,
                "execution_time_ms": int((time.time() - start_time) * 1000),
            }

    async def _execute_echo(
        self, params: dict, publish_progress: Optional[Callable] = None
    ) -> dict:
        message = params.get("message", "pong")
        logger.info("Echo command: %s", message)
        return {"status": "success", "output": message, "error": None}

    async def _execute_scan_ports(
        self, params: dict, publish_progress: Optional[Callable] = None
    ) -> dict:
        """
        Scan open TCP/UDP ports on a target host using nmap.

        Expected params:
          ip_address        (required) — host or IP to scan
          ports             (optional) — nmap port spec, e.g. "22,80,443" or "1-1024"
          scan_type         (optional) — syn | connect | udp (default: config)
          service_detection (optional) — run -sV when true
          timeout           (optional) — scan timeout in seconds
        """
        ip_address = _normalize_target(params.get("ip_address"))
        if not ip_address:
            return {
                "status": "error",
                "error": "ip_address is required and must be a valid IP or hostname",
                "output": None,
            }

        ports = params.get("ports") or config.nmap_default_ports
        if not _is_valid_port_spec(str(ports)):
            return {
                "status": "error",
                "error": f"Invalid ports specification: {ports!r}",
                "output": None,
            }

        scan_type = str(
            params.get("scan_type") or config.nmap_default_scan_type
        ).lower()
        if scan_type not in _VALID_SCAN_TYPES:
            return {
                "status": "error",
                "error": f"scan_type must be one of: {', '.join(sorted(_VALID_SCAN_TYPES))}",
                "output": None,
            }

        service_detection = bool(
            params.get("service_detection", config.nmap_service_detection)
        )
        timeout = int(params.get("timeout", config.nmap_timeout))

        scan_args = _build_scan_arguments(
            scan_type=scan_type,
            ports=str(ports),
            service_detection=service_detection,
        )

        logger.info(
            "Starting nmap scan for %s (type=%s, ports=%s, args=%s)",
            ip_address,
            scan_type,
            ports,
            scan_args,
        )

        if publish_progress:
            publish_progress({"phase": "scanning", "target": ip_address})

        try:
            output = await asyncio.wait_for(
                asyncio.to_thread(
                    _run_nmap_scan,
                    ip_address,
                    scan_args,
                    timeout,
                ),
                timeout=timeout + 30,
            )
        except asyncio.TimeoutError:
            return {
                "status": "error",
                "error": f"nmap scan timed out after {timeout}s",
                "output": None,
            }
        except nmap.PortScannerError as exc:
            return {"status": "error", "error": str(exc), "output": None}

        logger.info(
            "Nmap scan complete for %s: %d TCP, %d UDP open ports",
            ip_address,
            len(output.get("tcp_ports", [])),
            len(output.get("udp_ports", [])),
        )
        return {"status": "success", "output": output, "error": None}


def _normalize_target(raw: Any) -> Optional[str]:
    if not raw or not isinstance(raw, str):
        return None
    value = raw.strip()
    if not value:
        return None
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        pass
    if len(value) <= 253 and re.match(r"^[a-zA-Z0-9._-]+$", value):
        return value
    return None


def _is_valid_port_spec(spec: str) -> bool:
    spec = spec.strip()
    return bool(spec) and bool(_PORT_SPEC_RE.match(spec))


def _build_scan_arguments(
    *,
    scan_type: str,
    ports: str,
    service_detection: bool,
) -> str:
    type_flag = {"syn": "-sS", "connect": "-sT", "udp": "-sU"}[scan_type]
    parts = [type_flag, "-Pn", f"-p {ports}"]
    if service_detection:
        parts.append("-sV")
    return " ".join(parts)


def _run_nmap_scan(target: str, arguments: str, timeout: int) -> dict[str, Any]:
    host_timeout = f"{int(timeout * 1000)}ms"
    full_arguments = f"{arguments} --host-timeout {host_timeout}"
    scanner = nmap.PortScanner(nmap_search_path=(config.nmap_path,))
    scanner.scan(hosts=target, arguments=full_arguments)

    host_key = _resolve_host_key(scanner, target)
    host_info = scanner[host_key] if host_key else {}
    hostname = (
        (
            host_info.get("hostnames", [{}])[0].get("name")
            if host_info.get("hostnames")
            else None
        )
        or host_key
        or target
    )

    tcp_ports = _extract_port_bindings(host_info.get("tcp", {}))
    udp_ports = _extract_port_bindings(host_info.get("udp", {}))

    return {
        "ip_address": host_key or target,
        "hostname": hostname,
        "host_status": host_info.get("status", {}).get("state", "unknown"),
        "tcp_ports": tcp_ports,
        "udp_ports": udp_ports,
        "scan_arguments": full_arguments,
        "services": _extract_services(host_info),
    }


def _resolve_host_key(scanner: nmap.PortScanner, target: str) -> Optional[str]:
    if not scanner.all_hosts():
        return target
    for host in scanner.all_hosts():
        if host == target:
            return host
    return scanner.all_hosts()[0]


def _extract_port_bindings(protocol_ports: dict) -> List[dict]:
    bindings: List[dict] = []
    for port, details in sorted(protocol_ports.items(), key=lambda item: int(item[0])):
        state = details.get("state", "")
        if state not in ("open", "open|filtered"):
            continue
        bindings.append({"address": "*", "port": int(port)})
    return bindings


def _extract_services(host_info: dict) -> List[dict]:
    services: List[dict] = []
    for proto in ("tcp", "udp"):
        for port, details in host_info.get(proto, {}).items():
            if details.get("state") not in ("open", "open|filtered"):
                continue
            entry: dict[str, Any] = {
                "protocol": proto,
                "port": int(port),
                "state": details.get("state"),
            }
            if details.get("name"):
                entry["service"] = details["name"]
            if details.get("product"):
                entry["product"] = details["product"]
            if details.get("version"):
                entry["version"] = details["version"]
            services.append(entry)
    return services
