# Inventory Builder - Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Frontend Components](#frontend-components)
4. [Backend Services](#backend-services)
5. [Data Structures](#data-structures)
6. [Workflow Examples](#workflow-examples)
7. [Query Execution](#query-execution)
8. [Performance & Caching](#performance--caching)
9. [Troubleshooting](#troubleshooting)

**Related Documentation:**
- [Inventory to Device Resolution Pattern](./INVENTORY_RESOLVER_PATTERN.md) - Common code for converting inventory to device lists
- Used by backup, jobs, and other features that need device targeting

---

## Overview

The Inventory Builder is a sophisticated device selection and filtering system that allows users to create dynamic Ansible inventories using logical conditions (AND/OR/NOT operations). It provides:

- **Tree-based condition building** with nested groups and logical operators
- **Real-time device preview** with pagination
- **Save/load functionality** for reusable inventory queries
- **Nautobot integration** via GraphQL for efficient device querying
- **Custom field support** for flexible filtering

### Key Concepts

- **Condition**: A single filter (e.g., `role equals router`)
- **Group**: A collection of conditions/groups combined with AND/OR logic
- **Tree**: Hierarchical structure of conditions and groups
- **Operation**: Backend representation of logical operations
- **Preview**: Executes query against Nautobot and returns matching devices

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                     │
├─────────────────────────────────────────────────────────────┤
│  inventory-page.tsx                                         │
│    ├── DeviceSelector (shared component)                    │
│    │   ├── ConditionTreeBuilder                             │
│    │   ├── DeviceTable                                      │
│    │   └── Save/Load/Manage Modals                          │
│    │                                                        │
│    └── InventoryGenerationTab                               │
│        ├── Template Selection                               │
│        └── Git Push/Download                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    API Proxy (/api/proxy/*)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI)                       │
├─────────────────────────────────────────────────────────────┤
│  Router (inventory.py)                                      │
│    ↓                                                        │
│  Service (InventoryService)                                 │
│    ├── preview_inventory()     → Execute conditions         │
│    ├── _execute_operation()    → Process AND/OR/NOT         │
│    ├── _execute_condition()    → Single filter              │
│    └── _query_devices_by_*()   → GraphQL queries            │
│    ↓                                                        │
│  Repository (InventoryRepository)                           │
│    └── Database CRUD operations                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SYSTEMS                         │
├─────────────────────────────────────────────────────────────┤
│  Nautobot (GraphQL API)     → Device data                   │
│  PostgreSQL Database        → Saved inventories             │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React 19 + Next.js 15 (App Router)
- TypeScript 5
- TanStack Query v5 (data fetching & caching)
- Zustand (authentication state)
- Shadcn UI components

**Backend:**
- FastAPI (Python 3.9+)
- SQLAlchemy ORM
- Pydantic models
- GraphQL client for Nautobot

---

## Frontend Components

### Main Component: inventory-page.tsx

**Location:** `/frontend/src/components/features/general/inventory/inventory-page.tsx`

**Responsibilities:**
1. Initialize authentication and load initial data
2. Load template categories for inventory generation
3. Load git repositories for save operations
4. Orchestrate DeviceSelector and InventoryGenerationTab
5. Handle success dialogs

**State Management:**
```typescript
// Authentication
const [authReady, setAuthReady] = useState(false)

// Device selection results
const [previewDevices, setPreviewDevices] = useState<DeviceInfo[]>([])
const [deviceConditions, setDeviceConditions] = useState<LogicalCondition[]>([])

// Custom hooks
const inventoryGeneration = useInventoryGeneration()
const gitOperations = useGitOperations()
```

### Shared DeviceSelector Component

**Location:** `/frontend/src/components/shared/device-selector.tsx`

**Purpose:** Reusable component for building complex device conditions with tree-based logic.

**Props:**
```typescript
interface DeviceSelectorProps {
  onDevicesSelected?: (devices: DeviceInfo[], conditions: LogicalCondition[]) => void
  showActions?: boolean        // Show Preview/Clear buttons
  showSaveLoad?: boolean        // Show Save/Load inventory buttons
  enableSelection?: boolean     // Enable device checkboxes
  preSelectedDevices?: string[] // Pre-selected device IDs
}
```

**Composition:**
```
DeviceSelector
├── useConditionTree()          → Tree structure management
├── useDeviceFilter()           → Filter input state
├── useDevicePreview()          → Device fetching & pagination
├── useSavedInventories()       → Save/load operations
└── Sub-components:
    ├── ConditionTreeBuilder    → Build conditions UI
    ├── DeviceTable             → Display preview results
    ├── SaveInventoryModal
    ├── LoadInventoryModal
    ├── ManageInventoryModal
    ├── LogicalTreeModal        → Visualize condition tree
    └── HelpModal
```

### Custom Hooks

#### 1. useConditionTree() - Tree State Management

**Location:** `/frontend/src/hooks/shared/device-selector/use-condition-tree.ts`

**Purpose:** Manages hierarchical tree structure of conditions and groups.

**Key Features:**
- Recursive tree structure with unlimited nesting
- Context tracking (current group path for adding items)
- Operations: add condition, add group, remove item, update logic
- Backward compatibility with flat condition format

**Data Structure:**
```typescript
interface ConditionTree {
  type: 'root'
  internalLogic: 'AND' | 'OR'  // How items within root combine
  items: (ConditionItem | ConditionGroup)[]
}

interface ConditionGroup {
  id: string
  type: 'group'
  logic: 'AND' | 'OR' | 'NOT'      // How this group relates to parent
  internalLogic: 'AND' | 'OR'      // How items within group combine
  items: (ConditionItem | ConditionGroup)[]
}

interface ConditionItem {
  id: string
  field: string        // "name", "location", "cf_snmp_credentials", etc.
  operator: string     // "equals", "contains", "not_equals", "not_contains"
  value: string        // Value to match
}
```

**Key Methods:**
```typescript
// Add leaf node to current group
addConditionToTree(field, operator, value)

// Add nested group
addGroup(logic: 'AND' | 'OR' | 'NOT', negate)

// Remove any item by ID (recursive)
removeItemFromTree(id)

// Change logic for specific group
updateGroupLogic(groupId, newLogic)

// Navigate to specific group for adding items
setCurrentGroupPath(path: string[])

// Convert legacy flat format to tree
flatConditionsToTree(conditions: LogicalCondition[])
```

**Example Tree:**
```typescript
{
  type: 'root',
  internalLogic: 'AND',
  items: [
    {
      id: 'item-1',
      field: 'role',
      operator: 'equals',
      value: 'router'
    },
    {
      id: 'group-1',
      type: 'group',
      logic: 'NOT',
      internalLogic: 'OR',
      items: [
        {
          id: 'item-2',
          field: 'status',
          operator: 'equals',
          value: 'down'
        },
        {
          id: 'item-3',
          field: 'status',
          operator: 'equals',
          value: 'maintenance'
        }
      ]
    }
  ]
}
```

This represents: `(role = router) AND NOT (status = down OR status = maintenance)`

#### 2. useDeviceFilter() - Filter Input State

**Location:** `/frontend/src/hooks/shared/device-selector/use-device-filter.ts`

**Purpose:** Manages form input state and fetches field options/values from backend.

**State Managed:**
```typescript
{
  currentField: string              // Selected field
  currentOperator: string           // Selected operator
  currentValue: string              // Input value
  currentLogic: 'AND' | 'OR'       // Logic for next item
  currentNegate: boolean            // Negate next item
  selectedCustomField: string       // Custom field name (without cf_ prefix)
  fieldOptions: FieldOption[]       // Available fields
  operatorOptions: FieldOption[]    // Available operators
  fieldValues: FieldOption[]        // Values for current field
  customFields: CustomField[]       // Custom fields from Nautobot
  locations: LocationItem[]         // Location hierarchy
}
```

**Field-Specific Operator Restrictions:**
```typescript
// Exact match only
restrictedFields = ['role', 'device_type', 'manufacturer', 'platform', 'has_primary']
→ Operators: ['equals']

// Exact match + negation
['location', 'tag']
→ Operators: ['equals', 'not_equals']

// Full text search
['name', 'cf_*' (custom fields)]
→ Operators: ['equals', 'contains']
```

**TanStack Query Hooks Used:**
```typescript
// Static field list (cached 15min)
useInventoryFieldOptionsQuery()

// Values for specific field (cached 5min)
useInventoryFieldValuesQuery(fieldName: string | null)

// Custom fields from Nautobot (cached 10min, loaded on demand)
useInventoryCustomFieldsQuery(enabled: boolean)

// Location hierarchy (cached 10min, loaded on demand)
useNautobotLocationsQuery(enabled: boolean)
```

**Key Handlers:**
```typescript
// When user selects a field
handleFieldChange(fieldName: string)
  → Reset value
  → Update operator options based on field type
  → Trigger value loading if needed

// When user selects custom field from dropdown
handleCustomFieldSelect(customFieldName: string)
  → customFieldName already has 'cf_' prefix from SelectItem
  → Set field to use as-is (do NOT add 'cf_' again)
  → Load field values for dropdowns

// When user changes operator
handleOperatorChange(operator: string)
```

#### 3. useDevicePreview() - Device Fetching & Results

**Location:** `/frontend/src/hooks/shared/device-selector/use-device-preview.ts`

**Purpose:** Converts tree structure to backend operations and fetches matching devices.

**Key Features:**
- Tree-to-operations conversion
- Device preview execution via TanStack Query mutation
- Pagination (20 devices per page)
- Device selection tracking
- Callback triggers for parent components

**Tree Conversion Algorithm:**

```typescript
buildOperationsFromTree(tree: ConditionTree): BackendOperation[] {
  // 1. Separate regular items from NOT groups
  const regularItems: BackendOperation[] = []
  const notItems: BackendOperation[] = []

  tree.items.forEach(item => {
    if (item is ConditionGroup && item.logic === 'NOT') {
      notItems.push(convertGroupToOperation(item))
    } else if (item is ConditionGroup) {
      regularItems.push(convertGroupToOperation(item))
    } else {
      regularItems.push({
        operation_type: 'AND',
        conditions: [item],
        nested_operations: []
      })
    }
  })

  // 2. Create root operation
  if (regularItems.length > 1) {
    // Multiple items → wrap in root operation
    const conditions = regularItems.filter(item => !item.nested_operations?.length)
    const nested = regularItems.filter(item => item.nested_operations?.length)

    return [{
      operation_type: tree.internalLogic,
      conditions: conditions.flatMap(op => op.conditions),
      nested_operations: nested
    }, ...notItems]
  } else if (regularItems.length === 1) {
    // Single item → use as-is
    return [regularItems[0], ...notItems]
  } else {
    // Only NOT items
    return notItems
  }
}
```

**Example Conversion:**

Input Tree:
```typescript
{
  type: 'root',
  internalLogic: 'AND',
  items: [
    { id: '1', field: 'role', operator: 'equals', value: 'router' },
    { id: '2', field: 'location', operator: 'equals', value: 'DC1' },
    {
      id: 'group-1',
      type: 'group',
      logic: 'NOT',
      internalLogic: 'OR',
      items: [
        { id: '3', field: 'status', operator: 'equals', value: 'down' },
        { id: '4', field: 'status', operator: 'equals', value: 'maintenance' }
      ]
    }
  ]
}
```

Output Operations:
```typescript
[
  {
    operation_type: 'AND',
    conditions: [
      { field: 'role', operator: 'equals', value: 'router' },
      { field: 'location', operator: 'equals', value: 'DC1' }
    ],
    nested_operations: []
  },
  {
    operation_type: 'NOT',
    conditions: [],
    nested_operations: [{
      operation_type: 'OR',
      conditions: [
        { field: 'status', operator: 'equals', value: 'down' },
        { field: 'status', operator: 'equals', value: 'maintenance' }
      ],
      nested_operations: []
    }]
  }
]
```

**Preview Execution:**
```typescript
const { mutate: executePreview, isPending } = useDevicePreviewMutation()

loadPreview() {
  // 1. Validate tree has conditions
  if (conditionTree.items.length === 0) {
    alert('Please add at least one condition.')
    return
  }

  // 2. Convert tree to operations
  const operations = buildOperationsFromTree(conditionTree)

  // 3. Execute mutation
  executePreview({ operations }, {
    onSuccess: (data) => {
      setPreviewDevices(data.devices)
      setTotalDevices(data.total_count)
      setOperationsExecuted(data.operations_executed)
      setShowPreviewResults(true)

      // Trigger callback
      onDevicesSelected?.(data.devices, operations)
    },
    onError: (error) => {
      alert('Error previewing results: ' + error.message)
    }
  })
}
```

#### 4. useSavedInventories() - Persistence

**Location:** `/frontend/src/hooks/shared/device-selector/use-saved-inventories.ts`

**Purpose:** Save, load, update, delete inventories in database.

**Storage Format:**

Version 2 (Tree Format):
```json
{
  "name": "DC1-Routers",
  "description": "All routers in DC1",
  "conditions": [
    {
      "version": 2,
      "tree": {
        "type": "root",
        "internalLogic": "AND",
        "items": [...]
      }
    }
  ],
  "scope": "global"
}
```

Version 1 (Legacy Flat Format):
```json
{
  "name": "Simple-Filter",
  "conditions": [
    {
      "field": "role",
      "operator": "equals",
      "value": "router",
      "logic": "AND"
    }
  ]
}
```

**Key Methods:**

```typescript
// Save new or update existing inventory
async saveInventory(
  name: string,
  description: string,
  conditionTree: ConditionTree,
  isUpdate: boolean
): Promise<void>

// Load inventory by name → returns ConditionTree
async loadInventory(inventoryName: string): Promise<ConditionTree | null>

// Update metadata only (name, description)
async updateInventoryDetails(id: number, name: string, description: string)

// Delete inventory
async deleteInventory(id: number): Promise<void>
```

**Backward Compatibility:**
```typescript
const loadInventory = async (inventoryName: string) => {
  const response = await apiCall(`inventory/by-name/${inventoryName}`)

  if (response.conditions?.length > 0) {
    const firstItem = response.conditions[0]

    // Check format
    if (firstItem?.version === 2) {
      // New tree format
      return firstItem.tree
    } else {
      // Legacy flat format → convert to tree
      return flatConditionsToTree(response.conditions)
    }
  }
  return null
}
```

**TanStack Query Integration:**
```typescript
// Save mutation
const saveMutation = useMutation({
  mutationFn: async (data) => {
    return apiCall('inventory', {
      method: isUpdate ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    })
  },
  onSuccess: () => {
    // Invalidate list to trigger refetch
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.list() })
    toast({ title: 'Success', description: 'Inventory saved!' })
  }
})
```

---

## Backend Services

### Inventory Service

**Location:** `/backend/services/inventory/inventory.py`

**Purpose:** Core business logic for condition execution and device querying.

### Key Methods

#### 1. preview_inventory(operations) - Main Execution

**Algorithm:**

```python
def preview_inventory(operations: List[LogicalOperation]) -> InventoryPreviewResponse:
    """
    Execute list of operations and return matching devices.

    Flow:
    1. Initialize result set (empty)
    2. For each top-level operation:
       - Execute operation → get device IDs
       - Apply to result set:
         * First operation: Initialize result_devices
         * NOT operation: Subtract from result (set difference)
         * AND/OR operation: Intersect with result (set intersection)
    3. Build device list from final IDs
    4. Return devices + metadata
    """
    result_devices: Set[str] = set()
    all_devices_data: Dict[str, DeviceInfo] = {}
    total_operations = 0

    for idx, operation in enumerate(operations):
        # Execute single operation
        device_ids, ops_count, devices_dict = _execute_operation(operation)

        total_operations += ops_count
        all_devices_data.update(devices_dict)

        # Apply to result set
        if idx == 0:
            if operation.operation_type == "NOT":
                result_devices = set()  # NOT as first → empty result
            else:
                result_devices = device_ids  # Initialize
        else:
            if operation.operation_type == "NOT":
                result_devices = result_devices.difference(device_ids)
            else:
                # All non-NOT operations intersect (AND logic)
                result_devices = result_devices.intersection(device_ids)

    # Build final device list
    final_devices = [all_devices_data[dev_id] for dev_id in result_devices]

    return InventoryPreviewResponse(
        devices=final_devices,
        total_count=len(final_devices),
        operations_executed=total_operations
    )
```

**Example Execution:**

```python
# Input: 2 operations
operations = [
  # Op 1: AND - role=router AND location=DC1
  {
    "operation_type": "AND",
    "conditions": [
      {"field": "role", "operator": "equals", "value": "router"},
      {"field": "location", "operator": "equals", "value": "DC1"}
    ]
  },
  # Op 2: NOT - status=down
  {
    "operation_type": "NOT",
    "conditions": [
      {"field": "status", "operator": "equals", "value": "down"}
    ]
  }
]

# Execution:
# Step 1: Execute Op 1 (AND)
#   - Query role=router → {dev1, dev2, dev3, dev4, dev5}
#   - Query location=DC1 → {dev2, dev3, dev4, dev6}
#   - Intersect → {dev2, dev3, dev4}
#   - result_devices = {dev2, dev3, dev4}

# Step 2: Execute Op 2 (NOT)
#   - Query status=down → {dev4, dev7}
#   - Subtract from result → {dev2, dev3, dev4} - {dev4, dev7} = {dev2, dev3}

# Final result: [dev2, dev3] (2 devices)
```

#### 2. _execute_operation(operation) - Process AND/OR/NOT

**Algorithm:**

```python
def _execute_operation(operation: LogicalOperation) -> Tuple[Set[str], int, Dict[str, DeviceInfo]]:
    """
    Execute single operation (AND/OR/NOT) with conditions and nested operations.

    Returns:
        device_ids: Set of matching device IDs
        operations_count: Number of GraphQL queries executed
        devices_dict: Device data keyed by ID
    """
    condition_results = []
    not_results = []
    total_operations = 0
    all_devices = {}

    # 1. Execute all conditions
    for condition in operation.conditions:
        device_ids, ops_count, devices_dict = _execute_condition(condition)
        total_operations += ops_count
        all_devices.update(devices_dict)

        if condition.operator in ["not_equals", "not_contains"]:
            not_results.append(device_ids)
        else:
            condition_results.append(device_ids)

    # 2. Execute nested operations
    for nested_op in operation.nested_operations:
        device_ids, ops_count, devices_dict = _execute_operation(nested_op)
        total_operations += ops_count
        all_devices.update(devices_dict)

        if nested_op.operation_type == "NOT":
            not_results.append(device_ids)
        else:
            condition_results.append(device_ids)

    # 3. Combine based on operation type
    if operation.operation_type == "AND":
        # Intersect all condition results
        result = condition_results[0] if condition_results else set()
        for dev_set in condition_results[1:]:
            result = result.intersection(dev_set)

        # Subtract NOT results
        for not_set in not_results:
            result = result.difference(not_set)

    elif operation.operation_type == "OR":
        # Union all condition results
        result = set()
        for dev_set in condition_results:
            result = result.union(dev_set)

        # Subtract NOT results
        for not_set in not_results:
            result = result.difference(not_set)

    elif operation.operation_type == "NOT":
        # Union all (to be subtracted at parent level)
        result = set()
        for dev_set in condition_results:
            result = result.union(dev_set)

    return result, total_operations, all_devices
```

#### 3. _execute_condition(condition) - Single Filter

**Algorithm:**

```python
def _execute_condition(condition: LogicalCondition) -> Tuple[Set[str], int, Dict[str, DeviceInfo]]:
    """
    Execute single filter condition.

    Returns:
        device_ids: Set of matching device IDs
        operations_count: Number of GraphQL queries (usually 1)
        devices_dict: Device data keyed by ID
    """
    # 1. Validate
    if not condition.field or not condition.value:
        logger.warning("Skipping condition with empty field or value")
        return set(), 0, {}

    # 2. Detect custom field
    if condition.field.startswith("cf_"):
        # Custom field handling
        if condition.operator in ["not_equals", "not_contains"]:
            # Negation: Get ALL devices, subtract matching ones
            all_devices_resp = query_all_devices()
            matching_resp = query_custom_field(condition)
            result_ids = all_devices_resp.ids - matching_resp.ids
            return result_ids, 2, all_devices_resp.devices
        else:
            # Positive match
            resp = query_custom_field(condition)
            return resp.ids, 1, resp.devices

    # 3. Detect field type
    query_func = field_to_query_map.get(condition.field)
    if not query_func:
        logger.warning(f"Unknown field: {condition.field}")
        return set(), 0, {}

    # 4. Handle negation
    if condition.operator in ["not_equals", "not_contains"]:
        all_devices_resp = query_all_devices()
        matching_resp = query_func(condition.value, condition.operator)
        result_ids = all_devices_resp.ids - matching_resp.ids
        return result_ids, 2, all_devices_resp.devices

    # 5. Positive match
    resp = query_func(condition.value, condition.operator)
    return resp.ids, 1, resp.devices
```

**Field Type Mapping:**
```python
field_to_query_map = {
    "name": _query_devices_by_name,
    "location": _query_devices_by_location,
    "role": _query_devices_by_role,
    "status": _query_devices_by_status,
    "tag": _query_devices_by_tag,
    "device_type": _query_devices_by_devicetype,
    "manufacturer": _query_devices_by_manufacturer,
    "platform": _query_devices_by_platform,
    "has_primary": _query_devices_by_has_primary,
}
```

#### 4. GraphQL Query Methods

Each query method builds a GraphQL query with appropriate filters.

**Example: _query_devices_by_role()**

```python
def _query_devices_by_role(role_filter: str, operator: str) -> QueryResponse:
    """
    Query devices by role.

    GraphQL Filter: role: [String]
    """
    query = """
        query devices_by_role($role: [String]) {
          devices(role: $role) {
            id
            name
            serial
            primary_ip4 { address }
            status { name }
            device_type {
              model
              manufacturer { name }
            }
            role { name }
            location { name }
            tags { name }
            platform { name }
          }
        }
    """

    variables = {"role": [role_filter]}  # Always wrapped in list

    response = nautobot_client.execute_graphql(query, variables)
    devices_data = response.get("data", {}).get("devices", [])

    # Parse devices
    devices_dict = {}
    for device in devices_data:
        device_info = DeviceInfo(
            id=device["id"],
            name=device.get("name"),
            serial=device.get("serial"),
            location=device.get("location", {}).get("name"),
            role=device.get("role", {}).get("name"),
            # ... parse all fields
        )
        devices_dict[device_info.id] = device_info

    device_ids = set(devices_dict.keys())
    return QueryResponse(ids=device_ids, devices=devices_dict)
```

**Special Cases:**

1. **Location (Hierarchical):**
   ```python
   # Filter includes child locations automatically
   # Query: location="Germany"
   # Returns: Devices in Germany, Berlin, Munich, etc.

   # Operator support:
   # - equals: location: [String]
   # - contains: location__name__ic: [String]
   # - not_equals: location__n: [String]
   ```

2. **Name (Regex):**
   ```python
   # Operator support:
   # - equals: name: [String]
   # - contains: name__ire: [String]  (case-insensitive regex)
   ```

3. **Custom Fields:**
   ```python
   # Dynamic field name: cf_{field_name}
   # Example: cf_snmp_credentials

   # Type detection:
   field_type = get_custom_field_type(field_name)

   # Operator mapping:
   # - equals (select): cf_snmp_credentials: [String]
   # - equals (text): cf_description: String
   # - contains: cf_description__ic: [String]
   ```

4. **Has Primary IP:**
   ```python
   # Special: Boolean filter (not a list)
   # Query: has_primary_ip: Boolean
   # Input: "True" or "False" (string) → converted to bool
   ```

### Field Value Queries

**Endpoint:** `GET /api/inventory/field-values/{field_name}`

**Purpose:** Get dropdown values for specific field.

**Algorithm:**

```python
def get_field_values(field_name: str) -> FieldValuesResponse:
    """
    Return possible values for a field.

    Cases:
    1. "custom_fields" → Return list of custom fields with cf_ prefix
    2. "cf_*" → Return values for specific custom field
    3. Standard field → Query Nautobot REST API
    """

    # Case 1: Custom fields list
    if field_name == "custom_fields":
        custom_fields = get_custom_fields()
        return FieldValuesResponse(
            field="custom_fields",
            values=[{
                "value": f"cf_{cf.key}",
                "label": cf.label
            } for cf in custom_fields],
            input_type="select"
        )

    # Case 2: Specific custom field
    if field_name.startswith("cf_"):
        field_key = field_name.replace("cf_", "")
        custom_field = get_custom_field_by_key(field_key)

        if custom_field.type == "select":
            # Return choices
            return FieldValuesResponse(
                field=field_name,
                values=[{
                    "value": choice,
                    "label": choice
                } for choice in custom_field.choices],
                input_type="select"
            )
        else:
            # Text input
            return FieldValuesResponse(
                field=field_name,
                values=[],
                input_type="text"
            )

    # Case 3: Standard field
    # Query Nautobot REST API
    # Example: /dcim/roles/ → Get all roles
    endpoint = field_to_endpoint_map[field_name]
    items = nautobot_client.get(endpoint)

    return FieldValuesResponse(
        field=field_name,
        values=[{
            "value": item["slug"] or item["name"],
            "label": item["name"]
        } for item in items],
        input_type="select"
    )
```

### Custom Field Type Detection

**Algorithm:**

```python
# Cache: Dict[str, str] (field_key → field_type)
custom_field_types_cache = {}

def get_custom_field_type(field_key: str) -> str:
    """
    Get custom field type from Nautobot.

    Returns: "select", "text", "integer", "boolean", "date", etc.
    """
    if field_key in custom_field_types_cache:
        return custom_field_types_cache[field_key]

    # Query Nautobot for custom field definition
    custom_fields = nautobot_client.get("/extras/custom-fields/")

    for cf in custom_fields:
        cf_key = cf.get("key") or cf.get("name")
        cf_type = cf.get("type")
        custom_field_types_cache[cf_key] = cf_type

    return custom_field_types_cache.get(field_key, "text")
```

---

## Data Structures

### Frontend Types

**Location:** `/frontend/src/types/shared/device-selector.ts`

```typescript
// Single condition
interface ConditionItem {
  id: string
  field: string        // "name", "location", "cf_snmp_credentials"
  operator: string     // "equals", "contains", "not_equals", "not_contains"
  value: string
}

// Nested group
interface ConditionGroup {
  id: string
  type: 'group'
  logic: 'AND' | 'OR' | 'NOT'       // How this group relates to parent
  internalLogic: 'AND' | 'OR'       // How items within group combine
  items: (ConditionItem | ConditionGroup)[]
}

// Tree root
interface ConditionTree {
  type: 'root'
  internalLogic: 'AND' | 'OR'
  items: (ConditionItem | ConditionGroup)[]
}

// Device information
interface DeviceInfo {
  id: string
  name?: string | null
  serial?: string
  location?: string
  role?: string
  tags: string[]
  device_type?: string
  manufacturer?: string
  platform?: string
  primary_ip4?: string
  status?: string
}

// Field option (dropdown)
interface FieldOption {
  value: string
  label: string
}

// Custom field definition
interface CustomField {
  key: string
  name: string
  label: string
  type: string         // "select", "text", "integer", etc.
  choices?: string[]   // For select type
}

// Location with hierarchy
interface LocationItem {
  id: string
  name: string
  parent?: { id: string, name: string }
  hierarchicalPath: string  // Computed: "Europe → Germany → Berlin"
}
```

### Backend Models

**Location:** `/backend/models/inventory.py`

```python
from pydantic import BaseModel
from typing import List, Optional

class LogicalCondition(BaseModel):
    """Single filter condition"""
    field: str
    operator: str  # "equals", "contains", "not_equals", "not_contains"
    value: str

class LogicalOperation(BaseModel):
    """Recursive operation with conditions and nested operations"""
    operation_type: str  # "AND", "OR", "NOT"
    conditions: List[LogicalCondition] = []
    nested_operations: List['LogicalOperation'] = []

class DeviceInfo(BaseModel):
    """Device data returned to frontend"""
    id: str
    name: Optional[str] = None
    serial: Optional[str] = None
    location: Optional[str] = None
    role: Optional[str] = None
    tags: List[str] = []
    device_type: Optional[str] = None
    manufacturer: Optional[str] = None
    platform: Optional[str] = None
    primary_ip4: Optional[str] = None
    status: Optional[str] = None

class InventoryPreviewRequest(BaseModel):
    """Frontend preview request"""
    operations: List[LogicalOperation]

class InventoryPreviewResponse(BaseModel):
    """Response with matching devices"""
    devices: List[DeviceInfo]
    total_count: int
    operations_executed: int

class FieldValuesResponse(BaseModel):
    """Field values for dropdowns"""
    field: str
    values: List[dict]  # [{"value": "...", "label": "..."}]
    input_type: str     # "select", "text", "number"
```

### Database Schema

**Location:** `/backend/core/models.py`

```python
class Inventory(Base):
    __tablename__ = "inventories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    conditions = Column(Text, nullable=False)  # JSON array
    template_category = Column(String(255))
    template_name = Column(String(255))
    scope = Column(String(50), default="global")  # "global" or "private"
    created_by = Column(String(255), nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Indexes
    __table_args__ = (
        Index('idx_inventory_scope_created_by', 'scope', 'created_by'),
        Index('idx_inventory_active_scope', 'is_active', 'scope'),
    )
```

**conditions Column Format:**

```json
[
  {
    "version": 2,
    "tree": {
      "type": "root",
      "internalLogic": "AND",
      "items": [...]
    }
  }
]
```

---

## Workflow Examples

### Example 1: Simple Filter (Role = Router)

#### User Actions

1. User navigates to Inventory Builder page
2. Selects field: "Role"
3. Selects operator: "Equals"
4. Selects value: "router"
5. Clicks "Add Condition"
6. Clicks "Preview"

#### Frontend Flow

```typescript
// Step 1-4: useDeviceFilter state updates
currentField = "role"
currentOperator = "equals"
currentValue = "router"

// Step 5: Add condition
useConditionTree.addConditionToTree("role", "equals", "router")
→ conditionTree = {
    type: 'root',
    internalLogic: 'AND',
    items: [{
      id: 'item-123',
      field: 'role',
      operator: 'equals',
      value: 'router'
    }]
  }

// Step 6: Preview
useDevicePreview.loadPreview()
→ buildOperationsFromTree(conditionTree)
→ operations = [{
    operation_type: "AND",
    conditions: [{ field: "role", operator: "equals", value: "router" }],
    nested_operations: []
  }]

→ POST /api/proxy/inventory/preview { operations }
```

#### Backend Flow

```python
# Receive request
preview_inventory(operations)

# Execute operation
operation = operations[0]  # type="AND"

# Execute condition
condition = { field: "role", operator: "equals", value: "router" }
_execute_condition(condition)

# Query devices by role
_query_devices_by_role("router", "equals")

# GraphQL query
query = """
  query devices_by_role($role: [String]) {
    devices(role: $role) { id, name, ... }
  }
"""
variables = { "role": ["router"] }

# Execute GraphQL → Get 25 routers
devices = [
  { id: "dev1", name: "router-01", role: "router", ... },
  { id: "dev2", name: "router-02", role: "router", ... },
  ...
]

# Return response
{
  "devices": [...],
  "total_count": 25,
  "operations_executed": 1
}
```

#### Frontend Display

```typescript
// Update state
previewDevices = response.devices  // 25 devices
totalDevices = 25
operationsExecuted = 1
showPreviewResults = true

// DeviceTable renders
// Page 1: Shows devices 1-20
// Pagination: "Page 1 of 2"
```

### Example 2: Complex Filter with NOT

**Query:** `(Role = Router AND Location = DC1) AND NOT (Status = Down OR Status = Maintenance)`

#### User Actions

1. Add condition: `role = router`
2. Add condition: `location = DC1`
3. Click "Add Group" → Select "NOT"
4. In NOT group, change internal logic to "OR"
5. Add condition in NOT group: `status = down`
6. Add condition in NOT group: `status = maintenance`
7. Click "Preview"

#### Frontend Tree

```typescript
{
  type: 'root',
  internalLogic: 'AND',
  items: [
    { id: '1', field: 'role', operator: 'equals', value: 'router' },
    { id: '2', field: 'location', operator: 'equals', value: 'DC1' },
    {
      id: 'group-1',
      type: 'group',
      logic: 'NOT',
      internalLogic: 'OR',
      items: [
        { id: '3', field: 'status', operator: 'equals', value: 'down' },
        { id: '4', field: 'status', operator: 'equals', value: 'maintenance' }
      ]
    }
  ]
}
```

#### Converted Operations

```typescript
[
  {
    operation_type: 'AND',
    conditions: [
      { field: 'role', operator: 'equals', value: 'router' },
      { field: 'location', operator: 'equals', value: 'DC1' }
    ],
    nested_operations: []
  },
  {
    operation_type: 'NOT',
    conditions: [],
    nested_operations: [{
      operation_type: 'OR',
      conditions: [
        { field: 'status', operator: 'equals', value: 'down' },
        { field: 'status', operator: 'equals', value: 'maintenance' }
      ],
      nested_operations: []
    }]
  }
]
```

#### Backend Execution

```python
# Step 1: Execute first operation (AND)
operation1 = operations[0]
_execute_operation(operation1)

# Execute conditions
condition1: role=router
  → _query_devices_by_role("router")
  → GraphQL query → {dev1, dev2, dev3, dev4, dev5, dev6, dev7}

condition2: location=DC1
  → _query_devices_by_location("DC1")
  → GraphQL query (includes child locations)
  → {dev2, dev3, dev4, dev8, dev9}

# Combine with AND (intersection)
result1 = {dev1, dev2, dev3, dev4, dev5, dev6, dev7} ∩ {dev2, dev3, dev4, dev8, dev9}
       = {dev2, dev3, dev4}

operations_count = 2

# Step 2: Execute second operation (NOT)
operation2 = operations[1]
_execute_operation(operation2)

# Execute nested OR operation
nested_op = operation2.nested_operations[0]

condition3: status=down
  → _query_devices_by_status("down")
  → GraphQL query → {dev4, dev5, dev10}

condition4: status=maintenance
  → _query_devices_by_status("maintenance")
  → GraphQL query → {dev7, dev11}

# Combine with OR (union)
result2 = {dev4, dev5, dev10} ∪ {dev7, dev11}
       = {dev4, dev5, dev7, dev10, dev11}

operations_count += 2

# Step 3: Combine operations
# Operation 1 result: {dev2, dev3, dev4}
# Operation 2 result (NOT): {dev4, dev5, dev7, dev10, dev11}
# Subtract NOT from result
final_result = {dev2, dev3, dev4} - {dev4, dev5, dev7, dev10, dev11}
            = {dev2, dev3}

# Return
{
  "devices": [dev2_data, dev3_data],
  "total_count": 2,
  "operations_executed": 4  # 2 from Op1 + 2 from Op2
}
```

### Example 3: Custom Field Filter

**Query:** `Custom Field "snmp_credentials" = "credA"`

#### User Actions

1. Select field: "Custom Fields"
   - Triggers loading of custom fields from Nautobot
2. Select custom field: "snmp_credentials"
   - Triggers loading of field values (dropdown)
3. Select operator: "Equals"
4. Select value: "credA"
5. Add condition
6. Preview

#### Frontend Flow

```typescript
// Step 1: Field selection
handleFieldChange("custom_fields")
→ setLoadCustomFields(true)
→ useInventoryCustomFieldsQuery enabled
→ Fetches custom fields from backend

// Response:
customFields = [
  { key: "snmp_credentials", label: "SNMP Credentials", type: "select", choices: ["credA", "credB"] },
  { key: "description", label: "Description", type: "text" }
]

// Step 2: Custom field selection
// SelectItem value is "cf_snmp_credentials" (prefix added in condition-tree-builder.tsx)
handleCustomFieldSelect("cf_snmp_credentials")
→ setCurrentField("cf_snmp_credentials")  // Use as-is, do NOT add "cf_" again
→ setFieldNameToLoad("cf_snmp_credentials")
→ useInventoryFieldValuesQuery enabled for "cf_snmp_credentials"

// Response:
fieldValues = [
  { value: "credA", label: "credA" },
  { value: "credB", label: "credB" }
]

// Step 3-5: Add condition
addConditionToTree("cf_snmp_credentials", "equals", "credA")
→ conditionTree.items.push({
    id: 'item-123',
    field: 'cf_snmp_credentials',  // ✓ Correct: single "cf_" prefix
    operator: 'equals',
    value: 'credA'
  })
```

#### Backend Flow

```python
# Receive condition
condition = { field: "cf_snmp_credentials", operator: "equals", value: "credA" }

# Detect custom field
if condition.field.startswith("cf_"):
    field_key = "snmp_credentials"  # Extract key

    # Get custom field type
    field_type = get_custom_field_type(field_key)
    # Returns: "select"

    # Build GraphQL query
    query = """
      query devices_by_custom_field($field_value: [String]) {
        devices(cf_snmp_credentials: $field_value) {
          id, name, ...
        }
      }
    """

    variables = { "field_value": ["credA"] }

    # Execute GraphQL → Get devices with snmp_credentials = "credA"
    devices = [...]
```

**IMPORTANT:** The field name in the GraphQL query is `cf_snmp_credentials` (single "cf_" prefix), NOT `cf_cf_snmp_credentials` (double prefix). The bug fix ensures this is correct.

### Example 4: Save and Load Inventory

#### Save Flow

```typescript
// User clicks "Save Inventory"
// Modal prompts for name and description

const conditionTree = {
  type: 'root',
  internalLogic: 'AND',
  items: [
    { id: '1', field: 'role', operator: 'equals', value: 'router' },
    { id: '2', field: 'location', operator: 'equals', value: 'DC1' }
  ]
}

// User submits modal
useSavedInventories.saveInventory(
  "DC1-Routers",           // name
  "All routers in DC1",    // description
  conditionTree,           // tree
  false                    // isUpdate
)

// Convert to storage format
const treeData = {
  version: 2,
  tree: conditionTree
}

// Send to backend
POST /api/proxy/inventory
{
  "name": "DC1-Routers",
  "description": "All routers in DC1",
  "conditions": [treeData],  // Array for backward compatibility
  "scope": "global",
  "created_by": "admin"
}

// Backend saves to database
INSERT INTO inventories (name, description, conditions, scope, created_by, ...)
VALUES ('DC1-Routers', 'All routers in DC1', '[{"version": 2, "tree": {...}}]', 'global', 'admin', ...)

// Success → Invalidate cache
queryClient.invalidateQueries({ queryKey: queryKeys.inventory.list() })

// Toast notification
toast({ title: 'Success', description: 'Inventory saved!' })
```

#### Load Flow

```typescript
// User clicks "Load Inventory"
// Modal shows list of saved inventories

// User selects "DC1-Routers"
useSavedInventories.loadInventory("DC1-Routers")

// Fetch from backend
GET /api/proxy/inventory/by-name/DC1-Routers

// Response
{
  "id": 123,
  "name": "DC1-Routers",
  "description": "All routers in DC1",
  "conditions": [
    {
      "version": 2,
      "tree": {
        "type": "root",
        "internalLogic": "AND",
        "items": [...]
      }
    }
  ],
  "scope": "global",
  "created_by": "admin"
}

// Check format
const firstItem = response.conditions[0]
if (firstItem.version === 2) {
  // New tree format
  const loadedTree = firstItem.tree
} else {
  // Legacy flat format → convert
  const loadedTree = flatConditionsToTree(response.conditions)
}

// Set tree
useConditionTree.setConditionTree(loadedTree)

// UI re-renders with loaded conditions
// Modal closes
```

---

## Query Execution

### GraphQL Query Building

#### Field-Specific Queries

**1. Name Field**

```graphql
# Exact match
query devices_by_name($name: [String]) {
  devices(name: $name) { id, name, ... }
}
variables: { "name": ["router-01"] }

# Contains (regex)
query devices_by_name($name: [String]) {
  devices(name__ire: $name) { id, name, ... }
}
variables: { "name": ["router.*"] }
```

**2. Location Field (Hierarchical)**

```graphql
# Exact match (includes children)
query devices_by_location($location: [String]) {
  devices(location: $location) { id, name, ... }
}
variables: { "location": ["DC1"] }

# Contains
query devices_by_location($location: [String]) {
  devices(location__name__ic: $location) { id, name, ... }
}
variables: { "location": ["DC"] }

# Not equals
query devices_by_location($location: [String]) {
  devices(location__n: $location) { id, name, ... }
}
variables: { "location": ["DC1"] }
```

**3. Custom Field (Dynamic)**

```graphql
# Select type custom field
query devices_by_custom_field($field_value: [String]) {
  devices(cf_snmp_credentials: $field_value) { id, name, ... }
}
variables: { "field_value": ["credA"] }

# Text type with contains
query devices_by_custom_field($field_value: [String]) {
  devices(cf_description__ic: $field_value) { id, name, ... }
}
variables: { "field_value": ["production"] }
```

**4. Has Primary IP (Boolean)**

```graphql
# Boolean filter (NOT a list)
query devices_by_has_primary($has_primary_ip: Boolean) {
  devices(has_primary_ip: $has_primary_ip) { id, name, ... }
}
variables: { "has_primary_ip": true }
```

#### Response Parsing

```python
def parse_graphql_devices(devices_data: List[dict]) -> Dict[str, DeviceInfo]:
    """
    Parse GraphQL response into DeviceInfo objects.

    Handles:
    - Nested objects (role.name, location.name, etc.)
    - Null values (unnamed devices, missing fields)
    - Array flattening (tags)
    - IP address extraction (primary_ip4.address)
    """
    devices_dict = {}

    for device in devices_data:
        # Safely extract nested fields
        role_obj = device.get("role") or {}
        location_obj = device.get("location") or {}
        device_type_obj = device.get("device_type") or {}
        manufacturer_obj = device_type_obj.get("manufacturer") or {}
        status_obj = device.get("status") or {}
        platform_obj = device.get("platform") or {}
        primary_ip4_obj = device.get("primary_ip4") or {}

        # Extract tags
        tags_list = device.get("tags") or []
        tags = [tag.get("name") for tag in tags_list if tag.get("name")]

        # Build DeviceInfo
        device_info = DeviceInfo(
            id=device["id"],
            name=device.get("name"),  # Can be None
            serial=device.get("serial"),
            location=location_obj.get("name"),
            role=role_obj.get("name"),
            tags=tags,
            device_type=device_type_obj.get("model"),
            manufacturer=manufacturer_obj.get("name"),
            platform=platform_obj.get("name"),
            primary_ip4=primary_ip4_obj.get("address"),
            status=status_obj.get("name")
        )

        devices_dict[device_info.id] = device_info

    return devices_dict
```

### Set Operations

```python
# Intersection (AND logic)
result = set1.intersection(set2)
# Example: {1,2,3} ∩ {2,3,4} = {2,3}

# Union (OR logic)
result = set1.union(set2)
# Example: {1,2,3} ∪ {2,3,4} = {1,2,3,4}

# Difference (NOT logic)
result = set1.difference(set2)
# Example: {1,2,3} - {2,3,4} = {1}
```

### Negation Handling

**Problem:** GraphQL has limited NOT support for some fields.

**Solution:** Query all devices, subtract matching ones.

```python
# Example: name NOT contains "test"
# Step 1: Get ALL devices
all_devices_resp = query_all_devices()  # Expensive!
all_ids = {dev1, dev2, dev3, dev4, dev5, ...}

# Step 2: Get matching devices
matching_resp = query_devices_by_name("test", "contains")
matching_ids = {dev3, dev5}

# Step 3: Subtract
result_ids = all_ids - matching_ids
# Result: {dev1, dev2, dev4, ...}

operations_count = 2  # 2 GraphQL queries
```

**Optimization:** For fields with native NOT support (e.g., location__n), use single query.

---

## Performance & Caching

### Frontend Caching (TanStack Query)

```typescript
// Static data (rarely changes)
useInventoryFieldOptionsQuery()
→ staleTime: 15 * 60 * 1000  // 15 minutes
→ Single query on mount, reused across components

// Semi-static data (changes occasionally)
useInventoryFieldValuesQuery(fieldName)
→ staleTime: 5 * 60 * 1000   // 5 minutes
→ Per-field caching

useInventoryCustomFieldsQuery(enabled)
→ staleTime: 10 * 60 * 1000  // 10 minutes
→ Load on demand, cache for session

useNautobotLocationsQuery(enabled)
→ staleTime: 10 * 60 * 1000  // 10 minutes
→ Load on demand, cache for session

// Dynamic data (always fresh)
useDevicePreviewMutation()
→ staleTime: 0
→ No caching, always executes query

// User data (frequently modified)
useSavedInventoriesQuery()
→ staleTime: 1 * 60 * 1000   // 1 minute
→ Auto-refetch on window focus
```

### Backend Caching

```python
# In-memory cache for custom field types
custom_field_types_cache: Dict[str, str] = {}

# Loaded once on first custom field query
# Persists for application lifetime
# No expiration (static metadata)

# Devices NOT cached → always fresh from Nautobot
```

### Performance Considerations

**Frontend:**
1. **Memoization:** All hooks return memoized objects to prevent re-renders
2. **On-demand Loading:** Field values/custom fields load only when needed
3. **Pagination:** Device preview paginated to 20 per page
4. **Set Operations:** Use Set for O(1) lookup instead of arrays

**Backend:**
1. **GraphQL Efficiency:** Single query per condition vs multiple REST calls
2. **Set Operations:** Python sets for O(1) membership testing
3. **Database Indexes:**
   - `idx_inventory_scope_created_by`: Quick user access
   - `idx_inventory_active_scope`: Filter active inventories

**Bottlenecks:**
1. **Negation Queries:** Require fetching ALL devices → expensive
2. **Deep Tree Nesting:** Recursive operations slower with deep hierarchies
3. **Large Device Sets:** Operations on 10,000+ devices can be slow

**Optimization Tips:**
- Use positive filters when possible (avoid NOT)
- Keep tree structure shallow (max 3-4 levels)
- Use specific filters early in tree (reduce result set)
- Consider caching common queries

---

## Troubleshooting

### Common Issues

#### 1. Double-Prefixed Custom Fields (cf_cf_*)

**Symptom:**
```
GraphQL error: Unknown argument 'cf_cf_snmp_credentials'
Did you mean 'cf_snmp_credentials'?
```

**Cause:** Custom field name prefixed twice with "cf_"

**Fix:** Ensure `handleCustomFieldSelect` does NOT add "cf_" prefix (it's already present from SelectItem value)

**Location:** `/frontend/src/hooks/shared/device-selector/use-device-filter.ts:129-143`

#### 2. Empty Preview Results (No Error)

**Symptom:** Preview returns 0 devices when devices should match

**Debug Steps:**
1. Check backend logs for GraphQL queries executed
2. Verify GraphQL variables are correct format (lists vs strings)
3. Test GraphQL query directly in Nautobot GraphiQL
4. Check operator support for field type

**Common Causes:**
- Wrong GraphQL variable type (String vs [String])
- Field doesn't support selected operator
- Typo in field value
- Case sensitivity (some fields are case-sensitive)

#### 3. Infinite Re-render Loop

**Symptom:** Browser freezes, React DevTools shows constant re-renders

**Cause:** Non-memoized objects in hook returns or useEffect dependencies

**Fix:** Ensure all hooks return memoized objects with `useMemo`

**Example:**
```typescript
// ❌ WRONG - New object every render
return { state, setState }

// ✓ CORRECT - Memoized object
return useMemo(() => ({ state, setState }), [state])
```

#### 4. Saved Inventory Won't Load

**Symptom:** Error loading saved inventory or tree doesn't populate

**Debug Steps:**
1. Check `conditions` column in database
2. Verify JSON format is valid
3. Check for version field (`version: 2`)
4. Test with legacy format conversion

**Common Causes:**
- Corrupted JSON in database
- Missing version field
- Incorrect storage format

#### 5. Location Hierarchy Not Working

**Symptom:** Querying parent location doesn't return devices in child locations

**Cause:** GraphQL filter doesn't use hierarchical lookup

**Fix:** Ensure using `location: [String]` filter, NOT `location__name`

**Correct:**
```graphql
devices(location: ["Germany"])  # Returns Germany + Berlin + Munich
```

**Incorrect:**
```graphql
devices(location__name: ["Germany"])  # Returns only Germany
```

### Debug Tools

#### Frontend

```typescript
// Enable TanStack Query DevTools (already configured)
// Bottom-left icon in browser → Shows all queries, cache status

// Console logging
console.log('Condition Tree:', JSON.stringify(conditionTree, null, 2))
console.log('Operations:', JSON.stringify(operations, null, 2))
console.log('Preview Devices:', previewDevices)
```

#### Backend

```python
# Enable debug logging in inventory service
import logging
logger = logging.getLogger("services.inventory.inventory")
logger.setLevel(logging.DEBUG)

# Log GraphQL queries
logger.debug(f"GraphQL Query: {query}")
logger.debug(f"Variables: {variables}")

# Log device results
logger.debug(f"Devices found: {len(devices_dict)}")
logger.debug(f"Device IDs: {device_ids}")
```

#### Database

```sql
-- Check saved inventories
SELECT id, name, created_by, scope, is_active,
       LEFT(conditions, 100) as conditions_preview
FROM inventories
WHERE created_by = 'username'
ORDER BY created_at DESC;

-- Check specific inventory
SELECT conditions
FROM inventories
WHERE name = 'DC1-Routers'
  AND created_by = 'username';

-- Check JSON structure
SELECT id, name,
       json_extract(conditions, '$[0].version') as version,
       json_extract(conditions, '$[0].tree.type') as tree_type
FROM inventories;
```

### Logging Examples

**Backend Logs (Normal Execution):**
```
2026-01-31 00:20:33,972 - services.inventory.inventory - DEBUG - Custom field 'snmp_credentials' variables: {'field_value': ['credA']}
2026-01-31 00:20:33,972 - services.inventory.inventory - INFO - Custom field 'snmp_credentials' filter: cf_snmp_credentials, type: select, graphql_var_type: [String]
2026-01-31 00:20:33,973 - services.nautobot.client - DEBUG - Using database settings for Nautobot: http://localhost:8080
2026-01-31 00:20:33,995 - services.nautobot.client - DEBUG - GraphQL query executed successfully
2026-01-31 00:20:33,996 - services.inventory.inventory - INFO - Found 5 devices matching custom field cf_snmp_credentials
```

**Backend Logs (Error - Double Prefix):**
```
2026-01-31 00:20:33,972 - services.inventory.inventory - ERROR - Error querying devices by custom field 'cf_cf_snmp_credentials': GraphQL request failed with status 400: {"errors":[{"message":"Unknown argument 'cf_cf_snmp_credentials' on field 'Query.devices'. Did you mean 'cf_snmp_credentials'?"}]}
```

---

## API Reference

### REST Endpoints

#### POST /api/inventory/preview
Execute conditions and return matching devices.

**Request:**
```json
{
  "operations": [
    {
      "operation_type": "AND",
      "conditions": [
        {
          "field": "role",
          "operator": "equals",
          "value": "router"
        }
      ],
      "nested_operations": []
    }
  ]
}
```

**Response:**
```json
{
  "devices": [
    {
      "id": "uuid-123",
      "name": "router-01",
      "serial": "SN12345",
      "location": "DC1",
      "role": "router",
      "tags": ["critical"],
      "device_type": "ASR1001-X",
      "manufacturer": "Cisco",
      "platform": "ios",
      "primary_ip4": "10.0.0.1/32",
      "status": "active"
    }
  ],
  "total_count": 25,
  "operations_executed": 1
}
```

#### GET /api/inventory/field-options
Get available fields and operators.

**Response:**
```json
{
  "fields": [
    { "value": "name", "label": "Name" },
    { "value": "location", "label": "Location" },
    { "value": "role", "label": "Role" },
    { "value": "custom_fields", "label": "Custom Fields" }
  ],
  "operators": [
    { "value": "equals", "label": "Equals" },
    { "value": "contains", "label": "Contains" },
    { "value": "not_equals", "label": "Not Equals" },
    { "value": "not_contains", "label": "Not Contains" }
  ],
  "logical_operations": [
    { "value": "AND", "label": "AND" },
    { "value": "OR", "label": "OR" },
    { "value": "NOT", "label": "NOT" }
  ]
}
```

#### GET /api/inventory/field-values/{field_name}
Get values for specific field.

**Examples:**

```bash
# Get custom fields list
GET /api/inventory/field-values/custom_fields

# Response
{
  "field": "custom_fields",
  "values": [
    { "value": "cf_snmp_credentials", "label": "SNMP Credentials" },
    { "value": "cf_description", "label": "Description" }
  ],
  "input_type": "select"
}

# Get values for custom field
GET /api/inventory/field-values/cf_snmp_credentials

# Response
{
  "field": "cf_snmp_credentials",
  "values": [
    { "value": "credA", "label": "credA" },
    { "value": "credB", "label": "credB" }
  ],
  "input_type": "select"
}

# Get locations
GET /api/inventory/field-values/location

# Response
{
  "field": "location",
  "values": [
    { "value": "dc1", "label": "DC1" },
    { "value": "dc2", "label": "DC2" }
  ],
  "input_type": "select"
}
```

#### GET /api/inventory/custom-fields
Get custom fields from Nautobot.

**Response:**
```json
{
  "custom_fields": [
    {
      "key": "snmp_credentials",
      "name": "snmp_credentials",
      "label": "SNMP Credentials",
      "type": "select",
      "choices": ["credA", "credB", "credC"]
    },
    {
      "key": "description",
      "name": "description",
      "label": "Description",
      "type": "text"
    }
  ]
}
```

#### POST /api/inventory
Save new inventory.

**Request:**
```json
{
  "name": "DC1-Routers",
  "description": "All routers in DC1",
  "conditions": [
    {
      "version": 2,
      "tree": {
        "type": "root",
        "internalLogic": "AND",
        "items": [...]
      }
    }
  ],
  "scope": "global"
}
```

#### GET /api/inventory/by-name/{name}
Load inventory by name.

**Response:**
```json
{
  "id": 123,
  "name": "DC1-Routers",
  "description": "All routers in DC1",
  "conditions": [
    {
      "version": 2,
      "tree": { ... }
    }
  ],
  "scope": "global",
  "created_by": "admin",
  "created_at": "2026-01-31T12:00:00Z"
}
```

---

## Summary

The Inventory Builder is a complex feature with:

- **Frontend:** Tree-based condition builder with shared DeviceSelector component
- **Backend:** Recursive operation execution with GraphQL queries
- **Data Flow:** Tree → Operations → GraphQL → Devices
- **Persistence:** Save/load inventories with version migration
- **Caching:** TanStack Query for frontend, in-memory for backend

**Key Files:**
- Frontend: `/frontend/src/components/shared/device-selector.tsx`
- Hooks: `/frontend/src/hooks/shared/device-selector/*`
- Backend: `/backend/services/inventory/inventory.py`
- Models: `/backend/models/inventory.py`
- Database: `inventories` table

**Integration Points:**
- Nautobot GraphQL API (device queries)
- Nautobot REST API (custom fields, locations)
- PostgreSQL (saved inventories)
- TanStack Query (caching & mutations)

This document provides a complete reference for understanding, maintaining, and extending the Inventory Builder feature.
