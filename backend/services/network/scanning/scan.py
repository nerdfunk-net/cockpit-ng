from __future__ import annotations

import asyncio
import io
import ipaddress
import time
import platform
import subprocess
import logging
import tempfile
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Tuple

from napalm import get_network_driver  # type: ignore
import paramiko  # type: ignore

from credentials_manager import get_decrypted_password, list_credentials
from template_manager import template_manager

try:
    from netmiko import ConnectHandler  # type: ignore
except ImportError:
    ConnectHandler = None  # Will guard usage

try:
    import textfsm  # type: ignore
except Exception:
    textfsm = None  # Will guard usage

"""Scan & Add service for network discovery and credential-based login attempts.

Implementation per specification:
- ICMP ping (1500ms timeout) + 3 retries per device
- Concurrency limit: 10 hosts
- SSH/Napalm login timeout: 5s
- Napalm drivers: ios -> nxos_ssh -> iosxr -> Linux (paramiko)
- Stop on first credential success per host
- Result fields: {ip, credential_id, device_type, hostname, platform}
- In-memory job store with 24h TTL
"""

logger = logging.getLogger(__name__)

# Configuration per specification
JOB_TTL_SECONDS = 24 * 3600
PING_TIMEOUT_SECONDS = 1.5  # Updated per spec: 1500ms
SSH_LOGIN_TIMEOUT = 5  # 5 seconds per spec
MAX_CONCURRENCY = 10
RETRY_ATTEMPTS = 3  # Updated per spec: 3 retries


@dataclass
class ScanResult:
    ip: str
    credential_id: int
    device_type: str  # 'cisco' | 'linux'
    hostname: Optional[str] = None
    platform: Optional[str] = None
    debug_info: Optional[Dict[str, Any]] = (
        None  # Debug information when debug mode enabled
    )


@dataclass
class ScanJob:
    job_id: str
    created: float
    cidrs: List[str]
    credential_ids: List[int]
    discovery_mode: str
    ping_mode: str  # 'ping' | 'fping'
    total_targets: int
    debug_enabled: bool = False
    scanned: int = 0
    alive: int = 0
    authenticated: int = 0
    unreachable: int = 0
    auth_failed: int = 0
    driver_not_supported: int = 0
    state: str = "running"  # running|finished
    results: List[ScanResult] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


class ScanService:
    def __init__(self) -> None:
        self._jobs: Dict[str, ScanJob] = {}

    def _purge_expired(self) -> None:
        """Remove jobs older than 24 hours."""
        now = time.time()
        expired_jobs = [
            job_id
            for job_id, job in self._jobs.items()
            if now - job.created > JOB_TTL_SECONDS
        ]
        for job_id in expired_jobs:
            self._jobs.pop(job_id, None)
            logger.info("Purged expired scan job: %s", job_id)

    def _next_job_id(self) -> str:
        return f"scan_{int(time.time() * 1000)}_{len(self._jobs) + 1}"

    async def start_job(
        self,
        cidrs: List[str],
        credential_ids: List[int],
        discovery_mode: str = "netmiko",
        ping_mode: str = "fping",
        parser_template_ids: Optional[List[int]] = None,
        debug_enabled: bool = False,
    ) -> ScanJob:
        """Start a new network scan job."""
        # Expand and deduplicate IP addresses from CIDRs
        targets: List[str] = []
        seen: Set[str] = set()

        for cidr in cidrs:
            try:
                network = ipaddress.ip_network(cidr, strict=False)
                # Safety check: enforce /22 minimum (max ~1024 hosts)
                if network.prefixlen < 22:
                    logger.warning("Skipping oversized network: %s", cidr)
                    continue

                for ip in network.hosts():
                    ip_str = str(ip)
                    if ip_str not in seen:
                        seen.add(ip_str)
                        targets.append(ip_str)
            except Exception as e:
                logger.error("Invalid CIDR %s: %s", cidr, e)
                continue

        job = ScanJob(
            job_id=self._next_job_id(),
            created=time.time(),
            cidrs=cidrs,
            credential_ids=credential_ids,
            discovery_mode=discovery_mode,
            ping_mode=ping_mode,
            total_targets=len(targets),
            debug_enabled=debug_enabled,
        )

        self._jobs[job.job_id] = job
        logger.info("Started scan job %s with %s targets", job.job_id, len(targets))

        # Start background scan task
        asyncio.create_task(self._run_scan(job, targets, parser_template_ids or []))
        return job

    async def get_job(self, job_id: str) -> Optional[ScanJob]:
        """Get job status by ID."""
        self._purge_expired()
        return self._jobs.get(job_id)

    async def _run_scan(
        self, job: ScanJob, targets: List[str], parser_template_ids: List[int]
    ) -> None:
        """Execute the network scan with concurrency control."""
        semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

        # Load credentials once
        try:
            credentials = {c["id"]: c for c in list_credentials()}  # type: ignore
        except Exception as e:
            logger.error("Failed to load credentials: %s", e)
            job.state = "finished"
            return

        # Preload parser templates content
        parser_templates: List[Tuple[int, str]] = []
        logger.info("Processing parser_template_ids: %s", parser_template_ids)
        if parser_template_ids and textfsm is not None:
            for tid in parser_template_ids:
                try:
                    t = template_manager.get_template(tid)
                    if (
                        t
                        and t.get("category") == "parser"
                        and t.get("template_type") in ("textfsm", "text")
                    ):
                        content = template_manager.get_template_content(tid)
                        if content:
                            parser_templates.append((tid, content))
                            logger.info(
                                "Loaded parser template %s: %s", tid, t.get('name', 'Unknown')
                            )
                except Exception as e:
                    logger.warning("Failed to preload parser template %s: %s", tid, e)
        logger.info("Total parser templates loaded: %s", len(parser_templates))
        if not parser_template_ids:
            logger.info("No parser templates specified")
        elif textfsm is None:
            logger.warning("TextFSM not available, parser templates will be ignored")

        # Handle ping operations based on ping mode
        alive_ips: Set[str] = set()

        if job.ping_mode == "fping":
            # Use fping for bulk ping operations - expand CIDRs to individual IPs
            all_ips: List[str] = []
            for cidr in job.cidrs:
                try:
                    cidr_ips = self._expand_cidr_to_ips(cidr)
                    all_ips.extend(cidr_ips)
                except Exception as e:
                    logger.error("Invalid CIDR %s: %s", cidr, e)
                    continue

            alive_ips = await asyncio.to_thread(self._fping_networks, all_ips)
            logger.info(
                "fping found %s alive hosts out of %s targets", len(alive_ips), len(targets)
            )
        else:
            # Use individual ping operations (original behavior)
            logger.info("Using individual ping mode for host discovery")

        async def worker(ip: str):
            async with semaphore:
                await self._process_ip(
                    job, ip, credentials, parser_templates, alive_ips
                )

        try:
            await asyncio.gather(*[worker(ip) for ip in targets])
        except Exception as e:
            logger.error("Scan job %s failed: %s", job.job_id, e)
            job.errors.append(str(e))
        finally:
            job.state = "finished"
            logger.info(
                "Scan job %s completed: %s authenticated, %s unreachable, %s auth failed", job.job_id, job.authenticated, job.unreachable, job.auth_failed
            )

    async def _process_ip(
        self,
        job: ScanJob,
        ip: str,
        credentials: Dict[int, Dict[str, Any]],
        parser_templates: List[Tuple[int, str]],
        alive_ips: Set[str],
    ):
        """Process a single IP address: ping test + credential trials."""
        # Step 1: Liveness check with retries
        alive = False

        if job.ping_mode == "fping":
            # Use pre-computed alive_ips from fping
            alive = ip in alive_ips
            if alive:
                logger.debug("Host %s is alive (from fping results)", ip)
        else:
            # Use individual ping operations (original behavior)
            for attempt in range(RETRY_ATTEMPTS):
                try:
                    if await asyncio.to_thread(self._ping_host, ip):
                        alive = True
                        break
                except Exception as e:
                    logger.debug("Ping attempt %s failed for %s: %s", attempt + 1, ip, e)

        if not alive:
            job.unreachable += 1
            job.scanned += 1
            return

        job.alive += 1

        # If no credentials provided, this is ping-only mode - just record as alive
        if not job.credential_ids or len(job.credential_ids) == 0:
            logger.debug(
                "Host %s is alive (ping-only mode, no authentication attempted)", ip
            )
            job.results.append(
                ScanResult(
                    ip=ip,
                    credential_id=0,  # No credential used
                    device_type="unknown",
                    hostname=ip,
                    platform="ping-responsive",
                    debug_info={"mode": "ping-only"} if job.debug_enabled else None,
                )
            )
            job.authenticated += (
                1  # Count as "authenticated" even though we only pinged
            )
            job.scanned += 1
            return

        logger.debug("Host %s is alive, trying credentials...", ip)

        # Step 2: Try credentials sequentially (stop on first success)
        for cred_id in job.credential_ids:
            cred = credentials.get(cred_id)
            if not cred:
                continue

            username = cred["username"]
            try:
                password = get_decrypted_password(cred_id)
            except Exception as e:
                logger.error(
                    "Failed to decrypt password for credential %s: %s", cred_id, e
                )
                continue

            # Try authentication based on discovery mode
            result = await self._try_authentication(
                job.discovery_mode,
                ip,
                username,
                password,
                parser_templates,
                job.debug_enabled,
            )
            if result:
                job.results.append(
                    ScanResult(
                        ip=ip,
                        credential_id=cred_id,
                        device_type=result["device_type"],
                        hostname=result.get("hostname"),
                        platform=result.get("platform"),
                        debug_info=result.get("debug_info"),
                    )
                )
                job.authenticated += 1
                job.scanned += 1
                logger.info(
                    "Device detected: %s (type: %s, platform: %s)", ip, result['device_type'], result.get('platform', 'unknown')
                )
                return

        # No credentials worked
        job.auth_failed += 1
        job.scanned += 1

    async def _try_authentication(
        self,
        discovery_mode: str,
        ip: str,
        username: str,
        password: str,
        parser_templates: List[Tuple[int, str]],
        debug_enabled: bool = False,
    ) -> Optional[Dict[str, str]]:
        """Try authentication based on discovery mode."""
        if discovery_mode == "napalm":
            # Full device detection using Napalm + Paramiko
            # Try Cisco first (napalm drivers: ios -> nxos_ssh -> iosxr)
            cisco_result = await self._try_cisco_devices(ip, username, password)
            if cisco_result:
                return {
                    "device_type": "cisco",
                    "hostname": cisco_result.get("hostname"),
                    "platform": cisco_result.get("platform"),
                }

            # Try Linux (paramiko + uname)
            linux_result = await self._try_linux_server(ip, username, password)
            if linux_result:
                return {
                    "device_type": "linux",
                    "hostname": linux_result.get("hostname"),
                    "platform": linux_result.get("platform"),
                }

        elif discovery_mode == "ssh-login":
            # Enhanced SSH authentication with basic device detection
            ssh_result = await self._try_basic_ssh_login(
                ip, username, password, parser_templates
            )
            if ssh_result:
                return {
                    "device_type": ssh_result.get("device_type", "unknown"),
                    "hostname": ssh_result.get("hostname"),
                    "platform": ssh_result.get("platform", "ssh-accessible"),
                }

        elif discovery_mode == "netmiko":
            # Netmiko-based device detection and authentication
            netmiko_result = await self._try_netmiko_login(
                ip, username, password, parser_templates, debug_enabled
            )
            if netmiko_result:
                return {
                    "device_type": netmiko_result.get("device_type", "cisco"),
                    "hostname": netmiko_result.get("hostname"),
                    "platform": netmiko_result.get("platform"),
                    "debug_info": netmiko_result.get("debug_info"),
                }

        return None

    async def _try_basic_ssh_login(
        self,
        ip: str,
        username: str,
        password: str,
        parser_templates: List[Tuple[int, str]],
    ) -> Optional[Dict[str, str]]:
        """Basic SSH login test with simple device detection."""
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

            await asyncio.to_thread(
                client.connect,
                hostname=ip,
                username=username,
                password=password,
                timeout=SSH_LOGIN_TIMEOUT,
                banner_timeout=SSH_LOGIN_TIMEOUT,
                auth_timeout=SSH_LOGIN_TIMEOUT,
                look_for_keys=False,
                allow_agent=False,
            )

            # Step 1: Try 'show version' command to detect Cisco device
            try:
                logger.info("Trying 'show version' command on %s", ip)
                stdin, stdout, stderr = client.exec_command("show version", timeout=10)
                stdout_data = stdout.read().decode().strip()
                stderr_data = stderr.read().decode().strip()

                # If we get meaningful output and no errors, it's likely a Cisco device
                if stdout_data and len(stdout_data) > 50 and not stderr_data:
                    logger.info(
                        "'show version' succeeded on %s, detected as Cisco device", ip
                    )
                    # Parse with TextFSM templates if available
                    hostname = None
                    platform = "cisco-unknown"
                    if parser_templates and textfsm is not None:
                        for tid, tmpl in parser_templates:
                            try:
                                fsm = textfsm.TextFSM(io.StringIO(tmpl))
                                rows = fsm.ParseText(stdout_data)
                                # Build dicts from headers
                                for row in rows:
                                    record = {
                                        h.lower(): row[i]
                                        for i, h in enumerate(fsm.header)
                                    }
                                    # Prefer hostname if present and non-empty
                                    hn = (
                                        record.get("hostname")
                                        or record.get("host")
                                        or record.get("device")
                                    )
                                    if hn and len(hn.strip()) > 0:
                                        hostname = hn.strip()
                                    # Grab platform-like fields if exposed
                                    plat = (
                                        record.get("platform")
                                        or record.get("version")
                                        or record.get("os")
                                    )
                                    if plat and len(plat.strip()) > 0:
                                        platform = plat.strip()
                                    if hostname:
                                        break
                                if hostname:
                                    break
                            except Exception as e:
                                logger.debug(
                                    "TextFSM parse failed for template %s on %s: %s", tid, ip, e
                                )
                    # Fallback heuristic if no hostname yet
                    if not hostname:
                        for line in stdout_data.split("\n"):
                            if "uptime is" in line.lower():
                                parts = line.strip().split()
                                if parts:
                                    hostname = parts[0]
                                    break
                            elif (
                                line.strip()
                                and not line.startswith(" ")
                                and "version" not in line.lower()
                            ):
                                hostname = line.strip()
                                break

                    client.close()
                    return {
                        "device_type": "cisco",
                        "hostname": hostname,
                        "platform": platform,
                    }

            except Exception as e:
                logger.info("'show version' failed on %s: %s", ip, e)

            # Step 2: Try Linux commands ('uname -a' and 'hostname')
            try:
                logger.info("Trying Linux commands on %s", ip)

                # Try hostname command
                hostname = None
                try:
                    logger.info("Executing 'hostname' command on %s", ip)
                    stdin, stdout, stderr = client.exec_command("hostname", timeout=5)
                    # Wait for command to complete
                    exit_status = stdout.channel.recv_exit_status()
                    hostname_output = (
                        stdout.read().decode("utf-8", errors="ignore").strip()
                    )
                    stderr_output = (
                        stderr.read().decode("utf-8", errors="ignore").strip()
                    )

                    logger.info(
                        "Hostname command on %s - exit_status: %s, stdout: '%s', stderr: '%s'", ip, exit_status, hostname_output, stderr_output
                    )

                    if hostname_output and exit_status == 0:
                        hostname = hostname_output
                        logger.info("Hostname command succeeded on %s: %s", ip, hostname)
                    else:
                        logger.info(
                            "Hostname command failed on %s - exit_status: %s", ip, exit_status
                        )

                except Exception as e:
                    logger.info("Hostname command exception on %s: %s", ip, e)

                # Try uname -a command
                platform = None
                try:
                    logger.info("Executing 'uname -a' command on %s", ip)
                    stdin, stdout, stderr = client.exec_command("uname -a", timeout=5)
                    # Wait for command to complete
                    exit_status = stdout.channel.recv_exit_status()
                    uname_output = (
                        stdout.read().decode("utf-8", errors="ignore").strip()
                    )
                    stderr_output = (
                        stderr.read().decode("utf-8", errors="ignore").strip()
                    )

                    logger.info(
                        "uname command on %s - exit_status: %s, stdout: '%s', stderr: '%s'", ip, exit_status, uname_output, stderr_output
                    )

                    if uname_output and exit_status == 0:
                        platform = uname_output
                        logger.info("uname -a command succeeded on %s: %s", ip, platform)
                    else:
                        logger.info(
                            "uname -a command failed on %s - exit_status: %s", ip, exit_status
                        )

                except Exception as e:
                    logger.info("uname -a command exception on %s: %s", ip, e)

                # If at least hostname worked, consider it a Linux device
                # (uname might fail on some restricted systems but hostname usually works)
                if hostname:
                    logger.info(
                        "Detected Linux device on %s - hostname: %s, platform: %s", ip, hostname, platform or 'unknown'
                    )
                    client.close()
                    return {
                        "device_type": "linux",
                        "hostname": hostname,
                        "platform": platform or "linux-unknown",
                    }
                else:
                    logger.info(
                        "Linux detection failed on %s - no hostname obtained", ip
                    )

            except Exception as e:
                logger.info("Linux commands failed on %s: %s", ip, e)

            # Step 3: If neither worked, return basic SSH connectivity info
            logger.info("Could not detect device type for %s, marking as unknown", ip)
            client.close()
            return {
                "device_type": "unknown",
                "hostname": None,
                "platform": "ssh-accessible",
            }

        except Exception as e:
            logger.info("Basic SSH login failed for %s: %s", ip, e)
            return None

    def _ping_host(self, ip: str) -> bool:
        """Ping host using system ping command."""
        system = platform.system().lower()

        # Platform-specific ping command
        if system == "darwin":  # macOS
            cmd = ["ping", "-c", "1", "-W", "1500", ip]  # -W in milliseconds on macOS
        else:  # Linux and others
            cmd = ["ping", "-c", "1", "-W", "2", ip]  # -W in seconds on Linux

        try:
            result = subprocess.run(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=PING_TIMEOUT_SECONDS + 1,  # Allow extra time for process
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
                "Created temporary file %s with %s IP addresses", temp_file_path, len(ip_list)
            )

            # Run fping command reading from the temporary file
            cmd = ["fping"]

            logger.info("Running fping command: %s < %s", ' '.join(cmd), temp_file_path)

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
                "fping discovered %s alive hosts out of %s targets", len(alive_ips), len(ip_list)
            )

        except subprocess.TimeoutExpired:
            logger.warning("fping command timed out")
        except FileNotFoundError:
            logger.error(
                "fping command not found. Please install fping or use 'ping' mode instead"
            )
        except Exception as e:
            logger.error("fping command failed: %s", e)
        finally:
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.debug("Cleaned up temporary file %s", temp_file_path)
                except Exception as e:
                    logger.warning(
                        "Failed to clean up temporary file %s: %s", temp_file_path, e
                    )

        return alive_ips

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

    def _is_valid_ip(self, ip_str: str) -> bool:
        """Validate if string is a valid IP address."""
        try:
            ipaddress.ip_address(ip_str)
            return True
        except ValueError:
            return False

    async def _try_cisco_devices(
        self, ip: str, username: str, password: str
    ) -> Optional[Dict[str, str]]:
        """Try Cisco device detection using napalm drivers in priority order."""
        drivers = ["ios", "nxos_ssh", "iosxr"]

        for driver_name in drivers:
            try:
                result = await asyncio.to_thread(
                    self._napalm_connect_get_facts, driver_name, ip, username, password
                )
                if result:
                    return result
            except Exception as e:
                logger.debug("Napalm %s failed for %s: %s", driver_name, ip, e)
                continue

        return None

    def _napalm_connect_get_facts(
        self, driver_name: str, ip: str, username: str, password: str
    ) -> Optional[Dict[str, str]]:
        """Connect to device using napalm driver and get facts."""
        try:
            driver_class = get_network_driver(driver_name)
            device = driver_class(
                hostname=ip,
                username=username,
                password=password,
                optional_args={"timeout": SSH_LOGIN_TIMEOUT},
            )

            device.open()
            try:
                facts = device.get_facts()
                return {"hostname": facts.get("hostname", ip), "platform": driver_name}
            finally:
                device.close()

        except Exception as e:
            logger.debug("Napalm %s connection failed for %s: %s", driver_name, ip, e)
            return None

    async def _try_linux_server(
        self, ip: str, username: str, password: str
    ) -> Optional[Dict[str, str]]:
        """Try Linux server detection using paramiko + uname commands."""
        return await asyncio.to_thread(
            self._paramiko_uname_check, ip, username, password
        )

    def _paramiko_uname_check(
        self, ip: str, username: str, password: str
    ) -> Optional[Dict[str, str]]:
        """Connect via SSH and run uname commands to identify Linux server."""
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        try:
            client.connect(
                ip,
                username=username,
                password=password,
                timeout=SSH_LOGIN_TIMEOUT,
                allow_agent=False,
                look_for_keys=False,
            )

            # Execute uname -n (hostname)
            _, stdout_hostname, _ = client.exec_command("uname -n", timeout=3)
            hostname = stdout_hostname.read().decode().strip() or ip

            # Execute uname -s (kernel name) - should return "Linux"
            _, stdout_kernel, _ = client.exec_command("uname -s", timeout=3)
            kernel = stdout_kernel.read().decode().strip()

            # Verify it's actually a Linux system
            if kernel.lower() == "linux":
                return {"hostname": hostname, "platform": "linux"}
            else:
                logger.debug("Non-Linux system detected on %s: %s", ip, kernel)
                return None

        except Exception as e:
            logger.debug("Paramiko connection failed for %s: %s", ip, e)
            return None
        finally:
            try:
                client.close()
            except Exception:
                pass

    async def _try_netmiko_login(
        self,
        ip: str,
        username: str,
        password: str,
        parser_templates: List[Tuple[int, str]],
        debug_enabled: bool = False,
    ) -> Optional[Dict[str, str]]:
        """Try netmiko-based device detection and authentication."""
        if ConnectHandler is None:
            logger.warning("Netmiko is not installed, falling back to basic SSH")
            return await self._try_basic_ssh_login(
                ip, username, password, parser_templates
            )

        # List of device types to try in priority order
        device_types = [
            "cisco_ios",
            "cisco_nxos",
            "cisco_iosxr",
            "cisco_asa",
            "juniper_junos",
            "arista_eos",
            "hp_procurve",
            "linux",
        ]

        for device_type in device_types:
            try:
                # Configure connection parameters for netmiko
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

                # Establish connection using netmiko
                connection = await asyncio.to_thread(ConnectHandler, **device_config)

                try:
                    # Get device info based on device type
                    hostname = None
                    platform = device_type
                    detected_device_type = "cisco"  # Default

                    if device_type.startswith("linux"):
                        detected_device_type = "linux"
                        # Try to get hostname for Linux systems
                        try:
                            hostname_output = connection.send_command(
                                "hostname", read_timeout=3
                            )
                            hostname = hostname_output.strip() or ip
                        except Exception:
                            hostname = ip
                        platform = "linux"

                    else:
                        # For network devices, try show commands
                        detected_device_type = "cisco"
                        debug_data = {}
                        try:
                            # Get raw show version output first (for debug purposes)
                            show_version_raw = connection.send_command(
                                "show version", read_timeout=10
                            )

                            # Use netmiko's built-in TextFSM parsing with ntc-templates
                            # This automatically uses the appropriate template based on device type
                            show_version_structured = connection.send_command(
                                "show version", use_textfsm=True, read_timeout=10
                            )

                            # Store debug information if debug mode is enabled
                            if debug_enabled:
                                debug_data = {
                                    "device_type_tried": device_type,
                                    "show_version_raw": show_version_raw,
                                    "show_version_structured": show_version_structured,
                                    "parsing_method": "netmiko_ntc_templates",
                                }

                            # If structured parsing worked, extract hostname
                            if (
                                show_version_structured
                                and isinstance(show_version_structured, list)
                                and len(show_version_structured) > 0
                            ):
                                parsed_data = show_version_structured[0]
                                if isinstance(parsed_data, dict):
                                    # Try common hostname fields from ntc-templates
                                    hostname = (
                                        parsed_data.get("hostname")
                                        or parsed_data.get("device_name")
                                        or parsed_data.get("system_name")
                                        or parsed_data.get("name")
                                    )
                                    if debug_data:
                                        debug_data["hostname_extracted"] = hostname
                                        debug_data["parsed_fields"] = (
                                            list(parsed_data.keys())
                                            if isinstance(parsed_data, dict)
                                            else "Not a dict"
                                        )
                                    logger.info(
                                        "Netmiko TextFSM parsing successful for %s, hostname: %s", ip, hostname
                                    )

                            # Fallback: try raw show version if structured parsing failed
                            if not hostname and show_version_raw:
                                # Look for common hostname patterns in show version output
                                lines = show_version_raw.split("\n")
                                for line in lines:
                                    line = line.strip()
                                    if (
                                        "hostname" in line.lower()
                                        or "system name" in line.lower()
                                    ):
                                        parts = line.split()
                                        if len(parts) >= 2:
                                            hostname = parts[-1]
                                            break
                                    # Cisco prompt format
                                    if line.endswith("#") and not line.startswith("#"):
                                        hostname = line.rstrip("#").strip()
                                        break
                                if debug_data and hostname:
                                    debug_data["hostname_extraction_method"] = (
                                        "fallback_raw_parsing"
                                    )

                        except Exception as e:
                            logger.debug(
                                "Show version failed for %s with %s: %s", ip, device_type, e
                            )
                            if debug_data:
                                debug_data["error"] = str(e)

                    # If we got here, connection was successful
                    logger.info(
                        "Netmiko connection successful to %s as %s", ip, device_type
                    )

                    result = {
                        "device_type": detected_device_type,
                        "hostname": hostname or ip,
                        "platform": platform,
                    }

                    # Add debug data if available
                    if debug_data:
                        result["debug_info"] = debug_data

                    return result

                finally:
                    try:
                        connection.disconnect()
                    except Exception:
                        pass

            except Exception as e:
                logger.debug(
                    "Netmiko connection failed for %s with %s: %s", ip, device_type, e
                )
                continue

        # All device types failed
        logger.debug("All netmiko device types failed for %s", ip)
        return None


# Global service instance
scan_service = ScanService()
