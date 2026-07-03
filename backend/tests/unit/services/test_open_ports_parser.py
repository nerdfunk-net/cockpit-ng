"""Unit tests for services/servers/open_ports_parser.py."""

from __future__ import annotations

import pytest

from services.servers.open_ports_parser import parse_open_ports


@pytest.mark.unit
class TestParseOpenPorts:
    def test_parses_full_output(self) -> None:
        result = parse_open_ports(
            {
                "tcp_ports": [
                    {"address": "0.0.0.0", "port": 22},
                    {"address": "127.0.0.1", "port": 5432},
                ],
                "udp_ports": [{"address": "::", "port": 68}],
                "ip_address": "10.0.0.5",
                "hostname": "host1.example.com",
            }
        )

        assert result.hostname == "host1.example.com"
        assert result.ip_address == "10.0.0.5"
        assert result.tcp_ports == [
            {"address": "0.0.0.0", "port": 22},
            {"address": "127.0.0.1", "port": 5432},
        ]
        assert result.udp_ports == [{"address": "::", "port": 68}]

    def test_coerces_port_to_int(self) -> None:
        result = parse_open_ports({"tcp_ports": [{"address": "0.0.0.0", "port": "22"}]})
        assert result.tcp_ports == [{"address": "0.0.0.0", "port": 22}]

    def test_skips_malformed_entries(self) -> None:
        result = parse_open_ports(
            {
                "tcp_ports": [
                    {"address": "0.0.0.0", "port": 22},
                    {"address": "127.0.0.1"},  # missing port
                    "not-a-dict",
                    None,
                ]
            }
        )
        assert result.tcp_ports == [{"address": "0.0.0.0", "port": 22}]

    def test_non_list_ports_default_to_empty(self) -> None:
        result = parse_open_ports({"tcp_ports": "not-a-list"})
        assert result.tcp_ports == []

    def test_missing_port_lists_default_to_empty(self) -> None:
        result = parse_open_ports({"ip_address": "10.0.0.5", "hostname": "host1"})
        assert result.tcp_ports == []
        assert result.udp_ports == []

    def test_empty_output_returns_defaults(self) -> None:
        result = parse_open_ports(None)
        assert result.hostname == ""
        assert result.ip_address == ""
        assert result.tcp_ports == []
        assert result.udp_ports == []
