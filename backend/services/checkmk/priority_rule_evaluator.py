"""Evaluates CheckMK priority rules against Nautobot device data."""

from __future__ import annotations

import ipaddress
import logging
from typing import Any, Dict, List, Optional

from core.models.settings import CheckMKPriorityRule
from repositories.checkmk.priority_rules_repository import CheckMKPriorityRuleRepository

logger = logging.getLogger(__name__)


class PriorityRuleEvaluator:
    """Finds the first priority rule whose expression matches a device."""

    def __init__(self) -> None:
        self._repo = CheckMKPriorityRuleRepository()

    def find_matching_rule(
        self, device_data: Dict[str, Any]
    ) -> Optional[CheckMKPriorityRule]:
        """Return the first rule (lowest priority_order) that matches device_data.

        Returns None when no rule matches — callers should fall back to checkmk.yaml.
        """
        rules = self._repo.get_all_ordered()
        for rule in rules:
            try:
                expression = rule.expression or []
                if self._evaluate_expression(device_data, expression):
                    logger.info(
                        "Device '%s' matched priority rule id=%s filename='%s'",
                        device_data.get("name", "?"),
                        rule.id,
                        rule.filename,
                    )
                    return rule
            except Exception:
                logger.warning(
                    "Error evaluating rule id=%s for device '%s', skipping",
                    rule.id,
                    device_data.get("name", "?"),
                    exc_info=True,
                )
        return None

    def _evaluate_expression(
        self, device_data: Dict[str, Any], expression: List[Dict[str, Any]]
    ) -> bool:
        """Evaluate an alternating condition/connector expression left-to-right."""
        if not expression:
            return False

        result: Optional[bool] = None
        pending_operator: Optional[str] = None

        for item in expression:
            item_type = item.get("type")
            if item_type == "condition":
                cond_result = self._evaluate_condition(device_data, item)
                if result is None:
                    result = cond_result
                elif pending_operator == "and":
                    result = result and cond_result
                elif pending_operator == "or":
                    result = result or cond_result
                pending_operator = None
            elif item_type == "connector":
                pending_operator = item.get("operator")

        return bool(result)

    def _evaluate_condition(
        self, device_data: Dict[str, Any], condition: Dict[str, Any]
    ) -> bool:
        key = condition.get("key", "")
        value = condition.get("value", "")
        field = condition.get("field")

        try:
            # ip_prefix is a containment check, not a string equality check
            if key == "ip_prefix":
                return self._device_ip_in_prefix(device_data, value)

            # tag is a list-membership check against the device's tags
            if key == "tag":
                return self._device_has_tag(device_data, value)

            device_value = self._extract_device_value(device_data, key, field)
            return device_value.lower() == value.lower()
        except Exception:
            logger.debug(
                "Could not evaluate condition key='%s' value='%s' for device '%s'",
                key,
                value,
                device_data.get("name", "?"),
                exc_info=True,
            )
            return False

    def _extract_device_value(
        self, device_data: Dict[str, Any], key: str, field: Optional[str]
    ) -> str:
        if key == "role":
            role = device_data.get("role") or {}
            return (role.get("name") or "") if isinstance(role, dict) else str(role)

        if key == "status":
            status = device_data.get("status") or {}
            return (
                (status.get("name") or "") if isinstance(status, dict) else str(status)
            )

        if key == "location":
            location = device_data.get("location") or {}
            return (
                (location.get("name") or "")
                if isinstance(location, dict)
                else str(location)
            )

        if key == "platform":
            platform = device_data.get("platform") or {}
            return (
                (platform.get("name") or "")
                if isinstance(platform, dict)
                else str(platform)
            )

        if key == "manufacturer":
            device_type = device_data.get("device_type") or {}
            manufacturer = (
                device_type.get("manufacturer") or {}
                if isinstance(device_type, dict)
                else {}
            )
            return (
                (manufacturer.get("name") or "")
                if isinstance(manufacturer, dict)
                else str(manufacturer)
            )

        if key == "device_type":
            device_type = device_data.get("device_type") or {}
            return (
                (device_type.get("model") or "")
                if isinstance(device_type, dict)
                else str(device_type)
            )

        if key == "custom_field":
            if not field:
                return ""
            custom_fields = device_data.get("_custom_field_data") or {}
            val = custom_fields.get(field)
            return str(val) if val is not None else ""

        logger.warning("Unknown expression key '%s'", key)
        return ""

    def _device_ip_in_prefix(self, device_data: Dict[str, Any], cidr: str) -> bool:
        """Return True when the device's primary IP falls inside the given CIDR."""
        if not cidr:
            return False
        primary_ip4 = device_data.get("primary_ip4") or {}
        address = (
            primary_ip4.get("address") or "" if isinstance(primary_ip4, dict) else ""
        )
        if not address:
            return False
        ip_str = address.split("/")[0]
        try:
            return ipaddress.ip_address(ip_str) in ipaddress.ip_network(
                cidr, strict=False
            )
        except ValueError:
            logger.debug("ip_prefix evaluation error: ip=%s cidr=%s", ip_str, cidr)
            return False

    def _device_has_tag(self, device_data: Dict[str, Any], tag_name: str) -> bool:
        """Return True when any of the device's tags matches tag_name (case-insensitive)."""
        if not tag_name:
            return False
        tags = device_data.get("tags") or []
        if not isinstance(tags, list):
            return False
        target = tag_name.lower()
        return any(
            (t.get("name") or "").lower() == target for t in tags if isinstance(t, dict)
        )
