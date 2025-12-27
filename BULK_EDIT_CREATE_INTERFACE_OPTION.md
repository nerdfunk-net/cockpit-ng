# Bulk Edit - Add New Interface When IP Changes Option

## Summary

Added a new checkbox option "Add new Interface when IP changes" to the bulk edit app's Interface Configuration panel. This option controls whether a new interface should be automatically created when updating a device's primary IP address.

## Frontend Changes

### 1. Type Definition - `InterfaceConfig`

**File**: `/frontend/src/components/bulk-edit/bulk-edit-page.tsx`

**Changes** (lines 22-27):
```typescript
export interface InterfaceConfig {
  name: string
  type: string
  status: string
  createOnIpChange: boolean  // NEW PROPERTY
}
```

### 2. Default Value

**File**: `/frontend/src/components/bulk-edit/bulk-edit-page.tsx`

**Changes** (lines 45-50):
```typescript
const DEFAULT_INTERFACE_CONFIG: InterfaceConfig = {
  name: '',
  type: '1000base-t',
  status: 'active',
  createOnIpChange: false,  // NEW DEFAULT VALUE
}
```

### 3. Properties Tab UI - New Checkbox

**File**: `/frontend/src/components/bulk-edit/tabs/properties-tab.tsx`

**Added Handler Function** (lines 111-119):
```typescript
const handleCreateOnIpChangeChange = (checked: boolean) => {
  onPropertiesChange({
    ...properties,
    interfaceConfig: {
      ...properties.interfaceConfig,
      createOnIpChange: checked,
    },
  })
}
```

**Added Checkbox UI** (lines 226-242):
```typescript
{/* Add new Interface when IP changes */}
<div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
  <div className="flex items-center justify-between">
    <div className="space-y-1 flex-1">
      <Label htmlFor="create-on-ip-change" className="text-sm font-medium text-gray-700">
        Add new Interface when IP changes
      </Label>
      <p className="text-sm text-gray-600">
        Automatically create a new interface when the primary IP address is updated
      </p>
    </div>
    <Switch
      id="create-on-ip-change"
      checked={properties.interfaceConfig.createOnIpChange}
      onCheckedChange={handleCreateOnIpChangeChange}
      className="ml-4"
    />
  </div>
</div>
```

### 4. JSON Converter - Pass to Backend

**File**: `/frontend/src/components/bulk-edit/utils/json-converter.ts`

**Updated Function Signature** (line 95):
```typescript
export function convertModifiedDevicesToJSON(
  modifiedDevices: Map<string, Partial<DeviceInfo>>,
  interfaceConfig?: {
    name: string
    type: string
    status: string
    createOnIpChange: boolean  // ADDED
  },
  namespace?: string
): Array<Record<string, unknown>>
```

**Updated Interface Config Handling** (lines 121-126):
```typescript
// If primary_ip4 is being changed and we have interface config, add interface fields
if ('primary_ip4' in changes && interfaceConfig) {
  device.mgmt_interface_name = interfaceConfig.name
  device.mgmt_interface_type = interfaceConfig.type
  device.mgmt_interface_status = interfaceConfig.status
  device.mgmt_interface_create_on_ip_change = interfaceConfig.createOnIpChange  // ADDED
}
```

## Data Flow

### User Interaction Flow

1. User navigates to **Bulk Edit** app
2. Goes to **Properties** tab
3. Sees new checkbox in **Interface Configuration** section
4. Toggles checkbox on/off (default: off)
5. Modifies devices in **Bulk Edit** tab
6. Clicks **Save Changes**

### Technical Flow

```
User toggles checkbox
        ↓
handleCreateOnIpChangeChange() called
        ↓
properties.interfaceConfig.createOnIpChange updated
        ↓
User clicks "Save Changes"
        ↓
handleSaveDevices() called
        ↓
convertModifiedDevicesToJSON(modifiedDevices, properties.interfaceConfig, namespace)
        ↓
For each device with primary_ip4 change:
  {
    "id": "device-uuid",
    "primary_ip4": "10.0.0.1/24",
    "mgmt_interface_name": "Loopback0",
    "mgmt_interface_type": "virtual",
    "mgmt_interface_status": "active",
    "mgmt_interface_create_on_ip_change": false,  // NEW FIELD
    "namespace": "Global"
  }
        ↓
POST /api/celery/tasks/update-devices
        ↓
Backend receives createOnIpChange flag
```

## JSON Payload Example

### When Checkbox is OFF (default)

```json
{
  "devices": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "primary_ip4": "10.1.1.1/24",
      "mgmt_interface_name": "Loopback0",
      "mgmt_interface_type": "virtual",
      "mgmt_interface_status": "active",
      "mgmt_interface_create_on_ip_change": false,
      "namespace": "Global"
    }
  ],
  "dry_run": false
}
```

### When Checkbox is ON

```json
{
  "devices": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "primary_ip4": "10.1.1.1/24",
      "mgmt_interface_name": "Loopback0",
      "mgmt_interface_type": "virtual",
      "mgmt_interface_status": "active",
      "mgmt_interface_create_on_ip_change": true,
      "namespace": "Global"
    }
  ],
  "dry_run": false
}
```

## UI Location

**Path**: Bulk Edit → Properties Tab → Interface Configuration Section

**Visual Structure**:
```
┌─────────────────────────────────────────────────────┐
│ Interface Configuration                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│ │ Interface    │  │ Interface    │  │ Status   │  │
│ │ Name         │  │ Type         │  │          │  │
│ └──────────────┘  └──────────────┘  └──────────┘  │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ ✓ Add new Interface when IP changes         │   │
│ │   Automatically create a new interface      │   │
│ │   when the primary IP address is updated    │   │
│ └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Backend Integration (Next Step)

The frontend now passes the `mgmt_interface_create_on_ip_change` field to the backend. The next step is to update the backend to use this flag.

### Expected Backend Behavior

When `mgmt_interface_create_on_ip_change` is:

**`false` (default)**:
- Update existing interface's IP address
- Do NOT create a new interface
- Reuse existing interface if it exists

**`true`**:
- Create a new interface with the new IP address
- Use the provided interface name, type, and status
- Keep the old interface unchanged

### Files to Update in Backend

1. **`/backend/tasks/update_devices_task.py`**
   - Extract `mgmt_interface_create_on_ip_change` from device data
   - Pass to DeviceUpdateService

2. **`/backend/services/device_update_service.py`**
   - Update `_update_device_properties()` to accept `create_new_interface` flag
   - Modify interface creation logic based on flag

3. **`/backend/services/device_common_service.py`**
   - Update `ensure_interface_with_ip()` to support creating new interface vs updating existing
   - Add `create_new` parameter

## Testing Checklist

### Frontend Tests
- [x] Checkbox renders in Properties tab
- [x] Checkbox toggles on/off
- [x] Default value is `false`
- [x] State is preserved during tab switching
- [x] JSON converter includes `mgmt_interface_create_on_ip_change` field
- [ ] Value is sent to backend when saving

### Backend Tests (After Implementation)
- [ ] Backend receives `mgmt_interface_create_on_ip_change` field
- [ ] When `false`: Updates existing interface IP
- [ ] When `true`: Creates new interface with new IP
- [ ] Interface config (name, type, status) is used correctly
- [ ] Existing interface is preserved when creating new one

## Files Modified

### Frontend
1. `/frontend/src/components/bulk-edit/bulk-edit-page.tsx` - Type definition and default value
2. `/frontend/src/components/bulk-edit/tabs/properties-tab.tsx` - UI checkbox and handler
3. `/frontend/src/components/bulk-edit/utils/json-converter.ts` - JSON payload generation

### Backend (Pending)
1. `/backend/tasks/update_devices_task.py` - Extract and pass flag
2. `/backend/services/device_update_service.py` - Use flag in interface logic
3. `/backend/services/device_common_service.py` - Support create vs update

## User Experience

### Scenario 1: Update IP Without Creating New Interface (Default)

1. User selects devices with `primary_ip4 = 10.0.0.1/24` on `Loopback0`
2. Checkbox is **OFF** (default)
3. User changes `primary_ip4` to `10.0.0.2/24`
4. **Result**: `Loopback0` interface now has IP `10.0.0.2/24`

### Scenario 2: Update IP With New Interface

1. User selects devices with `primary_ip4 = 10.0.0.1/24` on `Loopback0`
2. User **enables** checkbox
3. User changes interface name to `Loopback1`
4. User changes `primary_ip4` to `10.0.0.2/24`
5. **Result**:
   - New interface `Loopback1` created with IP `10.0.0.2/24`
   - Old interface `Loopback0` still has IP `10.0.0.1/24`

## Next Steps

1. ✅ Frontend implementation complete
2. ⏭️ Backend implementation needed:
   - Update task to extract flag
   - Update service to use flag
   - Test with both checkbox states

## Related Documentation

- [BULK_EDIT_JSON_IMPLEMENTATION.md](BULK_EDIT_JSON_IMPLEMENTATION.md) - JSON-based bulk update endpoint
- [CSV_UPLOAD_BULK_EDIT.md](CSV_UPLOAD_BULK_EDIT.md) - CSV upload feature in Bulk Edit
