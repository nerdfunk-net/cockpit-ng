"""Unit tests for services/network/compliance/check.py."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pysnmp.hlapi.v3arch import (
    usmAesCfb128Protocol,
    usmHMACMD5AuthProtocol,
    usmNoAuthProtocol,
    usmNoPrivProtocol,
)

from services.network.compliance.check import ComplianceCheckService


@pytest.mark.unit
def test_check_ssh_login_success() -> None:
    mock_conn = MagicMock()
    mock_conn.find_prompt.return_value = "router#"

    with patch(
        "services.network.compliance.check.ConnectHandler",
        return_value=MagicMock(__enter__=lambda s: mock_conn, __exit__=MagicMock()),
    ):
        result = ComplianceCheckService.check_ssh_login(
            "10.0.0.1", "cisco_ios", "admin", "secret"
        )

    assert result["success"] is True
    assert result["details"]["prompt"] == "router#"


@pytest.mark.unit
def test_check_ssh_login_failure() -> None:
    with patch(
        "services.network.compliance.check.ConnectHandler",
        side_effect=Exception("timeout"),
    ):
        result = ComplianceCheckService.check_ssh_login(
            "10.0.0.1", "cisco_ios", "admin", "secret"
        )

    assert result["success"] is False
    assert "timeout" in result["message"]


@pytest.mark.unit
def test_get_snmp_auth_protocol_mapping() -> None:
    assert ComplianceCheckService._get_snmp_auth_protocol("MD5") == usmHMACMD5AuthProtocol
    assert ComplianceCheckService._get_snmp_auth_protocol("UNKNOWN") == usmNoAuthProtocol


@pytest.mark.unit
def test_check_configuration_pattern_must_match_pass() -> None:
    config = "hostname router1\nlogging buffered\n"
    result = ComplianceCheckService.check_configuration_pattern(
        "10.0.0.1",
        config,
        pattern=r"hostname\s+\w+",
        pattern_type="must_match",
    )
    assert result["success"] is True


@pytest.mark.unit
def test_check_configuration_pattern_must_not_match_fail() -> None:
    config = "snmp-server community public RO\n"
    result = ComplianceCheckService.check_configuration_pattern(
        "10.0.0.1",
        config,
        pattern=r"snmp-server community public",
        pattern_type="must_not_match",
    )
    assert result["success"] is False


@pytest.mark.unit
def test_check_configuration_pattern_invalid_regex() -> None:
    result = ComplianceCheckService.check_configuration_pattern(
        "10.0.0.1",
        "config",
        pattern="[invalid",
        pattern_type="must_match",
    )
    assert result["success"] is False
    assert result["status"] == "error"


@pytest.mark.unit
def test_check_configuration_mock_runs_patterns() -> None:
    patterns = [
        {
            "pattern": r"hostname\s+\w+",
            "pattern_type": "must_match",
            "description": "hostname",
        }
    ]
    result = ComplianceCheckService.check_configuration_mock(
        "10.0.0.1", "router1", patterns
    )
    assert result["success"] is True
    assert result["total_patterns"] == 1


@pytest.mark.unit
def test_get_snmp_priv_protocol_mapping() -> None:
    assert ComplianceCheckService._get_snmp_priv_protocol("AES") == usmAesCfb128Protocol
    assert ComplianceCheckService._get_snmp_priv_protocol("UNKNOWN") == usmNoPrivProtocol


@pytest.mark.asyncio
@pytest.mark.unit
async def test_check_snmp_v2c_async_success() -> None:
    var_bind = (MagicMock(), MagicMock(prettyPrint=lambda: "Linux router"))
    with patch(
        "services.network.compliance.check.get_cmd",
        new_callable=AsyncMock,
        return_value=(None, None, None, [var_bind]),
    ):
        with patch(
            "services.network.compliance.check.UdpTransportTarget.create",
            new_callable=AsyncMock,
            return_value=MagicMock(),
        ):
            result = await ComplianceCheckService.check_snmp_v1_v2c_async(
                "10.0.0.1", "public", version=2
            )

    assert result["success"] is True
    assert result["details"]["sysDescr"] == "Linux router"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_check_snmp_v2c_async_error_indication() -> None:
    with patch(
        "services.network.compliance.check.get_cmd",
        new_callable=AsyncMock,
        return_value=("timeout", None, None, []),
    ):
        with patch(
            "services.network.compliance.check.UdpTransportTarget.create",
            new_callable=AsyncMock,
            return_value=MagicMock(),
        ):
            result = await ComplianceCheckService.check_snmp_v1_v2c_async(
                "10.0.0.1", "public"
            )

    assert result["success"] is False
    assert "timeout" in result["message"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_check_snmp_v3_async_no_auth_password() -> None:
    with patch(
        "services.network.compliance.check.get_cmd",
        new_callable=AsyncMock,
        return_value=(None, None, None, []),
    ):
        with patch(
            "services.network.compliance.check.UdpTransportTarget.create",
            new_callable=AsyncMock,
            return_value=MagicMock(),
        ):
            result = await ComplianceCheckService.check_snmp_v3_async(
                "10.0.0.1",
                username="snmpuser",
                auth_protocol="MD5",
                auth_password=None,
            )

    assert result["success"] is True


@pytest.mark.unit
def test_check_configuration_pattern_must_match_fails_when_missing() -> None:
    result = ComplianceCheckService.check_configuration_pattern(
        "10.0.0.1",
        "hostname router\n",
        pattern=r"ntp server",
        pattern_type="must_match",
    )
    assert result["success"] is False
    assert "not found" in result["message"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_check_snmp_v2c_async_error_status() -> None:
    mock_status = MagicMock()
    mock_status.prettyPrint.return_value = "noSuchName"
    with patch(
        "services.network.compliance.check.get_cmd",
        new_callable=AsyncMock,
        return_value=(None, mock_status, 1, []),
    ):
        with patch(
            "services.network.compliance.check.UdpTransportTarget.create",
            new_callable=AsyncMock,
            return_value=MagicMock(),
        ):
            result = await ComplianceCheckService.check_snmp_v1_v2c_async(
                "10.0.0.1", "public"
            )

    assert result["success"] is False
    assert "noSuchName" in result["message"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_check_snmp_v3_async_error_indication() -> None:
    with patch(
        "services.network.compliance.check.get_cmd",
        new_callable=AsyncMock,
        return_value=("auth failure", None, None, []),
    ):
        with patch(
            "services.network.compliance.check.UdpTransportTarget.create",
            new_callable=AsyncMock,
            return_value=MagicMock(),
        ):
            result = await ComplianceCheckService.check_snmp_v3_async(
                "10.0.0.1",
                username="snmpuser",
                auth_protocol="MD5",
                auth_password="secret",
            )

    assert result["success"] is False
    assert "auth failure" in result["message"]
