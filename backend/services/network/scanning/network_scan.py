from __future__ import annotations

import asyncio
import ipaddress
import platform
import subprocess
import logging
import tempfile
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set
from datetime import datetime

"""Network Scan service for ICMP ping discovery operations.

Extracted from scan_service.py to provide standalone network discovery functionality.
Supports both traditional ping and fping for efficient network scanning.
"""

logger = logging.getLogger(__name__)

# Configuration constants
PING_TIMEOUT_SECONDS = 1.5
DEFAULT_MAX_CONCURRENCY = 10
RETRY_ATTEMPTS = 3


@dataclass
class NetworkScanResult:
    """Result of a network scan operation."""

    cidr: str
    ping_mode: str
    total_targets: int
    alive_hosts: List[str] = field(default_factory=list)
    unreachable_hosts: List[str] = field(default_factory=list)
    scan_duration: float = 0.0
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


@dataclass
class NetworkScanProgress:
    """Progress tracking for network scan."""

    total: int
    scanned: int
    alive: int
    unreachable: int
    current_target: Optional[str] = None


class NetworkScanService:
    """Service for network discovery using ping/fping operations."""

    def __init__(self):
        self._active_scans: Dict[str, NetworkScanProgress] = {}

    async def scan_network(
        self,
        cidr: str,
        ping_mode: str = "fping",
        max_concurrent: int = DEFAULT_MAX_CONCURRENCY,
        timeout: float = PING_TIMEOUT_SECONDS,
        progress_callback: Optional[callable] = None,
        scan_id: Optional[str] = None,
    ) -> NetworkScanResult:
        """
        Scan a network using the specified ping mode.

        Args:
            cidr: Network in CIDR notation (e.g., "192.168.1.0/24")
            ping_mode: "ping" or "fping"
            max_concurrent: Maximum concurrent ping operations (for ping mode)
            timeout: Timeout in seconds for ping operations
            progress_callback: Optional callback for progress updates
            scan_id: Optional scan identifier for tracking

        Returns:
            NetworkScanResult with scan results and metadata
        """
        start_time = datetime.utcnow()

        # Validate and expand CIDR to target IPs
        try:
            targets = self._expand_cidr_to_ips(cidr)
        except Exception as e:
            logger.error(f"Invalid CIDR {cidr}: {e}")
            return NetworkScanResult(
                cidr=cidr,
                ping_mode=ping_mode,
                total_targets=0,
                error_message=f"Invalid CIDR: {str(e)}",
                started_at=start_time,
                completed_at=datetime.utcnow(),
            )

        # Initialize progress tracking
        progress = NetworkScanProgress(
            total=len(targets), scanned=0, alive=0, unreachable=0
        )

        if scan_id:
            self._active_scans[scan_id] = progress

        logger.info(
            f"Starting network scan of {cidr} with {len(targets)} targets using {ping_mode}"
        )

        alive_hosts: Set[str] = set()

        try:
            if ping_mode == "fping":
                # Use fping for efficient bulk scanning with expanded IP list
                alive_hosts = await asyncio.to_thread(self._fping_networks, targets)
                progress.scanned = progress.total
                progress.alive = len(alive_hosts)
                progress.unreachable = progress.total - progress.alive
            else:
                # Use individual ping operations with concurrency control
                alive_hosts = await self._ping_targets_concurrent(
                    targets, max_concurrent, timeout, progress, progress_callback
                )

            # Calculate unreachable hosts
            unreachable_hosts = [ip for ip in targets if ip not in alive_hosts]

            end_time = datetime.utcnow()
            scan_duration = (end_time - start_time).total_seconds()

            result = NetworkScanResult(
                cidr=cidr,
                ping_mode=ping_mode,
                total_targets=len(targets),
                alive_hosts=sorted(list(alive_hosts)),
                unreachable_hosts=unreachable_hosts,
                scan_duration=scan_duration,
                started_at=start_time,
                completed_at=end_time,
            )

            logger.info(
                f"Network scan completed: {len(alive_hosts)} alive, "
                f"{len(unreachable_hosts)} unreachable, {scan_duration:.2f}s"
            )

            return result

        except Exception as e:
            logger.error(f"Network scan failed: {e}")
            return NetworkScanResult(
                cidr=cidr,
                ping_mode=ping_mode,
                total_targets=len(targets),
                error_message=str(e),
                started_at=start_time,
                completed_at=datetime.utcnow(),
            )
        finally:
            # Clean up progress tracking
            if scan_id and scan_id in self._active_scans:
                del self._active_scans[scan_id]

    def get_scan_progress(self, scan_id: str) -> Optional[NetworkScanProgress]:
        """Get current progress for an active scan."""
        return self._active_scans.get(scan_id)

    def _expand_cidr_to_ips(self, cidr: str) -> List[str]:
        """Convert CIDR notation to list of IP addresses."""
        try:
            network = ipaddress.ip_network(cidr, strict=False)

            # Safety check: enforce reasonable network sizes
            if network.prefixlen < 16:  # Larger than /16 might be too big
                raise ValueError(
                    f"Network too large: {cidr}. Minimum prefix length is /16"
                )

            # Convert to list of IP strings
            if network.prefixlen == 32:
                # Single host
                return [str(network.network_address)]
            else:
                # Network range - get all hosts
                return [str(ip) for ip in network.hosts()]

        except Exception as e:
            raise ValueError(f"Invalid CIDR notation {cidr}: {e}")

    async def _ping_targets_concurrent(
        self,
        targets: List[str],
        max_concurrent: int,
        timeout: float,
        progress: NetworkScanProgress,
        progress_callback: Optional[callable] = None,
    ) -> Set[str]:
        """Ping multiple targets with concurrency control."""
        semaphore = asyncio.Semaphore(max_concurrent)
        alive_hosts: Set[str] = set()

        async def ping_single_target(ip: str) -> None:
            async with semaphore:
                progress.current_target = ip

                # Try pinging with retries
                alive = False
                for attempt in range(RETRY_ATTEMPTS):
                    try:
                        if await asyncio.to_thread(self._ping_host, ip, timeout):
                            alive = True
                            break
                    except Exception as e:
                        logger.debug(f"Ping attempt {attempt + 1} failed for {ip}: {e}")

                # Update results and progress
                if alive:
                    alive_hosts.add(ip)
                    progress.alive += 1
                else:
                    progress.unreachable += 1

                progress.scanned += 1
                progress.current_target = None

                # Call progress callback if provided
                if progress_callback:
                    try:
                        await progress_callback(progress)
                    except Exception as e:
                        logger.warning(f"Progress callback failed: {e}")

        # Execute all ping operations concurrently
        await asyncio.gather(*[ping_single_target(ip) for ip in targets])

        return alive_hosts

    def _ping_host(self, ip: str, timeout: float = PING_TIMEOUT_SECONDS) -> bool:
        """Ping a single host using system ping command."""
        system = platform.system().lower()

        # Platform-specific ping command
        if system == "darwin":  # macOS
            cmd = [
                "ping",
                "-c",
                "1",
                "-W",
                str(int(timeout * 1000)),
                ip,
            ]  # -W in milliseconds on macOS
        else:  # Linux and others
            cmd = [
                "ping",
                "-c",
                "1",
                "-W",
                str(int(timeout)),
                ip,
            ]  # -W in seconds on Linux

        try:
            result = subprocess.run(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=timeout + 1,  # Allow extra time for process
            )
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            return False
        except Exception:
            return False

    def _fping_networks(self, ip_list: List[str]) -> Set[str]:
        """Use fping to ping multiple IP addresses efficiently using a temporary file."""
        if not ip_list:
            return set()

        alive_ips: Set[str] = set()
        temp_file_path = None

        try:
            # Create temporary file with all IP addresses
            with tempfile.NamedTemporaryFile(
                mode="w", delete=False, suffix=".txt", prefix="fping_targets_"
            ) as temp_file:
                temp_file_path = temp_file.name
                for ip in ip_list:
                    temp_file.write(f"{ip}\n")

            logger.info(
                f"Created temporary file {temp_file_path} with {len(ip_list)} IP addresses"
            )

            # Run fping command reading from the temporary file
            cmd = ["fping"]

            logger.info(f"Running fping command: {' '.join(cmd)} < {temp_file_path}")

            # Use shell=True to support input redirection
            result = subprocess.run(
                f"fping < {temp_file_path}",
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=PING_TIMEOUT_SECONDS
                * 10,  # Allow more time for network scanning
                text=True,
            )

            # Parse fping output
            # Format examples:
            # "8.8.8.8 is alive"
            # "8.8.8.8 : duplicate for [0], 64 bytes, 538 ms"
            # "100.113.172.23 is unreachable"

            # Process both stdout and stderr as fping can output to both
            all_output = ""
            if result.stdout:
                all_output += result.stdout
            if result.stderr:
                all_output += result.stderr

            if all_output:
                for line in all_output.strip().split("\n"):
                    line = line.strip()
                    if not line:
                        continue

                    # Extract IP address from the beginning of the line
                    parts = line.split()
                    if len(parts) >= 3:
                        ip = parts[0]
                        status_indicator = (
                            parts[1] + " " + parts[2]
                        )  # "is alive" or "is unreachable"

                        if self._is_valid_ip(ip):
                            if "is alive" in status_indicator:
                                alive_ips.add(ip)
                            # We ignore "is unreachable" and other statuses (like duplicates)

            logger.info(
                f"fping discovered {len(alive_ips)} alive hosts out of {len(ip_list)} targets"
            )

        except subprocess.TimeoutExpired:
            logger.warning("fping command timed out")
        except FileNotFoundError:
            logger.error(
                "fping command not found. Please install fping or use 'ping' mode instead"
            )
        except Exception as e:
            logger.error(f"fping command failed: {e}")
        finally:
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.debug(f"Cleaned up temporary file {temp_file_path}")
                except Exception as e:
                    logger.warning(
                        f"Failed to clean up temporary file {temp_file_path}: {e}"
                    )

        return alive_ips

    def _is_valid_ip(self, ip_str: str) -> bool:
        """Validate if string is a valid IP address."""
        try:
            ipaddress.ip_address(ip_str)
            return True
        except ValueError:
            return False


# Global service instance
network_scan_service = NetworkScanService()
