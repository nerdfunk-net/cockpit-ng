"""
Inventory filter trees for baseline integration tests and manifest generation.

Keys match test method names in test_inventory_baseline.py (without the test_ prefix
where applicable, or full suffix after test_).
"""

from __future__ import annotations

from typing import Any, Dict

Tree = Dict[str, Any]

BASELINE_FILTER_TREES: Dict[str, Tree] = {
    "filter_by_location_city_a": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "1",
                "field": "location",
                "operator": "equals",
                "value": "City A",
            }
        ],
    },
    "filter_by_role_network": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {"id": "1", "field": "role", "operator": "equals", "value": "Network"}
        ],
    },
    "filter_by_role_server": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {"id": "1", "field": "role", "operator": "equals", "value": "server"}
        ],
    },
    "filter_by_platform_cisco_ios": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "1",
                "field": "platform",
                "operator": "equals",
                "value": "Cisco IOS",
            }
        ],
    },
    "filter_by_tag_production": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {"id": "1", "field": "tag", "operator": "equals", "value": "Production"}
        ],
    },
    "filter_by_tag_staging": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {"id": "1", "field": "tag", "operator": "equals", "value": "Staging"}
        ],
    },
    "filter_by_tag_lab": {
        "type": "root",
        "internalLogic": "AND",
        "items": [{"id": "1", "field": "tag", "operator": "equals", "value": "lab"}],
    },
    "filter_by_status_active": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {"id": "1", "field": "status", "operator": "equals", "value": "Active"}
        ],
    },
    "filter_by_status_offline": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {"id": "1", "field": "status", "operator": "equals", "value": "Offline"}
        ],
    },
    "filter_by_location_state_a": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "1",
                "field": "location",
                "operator": "equals",
                "value": "State A",
            }
        ],
    },
    "filter_multiple_conditions_and": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "1",
                "field": "location",
                "operator": "equals",
                "value": "City A",
            },
            {"id": "2", "field": "tag", "operator": "equals", "value": "Production"},
            {"id": "3", "field": "status", "operator": "equals", "value": "Active"},
        ],
    },
    "filter_location_and_role": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "1",
                "field": "location",
                "operator": "equals",
                "value": "City A",
            },
            {"id": "2", "field": "role", "operator": "equals", "value": "Network"},
        ],
    },
    "filter_multiple_operations_or": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "group-1",
                "type": "group",
                "internalLogic": "OR",
                "items": [
                    {
                        "id": "1",
                        "field": "location",
                        "operator": "equals",
                        "value": "City A",
                    },
                    {
                        "id": "2",
                        "field": "location",
                        "operator": "equals",
                        "value": "City B",
                    },
                ],
            }
        ],
    },
    "filter_three_locations_or": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "group-1",
                "type": "group",
                "internalLogic": "OR",
                "items": [
                    {
                        "id": "1",
                        "field": "location",
                        "operator": "equals",
                        "value": "City A",
                    },
                    {
                        "id": "2",
                        "field": "location",
                        "operator": "equals",
                        "value": "City B",
                    },
                    {
                        "id": "3",
                        "field": "location",
                        "operator": "equals",
                        "value": "City C",
                    },
                ],
            }
        ],
    },
    "filter_complex_or_logic": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "group-1",
                "type": "group",
                "internalLogic": "OR",
                "items": [
                    {
                        "id": "group-2",
                        "type": "group",
                        "internalLogic": "AND",
                        "items": [
                            {
                                "id": "1",
                                "field": "tag",
                                "operator": "equals",
                                "value": "Production",
                            },
                            {
                                "id": "2",
                                "field": "status",
                                "operator": "equals",
                                "value": "Active",
                            },
                        ],
                    },
                    {
                        "id": "group-3",
                        "type": "group",
                        "internalLogic": "AND",
                        "items": [
                            {
                                "id": "3",
                                "field": "tag",
                                "operator": "equals",
                                "value": "Staging",
                            },
                            {
                                "id": "4",
                                "field": "status",
                                "operator": "equals",
                                "value": "Offline",
                            },
                        ],
                    },
                ],
            }
        ],
    },
    "filter_not_equals_operator": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "1",
                "field": "location",
                "operator": "not_equals",
                "value": "City A",
            }
        ],
    },
    "filter_using_equals_and_not_equals_operator": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "1",
                "field": "location",
                "operator": "equals",
                "value": "State A",
            },
            {
                "id": "2",
                "field": "location",
                "operator": "not_equals",
                "value": "Another City A",
            },
        ],
    },
    "filter_contains_operator": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {"id": "1", "field": "name", "operator": "contains", "value": "lab-0"}
        ],
    },
    "filter_not_contains_operator": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "1",
                "field": "name",
                "operator": "not_contains",
                "value": "server",
            }
        ],
    },
    "filter_tag_not_equals_operator": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "1",
                "field": "location",
                "operator": "equals",
                "value": "City A",
            },
            {"id": "2", "field": "tag", "operator": "not_equals", "value": "Staging"},
        ],
    },
    "not_operator_simple": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "group-1",
                "type": "group",
                "internalLogic": "AND",
                "items": [
                    {
                        "id": "1",
                        "field": "location",
                        "operator": "equals",
                        "value": "State A",
                    },
                    {
                        "id": "group-2",
                        "type": "group",
                        "logic": "NOT",
                        "internalLogic": "AND",
                        "items": [
                            {
                                "id": "2",
                                "field": "location",
                                "operator": "equals",
                                "value": "City A",
                            }
                        ],
                    },
                ],
            }
        ],
    },
    "not_operator_multiple_exclusions": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "group-1",
                "type": "group",
                "internalLogic": "AND",
                "items": [
                    {
                        "id": "1",
                        "field": "location",
                        "operator": "equals",
                        "value": "State A",
                    },
                    {
                        "id": "group-2",
                        "type": "group",
                        "logic": "NOT",
                        "internalLogic": "OR",
                        "items": [
                            {
                                "id": "2",
                                "field": "location",
                                "operator": "equals",
                                "value": "City A",
                            },
                            {
                                "id": "3",
                                "field": "location",
                                "operator": "equals",
                                "value": "Another City A",
                            },
                        ],
                    },
                ],
            }
        ],
    },
    "not_operator_with_tag": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "group-1",
                "type": "group",
                "internalLogic": "AND",
                "items": [
                    {
                        "id": "1",
                        "field": "location",
                        "operator": "equals",
                        "value": "State A",
                    },
                    {
                        "id": "group-2",
                        "type": "group",
                        "logic": "NOT",
                        "internalLogic": "AND",
                        "items": [
                            {
                                "id": "2",
                                "field": "tag",
                                "operator": "equals",
                                "value": "Production",
                            }
                        ],
                    },
                ],
            }
        ],
    },
    "not_operator_complex": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "group-1",
                "type": "group",
                "internalLogic": "AND",
                "items": [
                    {
                        "id": "1",
                        "field": "location",
                        "operator": "equals",
                        "value": "State A",
                    },
                    {
                        "id": "2",
                        "field": "status",
                        "operator": "equals",
                        "value": "Active",
                    },
                    {
                        "id": "group-2",
                        "type": "group",
                        "logic": "NOT",
                        "internalLogic": "AND",
                        "items": [
                            {
                                "id": "3",
                                "field": "location",
                                "operator": "equals",
                                "value": "City A",
                            }
                        ],
                    },
                ],
            }
        ],
    },
    "location_not_equals_operator": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "1",
                "field": "location",
                "operator": "not_equals",
                "value": "City A",
            }
        ],
    },
    "complex_nested_not_with_role_and_status": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "group-1",
                "type": "group",
                "internalLogic": "AND",
                "items": [
                    {
                        "id": "1",
                        "field": "location",
                        "operator": "equals",
                        "value": "State A",
                    },
                    {
                        "id": "group-2",
                        "type": "group",
                        "logic": "NOT",
                        "internalLogic": "AND",
                        "items": [
                            {
                                "id": "2",
                                "field": "location",
                                "operator": "equals",
                                "value": "Another City A",
                            }
                        ],
                    },
                ],
            },
            {"id": "3", "field": "role", "operator": "equals", "value": "Network"},
            {"id": "4", "field": "status", "operator": "equals", "value": "Active"},
        ],
    },
    "not_equals_operator_with_role_and_status": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "1",
                "field": "location",
                "operator": "equals",
                "value": "State A",
            },
            {
                "id": "2",
                "field": "location",
                "operator": "not_equals",
                "value": "Another City A",
            },
            {"id": "3", "field": "role", "operator": "equals", "value": "Network"},
            {"id": "4", "field": "status", "operator": "equals", "value": "Active"},
        ],
    },
    "filter_by_custom_field_net": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "1",
                "field": "custom_fields.net",
                "operator": "equals",
                "value": "netA",
            }
        ],
    },
    "filter_by_custom_field_checkmk_site": {
        "type": "root",
        "internalLogic": "AND",
        "items": [
            {
                "id": "1",
                "field": "custom_fields.checkmk_site",
                "operator": "equals",
                "value": "siteA",
            }
        ],
    },
    "empty_filter_returns_all": {
        "type": "root",
        "internalLogic": "AND",
        "items": [],
    },
}
