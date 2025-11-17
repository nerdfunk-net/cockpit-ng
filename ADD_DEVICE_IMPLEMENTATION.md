# Add Device Backend Implementation

## Overview

Implemented the backend endpoint `/api/nautobot/add-device` with an orchestrated workflow to add devices with interfaces to Nautobot.

## Implementation Details

### Backend Changes

#### 1. Models (`/backend/models/nautobot.py`)

Added two new Pydantic models:

- **`InterfaceData`**: Represents interface configuration with 12 optional properties
  - Required: `name`, `type`, `status`
  - Optional IP: `ip_address`
  - Optional properties: `enabled`, `mgmt_only`, `description`, `mac_address`, `mtu`, `mode`, `untagged_vlan`, `tagged_vlans`, `parent_interface`, `bridge`, `lag`, `tags`

- **`AddDeviceRequest`**: Main request model for the add-device endpoint
  - Device fields: `name`, `role`, `status`, `location`, `device_type`
  - Interfaces: `list[InterfaceData]`

#### 2. Router (`/backend/routers/nautobot.py`)

Added new POST endpoint: `/api/nautobot/add-device`

**Workflow (4 Steps):**

1. **Create Device in Nautobot DCIM**
   - POST to `/api/dcim/devices/`
   - Required fields: name, device_type, role, location, status
   - Returns device ID for subsequent steps

2. **Create IP Addresses**
   - Loop through all interfaces with `ip_address` specified
   - POST to `/api/ipam/ip-addresses/` for each IP
   - Store mapping of interface name → IP address ID

3. **Create Interfaces and Assign IPs**
   - Loop through all interfaces
   - POST to `/api/dcim/interfaces/` with device ID
   - Include all 12 optional properties if provided
   - PATCH each IP address to assign it to the interface
   - Save first IPv4 address for primary IP assignment

4. **Assign Primary IPv4 (Skeleton)**
   - Helper function `_assign_primary_ipv4()` created
   - Currently a skeleton with logging only
   - TODO: Implement actual PATCH to update device's `primary_ip4` field

**Features:**
- Full error handling with try/except blocks
- Continues processing even if individual interface/IP creation fails
- Detailed logging at each step
- Returns comprehensive response with counts and created objects
- Requires `nautobot.devices.write` permission

### Frontend Changes (`/frontend/src/components/nautobot-add-device/add-device-page.tsx`)

Updated `handleSubmit` function:
- Removed mock/simulation code
- Added actual API call to `/api/proxy/nautobot/add-device`
- Filters out empty interfaces (must have name, type, status)
- Includes authentication token from cookies
- Enhanced success message shows interface and IP address counts
- Proper error handling with user feedback

## API Request/Response

### Request Format

```json
{
  "name": "switch-01",
  "role": "role-uuid",
  "status": "active",
  "location": "location-uuid",
  "device_type": "device-type-uuid",
  "interfaces": [
    {
      "name": "eth0",
      "type": "1000base-t",
      "status": "active",
      "ip_address": "192.168.1.1/24",
      "enabled": true,
      "mgmt_only": false,
      "description": "Management interface",
      "mac_address": "00:11:22:33:44:55",
      "mtu": 1500,
      "mode": "access",
      "untagged_vlan": "vlan-uuid",
      "tagged_vlans": "vlan-uuid1,vlan-uuid2",
      "parent_interface": "parent-uuid",
      "bridge": "bridge-uuid",
      "lag": "lag-uuid",
      "tags": "tag1,tag2"
    }
  ]
}
```

### Response Format

```json
{
  "success": true,
  "message": "Device switch-01 created successfully",
  "device_id": "device-uuid",
  "device": { /* full device object */ },
  "interfaces_created": 1,
  "interfaces": [ /* array of created interfaces */ ],
  "ip_addresses_created": 1,
  "primary_ipv4_assigned": true
}
```

## Testing Steps

1. **Start Backend**:
   ```bash
   cd backend
   python start.py
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Navigate to Add Device**:
   - Go to http://localhost:3000/nautobot-add-device
   - Fill in device information
   - Add interfaces with IP addresses
   - Click "Add Device"

4. **Verify Workflow**:
   - Check backend logs for 4-step workflow execution
   - Verify device created in Nautobot
   - Verify interfaces created and IPs assigned
   - Confirm primary IP skeleton logging

## Known Limitations

1. **Primary IPv4 Assignment**: Currently a skeleton function that only logs. Needs implementation to actually PATCH the device with `primary_ip4` field.

2. **Rollback**: If any step fails, previously created objects are not automatically deleted. This should be enhanced with proper transaction rollback logic.

3. **Error Recovery**: Individual interface/IP creation failures are logged but don't stop the workflow. Consider if this is the desired behavior.

## Future Enhancements

### 1. Complete Primary IP Assignment
```python
async def _assign_primary_ipv4(device_id: str, ip_address_id: str) -> bool:
    try:
        await nautobot_service.rest_request(
            endpoint=f"/api/dcim/devices/{device_id}/",
            method="PATCH",
            data={"primary_ip4": ip_address_id}
        )
        return True
    except Exception as e:
        logger.error(f"Error assigning primary IP: {str(e)}")
        return False
```

### 2. Add Rollback Logic
- Store all created object IDs
- On failure, delete in reverse order (interfaces → IPs → device)
- Wrap in transaction if Nautobot supports it

### 3. Batch Operations
- Consider batch creation endpoints if Nautobot supports them
- Reduce number of API calls for better performance

### 4. Validation Enhancements
- Verify device_type, role, location, status exist before creating device
- Validate IP address format (CIDR notation)
- Check for duplicate device names

### 5. Advanced Features
- Support for IPv6 primary address
- Support for management-only interface detection
- Auto-detect primary interface based on naming conventions

## Files Modified

1. `/backend/models/nautobot.py` - Added `InterfaceData` and `AddDeviceRequest` models
2. `/backend/routers/nautobot.py` - Added `/add-device` endpoint and `_assign_primary_ipv4()` helper
3. `/frontend/src/components/nautobot-add-device/add-device-page.tsx` - Updated `handleSubmit` to call real API

## Permissions Required

- `nautobot.devices:write` - Required for endpoint access
- User must be authenticated (JWT token)

## Logs

Backend logs will show detailed workflow execution:
```
INFO - Starting add-device workflow for: switch-01
INFO - Step 1: Creating device in Nautobot DCIM
INFO - Device created with ID: abc-123-def-456
INFO - Step 2: Creating IP addresses
INFO - Created IP address 192.168.1.1/24 with ID: ip-abc-123
INFO - Step 3: Creating interfaces
INFO - Created interface eth0 with ID: if-abc-123
INFO - Assigned IP 192.168.1.1/24 to interface eth0
INFO - Step 4: Assigning primary IPv4 (skeleton)
INFO - [SKELETON] Would assign primary IPv4 ip-abc-123 to device abc-123-def-456
```
