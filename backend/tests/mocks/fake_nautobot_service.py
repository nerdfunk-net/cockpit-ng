"""Stateful in-memory Nautobot simulation for unit testing.

Drop-in replacement for NautobotService. Routes GraphQL and REST calls to
in-memory dictionaries. Supports error simulation via the error_on constructor
argument.

Usage::

    fake = FakeNautobotService()
    fake.seed_device("dev-uuid", {"name": "router1", "interfaces": []})

    # Simulate duplicate-device error on device creation
    fake_dup = FakeNautobotService(error_on={("dcim/devices", "POST"): "duplicate"})
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any
from urllib.parse import parse_qs

from services.nautobot.common.exceptions import NautobotAPIError, NautobotNotFoundError

logger = logging.getLogger(__name__)

# ── Seed UUIDs ─────────────────────────────────────────────────────────────────
STATUS_ACTIVE_ID = "10000000-0000-0000-0000-000000000001"
STATUS_PLANNED_ID = "10000000-0000-0000-0000-000000000002"
STATUS_STAGED_ID = "10000000-0000-0000-0000-000000000003"
STATUS_DECOM_ID = "10000000-0000-0000-0000-000000000004"

PLATFORM_IOS_ID = "20000000-0000-0000-0000-000000000001"
PLATFORM_NXOS_ID = "20000000-0000-0000-0000-000000000002"
PLATFORM_JUNOS_ID = "20000000-0000-0000-0000-000000000003"

DT_NETWORKA_ID = "30000000-0000-0000-0000-000000000001"
DT_NETWORKB_ID = "30000000-0000-0000-0000-000000000002"
DT_SERVER_ID = "30000000-0000-0000-0000-000000000003"

LOC_CITYA_ID = "40000000-0000-0000-0000-000000000001"
LOC_CITYB_ID = "40000000-0000-0000-0000-000000000002"
LOC_DC_ID = "40000000-0000-0000-0000-000000000003"

NS_GLOBAL_ID = "50000000-0000-0000-0000-000000000001"

ROLE_NETWORK_ID = "60000000-0000-0000-0000-000000000001"
ROLE_SERVER_ID = "60000000-0000-0000-0000-000000000002"
ROLE_FIREWALL_ID = "60000000-0000-0000-0000-000000000003"

MFR_CISCO_ID = "70000000-0000-0000-0000-000000000001"
MFR_JUNIPER_ID = "70000000-0000-0000-0000-000000000002"

_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def _new_uuid() -> str:
    return str(uuid.uuid4())


def _is_uuid(value: str) -> bool:
    return bool(_UUID_RE.match(value))


class FakeNautobotService:
    """Stateful in-memory Nautobot simulation for unit testing."""

    def __init__(self, error_on: dict[tuple[str, str], str] | None = None):
        # ── Immutable seed metadata ───────────────────────────────────────────
        self._statuses = {
            "active": {"id": STATUS_ACTIVE_ID, "name": "Active"},
            "planned": {"id": STATUS_PLANNED_ID, "name": "Planned"},
            "staged": {"id": STATUS_STAGED_ID, "name": "Staged"},
            "decommissioning": {"id": STATUS_DECOM_ID, "name": "Decommissioning"},
        }
        self._platforms = {
            "cisco_ios": {
                "id": PLATFORM_IOS_ID,
                "name": "cisco_ios",
                "napalm_driver": "ios",
            },
            "cisco_nxos": {
                "id": PLATFORM_NXOS_ID,
                "name": "cisco_nxos",
                "napalm_driver": "nxos",
            },
            "junos": {
                "id": PLATFORM_JUNOS_ID,
                "name": "junos",
                "napalm_driver": "junos",
            },
        }
        self._device_types: dict[str, dict] = {
            "networka": {
                "id": DT_NETWORKA_ID,
                "model": "networkA",
                "display": "Cisco networkA",
                "manufacturer": {"id": MFR_CISCO_ID, "name": "Cisco"},
            },
            "networkb": {
                "id": DT_NETWORKB_ID,
                "model": "networkB",
                "display": "Juniper networkB",
                "manufacturer": {"id": MFR_JUNIPER_ID, "name": "Juniper"},
            },
            "server": {
                "id": DT_SERVER_ID,
                "model": "server",
                "display": "Generic server",
                "manufacturer": {
                    "id": "70000000-0000-0000-0000-000000000003",
                    "name": "Generic",
                },
            },
        }
        self._locations = {
            "city a": {"id": LOC_CITYA_ID, "name": "City A"},
            "city b": {"id": LOC_CITYB_ID, "name": "City B"},
            "data center": {"id": LOC_DC_ID, "name": "Data Center"},
        }
        self._namespaces = {
            "global": {"id": NS_GLOBAL_ID, "name": "Global"},
        }
        self._roles = {
            "network": {"id": ROLE_NETWORK_ID, "name": "Network"},
            "server": {"id": ROLE_SERVER_ID, "name": "Server"},
            "firewall": {"id": ROLE_FIREWALL_ID, "name": "Firewall"},
        }

        # ── Mutable stores ────────────────────────────────────────────────────
        self._devices: dict[str, dict] = {}
        self._interfaces: dict[str, dict] = {}
        self._ip_addresses: dict[str, dict] = {}
        self._prefixes: dict[str, dict] = {}
        self._virtual_chassis: dict[str, dict] = {}
        self._ip_iface_assocs: dict[str, dict] = {}

        # ── Error simulation ──────────────────────────────────────────────────
        # Keys: (resource_path, METHOD), Values: error_type
        # error_types: "duplicate", "not_found", "missing_prefix", "duplicate_netmask"
        self._error_on: dict[tuple[str, str], str] = error_on or {}

    # ── Seeding helpers ────────────────────────────────────────────────────────

    def seed_device(self, device_id: str, device_data: dict) -> str:
        """Pre-populate a device. Returns the device_id."""
        self._devices[device_id] = {"id": device_id, **device_data}
        return device_id

    def seed_ip(self, ip_id: str, ip_data: dict) -> str:
        """Pre-populate an IP address. Returns the ip_id."""
        self._ip_addresses[ip_id] = {"id": ip_id, **ip_data}
        return ip_id

    def seed_interface(self, iface_id: str, iface_data: dict) -> str:
        """Pre-populate an interface. Returns the iface_id."""
        self._interfaces[iface_id] = {"id": iface_id, **iface_data}
        return iface_id

    # ── NautobotService public interface ───────────────────────────────────────

    async def startup(self) -> None:
        pass

    async def shutdown(self) -> None:
        pass

    async def test_connection(
        self, url: str, token: str, timeout: int = 30, verify_ssl: bool = True
    ) -> tuple[bool, str]:
        return True, "Connection successful"

    async def graphql_query(
        self, query: str, variables: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        variables = variables or {}

        if "GetDeviceByNameContains" in query:
            return self._gql_device_by_name_contains(variables)
        if "GetDeviceByNameStartsWith" in query:
            return self._gql_device_by_name_starts_with(variables)
        if "GetDeviceByName" in query:
            return self._gql_device_by_name(variables)
        if "GetDeviceType" in query:
            return self._gql_device_type(variables)
        # Distinguish device-by-IP (has primary_ip4_for) from IP lookup (has namespace filter)
        if "GetIPAddress" in query and "primary_ip4_for" in query:
            return self._gql_ip_for_device(variables)
        if "GetIPAddress" in query:
            return self._gql_ip_address(variables)
        if "GetRole" in query:
            return self._gql_role(variables)
        if "GetPlatform" in query:
            return self._gql_platform(variables)
        if "GetLocation" in query:
            return self._gql_location(variables)
        if "GetNamespace" in query:
            return self._gql_namespace(variables)
        if "GetInterface" in query:
            return self._gql_interface(variables)
        if "GetSecretsGroup" in query:
            return {"data": {"secrets_groups": []}}
        if "filter_device" in query and "filter_address" in query:
            return self._gql_device_interface_with_ip(variables)

        logger.warning(
            "FakeNautobotService: unhandled GraphQL query (first 80 chars): %s",
            query[:80],
        )
        return {"data": {}}

    async def rest_request(
        self,
        endpoint: str,
        method: str = "GET",
        data: dict[str, Any] | list[Any] | None = None,
    ) -> dict[str, Any]:
        method = method.upper()

        # Split path from query string
        path, qs = (endpoint.split("?", 1) + [""])[:2]
        path = path.strip("/")
        params = {k: v[0] for k, v in parse_qs(qs).items()}

        # Detect detail endpoint: last segment is a UUID
        segments = [s for s in path.split("/") if s]
        last_seg = segments[-1] if segments else ""
        is_detail = _is_uuid(last_seg)

        if is_detail:
            resource = "/".join(segments[:-1])
            resource_id: str | None = last_seg
        else:
            resource = path
            resource_id = None

        # Error simulation check
        error_type = self._error_on.get((resource, method))
        if error_type:
            self._raise_simulated_error(error_type, endpoint)

        return self._dispatch_rest(resource, resource_id, method, params, data or {})

    # ── GraphQL handlers ────────────────────────────────────────────────────────

    def _gql_device_by_name(self, variables: dict) -> dict:
        names = variables.get("name", [])
        if isinstance(names, str):
            names = [names]
        devices = [
            {"id": d["id"], "name": d["name"]}
            for d in self._devices.values()
            if d.get("name") in names
        ]
        return {"data": {"devices": devices}}

    def _gql_device_by_name_contains(self, variables: dict) -> dict:
        search = str(variables.get("name") or "").lower()
        devices = [
            {"id": d["id"], "name": d["name"]}
            for d in self._devices.values()
            if search in d.get("name", "").lower()
        ]
        return {"data": {"devices": devices}}

    def _gql_device_by_name_starts_with(self, variables: dict) -> dict:
        raw = variables.get("name") or ""
        search = (raw[0] if isinstance(raw, list) else raw).lower()
        devices = [
            {"id": d["id"], "name": d["name"]}
            for d in self._devices.values()
            if d.get("name", "").lower().startswith(search)
        ]
        return {"data": {"devices": devices}}

    def _gql_device_type(self, variables: dict) -> dict:
        models = variables.get("model", [])
        if isinstance(models, str):
            models = [models]
        mfr_filter = variables.get("manufacturer")
        if isinstance(mfr_filter, str):
            mfr_filter = [mfr_filter]

        results = []
        for model_name in models:
            dt = self._device_types.get(model_name.lower())
            if not dt:
                continue
            if mfr_filter:
                if dt["manufacturer"]["name"].lower() not in [
                    m.lower() for m in mfr_filter
                ]:
                    continue
            results.append(
                {
                    "id": dt["id"],
                    "model": dt["model"],
                    "manufacturer": dt["manufacturer"],
                }
            )
        return {"data": {"device_types": results}}

    def _gql_ip_for_device(self, variables: dict) -> dict:
        """Resolve device by primary IP (has primary_ip4_for field)."""
        addresses = variables.get("address", [])
        if isinstance(addresses, str):
            addresses = [addresses]

        results = []
        for addr in addresses:
            host = addr.split("/")[0]
            for ip in self._ip_addresses.values():
                ip_host = ip.get("address", "").split("/")[0]
                if ip_host != host and ip.get("address") != addr:
                    continue
                # Find device that uses this IP as primary
                primary_device = None
                for dev in self._devices.values():
                    prim = dev.get("primary_ip4") or {}
                    if prim.get("id") == ip["id"]:
                        primary_device = {"id": dev["id"], "name": dev["name"]}
                        break
                results.append(
                    {
                        "id": ip["id"],
                        "address": ip.get("address", addr),
                        "primary_ip4_for": [primary_device] if primary_device else [],
                    }
                )
        return {"data": {"ip_addresses": results}}

    def _gql_ip_address(self, variables: dict) -> dict:
        """Resolve IP address UUID by address + optional namespace."""
        filters = variables.get("filter", [])
        if isinstance(filters, str):
            filters = [filters]
        ns_filter = variables.get("namespace")
        if isinstance(ns_filter, list):
            ns_filter = ns_filter[0] if ns_filter else None

        results = []
        for addr in filters:
            host = addr.split("/")[0]
            for ip in self._ip_addresses.values():
                ip_host = ip.get("address", "").split("/")[0]
                if ip_host != host and ip.get("address") != addr:
                    continue
                if (
                    ns_filter
                    and ip.get("namespace_id")
                    and ip["namespace_id"] != ns_filter
                ):
                    continue
                results.append({"id": ip["id"], "address": ip.get("address", addr)})
        return {"data": {"ip_addresses": results}}

    def _gql_role(self, variables: dict) -> dict:
        names = variables.get("name", [])
        if isinstance(names, str):
            names = [names]
        results = [
            {"id": r["id"], "name": r["name"]}
            for n in names
            for r in [self._roles.get(n.lower())]
            if r
        ]
        return {"data": {"roles": results}}

    def _gql_platform(self, variables: dict) -> dict:
        names = variables.get("name", [])
        if isinstance(names, str):
            names = [names]
        results = [
            {"id": p["id"], "name": p["name"]}
            for n in names
            for p in [self._platforms.get(n.lower())]
            if p
        ]
        return {"data": {"platforms": results}}

    def _gql_location(self, variables: dict) -> dict:
        names = variables.get("name", [])
        if isinstance(names, str):
            names = [names]
        results = [
            {"id": loc["id"], "name": loc["name"]}
            for n in names
            for loc in [self._locations.get(n.lower())]
            if loc
        ]
        return {"data": {"locations": results}}

    def _gql_namespace(self, variables: dict) -> dict:
        names = variables.get("name", [])
        if isinstance(names, str):
            names = [names]
        results = [
            {"id": ns["id"], "name": ns["name"]}
            for n in names
            for ns in [self._namespaces.get(n.lower())]
            if ns
        ]
        return {"data": {"namespaces": results}}

    def _gql_interface(self, variables: dict) -> dict:
        device_ids = variables.get("device", [])
        names = variables.get("name", [])
        if isinstance(device_ids, str):
            device_ids = [device_ids]
        if isinstance(names, str):
            names = [names]

        results = [
            {"id": iface["id"], "name": iface["name"]}
            for iface in self._interfaces.values()
            if (not device_ids or iface.get("device_id") in device_ids)
            and (not names or iface.get("name") in names)
        ]
        return {"data": {"interfaces": results}}

    def _gql_device_interface_with_ip(self, variables: dict) -> dict:
        """Find interfaces on a device that have a given IP address."""
        dev_names = variables.get("filter_device", [])
        ip_filters = variables.get("filter_address", [])
        if isinstance(dev_names, str):
            dev_names = [dev_names]
        if isinstance(ip_filters, str):
            ip_filters = [ip_filters]

        devices = []
        for dev in self._devices.values():
            if dev.get("name") not in dev_names:
                continue
            matching_ifaces = []
            for iface in self._interfaces.values():
                if iface.get("device_id") != dev["id"]:
                    continue
                for ip_obj in iface.get("ip_addresses", []):
                    if ip_obj.get("address") in ip_filters:
                        matching_ifaces.append(
                            {"id": iface["id"], "name": iface["name"]}
                        )
                        break
            devices.append(
                {
                    "id": dev["id"],
                    "name": dev["name"],
                    "interfaces": matching_ifaces,
                }
            )
        return {"data": {"devices": devices}}

    # ── REST dispatch ───────────────────────────────────────────────────────────

    def _dispatch_rest(
        self,
        resource: str,
        resource_id: str | None,
        method: str,
        params: dict,
        data: dict | list,
    ) -> dict:
        handlers = {
            "dcim/devices": (self._device_list, self._device_detail),
            "dcim/interfaces": (self._interface_list, self._interface_detail),
            "ipam/ip-addresses": (self._ip_list, self._ip_detail),
            "ipam/ip-address-to-interface": (self._ip_iface_assoc_list, None),
            "ipam/prefixes": (self._prefix_list, self._prefix_detail),
            "dcim/virtual-chassis": (self._vc_list, self._vc_detail),
        }

        if resource in handlers:
            list_fn, detail_fn = handlers[resource]
            if resource_id and detail_fn:
                return detail_fn(resource_id, method, data)
            return list_fn(method, params, data)

        # Metadata-only (GET) endpoints
        if resource == "extras/statuses":
            return self._status_list(params)
        if resource == "dcim/racks":
            return self._count_list_response([])
        if resource == "dcim/device-types":
            return self._device_type_endpoint(resource_id, params)
        if resource == "dcim/platforms":
            return self._platform_endpoint(resource_id, params)
        if resource == "extras/roles":
            return self._count_list_response(
                [
                    {"id": v["id"], "name": v["name"]}
                    for v in self._roles.values()
                    if not params.get("id") or v["id"] == params["id"]
                ]
            )
        if resource == "dcim/locations":
            return self._count_list_response(
                [
                    {"id": v["id"], "name": v["name"]}
                    for v in self._locations.values()
                    if not params.get("id") or v["id"] == params["id"]
                ]
            )

        logger.warning(
            "FakeNautobotService: unhandled REST %s /%s params=%s",
            method,
            resource,
            params,
        )
        return {"count": 0, "results": []}

    # ── Device handlers ─────────────────────────────────────────────────────────

    def _device_list(self, method: str, params: dict, data: dict) -> dict:
        if method == "POST":
            new_id = _new_uuid()
            device = {"id": new_id, **data}
            self._devices[new_id] = device
            return device

        results = list(self._devices.values())
        if params.get("name"):
            results = [d for d in results if d.get("name") == params["name"]]
        if params.get("virtual_chassis"):
            results = [
                d
                for d in results
                if (d.get("virtual_chassis") or {}).get("id")
                == params["virtual_chassis"]
            ]
        limit = int(params.get("limit", 200))
        return self._count_list_response(results[:limit])

    def _device_detail(self, device_id: str, method: str, data: dict) -> dict:
        if method == "DELETE":
            self._devices.pop(device_id, None)
            return {"status": "success", "message": "Resource deleted successfully"}
        device = self._devices.get(device_id)
        if method == "PATCH":
            if device is None:
                raise NautobotNotFoundError(f"Device {device_id} not found")
            device.update(data)
            return device
        if device is None:
            raise NautobotNotFoundError(f"Device {device_id} not found")
        return device

    # ── Interface handlers ──────────────────────────────────────────────────────

    def _interface_list(self, method: str, params: dict, data: dict) -> dict:
        if method == "POST":
            new_id = _new_uuid()
            iface = {
                "id": new_id,
                "device_id": data.get("device"),
                "ip_addresses": [],
                **data,
            }
            self._interfaces[new_id] = iface
            return iface

        results = list(self._interfaces.values())
        if params.get("device_id"):
            results = [i for i in results if i.get("device_id") == params["device_id"]]
        if params.get("name"):
            results = [i for i in results if i.get("name") == params["name"]]
        return self._count_list_response(results)

    def _interface_detail(self, iface_id: str, method: str, data: dict) -> dict:
        if method == "DELETE":
            self._interfaces.pop(iface_id, None)
            return {"status": "success", "message": "Resource deleted successfully"}
        iface = self._interfaces.get(iface_id)
        if method == "PATCH":
            if iface:
                iface.update(data)
            return iface or {}
        if iface is None:
            raise NautobotNotFoundError(f"Interface {iface_id} not found")
        return iface

    # ── IP address handlers ─────────────────────────────────────────────────────

    def _ip_list(self, method: str, params: dict, data: dict) -> dict:
        if method == "POST":
            new_id = _new_uuid()
            ip = {
                "id": new_id,
                "address": data.get("address", ""),
                "namespace_id": data.get("namespace"),
                **data,
            }
            self._ip_addresses[new_id] = ip
            return ip

        results = list(self._ip_addresses.values())
        if params.get("address"):
            target = params["address"]
            host = target.split("/")[0]
            results = [
                ip
                for ip in results
                if ip.get("address") == target
                or ip.get("address", "").split("/")[0] == host
            ]
        if params.get("namespace"):
            ns = params["namespace"]
            results = [
                ip
                for ip in results
                if ip.get("namespace_id") == ns or ip.get("namespace") == ns
            ]
        return self._count_list_response(results)

    def _ip_detail(self, ip_id: str, method: str, data: dict) -> dict:
        if method == "DELETE":
            self._ip_addresses.pop(ip_id, None)
            return {"status": "success", "message": "Resource deleted successfully"}
        ip = self._ip_addresses.get(ip_id)
        if method == "PATCH":
            if ip:
                ip.update(data)
            return ip or {}
        if ip is None:
            raise NautobotNotFoundError(f"IP address {ip_id} not found")
        return ip

    # ── IP-to-Interface association handlers ────────────────────────────────────

    def _ip_iface_assoc_list(self, method: str, params: dict, data: dict) -> dict:
        if method == "POST":
            new_id = _new_uuid()
            assoc = {"id": new_id, **data}
            self._ip_iface_assocs[new_id] = assoc
            return assoc

        results = list(self._ip_iface_assocs.values())
        if params.get("ip_address"):
            results = [
                a for a in results if a.get("ip_address") == params["ip_address"]
            ]
        if params.get("interface"):
            results = [a for a in results if a.get("interface") == params["interface"]]
        return self._count_list_response(results)

    # ── Prefix handlers ─────────────────────────────────────────────────────────

    def _prefix_list(self, method: str, params: dict, data: dict) -> dict:
        if method == "POST":
            new_id = _new_uuid()
            prefix = {"id": new_id, **data}
            self._prefixes[new_id] = prefix
            return prefix

        results = list(self._prefixes.values())
        if params.get("prefix"):
            results = [p for p in results if p.get("prefix") == params["prefix"]]
        if params.get("namespace"):
            results = [p for p in results if p.get("namespace") == params["namespace"]]
        return self._count_list_response(results)

    def _prefix_detail(self, prefix_id: str, method: str, data: dict) -> dict:
        p = self._prefixes.get(prefix_id)
        if p is None:
            raise NautobotNotFoundError(f"Prefix {prefix_id} not found")
        return p

    # ── Virtual chassis handlers ────────────────────────────────────────────────

    def _vc_list(self, method: str, params: dict, data: dict) -> dict:
        if method == "POST":
            new_id = _new_uuid()
            vc = {"id": new_id, **data}
            self._virtual_chassis[new_id] = vc
            return vc
        return self._count_list_response(list(self._virtual_chassis.values()))

    def _vc_detail(self, vc_id: str, method: str, data: dict) -> dict:
        if method == "DELETE":
            self._virtual_chassis.pop(vc_id, None)
            return {"status": "success", "message": "Resource deleted successfully"}
        vc = self._virtual_chassis.get(vc_id)
        if method == "PATCH":
            if vc:
                vc.update(data)
            return vc or {}
        return vc or {}

    # ── Metadata handlers ───────────────────────────────────────────────────────

    def _status_list(self, params: dict) -> dict:
        results = [{"id": v["id"], "name": v["name"]} for v in self._statuses.values()]
        if params.get("id"):
            results = [r for r in results if r["id"] == params["id"]]
        return self._count_list_response(results)

    def _device_type_endpoint(self, resource_id: str | None, params: dict) -> dict:
        if resource_id:
            dt = next(
                (v for v in self._device_types.values() if v["id"] == resource_id), None
            )
            if dt is None:
                raise NautobotNotFoundError(f"Device type {resource_id} not found")
            return dict(dt)
        results = [
            {"id": v["id"], "model": v["model"]}
            for v in self._device_types.values()
            if not params.get("id") or v["id"] == params["id"]
        ]
        return self._count_list_response(results)

    def _platform_endpoint(self, resource_id: str | None, params: dict) -> dict:
        if resource_id:
            p = next(
                (v for v in self._platforms.values() if v["id"] == resource_id), None
            )
            if p is None:
                raise NautobotNotFoundError(f"Platform {resource_id} not found")
            return dict(p)
        results = [
            {"id": v["id"], "name": v["name"]}
            for v in self._platforms.values()
            if not params.get("id") or v["id"] == params["id"]
        ]
        return self._count_list_response(results)

    # ── Helpers ─────────────────────────────────────────────────────────────────

    @staticmethod
    def _count_list_response(results: list) -> dict:
        return {"count": len(results), "results": results}

    def _raise_simulated_error(self, error_type: str, endpoint: str) -> None:
        if error_type == "duplicate":
            raise NautobotAPIError(
                f"A device with this name already exists (simulated duplicate at {endpoint})"
            )
        if error_type == "not_found":
            raise NautobotNotFoundError(f"Resource not found: {endpoint}")
        if error_type == "missing_prefix":
            raise NautobotAPIError(
                "No suitable parent Prefix exists in namespace (simulated)"
            )
        if error_type == "duplicate_netmask":
            raise NautobotAPIError(
                "IP address with this Parent and Host already exists (simulated)"
            )
        raise NautobotAPIError(f"Simulated error '{error_type}' for {endpoint}")
