"""
Generate test baseline YAML files from structured parameters.
"""

from __future__ import annotations

import copy
import ipaddress
import random
import re
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple

import yaml

from models.tools import (
    BaselineStats,
    CreateBaselineRequest,
    CreateBaselineResponse,
    DistributionConfig,
)
from services.network.tools.baseline_profiles import merge_profile_into_request

BACKEND_ROOT = Path(__file__).resolve().parents[3]
REPO_ROOT = BACKEND_ROOT.parent
DEFAULT_OUTPUT_DIR = REPO_ROOT / "data" / "baseline"

TAG_COLORS = ["green", "yellow", "blue", "orange", "purple", "gray"]
DEFAULT_STATUSES = ["Active", "Offline"]
DEFAULT_CLUSTER_TYPE_NAME = "cluster-type"
DEFAULT_TAG_CONTENT_TYPES = [
    "dcim.device",
    "virtualization.virtualmachine",
    "virtualization.cluster",
]
DEFAULT_DATES = [
    "2025-01-15",
    "2025-02-20",
    "2025-03-10",
    "2025-04-05",
    "2025-05-12",
    "2025-06-01",
]

DistributionColumn = Literal["network", "server", "vm"]

PYTEST_CITY_ORDER = [
    "City A",
    "Another City A",
    "City B",
    "Another City B",
    "City C",
    "Another City C",
]

# Host octets reserved by integration tests (see doc/PYTEST_BASELINE.md §10)
RESERVED_HOST_OCTETS = {254}


def get_output_directory() -> Path:
    """Return the directory where generated baseline YAML files are written."""
    return DEFAULT_OUTPUT_DIR


def parse_comma_list(value: str) -> List[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


def parse_custom_fields(value: str) -> Dict[str, str]:
    result: Dict[str, str] = {}
    for part in parse_comma_list(value):
        if "=" not in part:
            continue
        key, _, field_value = part.partition("=")
        key = key.strip()
        if key:
            result[key] = field_value.strip()
    return result


def parse_hierarchy(hierarchy: str) -> List[str]:
    parts = [p.strip() for p in re.split(r"\s*->\s*", hierarchy) if p.strip()]
    if not parts:
        raise ValueError("location_hierarchy must define at least one location type")
    return parts


def location_label(index: int) -> str:
    """Return Location A, Location B, ... Location Z, Location AA, ..."""
    label = ""
    n = index
    while True:
        label = chr(ord("A") + (n % 26)) + label
        n = n // 26 - 1
        if n < 0:
            break
    return f"Location {label}"


def cluster_label(index: int) -> str:
    return location_label(index).replace("Location", "Cluster")


def name_for_ip(prefix: str, ip: str) -> str:
    host = ip.split("/")[0]
    return f"{prefix}-{host.replace('.', '-')}"


def _network_from_prefix(prefix_cidr: str) -> ipaddress.IPv4Network:
    return ipaddress.ip_network(prefix_cidr.strip(), strict=False)


class IpAllocator:
    """Allocate host IPs sequentially within prefixes per device class."""

    def __init__(self, prefix_strings: List[str]) -> None:
        if not prefix_strings:
            raise ValueError("At least one prefix is required")
        self._networks = [_network_from_prefix(p) for p in prefix_strings]
        self._cursors: Dict[int, int] = {i: 1 for i in range(len(self._networks))}

    def next_ip(self, pool_index: int) -> str:
        if pool_index >= len(self._networks):
            pool_index = pool_index % len(self._networks)
        network = self._networks[pool_index]
        host = self._cursors[pool_index]
        while host >= network.num_addresses - 1:
            host += 1
            if host > 254:
                raise ValueError(f"Exhausted addresses in prefix {network}")
        self._cursors[pool_index] = host + 1
        return f"{network.network_address + host}/{network.prefixlen}"


class UniqueIpAllocator(IpAllocator):
    """IpAllocator that enforces unique host addresses across all allocations."""

    def __init__(
        self,
        prefix_strings: List[str],
        reserved_host_octets: Optional[set[int]] = None,
    ) -> None:
        super().__init__(prefix_strings)
        self._used_hosts: set[str] = set()
        self._reserved = reserved_host_octets or RESERVED_HOST_OCTETS

    def next_ip(self, pool_index: int) -> str:
        for _ in range(512):
            candidate = super().next_ip(pool_index)
            host_addr = candidate.split("/")[0]
            host_octet = int(host_addr.rsplit(".", 1)[-1])
            if host_octet in self._reserved:
                continue
            if host_addr in self._used_hosts:
                continue
            self._used_hosts.add(host_addr)
            return candidate
        raise ValueError("Could not allocate a unique IP address")


def build_location_types(hierarchy: List[str]) -> List[Dict[str, Any]]:
    types: List[Dict[str, Any]] = []
    for idx, type_name in enumerate(hierarchy):
        entry: Dict[str, Any] = {
            "name": type_name,
            "description": type_name,
            "content_types": ["dcim.device"],
        }
        if idx > 0:
            entry["parent"] = hierarchy[idx - 1]
        types.append(entry)
    if types:
        leaf_types = list(types[-1]["content_types"])
        if "virtualization.cluster" not in leaf_types:
            leaf_types.append("virtualization.cluster")
        types[-1]["content_types"] = sorted(set(leaf_types))
    return types


def build_locations(
    hierarchy: List[str],
    leaf_count: int,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Build location tree with leaf names Location A, B, C."""
    locations: List[Dict[str, Any]] = []
    leaf_names: List[str] = []

    if len(hierarchy) == 1:
        type_name = hierarchy[0]
        for i in range(leaf_count):
            leaf = location_label(i)
            leaf_names.append(leaf)
            locations.append(
                {
                    "name": leaf,
                    "location_types": type_name,
                    "parent": None,
                    "status": "active",
                    "description": leaf,
                }
            )
        return locations, leaf_names

    for i in range(leaf_count):
        leaf = location_label(i)
        leaf_names.append(leaf)
        country = f"Country {location_label(i)}"
        state = f"State {location_label(i)}"
        chain: List[Tuple[str, str, Optional[str]]] = []

        for level_idx, type_name in enumerate(hierarchy):
            if level_idx == 0:
                node_name = country
                parent: Optional[str] = None
            elif level_idx == len(hierarchy) - 1:
                node_name = leaf
                parent = chain[-1][0] if chain else None
            elif level_idx == 1:
                node_name = state
                parent = country
            else:
                node_name = f"{type_name} {location_label(i)}"
                parent = chain[-1][0] if chain else None
            chain.append((node_name, type_name, parent))

        seen: set[str] = set()
        for node_name, type_name, parent in chain:
            if node_name in seen:
                continue
            seen.add(node_name)
            locations.append(
                {
                    "name": node_name,
                    "location_types": type_name,
                    "parent": parent,
                    "status": "active",
                    "description": node_name,
                }
            )

    return locations, leaf_names


def build_pytest_locations() -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Build the pytest_legacy location tree (Country/State/City + Building/Room under City A).
    """
    hierarchy = ["Country", "State", "City", "Building", "Room"]
    location_types = build_location_types(hierarchy)
    if location_types:
        room_types = list(location_types[-1]["content_types"])
        if "dcim.rack" not in room_types:
            room_types.append("dcim.rack")
        location_types[-1]["content_types"] = sorted(set(room_types))

    locations: List[Dict[str, Any]] = []
    country_state_city: List[Tuple[str, str, List[str]]] = [
        ("Country A", "State A", ["City A", "Another City A"]),
        ("Country B", "State B", ["City B", "Another City B"]),
        ("Country C", "State C", ["City C", "Another City C"]),
    ]

    for country, state, cities in country_state_city:
        locations.append(
            {
                "name": country,
                "location_types": "Country",
                "parent": None,
                "status": "active",
                "description": country,
            }
        )
        locations.append(
            {
                "name": state,
                "parent": country,
                "location_types": "State",
                "description": state,
                "status": "active",
            }
        )
        for city in cities:
            locations.append(
                {
                    "name": city,
                    "parent": state,
                    "location_types": "City",
                    "description": city,
                    "status": "active",
                }
            )

    locations.extend(
        [
            {
                "name": "Building A",
                "parent": "City A",
                "location_types": "Building",
                "description": "Building A",
                "status": "active",
            },
            {
                "name": "Room A",
                "parent": "Building A",
                "location_types": "Room",
                "description": "Room A",
                "status": "active",
            },
        ]
    )
    return locations, list(PYTEST_CITY_ORDER)


def assign_sequential_name(
    kind: Literal["network", "server"],
    index: int,
    request: CreateBaselineRequest,
) -> str:
    if kind == "network":
        width = request.network_device_index_width
        return f"{request.network_device_prefix}-{index:0{width}d}"
    width = request.server_device_index_width
    return f"{request.server_device_prefix}-{index:0{width}d}"


def resolve_golden_path(request: CreateBaselineRequest) -> Path:
    if not request.golden_reference_path:
        raise ValueError("golden_reference_path is required for golden_parity mode")
    path = Path(request.golden_reference_path)
    if not path.is_absolute():
        path = REPO_ROOT / path
    if not path.is_file():
        raise FileNotFoundError(f"Golden baseline not found: {path}")
    return path


def load_golden_baseline(request: CreateBaselineRequest) -> Dict[str, Any]:
    path = resolve_golden_path(request)
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def apply_golden_metadata(
    devices: List[Dict[str, Any]], golden_path: Path
) -> None:
    """Copy per-device metadata from golden YAML by device name (not IPs)."""
    golden = yaml.safe_load(golden_path.read_text(encoding="utf-8"))
    golden_by_name = {d["name"]: d for d in golden.get("devices", [])}
    for device in devices:
        golden_device = golden_by_name.get(device["name"])
        if not golden_device:
            continue
        for key in (
            "location",
            "status",
            "tags",
            "roles",
            "role",
            "custom_fields",
            "device_type",
            "platform",
            "serial",
        ):
            if key in golden_device:
                device[key] = copy.deepcopy(golden_device[key])


def allocate_ips_pytest(
    devices: List[Dict[str, Any]], prefix_strings: List[str]
) -> None:
    """Assign unique primary and interface IPs; never copy addresses from golden."""
    allocator = UniqueIpAllocator(prefix_strings)
    for device in devices:
        is_network = device.get("device_type") == "networkA"
        if is_network:
            primary = allocator.next_ip(0)
            secondary = allocator.next_ip(min(1, len(prefix_strings) - 1))
            device["primary_ip4"] = primary
            device["interfaces"] = [
                {
                    "name": "GigabitEthernet1/0/1",
                    "type": "1000base-t",
                    "ip_address": primary,
                },
                {
                    "name": "GigabitEthernet1/0/2",
                    "type": "1000base-t",
                    "ip_address": secondary,
                },
            ]
        else:
            server_pool = min(2, len(prefix_strings) - 1)
            primary = allocator.next_ip(server_pool)
            device["primary_ip4"] = primary
            device["interfaces"] = [
                {
                    "name": "eth0",
                    "type": "1000base-t",
                    "ip_address": primary,
                }
            ]


def build_pytest_metadata(request: CreateBaselineRequest) -> Dict[str, Any]:
    """Metadata sections matching the golden pytest baseline."""
    tag_names = parse_comma_list(request.tags) or ["Production", "Staging", "lab"]
    metadata = build_default_metadata(
        tag_names,
        request.network_device_role,
        request.server_role,
        request.vm_role,
    )
    metadata["roles"].append(
        {
            "name": "lab",
            "description": "This is a lab device",
            "content_types": ["dcim.device"],
        }
    )
    for role in metadata["roles"]:
        if role["name"] == request.server_role:
            role["name"] = "server"
            role["description"] = "This device is a server"
    metadata["custom_field_choices"] = {
        "net": [
            {"value": "netA", "label": "Network A"},
            {"value": "netB", "label": "Network B"},
            {"value": "lab", "label": "lab"},
        ],
        "checkmk_site": [
            {"value": "siteA", "label": "Site A"},
            {"value": "siteB", "label": "Site B"},
            {"value": "siteC", "label": "Site C"},
        ],
        "snmp_credentials": [
            {"value": "credA", "label": "Credential A"},
            {"value": "credB", "label": "Credential B"},
            {"value": "credC", "label": "Credential C"},
        ],
    }
    net_field = metadata["custom_fields"]["net"][0]
    net_field["selections"] = ["netA", "netB", "netC"]
    return metadata


def build_devices_pytest(request: CreateBaselineRequest) -> List[Dict[str, Any]]:
    """Build 120 devices in pytest generation order with sequential names."""
    dist = request.distribution
    if not dist or dist.mode != "manual":
        raise ValueError("pytest_legacy requires manual distribution")

    by_city = {row.location: row for row in dist.by_location}
    devices: List[Dict[str, Any]] = []
    network_index = 1
    server_index = 1

    for city in PYTEST_CITY_ORDER:
        row = by_city.get(city)
        if not row:
            raise ValueError(f"Manual distribution missing city '{city}'")

        for _ in range(row.network):
            devices.append(
                {
                    "name": assign_sequential_name("network", network_index, request),
                    "device_type": "networkA",
                    "platform": "Cisco IOS",
                    "roles": [request.network_device_role],
                    "location": city,
                    "status": "Active",
                    "tags": [parse_comma_list(request.tags)[0]],
                    "serial": f"NET{network_index:07d}",
                }
            )
            network_index += 1

        for _ in range(row.server):
            devices.append(
                {
                    "name": assign_sequential_name("server", server_index, request),
                    "device_type": "serverA",
                    "platform": "ServerPlatform",
                    "roles": [request.server_role],
                    "location": city,
                    "status": "Active",
                    "tags": [parse_comma_list(request.tags)[0]],
                    "serial": f"SRV{server_index:07d}",
                }
            )
            server_index += 1

    return devices


def generate_pytest_legacy_dict(request: CreateBaselineRequest) -> Dict[str, Any]:
    prefix_list = parse_comma_list(request.prefixes)

    if request.metadata_mode == "golden_parity":
        baseline = load_golden_baseline(request)
        devices = copy.deepcopy(baseline.get("devices", []))
        allocate_ips_pytest(devices, prefix_list)
        baseline["devices"] = devices
        return baseline

    locations, leaf_names = build_pytest_locations()
    validate_manual_distribution(
        request.distribution or DistributionConfig(),
        leaf_names,
        request.number_of_network_devices,
        request.number_of_servers,
        request.number_of_virtual_machines,
    )
    devices = build_devices_pytest(request)
    golden_path = resolve_golden_path(request) if request.golden_reference_path else None
    if golden_path and golden_path.is_file():
        apply_golden_metadata(devices, golden_path)
    allocate_ips_pytest(devices, prefix_list)

    prefixes_section = [
        {"prefix": p, "description": p} for p in prefix_list
    ]
    hierarchy = parse_hierarchy(request.location_hierarchy)
    return {
        "location_types": build_location_types(hierarchy),
        "location": locations,
        "prefixes": prefixes_section,
        "devices": devices,
        **build_pytest_metadata(request),
    }


def validate_manual_distribution(
    config: DistributionConfig,
    leaf_names: List[str],
    network_count: int,
    server_count: int,
    vm_count: int,
) -> None:
    if config.mode != "manual":
        return
    by_name = {row.location: row for row in config.by_location}
    for name in leaf_names:
        if name not in by_name:
            raise ValueError(f"Manual distribution missing location '{name}'")
    total_network = sum(r.network for r in config.by_location)
    total_server = sum(r.server for r in config.by_location)
    total_vm = sum(r.vm for r in config.by_location)
    if total_network != network_count:
        raise ValueError(
            f"Manual network device counts sum to {total_network}, "
            f"expected {network_count}"
        )
    if total_server != server_count:
        raise ValueError(
            f"Manual server counts sum to {total_server}, expected {server_count}"
        )
    if total_vm != vm_count:
        raise ValueError(f"Manual VM counts sum to {total_vm}, expected {vm_count}")


def _manual_location_list(
    config: DistributionConfig,
    column: DistributionColumn,
) -> List[str]:
    result: List[str] = []
    for row in config.by_location:
        count = getattr(row, column)
        result.extend([row.location] * count)
    return result


def assign_locations(
    count: int,
    leaf_names: List[str],
    config: Optional[DistributionConfig],
    column: DistributionColumn,
) -> List[str]:
    if count == 0:
        return []
    if not leaf_names:
        raise ValueError("At least one leaf location is required to assign devices")

    dist = config or DistributionConfig()
    if dist.mode == "manual":
        locations = _manual_location_list(dist, column)
        if len(locations) != count:
            raise ValueError(
                f"Manual distribution produced {len(locations)} assignments "
                f"for {column}, expected {count}"
            )
        return locations

    if dist.mode == "random":
        rng = random.Random(dist.seed)
        return [rng.choice(leaf_names) for _ in range(count)]

    return [leaf_names[i % len(leaf_names)] for i in range(count)]


def build_default_metadata(
    tag_names: List[str],
    network_role: str,
    server_role: str,
    vm_role: str,
) -> Dict[str, Any]:
    tags = []
    for idx, name in enumerate(tag_names):
        tags.append(
            {
                "name": name,
                "description": f"{name} environment",
                "color": TAG_COLORS[idx % len(TAG_COLORS)],
                "content_types": list(DEFAULT_TAG_CONTENT_TYPES),
            }
        )

    roles = [
        {
            "name": network_role,
            "description": "Network device role",
            "content_types": ["dcim.device"],
        },
        {
            "name": server_role,
            "description": "Server device role",
            "content_types": ["dcim.device"],
        },
        {
            "name": vm_role,
            "description": "Virtual machine role",
            "content_types": ["virtualization.virtualmachine"],
        },
    ]

    return {
        "roles": roles,
        "tags": tags,
        "manufacturers": [
            {"name": "NetworkInc", "description": "Network Incorporated"},
            {"name": "ServerInc", "description": "Server Incorporated"},
        ],
        "device_types": [
            {"manufacturer": "NetworkInc", "model": "networkA"},
            {"manufacturer": "ServerInc", "model": "serverA"},
        ],
        "platforms": [
            {
                "name": "Cisco IOS",
                "manufacturer": "Cisco",
                "network_driver": "cisco_ios",
            },
            {"name": "ServerPlatform", "manufacturer": "ServerInc"},
        ],
        "custom_field_choices": {
            "net": [
                {"value": "netA", "label": "Network A"},
                {"value": "netB", "label": "Network B"},
                {"value": "lab", "label": "lab"},
            ],
            "checkmk_site": [
                {"value": "siteA", "label": "Site A"},
                {"value": "siteB", "label": "Site B"},
                {"value": "siteC", "label": "Site C"},
            ],
            "snmp_credentials": [
                {"value": "credA", "label": "Credential A"},
                {"value": "credB", "label": "Credential B"},
                {"value": "credC", "label": "Credential C"},
            ],
        },
        "custom_fields": {
            "net": [
                {
                    "label": "net",
                    "type": "select",
                    "selection_type": "single",
                    "selections": ["netA", "netB", "lab"],
                    "description": "Network assignment",
                    "content_types": ["dcim.device", "virtualization.virtualmachine"],
                }
            ],
            "checkmk_site": [
                {
                    "label": "checkmk_site",
                    "type": "select",
                    "selection_type": "single",
                    "selections": ["siteA", "siteB", "siteC"],
                    "description": "CheckMK Site Name",
                    "content_types": ["dcim.device", "virtualization.virtualmachine"],
                }
            ],
            "free_textfield": [
                {
                    "label": "free_textfield",
                    "type": "text",
                    "description": "A free text field for devices",
                    "content_types": [
                        "dcim.device",
                        "virtualization.virtualmachine",
                    ],
                }
            ],
            "last_backup": [
                {
                    "label": "last_backup",
                    "type": "date",
                    "description": "Date of the last backup",
                    "content_types": [
                        "dcim.device",
                        "virtualization.virtualmachine",
                    ],
                }
            ],
            "snmp_credentials": [
                {
                    "label": "snmp_credentials",
                    "type": "select",
                    "selection_type": "single",
                    "selections": ["credA", "credB", "credC"],
                    "description": "SNMP Credentials",
                    "content_types": ["dcim.device"],
                }
            ],
        },
    }


def merge_custom_field_values(
    template: Dict[str, str],
    location: str,
    rng: random.Random,
) -> Dict[str, Any]:
    defaults = {
        "net": rng.choice(["netA", "netB", "lab"]),
        "checkmk_site": rng.choice(["siteA", "siteB", "siteC"]),
        "free_textfield": f"Device in {location}",
        "last_backup": rng.choice(DEFAULT_DATES),
        "snmp_credentials": rng.choice(["credA", "credB", "credC"]),
    }
    merged = {**defaults, **template}
    return merged


def write_yaml_with_blank_lines(
    data: Dict[str, Any], file_path: Path, stats: Dict[str, Any]
) -> None:
    """Write YAML with blank lines between major sections and devices."""
    lines: List[str] = []
    lines.append("# Baseline Test Data Statistics")
    lines.append("# ==============================")
    lines.append(f"# Total Devices: {stats['total_devices']}")
    lines.append(f"#   - Network Devices: {stats['network_devices']}")
    lines.append(f"#   - Server Devices: {stats['server_devices']}")
    lines.append(f"#   - Virtual Machines: {stats['virtual_machines']}")
    lines.append("#")
    lines.append("# Distribution by Location:")
    for loc, count in sorted(stats["locations"].items()):
        lines.append(f"#   - {loc}: {count} devices")
    lines.append("#")
    lines.append("# Distribution by Status:")
    for status, count in sorted(stats["statuses"].items()):
        lines.append(f"#   - {status}: {count} devices")
    lines.append("#")
    lines.append("# Distribution by Tag:")
    for tag, count in sorted(stats["tags"].items()):
        lines.append(f"#   - {tag}: {count} devices")
    lines.append("#")
    lines.append("")

    for key in data.keys():
        if key == "devices":
            lines.append("devices:")
            for i, device in enumerate(data[key]):
                if i > 0:
                    lines.append("")
                device_yaml = yaml.dump(
                    [device],
                    default_flow_style=False,
                    sort_keys=False,
                    allow_unicode=True,
                )
                device_lines = device_yaml.strip().split("\n")
                for j, line in enumerate(device_lines):
                    if j == 0:
                        lines.append("- " + line[2:])
                    else:
                        lines.append(line)
        elif key == "virtual_machines":
            if lines:
                lines.append("")
            lines.append("virtual_machines:")
            for i, vm in enumerate(data[key]):
                if i > 0:
                    lines.append("")
                vm_yaml = yaml.dump(
                    [vm],
                    default_flow_style=False,
                    sort_keys=False,
                    allow_unicode=True,
                )
                vm_lines = vm_yaml.strip().split("\n")
                for j, line in enumerate(vm_lines):
                    if j == 0:
                        lines.append("- " + line[2:])
                    else:
                        lines.append(line)
        else:
            if lines and not lines[-1].startswith("#"):
                lines.append("")
            section_yaml = yaml.dump(
                {key: data[key]},
                default_flow_style=False,
                sort_keys=False,
                allow_unicode=True,
            )
            lines.extend(section_yaml.rstrip().split("\n"))

    file_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def compute_stats(baseline: Dict[str, Any]) -> BaselineStats:
    location_counts: Dict[str, int] = {}
    tag_counts: Dict[str, int] = {}
    status_counts: Dict[str, int] = {}
    network_count = 0
    server_count = 0

    for device in baseline.get("devices", []):
        loc = device["location"]
        location_counts[loc] = location_counts.get(loc, 0) + 1
        if device.get("tags"):
            tag = device["tags"][0]
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
        status = device.get("status", "Active")
        status_counts[status] = status_counts.get(status, 0) + 1
        roles = device.get("roles") or [device.get("role")]
        role_name = roles[0] if roles else ""
        if network_role_match(device, role_name):
            network_count += 1
        else:
            server_count += 1

    vm_count = len(baseline.get("virtual_machines", []))
    for vm in baseline.get("virtual_machines", []):
        if vm.get("tags"):
            tag = vm["tags"][0]
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
        status = vm.get("status", "Active")
        status_counts[status] = status_counts.get(status, 0) + 1

    return BaselineStats(
        total_devices=len(baseline.get("devices", [])) + vm_count,
        network_devices=network_count,
        server_devices=server_count,
        virtual_machines=vm_count,
        clusters=len(baseline.get("clusters", [])),
        locations=location_counts,
        tags=tag_counts,
        statuses=status_counts,
    )


def network_role_match(device: Dict[str, Any], role_name: str) -> bool:
    device_type = device.get("device_type", "")
    return device_type == "networkA" or "network" in role_name.lower()


def generate_baseline_dict(request: CreateBaselineRequest) -> Dict[str, Any]:
    request = merge_profile_into_request(request)
    if request.layout == "pytest_legacy":
        return generate_pytest_legacy_dict(request)

    hierarchy = parse_hierarchy(request.location_hierarchy)
    prefix_list = parse_comma_list(request.prefixes)
    tag_names = parse_comma_list(request.tags) or ["lab"]
    custom_field_template = parse_custom_fields(request.custom_fields)
    dist = request.distribution or DistributionConfig()

    locations, leaf_names = build_locations(hierarchy, request.number_of_locations)
    validate_manual_distribution(
        dist,
        leaf_names,
        request.number_of_network_devices,
        request.number_of_servers,
        request.number_of_virtual_machines,
    )

    network_locs = assign_locations(
        request.number_of_network_devices,
        leaf_names,
        dist,
        "network",
    )
    server_locs = assign_locations(
        request.number_of_servers,
        leaf_names,
        dist,
        "server",
    )
    vm_locs = assign_locations(
        request.number_of_virtual_machines,
        leaf_names,
        dist,
        "vm",
    )

    rng = random.Random(dist.seed if dist.mode == "random" else 42)
    metadata = build_default_metadata(
        tag_names,
        request.network_device_role,
        request.server_role,
        request.vm_role,
    )

    prefixes_section = [{"prefix": p, "description": p} for p in prefix_list]
    allocator = IpAllocator(prefix_list)

    devices: List[Dict[str, Any]] = []
    for idx, location in enumerate(network_locs, start=1):
        primary_ip = allocator.next_ip(0)
        secondary_ip = allocator.next_ip(min(1, len(prefix_list) - 1))
        tag = tag_names[idx % len(tag_names)]
        status = DEFAULT_STATUSES[idx % len(DEFAULT_STATUSES)]
        devices.append(
            {
                "name": name_for_ip("lab", primary_ip),
                "device_type": "networkA",
                "platform": "Cisco IOS",
                "roles": [request.network_device_role],
                "location": location,
                "status": status,
                "tags": [tag],
                "serial": f"NET{idx:07d}",
                "primary_ip4": primary_ip,
                "interfaces": [
                    {
                        "name": "GigabitEthernet1/0/1",
                        "type": "1000base-t",
                        "ip_address": primary_ip,
                    },
                    {
                        "name": "GigabitEthernet1/0/2",
                        "type": "1000base-t",
                        "ip_address": secondary_ip,
                    },
                ],
                "custom_fields": merge_custom_field_values(
                    custom_field_template, location, rng
                ),
            }
        )

    server_pool = min(2, len(prefix_list) - 1)
    for idx, location in enumerate(server_locs, start=1):
        primary_ip = allocator.next_ip(server_pool)
        tag = tag_names[idx % len(tag_names)]
        status = DEFAULT_STATUSES[idx % len(DEFAULT_STATUSES)]
        devices.append(
            {
                "name": name_for_ip("server", primary_ip),
                "device_type": "serverA",
                "platform": "ServerPlatform",
                "roles": [request.server_role],
                "location": location,
                "status": status,
                "tags": [tag],
                "serial": f"SRV{idx:07d}",
                "primary_ip4": primary_ip,
                "interfaces": [
                    {
                        "name": "eth0",
                        "type": "1000base-t",
                        "ip_address": primary_ip,
                    }
                ],
                "custom_fields": merge_custom_field_values(
                    custom_field_template, location, rng
                ),
            }
        )

    cluster_names = [
        cluster_label(i) for i in range(max(request.number_of_clusters, 1))
    ]
    cluster_locations: Dict[str, str] = {}
    cluster_groups = [{"name": "Default"}]

    virtual_machines: List[Dict[str, Any]] = []
    vm_pool = min(3, len(prefix_list) - 1)
    for idx, location in enumerate(vm_locs, start=1):
        primary_ip = allocator.next_ip(vm_pool)
        cluster = cluster_names[(idx - 1) % len(cluster_names)]
        cluster_locations.setdefault(cluster, location)
        tag = tag_names[idx % len(tag_names)]
        status = DEFAULT_STATUSES[idx % len(DEFAULT_STATUSES)]
        virtual_machines.append(
            {
                "name": name_for_ip("vm", primary_ip),
                "cluster": cluster,
                "roles": [request.vm_role],
                "platform": "ServerPlatform",
                "location": location,
                "status": status,
                "tags": [tag],
                "primary_ip4": primary_ip,
                "interfaces": [
                    {
                        "name": "eth0",
                        "type": "1000base-t",
                        "ip_address": primary_ip,
                    }
                ],
                "custom_fields": merge_custom_field_values(
                    custom_field_template, location, rng
                ),
            }
        )

    baseline: Dict[str, Any] = {
        "location_types": build_location_types(hierarchy),
        "location": locations,
        "prefixes": prefixes_section,
        "devices": devices,
        **metadata,
    }
    if request.number_of_virtual_machines > 0:
        clusters = [
            {
                "name": name,
                "cluster_type": DEFAULT_CLUSTER_TYPE_NAME,
                "cluster_group": "Default",
                **(
                    {"location": cluster_locations[name]}
                    if name in cluster_locations
                    else {}
                ),
            }
            for name in cluster_names
        ]
        baseline["cluster_types"] = [
            {
                "name": DEFAULT_CLUSTER_TYPE_NAME,
                "slug": DEFAULT_CLUSTER_TYPE_NAME,
            }
        ]
        baseline["cluster_groups"] = cluster_groups
        baseline["clusters"] = clusters
        baseline["virtual_machines"] = virtual_machines

    return baseline


def generate_baseline_file(
    request: CreateBaselineRequest,
    output_dir: Optional[Path] = None,
) -> CreateBaselineResponse:
    request = merge_profile_into_request(request)
    baseline = generate_baseline_dict(request)
    stats = compute_stats(baseline)

    out_dir = output_dir or get_output_directory()
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{request.name}.yaml"
    file_path = out_dir / filename

    stats_dict = {
        "total_devices": stats.total_devices,
        "network_devices": stats.network_devices,
        "server_devices": stats.server_devices,
        "virtual_machines": stats.virtual_machines,
        "locations": stats.locations,
        "tags": stats.tags,
        "statuses": stats.statuses,
    }
    write_yaml_with_blank_lines(baseline, file_path, stats_dict)

    warnings: List[str] = []
    if request.layout == "pytest_legacy":
        primary_ips = [d.get("primary_ip4", "").split("/")[0] for d in baseline.get("devices", [])]
        if len(primary_ips) != len(set(primary_ips)):
            warnings.append("Duplicate primary_ip4 values detected after generation")

    return CreateBaselineResponse(
        success=True,
        message="Baseline YAML file created successfully",
        path=str(file_path),
        filename=filename,
        stats=stats,
        distribution=stats.locations,
        profile=request.profile,
        warnings=warnings,
    )
