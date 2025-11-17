# Nautobot API Endpoints

## Overview
New Nautobot API endpoints have been added to provide full CRUD operations for:
- **IPAM**: IP prefixes and IP addresses
- **DCIM**: Devices

## Table of Contents
- [IPAM Prefix Endpoints](#ipam-prefix-endpoints)
- [IPAM IP Address Endpoints](#ipam-ip-address-endpoints)
- [DCIM Device Endpoints](#dcim-device-endpoints)
- [DCIM Interface Endpoints](#dcim-interface-endpoints)

---

## IPAM Prefix Endpoints

### 1. List IP Prefixes
```
GET /api/nautobot/ipam/prefixes
```

**Query Parameters:**
- `prefix` - Filter by prefix (e.g., "10.0.0.0/8")
- `namespace` - Filter by namespace name
- `location` - Filter by location name
- `status` - Filter by status (e.g., "active", "reserved", "deprecated")
- `limit` - Maximum number of results
- `offset` - Pagination offset

**Permission Required:** `nautobot.locations:read`

**Example Response:**
```json
{
  "count": 3,
  "next": "http://localhost:8080/api/ipam/prefixes/?limit=1&offset=1",
  "previous": null,
  "results": [
    {
      "id": "2a1d2653-6336-46db-a6ce-dfd5a39ef4f1",
      "prefix": "0.0.0.0/0",
      "type": {
        "value": "network",
        "label": "Network"
      },
      "status": {
        "id": "a56c7608-d8dd-4bb2-89a4-5ac8034175d7"
      },
      "namespace": {
        "id": "a5ee618b-f605-4727-b025-5e206892eddd"
      },
      "description": "",
      "locations": [],
      "created": "2025-06-01T20:46:20.101942Z",
      "last_updated": "2025-09-01T14:48:08.098884Z"
    }
  ]
}
```

### 2. Get Single IP Prefix
```
GET /api/nautobot/ipam/prefixes/{prefix_id}
```

**Parameters:**
- `prefix_id` - The UUID of the prefix

**Permission Required:** `nautobot.locations:read`

**Example:**
```bash
GET /api/nautobot/ipam/prefixes/2a1d2653-6336-46db-a6ce-dfd5a39ef4f1
```

### 3. Create IP Prefix
```
POST /api/nautobot/ipam/prefixes
```

**Permission Required:** `nautobot.locations:write`

**Request Body:**
```json
{
  "prefix": "10.0.0.0/24",
  "namespace": "a5ee618b-f605-4727-b025-5e206892eddd",
  "status": "active",
  "type": "network",
  "description": "Management network",
  "location": "optional-location-id"
}
```

**Required Fields:**
- `prefix` - The IP prefix (e.g., "10.0.0.0/24")
- `namespace` - Namespace ID

**Optional Fields:**
- `status` - Status ID or name (e.g., "active")
- `type` - Prefix type (e.g., "network", "pool")
- `location` - Location ID
- `description` - Description text
- `tags` - List of tag IDs

### 4. Update IP Prefix
```
PUT /api/nautobot/ipam/prefixes/{prefix_id}
PATCH /api/nautobot/ipam/prefixes/{prefix_id}
```

**Parameters:**
- `prefix_id` - The UUID of the prefix to update

**Permission Required:** `nautobot.locations:write`

**Request Body:**
Can contain any updatable fields:
```json
{
  "description": "Updated description",
  "status": "reserved",
  "location": "new-location-id"
}
```

**Note:** Both PUT and PATCH routes use PATCH internally for partial updates.

### 5. Delete IP Prefix
```
DELETE /api/nautobot/ipam/prefixes/{prefix_id}
```

**Parameters:**
- `prefix_id` - The UUID of the prefix to delete

**Permission Required:** `nautobot.locations:delete`

**Success Response:**
```json
{
  "status": "success",
  "message": "Resource deleted successfully"
}
```

## Authentication

All endpoints require JWT token authentication via the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Frontend Usage

From the frontend, call these endpoints via the Next.js proxy:

```typescript
// List prefixes with filters
const response = await fetch('/api/proxy/nautobot/ipam/prefixes?location=lab&limit=50', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

// Get single prefix
const prefix = await fetch(`/api/proxy/nautobot/ipam/prefixes/${prefixId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

// Create prefix
const newPrefix = await fetch('/api/proxy/nautobot/ipam/prefixes', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prefix: '10.0.0.0/24',
    namespace: namespaceId,
    status: 'active',
    type: 'network'
  })
})

// Update prefix
const updated = await fetch(`/api/proxy/nautobot/ipam/prefixes/${prefixId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    description: 'Updated description'
  })
})

// Delete prefix
const deleted = await fetch(`/api/proxy/nautobot/ipam/prefixes/${prefixId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

## IP Address Endpoints

### 6. List IP Addresses
```
GET /api/nautobot/ipam/ip-addresses
```

**Query Parameters:**
- `address` - Filter by IP address (e.g., "192.168.1.1")
- `namespace` - Filter by namespace name
- `parent` - Filter by parent prefix ID
- `status` - Filter by status (e.g., "active", "reserved", "deprecated")
- `dns_name` - Filter by DNS name
- `device` - Filter by device name or ID
- `interface` - Filter by interface name or ID
- `limit` - Maximum number of results
- `offset` - Pagination offset

**Permission Required:** `nautobot.locations:read`

**Example Response:**
```json
{
  "count": 27,
  "next": "http://localhost:8080/api/ipam/ip-addresses/?limit=1&offset=1",
  "previous": null,
  "results": [
    {
      "id": "37b26a1b-488b-448d-a0b9-ba550763ee3b",
      "address": "192.168.178.104/24",
      "host": "192.168.178.104",
      "mask_length": 24,
      "type": "host",
      "ip_version": 4,
      "dns_name": "",
      "description": "",
      "status": {
        "id": "a56c7608-d8dd-4bb2-89a4-5ac8034175d7"
      },
      "parent": {
        "id": "38f705fa-291b-4f98-97e1-deb0d1636451"
      },
      "created": "2025-07-29T21:00:53.446532Z",
      "last_updated": "2025-07-29T21:00:53.446540Z"
    }
  ]
}
```

### 7. Get Single IP Address
```
GET /api/nautobot/ipam/ip-addresses/{ip_address_id}
```

**Parameters:**
- `ip_address_id` - The UUID of the IP address

**Permission Required:** `nautobot.locations:read`

**Example:**
```bash
GET /api/nautobot/ipam/ip-addresses/37b26a1b-488b-448d-a0b9-ba550763ee3b
```

### 8. Create IP Address
```
POST /api/nautobot/ipam/ip-addresses
```

**Permission Required:** `nautobot.locations:write`

**Request Body:**
```json
{
  "address": "192.168.1.100/24",
  "namespace": "a5ee618b-f605-4727-b025-5e206892eddd",
  "status": "active",
  "type": "host",
  "dns_name": "server.example.com",
  "description": "Application server"
}
```

**Required Fields:**
- `address` - The IP address with or without mask (e.g., "192.168.1.100/24" or "192.168.1.100")

**Optional Fields:**
- `namespace` - Namespace ID (defaults to Global if not specified)
- `status` - Status ID or name (e.g., "active")
- `type` - Address type (e.g., "host", "anycast", "loopback")
- `parent` - Parent prefix ID
- `dns_name` - DNS name
- `description` - Description text
- `tags` - List of tag IDs

### 9. Update IP Address
```
PUT /api/nautobot/ipam/ip-addresses/{ip_address_id}
PATCH /api/nautobot/ipam/ip-addresses/{ip_address_id}
```

**Parameters:**
- `ip_address_id` - The UUID of the IP address to update

**Permission Required:** `nautobot.locations:write`

**Request Body:**
Can contain any updatable fields:
```json
{
  "dns_name": "updated-server.example.com",
  "status": "reserved",
  "description": "Updated description"
}
```

**Note:** Both PUT and PATCH routes use PATCH internally for partial updates.

### 10. Delete IP Address
```
DELETE /api/nautobot/ipam/ip-addresses/{ip_address_id}
```

**Parameters:**
- `ip_address_id` - The UUID of the IP address to delete

**Permission Required:** `nautobot.locations:delete`

**Success Response:**
```json
{
  "status": "success",
  "message": "Resource deleted successfully"
}
```

## Frontend Usage Examples

### IP Addresses

```typescript
// List IP addresses with filters
const response = await fetch('/api/proxy/nautobot/ipam/ip-addresses?device=router1&limit=50', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

// Get single IP address
const ipAddress = await fetch(`/api/proxy/nautobot/ipam/ip-addresses/${ipAddressId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

// Create IP address
const newIpAddress = await fetch('/api/proxy/nautobot/ipam/ip-addresses', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    address: '192.168.1.100/24',
    namespace: namespaceId,
    status: 'active',
    type: 'host',
    dns_name: 'server.example.com'
  })
})

// Update IP address
const updated = await fetch(`/api/proxy/nautobot/ipam/ip-addresses/${ipAddressId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    dns_name: 'updated-server.example.com',
    description: 'Updated description'
  })
})

// Delete IP address
const deleted = await fetch(`/api/proxy/nautobot/ipam/ip-addresses/${ipAddressId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

## Implementation Details

**File:** `/backend/routers/nautobot.py` (lines 1688-2130+)

**Service Used:** `nautobot_service.rest_request()`
- Handles authentication with Nautobot API via Token header
- Supports GET, POST, PATCH, DELETE methods
- Returns JSON responses from Nautobot

**Error Handling:**
- 400 Bad Request - Missing required fields
- 404 Not Found - Resource ID doesn't exist
- 500 Internal Server Error - Nautobot API errors

**Logging:**
All operations are logged with INFO level:

**Prefixes:**
- `Retrieved N prefixes from Nautobot IPAM`
- `Retrieved prefix {id} from Nautobot IPAM`
- `Created prefix {prefix} in Nautobot IPAM`
- `Updated prefix {id} in Nautobot IPAM`
- `Deleted prefix {id} from Nautobot IPAM`

**IP Addresses:**
- `Retrieved N IP addresses from Nautobot IPAM`
- `Retrieved IP address {id} from Nautobot IPAM`
- `Created IP address {address} in Nautobot IPAM`
- `Updated IP address {id} in Nautobot IPAM`
- `Deleted IP address {id} from Nautobot IPAM`

## Testing

The endpoints have been verified against Nautobot v4.x API structure:
- Correct endpoint paths (`/api/ipam/prefixes/`, `/api/ipam/ip-addresses/`)
- Proper authentication (Token-based)
- Correct response structure (pagination, nested objects)
- Proper HTTP status codes (200, 201, 204)

## Next Steps

Consider adding:
1. Frontend UI components for IPAM and DCIM management
2. Additional IPAM endpoints (VLANs, VRFs, namespaces)
3. Additional DCIM endpoints (interfaces, cables, racks)
4. Bulk operations support
5. Prefix availability checking
6. IP allocation from prefixes (next available IP)
7. IP address assignment to device interfaces

---

## DCIM Device Endpoints

### 11. List Devices
```
GET /api/nautobot/dcim/devices
```

**Query Parameters:**
- `name` - Filter by device name
- `location` - Filter by location name or ID
- `role` - Filter by role name or ID
- `device_type` - Filter by device type name or ID
- `platform` - Filter by platform name or ID
- `status` - Filter by status (e.g., "active", "planned", "offline")
- `tenant` - Filter by tenant name or ID
- `tag` - Filter by tag name
- `limit` - Maximum number of results
- `offset` - Pagination offset

**Permission Required:** `nautobot.devices:read`

**Example Response:**
```json
{
  "count": 3,
  "next": "http://localhost:8080/api/dcim/devices/?limit=1&offset=1",
  "previous": null,
  "results": [
    {
      "id": "3ec64b79-aa33-46be-b9c2-6a5aa9ea6381",
      "name": "LAB.local.zz",
      "device_type": {
        "id": "57dbf256-de76-4e21-ba54-46347f8c546d"
      },
      "role": {
        "id": "00b8d2c9-e5c1-4ad7-b8e6-f37c3bde52ad"
      },
      "location": {
        "id": "6cc93cbd-5026-4fdc-8fc0-0c9e1657e817"
      },
      "platform": {
        "id": "82844444-c632-41f5-bc94-5d5b3bb56bed"
      },
      "status": {
        "id": "a56c7608-d8dd-4bb2-89a4-5ac8034175d7"
      },
      "serial": "131184641",
      "primary_ip4": {
        "id": "ac981686-57ef-4f4d-af56-09f693c68c86"
      },
      "created": "2025-07-31T14:50:50.887182Z",
      "last_updated": "2025-10-23T16:00:56.688650Z"
    }
  ]
}
```

### 12. Get Single Device
```
GET /api/nautobot/dcim/devices/{device_id}
```

**Parameters:**
- `device_id` - The UUID of the device

**Permission Required:** `nautobot.devices:read`

**Example:**
```bash
GET /api/nautobot/dcim/devices/3ec64b79-aa33-46be-b9c2-6a5aa9ea6381
```

### 13. Create Device
```
POST /api/nautobot/dcim/devices
```

**Permission Required:** `nautobot.devices:write`

**Request Body:**
```json
{
  "name": "switch-01",
  "device_type": "device-type-uuid",
  "role": "role-uuid",
  "location": "location-uuid",
  "status": "active",
  "platform": "platform-uuid",
  "serial": "SN123456",
  "asset_tag": "ASSET-001",
  "comments": "Main distribution switch"
}
```

**Required Fields:**
- `name` - Device name
- `device_type` - Device type ID
- `role` - Role ID
- `location` - Location ID
- `status` - Status ID or name (e.g., "active")

**Optional Fields:**
- `platform` - Platform ID
- `serial` - Serial number
- `asset_tag` - Asset tag
- `tenant` - Tenant ID
- `rack` - Rack ID
- `position` - Rack position (integer)
- `face` - Rack face ("front" or "rear")
- `primary_ip4` - Primary IPv4 address ID
- `primary_ip6` - Primary IPv6 address ID
- `comments` - Comments
- `tags` - List of tag IDs
- `custom_fields` - Custom field values object

### 14. Update Device
```
PUT /api/nautobot/dcim/devices/{device_id}
PATCH /api/nautobot/dcim/devices/{device_id}
```

**Parameters:**
- `device_id` - The UUID of the device to update

**Permission Required:** `nautobot.devices:write`

**Request Body:**
Can contain any updatable fields:
```json
{
  "name": "switch-01-updated",
  "status": "planned",
  "comments": "Scheduled for maintenance",
  "custom_fields": {
    "last_backup": "2025-11-17T10:00:00Z"
  }
}
```

**Note:** Both PUT and PATCH routes use PATCH internally for partial updates.

### 15. Delete Device
```
DELETE /api/nautobot/dcim/devices/{device_id}
```

**Parameters:**
- `device_id` - The UUID of the device to delete

**Permission Required:** `nautobot.devices:delete`

**Success Response:**
```json
{
  "status": "success",
  "message": "Resource deleted successfully"
}
```

## DCIM Frontend Usage Examples

```typescript
// List devices with filters
const response = await fetch('/api/proxy/nautobot/dcim/devices?location=datacenter1&status=active&limit=50', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

// Get single device
const device = await fetch(`/api/proxy/nautobot/dcim/devices/${deviceId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

// Create device
const newDevice = await fetch('/api/proxy/nautobot/dcim/devices', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'switch-01',
    device_type: deviceTypeId,
    role: roleId,
    location: locationId,
    status: 'active',
    platform: platformId,
    serial: 'SN123456'
  })
})

// Update device
const updated = await fetch(`/api/proxy/nautobot/dcim/devices/${deviceId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    status: 'offline',
    comments: 'Device under maintenance'
  })
})

// Delete device
const deleted = await fetch(`/api/proxy/nautobot/dcim/devices/${deviceId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

## Updated Implementation Details

**File:** `/backend/routers/nautobot.py` (lines 1688-2360+)

**DCIM Devices:**
- `Retrieved N devices from Nautobot DCIM`
- `Retrieved device {id} from Nautobot DCIM`
- `Created device {name} in Nautobot DCIM`
- `Updated device {id} in Nautobot DCIM`
- `Deleted device {id} from Nautobot DCIM`

---

## DCIM Interface Endpoints

### GET /api/nautobot/dcim/interfaces

**Description**: List all interfaces in Nautobot DCIM with filtering and pagination.

**Required Permission**: `nautobot.devices:read`

**Query Parameters**:
- `device` (optional): Filter by device name
- `device_id` (optional): Filter by device UUID
- `name` (optional): Filter by interface name (e.g., "Ethernet0/0")
- `type` (optional): Filter by interface type (e.g., "1000base-t", "10gbase-x-sfpp", "virtual")
- `enabled` (optional): Filter by enabled status (true/false)
- `mgmt_only` (optional): Filter by management-only interfaces (true/false)
- `mac_address` (optional): Filter by MAC address
- `status` (optional): Filter by status name
- `limit` (optional): Number of results per page (default: 50)
- `offset` (optional): Pagination offset

**Response**: 
- `200 OK`: List of interfaces with pagination metadata
- `500 Internal Server Error`: Nautobot API error

**Example Response**:
```json
{
  "count": 24,
  "next": "http://nautobot/api/dcim/interfaces/?limit=50&offset=50",
  "previous": null,
  "results": [
    {
      "id": "c0b34541-4702-4bd5-80b8-43c779e98c98",
      "display": "Ethernet0/0",
      "url": "http://nautobot/api/dcim/interfaces/c0b34541-4702-4bd5-80b8-43c779e98c98/",
      "device": {
        "id": "device-uuid",
        "display": "switch-01",
        "url": "http://nautobot/api/dcim/devices/device-uuid/"
      },
      "name": "Ethernet0/0",
      "label": "",
      "type": {
        "value": "1000base-t",
        "label": "1000BASE-T (1GE)"
      },
      "enabled": true,
      "mgmt_only": false,
      "description": "Uplink to core",
      "mac_address": "00:1A:2B:3C:4D:5E",
      "mtu": 1500,
      "mode": null,
      "status": {
        "id": "status-uuid",
        "display": "Active",
        "url": "http://nautobot/api/extras/statuses/status-uuid/"
      },
      "ip_addresses": [
        {
          "id": "ip-uuid",
          "display": "192.168.1.10/24",
          "family": 4,
          "address": "192.168.1.10/24"
        }
      ],
      "parent_interface": null,
      "bridge": null,
      "lag": null,
      "tagged_vlans": [],
      "untagged_vlan": null,
      "tags": []
    }
  ]
}
```

**Logs**:
- `Fetching interfaces from Nautobot DCIM with filters: {filters}`
- `Successfully retrieved {count} interfaces from Nautobot DCIM`

**Frontend Usage Example**:
```typescript
// List all interfaces for a device
const response = await fetch(`/api/proxy/nautobot/dcim/interfaces?device_id=${deviceId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  }
})
const data = await response.json()
console.log(`Found ${data.count} interfaces`)

// Filter by interface name and type
const ethernetPorts = await fetch('/api/proxy/nautobot/dcim/interfaces?name=Ethernet&type=1000base-t', {
  headers: { 'Authorization': `Bearer ${token}` }
})
```

---

### GET /api/nautobot/dcim/interfaces/{interface_id}

**Description**: Get details of a specific interface by UUID.

**Required Permission**: `nautobot.devices:read`

**Path Parameters**:
- `interface_id` (required): Interface UUID

**Response**:
- `200 OK`: Interface details
- `404 Not Found`: Interface not found
- `500 Internal Server Error`: Nautobot API error

**Example Response**:
```json
{
  "id": "c0b34541-4702-4bd5-80b8-43c779e98c98",
  "display": "Ethernet0/0",
  "url": "http://nautobot/api/dcim/interfaces/c0b34541-4702-4bd5-80b8-43c779e98c98/",
  "device": {
    "id": "device-uuid",
    "display": "switch-01",
    "url": "http://nautobot/api/dcim/devices/device-uuid/"
  },
  "name": "Ethernet0/0",
  "label": "",
  "type": {
    "value": "1000base-t",
    "label": "1000BASE-T (1GE)"
  },
  "enabled": true,
  "mgmt_only": false,
  "description": "Uplink to core",
  "mac_address": "00:1A:2B:3C:4D:5E",
  "mtu": 1500,
  "mode": null,
  "status": {
    "id": "status-uuid",
    "display": "Active",
    "url": "http://nautobot/api/extras/statuses/status-uuid/"
  },
  "ip_addresses": [
    {
      "id": "ip-uuid",
      "display": "192.168.1.10/24",
      "family": 4,
      "address": "192.168.1.10/24"
    }
  ],
  "parent_interface": null,
  "bridge": null,
  "lag": null,
  "tagged_vlans": [],
  "untagged_vlan": null,
  "tags": [],
  "created": "2024-01-01T00:00:00.000000Z",
  "last_updated": "2024-01-01T00:00:00.000000Z"
}
```

**Logs**:
- `Fetching interface {id} from Nautobot DCIM`
- `Successfully retrieved interface {id} from Nautobot DCIM`

**Frontend Usage Example**:
```typescript
// Get specific interface
const response = await fetch(`/api/proxy/nautobot/dcim/interfaces/${interfaceId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  }
})
const interface = await response.json()
console.log(`Interface: ${interface.name} on ${interface.device.display}`)
console.log(`IP Addresses: ${interface.ip_addresses.map(ip => ip.address).join(', ')}`)
```

---

### POST /api/nautobot/dcim/interfaces

**Description**: Create a new interface in Nautobot DCIM.

**Required Permission**: `nautobot.devices:write`

**Request Body** (JSON):

Required fields:
- `device` (string): Device UUID (required)
- `name` (string): Interface name (required)
- `type` (string): Interface type value (required) - e.g., "1000base-t", "10gbase-x-sfpp", "virtual"
- `status` (string): Status UUID (required)

Optional fields:
- `label` (string): Interface label
- `enabled` (boolean): Whether interface is enabled (default: true)
- `mgmt_only` (boolean): Whether interface is management-only (default: false)
- `description` (string): Interface description
- `mac_address` (string): MAC address in format "AA:BB:CC:DD:EE:FF"
- `mtu` (integer): Maximum transmission unit
- `mode` (string): Interface mode (access/tagged/tagged-all)
- `parent_interface` (string): Parent interface UUID (for sub-interfaces)
- `bridge` (string): Bridge interface UUID
- `lag` (string): LAG interface UUID (for LAG members)
- `untagged_vlan` (string): Untagged VLAN UUID
- `tagged_vlans` (array): Array of tagged VLAN UUIDs
- `tags` (array): Array of tag UUIDs

**Response**:
- `201 Created`: Interface created successfully
- `400 Bad Request`: Missing required fields or validation error
- `500 Internal Server Error`: Nautobot API error

**Example Request**:
```json
{
  "device": "device-uuid-here",
  "name": "Ethernet0/1",
  "type": "1000base-t",
  "status": "status-uuid-here",
  "enabled": true,
  "mgmt_only": false,
  "description": "Connection to distribution switch",
  "mac_address": "00:1A:2B:3C:4D:5F",
  "mtu": 9000
}
```

**Example Response**:
```json
{
  "id": "new-interface-uuid",
  "display": "Ethernet0/1",
  "url": "http://nautobot/api/dcim/interfaces/new-interface-uuid/",
  "device": {
    "id": "device-uuid-here",
    "display": "switch-01",
    "url": "http://nautobot/api/dcim/devices/device-uuid-here/"
  },
  "name": "Ethernet0/1",
  "type": {
    "value": "1000base-t",
    "label": "1000BASE-T (1GE)"
  },
  "enabled": true,
  "mgmt_only": false,
  "description": "Connection to distribution switch",
  "mac_address": "00:1A:2B:3C:4D:5F",
  "mtu": 9000,
  "status": {
    "id": "status-uuid-here",
    "display": "Active"
  },
  "ip_addresses": [],
  "created": "2024-01-01T12:00:00.000000Z",
  "last_updated": "2024-01-01T12:00:00.000000Z"
}
```

**Logs**:
- `Creating new interface in Nautobot DCIM: {name}`
- `Successfully created interface {id} in Nautobot DCIM`

**Frontend Usage Example**:
```typescript
// Create interface
const newInterface = await fetch('/api/proxy/nautobot/dcim/interfaces', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    device: deviceId,
    name: 'Ethernet0/1',
    type: '1000base-t',
    status: statusId,
    enabled: true,
    description: 'Uplink interface',
    mtu: 9000
  })
})
const interface = await newInterface.json()
console.log(`Created interface: ${interface.id}`)
```

---

### PATCH /api/nautobot/dcim/interfaces/{interface_id}

**Description**: Update an existing interface in Nautobot DCIM. Only provided fields will be updated.

**Required Permission**: `nautobot.devices:write`

**Path Parameters**:
- `interface_id` (required): Interface UUID to update

**Request Body** (JSON):
Any subset of the fields from POST endpoint. All fields are optional.

**Response**:
- `200 OK`: Interface updated successfully
- `400 Bad Request`: Invalid field values
- `404 Not Found`: Interface not found
- `500 Internal Server Error`: Nautobot API error

**Example Request**:
```json
{
  "description": "Updated description",
  "enabled": false,
  "mtu": 1500
}
```

**Example Response**:
```json
{
  "id": "interface-uuid",
  "display": "Ethernet0/1",
  "url": "http://nautobot/api/dcim/interfaces/interface-uuid/",
  "device": {
    "id": "device-uuid",
    "display": "switch-01"
  },
  "name": "Ethernet0/1",
  "type": {
    "value": "1000base-t",
    "label": "1000BASE-T (1GE)"
  },
  "enabled": false,
  "description": "Updated description",
  "mtu": 1500,
  "status": {
    "id": "status-uuid",
    "display": "Active"
  },
  "last_updated": "2024-01-01T12:30:00.000000Z"
}
```

**Logs**:
- `Updating interface {id} in Nautobot DCIM`
- `Successfully updated interface {id} in Nautobot DCIM`

**Frontend Usage Example**:
```typescript
// Update interface
const updated = await fetch(`/api/proxy/nautobot/dcim/interfaces/${interfaceId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    description: 'New description',
    enabled: true,
    mtu: 9000
  })
})
const interface = await updated.json()
console.log(`Updated interface: ${interface.name}`)
```

---

### DELETE /api/nautobot/dcim/interfaces/{interface_id}

**Description**: Delete an interface from Nautobot DCIM.

**Required Permission**: `nautobot.devices:delete`

**Path Parameters**:
- `interface_id` (required): Interface UUID to delete

**Response**:
- `204 No Content`: Interface deleted successfully
- `404 Not Found`: Interface not found
- `500 Internal Server Error`: Nautobot API error

**Logs**:
- `Deleting interface {id} from Nautobot DCIM`
- `Successfully deleted interface {id} from Nautobot DCIM`

**Frontend Usage Example**:
```typescript
// Delete interface
const response = await fetch(`/api/proxy/nautobot/dcim/interfaces/${interfaceId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
  }
})

if (response.status === 204) {
  console.log('Interface deleted successfully')
}
```

---

## IP-to-Device Assignment Workflow

To properly assign IP addresses to devices in Nautobot, follow this workflow:

### 1. Create or Identify Device
```typescript
// Create device first
const device = await fetch('/api/proxy/nautobot/dcim/devices', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'switch-01',
    device_type: deviceTypeId,
    role: roleId,
    location: locationId,
    status: statusId
  })
})
const deviceData = await device.json()
```

### 2. Create Interface on Device
```typescript
// Create interface on the device
const interface = await fetch('/api/proxy/nautobot/dcim/interfaces', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    device: deviceData.id,
    name: 'Ethernet0/0',
    type: '1000base-t',
    status: statusId,
    enabled: true,
    mgmt_only: false
  })
})
const interfaceData = await interface.json()
```

### 3. Create IP Address and Assign to Interface
```typescript
// Create IP address with interface assignment
const ipAddress = await fetch('/api/proxy/nautobot/ipam/ip-addresses', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    address: '192.168.1.10/24',
    status: statusId,
    namespace: namespaceId,
    interfaces: [interfaceData.id],  // Assign to interface
    dns_name: 'switch-01.example.com'
  })
})
const ipData = await ipAddress.json()
```

### 4. Set Primary IP on Device (Optional)
```typescript
// Update device to set primary IPv4/IPv6
const updatedDevice = await fetch(`/api/proxy/nautobot/dcim/devices/${deviceData.id}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    primary_ip4: ipData.id  // or primary_ip6 for IPv6
  })
})
```

### Key Points
- **Interfaces are mandatory**: IP addresses cannot be directly assigned to devices
- **One-to-Many**: One interface can have multiple IP addresses
- **Many-to-Many**: One IP address can be assigned to multiple interfaces (rare but possible)
- **Primary IP**: Devices have optional `primary_ip4` and `primary_ip6` fields that reference specific IP addresses
- **Management Interfaces**: Set `mgmt_only: true` on management interfaces for better organization

## Updated Testing Notes

All endpoints verified against Nautobot v4.x API:
- IPAM: `/api/ipam/prefixes/`, `/api/ipam/ip-addresses/`
- DCIM: `/api/dcim/devices/`, `/api/dcim/interfaces/`
- Token-based authentication
- Pagination support
- Proper HTTP status codes (200, 201, 204, 400, 404, 500)
