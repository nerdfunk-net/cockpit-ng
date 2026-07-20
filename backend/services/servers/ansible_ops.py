"""
ServerAnsibleOperationsService: the single "agent call -> parse -> upsert
server" implementation for get_server_facts and get_open_ports, shared by the
bulk prefix-scan job executors and the single-server ad-hoc refresh endpoints.

See doc/refactoring/FACTS-PORTS-REFACTORING.md — Phase 2.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional, Tuple

from models.servers import AnsibleCredentials, CreateServerRequest, UpdateServerRequest
from services.cockpit_agent.ansible_auth import ResolvedAnsibleAuth
from services.servers.ansible_facts_parser import parse_ansible_facts
from services.servers.open_ports_parser import parse_open_ports

if TYPE_CHECKING:
    from services.cockpit_agent.cockpit_agent_service import CockpitAgentService
    from services.servers.servers_service import ServersService

# (current, total, status_message)
ProgressCallback = Callable[[int, int, str], None]


@dataclass(frozen=True)
class PrefixScanConfig:
    agent_id: str
    prefixes: List[str]
    auth: ResolvedAnsibleAuth
    sent_by: str
    timeout: int = 90


@dataclass(frozen=True)
class HostScanResult:
    hostname: str
    operation: str  # "create" | "update" | "get_facts" | "get_open_ports"
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None
    server_id: Optional[int] = None


def _resolve_send_ansible_user(auth: ResolvedAnsibleAuth) -> Optional[str]:
    """Forward ansible_user to the agent call only for ssh_key mode (no
    credential_id) — for credential-based modes CockpitAgentService re-resolves
    the username from the credential itself.
    """
    return auth.ansible_user if auth.credential_id is None else None


def _host_result_to_dict(result: HostScanResult) -> Dict[str, Any]:
    entry: Dict[str, Any] = {
        "hostname": result.hostname,
        "operation": result.operation,
        "success": result.success,
    }
    if result.success:
        entry["message"] = result.message
    else:
        entry["error"] = result.error
    return entry


def _empty_scan_result(*, message: str, scanned_ip_count: int) -> Dict[str, Any]:
    return {
        "success": True,
        "message": message,
        "total": 0,
        "reachable_count": 0,
        "scanned_ip_count": scanned_ip_count,
        "success_count": 0,
        "failed_count": 0,
        "results": [],
    }


class ServerAnsibleOperationsService:
    def __init__(
        self,
        servers_service: ServersService,
        agent_service: CockpitAgentService,
    ) -> None:
        self._servers = servers_service
        self._agent = agent_service

    # ------------------------------------------------------------------
    # Single host (ad-hoc refresh path)
    # ------------------------------------------------------------------

    def refresh_facts_for_server(
        self, server_id: int, sent_by: str, *, timeout: int = 60
    ) -> HostScanResult:
        server = self._servers.get_by_id(server_id)
        if server is None:
            return HostScanResult(
                hostname="",
                operation="get_facts",
                success=False,
                error=f"Server {server_id} not found",
            )

        auth, agent_id, target, error = self._resolve_stored_auth(server)
        if error:
            return HostScanResult(
                hostname=server.hostname,
                operation="get_facts",
                success=False,
                error=error,
            )

        return self._gather_facts_and_upsert(
            target, agent_id, auth, sent_by, timeout, server_id=server_id
        )

    def refresh_open_ports_for_server(
        self, server_id: int, sent_by: str, *, timeout: int = 60
    ) -> HostScanResult:
        server = self._servers.get_by_id(server_id)
        if server is None:
            return HostScanResult(
                hostname="",
                operation="get_open_ports",
                success=False,
                error=f"Server {server_id} not found",
            )

        auth, agent_id, target, error = self._resolve_stored_auth(server)
        if error:
            return HostScanResult(
                hostname=server.hostname,
                operation="get_open_ports",
                success=False,
                error=error,
            )

        return self._scan_ports_and_upsert(
            target, agent_id, auth, sent_by, timeout, server_id=server_id
        )

    def _resolve_stored_auth(
        self, server: Any
    ) -> Tuple[
        Optional[ResolvedAnsibleAuth], Optional[str], Optional[str], Optional[str]
    ]:
        """Read the server's stored AnsibleCredentials JSON and validate it's
        usable for a refresh. Returns (auth, agent_id, target, error) — error is
        non-None (and the rest None) when the stored credentials can't be used.
        """
        creds: Dict[str, Any] = server.ansible_credentials or {}
        agent_id = creds.get("agent_id")
        target = creds.get("target")
        if not agent_id or not target:
            return (
                None,
                None,
                None,
                "No stored Ansible connection settings for this server. "
                "Add the server again or restore credentials.",
            )

        use_sshkey = bool(creds.get("use_sshkey"))
        credential_id = creds.get("credential_id")
        if not use_sshkey and not credential_id:
            return (
                None,
                None,
                None,
                "Stored credentials are incomplete (missing credential ID).",
            )

        if not self._agent.check_agent_online(agent_id):
            return (
                None,
                None,
                None,
                f"Agent '{agent_id}' is offline or not responding",
            )

        auth = ResolvedAnsibleAuth(
            use_sshkey=use_sshkey,
            ansible_user=creds.get("ansible_user"),
            credential_id=credential_id,
        )
        return auth, agent_id, target, None

    # ------------------------------------------------------------------
    # Bulk prefix scan (job path)
    # ------------------------------------------------------------------

    def run_facts_prefix_scan(
        self, config: PrefixScanConfig, progress: Optional[ProgressCallback] = None
    ) -> Dict[str, Any]:
        return self._run_prefix_scan(
            config,
            progress,
            gather_fn=self._gather_facts_and_upsert,
            status_verb="Gathering facts from",
        )

    def run_open_ports_prefix_scan(
        self, config: PrefixScanConfig, progress: Optional[ProgressCallback] = None
    ) -> Dict[str, Any]:
        return self._run_prefix_scan(
            config,
            progress,
            gather_fn=self._scan_ports_and_upsert,
            status_verb="Scanning open ports on",
        )

    def _expand_and_ping(self, prefixes: List[str]) -> Tuple[List[str], List[str]]:
        """Expand CIDR prefixes to IPs and ping them. Returns (all_ips, alive_ips).

        Raises ValueError on invalid CIDR (propagated from _expand_cidr_to_ips).
        """
        from tasks.ping_network_task import _expand_cidr_to_ips, _fping_networks

        all_ips: List[str] = []
        for cidr in prefixes:
            all_ips.extend(_expand_cidr_to_ips(cidr))
        all_ips = sorted(set(all_ips))
        if not all_ips:
            return [], []
        alive_ips = sorted(_fping_networks(all_ips))
        return all_ips, alive_ips

    def _run_prefix_scan(
        self,
        config: PrefixScanConfig,
        progress: Optional[ProgressCallback],
        *,
        gather_fn,
        status_verb: str,
    ) -> Dict[str, Any]:
        try:
            all_ips, alive_ips = self._expand_and_ping(config.prefixes)
        except ValueError as exc:
            return {"success": False, "error": str(exc)}

        if not all_ips:
            return _empty_scan_result(message="No IPs to scan", scanned_ip_count=0)

        if progress:
            progress(5, 100, f"Pinging {len(all_ips)} IPs…")

        if not alive_ips:
            return _empty_scan_result(
                message="No hosts reachable", scanned_ip_count=len(all_ips)
            )

        if not self._agent.check_agent_online(config.agent_id):
            return {
                "success": False,
                "error": f"Agent '{config.agent_id}' is offline or not responding",
            }

        results: List[Dict[str, Any]] = []
        success_count = 0
        failed_count = 0
        total = len(alive_ips)

        for idx, ip in enumerate(alive_ips):
            if progress:
                progress(
                    10 + int(80 * idx / total),
                    100,
                    f"{status_verb} {ip} ({idx + 1}/{total})",
                )
            result = gather_fn(
                ip, config.agent_id, config.auth, config.sent_by, config.timeout
            )
            if result.success:
                success_count += 1
            else:
                failed_count += 1
            results.append(_host_result_to_dict(result))

        if progress:
            progress(100, 100, "Done")

        return {
            "success": True,
            "total": len(alive_ips),
            "reachable_count": len(alive_ips),
            "scanned_ip_count": len(all_ips),
            "success_count": success_count,
            "failed_count": failed_count,
            "results": results,
        }

    # ------------------------------------------------------------------
    # Internal: per-host gather + upsert
    # ------------------------------------------------------------------

    def _gather_facts_and_upsert(
        self,
        ip: str,
        agent_id: str,
        auth: ResolvedAnsibleAuth,
        sent_by: str,
        timeout: int,
        *,
        server_id: Optional[int] = None,
    ) -> HostScanResult:
        try:
            raw = self._agent.send_ansible_get_facts(
                agent_id=agent_id,
                ip_address=ip,
                use_sshkey=auth.use_sshkey,
                sent_by=sent_by,
                ansible_user=_resolve_send_ansible_user(auth),
                credential_id=auth.credential_id,
                timeout=timeout,
            )
            if raw.get("status") != "success":
                return HostScanResult(
                    hostname=ip,
                    operation="get_facts",
                    success=False,
                    error=raw.get("error") or "Agent returned an error",
                )

            parsed = parse_ansible_facts(raw.get("output"))
            hostname = parsed.hostname or ip

            # The Server model only supports storing a credential_id alongside
            # username/password auth (use_sshkey=False) — for both SSH-key modes
            # (with or without passphrase) no credential_id is persisted, matching
            # AnsibleCredentials' validation contract (see models/servers.py).
            ansible_creds = AnsibleCredentials(
                target=ip,
                agent_id=agent_id,
                use_sshkey=auth.use_sshkey,
                ansible_user=auth.ansible_user,
                credential_id=None if auth.use_sshkey else auth.credential_id,
            )

            facts_fields: Dict[str, Any] = dict(
                hostname=hostname,
                primary_ipv4=parsed.primary_ipv4 or ip,
                primary_interface=parsed.primary_interface or None,
                os_family=parsed.os_family or None,
                processor_count=parsed.processor_count,
                memtotal_mb=parsed.memtotal_mb,
                disk_count=parsed.disk_count,
                disk_total_gb=parsed.disk_total_gb,
                disk_usage_pct=parsed.disk_usage_pct,
                architecture=parsed.architecture or None,
                distribution=parsed.distribution or None,
                distribution_release=parsed.distribution_release or None,
                distribution_version=parsed.distribution_version or None,
                is_virtual=parsed.is_virtual,
                ansible_facts=parsed.ansible_facts,
                ansible_credentials=ansible_creds,
            )

            if server_id is not None:
                self._servers.update(server_id, UpdateServerRequest(**facts_fields))
                return HostScanResult(
                    hostname=hostname,
                    operation="update",
                    success=True,
                    message=f"Facts stored (server id {server_id})",
                    server_id=server_id,
                )

            existing = self._servers.get_by_hostname(hostname)
            if existing:
                self._servers.update(existing.id, UpdateServerRequest(**facts_fields))
                return HostScanResult(
                    hostname=hostname,
                    operation="update",
                    success=True,
                    message=f"Facts stored (server id {existing.id})",
                    server_id=existing.id,
                )

            server = self._servers.create(CreateServerRequest(**facts_fields))
            return HostScanResult(
                hostname=hostname,
                operation="create",
                success=True,
                message=f"Facts stored (server id {server.id})",
                server_id=server.id,
            )
        except Exception as exc:
            return HostScanResult(
                hostname=ip, operation="get_facts", success=False, error=str(exc)
            )

    def _scan_ports_and_upsert(
        self,
        ip: str,
        agent_id: str,
        auth: ResolvedAnsibleAuth,
        sent_by: str,
        timeout: int,
        *,
        server_id: Optional[int] = None,
    ) -> HostScanResult:
        try:
            raw = self._agent.send_open_ports_scan(
                agent_id=agent_id,
                ip_address=ip,
                use_sshkey=auth.use_sshkey,
                sent_by=sent_by,
                ansible_user=_resolve_send_ansible_user(auth),
                credential_id=auth.credential_id,
                timeout=timeout,
            )
            if raw.get("status") != "success":
                return HostScanResult(
                    hostname=ip,
                    operation="get_open_ports",
                    success=False,
                    error=raw.get("error") or "Agent returned an error",
                )

            parsed = parse_open_ports(raw.get("output"))
            hostname = parsed.hostname or ip

            ansible_creds = AnsibleCredentials(
                target=ip,
                agent_id=agent_id,
                use_sshkey=auth.use_sshkey,
                ansible_user=auth.ansible_user,
                credential_id=None if auth.use_sshkey else auth.credential_id,
            )

            ports_fields: Dict[str, Any] = dict(
                hostname=hostname,
                primary_ipv4=parsed.ip_address or ip,
                open_ports={
                    "tcp_ports": parsed.tcp_ports,
                    "udp_ports": parsed.udp_ports,
                },
                ansible_credentials=ansible_creds,
            )

            if server_id is not None:
                self._servers.update(server_id, UpdateServerRequest(**ports_fields))
                return HostScanResult(
                    hostname=hostname,
                    operation="update",
                    success=True,
                    message=f"Open ports stored (server id {server_id})",
                    server_id=server_id,
                )

            existing = self._servers.get_by_hostname(hostname)
            if existing:
                self._servers.update(existing.id, UpdateServerRequest(**ports_fields))
                return HostScanResult(
                    hostname=hostname,
                    operation="update",
                    success=True,
                    message=f"Open ports stored (server id {existing.id})",
                    server_id=existing.id,
                )

            server = self._servers.create(CreateServerRequest(**ports_fields))
            return HostScanResult(
                hostname=hostname,
                operation="create",
                success=True,
                message=f"Open ports stored (server id {server.id})",
                server_id=server.id,
            )
        except Exception as exc:
            return HostScanResult(
                hostname=ip, operation="get_open_ports", success=False, error=str(exc)
            )
