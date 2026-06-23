"""Unit tests for services/network/scanning/service.py."""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_PATCH_CREDS = "service_factory.build_credentials_service"
_PATCH_TEMPLATE = "service_factory.build_template_service"


def _make_svc():
    with patch(_PATCH_CREDS, return_value=MagicMock()):
        with patch(_PATCH_TEMPLATE, return_value=MagicMock()):
            from services.network.scanning.service import ScanService

            return ScanService()


def _mk_job(
    job_id="j1",
    ping_mode="fping",
    discovery_mode="netmiko",
    credential_ids=None,
    total_targets=0,
    debug_enabled=False,
    created=None,
):
    from services.network.scanning.models import ScanJob

    return ScanJob(
        job_id=job_id,
        created=created if created is not None else time.time(),
        cidrs=[],
        credential_ids=credential_ids if credential_ids is not None else [],
        discovery_mode=discovery_mode,
        ping_mode=ping_mode,
        total_targets=total_targets,
        debug_enabled=debug_enabled,
    )


@pytest.mark.unit
class TestPurgeExpired:
    def test_purges_old_jobs(self):
        svc = _make_svc()
        from services.network.scanning.models import JOB_TTL_SECONDS

        old_job = _mk_job("old-job", created=time.time() - JOB_TTL_SECONDS - 1)
        svc._jobs["old-job"] = old_job
        svc._purge_expired()
        assert "old-job" not in svc._jobs

    def test_keeps_fresh_jobs(self):
        svc = _make_svc()
        fresh = _mk_job("fresh")
        svc._jobs["fresh"] = fresh
        svc._purge_expired()
        assert "fresh" in svc._jobs


@pytest.mark.unit
class TestNextJobId:
    def test_id_starts_with_scan(self):
        svc = _make_svc()
        assert svc._next_job_id().startswith("scan_")

    def test_id_includes_job_count(self):
        svc = _make_svc()
        first = svc._next_job_id()
        assert "_1" in first

    def test_count_changes_when_jobs_added(self):
        svc = _make_svc()
        id1 = svc._next_job_id()
        svc._jobs["dummy"] = _mk_job("dummy")  # add a job so count increases
        id2 = svc._next_job_id()
        assert id1 != id2


@pytest.mark.unit
class TestGetJob:
    @pytest.mark.asyncio
    async def test_returns_none_for_unknown_id(self):
        svc = _make_svc()
        result = await svc.get_job("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_job_by_id(self):
        svc = _make_svc()
        job = _mk_job("j1")
        svc._jobs["j1"] = job
        result = await svc.get_job("j1")
        assert result is job


@pytest.mark.unit
class TestLoadParserTemplates:
    def test_returns_empty_when_no_ids(self):
        svc = _make_svc()
        assert svc._load_parser_templates([]) == []

    def test_returns_empty_when_textfsm_unavailable(self):
        svc = _make_svc()
        import services.network.scanning.service as mod

        original = mod.textfsm
        mod.textfsm = None
        try:
            assert svc._load_parser_templates([1, 2]) == []
        finally:
            mod.textfsm = original

    def test_skips_non_parser_templates(self):
        svc = _make_svc()
        svc._template_manager.get_template.return_value = {
            "category": "jinja2",
            "template_type": "text",
        }
        import services.network.scanning.service as mod

        if mod.textfsm is None:
            pytest.skip("textfsm not installed")

        assert svc._load_parser_templates([1]) == []

    def test_loads_valid_parser_template(self):
        svc = _make_svc()
        svc._template_manager.get_template.return_value = {
            "category": "parser",
            "template_type": "textfsm",
            "name": "show-ip-int",
        }
        svc._template_manager.get_template_content.return_value = (
            "Value INTF (\\S+)\n\nStart\n  ^\\S -> Record"
        )

        import services.network.scanning.service as mod

        if mod.textfsm is None:
            pytest.skip("textfsm not installed")

        result = svc._load_parser_templates([5])
        assert len(result) == 1
        assert result[0][0] == 5

    def test_skips_template_on_exception(self):
        svc = _make_svc()
        svc._template_manager.get_template.side_effect = RuntimeError("db error")
        import services.network.scanning.service as mod

        if mod.textfsm is None:
            pytest.skip("textfsm not installed")

        assert svc._load_parser_templates([9]) == []


@pytest.mark.unit
class TestDiscoverAliveHosts:
    @pytest.mark.asyncio
    async def test_returns_empty_set_when_not_fping_mode(self):
        svc = _make_svc()
        job = _mk_job(ping_mode="individual")
        result = await svc._discover_alive_hosts(job, ["10.0.0.1"])
        assert result == set()

    @pytest.mark.asyncio
    async def test_returns_alive_ips_from_fping(self):
        svc = _make_svc()
        svc._network_scanner.fping_hosts = AsyncMock(return_value={"10.0.0.1"})
        job = _mk_job(ping_mode="fping")
        result = await svc._discover_alive_hosts(job, ["10.0.0.1", "10.0.0.2"])
        assert result == {"10.0.0.1"}


@pytest.mark.unit
class TestCheckLiveness:
    @pytest.mark.asyncio
    async def test_fping_mode_uses_alive_set(self):
        svc = _make_svc()
        job = _mk_job(ping_mode="fping")
        assert await svc._check_liveness(job, "10.0.0.1", {"10.0.0.1"}) is True
        assert await svc._check_liveness(job, "10.0.0.2", {"10.0.0.1"}) is False

    @pytest.mark.asyncio
    async def test_individual_mode_uses_ping(self):
        svc = _make_svc()
        svc._network_scanner.ping_host = AsyncMock(return_value=True)
        job = _mk_job(ping_mode="individual")
        assert await svc._check_liveness(job, "10.0.0.1", set()) is True

    @pytest.mark.asyncio
    async def test_individual_mode_returns_false_when_all_attempts_fail(self):
        svc = _make_svc()
        svc._network_scanner.ping_host = AsyncMock(return_value=False)
        job = _mk_job(ping_mode="individual")
        assert await svc._check_liveness(job, "10.0.0.99", set()) is False


@pytest.mark.unit
class TestProcessIp:
    @pytest.mark.asyncio
    async def test_unreachable_increments_counter(self):
        svc = _make_svc()
        job = _mk_job()
        await svc._process_ip(job, "10.0.0.5", {}, [], set())
        assert job.unreachable == 1
        assert job.scanned == 1

    @pytest.mark.asyncio
    async def test_alive_no_creds_records_ping_result(self):
        svc = _make_svc()
        job = _mk_job(credential_ids=[])
        await svc._process_ip(job, "10.0.0.1", {}, [], {"10.0.0.1"})
        assert job.authenticated == 1
        assert job.results[0].ip == "10.0.0.1"

    @pytest.mark.asyncio
    async def test_alive_no_creds_with_debug(self):
        svc = _make_svc()
        job = _mk_job(credential_ids=[], debug_enabled=True)
        await svc._process_ip(job, "10.0.0.1", {}, [], {"10.0.0.1"})
        assert job.results[0].debug_info == {"mode": "ping-only"}

    @pytest.mark.asyncio
    async def test_auth_success_records_result(self):
        svc = _make_svc()
        svc._creds.get_decrypted_password.return_value = "secret"
        job = _mk_job(credential_ids=[1])
        credentials = {1: {"id": 1, "username": "admin"}}

        with patch(
            "services.network.scanning.service.authenticate",
            new_callable=AsyncMock,
            return_value={
                "device_type": "cisco_ios",
                "hostname": "router",
                "platform": "cisco_ios",
            },
        ):
            await svc._process_ip(job, "10.0.0.1", credentials, [], {"10.0.0.1"})

        assert job.authenticated == 1
        assert job.results[0].device_type == "cisco_ios"

    @pytest.mark.asyncio
    async def test_auth_failure_increments_auth_failed(self):
        svc = _make_svc()
        svc._creds.get_decrypted_password.return_value = "secret"
        job = _mk_job(credential_ids=[1])
        credentials = {1: {"id": 1, "username": "admin"}}

        with patch(
            "services.network.scanning.service.authenticate",
            new_callable=AsyncMock,
            return_value=None,
        ):
            await svc._process_ip(job, "10.0.0.1", credentials, [], {"10.0.0.1"})

        assert job.auth_failed == 1

    @pytest.mark.asyncio
    async def test_skips_missing_credential(self):
        svc = _make_svc()
        job = _mk_job(credential_ids=[99])
        await svc._process_ip(job, "10.0.0.1", {}, [], {"10.0.0.1"})
        assert job.auth_failed == 1

    @pytest.mark.asyncio
    async def test_decrypt_password_failure_skips_credential(self):
        svc = _make_svc()
        svc._creds.get_decrypted_password.side_effect = RuntimeError("key error")
        job = _mk_job(credential_ids=[1])
        credentials = {1: {"id": 1, "username": "admin"}}

        await svc._process_ip(job, "10.0.0.1", credentials, [], {"10.0.0.1"})
        assert job.auth_failed == 1


@pytest.mark.unit
class TestStartJob:
    def _mock_create_task(coro):
        coro.close()

    @pytest.mark.asyncio
    async def test_skips_oversized_networks(self):
        svc = _make_svc()
        svc._creds.list_credentials.return_value = []

        with patch(
            "services.network.scanning.service.asyncio.create_task",
            side_effect=TestStartJob._mock_create_task,
        ):
            job = await svc.start_job(
                cidrs=["10.0.0.0/16"],  # /16 < /22 → skipped
                credential_ids=[],
            )

        assert job.total_targets == 0

    @pytest.mark.asyncio
    async def test_expands_valid_cidr(self):
        svc = _make_svc()
        svc._creds.list_credentials.return_value = []

        with patch(
            "services.network.scanning.service.asyncio.create_task",
            side_effect=TestStartJob._mock_create_task,
        ):
            job = await svc.start_job(
                cidrs=["10.0.0.0/30"],
                credential_ids=[],
            )

        assert job.total_targets == 2

    @pytest.mark.asyncio
    async def test_deduplicates_ips_across_cidrs(self):
        svc = _make_svc()
        svc._creds.list_credentials.return_value = []

        with patch(
            "services.network.scanning.service.asyncio.create_task",
            side_effect=TestStartJob._mock_create_task,
        ):
            job = await svc.start_job(
                cidrs=["10.0.0.0/30", "10.0.0.0/30"],
                credential_ids=[],
            )

        assert job.total_targets == 2

    @pytest.mark.asyncio
    async def test_invalid_cidr_logged_and_skipped(self):
        svc = _make_svc()
        svc._creds.list_credentials.return_value = []

        with patch(
            "services.network.scanning.service.asyncio.create_task",
            side_effect=TestStartJob._mock_create_task,
        ):
            job = await svc.start_job(
                cidrs=["not-a-cidr"],
                credential_ids=[],
            )

        assert job.total_targets == 0
