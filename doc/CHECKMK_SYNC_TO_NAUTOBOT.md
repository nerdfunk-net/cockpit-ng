# CheckMK to Nautobot Device Sync Architecture

## Overview

The CheckMK to Nautobot Device Sync system provides a streamlined workflow for discovering devices in CheckMK and synchronizing them to Nautobot as IPAM/DCIM records. It connects to CheckMK hosts, retrieves their inventory data and configuration details, and creates or updates corresponding device records in Nautobot complete with interfaces, IP addresses, and metadata.

The system uses a **property mapping framework** where CheckMK attributes (tags, labels, custom attributes) are mapped to Nautobot fields (location, device role, device type, custom fields, etc.). This allows flexible transformation of CheckMK data into the structured Nautobot data model.

### Key Features

- ✅ **CheckMK Host Discovery** - Browse CheckMK hosts with filtering and search
- ✅ **Automatic Device Detection** - Check if host already exists in Nautobot
- ✅ **Property Mapping** - Map CheckMK attributes to Nautobot fields
- ✅ **Interface Discovery** - Parse CheckMK inventory for network interfaces
- ✅ **IP Address Mapping** - Assign multiple IPs per interface with roles
- ✅ **Validation Framework** - Pre-sync validation of required fields and IP formats
- ✅ **Create or Update** - Automatically detects whether to create new or update existing device
- ✅ **Shared Form Components** - Reuses add-device form components for consistent UX

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Next.js/React)                          │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  CheckMK Hosts Inventory Page                                        │  │
│  │  hosts-inventory-page.tsx                                            │  │
│  │                                                                      │  │
│  │  - Display CheckMK hosts in table                                    │  │
│  │  - Filter by folder, label, hostname                                 │  │
│  │  - Sort and pagination                                               │  │
│  │  - Select hosts for operations                                       │  │
│  │  - "Sync to Nautobot" button per host                                │  │
│  └──────────────────────────────┬───────────────────────────────────────┘  │
│                                 │                                          │
│                                 ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Device Sync Modal (device-sync-modal.tsx)                           │  │
│  │                                                                      │  │
│  │  - Property mapping interface (CheckMK → Nautobot)                   │  │
│  │  - Interface table with IP assignment                                │  │
│  │  - Uses shared device form components:                               │  │
│  │    • DeviceInfoForm (name, location, role, type, status)             │  │
│  │    • InterfaceTable (interfaces with IPs)                            │  │
│  │    • PrefixConfiguration (auto-create prefixes)                      │  │
│  │  - Validation before sync                                            │  │
│  │  - Create/Update mode detection                                      │  │
│  └──────────────────────────────┬───────────────────────────────────────┘  │
│                                 │                                          │
│                                 │                                          │
│  ┌──────────────────────────────┴───────────────────────────────────────┐  │
│  │  Custom Hooks                                                        │  │
│  │                                                                      │  │
│  │  use-nautobot-sync.ts                                                │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │ handleSyncToNautobot(host)                                     │  │  │
│  │  │ 1. Search for device in Nautobot by name                       │  │  │
│  │  │ 2. Load Nautobot metadata (locations, roles, types, etc.)      │  │  │
│  │  │ 3. Load CheckMK inventory data for interfaces                  │  │  │
│  │  │ 4. Initialize property mappings                                │  │  │
│  │  │ 5. Open sync modal                                             │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                      │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │ executeSyncToNautobot(formData, deviceId?)                     │  │  │
│  │  │ 1. Format form data for submission                             │  │  │
│  │  │ 2. If device exists → PATCH /devices/{id}                      │  │  │
│  │  │ 3. If new device → POST /add-device                            │  │  │
│  │  │ 4. Close modal on success                                      │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                      │  │
│  │  use-checkmk-hosts-query.ts (TanStack Query)                         │  │
│  │  - Fetch CheckMK hosts from backend                                  │  │
│  │  - Cache management and auto-refresh                                 │  │
│  │                                                                      │  │
│  │  use-checkmk-config.ts                                               │  │
│  │  - Load CheckMK configuration (sites, folders)                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Shared Utilities                                                    │  │
│  │                                                                      │  │
│  │  transform-checkmk-data.ts                                           │  │
│  │  - transformCheckMKToFormData()                                      │  │
│  │    • Parse property mappings                                         │  │
│  │    • Resolve Nautobot IDs from names                                 │  │
│  │    • Build interfaces array from interface mappings                  │  │
│  │    • Set primary IP logic                                            │  │
│  │                                                                      │  │
│  │  property-mapping-utils.ts                                           │  │
│  │  - initializePropertyMappings()                                      │  │
│  │    • Map CheckMK tags/labels to Nautobot fields                      │  │
│  │    • Core mappings vs. custom field mappings                         │  │
│  │                                                                      │  │
│  │  interface-mapping-utils.ts                                          │  │
│  │  - parseInterfacesFromInventory()                                    │  │
│  │    • Extract interfaces from CheckMK inventory                       │  │
│  │    • Parse IP addresses with netmask/CIDR                            │  │
│  │    • Determine interface operational status                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────┬───────────────────────────┘
                                                 │
                                                 │ API Calls
                                                 │
                    ┌────────────────────────────┴────────────────────────┐
                    │                                                     │
                    ▼                                                     ▼
┌──────────────────────────────────────┐    ┌───────────────────────────────┐
│    BACKEND (FastAPI)                 │    │   NAUTOBOT (External System)  │
│                                      │    │                               │
│  ┌────────────────────────────────┐  │    │  ┌─────────────────────────┐  │
│  │  REST API Routers              │  │    │  │  REST API               │  │
│  │                                │  │    │  │                         │  │
│  │  routers/nautobot/devices.py   │  │    │  │  POST /api/dcim/        │  │
│  │                                │  │    │  │  devices/               │  │
│  │  POST /api/nautobot/add-device │──┼────▶  │  Create device          │  │
│  │  - Create device with          │  │    │  │                         │  │
│  │    interfaces                  │  │    │  │  PATCH /api/dcim/       │  │
│  │  - Uses device_creation_       │  │    │  │  devices/{id}/          │  │
│  │    service                     │  │    │  │  Update device          │  │
│  │                                │  │    │  │                         │  │
│  │  PATCH /api/nautobot/          │  │    │  │  POST /api/ipam/        │  │
│  │  devices/{device_id}           │──┼────▶  │  ip-addresses/          │  │
│  │  - Update existing device      │  │    │  │  Create IPs             │  │
│  │  - Uses DeviceUpdateService    │  │    │  │                         │  │
│  │                                │  │    │  │  POST /api/dcim/        │  │
│  │  GET /api/nautobot/devices     │  │    │  │  interfaces/            │  │
│  │  - List/search devices         │◀─┼────│  │  Create interfaces      │  │
│  │  - Filter by name              │  │    │  │                         │  │
│  │                                │  │    │  │  PATCH /api/ipam/       │  │
│  │  GET /api/nautobot/            │  │    │  │  ip-addresses/{id}/     │  │
│  │  devices/{id}                  │  │    │  │  Update IP properties   │  │
│  │  - Get device details          │◀─┼────│  │                         │  │
│  └────────────────────────────────┘  │    │  └─────────────────────────┘  │
│                                      │    │                               │
│  ┌────────────────────────────────┐  │    │  ┌─────────────────────────┐  │
│  │  CheckMK Integration           │  │    │  │  GraphQL API            │  │
│  │                                │  │    │  │                         │  │
│  │  routers/checkmk/              │  │    │  │  Query devices          │  │
│  │                                │  │    │  │  Query locations        │  │
│  │  GET /api/checkmk/hosts        │  │    │  │  Query roles            │  │
│  │  - List CheckMK hosts          │  │    │  │  Query device types     │  │
│  │                                │  │    │  │  Query platforms        │  │
│  │  GET /api/checkmk/inventory/   │  │    │  └─────────────────────────┘  │
│  │  {host_name}                   │  │    │                               │
│  │  - Fetch host inventory data   │  │    └───────────────────────────────┘
│  │  - Parse network interfaces    │  │
│  │  - IP addresses and netmasks   │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Services                      │  │
│  │                                │  │
│  │  device_creation_service       │  │
│  │  - Orchestrates device         │  │
│  │    creation workflow           │  │
│  │  - Validates data              │  │
│  │  - Creates device record       │  │
│  │  - Creates IP addresses        │  │
│  │  - Creates interfaces          │  │
│  │  - Assigns IPs to interfaces   │  │
│  │  - Sets primary IPv4           │  │
│  │                                │  │
│  │  DeviceUpdateService           │  │
│  │  - Updates device properties   │  │
│  │  - Handles interface updates   │  │
│  │  - Uses InterfaceManager       │  │
│  │                                │  │
│  │  InterfaceManagerService       │  │
│  │  - Create/update interfaces    │  │
│  │  - Create IP addresses         │  │
│  │  - Assign IPs to interfaces    │  │
│  │  - Handle ip_addresses array   │  │
│  │  - Set IP roles                │  │
│  │  - Clean up old assignments    │  │
│  └────────────────────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

---

## Workflow Description

### 1. Browse CheckMK Hosts

**Page:** [hosts-inventory-page.tsx](frontend/src/components/features/checkmk/hosts-inventory/hosts-inventory-page.tsx)

Users start by viewing the CheckMK hosts inventory:

```
User Actions:
1. Navigate to CheckMK Hosts Inventory page
2. View table of all CheckMK hosts
3. Filter by:
   - Hostname (text search)
   - Folder (dropdown)
   - Labels (dropdown)
4. Sort by any column
5. Paginate through results
6. Select hosts for bulk operations
7. Click "Sync to Nautobot" for individual host
```

**Data Loading:**
- TanStack Query fetches hosts from `GET /api/checkmk/hosts`
- Hosts cached for performance
- Auto-refresh on focus/interval
- Real-time filtering and sorting on client

---

### 2. Initiate Sync to Nautobot

**Hook:** [use-nautobot-sync.ts](frontend/src/components/features/checkmk/hosts-inventory/hooks/use-nautobot-sync.ts)

When user clicks "Sync to Nautobot" for a host:

```typescript
handleSyncToNautobot(host: CheckMKHost) {
  // 1. Search for existing device in Nautobot
  GET /api/nautobot/devices?filter_type=name&filter_value={host_name}
  
  // 2. Load Nautobot metadata in parallel
  Promise.all([
    GET /api/nautobot/locations
    GET /api/nautobot/roles/devices
    GET /api/nautobot/statuses/device
    GET /api/nautobot/device-types
    GET /api/nautobot/platforms
    GET /api/nautobot/custom-fields?content_type=dcim.device
    GET /api/nautobot/statuses/ipaddress
    GET /api/nautobot/ip-roles
  ])
  
  // 3. Load CheckMK inventory data
  GET /api/checkmk/inventory/{host_name}
  
  // 4. Initialize property mappings
  initializePropertyMappings(host)
  // Maps CheckMK tags/labels → Nautobot fields
  // Example: tag_location:datacenter-1 → location field
  
  // 5. Parse interfaces from inventory
  parseInterfacesFromInventory(inventoryData)
  // Extract interfaces with IP addresses
  // Convert netmasks to CIDR notation
  // Determine operational status
  
  // 6. Open Device Sync Modal
  setIsSyncModalOpen(true)
}
```

**Property Mapping Initialization:**

The system analyzes CheckMK host attributes and creates mappings:

```typescript
// Core mappings (device properties)
{
  "alias": {
    nautobotField: "name",
    value: "router-01",
    isCore: true
  },
  "tag_location": {
    nautobotField: "location",
    value: "Datacenter-1",
    isCore: true
  },
  "tag_role": {
    nautobotField: "role",
    value: "router",
    isCore: true
  }
}

// Custom field mappings
{
  "tag_environment": {
    nautobotField: "cf_environment",
    value: "production",
    isCore: false
  }
}
```

**Interface Mapping Creation:**

For each network interface found in inventory:

```typescript
{
  "interface_0": {
    enabled: true,
    ipRole: "primary",
    status: "Active",
    ipAddress: "192.168.1.1/24",
    interfaceName: "GigabitEthernet0/0",
    isPrimary: true
  },
  "interface_1": {
    enabled: true,
    ipRole: "secondary",
    status: "Active",
    ipAddress: "10.0.0.1/24",
    interfaceName: "GigabitEthernet0/1",
    isPrimary: false
  }
}
```

---

### 3. Device Sync Modal

**Component:** [device-sync-modal.tsx](frontend/src/components/features/checkmk/modals/device-sync-modal.tsx)

The sync modal displays the discovered CheckMK data and allows editing before sync:

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Sync Device to Nautobot                                  [Close]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Device Information                                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Device Name: [router-01                                   ] │ │
│ │ Location:    [Datacenter-1 / Floor1 / Rack1              ▼] │ │
│ │ Device Role: [Router                                     ▼] │ │
│ │ Device Type: [Cisco ASR 1001-X                           ▼] │ │
│ │ Status:      [Active                                     ▼] │ │
│ │ Platform:    [Cisco IOS-XE                               ▼] │ │
│ │                                                             │ │
│ │ [Tags: 2 selected] [Custom Fields: 3 configured]            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Network Interfaces                                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Name                   Type       Status    IP Addresses    │ │
│ │───────────────────────────────────────────────────────────  │ │
│ │ GigabitEthernet0/0     other      Active    192.168.1.1/24  │ │
│ │                                              (Primary)      │ │
│ │ GigabitEthernet0/1     other      Active    10.0.0.1/24     │ │
│ │                                              (Secondary)    │ │
│ │                                                             │ │
│ │ [+ Add Interface]                                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Prefix Configuration                                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☑ Auto-create missing prefixes in Nautobot                  │ │
│ │ Default prefix length: [/24 ▼]                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                                    [Cancel] [Validate] [Sync]   │
└─────────────────────────────────────────────────────────────────┘
```

**Form Components:**

The modal uses shared components from add-device:

1. **DeviceInfoForm** - Device properties
   - Name, location, role, type, status, platform
   - Serial number, asset tag
   - Tags and custom fields modals

2. **InterfaceTable** - Interface management
   - Add/remove interfaces
   - Configure interface properties
   - Assign IP addresses with roles
   - Set primary IP indicator
   - Open interface properties modal

3. **PrefixConfiguration** - Prefix auto-creation
   - Toggle prefix creation
   - Set default prefix length

**Form State Management:**

Uses React Hook Form with Zod validation:

```typescript
const form = useDeviceForm({
  initialData: transformCheckMKToFormData(
    propertyMappings,
    nautobotMetadata,
    interfaceMappings,
    dropdownData
  ),
  mode: 'update'
})
```

**Data Transformation:**

The `transformCheckMKToFormData` utility converts CheckMK data to form format:

```typescript
{
  deviceName: "router-01",
  selectedLocation: "location-uuid-123",
  selectedRole: "role-uuid-456",
  selectedDeviceType: "device-type-uuid-789",
  selectedStatus: "status-uuid-abc",
  selectedPlatform: "platform-uuid-def",
  interfaces: [
    {
      id: "1",
      name: "GigabitEthernet0/0",
      type: "other",
      status: "Active",
      ip_addresses: [
        {
          id: "1",
          address: "192.168.1.1/24",
          namespace: "Global",
          ip_role: "primary",
          is_primary: true
        }
      ],
      enabled: true,
      mgmt_only: false
    }
  ],
  customFieldValues: {
    environment: "production",
    owner: "network-team"
  }
}
```

---

### 4. Validation

Before syncing, the modal validates all required fields:

**Validation Checks:**

```typescript
✓ Device Role - Required
✓ Device Status - Required
✓ Device Type - Required
✓ Location - Required
✓ Interface Status - All interfaces must have status
✓ IP Addresses - Must be valid CIDR format (x.x.x.x/y)
```

**Validation Modal:**

Shows detailed validation results:

```
┌─────────────────────────────────────┐
│ Validation Results          [Close] │
├─────────────────────────────────────┤
│ ✓ Device Role         [Valid]       │
│ ✓ Device Status       [Valid]       │
│ ✓ Device Type         [Valid]       │
│ ✓ Location            [Valid]       │
│ ✓ Interface Status    [All Valid]   │
│ ✗ IP Addresses        [2 Invalid]   │
│                                     │
│ Errors:                             │
│ • Interface 1, IP 1: Invalid CIDR   │
│ • Interface 2, IP 1: Missing        │
└─────────────────────────────────────┘
```

---

### 5. Execute Sync

When user clicks "Sync to Nautobot":

```typescript
executeSyncToNautobot(formData: DeviceFormValues, deviceId?: string) {
  // 1. Format form data for submission
  const submissionData = formatDeviceSubmissionData(formData)
  // Converts form values to API payload format
  
  // 2. Determine operation (create or update)
  if (existingDeviceId) {
    // Update existing device
    PATCH /api/nautobot/devices/{device_id}
    Body: {
      name: "router-01",
      role: "role-uuid",
      status: "status-uuid",
      device_type: "device-type-uuid",
      location: "location-uuid",
      platform: "platform-uuid",
      custom_fields: { ... },
      interfaces: [
        {
          name: "GigabitEthernet0/0",
          type: "other",
          status: "status-uuid",
          ip_addresses: [
            {
              address: "192.168.1.1/24",
              namespace: "namespace-uuid",
              ip_role: "primary",
              is_primary: true
            }
          ]
        }
      ]
    }
  } else {
    // Create new device
    POST /api/nautobot/add-device
    Body: { ... } // Same structure as PATCH
  }
  
  // 3. Close modal on success
  // 4. Show success message
  // 5. Optionally refresh device list
}
```

---

## Backend Workflow

### 1. Device Creation (New Device)

**Endpoint:** `POST /api/nautobot/add-device`

**Service:** [device_creation_service.py](backend/services/nautobot/devices/creation.py)

```python
async def create_device_with_interfaces(request: AddDeviceRequest):
    """
    Orchestrated workflow:
    1. Validate request data
    2. Create device in Nautobot DCIM
    3. Create IP addresses for all interfaces
    4. Create interfaces
    5. Assign IP addresses to interfaces
    6. Set primary IPv4 address
    """
    
    # Step 1: Create device
    POST /api/dcim/devices/
    {
        "name": "router-01",
        "role": {"id": "role-uuid"},
        "status": {"id": "status-uuid"},
        "device_type": {"id": "device-type-uuid"},
        "location": {"id": "location-uuid"},
        "platform": {"id": "platform-uuid"},
        "custom_fields": { ... }
    }
    → Returns: device_id
    
    # Step 2: Create IP addresses
    for interface in interfaces:
        for ip_address in interface.ip_addresses:
            POST /api/ipam/ip-addresses/
            {
                "address": "192.168.1.1/24",
                "namespace": {"id": "namespace-uuid"},
                "ip_role": "primary",
                "status": {"id": "status-uuid"}
            }
            → Returns: ip_address_id
    
    # Step 3: Create interfaces
    for interface in interfaces:
        POST /api/dcim/interfaces/
        {
            "device": {"id": device_id},
            "name": "GigabitEthernet0/0",
            "type": "other",
            "status": {"id": "status-uuid"},
            "enabled": true,
            "mgmt_only": false
        }
        → Returns: interface_id
    
    # Step 4: Assign IP addresses to interfaces
    for ip_assignment in ip_assignments:
        POST /api/ipam/ip-address-to-interface/
        {
            "ip_address": {"id": ip_address_id},
            "interface": {"id": interface_id}
        }
    
    # Step 5: Set primary IPv4
    primary_ip = find_primary_ip(interfaces)
    PATCH /api/dcim/devices/{device_id}/
    {
        "primary_ip4": {"id": primary_ip_id}
    }
    
    return {
        "success": true,
        "device_id": device_id,
        "message": "Device created successfully"
    }
```

---

### 2. Device Update (Existing Device)

**Endpoint:** `PATCH /api/nautobot/devices/{device_id}`

**Service:** [DeviceUpdateService](backend/services/nautobot/devices/update.py)

```python
async def update_device(
    device_identifier: dict,
    update_data: dict,
    interfaces: list
):
    """
    Update workflow:
    1. Resolve field names to UUIDs
    2. Update device properties
    3. Update interfaces (if provided)
    4. Verify updates applied
    """
    
    # Step 1: Update device properties
    PATCH /api/dcim/devices/{device_id}/
    {
        "role": {"id": "role-uuid"},
        "status": {"id": "status-uuid"},
        "location": {"id": "location-uuid"},
        "custom_fields": { ... }
    }
    
    # Step 2: Update interfaces (if provided)
    if interfaces:
        await interface_manager.update_device_interfaces(
            device_id=device_id,
            interfaces=interfaces
        )
    
    # InterfaceManager handles:
    # - Create/update interfaces
    # - Create/update IP addresses
    # - Handle ip_addresses array format
    # - Set IP roles
    # - Assign IPs to interfaces
    # - Update primary IPv4
    # - Clean up old assignments
    
    return {
        "success": true,
        "updated_fields": [...],
        "warnings": [...],
        "message": "Device updated successfully"
    }
```

**InterfaceManager Service:**

[interface_manager.py](backend/services/nautobot/devices/interface_manager.py)

Handles the complex interface update workflow:

```python
async def update_device_interfaces(
    device_id: str,
    interfaces: List[Dict[str, Any]]
):
    """
    Complete interface update workflow:
    1. Create all IP addresses first
    2. Create or update each interface
    3. Assign IP addresses to interfaces
    4. Set IP roles (primary/secondary)
    5. Update device primary IPv4
    6. Clean up old assignments (optional)
    """
    
    # Step 1: Create IP addresses
    ip_address_map = await _create_ip_addresses(interfaces)
    # Loops through ip_addresses array
    # Creates each IP if not exists
    # PATCHes existing IPs with role updates
    
    # Step 2: Create/update interfaces
    for interface in interfaces:
        interface_id, was_created = await _create_or_update_interface(
            device_id, interface
        )
        # PATCHes existing interfaces
        # Creates new interfaces if not found
        
        # Step 3: Assign IPs to interface
        for ip_data in interface.ip_addresses:
            await _assign_ip_to_interface(
                interface_id,
                ip_address_id,
                ip_data.is_primary
            )
    
    # Step 4: Update device primary IPv4
    primary_ip = find_primary_ip(interfaces)
    await _update_device_primary_ip(device_id, primary_ip_id)
    
    return InterfaceUpdateResult(...)
```

---

## Data Models

### Frontend Types

**CheckMK Host:**

```typescript
interface CheckMKHost {
  host_name: string
  alias: string
  folder: string
  labels: Record<string, string>
  attributes: Record<string, unknown>
  effective_attributes: Record<string, unknown>
}
```

**Property Mapping:**

```typescript
interface PropertyMapping {
  nautobotField: string  // Target Nautobot field
  value: unknown          // CheckMK value
  isCore: boolean         // Core field vs. custom field
}
```

**Interface Mapping:**

```typescript
interface InterfaceMappingData {
  enabled: boolean
  ipRole: string            // 'primary' | 'secondary' | 'none'
  status: string
  ipAddress: string         // CIDR format: "192.168.1.1/24"
  interfaceName: string
  isPrimary: boolean        // Primary IP for device
}
```

**Device Form Values:**

```typescript
interface DeviceFormValues {
  deviceName: string
  selectedLocation: string
  selectedRole: string
  selectedDeviceType: string
  selectedStatus: string
  selectedPlatform?: string
  serialNumber?: string
  assetTag?: string
  selectedTags: string[]
  customFieldValues: Record<string, string>
  interfaces: InterfaceFormValues[]
  add_prefix?: boolean
  default_prefix_length?: string
}

interface InterfaceFormValues {
  id: string
  name: string
  type: string
  status: string
  ip_addresses: IPAddressFormValues[]
  enabled: boolean
  mgmt_only: boolean
  description?: string
}

interface IPAddressFormValues {
  id: string
  address: string          // CIDR format
  namespace: string
  ip_role: string         // 'primary' | 'secondary' | 'none'
  is_primary: boolean
  dns_name?: string
  description?: string
}
```

### Backend Models

**AddDeviceRequest:**

```python
class AddDeviceRequest(BaseModel):
    name: str
    role: str
    status: str
    device_type: str
    location: str
    platform: Optional[str] = None
    serial: Optional[str] = None
    asset_tag: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None
    interfaces: Optional[List[InterfaceData]] = None
    add_prefix: bool = True
    default_prefix_length: str = "/24"
```

**UpdateDeviceRequest:**

```python
class UpdateDeviceRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    device_type: Optional[str] = None
    location: Optional[str] = None
    platform: Optional[str] = None
    serial: Optional[str] = None
    asset_tag: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None
    interfaces: Optional[List[InterfaceData]] = None
```

**InterfaceData:**

```python
class InterfaceData(BaseModel):
    name: str
    type: str
    status: str
    ip_addresses: List[IPAddressData] = []
    enabled: bool = True
    mgmt_only: bool = False
    description: Optional[str] = None
```

**IPAddressData:**

```python
class IPAddressData(BaseModel):
    address: str             # CIDR format: "192.168.1.1/24"
    namespace: str
    ip_role: Optional[str] = None  # Filter out 'none' values
    is_primary: bool = False
    dns_name: Optional[str] = None
    description: Optional[str] = None
```

---

## Key Features Deep Dive

### 1. Property Mapping Framework

The property mapping system allows flexible transformation of CheckMK attributes to Nautobot fields:

**Core Mappings** (device properties):
- `alias` → `name`
- `tag_location` → `location`
- `tag_role` → `role`
- `tag_device_type` → `device_type`
- `tag_status` → `status`
- `tag_platform` → `platform`

**Custom Field Mappings:**
- `tag_environment` → `cf_environment`
- `tag_owner` → `cf_owner`
- `tag_cost_center` → `cf_cost_center`

**Mapping Resolution:**

```typescript
function resolveNautobotId(
  field: string,
  value: unknown,
  metadata: NautobotMetadata
): string {
  switch (field) {
    case 'location':
      return locations.find(l => l.name === value)?.id || ''
    case 'role':
      return roles.find(r => r.name === value)?.id || ''
    case 'device_type':
      return deviceTypes.find(dt => dt.name === value)?.id || ''
    // ... etc
  }
}
```

---

### 2. Interface Discovery and Parsing

The system parses CheckMK inventory data to discover network interfaces:

**CheckMK Inventory Structure:**

```json
{
  "networking": {
    "interfaces": {
      "GigabitEthernet0/0": {
        "oper_status": 1,
        "admin_status": 1,
        "speed": 1000000000,
        "ipv4_addresses": [
          {
            "address": "192.168.1.1",
            "netmask": "255.255.255.0"
          }
        ]
      }
    }
  }
}
```

**Parsing Logic:**

```typescript
function parseInterfacesFromInventory(
  inventoryData: Record<string, unknown>
): CheckMKInterface[] {
  const interfaces: CheckMKInterface[] = []
  
  // Navigate to networking.interfaces
  const networking = inventoryData?.networking
  const interfacesData = networking?.interfaces
  
  for (const [name, data] of Object.entries(interfacesData)) {
    const ipAddresses = []
    
    // Parse IPv4 addresses
    for (const ipv4 of data.ipv4_addresses || []) {
      const cidr = netmaskToCIDR(ipv4.netmask)
      ipAddresses.push({
        address: ipv4.address,
        netmask: ipv4.netmask,
        cidr: cidr
      })
    }
    
    interfaces.push({
      name: name,
      oper_status: data.oper_status,
      admin_status: data.admin_status,
      ipAddresses: ipAddresses
    })
  }
  
  return interfaces
}
```

**Netmask to CIDR Conversion:**

```typescript
function netmaskToCIDR(netmask: string): number {
  // "255.255.255.0" → 24
  const octets = netmask.split('.').map(Number)
  let cidr = 0
  
  for (const octet of octets) {
    // Count 1 bits in binary representation
    cidr += octet.toString(2).split('1').length - 1
  }
  
  return cidr
}
```

---

### 3. IP Address Role Management

The system supports multiple IP roles:

**IP Roles:**
- `primary` - Primary IP for the interface
- `secondary` - Secondary IP on the interface
- `anycast` - Anycast IP address
- `vip` - Virtual IP address
- `vrrp` - VRRP virtual IP
- `hsrp` - HSRP virtual IP
- `glbp` - GLBP virtual IP
- `none` - No specific role (filtered out)

**Primary IP Logic:**

1. If device has interface starting with "Management" or "Mgmt", first IP of that interface is primary
2. Otherwise, first IP of first interface is primary
3. All other IPs are not primary

**IP Role Filtering:**

When creating IP addresses, roles with value 'none' are filtered out:

```python
if ip_role and ip_role != 'none':
    payload['role'] = {'id': ip_role}
```

---

### 4. Form State Management

Uses React Hook Form for complex form state:

**Benefits:**
- Type-safe form values with Zod validation
- Efficient re-rendering (only changed fields)
- Built-in validation and error handling
- Easy integration with UI components

**Form Reset Logic:**

```typescript
// Reset form when device changes
useEffect(() => {
  if (initialFormData && open) {
    // Two-step reset to clear stale data
    reset({} as DeviceFormValues)
    setTimeout(() => {
      reset(initialFormData as DeviceFormValues)
    }, 0)
  }
}, [initialFormData, open, reset, deviceId])

// Clear form when modal closes
useEffect(() => {
  if (!open) {
    reset({} as DeviceFormValues)
  }
}, [open, reset])
```

---

### 5. Validation Framework

Comprehensive validation before sync:

**Client-Side Validation:**

```typescript
// Required fields
const validation = {
  deviceRole: !!values.selectedRole,
  deviceStatus: !!values.selectedStatus,
  deviceType: !!values.selectedDeviceType,
  location: !!values.selectedLocation
}

// Interface validation
interfaces.forEach(iface => {
  if (!iface.status) {
    validation.interfaceIssues++
  }
  
  // IP address CIDR validation
  iface.ip_addresses.forEach(ip => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\/\d{1,3}$/
    
    if (!ipv4Regex.test(ip.address) && !ipv6Regex.test(ip.address)) {
      validation.ipAddressIssues++
    }
  })
})
```

**Server-Side Validation:**

The backend validates:
- Required fields present
- UUIDs exist in Nautobot
- IP address format is valid CIDR
- Interface names are unique per device
- Custom field values match field types

---

## Error Handling

### Frontend Error Handling

**API Call Errors:**

```typescript
try {
  await apiCall('nautobot/add-device', {
    method: 'POST',
    body: JSON.stringify(submissionData)
  })
  onMessage('Device created successfully', 'success')
} catch (err) {
  const message = err instanceof Error 
    ? err.message 
    : 'Failed to create device'
  onMessage(message, 'error')
}
```

**Validation Errors:**

Display validation modal with specific errors:

```typescript
if (!isValid) {
  toast({
    title: 'Validation Failed',
    description: errorMessages.join('\n'),
    variant: 'destructive'
  })
  return // Don't proceed with sync
}
```

### Backend Error Handling

**HTTP Exception Handling:**

```python
try:
    result = await device_creation_service.create_device_with_interfaces(request)
    return result
except ValueError as e:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=str(e)
    )
except Exception as e:
    logger.error(f"Failed to add device: {str(e)}", exc_info=True)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Failed to add device: {str(e)}"
    )
```

**Nautobot API Errors:**

```python
response = await nautobot_service.rest_post('/api/dcim/devices/', payload)

if response.status_code != 201:
    error_detail = response.json().get('detail', 'Unknown error')
    raise ValueError(f"Failed to create device: {error_detail}")
```

---

## Performance Considerations

### Frontend Performance

**Data Caching:**
- TanStack Query caches CheckMK hosts
- Nautobot metadata cached after first load
- Form state preserved during modal interactions

**Lazy Loading:**
- Inventory data loaded only when sync modal opened
- Interface properties loaded on demand
- VLANs loaded per-location when needed

**Optimistic Updates:**
- Form updates immediate (controlled components)
- Validation runs on client before API call
- Success message displayed without refetching

### Backend Performance

**Batch Operations:**
- Create all IP addresses first (parallel)
- Create all interfaces in sequence
- Assign IPs in batches

**Caching:**
- Device lookups cached for 5 minutes
- Metadata queries cached
- GraphQL query results cached

**Connection Pooling:**
- Reuse HTTP connections to Nautobot
- Connection timeout: 30 seconds
- Retry failed requests (3 attempts)

---

## Best Practices

### For Users

1. **Review property mappings** - Verify CheckMK tags map correctly
2. **Validate before sync** - Use validation button to catch errors
3. **Check existing device** - Modal shows if device exists in Nautobot
4. **Set primary IP** - Ensure one IP is marked as primary
5. **Use interface roles** - Assign correct roles (primary/secondary)

### For Developers

1. **Use shared components** - Reuse add-device form components
2. **Transform data early** - Convert CheckMK → form format upfront
3. **Validate on client** - Catch errors before API call
4. **Handle partial updates** - Only send changed fields on update
5. **Log errors clearly** - Include context in error messages

---

## Troubleshooting

### Common Issues

**Issue 1: Device Not Found in Nautobot**

**Symptoms:** Modal shows "Device not found - will create new"

**Solution:** Normal behavior - device will be created on sync

---

**Issue 2: Property Mapping Shows No Value**

**Symptoms:** CheckMK tag exists but no Nautobot value found

**Causes:**
- Tag value doesn't match any Nautobot location/role/type
- Case-sensitive mismatch
- Tag format incorrect

**Solution:**
- Check Nautobot metadata for exact name
- Update CheckMK tag to match Nautobot name
- Use property mapping dropdown to select correct value

---

**Issue 3: IP Address Validation Fails**

**Symptoms:** "Invalid CIDR format" error

**Causes:**
- Missing CIDR suffix (/24)
- Invalid IP format
- IPv6 format issues

**Solution:**
- Ensure format is "192.168.1.1/24"
- Check inventory data for correct netmask
- Manually edit IP in interface table

---

**Issue 4: Interface Status Missing**

**Symptoms:** Validation fails with "Interface X missing status"

**Solution:**
- Each interface must have a status
- Default is "Active"
- Set status in interface table

---

**Issue 5: Sync Fails with 500 Error**

**Symptoms:** "Failed to create device" error

**Causes:**
- Nautobot API error
- Network timeout
- Invalid UUIDs
- Missing required fields

**Solution:**
- Check backend logs for details
- Verify Nautobot connectivity
- Test required fields exist in Nautobot
- Retry after fixing validation errors

---

## Summary

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **Hosts Inventory Page** | Browse CheckMK hosts | `frontend/src/components/features/checkmk/hosts-inventory/hosts-inventory-page.tsx` |
| **Device Sync Modal** | Configure and sync device | `frontend/src/components/features/checkmk/modals/device-sync-modal.tsx` |
| **useNautobotSync Hook** | Sync workflow orchestration | `frontend/src/components/features/checkmk/hosts-inventory/hooks/use-nautobot-sync.ts` |
| **transform-checkmk-data** | Data transformation utility | `frontend/src/components/shared/device-form/utils/transform-checkmk-data.ts` |
| **Add Device Endpoint** | Create device with interfaces | `backend/routers/nautobot/devices.py` |
| **Update Device Endpoint** | Update existing device | `backend/routers/nautobot/devices.py` |
| **DeviceCreationService** | Device creation orchestration | `backend/services/nautobot/devices/creation.py` |
| **DeviceUpdateService** | Device update orchestration | `backend/services/nautobot/devices/update.py` |
| **InterfaceManagerService** | Interface and IP management | `backend/services/nautobot/devices/interface_manager.py` |

### Workflow Summary

```
User browses CheckMK hosts
    ↓
Click "Sync to Nautobot"
    ↓
System checks if device exists
    ↓
Load Nautobot metadata + CheckMK inventory
    ↓
Initialize property and interface mappings
    ↓
Display Device Sync Modal with pre-populated data
    ↓
User reviews/edits device information
    ↓
User validates required fields
    ↓
User clicks "Sync to Nautobot"
    ↓
If existing device → PATCH /devices/{id}
If new device → POST /add-device
    ↓
Backend orchestrates:
  - Update/create device
  - Create IP addresses
  - Create/update interfaces
  - Assign IPs to interfaces
  - Set primary IPv4
    ↓
Return success/failure
    ↓
Close modal and show result message
```

### Design Principles

1. **Reusable Components** - Shares form components with add-device workflow
2. **Type Safety** - TypeScript + Zod validation throughout
3. **Flexible Mapping** - Property mapping framework for customization
4. **Progressive Enhancement** - Works with partial data, validates incrementally
5. **Error Resilience** - Comprehensive error handling and user feedback
6. **Performance** - Caching, lazy loading, optimistic updates

### Key Features

- ✅ **Automatic device detection** - Checks Nautobot for existing device
- ✅ **Property mapping** - Maps CheckMK tags to Nautobot fields
- ✅ **Interface discovery** - Parses CheckMK inventory automatically
- ✅ **Multiple IPs per interface** - Supports complex network configurations
- ✅ **IP role management** - Primary, secondary, anycast, VIP, etc.
- ✅ **CIDR validation** - Ensures IP addresses have proper format
- ✅ **Pre-sync validation** - Catches errors before API calls
- ✅ **Create or update** - Single workflow for both operations
- ✅ **Partial updates** - Only sends changed fields on update
- ✅ **Real-time feedback** - Progress indicators and success/error messages

---

## Conclusion

The CheckMK to Nautobot Device Sync system provides a **streamlined, user-friendly** workflow for synchronizing network devices from CheckMK monitoring into Nautobot IPAM/DCIM. Its architecture enables:

- **Ease of Use** - Intuitive modal interface with pre-populated data
- **Flexibility** - Property mapping framework adapts to different environments
- **Robustness** - Comprehensive validation and error handling
- **Consistency** - Reuses shared components for familiar UX
- **Efficiency** - Single operation handles create or update automatically

The **shared component architecture** ensures consistency with the add-device workflow, while the **property mapping framework** provides flexibility for different CheckMK tagging schemes and Nautobot configurations. The **interface discovery** system automatically parses CheckMK inventory data, reducing manual data entry and potential errors.
