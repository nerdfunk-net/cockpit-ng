"""Unit tests for network scanning authenticators (ssh, netmiko, napalm)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_PATCH_PARAMIKO = "services.network.scanning.authenticators.ssh.paramiko"
_PATCH_NETMIKO_MOD = "services.network.scanning.authenticators.netmiko.ConnectHandler"
_PATCH_NAPALM_DRIVER = (
    "services.network.scanning.authenticators.napalm.get_network_driver"
)


def _mock_ssh_client(
    *,
    show_version_stdout: str = "",
    show_version_stderr: str = "",
    hostname_stdout: str = "",
    uname_n: str = "",
    uname_s: str = "Linux",
) -> MagicMock:
    client = MagicMock()

    def exec_command(cmd: str, timeout: int = 10):
        stdout = MagicMock()
        stderr = MagicMock()
        channel = MagicMock()
        stdout.channel = channel

        if cmd == "show version":
            stdout.read.return_value = show_version_stdout.encode()
            stderr.read.return_value = show_version_stderr.encode()
            channel.recv_exit_status.return_value = 0
        elif cmd == "hostname":
            stdout.read.return_value = hostname_stdout.encode()
            stderr.read.return_value = b""
            channel.recv_exit_status.return_value = 1 if not hostname_stdout else 0
        elif cmd == "uname -a":
            stdout.read.return_value = b"Linux host 5.0"
            stderr.read.return_value = b""
            channel.recv_exit_status.return_value = 0
        elif cmd == "uname -n":
            stdout.read.return_value = uname_n.encode()
            stderr.read.return_value = b""
            channel.recv_exit_status.return_value = 0
        elif cmd == "uname -s":
            stdout.read.return_value = uname_s.encode()
            stderr.read.return_value = b""
            channel.recv_exit_status.return_value = 0
        else:
            stdout.read.return_value = b""
            stderr.read.return_value = b""
            channel.recv_exit_status.return_value = 1

        return None, stdout, stderr

    client.exec_command.side_effect = exec_command
    return client


# ── SSH ───────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
async def test_ssh_authenticator_detects_cisco() -> None:
    from services.network.scanning.authenticators.ssh import SshAuthenticator

    show_version = (
        "Router1 uptime is 10 days, 2 hours\nCisco IOS Software, Version 15.2\n"
    )
    client = _mock_ssh_client(show_version_stdout=show_version)

    with patch(_PATCH_PARAMIKO) as paramiko:
        paramiko.SSHClient.return_value = client
        paramiko.AutoAddPolicy.return_value = MagicMock()
        result = await SshAuthenticator().authenticate("10.0.0.1", "admin", "secret")

    assert result is not None
    assert result["device_type"] == "cisco"
    assert result["hostname"] == "Router1"
    client.close.assert_called()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_ssh_authenticator_detects_linux() -> None:
    from services.network.scanning.authenticators.ssh import SshAuthenticator

    client = _mock_ssh_client(
        show_version_stdout="",
        hostname_stdout="linux-host\n",
    )

    with patch(_PATCH_PARAMIKO) as paramiko:
        paramiko.SSHClient.return_value = client
        paramiko.AutoAddPolicy.return_value = MagicMock()
        result = await SshAuthenticator().authenticate("10.0.0.2", "root", "pw")

    assert result is not None
    assert result["device_type"] == "linux"
    assert result["hostname"] == "linux-host"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_ssh_authenticator_returns_none_on_connect_failure() -> None:
    from services.network.scanning.authenticators.ssh import SshAuthenticator

    client = MagicMock()
    client.connect.side_effect = OSError("connection refused")

    with patch(_PATCH_PARAMIKO) as paramiko:
        paramiko.SSHClient.return_value = client
        paramiko.AutoAddPolicy.return_value = MagicMock()
        result = await SshAuthenticator().authenticate("10.0.0.3", "u", "p")

    assert result is None


@pytest.mark.asyncio
@pytest.mark.unit
async def test_ssh_authenticate_linux_via_uname() -> None:
    from services.network.scanning.authenticators.ssh import SshAuthenticator

    client = _mock_ssh_client(uname_n="srv01", uname_s="Linux")

    with patch(_PATCH_PARAMIKO) as paramiko:
        paramiko.SSHClient.return_value = client
        paramiko.AutoAddPolicy.return_value = MagicMock()
        result = await SshAuthenticator().authenticate_linux("10.0.0.4", "root", "pw")

    assert result == {"hostname": "srv01", "platform": "linux"}


@pytest.mark.unit
def test_ssh_parse_cisco_hostname_with_textfsm() -> None:
    from services.network.scanning.authenticators import ssh as ssh_mod
    from services.network.scanning.authenticators.ssh import SshAuthenticator

    template = "Value Hostname (.+)\n\nStart\n  ^Hostname:\\s+${Hostname}\nEnd\n"
    output = "Hostname: CORE-SW1\n"

    with patch.object(ssh_mod, "textfsm") as mock_textfsm:
        mock_textfsm.TextFSM.return_value.header = ["Hostname"]
        mock_textfsm.TextFSM.return_value.ParseText.return_value = [["CORE-SW1"]]
        hostname = SshAuthenticator()._parse_cisco_hostname(
            output, [(1, template)], "10.0.0.1"
        )

    assert hostname == "CORE-SW1"


# ── Netmiko ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
async def test_netmiko_authenticator_falls_back_when_not_installed() -> None:
    from services.network.scanning.authenticators.netmiko import NetmikoAuthenticator

    auth = NetmikoAuthenticator()
    auth._ssh_fallback.authenticate = AsyncMock(
        return_value={"device_type": "linux", "hostname": "h", "platform": "linux"}
    )

    with patch(_PATCH_NETMIKO_MOD, None):
        result = await auth.authenticate("10.0.0.5", "u", "p")

    assert result["device_type"] == "linux"
    auth._ssh_fallback.authenticate.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_netmiko_authenticator_detects_network_device() -> None:
    from services.network.scanning.authenticators.netmiko import NetmikoAuthenticator

    connection = MagicMock()
    connection.send_command.side_effect = [
        "raw version",
        [{"hostname": "SW1", "device_name": None}],
    ]

    with patch(_PATCH_NETMIKO_MOD, return_value=connection):
        result = await NetmikoAuthenticator().authenticate("10.0.0.6", "admin", "pw")

    assert result is not None
    assert result["hostname"] == "SW1"
    assert result["device_type"] == "cisco"
    connection.disconnect.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_netmiko_authenticator_detects_linux_device_type() -> None:
    from services.network.scanning.authenticators.netmiko import NetmikoAuthenticator

    connection = MagicMock()
    connection.send_command.return_value = "linux-host\n"

    with patch(_PATCH_NETMIKO_MOD, return_value=connection):
        with patch(
            "services.network.scanning.authenticators.netmiko._DEVICE_TYPES",
            ["linux"],
        ):
            result = await NetmikoAuthenticator().authenticate("10.0.0.7", "root", "pw")

    assert result is not None
    assert result["device_type"] == "linux"


@pytest.mark.unit
def test_netmiko_extract_hostname_from_raw_prompt() -> None:
    from services.network.scanning.authenticators.netmiko import NetmikoAuthenticator

    hostname = NetmikoAuthenticator()._extract_hostname_from_raw(
        "Cisco IOS\nRouter1#\n"
    )

    assert hostname == "Router1"


# ── NAPALM ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
async def test_napalm_authenticator_returns_facts_on_success() -> None:
    from services.network.scanning.authenticators.napalm import NapalmAuthenticator

    device = MagicMock()
    device.get_facts.return_value = {"hostname": "R1", "vendor": "Cisco"}

    driver_class = MagicMock(return_value=device)

    with patch(_PATCH_NAPALM_DRIVER, return_value=driver_class):
        with patch(
            "services.network.scanning.authenticators.napalm._CISCO_DRIVERS",
            ["ios"],
        ):
            result = await NapalmAuthenticator().authenticate("10.0.0.8", "admin", "pw")

    assert result == {"hostname": "R1", "platform": "ios"}
    device.open.assert_called_once()
    device.close.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_napalm_authenticator_returns_none_when_all_drivers_fail() -> None:
    from services.network.scanning.authenticators.napalm import NapalmAuthenticator

    driver_class = MagicMock(side_effect=Exception("auth failed"))

    with patch(_PATCH_NAPALM_DRIVER, return_value=driver_class):
        with patch(
            "services.network.scanning.authenticators.napalm._CISCO_DRIVERS",
            ["ios"],
        ):
            result = await NapalmAuthenticator().authenticate(
                "10.0.0.9", "admin", "bad"
            )

    assert result is None
