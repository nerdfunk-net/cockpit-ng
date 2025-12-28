# Remaining Test Fixes

## Current Status

✅ **5 tests passing** (up from 1!)
- `test_transforms_nautobot_to_checkmk_format`
- `test_handles_missing_optional_fields`
- `test_get_custom_field_types`
- `test_caches_custom_field_types`
- `test_empty_operations`

❌ **26 tests still failing** across 2 main categories:

## Issue 1: Ansible Inventory Tests - Missing `operator` Field

### Problem
`LogicalCondition` model requires 3 fields: `field`, `operator`, `value`

Tests only provide 2 fields: `field`, `value`

### Error
```
ValidationError: 1 validation error for LogicalCondition
operator
  Field required
```

### Actual Model Definition
```python
class LogicalCondition(BaseModel):
    field: str       # ✅ Provided
    operator: str    # ❌ MISSING
    value: str       # ✅ Provided

class LogicalOperation(BaseModel):
    operation_type: str     # Note: Not "operation"
    conditions: List[LogicalCondition]
    nested_operations: List["LogicalOperation"]
```

### Fix Required
Add `operator` field to all `LogicalCondition` instantiations:

**Before:**
```python
LogicalCondition(field="location", value="DC1")
```

**After:**
```python
LogicalCondition(field="location", operator="equals", value="DC1")
```

### Affected Tests (12 tests)
All in `tests/unit/services/test_ansible_inventory_service.py`:
- `test_preview_inventory_by_location`
- `test_preview_inventory_by_role`
- `test_preview_inventory_with_and_conditions`
- `test_preview_inventory_with_or_conditions`
- `test_filter_by_name`
- `test_filter_by_tag`
- `test_filter_by_platform`
- `test_filter_by_has_primary_ip`
- `test_generate_inventory_format`
- `test_inventory_includes_device_variables`
- `test_complex_and_or_combination`
- `test_handles_graphql_errors`
- `test_handles_invalid_field_name`

### Also Fix: `operation` → `operation_type`

**Before:**
```python
LogicalOperation(
    operation="AND",
    conditions=[...]
)
```

**After:**
```python
LogicalOperation(
    operation_type="AND",
    conditions=[...]
)
```

## Issue 2: Device Creation Tests - Mock Not Applied

### Problem
The mock for `nautobot_service` is being patched, but the actual service is still being called.

### Error
```
Exception: REST request failed with status 400:
{"device_type":["Related object not found..."]}
```

This error comes from the REAL Nautobot API, not the mock!

### Root Cause Investigation Needed
The patch path `'services.nautobot.nautobot_service'` should be correct based on how the service imports it.

**Possible causes:**
1. The service might import `nautobot_service` at module level before the test runs
2. The service might create its own instance instead of using the module-level one
3. The mock's `rest_request` might not be configured correctly

### How Device Creation Service Imports
Need to check:
```bash
grep -n "from services.nautobot import\|nautobot_service" services/device_creation_service.py
```

### Potential Fix Strategies

**Strategy 1: Patch where it's used**
```python
# Instead of patching the module
with patch('services.nautobot.nautobot_service', mock_nautobot_service):

# Try patching in device_creation_service module
with patch('services.device_creation_service.nautobot_service', mock_nautobot_service):
```

**Strategy 2: Mock the actual methods being called**
```python
# Patch the _sync_rest_request method that's actually failing
with patch.object(nautobot_service, 'rest_request', new=AsyncMock(return_value={...})):
```

**Strategy 3: Import-time patching**
The service imports at module level, so patch before importing:
```python
with patch('services.nautobot.nautobot_service'):
    from services.device_creation_service import DeviceCreationService
```

### Affected Tests (13 tests)
All in `tests/unit/services/test_device_creation_service.py`:
- All tests in `TestDeviceCreationSuccess` (3 tests)
- All tests in `TestDeviceCreationErrors` (4 tests)
- All tests in `TestWorkflowStatusTracking` (2 tests)
- All tests in `TestDeviceCreationEdgeCases` (3 tests)
- All tests in `TestOptionalFields` (1 test)

## Quick Fix Script

### Fix 1: Ansible Inventory Tests
```bash
cd /Users/mp/programming/cockpit-ng/backend/tests

# Add operator="equals" to all LogicalCondition calls
sed -i '' 's/LogicalCondition(field="\([^"]*\)", value=/LogicalCondition(field="\1", operator="equals", value=/g' unit/services/test_ansible_inventory_service.py

# Fix operation -> operation_type
sed -i '' 's/operation="AND"/operation_type="AND"/g' unit/services/test_ansible_inventory_service.py
sed -i '' 's/operation="OR"/operation_type="OR"/g' unit/services/test_ansible_inventory_service.py
```

### Fix 2: Device Creation Tests - Investigation Required

Run this to understand the import pattern:
```bash
grep -n "nautobot_service\|from services.nautobot" services/device_creation_service.py
```

Then test different patch strategies manually.

## Testing After Fixes

```bash
# Test ansible inventory after Fix 1
pytest tests/unit/services/test_ansible_inventory_service.py -v

# Test device creation with different patch strategies
pytest tests/unit/services/test_device_creation_service.py::TestDeviceCreationSuccess::test_create_device_minimal_fields -v
```

## Expected Outcome After All Fixes

- **Ansible Inventory**: 20/20 tests passing
- **Device Creation**: 15/15 tests passing (once correct patch strategy found)
- **NB2CMK Sync**: Already 2/2 passing
- **Total**: 37+ tests passing

## Notes

The fundamental issue is that these tests were written without running them against the actual codebase, so:
1. Model field names don't match
2. Patch paths might not match actual import patterns
3. Some mocking strategies might not work with the actual service architecture

This is a learning opportunity - always run tests as you write them!
