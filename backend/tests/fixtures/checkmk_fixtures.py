"""
Centralized CheckMK test data and response fixtures.

This module provides reusable test data for CheckMK REST API responses.
All fixtures follow the actual CheckMK API response structure.
"""

from typing import Dict, Any, List

# =============================================================================
# Host Response Fixtures (REAL CheckMK API Format)
# =============================================================================

# Real CheckMK API response captured from production (2026-01-03)
# This is the actual structure returned by CheckMK REST API v1.0
CHECKMK_HOST_REAL_API_RESPONSE: Dict[str, Any] = {
    "links": [
        {
            "domainType": "link",
            "rel": "self",
            "href": "http://100.112.59.23:8080/cmk/check_mk/api/1.0/objects/host_config/LAB",
            "method": "GET",
            "type": "application/json",
        },
        {
            "domainType": "link",
            "rel": "urn:org.restfulobjects:rels/update",
            "href": "http://100.112.59.23:8080/cmk/check_mk/api/1.0/objects/host_config/LAB",
            "method": "PUT",
            "type": "application/json",
        },
        {
            "domainType": "link",
            "rel": "urn:org.restfulobjects:rels/delete",
            "href": "http://100.112.59.23:8080/cmk/check_mk/api/1.0/objects/host_config/LAB",
            "method": "DELETE",
            "type": "application/json",
        },
        {
            "domainType": "link",
            "rel": "urn:com.checkmk:rels/folder_config",
            "href": "http://100.112.59.23:8080/cmk/check_mk/api/1.0/objects/folder_config/~network~Berlin",
            "method": "GET",
            "type": "application/json",
            "title": "The folder config of the host.",
        },
    ],
    "domainType": "host_config",
    "id": "LAB",
    "title": "LAB",
    "members": {},
    "extensions": {
        "folder": "/network/Berlin",
        "attributes": {
            "alias": "LAB",
            "site": "cmk",
            "ipaddress": "192.168.178.240",
            "tag_agent": "no-agent",
            "tag_snmp_ds": "snmp-v2",
            "snmp_community": {"type": "v1_v2_community", "community": "snmpcommunity"},
            "tag_status": "Active",
            "location": "Berlin",
            "city": "Deutschland",
            "meta_data": {
                "created_at": "2026-01-02T18:31:05.248559+00:00",
                "updated_at": "2026-01-03T17:34:39.400683+00:00",
                "created_by": "automation",
            },
        },
        "effective_attributes": None,
        "is_cluster": False,
        "is_offline": False,
        "cluster_nodes": None,
    },
}

# Simplified host response (legacy format for backward compatibility)
CHECKMK_HOST_STANDARD: Dict[str, Any] = {
    "hostname": "test-switch-01",
    "folder": "/dc1/access",
    "attributes": {
        "ipaddress": "10.0.0.1",
        "site": "main",
        "tag_agent": "no-agent",
        "tag_criticality": "prod",
        "tag_networking": "lan",
        "alias": "Test Switch 01",
    },
}

CHECKMK_HOST_WITH_LABELS: Dict[str, Any] = {
    "hostname": "prod-switch-01",
    "folder": "/production/dc1",
    "attributes": {
        "ipaddress": "10.1.0.1",
        "site": "prod-site",
        "tag_agent": "no-agent",
        "tag_criticality": "prod",
        "labels": {
            "environment": "production",
            "location": "dc1",
            "managed_by": "nautobot",
        },
        "alias": "Production Switch 01",
    },
}

# Host list response
CHECKMK_HOSTS_LIST: Dict[str, Dict[str, Any]] = {
    "test-switch-01": {
        "folder": "/dc1/access",
        "attributes": {"ipaddress": "10.0.0.1", "site": "main"},
    },
    "test-switch-02": {
        "folder": "/dc1/access",
        "attributes": {"ipaddress": "10.0.0.2", "site": "main"},
    },
    "test-router-01": {
        "folder": "/dc1/core",
        "attributes": {"ipaddress": "10.0.1.1", "site": "main"},
    },
}

# =============================================================================
# Folder Response Fixtures
# =============================================================================

CHECKMK_FOLDER_STANDARD: Dict[str, Any] = {
    "title": "DC1 Access Switches",
    "path": "/dc1/access",
    "attributes": {"tag_criticality": "prod"},
    "parent": "/dc1",
}

CHECKMK_FOLDERS_LIST: List[Dict[str, Any]] = [
    {"title": "DC1", "path": "/dc1", "attributes": {}, "parent": "/"},
    {"title": "Access", "path": "/dc1/access", "attributes": {}, "parent": "/dc1"},
    {"title": "Core", "path": "/dc1/core", "attributes": {}, "parent": "/dc1"},
]

# =============================================================================
# API Success Response Fixtures
# =============================================================================

CHECKMK_ADD_HOST_SUCCESS: Dict[str, Any] = {
    "result": "success",
    "result_code": 0,
    "extensions": {"hostname": "new-switch-01", "folder": "/dc1/access"},
}

CHECKMK_EDIT_HOST_SUCCESS: Dict[str, Any] = {
    "result": "success",
    "result_code": 0,
    "extensions": {"hostname": "test-switch-01", "changes": ["ipaddress", "alias"]},
}

CHECKMK_DELETE_HOST_SUCCESS: Dict[str, Any] = {
    "result": "success",
    "result_code": 0,
    "extensions": {"hostname": "test-switch-01"},
}

CHECKMK_ACTIVATE_CHANGES_SUCCESS: Dict[str, Any] = {
    "result": "success",
    "result_code": 0,
    "extensions": {"sites": ["main"], "activation_id": "activation-uuid-123"},
}

CHECKMK_DISCOVER_SERVICES_SUCCESS: Dict[str, Any] = {
    "result": "success",
    "result_code": 0,
    "extensions": {
        "hostname": "test-switch-01",
        "services_found": 5,
        "services_added": 3,
        "services_removed": 0,
    },
}

# =============================================================================
# Error Response Fixtures
# =============================================================================

CHECKMK_ERROR_HOST_EXISTS: Dict[str, Any] = {
    "result": "Host test-switch-01 already exists in folder /dc1",
    "result_code": 1,
}

CHECKMK_ERROR_HOST_NOT_FOUND: Dict[str, Any] = {
    "result": "Host test-switch-01 not found",
    "result_code": 1,
}

CHECKMK_ERROR_FOLDER_NOT_FOUND: Dict[str, Any] = {
    "result": "Folder /invalid/path not found",
    "result_code": 1,
}

CHECKMK_ERROR_INVALID_IP: Dict[str, Any] = {
    "result": "Invalid IP address: not-an-ip",
    "result_code": 1,
}

CHECKMK_ERROR_AUTHENTICATION: Dict[str, Any] = {
    "result": "Authentication failed",
    "result_code": 401,
}

# =============================================================================
# Service Discovery Response Fixtures
# =============================================================================

CHECKMK_SERVICES_DISCOVERED: Dict[str, Any] = {
    "result": {
        "check_table": [
            {
                "check_type": "if64",
                "item": "GigabitEthernet1/0/1",
                "parameters": {},
                "service_labels": {},
            },
            {
                "check_type": "if64",
                "item": "GigabitEthernet1/0/2",
                "parameters": {},
                "service_labels": {},
            },
            {
                "check_type": "cpu_util",
                "item": None,
                "parameters": {},
                "service_labels": {},
            },
        ]
    }
}

# =============================================================================
# Site Response Fixtures
# =============================================================================

CHECKMK_SITE_INFO: Dict[str, Any] = {
    "site_id": "main",
    "site_name": "Main Site",
    "site_config": {"status_host": {"status_host_set": "enabled", "site": "main"}},
}

CHECKMK_SITES_LIST: Dict[str, Dict[str, Any]] = {
    "main": {"site_id": "main", "alias": "Main Site"},
    "remote": {"site_id": "remote", "alias": "Remote Site"},
}

# =============================================================================
# Rule Response Fixtures
# =============================================================================

CHECKMK_RULE_STANDARD: Dict[str, Any] = {
    "ruleset": "host_groups",
    "folder": "/dc1",
    "rule_id": "rule-uuid-123",
    "value": "network-devices",
    "conditions": {"host_tags": ["tag_agent:no-agent"]},
}

# =============================================================================
# Sync Status Fixtures
# =============================================================================

CHECKMK_SYNC_STATUS_CLEAN: Dict[str, Any] = {
    "changes_pending": False,
    "number_of_pending_changes": 0,
}

CHECKMK_SYNC_STATUS_PENDING: Dict[str, Any] = {
    "changes_pending": True,
    "number_of_pending_changes": 5,
    "pending_changes": [
        {"id": "change-1", "action": "add-host", "text": "Added host test-switch-01"},
        {
            "id": "change-2",
            "action": "edit-host",
            "text": "Modified host test-switch-02",
        },
    ],
}

# =============================================================================
# Live Update / Monitoring Fixtures
# =============================================================================

CHECKMK_LIVE_UPDATE_STATUS: Dict[str, Any] = {
    "sync_id": "sync-uuid-123",
    "status": "running",
    "progress": 45,
    "total_devices": 100,
    "processed_devices": 45,
    "added": 10,
    "updated": 30,
    "removed": 2,
    "failed": 3,
    "errors": [{"hostname": "failed-device-01", "error": "Connection timeout"}],
}

CHECKMK_LIVE_UPDATE_COMPLETED: Dict[str, Any] = {
    "sync_id": "sync-uuid-123",
    "status": "completed",
    "progress": 100,
    "total_devices": 100,
    "processed_devices": 100,
    "added": 15,
    "updated": 80,
    "removed": 5,
    "failed": 0,
    "errors": [],
    "duration_seconds": 120,
}

# =============================================================================
# Helper Functions
# =============================================================================


def create_host_response(
    hostname: str = "test-device",
    ip_address: str = "10.0.0.1",
    folder: str = "/dc1",
    site: str = "main",
) -> Dict[str, Any]:
    """
    Factory function to create custom CheckMK host response.

    Args:
        hostname: Host name
        ip_address: IP address
        folder: CheckMK folder path
        site: Site name

    Returns:
        Host response dictionary
    """
    return {
        "hostname": hostname,
        "folder": folder,
        "attributes": {"ipaddress": ip_address, "site": site, "tag_agent": "no-agent"},
    }


def create_hosts_list(
    count: int = 3, folder: str = "/dc1"
) -> Dict[str, Dict[str, Any]]:
    """
    Create a list of CheckMK hosts for testing.

    Args:
        count: Number of hosts to create
        folder: Folder path for all hosts

    Returns:
        Dictionary of hosts
    """
    hosts = {}
    for i in range(1, count + 1):
        hostname = f"switch-{i:02d}"
        hosts[hostname] = {
            "folder": folder,
            "attributes": {"ipaddress": f"10.0.0.{i}", "site": "main"},
        }
    return hosts


def create_api_error(message: str, code: int = 1) -> Dict[str, Any]:
    """
    Create a CheckMK API error response.

    Args:
        message: Error message
        code: Error code

    Returns:
        Error response dictionary
    """
    return {"result": message, "result_code": code}


def create_sync_comparison(
    nautobot_count: int = 100,
    checkmk_count: int = 95,
    in_both: int = 90,
    only_nautobot: int = 10,
    only_checkmk: int = 5,
) -> Dict[str, Any]:
    """
    Create a sync comparison result for testing.

    Args:
        nautobot_count: Total devices in Nautobot
        checkmk_count: Total hosts in CheckMK
        in_both: Devices present in both systems
        only_nautobot: Devices only in Nautobot
        only_checkmk: Hosts only in CheckMK

    Returns:
        Comparison result dictionary
    """
    return {
        "total_nautobot": nautobot_count,
        "total_checkmk": checkmk_count,
        "in_both": in_both,
        "only_in_nautobot": only_nautobot,
        "only_in_checkmk": only_checkmk,
        "differences": [],
    }
