# Backup Task Workflow - Inventory to Device Conversion

## Overview

This document explains how scheduled backup tasks convert inventory definitions (logical filter conditions) into concrete device IDs for execution. The workflow demonstrates that **scheduled backup tasks DO use the improved custom field type logic** through the unified `ansible_inventory_service`.

---

## Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. USER CREATES BACKUP TEMPLATE                                     │
│    - Type: "backup"                                                  │
│    - Inventory Source: "inventory"                                   │
│    - Inventory Name: "production_routers" (saved inventory)          │
│    - Config Repository ID: 5                                         │
│    - Credential: (selected)                                          │
│    - Backup paths: (templates)                                       │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. USER SCHEDULES JOB USING TEMPLATE                                │
│    - Schedule: "Daily at 2am"                                        │
│    - Template ID: 42                                                 │
│    - Credential ID: 7                                                │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. CELERY BEAT TRIGGERS CHECK EVERY MINUTE                          │
│    - Celery Beat process runs check_job_schedules_task()            │
│    - Task queries database for due schedules (next_run <= now)      │
│    - Finds schedule ID 99 (next_run = 02:00:00)                     │
│    - For this schedule:                                              │
│      Calls: job_dispatcher_task.delay(                              │
│        template_id=42,                                               │
│        schedule_id=99,                                               │
│        credential_id=7,                                              │
│        triggered_by="schedule"                                       │
│      )                                                               │
│    - Updates next_run to next occurrence (tomorrow 02:00:00)        │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. JOB DISPATCHER                                                    │
│    File: /backend/tasks/scheduling/job_dispatcher.py                │
│                                                                      │
│    Steps:                                                            │
│    a) Load template from database (template_id=42)                  │
│    b) Extract template properties:                                  │
│       - inventory_source = "inventory"                               │
│       - inventory_name = "production_routers"                        │
│       - config_repository_id = 5                                     │
│       - created_by = "admin"                                         │
│                                                                      │
│    c) ✅ CONVERT INVENTORY TO DEVICE IDS                            │
│       target_devices = get_target_devices(template, job_parameters) │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. GET_TARGET_DEVICES FUNCTION                                      │
│    File: /backend/tasks/utils/device_helpers.py                     │
│                                                                      │
│    Input: template = {                                               │
│      "inventory_source": "inventory",                                │
│      "inventory_name": "production_routers",                         │
│      "created_by": "admin"                                           │
│    }                                                                 │
│                                                                      │
│    Process:                                                          │
│    ┌─────────────────────────────────────────────────────┐          │
│    │ 5a. Load Saved Inventory from Database             │          │
│    │     inventory_manager.get_inventory_by_name(        │          │
│    │       "production_routers", "admin"                 │          │
│    │     )                                               │          │
│    │                                                     │          │
│    │     Returns: {                                      │          │
│    │       "id": 123,                                    │          │
│    │       "name": "production_routers",                 │          │
│    │       "conditions": [                               │          │
│    │         {                                           │          │
│    │           "field": "role",                          │          │
│    │           "operator": "equals",                     │          │
│    │           "value": "router",                        │          │
│    │           "logic": "AND"                            │          │
│    │         },                                          │          │
│    │         {                                           │          │
│    │           "field": "cf_checkmk_site",               │          │
│    │           "operator": "equals",                     │          │
│    │           "value": "production",                    │          │
│    │           "logic": "AND"                            │          │
│    │         }                                           │          │
│    │       ]                                             │          │
│    │     }                                               │          │
│    └─────────────────────────────────────────────────────┘          │
│                          │                                           │
│                          ▼                                           │
│    ┌─────────────────────────────────────────────────────┐          │
│    │ 5b. Convert Conditions to LogicalOperations        │          │
│    │     operations = convert_conditions_to_operations(  │          │
│    │       inventory["conditions"]                       │          │
│    │     )                                               │          │
│    │                                                     │          │
│    │     Returns: [                                      │          │
│    │       LogicalOperation(                             │          │
│    │         operation_type="AND",                       │          │
│    │         conditions=[                                │          │
│    │           LogicalCondition(                         │          │
│    │             field="role",                           │          │
│    │             operator="equals",                      │          │
│    │             value="router",                         │          │
│    │             logic="AND"                             │          │
│    │           ),                                        │          │
│    │           LogicalCondition(                         │          │
│    │             field="cf_checkmk_site",                │          │
│    │             operator="equals",                      │          │
│    │             value="production",                     │          │
│    │             logic="AND"                             │          │
│    │           )                                         │          │
│    │         ]                                           │          │
│    │       )                                             │          │
│    │     ]                                               │          │
│    └─────────────────────────────────────────────────────┘          │
│                          │                                           │
│                          ▼                                           │
│    ┌─────────────────────────────────────────────────────┐          │
│    │ 5c. ✅ EXECUTE INVENTORY WITH NEW CUSTOM FIELD     │          │
│    │        TYPE LOGIC                                   │          │
│    │                                                     │          │
│    │     devices, _ = ansible_inventory_service          │          │
│    │       .preview_inventory(operations)                │          │
│    │                                                     │          │
│    │     This calls:                                     │          │
│    │     - _execute_operation()                          │          │
│    │       - For each condition:                         │          │
│    │     - _execute_condition()                          │          │
│    │       - Routes to appropriate query function        │          │
│    │     - For cf_* fields:                              │          │
│    │       _query_devices_by_custom_field()              │          │
│    │         ✅ Fetches custom field types               │          │
│    │         ✅ Detects cf_checkmk_site is "select"      │          │
│    │         ✅ Uses GraphQL type [String]               │          │
│    │         ✅ Wraps value in array: ["production"]     │          │
│    │                                                     │          │
│    │     GraphQL Query Executed:                         │          │
│    │     ┌───────────────────────────────────────┐       │          │
│    │     │ query devices_by_custom_field(        │       │          │
│    │     │   $field_value: [String]              │       │          │
│    │     │ ) {                                   │       │          │
│    │     │   devices(cf_checkmk_site: $field_value) {│       │          │
│    │     │     id                                │       │          │
│    │     │     name                              │       │          │
│    │     │     ...                               │       │          │
│    │     │   }                                   │       │          │
│    │     │ }                                     │       │          │
│    │     │                                       │       │          │
│    │     │ Variables: {                          │       │          │
│    │     │   "field_value": ["production"]       │       │          │
│    │     │ }                                     │       │          │
│    │     └───────────────────────────────────────┘       │          │
│    │                                                     │          │
│    │     Returns: [                                      │          │
│    │       DeviceInfo(id="uuid-1234", name="router1"),   │          │
│    │       DeviceInfo(id="uuid-5678", name="router2"),   │          │
│    │       DeviceInfo(id="uuid-9abc", name="router3")    │          │
│    │     ]                                               │          │
│    └─────────────────────────────────────────────────────┘          │
│                          │                                           │
│                          ▼                                           │
│    ┌─────────────────────────────────────────────────────┐          │
│    │ 5d. Extract Device IDs                             │          │
│    │     device_ids = [device.id for device in devices] │          │
│    │                                                     │          │
│    │     Returns: [                                      │          │
│    │       "uuid-1234-5678-abcd",                        │          │
│    │       "uuid-5678-9abc-defg",                        │          │
│    │       "uuid-9abc-defg-hijk"                         │          │
│    │     ]                                               │          │
│    └─────────────────────────────────────────────────────┘          │
│                                                                      │
│    Output: target_devices = [                                       │
│      "uuid-1234-5678-abcd",                                         │
│      "uuid-5678-9abc-defg",                                         │
│      "uuid-9abc-defg-hijk"                                          │
│    ]                                                                 │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. EXECUTE JOB TYPE                                                 │
│    File: /backend/tasks/execution/base_executor.py                  │
│                                                                      │
│    Calls: execute_backup(                                           │
│      schedule_id=schedule_id,                                       │
│      credential_id=credential_id,                                   │
│      job_parameters={...},                                          │
│      target_devices=[                                               │
│        "uuid-1234-5678-abcd",                                       │
│        "uuid-5678-9abc-defg",                                       │
│        "uuid-9abc-defg-hijk"                                        │
│      ],                                                              │
│      task_context=self,                                             │
│      template=template                                              │
│    )                                                                 │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. BACKUP EXECUTOR                                                   │
│    File: /backend/tasks/execution/backup_executor.py                │
│                                                                      │
│    Input: target_devices = [                                        │
│      "uuid-1234-5678-abcd",                                         │
│      "uuid-5678-9abc-defg",                                         │
│      "uuid-9abc-defg-hijk"                                          │
│    ]                                                                 │
│                                                                      │
│    Steps:                                                            │
│    ┌──────────────────────────────────────────────────────┐         │
│    │ STEP 1: Validate Inputs                             │         │
│    │   - Check credential exists                          │         │
│    │   - Check repository exists                          │         │
│    │   - Validate target_devices is not empty             │         │
│    └──────────────────────────────────────────────────────┘         │
│                          │                                           │
│                          ▼                                           │
│    ┌──────────────────────────────────────────────────────┐         │
│    │ STEP 2: Setup Git Repository                        │         │
│    │   - Clone or open repository                         │         │
│    │   - Pull latest changes                              │         │
│    │   - Prepare for commits                              │         │
│    └──────────────────────────────────────────────────────┘         │
│                          │                                           │
│                          ▼                                           │
│    ┌──────────────────────────────────────────────────────┐         │
│    │ STEP 3: Backup Each Device (Loop)                   │         │
│    │                                                      │         │
│    │   For device_id in target_devices:                  │         │
│    │                                                      │         │
│    │   ┌────────────────────────────────────────┐        │         │
│    │   │ 3a. Fetch Device Details from Nautobot│        │         │
│    │   │     GraphQL query by device ID         │        │         │
│    │   │     Gets: name, IP, platform, etc.     │        │         │
│    │   └────────────────────────────────────────┘        │         │
│    │                  │                                   │         │
│    │                  ▼                                   │         │
│    │   ┌────────────────────────────────────────┐        │         │
│    │   │ 3b. Connect via SSH (Netmiko)          │        │         │
│    │   │     - Use device IP and credentials    │        │         │
│    │   │     - Map platform to device_type      │        │         │
│    │   └────────────────────────────────────────┘        │         │
│    │                  │                                   │         │
│    │                  ▼                                   │         │
│    │   ┌────────────────────────────────────────┐        │         │
│    │   │ 3c. Execute Commands                   │        │         │
│    │   │     - show running-config              │        │         │
│    │   │     - show startup-config              │        │         │
│    │   └────────────────────────────────────────┘        │         │
│    │                  │                                   │         │
│    │                  ▼                                   │         │
│    │   ┌────────────────────────────────────────┐        │         │
│    │   │ 3d. Save Configs to Git Repo Files    │        │         │
│    │   │     - Apply path templates             │        │         │
│    │   │     - Write to repository files        │        │         │
│    │   │     Example:                           │        │         │
│    │   │     backups/router1.running-config     │        │         │
│    │   │     backups/router1.startup-config     │        │         │
│    │   └────────────────────────────────────────┘        │         │
│    │                                                      │         │
│    │   Success: backed_up_devices.append(device_info)    │         │
│    │   Failure: failed_devices.append(device_info)       │         │
│    └──────────────────────────────────────────────────────┘         │
│                          │                                           │
│                          ▼                                           │
│    ┌──────────────────────────────────────────────────────┐         │
│    │ STEP 4: Git Commit and Push                         │         │
│    │   - git add .                                        │         │
│    │   - git commit -m "Backup config 20251212_140500"   │         │
│    │   - git push                                         │         │
│    └──────────────────────────────────────────────────────┘         │
│                          │                                           │
│                          ▼                                           │
│    ┌──────────────────────────────────────────────────────┐         │
│    │ STEP 5: Update Nautobot Custom Fields (Optional)    │         │
│    │   - If write_timestamp_to_custom_field enabled      │         │
│    │   - Update cf_last_backup = "2025-12-12"            │         │
│    │   - For each successfully backed up device          │         │
│    └──────────────────────────────────────────────────────┘         │
│                                                                      │
│    Note: Backup executor does NOT filter devices -                  │
│          it processes the pre-filtered device ID list               │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 8. RESULT                                                            │
│    {                                                                 │
│      "success": true,                                                │
│      "devices_backed_up": 3,                                         │
│      "devices_failed": 0,                                            │
│      "message": "Backed up 3 device configurations",                 │
│      "backed_up_devices": [                                          │
│        {                                                             │
│          "device_id": "uuid-1234-5678-abcd",                         │
│          "device_name": "router1",                                   │
│          "device_ip": "192.168.1.1",                                 │
│          "platform": "cisco_ios",                                    │
│          "running_config_file": "backups/router1.running-config",    │
│          "startup_config_file": "backups/router1.startup-config",    │
│          "running_config_bytes": 45678,                              │
│          "startup_config_bytes": 45123                               │
│        },                                                            │
│        ...                                                           │
│      ],                                                              │
│      "failed_devices": [],                                           │
│      "git_commit_status": {                                          │
│        "committed": true,                                            │
│        "pushed": true,                                               │
│        "commit_hash": "a1b2c3d4",                                    │
│        "files_changed": 6                                            │
│      },                                                              │
│      "timestamp_update_status": {                                    │
│        "enabled": true,                                              │
│        "updated_count": 3,                                           │
│        "failed_count": 0                                             │
│      }                                                               │
│    }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Files and Functions

### 1. Job Dispatcher
**File**: `/backend/tasks/scheduling/job_dispatcher.py`

**Function**: `job_dispatcher_task()`

**Responsibility**: Orchestrates job execution by loading template, converting inventory to device IDs, and calling the appropriate executor.

```python
# Load template
template = job_template_manager.get_job_template(template_id)

# Convert inventory to device IDs
target_devices = get_target_devices(template, job_parameters)

# Execute job
result = execute_job_type(
    job_type=job_type,
    target_devices=target_devices,
    ...
)
```

---

### 2. Device Helpers
**File**: `/backend/tasks/utils/device_helpers.py`

**Function**: `get_target_devices(template, job_parameters)`

**Responsibility**: Converts template's inventory definition into concrete device IDs using the unified inventory service.

```python
def get_target_devices(template: dict, job_parameters: Optional[dict] = None) -> Optional[List]:
    inventory_source = template.get("inventory_source", "all")

    if inventory_source == "inventory":
        inventory_name = template.get("inventory_name")

        # Load saved inventory from database
        inventory = inventory_manager.get_inventory_by_name(inventory_name, username)

        # Convert conditions to operations
        operations = convert_conditions_to_operations(inventory["conditions"])

        # ✅ USES UNIFIED INVENTORY SERVICE WITH CUSTOM FIELD TYPE LOGIC
        devices, _ = ansible_inventory_service.preview_inventory(operations)

        # Extract device IDs
        device_ids = [device.id for device in devices]

        return device_ids
```

---

### 3. Ansible Inventory Service
**File**: `/backend/services/ansible_inventory.py`

**Function**: `preview_inventory(operations)`

**Responsibility**: Executes logical operations to filter devices with proper custom field type handling.

```python
async def preview_inventory(self, operations: List[LogicalOperation]) -> tuple[List[DeviceInfo], int]:
    for operation in operations:
        operation_result, op_count, devices_data = await self._execute_operation(operation)
        # ... combine results

    return devices, operations_count

async def _execute_condition(self, condition: LogicalCondition) -> List[DeviceInfo]:
    # Route to appropriate query function
    if condition.field.startswith("cf_"):
        return await self._query_devices_by_custom_field(...)
    elif condition.field == "role":
        return await self._query_devices_by_role(...)
    # ... etc

async def _query_devices_by_custom_field(self, custom_field_name, custom_field_value, use_contains):
    # ✅ CUSTOM FIELD TYPE LOGIC APPLIED HERE

    # Fetch custom field types
    custom_field_types = await self._get_custom_field_types()

    # Determine GraphQL variable type
    cf_type = custom_field_types.get(cf_key)
    if cf_type == "select":
        graphql_var_type = "[String]"
    elif use_contains:
        graphql_var_type = "[String]"
    else:
        graphql_var_type = "String"

    # Build and execute GraphQL query
    query = f"""
    query devices_by_custom_field($field_value: {graphql_var_type}) {{
      devices({filter_field}: $field_value) {{ ... }}
    }}
    """

    # Format variables
    if graphql_var_type == "[String]":
        variables = {"field_value": [custom_field_value]}
    else:
        variables = {"field_value": custom_field_value}

    result = await nautobot_service.graphql_query(query, variables)
```

---

### 4. Backup Executor
**File**: `/backend/tasks/execution/backup_executor.py`

**Function**: `execute_backup(target_devices, ...)`

**Responsibility**: Processes each device in the pre-filtered list - connects via SSH, fetches configs, commits to Git.

```python
def execute_backup(target_devices: Optional[list], ...):
    # RECEIVES pre-filtered device IDs
    # Does NOT re-filter - just processes each device

    for device_id in target_devices:
        # Fetch device details
        device_data = nautobot_service._sync_graphql_query(query, {"deviceId": device_id})

        # Connect via SSH
        result = netmiko_service._connect_and_execute(...)

        # Save configs to files
        running_file.write_text(running_config)
        startup_file.write_text(startup_config)

    # Commit to Git
    git_service.commit_and_push(...)
```

---

## ✅ Confirmation: Custom Field Type Logic is Used

### Evidence

1. **`get_target_devices()` calls `ansible_inventory_service.preview_inventory()`**
   - Location: `/backend/tasks/utils/device_helpers.py:76-78`

2. **`preview_inventory()` uses `_query_devices_by_custom_field()`**
   - Location: `/backend/services/ansible_inventory.py:735-865`

3. **`_query_devices_by_custom_field()` implements custom field type logic**
   - Fetches field types from Nautobot
   - Determines correct GraphQL variable type
   - Formats variables appropriately

### Custom Field Type Decision Matrix

| Custom Field Type | Lookup (contains)? | GraphQL Variable Type | Variable Format | Example |
|-------------------|--------------------|-----------------------|-----------------|---------|
| `select` | No | `[String]` | `["value"]` | `cf_checkmk_site: ["prod"]` |
| `select` | Yes (`__ic`) | `[String]` | `["value"]` | `cf_checkmk_site__ic: ["prod"]` |
| `text` | No | `String` | `"value"` | `cf_description: "text"` |
| `text` | Yes (`__ic`) | `[String]` | `["value"]` | `cf_description__ic: ["text"]` |
| `date` | No | `String` | `"2025-12-12"` | `cf_last_backup: "2025-12-12"` |
| `date` | Yes (`__ic`) | `[String]` | `["2025"]` | `cf_last_backup__ic: ["2025"]` |

---

## Inventory Source Types

Templates can use different inventory sources:

### 1. `inventory_source="all"`
- Uses ALL devices in Nautobot
- No filtering applied
- `target_devices = None` (indicates all)

### 2. `inventory_source="inventory"`
- Uses saved inventory from database
- Applies logical filter conditions
- ✅ **Uses custom field type logic**
- Converts to device ID list

### 3. `inventory_source="tags"` (if implemented)
- Filters devices by tags
- Returns matching device IDs

---

## Separation of Concerns

The architecture cleanly separates **filtering** from **execution**:

### Filtering Phase (Uses Custom Field Logic)
- **Where**: `get_target_devices()` → `ansible_inventory_service`
- **When**: Before job execution
- **Output**: List of device UUIDs
- **Features**: Logical operations, custom field type detection, caching

### Execution Phase (Processes Device List)
- **Where**: `execute_backup()` (or other executors)
- **When**: After filtering complete
- **Input**: List of device UUIDs
- **Features**: SSH connection, config retrieval, Git operations

### Benefits of This Architecture

1. **✅ Single Source of Truth**: All filtering uses `ansible_inventory_service`
2. **✅ Custom Field Logic Applied Once**: During filtering, not per-device
3. **✅ Predictable Results**: Same devices selected as preview showed
4. **✅ Performance**: Filter once, execute many operations
5. **✅ Maintainability**: Fix filtering bugs in one place

---

## Related Documentation

- **Custom Field Type Fix**: [CUSTOM_FIELD_TYPE_FIX.md](CUSTOM_FIELD_TYPE_FIX.md)
- **Inventory Consolidation**: [CONSOLIDATION_SUMMARY.md](CONSOLIDATION_SUMMARY.md)
- **Inventory Plan**: [INVENTORY_CONSOLIDATION_PLAN.md](INVENTORY_CONSOLIDATION_PLAN.md)
- **Architecture Guide**: [CLAUDE.md](CLAUDE.md)

---

**Last Updated**: 2025-12-12
**Version**: 1.0
**Status**: ✅ Documented
