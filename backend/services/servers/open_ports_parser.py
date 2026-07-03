"""Parser for the output of CockpitAgentService.send_open_ports_scan()."""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, TypedDict


class PortBinding(TypedDict):
    """A single listening port and the address it is bound to.

    address "0.0.0.0" / "::" / "*" means the port is reachable on every
    interface; anything else (e.g. "127.0.0.1", "::1") is bound to a single
    interface only.
    """

    address: str
    port: int


@dataclass(frozen=True)
class ParsedOpenPorts:
    hostname: str
    ip_address: str
    tcp_ports: List[PortBinding]
    udp_ports: List[PortBinding]


def _parse_bindings(raw: Any) -> List[PortBinding]:
    if not isinstance(raw, list):
        return []
    bindings: List[PortBinding] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        address = entry.get("address")
        port = entry.get("port")
        if address is None or port is None:
            continue
        bindings.append({"address": str(address), "port": int(port)})
    return bindings


def parse_open_ports(output: Optional[Dict[str, Any]]) -> ParsedOpenPorts:
    """Parse the raw `output` dict returned by CockpitAgentService.send_open_ports_scan()."""
    raw = output or {}

    return ParsedOpenPorts(
        hostname=raw.get("hostname") or "",
        ip_address=raw.get("ip_address") or "",
        tcp_ports=_parse_bindings(raw.get("tcp_ports")),
        udp_ports=_parse_bindings(raw.get("udp_ports")),
    )
