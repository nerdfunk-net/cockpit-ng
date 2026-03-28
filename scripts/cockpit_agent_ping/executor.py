"""
Command executor for Cockpit Ping Agent
Handles execution of ping and echo commands
"""

import asyncio
import ipaddress
import logging
import platform
import re
import time
from typing import Callable, Dict, List, Optional, Tuple

_PROGRESS_EVERY_N_IPS = 10  # publish a progress update after every N completed IPs

from config import config

logger = logging.getLogger(__name__)

_IS_MACOS = platform.system() == "Darwin"

# Regex patterns for parsing ping RTT output
_RTT_PATTERN_LINUX = re.compile(r"rtt min/avg/max/mdev = [\d.]+/([\d.]+)/")
_RTT_PATTERN_MACOS = re.compile(r"round-trip min/avg/max/stddev = [\d.]+/([\d.]+)/")
_LOSS_PATTERN = re.compile(r"(\d+(?:\.\d+)?)% packet loss")


class CommandExecutor:
    """Pluggable command executor with handler registry"""

    def __init__(self):
        self.handlers: Dict[str, Callable] = {}
        self._register_builtin_commands()

    def _register_builtin_commands(self):
        """Register default command handlers"""
        self.register("echo", self._execute_echo)
        self.register("ping", self._execute_ping)

    def register(self, command_name: str, handler: Callable):
        """Register a new command handler"""
        self.handlers[command_name] = handler
        logger.info(f"Registered command handler: {command_name}")

    async def execute(self, command: str, params: dict, publish_progress: Optional[Callable] = None) -> dict:
        """
        Execute a command by name.

        publish_progress: optional callable(data: dict) that sends intermediate
        progress updates back to the backend while the command is still running.
        Currently only used by the 'ping' command.

        Returns: dict with status, output, error, execution_time_ms
        """
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
            if command == "ping":
                result = await handler(params, publish_progress=publish_progress)
            else:
                result = await handler(params)
            result["execution_time_ms"] = int((time.time() - start_time) * 1000)
            return result
        except Exception as e:
            logger.error(f"Command execution failed: {command}", exc_info=True)
            return {
                "status": "error",
                "error": str(e),
                "output": None,
                "execution_time_ms": int((time.time() - start_time) * 1000),
            }

    # ------------------------------------------------------------------
    # Built-in commands
    # ------------------------------------------------------------------

    async def _execute_echo(self, params: dict) -> dict:
        """Echo command for health checks"""
        message = params.get("message", "pong")
        logger.info(f"Echo command: {message}")
        return {"status": "success", "output": message, "error": None}

    async def _execute_ping(self, params: dict, publish_progress: Optional[Callable] = None) -> dict:
        """
        Ping a list of devices and return reachability results.

        Expected params:
        {
            "devices": [
                {
                    "device_name": "router1",
                    "device_id": "optional-uuid",
                    "ip_addresses": ["192.168.1.1", "10.0.0.1/24"]
                }
            ],
            "count": 3,      # ping count per IP (default: config.ping_count)
            "timeout": 5     # per-ping timeout in seconds (default: config.ping_timeout)
        }

        Returns:
        {
            "results": [...],
            "total_devices": N,
            "reachable_count": N,
            "unreachable_count": N
        }
        """
        devices: List[dict] = params.get("devices", [])
        if not devices:
            return {
                "status": "error",
                "error": "No devices provided in params.devices",
                "output": None,
            }

        count = int(params.get("count", config.ping_count))
        timeout = int(params.get("timeout", config.ping_timeout))

        logger.info(
            f"Ping command: {len(devices)} devices, count={count}, timeout={timeout}s"
        )

        # Build flat task list: (device_index, device_info, clean_ip, ip_uuid)
        # ip_addresses entries may be plain strings or {"address": ..., "uuid": ...} dicts.
        tasks: List[Tuple[int, dict, str, Optional[str]]] = []
        for idx, device in enumerate(devices):
            device_name = device.get("device_name", f"device-{idx}")
            raw_ips = device.get("ip_addresses", [])
            if not raw_ips:
                logger.warning(f"Device '{device_name}' has no ip_addresses, skipping")
            for raw_ip in raw_ips:
                if isinstance(raw_ip, dict):
                    ip_str = raw_ip.get("address", "")
                    ip_uuid: Optional[str] = raw_ip.get("uuid")
                else:
                    ip_str = raw_ip
                    ip_uuid = None
                clean_ip = _strip_cidr(ip_str)
                if clean_ip is None:
                    logger.warning(f"Invalid IP address '{ip_str}' for device '{device_name}', skipping")
                    continue
                tasks.append((idx, device, clean_ip, ip_uuid))

        # Run all pings concurrently, capped by semaphore.
        # Results are processed via as_completed so progress updates can be
        # published after every _PROGRESS_EVERY_N_IPS finished pings.
        semaphore = asyncio.Semaphore(config.ping_max_concurrency)
        total_ips = len(tasks)

        async def bounded_ping_tracked(task_tuple: Tuple[int, dict, str, Optional[str]]) -> Tuple:
            idx, device, ip, ip_uuid = task_tuple
            try:
                async with semaphore:
                    result = await _ping_one(ip, count, timeout)
            except Exception as e:
                logger.error(f"Unexpected error pinging {ip}: {e}")
                result = {"ip_address": ip, "reachable": False, "latency_ms": None, "packet_loss_percent": 100}
            if ip_uuid is not None:
                result["uuid"] = ip_uuid
            return task_tuple, result

        futures = [asyncio.ensure_future(bounded_ping_tracked(t)) for t in tasks]

        # Re-assemble per-device structure as results arrive
        device_ip_results: Dict[int, List[dict]] = {i: [] for i in range(len(devices))}
        completed_ips = 0

        for coro in asyncio.as_completed(futures):
            (idx, _, _ip, _uuid), result = await coro
            device_ip_results[idx].append(result)
            completed_ips += 1

            if publish_progress and completed_ips % _PROGRESS_EVERY_N_IPS == 0:
                publish_progress({
                    "completed_ips": completed_ips,
                    "total_ips": total_ips,
                })

        results = []
        for idx, device in enumerate(devices):
            results.append({
                "device_name": device.get("device_name", f"device-{idx}"),
                "device_id": device.get("device_id"),
                "ip_results": device_ip_results[idx],
            })

        reachable_ips = sum(
            1 for dev in results for r in dev["ip_results"] if r["reachable"]
        )
        unreachable_ips = sum(
            1 for dev in results for r in dev["ip_results"] if not r["reachable"]
        )

        output = {
            "results": results,
            "total_devices": len(devices),
            "reachable_count": reachable_ips,
            "unreachable_count": unreachable_ips,
        }

        logger.info(
            f"Ping complete: {reachable_ips} reachable, {unreachable_ips} unreachable IPs"
        )
        return {"status": "success", "output": output, "error": None}


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _strip_cidr(raw_ip: str) -> Optional[str]:
    """
    Strip CIDR prefix from an IP address string and validate it.
    Returns the plain IP string, or None if the input is invalid.

    Examples:
        "10.0.0.1/24" → "10.0.0.1"
        "192.168.1.1"  → "192.168.1.1"
        "not-an-ip"    → None
    """
    try:
        return str(ipaddress.ip_interface(raw_ip).ip)
    except ValueError:
        return None


async def _ping_one(ip: str, count: int, timeout: int) -> dict:
    """
    Ping a single IP address and return a result dict.

    Returns:
        {
            "ip_address": str,
            "reachable": bool,
            "latency_ms": float | None,
            "packet_loss_percent": int
        }
    """
    # -W behaviour differs between platforms:
    #   Linux:  seconds
    #   macOS:  milliseconds
    wait_arg = str(timeout * 1000) if _IS_MACOS else str(timeout)

    try:
        process = await asyncio.create_subprocess_exec(
            "ping",
            "-c", str(count),
            "-W", wait_arg,
            ip,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, _ = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout * count + 5,  # generous outer deadline
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            logger.warning(f"Ping to {ip} timed out")
            return _unreachable(ip)

        output_text = stdout.decode("utf-8", errors="replace")
        logger.debug(f"ping {ip} exit={process.returncode} output={output_text!r}")

        if process.returncode != 0:
            return _unreachable(ip)

        latency_ms = _parse_avg_latency(output_text)
        packet_loss = _parse_packet_loss(output_text)

        return {
            "ip_address": ip,
            "reachable": True,
            "latency_ms": latency_ms,
            "packet_loss_percent": packet_loss,
        }

    except Exception as e:
        logger.error(f"Error pinging {ip}: {e}", exc_info=True)
        return _unreachable(ip)


def _unreachable(ip: str) -> dict:
    return {
        "ip_address": ip,
        "reachable": False,
        "latency_ms": None,
        "packet_loss_percent": 100,
    }


def _parse_avg_latency(output: str) -> Optional[float]:
    """Extract average round-trip latency in ms from ping output."""
    pattern = _RTT_PATTERN_MACOS if _IS_MACOS else _RTT_PATTERN_LINUX
    match = pattern.search(output)
    if match:
        try:
            return round(float(match.group(1)), 3)
        except ValueError:
            pass
    return None


def _parse_packet_loss(output: str) -> int:
    """Extract packet loss percentage from ping output. Returns 0-100."""
    match = _LOSS_PATTERN.search(output)
    if match:
        try:
            return int(float(match.group(1)))
        except ValueError:
            pass
    return 0
