# Import Data Flow Analysis

## Two Different Import/Add Apps

### 1. **Bulk Edit App** (`/nautobot/tools/bulk-edit`)
- **Purpose**: Update existing devices in Nautobot
- **Data Source**: Device selector (filters/conditions) + manual edits in UI
- **Does NOT use CSV import**

### 2. **Add Device App** (`/nautobot-add-device`)
- **Purpose**: Add new devices to Nautobot
- **Data Sources**:
  - Manual form entry
  - CSV file import (via "Import from CSV" button)

---

## Data Flow Comparison

### Bulk Edit (Update Devices)

**Frontend Flow**:
```
User selects devices → User edits properties → Preview Changes → Save
                                                                    ↓
                                            Converts to CSV format internally
                                                                    ↓
                        POST /api/celery/tasks/update-devices-from-csv
                                                                    ↓
                                            Backend Celery Task
                                                                    ↓
                                        DeviceUpdateService (refactored)
```

**Data Format Sent**:
```json
{
  "csv_content": "id,name,primary_ip4,mgmt_interface_name,mgmt_interface_type,mgmt_interface_status,namespace\n<uuid>,device1,10.0.0.1,eth0,1000base-t,active,Global\n...",
  "csv_options": {
    "delimiter": ",",
    "quoteChar": "\""
  },
  "dry_run": false
}
```

**Backend Endpoint**: `/api/celery/tasks/update-devices-from-csv`
**Backend Task**: `update_devices_task_refactored.py`
**Backend Service**: `DeviceUpdateService`

**Key Fields in CSV**:
- `id` or `name` or `ip_address` (device identifier)
- `primary_ip4` (IP address to assign)
- `mgmt_interface_name` (interface name)
- `mgmt_interface_type` (interface type ID)
- `mgmt_interface_status` (interface status ID)
- `namespace` (namespace ID)
- Any other device properties to update

---

### Add Device - Manual Entry

**Frontend Flow**:
```
User fills form → Clicks "Add Device" → Validates
                                          ↓
                    POST /api/proxy/nautobot/add-device
                                          ↓
                                Backend Router
                                          ↓
                            device_creation_service.py
```

**Data Format Sent** (lines 814-826 in add-device-page.tsx):
```json
{
  "name": "device-name",
  "serial": "ABC123",
  "role": "<role-uuid>",
  "status": "<status-uuid>",
  "location": "<location-uuid>",
  "device_type": "<device-type-uuid>",
  "platform": "<platform-uuid>",
  "software_version": "<software-version-uuid>",
  "tags": ["<tag-uuid-1>", "<tag-uuid-2>"],
  "custom_fields": {
    "custom_field_key": "value"
  },
  "interfaces": [
    {
      "id": "1",
      "name": "eth0",
      "type": "<interface-type-id>",
      "status": "<interface-status-id>",
      "ip_address": "10.0.0.1/24",
      "namespace": "<namespace-uuid>",
      "is_primary_ipv4": true,
      "enabled": true,
      "mgmt_only": false,
      "description": "Management interface",
      "mac_address": "00:1A:2B:3C:4D:5E",
      "mtu": 1500,
      "mode": "access",
      "untagged_vlan": "<vlan-uuid>",
      "tagged_vlans": "<vlan-uuid-1>,<vlan-uuid-2>",
      "parent_interface": "<interface-uuid>",
      "bridge": "<interface-uuid>",
      "lag": "<interface-uuid>",
      "tags": ["tag1", "tag2"]
    }
  ]
}
```

**Backend Endpoint**: `/nautobot/add-device`
**Backend Service**: `device_creation_service.py` (old onboarding service)

**Key Characteristics**:
- All UUIDs are pre-resolved in frontend
- Rich interface configuration (VLANs, LAG, bridge, etc.)
- Tags and custom fields included
- Single device at a time

---

### Add Device - CSV Import

**Frontend Flow**:
```
User uploads CSV → Parse CSV → Resolve names to IDs → Import Devices
                                                            ↓
                                        For each device in CSV:
                                        POST /api/proxy/nautobot/add-device
                                                            ↓
                                                    Backend Router
                                                            ↓
                                                device_creation_service.py
```

**CSV Import Process** (lines 246-365 in add-device-page.tsx):

1. **Parse CSV** (frontend):
   - Read CSV file
   - Parse headers and rows
   - Group rows by device name (multiple rows = multiple interfaces)
   - Validate data

2. **Resolve IDs** (lines 258-290):
   - Convert names to UUIDs using frontend dropdown data:
     - `role` name → role UUID
     - `status` name → status UUID
     - `location` name/path → location UUID
     - `device_type` name → device type UUID
     - `interface_type` name → interface type ID
     - `interface_status` name → interface status ID
     - `namespace` name → namespace UUID

3. **Import Each Device** (line 329-336):
   - Call same `/api/proxy/nautobot/add-device` endpoint
   - Send same JSON format as manual entry
   - Process one device at a time

**Data Format**:
- **Same JSON format as manual entry** after resolution
- CSV is only used for initial parsing in frontend
- Backend receives resolved JSON with UUIDs

**Backend Endpoint**: **SAME** `/nautobot/add-device`
**Backend Service**: **SAME** `device_creation_service.py`

**CSV Example**:
```csv
name,role,location,device_type,serial,interface_name,interface_type,interface_status,ip_address,namespace,is_primary_ipv4
switch-01,Access Switch,Building A > Floor 1,Cisco C9300-48P,SN123,GigabitEthernet1/0/1,1000base-t,Active,10.1.1.1/24,Global,true
switch-01,Access Switch,Building A > Floor 1,Cisco C9300-48P,SN123,GigabitEthernet1/0/2,1000base-t,Active,,,false
```

**Key Characteristics**:
- CSV processed entirely in frontend
- Names resolved to UUIDs in frontend
- Backend receives same JSON format as manual entry
- No CSV sent to backend
- Can have multiple rows per device (for multiple interfaces)

---

## Summary Table

| Feature | Bulk Edit | Manual Add Device | CSV Import Add Device |
|---------|-----------|-------------------|----------------------|
| **Purpose** | Update existing | Create new | Create new (bulk) |
| **Data to Backend** | CSV string | JSON object | JSON object (per device) |
| **Format** | CSV in request body | Rich JSON with UUIDs | Same as manual add |
| **Backend Endpoint** | `/api/celery/tasks/update-devices-from-csv` | `/nautobot/add-device` | `/nautobot/add-device` |
| **Backend Task** | Celery task | Direct API call | Direct API call (loop) |
| **Backend Service** | `DeviceUpdateService` | `device_creation_service.py` | `device_creation_service.py` |
| **ID Resolution** | Backend (in task) | Frontend | Frontend |
| **CSV Processing** | Backend (in task) | N/A | Frontend only |
| **Progress Tracking** | Celery + Job Run | Inline response | Sequential (frontend loop) |
| **Multiple Devices** | Yes (in CSV) | No | Yes (sequential API calls) |

---

## Key Insight

**The CSV import in "Add Device" app does NOT send CSV to the backend!**

Instead:
1. Frontend parses CSV
2. Frontend resolves all names to UUIDs
3. Frontend makes **individual API calls** to `/nautobot/add-device` for each device
4. Each call sends the same rich JSON format as manual entry

This is **completely different** from Bulk Edit, which:
1. Converts UI edits to CSV format
2. Sends CSV string to Celery task endpoint
3. Backend parses CSV and processes updates

---

## Commonality Between Add Device Apps

Both manual and CSV import in "Add Device" share:
- ✅ Same backend endpoint: `/nautobot/add-device`
- ✅ Same JSON data format
- ✅ Same backend service: `device_creation_service.py`
- ✅ ID resolution happens in frontend
- ✅ Rich interface configuration support

The only difference is **how the data is gathered**:
- Manual: Form inputs
- CSV: File upload → parse → transform to same JSON format
