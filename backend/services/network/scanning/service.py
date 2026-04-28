from __future__ import annotations

import asyncio
import ipaddress
import logging
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from credentials_manager import get_decrypted_password, list_credentials  # type: ignore
from template_manager import template_manager  # type: ignore

try:
    import textfsm  # type: ignore
except Exception:
    textfsm = None

from .authenticators import authenticate
from .models import (
    JOB_TTL_SECONDS,
    MAX_CONCURRENCY,
    RETRY_ATTEMPTS,
    ScanJob,
    ScanResult,
)
from .network_scan import NetworkScanService

logger = logging.getLogger(__name__)


class ScanService:
    def __init__(self) -> None:
        self._jobs: Dict[str, ScanJob] = {}
        self._network_scanner = NetworkScanService()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def start_job(
        self,
        cidrs: List[str],
        credential_ids: List[int],
        discovery_mode: str = "netmiko",
        ping_mode: str = "fping",
        parser_template_ids: Optional[List[int]] = None,
        debug_enabled: bool = False,
    ) -> ScanJob:
        """Expand CIDRs, create a job record, and launch the background scan."""
        targets: List[str] = []
        seen: Set[str] = set()

        for cidr in cidrs:
            try:
                network = ipaddress.ip_network(cidr, strict=False)
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
        asyncio.create_task(self._run_scan(job, targets, parser_template_ids or []))
        return job

    async def get_job(self, job_id: str) -> Optional[ScanJob]:
        """Return job status, purging expired jobs first."""
        self._purge_expired()
        return self._jobs.get(job_id)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _purge_expired(self) -> None:
        now = time.time()
        expired = [
            jid for jid, j in self._jobs.items() if now - j.created > JOB_TTL_SECONDS
        ]
        for jid in expired:
            self._jobs.pop(jid, None)
            logger.info("Purged expired scan job: %s", jid)

    def _next_job_id(self) -> str:
        return f"scan_{int(time.time() * 1000)}_{len(self._jobs) + 1}"

    # ------------------------------------------------------------------
    # Scan execution
    # ------------------------------------------------------------------

    async def _run_scan(
        self, job: ScanJob, targets: List[str], parser_template_ids: List[int]
    ) -> None:
        semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

        try:
            credentials = {c["id"]: c for c in list_credentials()}  # type: ignore
        except Exception as e:
            logger.error("Failed to load credentials: %s", e)
            job.state = "finished"
            return

        parser_templates = self._load_parser_templates(parser_template_ids)
        alive_ips = await self._discover_alive_hosts(job, targets)

        async def worker(ip: str) -> None:
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
                "Scan job %s completed: %s authenticated, %s unreachable, %s auth failed",
                job.job_id,
                job.authenticated,
                job.unreachable,
                job.auth_failed,
            )

    def _load_parser_templates(
        self, parser_template_ids: List[int]
    ) -> List[Tuple[int, str]]:
        templates: List[Tuple[int, str]] = []
        logger.info("Processing parser_template_ids: %s", parser_template_ids)

        if not parser_template_ids:
            logger.info("No parser templates specified")
            return templates

        if textfsm is None:
            logger.warning("TextFSM not available, parser templates will be ignored")
            return templates

        for tid in parser_template_ids:
            try:
                t = template_manager.get_template(tid)
                if (
                    t
                    and t.get("category") == "parser"
                    and t.get("template_type")
                    in (
                        "textfsm",
                        "text",
                    )
                ):
                    content = template_manager.get_template_content(tid)
                    if content:
                        templates.append((tid, content))
                        logger.info(
                            "Loaded parser template %s: %s",
                            tid,
                            t.get("name", "Unknown"),
                        )
            except Exception as e:
                logger.warning("Failed to preload parser template %s: %s", tid, e)

        logger.info("Total parser templates loaded: %s", len(templates))
        return templates

    async def _discover_alive_hosts(self, job: ScanJob, targets: List[str]) -> Set[str]:
        if job.ping_mode != "fping":
            logger.info("Using individual ping mode for host discovery")
            return set()

        alive_ips = await self._network_scanner.fping_hosts(targets)
        logger.info(
            "fping found %s alive hosts out of %s targets",
            len(alive_ips),
            len(targets),
        )
        return alive_ips

    async def _process_ip(
        self,
        job: ScanJob,
        ip: str,
        credentials: Dict[int, Dict[str, Any]],
        parser_templates: List[Tuple[int, str]],
        alive_ips: Set[str],
    ) -> None:
        alive = await self._check_liveness(job, ip, alive_ips)

        if not alive:
            job.unreachable += 1
            job.scanned += 1
            return

        job.alive += 1

        if not job.credential_ids:
            job.results.append(
                ScanResult(
                    ip=ip,
                    credential_id=0,
                    device_type="unknown",
                    hostname=ip,
                    platform="ping-responsive",
                    debug_info={"mode": "ping-only"} if job.debug_enabled else None,
                )
            )
            job.authenticated += 1
            job.scanned += 1
            return

        logger.debug("Host %s is alive, trying credentials...", ip)

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

            result = await authenticate(
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
                    "Device detected: %s (type: %s, platform: %s)",
                    ip,
                    result["device_type"],
                    result.get("platform", "unknown"),
                )
                return

        job.auth_failed += 1
        job.scanned += 1

    async def _check_liveness(self, job: ScanJob, ip: str, alive_ips: Set[str]) -> bool:
        if job.ping_mode == "fping":
            alive = ip in alive_ips
            if alive:
                logger.debug("Host %s is alive (from fping results)", ip)
            return alive

        for attempt in range(RETRY_ATTEMPTS):
            try:
                if await self._network_scanner.ping_host(ip):
                    return True
            except Exception as e:
                logger.debug("Ping attempt %s failed for %s: %s", attempt + 1, ip, e)
        return False
