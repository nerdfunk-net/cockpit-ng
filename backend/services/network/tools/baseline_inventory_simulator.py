"""
In-memory inventory filter simulation against baseline YAML device records.

Used by expect_inventory_counts.py and baseline manifest generation (no Nautobot).
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from models.inventory import LogicalCondition, LogicalOperation
from utils.inventory_converter import tree_to_operations


@dataclass
class SimulatedDevice:
    """Minimal device record for baseline filter simulation."""

    id: str
    name: str
    location: str
    role: str
    status: str
    tags: List[str]
    platform: str
    device_type: str
    custom_fields: Dict[str, Any] = field(default_factory=dict)


def build_state_to_cities(locations: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    """Map state names to child city names from baseline location YAML."""
    state_to_cities: Dict[str, List[str]] = defaultdict(list)
    for loc in locations:
        if loc.get("location_types") == "City" and loc.get("parent"):
            state_to_cities[loc["parent"]].append(loc["name"])
    return dict(state_to_cities)


def devices_from_baseline_yaml(data: Dict[str, Any]) -> List[SimulatedDevice]:
    """Parse baseline YAML devices into simulated inventory records."""
    devices: List[SimulatedDevice] = []
    for entry in data.get("devices", []):
        roles = entry.get("roles") or []
        role = roles[0] if roles else entry.get("role", "")
        tags = entry.get("tags") or []
        if isinstance(tags, str):
            tags = [tags]
        devices.append(
            SimulatedDevice(
                id=entry["name"],
                name=entry["name"],
                location=entry.get("location", ""),
                role=role,
                status=entry.get("status", "Active"),
                tags=list(tags),
                platform=entry.get("platform", ""),
                device_type=entry.get("device_type", ""),
                custom_fields=dict(entry.get("custom_fields") or {}),
            )
        )
    return devices


class BaselineInventorySimulator:
    """Evaluate inventory filter trees against baseline device records."""

    def __init__(
        self,
        devices: List[SimulatedDevice],
        state_to_cities: Optional[Dict[str, List[str]]] = None,
    ) -> None:
        self._devices = devices
        self._by_id = {d.id: d for d in devices}
        self._state_to_cities = state_to_cities or {}

    @classmethod
    def from_yaml(cls, data: Dict[str, Any]) -> BaselineInventorySimulator:
        return cls(
            devices_from_baseline_yaml(data),
            build_state_to_cities(data.get("location", [])),
        )

    def count_for_tree(self, tree: Dict[str, Any]) -> int:
        operations = tree_to_operations(tree)
        return len(self.preview(operations))

    def preview(self, operations: List[LogicalOperation]) -> List[SimulatedDevice]:
        if not operations:
            return list(self._devices)

        result_ids: Set[str] = set()
        for index, operation in enumerate(operations):
            op_ids = self._execute_operation(operation)
            op_type = operation.operation_type.upper()
            if not result_ids:
                result_ids = set() if op_type == "NOT" else op_ids
            elif op_type == "NOT":
                result_ids = result_ids.difference(op_ids)
            else:
                result_ids = result_ids.intersection(op_ids)

        return [self._by_id[device_id] for device_id in result_ids if device_id in self._by_id]

    def _execute_operation(self, operation: LogicalOperation) -> Set[str]:
        condition_results: List[Set[str]] = []
        not_results: List[Set[str]] = []

        for condition in operation.conditions:
            condition_results.append(self._execute_condition(condition))

        for nested in operation.nested_operations:
            nested_ids = self._execute_operation(nested)
            if nested.operation_type.upper() == "NOT":
                not_results.append(nested_ids)
            else:
                condition_results.append(nested_ids)

        op_type = operation.operation_type.upper()
        if op_type == "AND":
            result = self._intersect(condition_results)
        elif op_type == "OR":
            result = self._union(condition_results)
        elif op_type == "NOT":
            result = self._union(condition_results)
        else:
            result = set()

        for not_set in not_results:
            result = result.difference(not_set)
        return result

    def _intersect(self, sets: List[Set[str]]) -> Set[str]:
        if not sets:
            return set()
        result = sets[0].copy()
        for other in sets[1:]:
            result &= other
        return result

    def _union(self, sets: List[Set[str]]) -> Set[str]:
        result: Set[str] = set()
        for item in sets:
            result |= item
        return result

    def _execute_condition(self, condition: LogicalCondition) -> Set[str]:
        field_name = condition.field
        operator = condition.operator
        value = condition.value

        if not field_name or value is None or value == "":
            return set()

        if field_name.startswith("custom_fields."):
            cf_key = field_name.split(".", 1)[1]
            return self._filter_custom_field(cf_key, value, operator)

        matchers = {
            "name": self._match_name,
            "location": self._match_location,
            "role": self._match_role,
            "status": self._match_status,
            "tag": self._match_tag,
            "platform": self._match_platform,
            "device_type": self._match_device_type,
        }
        matcher = matchers.get(field_name)
        if not matcher:
            return set()

        positive = matcher(value, operator)
        if operator in ("not_equals", "not_contains"):
            return {d.id for d in self._devices if d.id not in positive}
        return positive

    def _filter_custom_field(
        self, key: str, value: str, operator: str
    ) -> Set[str]:
        matched = {
            d.id
            for d in self._devices
            if str(d.custom_fields.get(key, "")) == value
        }
        if operator in ("not_equals", "not_contains"):
            return {d.id for d in self._devices if d.id not in matched}
        return matched

    def _match_name(self, value: str, operator: str) -> Set[str]:
        if operator == "contains":
            return {d.id for d in self._devices if value in d.name}
        if operator == "not_contains":
            return {d.id for d in self._devices if value in d.name}
        if operator == "equals":
            return {d.id for d in self._devices if d.name == value}
        return set()

    def _location_matches_equals(self, device: SimulatedDevice, value: str) -> bool:
        if device.location == value:
            return True
        cities = self._state_to_cities.get(value)
        if cities and device.location in cities:
            return True
        return False

    def _match_location(self, value: str, operator: str) -> Set[str]:
        if operator == "equals":
            return {
                d.id for d in self._devices if self._location_matches_equals(d, value)
            }
        if operator in ("not_equals", "not_contains"):
            return {
                d.id
                for d in self._devices
                if self._location_matches_equals(d, value)
            }
        return set()

    def _match_role(self, value: str, operator: str) -> Set[str]:
        if operator == "equals":
            return {d.id for d in self._devices if d.role == value}
        return set()

    def _match_status(self, value: str, operator: str) -> Set[str]:
        if operator == "equals":
            return {d.id for d in self._devices if d.status == value}
        return set()

    def _match_tag(self, value: str, operator: str) -> Set[str]:
        if operator == "equals":
            return {d.id for d in self._devices if value in d.tags}
        if operator in ("not_equals", "not_contains"):
            return {d.id for d in self._devices if value in d.tags}
        return set()

    def _match_platform(self, value: str, operator: str) -> Set[str]:
        if operator == "equals":
            return {d.id for d in self._devices if d.platform == value}
        return set()

    def _match_device_type(self, value: str, operator: str) -> Set[str]:
        if operator == "equals":
            return {d.id for d in self._devices if d.device_type == value}
        return set()
