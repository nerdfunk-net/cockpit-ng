# Integration Test Fixture Fix

## Problem

The integration test fixture was failing with:

```
AttributeError: <module 'services.ansible_inventory' from '...ansible_inventory.py'>
does not have the attribute 'nautobot_service'
```

## Root Cause

The `ansible_inventory` service **does not** have a module-level `nautobot_service` attribute. Instead, it imports the service locally within each method:

```python
# Inside each method in ansible_inventory.py
async def _query_devices_by_location(...):
    from services.nautobot import nautobot_service  # Local import!
    result = await nautobot_service.graphql_query(...)
```

## Solution

The fixture was trying to patch `services.ansible_inventory.nautobot_service` which doesn't exist. The fix is to patch the **global instance** in `services.nautobot` module:

### Before (Broken)
```python
@pytest.fixture(scope="module")
def real_ansible_inventory_service(real_nautobot_service):
    from services.ansible_inventory import AnsibleInventoryService
    from unittest.mock import patch

    service = AnsibleInventoryService()

    # ❌ WRONG: ansible_inventory doesn't have nautobot_service attribute
    with patch('services.ansible_inventory.nautobot_service', real_nautobot_service):
        yield service
```

### After (Fixed)
```python
@pytest.fixture(scope="module")
def real_ansible_inventory_service(real_nautobot_service):
    from services.ansible_inventory import AnsibleInventoryService
    from unittest.mock import patch

    # ✅ CORRECT: Patch the global instance in services.nautobot
    with patch('services.nautobot.nautobot_service', real_nautobot_service):
        service = AnsibleInventoryService()
        yield service
```

## Why This Works

1. `services/nautobot.py` defines a global instance at the bottom:
   ```python
   # services/nautobot.py line 545
   nautobot_service = NautobotService()
   ```

2. `ansible_inventory.py` imports this global instance locally:
   ```python
   from services.nautobot import nautobot_service
   ```

3. By patching `services.nautobot.nautobot_service`, we replace the global instance
4. When `ansible_inventory` imports it, it gets our test instance instead
5. All GraphQL/REST calls go to the real test Nautobot

## Verification

```bash
# Test collection now works
pytest tests/integration/test_ansible_inventory_baseline.py --collect-only

# Expected: 26 tests collected
```

## Status

✅ **FIXED** - Integration tests can now run against real Nautobot instance
