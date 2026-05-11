"""Unit tests for CheckMKProblemsService using FakeCheckMKClient.

All tests run offline — no real CheckMK instance required.

The service methods accept request objects; we use SimpleNamespace to build
lightweight request stand-ins.
"""

from __future__ import annotations

import pytest
from types import SimpleNamespace
from unittest.mock import patch

from services.checkmk.problems_service import CheckMKProblemsService
from services.checkmk.exceptions import CheckMKAPIError
from tests.mocks import FakeCheckMKClient


_PATCH_TARGET = (
    "services.checkmk.problems_service.CheckMKClientFactory.build_client_from_settings"
)


def _host_ack_request(hostname: str, comment: str = "ack") -> SimpleNamespace:
    return SimpleNamespace(
        host_name=hostname,
        comment=comment,
        sticky=True,
        persistent=False,
        notify=True,
    )


def _svc_ack_request(
    hostname: str, service: str, comment: str = "ack"
) -> SimpleNamespace:
    return SimpleNamespace(
        host_name=hostname,
        service_description=service,
        comment=comment,
        sticky=True,
        persistent=False,
        notify=True,
    )


def _downtime_request(hostname: str, comment: str = "maint") -> SimpleNamespace:
    return SimpleNamespace(
        host_name=hostname,
        comment=comment,
        start_time="2024-01-01T00:00:00Z",
        end_time="2024-01-01T04:00:00Z",
        downtime_type="host",
    )


def _comment_request(
    hostname: str, comment: str, *, persistent: bool = False
) -> SimpleNamespace:
    return SimpleNamespace(
        host_name=hostname,
        comment=comment,
        persistent=persistent,
    )


def _svc_comment_request(hostname: str, service: str, comment: str) -> SimpleNamespace:
    return SimpleNamespace(
        host_name=hostname,
        service_description=service,
        comment=comment,
        persistent=False,
    )


# ── acknowledge_host_problem ───────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_acknowledge_host_problem_success():
    """Acknowledging a host problem stores the acknowledgement."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKProblemsService()
        await svc.acknowledge_host_problem(
            _host_ack_request("router1", "Acknowledged by ops team")
        )

    ack = fake.get_acknowledgement("router1")
    assert ack is not None
    assert "Acknowledged by ops team" in ack.get("comment", "")


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_acknowledge_host_problem_not_found_raises():
    """Acknowledging a problem on an unknown host raises CheckMKAPIError."""
    fake = FakeCheckMKClient(error_on={("acknowledge_host_problem", "ghost-host"): 404})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKProblemsService()
        with pytest.raises(CheckMKAPIError):
            await svc.acknowledge_host_problem(_host_ack_request("ghost-host"))


# ── acknowledge_service_problem ────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_acknowledge_service_problem_success():
    """Acknowledging a service problem stores the acknowledgement."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKProblemsService()
        await svc.acknowledge_service_problem(
            _svc_ack_request("router1", "CPU load", "High load during backup window")
        )

    key = "router1:CPU load"
    ack = fake.get_acknowledgement(key)
    assert ack is not None
    assert "High load during backup window" in ack.get("comment", "")


# ── delete_acknowledgment ──────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_delete_acknowledgment_removes_it():
    """Deleting an acknowledgement removes it from the store."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})
    fake.acknowledge_host_problem(
        "router1", comment="temp ack", sticky=False, notify=False, persistent=False
    )

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKProblemsService()
        await svc.delete_acknowledgment("router1")

    assert fake.get_acknowledgement("router1") is None


# ── create_host_downtime ───────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_host_downtime_success():
    """Creating a downtime stores it in the fake client."""
    fake = FakeCheckMKClient()
    fake.seed_host("maintenance-host", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKProblemsService()
        await svc.create_host_downtime(
            _downtime_request("maintenance-host", "Scheduled maintenance")
        )

    downtime = fake.get_downtime("maintenance-host")
    assert downtime is not None


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_create_host_downtime_not_found_raises():
    """Creating a downtime for an unknown host raises CheckMKAPIError."""
    fake = FakeCheckMKClient(error_on={("create_host_downtime", "no-such-host"): 404})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKProblemsService()
        with pytest.raises(CheckMKAPIError):
            await svc.create_host_downtime(_downtime_request("no-such-host"))


# ── add_host_comment ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_add_host_comment_success():
    """Adding a comment to a host stores it."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKProblemsService()
        await svc.add_host_comment(_comment_request("router1", "Comment added by test"))

    comments = fake.get_comments("router1")
    assert len(comments) == 1
    assert "Comment added by test" in comments[0].get("comment", "")


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_add_host_comment_not_found_raises():
    """Adding a comment to an unknown host raises CheckMKAPIError."""
    fake = FakeCheckMKClient(error_on={("add_host_comment", "no-host"): 404})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKProblemsService()
        with pytest.raises(CheckMKAPIError):
            await svc.add_host_comment(_comment_request("no-host", "Won't work"))


# ── add_service_comment ────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_add_service_comment_success():
    """Adding a service comment stores it."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKProblemsService()
        await svc.add_service_comment(
            _svc_comment_request("router1", "CPU load", "Elevated during backup")
        )

    key = "router1:CPU load"
    comments = fake.get_comments(key)
    assert len(comments) == 1
    assert "Elevated during backup" in comments[0].get("comment", "")
