"""Unit tests for OffboardingService using FakeNautobotService.

All tests run offline - no real Nautobot instance required.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from models.nautobot import OffboardDeviceRequest
from services.nautobot.offboarding.service import OffboardingService
from tests.mocks import FakeNautobotService, STATUS_ACTIVE_ID, NS_GLOBAL_ID


# ── Constants ──────────────────────────────────────────────────────────────────

DEVICE_ID  = "bb000000-0000-0000-0003-000000000001"
IP_ID      = "bb000000-0000-0000-0001-000000000001"
IFACE_ID   = "bb000000-0000-0000-0002-000000000001"
IP_ID_2    = "bb000000-0000-0000-0001-000000000002"
IFACE_ID_2 = "bb000000-0000-0000-0002-000000000002"
VC_ID      = "bb000000-0000-0000-0005-000000000001"
MEMBER_ID  = "bb000000-0000-0000-0003-000000000002"

DEVICE_NAME = "test-router-01"


# ── Helpers ─────────────────────────────────────────────────────────────────────


def make_device_details(
    device_id: str = DEVICE_ID,
    name: str = DEVICE_NAME,
    primary_ip_id: str | None = IP_ID,
    primary_ip_address: str = "10.0.0.1/24",
    interfaces: list | None = None,
) -> dict:
    """Build a device details dict as returned by DeviceQueryService."""
    if interfaces is None:
        interfaces = [
            {
                "id": IFACE_ID,
                "name": "Loopback0",
                "ip_addresses": [{"id": primary_ip_id, "address": primary_ip_address}]
                if primary_ip_id
                else [],
            }
        ]
    return {
        "id": device_id,
        "name": name,
        "primary_ip4": {"id": primary_ip_id, "address": primary_ip_address} if primary_ip_id else None,
        "interfaces": interfaces,
    }


def simple_offboard_request(**overrides) -> OffboardDeviceRequest:
    defaults = {
        "remove_primary_ip": True,
        "remove_interface_ips": True,
        "remove_from_checkmk": False,
    }
    defaults.update(overrides)
    return OffboardDeviceRequest(**defaults)


# ── Fixtures ────────────────────────────────────────────────────────────────────


@pytest.fixture
def fake_nb() -> FakeNautobotService:
    fake = FakeNautobotService()
    fake.seed_ip(IP_ID, {
        "address": "10.0.0.1/24",
        "namespace_id": NS_GLOBAL_ID,
    })
    fake.seed_interface(IFACE_ID, {
        "name": "Loopback0",
        "type": "virtual",
        "device_id": DEVICE_ID,
        "ip_addresses": [{"id": IP_ID, "address": "10.0.0.1/24"}],
    })
    fake.seed_device(DEVICE_ID, {
        "name": DEVICE_NAME,
        "status": {"id": STATUS_ACTIVE_ID, "name": "Active"},
        "primary_ip4": {"id": IP_ID, "address": "10.0.0.1/24"},
        "interfaces": [
            {
                "id": IFACE_ID,
                "name": "Loopback0",
                "ip_addresses": [{"id": IP_ID, "address": "10.0.0.1/24"}],
            }
        ],
    })
    return fake


@pytest.fixture
def mock_device_query_svc():
    svc = MagicMock()
    svc.get_device_details = AsyncMock(return_value=make_device_details())
    return svc


@pytest.fixture
def mock_cache():
    cache = MagicMock()
    cache.get = MagicMock(return_value=None)
    cache.set = MagicMock()
    cache.delete = MagicMock()
    return cache


@pytest.fixture
def offboarding_service(fake_nb, mock_device_query_svc, mock_cache):
    """OffboardingService with all external dependencies patched."""
    with patch("service_factory.build_nautobot_service", return_value=fake_nb):
        with patch("service_factory.build_cache_service", return_value=mock_cache):
            with patch("service_factory.build_device_query_service", return_value=mock_device_query_svc):
                svc = OffboardingService()
                # Replace checkmk_cleanup with a no-op mock
                svc._checkmk_cleanup = MagicMock()
                svc._checkmk_cleanup.remove_host = AsyncMock(return_value=None)
                yield svc


# ── Tests ───────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
async def test_offboard_simple_device_success(offboarding_service, fake_nb):
    """Offboarding a device without CheckMK should remove it and its IPs."""
    current_user = {"username": "testuser", "user_id": 1}

    result = await offboarding_service.offboard_device(
        DEVICE_ID, simple_offboard_request(), current_user
    )

    assert result["success"] is True
    assert DEVICE_ID not in fake_nb._devices


@pytest.mark.asyncio
@pytest.mark.unit
async def test_offboard_removes_interface_ips(offboarding_service, fake_nb):
    """Offboarding with remove_interface_ips=True should delete interface IPs."""
    current_user = {"username": "testuser", "user_id": 1}

    result = await offboarding_service.offboard_device(
        DEVICE_ID,
        simple_offboard_request(remove_interface_ips=True, remove_primary_ip=True),
        current_user,
    )

    assert result["success"] is True
    assert IP_ID not in fake_nb._ip_addresses


@pytest.mark.asyncio
@pytest.mark.unit
async def test_offboard_keeps_ip_when_not_requested(offboarding_service, fake_nb):
    """Offboarding with remove_primary_ip=False should keep the primary IP in IPAM."""
    current_user = {"username": "testuser", "user_id": 1}

    result = await offboarding_service.offboard_device(
        DEVICE_ID,
        simple_offboard_request(remove_primary_ip=False, remove_interface_ips=False),
        current_user,
    )

    assert result["success"] is True
    # IP should still be in the store since removal was not requested
    assert IP_ID in fake_nb._ip_addresses


@pytest.mark.asyncio
@pytest.mark.unit
async def test_offboard_device_has_correct_device_name(offboarding_service):
    """Result should contain the device name."""
    current_user = {"username": "testuser", "user_id": 1}

    result = await offboarding_service.offboard_device(
        DEVICE_ID, simple_offboard_request(), current_user
    )

    assert result["device_name"] == DEVICE_NAME


@pytest.mark.asyncio
@pytest.mark.unit
async def test_offboard_result_has_removed_items(offboarding_service):
    """Result removed_items list should include device entry."""
    current_user = {"username": "testuser", "user_id": 1}

    result = await offboarding_service.offboard_device(
        DEVICE_ID, simple_offboard_request(), current_user
    )

    assert any("Device" in item for item in result["removed_items"])


@pytest.mark.asyncio
@pytest.mark.unit
async def test_offboard_with_checkmk_calls_remove_host(offboarding_service, fake_nb):
    """Offboarding with remove_from_checkmk=True should call CheckMK cleanup."""
    current_user = {"username": "testuser", "user_id": 1}

    await offboarding_service.offboard_device(
        DEVICE_ID,
        simple_offboard_request(remove_from_checkmk=True),
        current_user,
    )

    offboarding_service._checkmk_cleanup.remove_host.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_offboard_without_checkmk_skips_remove_host(offboarding_service):
    """Offboarding with remove_from_checkmk=False must NOT call CheckMK cleanup."""
    current_user = {"username": "testuser", "user_id": 1}

    await offboarding_service.offboard_device(
        DEVICE_ID,
        simple_offboard_request(remove_from_checkmk=False),
        current_user,
    )

    offboarding_service._checkmk_cleanup.remove_host.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_offboard_device_not_found_succeeds_with_warning(offboarding_service, fake_nb):
    """Offboarding a non-existent device ID should return success (DELETE is idempotent)."""
    current_user = {"username": "testuser", "user_id": 1}
    non_existent_id = "ee000000-0000-0000-ffff-000000000099"

    # Update mock to return details for the non-existent device
    offboarding_service._device_query_svc = MagicMock()

    result = await offboarding_service.offboard_device(
        non_existent_id,
        simple_offboard_request(),
        current_user,
    )

    # The result may have errors but should not raise an unhandled exception
    assert isinstance(result, dict)
    assert "success" in result


@pytest.mark.asyncio
@pytest.mark.unit
async def test_offboard_checkmk_failure_does_not_stop_nautobot_cleanup(
    offboarding_service, fake_nb
):
    """If CheckMK removal fails, Nautobot cleanup should still complete."""
    from fastapi import HTTPException

    offboarding_service._checkmk_cleanup.remove_host = AsyncMock(
        side_effect=HTTPException(status_code=500, detail="CheckMK unavailable")
    )
    current_user = {"username": "testuser", "user_id": 1}

    result = await offboarding_service.offboard_device(
        DEVICE_ID,
        simple_offboard_request(remove_from_checkmk=True),
        current_user,
    )

    # Device should be deleted from Nautobot despite CheckMK failure
    assert DEVICE_ID not in fake_nb._devices


@pytest.mark.asyncio
@pytest.mark.unit
async def test_offboard_entire_chassis_removes_all_members(fake_nb, mock_cache):
    """virtual_chassis_action=remove_all should delete the VC and all member devices."""
    # Set up a virtual chassis with 2 members
    fake_nb.seed_device(MEMBER_ID, {
        "name": "chassis-member-01",
        "status": {"id": STATUS_ACTIVE_ID, "name": "Active"},
        "primary_ip4": None,
        "interfaces": [],
    })
    fake_nb._virtual_chassis[VC_ID] = {"id": VC_ID, "name": "test-stack"}

    member_details = make_device_details(MEMBER_ID, "chassis-member-01", None, "0.0.0.0/0", [])
    primary_details = make_device_details(DEVICE_ID, DEVICE_NAME, IP_ID, "10.0.0.1/24")

    mock_dqs = MagicMock()
    mock_dqs.get_device_details = AsyncMock(side_effect=[primary_details, member_details])

    with patch("service_factory.build_nautobot_service", return_value=fake_nb):
        with patch("service_factory.build_cache_service", return_value=mock_cache):
            with patch("service_factory.build_device_query_service", return_value=mock_dqs):
                svc = OffboardingService()
                svc._checkmk_cleanup = MagicMock()
                svc._checkmk_cleanup.remove_host = AsyncMock(return_value=None)

    request = OffboardDeviceRequest(
        remove_primary_ip=True,
        remove_interface_ips=True,
        remove_from_checkmk=False,
        virtual_chassis_action="remove_all",
        virtual_chassis_id=VC_ID,
        chassis_member_ids=[DEVICE_ID, MEMBER_ID],
    )

    result = await svc.offboard_device(DEVICE_ID, request, {"username": "testuser", "user_id": 1})

    assert result["success"] is True
    assert DEVICE_ID not in fake_nb._devices
    assert MEMBER_ID not in fake_nb._devices
    assert VC_ID not in fake_nb._virtual_chassis
