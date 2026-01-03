"""
SNMP mapping test fixtures for testing CheckMK device normalization and comparison.

This module provides test SNMP configuration data matching the format in config/snmp_mapping.yaml
"""

from typing import Dict, Any

# =============================================================================
# SNMP Mapping Configuration Fixtures
# =============================================================================

SNMP_MAPPING_V3_AUTH_PRIVACY: Dict[str, Any] = {
    "version": 3,
    "type": "v3_auth_privacy",
    "username": "noc",
    "group": "nocgroup",
    "auth_protocol_long": "SHA-2-256",
    "auth_protocol": "SHA-2-256",
    "auth_password": "snmppassword",
    "privacy_protocol_long": "AES-256",
    "privacy_protocol": "AES",
    "privacy_password": "snmppassword",
    "privacy_option": 256,
}

SNMP_MAPPING_V3_AUTH_NO_PRIVACY: Dict[str, Any] = {
    "version": 3,
    "type": "v3_auth_no_privacy",
    "username": "user2",
    "group": "group",
    "auth_protocol_long": "MD5-96",
    "auth_protocol": "MD5",
    "auth_password": "authpass2",
}

SNMP_MAPPING_V2_COMMUNITY: Dict[str, Any] = {
    "version": 2,
    "community": "snmpcommunity",
}

SNMP_MAPPING_V1_COMMUNITY: Dict[str, Any] = {
    "version": 1,
    "community": "public",
}

# Complete SNMP mapping configuration (like snmp_mapping.yaml)
SNMP_MAPPING_CONFIG: Dict[str, Dict[str, Any]] = {
    "snmp-id-1": SNMP_MAPPING_V3_AUTH_PRIVACY,
    "snmp-id-2": SNMP_MAPPING_V3_AUTH_NO_PRIVACY,
    "snmp-id-3": SNMP_MAPPING_V2_COMMUNITY,
    "snmp-id-4": SNMP_MAPPING_V1_COMMUNITY,
}

# =============================================================================
# Expected Normalized SNMP Attributes for CheckMK
# =============================================================================

NORMALIZED_SNMP_V3_AUTH_PRIVACY: Dict[str, Any] = {
    "type": "v3_auth_privacy",
    "auth_protocol": "SHA-2-256",
    "security_name": "noc",
    "auth_password": "snmppassword",
    "privacy_protocol": "AES-256",
    "privacy_password": "snmppassword",
}

NORMALIZED_SNMP_V3_AUTH_NO_PRIVACY: Dict[str, Any] = {
    "type": "v3_auth_no_privacy",
    "auth_protocol": "MD5-96",
    "security_name": "user2",
    "auth_password": "authpass2",
    # Note: privacy_protocol and privacy_password should NOT be present
}

NORMALIZED_SNMP_V2_COMMUNITY: Dict[str, Any] = {
    "type": "v1_v2_community",
    "community": "snmpcommunity",
}

NORMALIZED_SNMP_V1_COMMUNITY: Dict[str, Any] = {
    "type": "v1_v2_community",
    "community": "public",
}

# =============================================================================
# Test Device Fixtures with SNMP Credentials
# =============================================================================

NAUTOBOT_DEVICE_WITH_SNMP_V3: Dict[str, Any] = {
    "id": "device-uuid-snmp-v3",
    "name": "test-switch-snmp-v3",
    "primary_ip4": {"address": "10.0.0.10/24"},
    "location": {"name": "DC1", "parent": None},
    "role": {"name": "Access Switch"},
    "platform": {"name": "Cisco IOS"},
    "status": {"name": "Active"},
    "_custom_field_data": {
        "snmp_credentials": "snmp-id-1"  # References SNMPv3 with auth+privacy
    },
    "tags": [],
}

NAUTOBOT_DEVICE_WITH_SNMP_V2: Dict[str, Any] = {
    "id": "device-uuid-snmp-v2",
    "name": "test-switch-snmp-v2",
    "primary_ip4": {"address": "10.0.0.20/24"},
    "location": {"name": "DC1", "parent": None},
    "role": {"name": "Access Switch"},
    "platform": {"name": "Cisco IOS"},
    "status": {"name": "Active"},
    "_custom_field_data": {
        "snmp_credentials": "snmp-id-3"  # References SNMPv2c community-based
    },
    "tags": [],
}

NAUTOBOT_DEVICE_WITHOUT_SNMP: Dict[str, Any] = {
    "id": "device-uuid-no-snmp",
    "name": "test-switch-no-snmp",
    "primary_ip4": {"address": "10.0.0.30/24"},
    "location": {"name": "DC1", "parent": None},
    "role": {"name": "Access Switch"},
    "platform": {"name": "Cisco IOS"},
    "status": {"name": "Active"},
    "_custom_field_data": {},  # No SNMP credentials
    "tags": [],
}

# =============================================================================
# CheckMK Host Responses with SNMP Configurations (REAL API Format)
# =============================================================================

# Real CheckMK API response with SNMPv2c (captured from production 2026-01-03)
CHECKMK_HOST_WITH_SNMP_V2_REAL: Dict[str, Any] = {
    "links": [
        {
            "domainType": "link",
            "rel": "self",
            "href": "http://100.112.59.23:8080/cmk/check_mk/api/1.0/objects/host_config/LAB",
            "method": "GET",
            "type": "application/json",
        }
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

# Simplified responses for easier testing (legacy format)
CHECKMK_HOST_WITH_SNMP_V3_RESPONSE: Dict[str, Any] = {
    "id": "host-1",
    "title": "test-switch-snmp-v3",
    "extensions": {
        "folder": "/dc1",
        "attributes": {
            "ipaddress": "10.0.0.10",
            "site": "main",
            "tag_agent": "no-agent",
            "tag_snmp_ds": "snmp-v2",
            "snmp_community": {
                "type": "v3_auth_privacy",
                "auth_protocol": "SHA-2-256",
                "security_name": "noc",
                "auth_password": "snmppassword",
                "privacy_protocol": "AES-256",
                "privacy_password": "snmppassword",
            },
        },
    },
}

CHECKMK_HOST_WITH_SNMP_V2_RESPONSE: Dict[str, Any] = {
    "id": "host-2",
    "title": "test-switch-snmp-v2",
    "extensions": {
        "folder": "/dc1",
        "attributes": {
            "ipaddress": "10.0.0.20",
            "site": "main",
            "tag_agent": "no-agent",
            "tag_snmp_ds": "snmp-v2",
            "snmp_community": {
                "type": "v1_v2_community",
                "community": "snmpcommunity",
            },
        },
    },
}

# =============================================================================
# Normalized Nautobot Config (Real captured from production 2026-01-03)
# =============================================================================

NAUTOBOT_NORMALIZED_CONFIG_REAL: Dict[str, Any] = {
    "folder": "/network/Berlin",
    "attributes": {
        "site": "cmk",
        "ipaddress": "192.168.178.240",
        "snmp_community": {"type": "v1_v2_community", "community": "snmpcommunity"},
        "tag_snmp_ds": "snmp-v2",
        "tag_agent": "no-agent",
        "tag_status": "Active",
        "alias": "LAB",
        "location": "Berlin",
        "city": "Deutschland",
    },
    "internal": {
        "hostname": "LAB",
        "role": "Network",
        "status": "Active",
        "location": "Berlin",
    },
}

# =============================================================================
# Helper Functions
# =============================================================================


def create_snmp_mapping_config(
    snmp_id: str, version: int, community: str = None, username: str = None
) -> Dict[str, Any]:
    """
    Create a custom SNMP mapping configuration for testing.

    Args:
        snmp_id: SNMP credentials identifier
        version: SNMP version (1, 2, or 3)
        community: Community string for v1/v2c
        username: Username for v3

    Returns:
        SNMP mapping configuration dict
    """
    if version in [1, 2]:
        return {snmp_id: {"version": version, "community": community or "public"}}
    elif version == 3:
        return {
            snmp_id: {
                "version": 3,
                "type": "v3_auth_privacy",
                "username": username or "test_user",
                "group": "test_group",
                "auth_protocol_long": "SHA-2-256",
                "auth_protocol": "SHA-2-256",
                "auth_password": "test_auth_pass",
                "privacy_protocol_long": "AES-256",
                "privacy_protocol": "AES",
                "privacy_password": "test_priv_pass",
                "privacy_option": 256,
            }
        }
    else:
        raise ValueError(f"Unsupported SNMP version: {version}")


def create_device_with_snmp(
    device_id: str,
    hostname: str,
    ip_address: str,
    snmp_credentials_id: str,
) -> Dict[str, Any]:
    """
    Create a Nautobot device fixture with SNMP credentials.

    Args:
        device_id: Device UUID
        hostname: Device hostname
        ip_address: IP address (with /mask)
        snmp_credentials_id: SNMP credentials ID from snmp_mapping

    Returns:
        Nautobot device data dict
    """
    return {
        "id": device_id,
        "name": hostname,
        "primary_ip4": {"address": ip_address},
        "location": {"name": "DC1", "parent": None},
        "role": {"name": "Network Device"},
        "platform": {"name": "Generic"},
        "status": {"name": "Active"},
        "_custom_field_data": {"snmp_credentials": snmp_credentials_id},
        "tags": [],
    }
