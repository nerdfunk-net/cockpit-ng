# Update Existing Interface IP - Backend Implementation

## Summary

Implemented backend support for the "Add new Interface when IP changes" checkbox. The system now supports two different behaviors when updating a device's primary IPv4 address:

1. **Create new interface** (`createOnIpChange = true`): Creates a new interface with the new IP address
2. **Update existing interface** (`createOnIpChange = false`): Updates the existing interface's IP address

## Implementation

### 1. Task Layer - Extract Flag

**File**: `/backend/tasks/update_devices_task.py`

**Changes** (line 353):
```python
interface_fields = [
    "mgmt_interface_name",
    "mgmt_interface_type",
    "mgmt_interface_status",
    "mgmt_interface_create_on_ip_change",  # NEW
    "namespace",
]
```

The task now extracts the `mgmt_interface_create_on_ip_change` flag from the device data and includes it in the interface_config dict passed to the service.

### 2. DeviceCommonService - Find Interface with IP

**File**: `/backend/services/device_common_service.py`

**New Method** (lines 201-270): `find_interface_with_ip()`

```python
async def find_interface_with_ip(
    self, device_name: str, ip_address: str
) -> Optional[Tuple[str, str]]:
    """
    Find the interface that currently has a specific IP address on a device.

    Args:
        device_name: Name of the device
        ip_address: IP address to search for (in CIDR notation)

    Returns:
        Tuple of (interface_id, interface_name) if found, None otherwise
    """
```

**GraphQL Query**:
```graphql
query ($filter_device: [String], $filter_address: [String]) {
  devices(name: $filter_device) {
    id
    name
    interfaces(ip_addresses: $filter_address) {
      id
      name
    }
  }
}
```

This method queries Nautobot to find which interface on a device currently has a specific IP address configured.

### 3. DeviceUpdateService - Main Logic

**File**: `/backend/services/device_update_service.py`

#### 3a. Extract Current Primary IP (lines 140-146)

Before updating the device, we extract the current `primary_ip4` address from the device's current state:

```python
# Extract current primary_ip4 for updating existing interface
current_primary_ip4 = None
if details["before"].get("primary_ip4"):
    primary_ip4_obj = details["before"]["primary_ip4"]
    if isinstance(primary_ip4_obj, dict):
        current_primary_ip4 = primary_ip4_obj.get("address")
        logger.info(f"Current primary_ip4: {current_primary_ip4}")
```

#### 3b. Pass Additional Parameters (lines 168-175)

The `_update_device_properties` method now receives:
- `device_name`: For GraphQL lookup
- `current_primary_ip4`: To find the interface to update

```python
updated_fields = await self._update_device_properties(
    device_id=device_id,
    validated_data=validated_data,
    interface_config=interface_config,
    ip_namespace=ip_namespace,
    device_name=device_name,  # NEW
    current_primary_ip4=current_primary_ip4,  # NEW
)
```

#### 3c. Branch Logic (lines 432-460)

The method now branches based on the `createOnIpChange` flag:

```python
# Check if we should create a new interface or update existing
create_new = interface_config.get("mgmt_interface_create_on_ip_change", False)
logger.info(f"Create new interface on IP change: {create_new}")

if create_new:
    # BEHAVIOR 1: Create new interface with new IP (existing behavior)
    logger.info("Creating new interface with new IP address")
    ip_id = await self.common.ensure_interface_with_ip(...)
else:
    # BEHAVIOR 2: Update existing interface's IP address
    logger.info("Updating existing interface's IP address")
    ip_id = await self._update_existing_interface_ip(...)
```

#### 3d. New Method: `_update_existing_interface_ip()` (lines 490-594)

This new method implements the logic for updating an existing interface's IP:

**Workflow**:
1. **Find the interface** with the old IP using GraphQL
2. **Create/get the new IP** address in Nautobot
3. **Assign the new IP** to the existing interface
4. **Return the new IP's UUID** for assignment to device's `primary_ip4`

```python
async def _update_existing_interface_ip(
    self,
    device_id: str,
    device_name: str,
    old_ip: Optional[str],
    new_ip: str,
    namespace: str,
) -> str:
    """
    Update an existing interface's IP address.

    Steps:
    1. Find interface with old IP
    2. Create new IP address
    3. Assign new IP to interface
    4. Return new IP UUID
    """
```

**Fallback Behavior**:
- If old IP is not found → Creates new interface
- If interface not found → Creates new interface
- Ensures the operation never fails due to missing data

## Data Flow

### Scenario 1: Create New Interface (`createOnIpChange = true`)

```
User changes IP with checkbox ON
        ↓
Frontend sends:
  {
    "id": "device-uuid",
    "primary_ip4": "10.0.0.2/24",
    "mgmt_interface_create_on_ip_change": true
  }
        ↓
Backend extracts flag → true
        ↓
DeviceUpdateService._update_device_properties()
        ↓
if create_new == true:
    ensure_interface_with_ip()  # Creates NEW interface
        ↓
New interface "Loopback1" created with IP 10.0.0.2/24
Old interface "Loopback0" still has IP 10.0.0.1/24
Device primary_ip4 → 10.0.0.2/24
```

### Scenario 2: Update Existing Interface (`createOnIpChange = false`)

```
User changes IP with checkbox OFF
        ↓
Frontend sends:
  {
    "id": "device-uuid",
    "primary_ip4": "10.0.0.2/24",
    "mgmt_interface_create_on_ip_change": false
  }
        ↓
Backend extracts:
  - Flag → false
  - Current primary_ip4 → "10.0.0.1/24"
  - Device name → "ROUTER-01"
        ↓
DeviceUpdateService._update_device_properties()
        ↓
if create_new == false:
    _update_existing_interface_ip()
        ↓
Step 1: find_interface_with_ip("ROUTER-01", "10.0.0.1/24")
        → Returns ("interface-uuid", "Loopback0")
        ↓
Step 2: ensure_ip_address_exists("10.0.0.2/24", "Global")
        → Returns "new-ip-uuid"
        ↓
Step 3: assign_ip_to_interface("interface-uuid", "new-ip-uuid")
        → Adds new IP to interface
        ↓
Result:
  Interface "Loopback0" now has BOTH:
    - 10.0.0.1/24 (old IP)
    - 10.0.0.2/24 (new IP)
  Device primary_ip4 → 10.0.0.2/24
```

## Important Notes

### Multiple IPs per Interface

Nautobot allows multiple IP addresses on a single interface. When updating an existing interface's IP:
- The **new IP is added** to the interface
- The **old IP remains** on the interface
- This is standard Nautobot behavior (interfaces can have multiple IPs)

If you want to remove the old IP, you would need to implement additional logic to:
1. Get the old IP's UUID
2. Call Nautobot API to remove it from the interface

### Primary IP Assignment

After updating the interface's IP, the device's `primary_ip4` is set to the new IP UUID. Nautobot automatically handles this assignment when you PATCH the device with `primary_ip4: new_ip_uuid`.

### Error Handling

The implementation includes comprehensive fallback logic:
- If no old IP found → Creates new interface
- If interface not found → Creates new interface
- If GraphQL query fails → Creates new interface
- Ensures updates never fail due to missing old data

## Testing

### Test Case 1: Update Existing Interface

**Setup**:
- Device: `LAB`
- Current IP: `10.0.0.1/24` on interface `Loopback0`
- Checkbox: OFF (`createOnIpChange = false`)

**Action**: Change primary_ip4 to `10.0.0.2/24`

**Expected**:
1. GraphQL finds `Loopback0` has `10.0.0.1/24`
2. New IP `10.0.0.2/24` created in Nautobot
3. New IP assigned to `Loopback0`
4. Device `primary_ip4` updated to `10.0.0.2/24`
5. `Loopback0` now has both IPs

### Test Case 2: Create New Interface

**Setup**:
- Same device
- Checkbox: ON (`createOnIpChange = true`)

**Action**: Change primary_ip4 to `10.0.0.3/24`

**Expected**:
1. New interface created (name from properties)
2. New IP `10.0.0.3/24` assigned to new interface
3. Device `primary_ip4` updated to `10.0.0.3/24`
4. Old `Loopback0` unchanged

### Test Case 3: First IP Assignment

**Setup**:
- Device has no `primary_ip4`
- Checkbox: OFF

**Action**: Set primary_ip4 to `10.0.0.1/24`

**Expected**:
1. No old IP found → Fallback
2. Creates new interface `Loopback` (default)
3. Assigns IP to new interface
4. Device `primary_ip4` set

## Logging

The implementation includes detailed logging:

```
[INFO] Current primary_ip4: 10.0.0.1/24
[INFO] Create new interface on IP change: False
[INFO] Updating existing interface's IP address
[INFO] Updating existing interface IP from 10.0.0.1/24 to 10.0.0.2/24 on device LAB
[INFO] Finding interface with IP 10.0.0.1/24 on device LAB
[INFO] Found interface 'Loopback0' (ID: abc-123) with IP 10.0.0.1/24
[INFO] Ensuring IP address 10.0.0.2/24 exists in namespace Global
[INFO] Assigning IP 10.0.0.2/24 (ID: def-456) to interface Loopback0
[INFO] ✓ Successfully updated interface Loopback0 with new IP 10.0.0.2/24
```

## Files Modified

### Backend
1. `/backend/tasks/update_devices_task.py` - Extract `mgmt_interface_create_on_ip_change` flag
2. `/backend/services/device_common_service.py` - Add `find_interface_with_ip()` method
3. `/backend/services/device_update_service.py` - Implement branching logic and `_update_existing_interface_ip()`

### Frontend
- No changes needed (already implemented in previous step)

## Future Enhancements

### Remove Old IP

To remove the old IP instead of keeping both:

```python
# After assigning new IP
if old_ip and old_ip != new_ip:
    # Get old IP UUID
    old_ip_id = await self._get_ip_address_uuid(old_ip, namespace)
    if old_ip_id:
        # Remove old IP from interface
        await self.nautobot.rest_request(
            endpoint=f"dcim/interfaces/{interface_id}/",
            method="PATCH",
            data={
                "ip_addresses": {
                    "remove": [old_ip_id]
                }
            }
        )
```

### Update Interface Properties

Optionally update the interface's name, type, or status when updating IP:

```python
# In _update_existing_interface_ip
if interface_config.get("name"):
    await self.nautobot.rest_request(
        endpoint=f"dcim/interfaces/{interface_id}/",
        method="PATCH",
        data={
            "name": interface_config["name"],
            "type": interface_config["type"],
            "status": interface_config["status"],
        }
    )
```

## Related Documentation

- [BULK_EDIT_CREATE_INTERFACE_OPTION.md](BULK_EDIT_CREATE_INTERFACE_OPTION.md) - Frontend implementation
- [BULK_EDIT_JSON_IMPLEMENTATION.md](BULK_EDIT_JSON_IMPLEMENTATION.md) - JSON-based endpoint
- [GRAPHQL_FIXES.md](GRAPHQL_FIXES.md) - GraphQL array types
