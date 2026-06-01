from __future__ import annotations

import asyncio
import io
import logging
from typing import Dict, List, Optional, Tuple

import paramiko  # type: ignore

from ..models import SSH_LOGIN_TIMEOUT

try:
    import textfsm  # type: ignore
except Exception:
    textfsm = None

logger = logging.getLogger(__name__)


class SshAuthenticator:
    """Authenticates via basic SSH, detecting Cisco or Linux systems."""

    async def authenticate(
        self,
        ip: str,
        username: str,
        password: str,
        parser_templates: Optional[List[Tuple[int, str]]] = None,
    ) -> Optional[Dict[str, str]]:
        """Basic SSH login with Cisco/Linux detection and optional TextFSM parsing."""
        return await asyncio.to_thread(
            self._login_and_detect, ip, username, password, parser_templates or []
        )

    async def authenticate_linux(
        self, ip: str, username: str, password: str
    ) -> Optional[Dict[str, str]]:
        """Paramiko-based Linux server detection via uname commands."""
        return await asyncio.to_thread(self._uname_check, ip, username, password)

    # ------------------------------------------------------------------
    # Sync internals (run in threads)
    # ------------------------------------------------------------------

    def _login_and_detect(
        self,
        ip: str,
        username: str,
        password: str,
        parser_templates: List[Tuple[int, str]],
    ) -> Optional[Dict[str, str]]:
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(
                hostname=ip,
                username=username,
                password=password,
                timeout=SSH_LOGIN_TIMEOUT,
                banner_timeout=SSH_LOGIN_TIMEOUT,
                auth_timeout=SSH_LOGIN_TIMEOUT,
                look_for_keys=False,
                allow_agent=False,
            )

            result = self._try_cisco(client, ip, parser_templates)
            if result:
                client.close()
                return result

            result = self._try_linux(client, ip)
            if result:
                client.close()
                return result

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

    def _try_cisco(
        self,
        client: paramiko.SSHClient,
        ip: str,
        parser_templates: List[Tuple[int, str]],
    ) -> Optional[Dict[str, str]]:
        try:
            logger.info("Trying 'show version' command on %s", ip)
            _, stdout, stderr = client.exec_command("show version", timeout=10)
            stdout_data = stdout.read().decode().strip()
            stderr_data = stderr.read().decode().strip()

            if not stdout_data or len(stdout_data) <= 50 or stderr_data:
                return None

            logger.info("'show version' succeeded on %s, detected as Cisco device", ip)
            hostname = self._parse_cisco_hostname(stdout_data, parser_templates, ip)
            platform = self._parse_cisco_platform(stdout_data, parser_templates)
            return {"device_type": "cisco", "hostname": hostname, "platform": platform}

        except Exception as e:
            logger.info("'show version' failed on %s: %s", ip, e)
            return None

    def _try_linux(
        self, client: paramiko.SSHClient, ip: str
    ) -> Optional[Dict[str, str]]:
        try:
            logger.info("Trying Linux commands on %s", ip)
            hostname = self._exec_and_read(client, "hostname", ip)
            platform = self._exec_and_read(client, "uname -a", ip)

            if hostname:
                logger.info(
                    "Detected Linux device on %s - hostname: %s, platform: %s",
                    ip,
                    hostname,
                    platform or "unknown",
                )
                return {
                    "device_type": "linux",
                    "hostname": hostname,
                    "platform": platform or "linux-unknown",
                }

            logger.info("Linux detection failed on %s - no hostname obtained", ip)
            return None

        except Exception as e:
            logger.info("Linux commands failed on %s: %s", ip, e)
            return None

    def _exec_and_read(
        self, client: paramiko.SSHClient, cmd: str, ip: str
    ) -> Optional[str]:
        try:
            logger.info("Executing '%s' command on %s", cmd, ip)
            _, stdout, stderr = client.exec_command(cmd, timeout=5)
            exit_status = stdout.channel.recv_exit_status()
            output = stdout.read().decode("utf-8", errors="ignore").strip()
            stderr_out = stderr.read().decode("utf-8", errors="ignore").strip()
            logger.info(
                "%s on %s - exit_status: %s, stdout: '%s', stderr: '%s'",
                cmd,
                ip,
                exit_status,
                output,
                stderr_out,
            )
            return output if output and exit_status == 0 else None
        except Exception as e:
            logger.info("%s command exception on %s: %s", cmd, ip, e)
            return None

    def _parse_cisco_hostname(
        self,
        output: str,
        parser_templates: List[Tuple[int, str]],
        ip: str,
    ) -> Optional[str]:
        if parser_templates and textfsm is not None:
            for tid, tmpl in parser_templates:
                try:
                    fsm = textfsm.TextFSM(io.StringIO(tmpl))
                    for row in fsm.ParseText(output):
                        record = {h.lower(): row[i] for i, h in enumerate(fsm.header)}
                        hn = (
                            record.get("hostname")
                            or record.get("host")
                            or record.get("device")
                        )
                        if hn and hn.strip():
                            return hn.strip()
                except Exception as e:
                    logger.debug(
                        "TextFSM parse failed for template %s on %s: %s", tid, ip, e
                    )

        for line in output.split("\n"):
            if "uptime is" in line.lower():
                parts = line.strip().split()
                if parts:
                    return parts[0]
            elif (
                line.strip()
                and not line.startswith(" ")
                and "version" not in line.lower()
            ):
                return line.strip()
        return None

    def _parse_cisco_platform(
        self,
        output: str,
        parser_templates: List[Tuple[int, str]],
    ) -> str:
        if parser_templates and textfsm is not None:
            for _, tmpl in parser_templates:
                try:
                    fsm = textfsm.TextFSM(io.StringIO(tmpl))
                    for row in fsm.ParseText(output):
                        record = {h.lower(): row[i] for i, h in enumerate(fsm.header)}
                        plat = (
                            record.get("platform")
                            or record.get("version")
                            or record.get("os")
                        )
                        if plat and plat.strip():
                            return plat.strip()
                except Exception:
                    pass
        return "cisco-unknown"

    def _uname_check(
        self, ip: str, username: str, password: str
    ) -> Optional[Dict[str, str]]:
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
            _, stdout_hostname, _ = client.exec_command("uname -n", timeout=3)
            hostname = stdout_hostname.read().decode().strip() or ip

            _, stdout_kernel, _ = client.exec_command("uname -s", timeout=3)
            kernel = stdout_kernel.read().decode().strip()

            if kernel.lower() == "linux":
                return {"hostname": hostname, "platform": "linux"}

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
