"""
Centralized Nautobot test data and response fixtures.

This module provides reusable test data for Nautobot GraphQL and REST API responses.
All fixtures follow the actual Nautobot API response structure.
"""

from typing import Dict, Any

# =============================================================================
# GraphQL Response Fixtures
# =============================================================================

NAUTOBOT_DEVICE_MINIMAL: Dict[str, Any] = {
    "id": "device-uuid-123",
    "name": "test-switch",
    "status": {"name": "Active"},
}

NAUTOBOT_DEVICE_STANDARD: Dict[str, Any] = {
    "id": "device-uuid-456",
    "name": "test-switch-01",
    "platform": {"id": "platform-uuid", "name": "cisco_ios", "napalm_driver": "ios"},
    "device_type": {
        "id": "device-type-uuid",
        "model": "Catalyst 9300",
        "manufacturer": {"id": "mfr-uuid", "name": "Cisco"},
    },
    "location": {
        "id": "location-uuid",
        "name": "DC1",
        "parent": {"id": "parent-uuid", "name": "Region1"},
    },
    "primary_ip4": {
        "id": "ip-uuid",
        "address": "10.0.0.1/24",
        "host": "10.0.0.1",
        "mask_length": 24,
    },
    "status": {"id": "status-uuid", "name": "Active"},
    "role": {"id": "role-uuid", "name": "Access Switch"},
    "tags": [],
}

NAUTOBOT_DEVICE_FULL: Dict[str, Any] = {
    "id": "device-uuid-789",
    "name": "prod-switch-01",
    "platform": {
        "id": "platform-uuid",
        "name": "cisco_ios",
        "napalm_driver": "ios",
        "manufacturer": {"id": "mfr-uuid", "name": "Cisco"},
    },
    "device_type": {
        "id": "device-type-uuid",
        "model": "Catalyst 9300",
        "manufacturer": {"id": "mfr-uuid", "name": "Cisco"},
    },
    "location": {
        "id": "location-uuid",
        "name": "DC1",
        "parent": {
            "id": "parent-uuid",
            "name": "Region1",
            "parent": {"id": "root-uuid", "name": "Global"},
        },
    },
    "primary_ip4": {
        "id": "ip-uuid-primary",
        "address": "10.0.0.1/24",
        "host": "10.0.0.1",
        "mask_length": 24,
        "dns_name": "prod-switch-01.example.com",
        "status": {"id": "status-uuid", "name": "Active"},
        "type": "host",
    },
    "status": {"id": "status-uuid", "name": "Active"},
    "role": {"id": "role-uuid", "name": "Access Switch"},
    "tenant": {"id": "tenant-uuid", "name": "Production"},
    "serial": "ABC123456",
    "asset_tag": "ASSET-001",
    "tags": [
        {"id": "tag-uuid-1", "name": "production"},
        {"id": "tag-uuid-2", "name": "managed"},
    ],
    "custom_field_data": {},
    "interfaces": [
        {
            "id": "interface-uuid-1",
            "name": "Loopback0",
            "type": "virtual",
            "enabled": True,
            "description": "Management Loopback",
        },
        {
            "id": "interface-uuid-2",
            "name": "GigabitEthernet1/0/1",
            "type": "1000base-t",
            "enabled": True,
            "description": "Uplink",
        },
    ],
}

# GraphQL list responses
NAUTOBOT_DEVICES_LIST: Dict[str, Any] = {
    "data": {
        "devices": [
            NAUTOBOT_DEVICE_STANDARD,
            {
                "id": "device-uuid-2",
                "name": "test-switch-02",
                "platform": {"name": "cisco_ios"},
                "location": {"name": "DC2"},
                "primary_ip4": {"address": "10.0.0.2/24"},
                "status": {"name": "Active"},
            },
        ]
    }
}

# =============================================================================
# REST API Response Fixtures
# =============================================================================

# Device Type Response
NAUTOBOT_DEVICE_TYPE_RESPONSE: Dict[str, Any] = {
    "id": "device-type-uuid",
    "model": "Catalyst 9300",
    "manufacturer": {
        "id": "mfr-uuid",
        "name": "Cisco",
        "url": "http://nautobot/api/dcim/manufacturers/mfr-uuid/",
    },
    "slug": "catalyst-9300",
    "part_number": "C9300-48P",
    "u_height": 1,
    "is_full_depth": True,
}

# Location Response
NAUTOBOT_LOCATION_RESPONSE: Dict[str, Any] = {
    "id": "location-uuid",
    "name": "DC1",
    "slug": "dc1",
    "location_type": {"name": "Data Center"},
    "parent": {
        "id": "parent-uuid",
        "name": "Region1",
        "url": "http://nautobot/api/dcim/locations/parent-uuid/",
    },
    "status": {"name": "Active"},
}

# IP Address Response
NAUTOBOT_IP_ADDRESS_RESPONSE: Dict[str, Any] = {
    "id": "ip-uuid",
    "address": "10.0.0.1/24",
    "status": {"id": "status-uuid", "name": "Active"},
    "dns_name": "switch01.example.com",
    "description": "Primary management IP",
    "namespace": {"id": "ns-uuid", "name": "Global"},
}

# Interface Response
NAUTOBOT_INTERFACE_RESPONSE: Dict[str, Any] = {
    "id": "interface-uuid",
    "name": "Loopback0",
    "type": "virtual",
    "enabled": True,
    "description": "Management Loopback",
    "device": {
        "id": "device-uuid",
        "name": "test-switch",
        "url": "http://nautobot/api/dcim/devices/device-uuid/",
    },
    "status": {"name": "Active"},
}

# Device Creation Success Response
NAUTOBOT_DEVICE_CREATE_SUCCESS: Dict[str, Any] = {
    "id": "new-device-uuid",
    "name": "new-switch-01",
    "status": {"id": "status-uuid", "name": "Active"},
    "device_type": {"id": "device-type-uuid", "model": "Catalyst 9300"},
    "location": {"id": "location-uuid", "name": "DC1"},
    "url": "http://nautobot/api/dcim/devices/new-device-uuid/",
}

# =============================================================================
# Error Response Fixtures
# =============================================================================

NAUTOBOT_ERROR_DUPLICATE_DEVICE: Dict[str, Any] = {
    "errors": [
        {
            "message": "Device with name 'test-switch' already exists",
            "extensions": {"code": "VALIDATION_ERROR"},
        }
    ]
}

NAUTOBOT_ERROR_NOT_FOUND: Dict[str, Any] = {
    "errors": [
        {
            "message": "Device type 'invalid-type' not found",
            "extensions": {"code": "NOT_FOUND"},
        }
    ]
}

NAUTOBOT_ERROR_INVALID_IP: Dict[str, Any] = {
    "errors": [
        {
            "message": "Invalid IP address format: 'not-an-ip'",
            "extensions": {"code": "VALIDATION_ERROR"},
        }
    ]
}

# =============================================================================
# Metadata Fixtures (Locations, Roles, Platforms, etc.)
# =============================================================================

NAUTOBOT_LOCATIONS_LIST: Dict[str, Any] = {
    "data": {
        "locations": [
            {
                "id": "loc-uuid-1",
                "name": "DC1",
                "location_type": {"name": "Data Center"},
                "parent": {"id": "region-uuid", "name": "Region1"},
            },
            {
                "id": "loc-uuid-2",
                "name": "DC2",
                "location_type": {"name": "Data Center"},
                "parent": {"id": "region-uuid", "name": "Region1"},
            },
        ]
    }
}

NAUTOBOT_ROLES_LIST: Dict[str, Any] = {
    "data": {
        "roles": [
            {"id": "role-uuid-1", "name": "Access Switch"},
            {"id": "role-uuid-2", "name": "Distribution Switch"},
            {"id": "role-uuid-3", "name": "Core Router"},
        ]
    }
}

NAUTOBOT_PLATFORMS_LIST: Dict[str, Any] = {
    "data": {
        "platforms": [
            {
                "id": "platform-uuid-1",
                "name": "cisco_ios",
                "napalm_driver": "ios",
                "manufacturer": {"id": "mfr-uuid-1", "name": "Cisco"},
            },
            {
                "id": "platform-uuid-2",
                "name": "junos",
                "napalm_driver": "junos",
                "manufacturer": {"id": "mfr-uuid-2", "name": "Juniper"},
            },
        ]
    }
}

NAUTOBOT_DEVICE_TYPES_LIST: Dict[str, Any] = {
    "data": {
        "device_types": [
            {
                "id": "dt-uuid-1",
                "model": "Catalyst 9300",
                "manufacturer": {"id": "mfr-uuid-1", "name": "Cisco"},
            },
            {
                "id": "dt-uuid-2",
                "model": "Catalyst 9500",
                "manufacturer": {"id": "mfr-uuid-1", "name": "Cisco"},
            },
        ]
    }
}

# =============================================================================
# Helper Functions
# =============================================================================


def create_device_response(
    name: str = "test-device",
    device_id: str = "device-uuid",
    ip_address: str = "10.0.0.1/24",
    platform: str = "cisco_ios",
    location: str = "DC1",
    status: str = "Active",
) -> Dict[str, Any]:
    """
    Factory function to create custom device response.

    Args:
        name: Device name
        device_id: Device UUID
        ip_address: Primary IP address with mask
        platform: Platform name
        location: Location name
        status: Device status

    Returns:
        Device response dictionary
    """
    return {
        "id": device_id,
        "name": name,
        "platform": {"name": platform},
        "location": {"name": location},
        "primary_ip4": {"address": ip_address},
        "status": {"name": status},
    }


def create_devices_list(count: int = 3) -> Dict[str, Any]:
    """
    Create a list of devices for testing.

    Args:
        count: Number of devices to create

    Returns:
        GraphQL devices list response
    """
    devices = [
        create_device_response(
            name=f"switch-{i:02d}",
            device_id=f"device-uuid-{i}",
            ip_address=f"10.0.0.{i}/24",
        )
        for i in range(1, count + 1)
    ]

    return {"data": {"devices": devices}}


def create_graphql_error(message: str, code: str = "ERROR") -> Dict[str, Any]:
    """
    Create a GraphQL error response.

    Args:
        message: Error message
        code: Error code

    Returns:
        GraphQL error response
    """
    return {"errors": [{"message": message, "extensions": {"code": code}}]}
