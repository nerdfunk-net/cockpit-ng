# Inventory to Device List Resolution - Common Code Pattern

## Overview

Converting a saved inventory configuration to a list of device IDs is a common operation used throughout the application. This document describes the centralized code pattern and how to use it.

## Problem Statement

Many features need to convert an inventory name to a list of matching device IDs:
- **Backup operations** - Need device list to back up configurations
- **Job execution** - Need devices to run jobs against
- **Bulk operations** - Need devices for batch processing
- **API endpoints** - Need to return device counts/lists

Previously, this logic was duplicated across multiple modules, leading to:
- Code duplication (same logic in API routes, Celery tasks, services)
- Maintenance burden (changes needed in multiple places)
- Inconsistent behavior (slight variations in implementation)

## Solution: Centralized Inventory Resolver

### Core Module: `utils/inventory_resolver.py`

This module provides two main functions:

#### 1. `resolve_inventory_to_device_ids()` - Async Version
```python
from utils.inventory_resolver import resolve_inventory_to_device_ids

# In async context (API endpoints, async services)
device_ids = await resolve_inventory_to_device_ids(
    inventory_name="production-routers",
    username="admin"
)

if device_ids:
    print(f"Found {len(device_ids)} devices")
else:
    print("Inventory not found or no matching devices")
```

#### 2. `resolve_inventory_to_device_ids_sync()` - Sync Version
```python
from utils.inventory_resolver import resolve_inventory_to_device_ids_sync

# In sync context (Celery tasks)
device_ids = resolve_inventory_to_device_ids_sync(
    inventory_name="production-routers",
    username="admin"
)

if device_ids:
    # Proceed with device operations
    backup_devices(device_ids)
```

## How It Works

The resolver follows this workflow:

1. **Load inventory from database** - Uses `inventory_manager.get_inventory_by_name()`
2. **Convert tree structure to operations** - Uses `inventory_converter.convert_saved_inventory_to_operations()`
3. **Evaluate operations** - Uses `ansible_inventory_service.preview_inventory()`
4. **Extract device UUIDs** - Returns list of device IDs

```
┌─────────────────────┐
│  Inventory Name     │
│  "prod-routers"     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Load from DB       │
│  (inventory_manager)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Convert Conditions │
│  (tree → operations)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Evaluate           │
│  (preview_inventory)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Device IDs List    │
│  ["uuid1", "uuid2"] │
└─────────────────────┘
```

## Usage Examples

### 1. API Endpoint (Async)

```python
# routers/inventory/inventory.py

@router.post("/resolve-devices")
async def resolve_inventory_to_devices(
    inventory_name: str,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> dict:
    from utils.inventory_resolver import resolve_inventory_to_device_ids
    
    username = current_user.get("username")
    device_ids = await resolve_inventory_to_device_ids(inventory_name, username)
    
    if device_ids is None:
        raise HTTPException(404, detail="Inventory not found")
    
    return {
        "device_ids": device_ids,
        "device_count": len(device_ids),
        "inventory_name": inventory_name,
    }
```

### 2. Celery Task (Sync)

```python
# tasks/backup_tasks.py

from celery import shared_task
from utils.inventory_resolver import resolve_inventory_to_device_ids_sync

@shared_task
def backup_from_inventory_task(inventory_name: str, username: str):
    # Resolve inventory to device list
    device_ids = resolve_inventory_to_device_ids_sync(inventory_name, username)
    
    if not device_ids:
        return {"error": "No devices found in inventory"}
    
    # Proceed with backup
    results = []
    for device_id in device_ids:
        result = backup_device(device_id)
        results.append(result)
    
    return {"devices_backed_up": len(results)}
```

### 3. Service Layer (Async)

```python
# services/network/configs/backup_service.py

from utils.inventory_resolver import resolve_inventory_to_device_ids

class BackupService:
    async def trigger_bulk_backup_from_inventory(
        self, inventory_name: str, username: str
    ):
        # Resolve inventory
        device_ids = await resolve_inventory_to_device_ids(inventory_name, username)
        
        if not device_ids:
            raise ValueError(f"Inventory '{inventory_name}' has no matching devices")
        
        # Trigger backup task with device list
        task = backup_devices_task.delay(inventory=device_ids, ...)
        return {"task_id": task.id, "device_count": len(device_ids)}
```

### 4. Job Template Helper (Sync)

```python
# tasks/utils/device_helpers.py

from utils.inventory_resolver import resolve_inventory_to_device_ids_sync

def get_target_devices(template: dict) -> Optional[List[str]]:
    inventory_source = template.get("inventory_source", "all")
    
    if inventory_source == "inventory":
        inventory_name = template.get("inventory_name")
        username = template.get("created_by", "admin")
        
        # Use shared resolver
        return resolve_inventory_to_device_ids_sync(inventory_name, username)
    
    return None  # All devices
```

## Related Components

### 1. Inventory Converter (`utils/inventory_converter.py`)
Handles conversion of tree-based inventory structure to `LogicalOperation` objects.

**Used by:** `inventory_resolver.py` internally

### 2. Condition Helpers (`tasks/utils/condition_helpers.py`)
Provides `convert_conditions_to_operations()` wrapper around the converter.

**Status:** Still used by some legacy code, but inventory_resolver provides higher-level abstraction

### 3. Device Helpers (`tasks/utils/device_helpers.py`)
Provides `get_target_devices()` for job templates.

**Uses:** `inventory_resolver.py` internally

## API Endpoints

### POST `/api/inventory/resolve-devices`

Resolves an inventory name to device IDs list.

**Request:**
```http
POST /api/inventory/resolve-devices?inventory_name=production-routers
Authorization: Bearer <token>
```

**Response:**
```json
{
  "device_ids": ["uuid1", "uuid2", "uuid3"],
  "device_count": 3,
  "inventory_name": "production-routers"
}
```

**Use Cases:**
- Frontend needs to show device count before triggering backup
- Validation before running bulk operations
- Preview devices that will be affected by an operation

## Testing

```python
# Test with async context
import pytest
from utils.inventory_resolver import resolve_inventory_to_device_ids

@pytest.mark.asyncio
async def test_resolve_inventory():
    device_ids = await resolve_inventory_to_device_ids(
        inventory_name="test-inventory",
        username="testuser"
    )
    assert device_ids is not None
    assert len(device_ids) > 0
    assert isinstance(device_ids[0], str)  # UUID string

# Test with sync context
from utils.inventory_resolver import resolve_inventory_to_device_ids_sync

def test_resolve_inventory_sync():
    device_ids = resolve_inventory_to_device_ids_sync(
        inventory_name="test-inventory",
        username="testuser"
    )
    assert device_ids is not None
```

## Migration Guide

If you're maintaining code that does inventory resolution:

### Before (Old Pattern)
```python
# Duplicated in multiple places
from inventory_manager import inventory_manager
from services.network.automation.ansible_inventory import ansible_inventory_service
from utils.inventory_converter import convert_saved_inventory_to_operations
import asyncio

inventory = inventory_manager.get_inventory_by_name(name, username)
operations = convert_saved_inventory_to_operations(inventory["conditions"])

loop = asyncio.new_event_loop()
devices, _ = loop.run_until_complete(
    ansible_inventory_service.preview_inventory(operations)
)
device_ids = [device.id for device in devices]
loop.close()
```

### After (New Pattern)
```python
# Single import, one line
from utils.inventory_resolver import resolve_inventory_to_device_ids_sync

device_ids = resolve_inventory_to_device_ids_sync(name, username)
```

## Best Practices

1. **Use async version in API endpoints** - More efficient for web requests
2. **Use sync version in Celery tasks** - Tasks run in separate processes
3. **Check for None return** - Inventory might not exist or have no devices
4. **Log inventory resolutions** - Helps with debugging and auditing
5. **Pass username for access control** - Respects inventory scope (global/private)

## Common Issues

### Q: Why does it return None?
A: Three possible reasons:
1. Inventory doesn't exist
2. User doesn't have access to the inventory (scope/ownership)
3. Inventory conditions don't match any devices

### Q: Should I use async or sync version?
A: 
- **Async** - API endpoints, FastAPI routes, async services
- **Sync** - Celery tasks, synchronous functions, CLI scripts

### Q: Can I get device objects instead of just IDs?
A: Currently returns IDs only. If you need full device objects, call Nautobot API with the IDs.

### Q: How do I handle "all devices" scenario?
A: The resolver returns `None` for "all devices" - this signals to fetch all devices from Nautobot directly.

## Performance Considerations

- **Caching**: Device lists are not cached - each call queries Nautobot
- **Large inventories**: May take several seconds for 1000+ devices
- **Rate limiting**: Consider batch operations for very large inventories

## Future Enhancements

Possible improvements:
- [ ] Add caching layer with TTL
- [ ] Return full device objects option
- [ ] Batch resolution for multiple inventories
- [ ] Async generator for streaming large results
- [ ] Performance metrics/timing

## See Also

- [`utils/inventory_converter.py`](../backend/utils/inventory_converter.py) - Low-level converter
- [`routers/inventory/inventory.py`](../backend/routers/inventory/inventory.py) - API endpoints
- [`tasks/utils/device_helpers.py`](../backend/tasks/utils/device_helpers.py) - Job template helpers
- [Inventory Architecture](./INVENTORY_BUILDER.md) - Overall inventory system
