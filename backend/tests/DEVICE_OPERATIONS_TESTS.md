# Device Operations Integration Tests

## Overview

This document describes the integration tests for device operations (Add Device and Bulk Edit) with a real Nautobot instance.

**Test File**: `integration/test_device_operations_real_nautobot.py`

## Test Coverage

### 1. Add Device Tests

**Test**: `test_add_device_with_interfaces`

**Purpose**: Test the complete device creation workflow via `/add-device` endpoint.

**What it tests**:
- Creates a new device in Nautobot
- Creates multiple interfaces with IP addresses
- Sets primary IPv4 address
- Verifies all workflow steps complete successfully
- Validates device exists in Nautobot with correct data

**Expected behavior**:
- Device created with name "test-device-001"
- Serial number: "TEST-SN-001"
- Asset tag: "TEST-ASSET-001"
- 1 interface created: GigabitEthernet0/0
- IP address: 192.168.178.128/24 (from baseline prefix)
- Primary IPv4 set to 192.168.178.128/24

**Note**: The test uses IP from the baseline prefix (192.168.178.0/24) starting at .128 to avoid conflicts with baseline devices (which use .1-.100).

**Cleanup**: Device and all associated interfaces/IPs are automatically deleted after test completes.

---

### 2. Bulk Edit Tests

#### Test: `test_update_device_serial_number`

**Purpose**: Test updating a device's serial number.

**What it tests**:
- Updates serial number field on existing device
- Verifies field is updated in Nautobot
- Tracks changes (before/after values)

**Test device**: Uses `server-20` from baseline data

**Behavior**:
- Updates serial to "INTEGRATION-TEST-SERIAL-001"
- Verifies update succeeded
- Original serial is restored after test

---

#### Test: `test_update_primary_ip_create_new_interface`

**Purpose**: Test updating primary IPv4 by **creating a NEW interface**.

**What it tests**:
- Updates primary IPv4 with `mgmt_interface_create_on_ip_change=True`
- Verifies new interface is created
- Verifies new IP is assigned to new interface
- Verifies device primary_ip4 points to new IP

**Test device**: Uses `lab-100` from baseline data

**Behavior**:
- Creates new interface "Loopback100" (type: virtual)
- Assigns new IP 192.168.200.100/24 to new interface
- Sets device primary_ip4 to new IP
- Original state is restored after test

**Key property tested**: `mgmt_interface_create_on_ip_change=True`

---

#### Test: `test_update_primary_ip_update_existing_interface`

**Purpose**: Test updating primary IPv4 by **updating the EXISTING interface**.

**What it tests**:
- Updates primary IPv4 with `mgmt_interface_create_on_ip_change=False`
- Verifies existing interface's IP is updated (not a new interface created)
- Verifies device primary_ip4 points to updated IP

**Test device**: Uses `server-20` from baseline data

**Behavior**:
- Finds existing interface with current primary IP
- Updates that interface's IP to 192.168.201.20/24
- Sets device primary_ip4 to new IP
- **Does NOT create a new interface**
- Original state is restored after test

**Key property tested**: `mgmt_interface_create_on_ip_change=False`

---

### 3. Edge Case Tests

#### Test: `test_add_device_duplicate_name`

**Purpose**: Verify duplicate device names are rejected.

**What it tests**:
- Attempts to create device with name that already exists
- Verifies creation fails gracefully
- No device is created

**Behavior**:
- Tries to create device named "lab-100" (already exists in baseline)
- Should fail with appropriate error

---

#### Test: `test_update_nonexistent_device`

**Purpose**: Verify updating non-existent device fails gracefully.

**What it tests**:
- Attempts to update device that doesn't exist
- Verifies update fails with appropriate error
- No changes are made to Nautobot

**Behavior**:
- Tries to update device with fake UUID
- Should fail with "not found" error

---

## Prerequisites

### 1. Test Nautobot Instance

You need a test Nautobot instance with:
- API access enabled
- GraphQL endpoint available
- REST API endpoints available

### 2. Baseline Test Data

The baseline data must be loaded from `contributing-data/tests_baseline/baseline.yaml`.

Required baseline devices:
- `lab-100`: Network device in City B (used for IP update with new interface test)
- `server-20`: Server device in City B (used for serial and IP update tests)

Required baseline resources:
- Location: "City A"
- Role: "Network"
- Device Type: Any (will use first available)
- Platform: "Cisco IOS"
- Status: "Active"
- Namespace: "Global"

### 3. Environment Configuration

Create or update `backend/.env.test`:

```bash
NAUTOBOT_HOST=http://localhost:8080
NAUTOBOT_TOKEN=your-real-api-token-here
NAUTOBOT_TIMEOUT=30
```

---

## Running the Tests

### Run All Device Operation Tests

```bash
cd backend
pytest tests/integration/test_device_operations_real_nautobot.py -v
```

### Run Specific Test Class

```bash
# Add Device tests only
pytest tests/integration/test_device_operations_real_nautobot.py::TestAddDevice -v

# Bulk Edit tests only
pytest tests/integration/test_device_operations_real_nautobot.py::TestBulkEdit -v

# Edge case tests only
pytest tests/integration/test_device_operations_real_nautobot.py::TestDeviceOperationsEdgeCases -v
```

### Run Specific Test

```bash
# Test add device
pytest tests/integration/test_device_operations_real_nautobot.py::TestAddDevice::test_add_device_with_interfaces -v

# Test serial number update
pytest tests/integration/test_device_operations_real_nautobot.py::TestBulkEdit::test_update_device_serial_number -v

# Test IP update with new interface
pytest tests/integration/test_device_operations_real_nautobot.py::TestBulkEdit::test_update_primary_ip_create_new_interface -v

# Test IP update on existing interface
pytest tests/integration/test_device_operations_real_nautobot.py::TestBulkEdit::test_update_primary_ip_update_existing_interface -v
```

### Run with Verbose Output

```bash
pytest tests/integration/test_device_operations_real_nautobot.py -v -s
```

The `-s` flag shows print statements and logs during test execution.

---

## Expected Test Results

If all tests pass, you should see:

```
tests/integration/test_device_operations_real_nautobot.py::TestAddDevice::test_add_device_with_interfaces PASSED
tests/integration/test_device_operations_real_nautobot.py::TestBulkEdit::test_update_device_serial_number PASSED
tests/integration/test_device_operations_real_nautobot.py::TestBulkEdit::test_update_primary_ip_create_new_interface PASSED
tests/integration/test_device_operations_real_nautobot.py::TestBulkEdit::test_update_primary_ip_update_existing_interface PASSED
tests/integration/test_device_operations_real_nautobot.py::TestDeviceOperationsEdgeCases::test_add_device_duplicate_name PASSED
tests/integration/test_device_operations_real_nautobot.py::TestDeviceOperationsEdgeCases::test_update_nonexistent_device PASSED

========================= 6 passed in XX.XXs ==========================
```

---

## Test Fixtures

### `test_device_ids`

**Purpose**: Tracks devices created during tests for cleanup.

**Behavior**:
- Yields an empty list
- Tests append device IDs to the list
- After test completes, all devices in the list are deleted from Nautobot

**Usage**:
```python
async def test_something(test_device_ids):
    # Create device
    result = await create_device(...)

    # Track for cleanup
    test_device_ids.append(result["device_id"])

    # ... rest of test
```

---

### `baseline_device_ids`

**Purpose**: Provides device IDs for baseline devices and restores their state after tests.

**Devices provided**:
- `lab-100`: Network device for IP update tests
- `server-20`: Server device for serial and IP update tests

**Behavior**:
- Queries Nautobot for baseline devices
- Stores original values (serial, primary_ip4)
- Yields device info dictionary
- After tests, restores original values

**Usage**:
```python
async def test_something(baseline_device_ids):
    device_info = baseline_device_ids["server-20"]

    # Use device_info["id"] to update device
    # Original values will be restored automatically
```

---

## Cleanup and Restoration

### Automatic Cleanup

**Created Devices** (`test_device_ids` fixture):
- All devices created during tests are automatically deleted
- Uses GraphQL DELETE operation
- Runs after each test completes

**Modified Devices** (`baseline_device_ids` fixture):
- Original values are stored before modification
- Values are restored after test completes
- Includes: serial number, primary_ip4

### Manual Cleanup

If tests fail or are interrupted, you may need to manually clean up:

```bash
# Delete test device by name
curl -X DELETE \
  http://localhost:8080/api/dcim/devices/?name=test-device-001 \
  -H "Authorization: Token your-token"

# Restore server-20 serial
# (Check original value in baseline.yaml)

# Restore device primary IPs
# (Check original values in baseline.yaml)
```

---

## Troubleshooting

### Tests Skipped

**Symptom**: All tests show "SKIPPED"

**Cause**: `.env.test` not configured or has placeholder values

**Fix**:
```bash
cd backend
cp .env.test.example .env.test
# Edit .env.test with real Nautobot URL and token
```

---

### Device Creation Fails

**Symptom**: `test_add_device_with_interfaces` fails at step 1

**Possible causes**:
1. Missing required resources in Nautobot
2. Invalid resource IDs
3. Permission issues with API token

**Debug**:
```bash
# Run with verbose output
pytest tests/integration/test_device_operations_real_nautobot.py::TestAddDevice -v -s

# Check logs for specific error
```

**Fix**:
- Verify baseline data is loaded
- Check API token has write permissions
- Verify all required resources exist (City A, Network role, etc.)

---

### Serial Number Update Fails

**Symptom**: `test_update_device_serial_number` fails

**Possible causes**:
1. server-20 device doesn't exist
2. API token lacks update permissions
3. Device is read-only or protected

**Fix**:
- Verify baseline data loaded: `server-20` should exist
- Check API token permissions
- Verify device isn't marked as protected in Nautobot

---

### IP Update Tests Fail

**Symptom**: IP update tests fail with "namespace not found" or "IP already exists"

**Possible causes**:
1. IP addresses already exist in Nautobot (192.168.178.128, .129, .130)
2. Namespace "Global" not found
3. Previous test didn't clean up properly

**Fix**:
- Verify "Global" namespace exists in Nautobot
- Verify baseline prefix 192.168.178.0/24 exists (should be created with baseline data)
- Delete conflicting IPs manually if they exist:
  - 192.168.178.128/24 (test device IP)
  - 192.168.178.129/24 (lab-100 update test IP)
  - 192.168.178.130/24 (server-20 update test IP)
- Check cleanup logs for errors

**Note**: The tests use IPs from the baseline prefix (192.168.178.0/24) starting at .128 to avoid conflicts with baseline devices.

---

### Cleanup Fails

**Symptom**: Cleanup warnings in logs, devices/IPs not deleted

**Possible causes**:
1. API token lacks delete permissions
2. Resources referenced by other objects
3. Network issues during cleanup

**Fix**:
- Check API token has delete permissions
- Manually delete test resources via Nautobot UI
- Check for dependencies (interfaces, IPs, etc.)

---

## Key Concepts Tested

### Add Device Workflow

The test validates the complete multi-step workflow:

1. **Step 1**: Create device in DCIM
2. **Step 2**: Create IP addresses
3. **Step 3**: Create interfaces and assign IPs
4. **Step 4**: Set primary IPv4 on device

Each step is tracked and verified independently.

---

### Bulk Edit Property: `mgmt_interface_create_on_ip_change`

This critical property controls IP update behavior:

**When `True`** (Create New Interface):
- Creates a new interface (e.g., "Loopback100")
- Assigns new IP to new interface
- Sets device primary_ip4 to new IP
- **Old interface and IP remain unchanged**

**When `False`** (Update Existing Interface):
- Finds existing interface with current primary IP
- Updates that interface's IP address
- Sets device primary_ip4 to updated IP
- **No new interface created**

**Why this matters**:
- Different network environments have different requirements
- Some want to preserve history (new interface)
- Some want to update in place (update existing)

---

## Integration with Frontend

These tests validate the backend behavior that powers:

### Frontend "Nautobot / Add Device" Page

**URL**: `/nautobot-add-device`

**Backend Endpoint**: `POST /add-device`

**Tests**: `TestAddDevice::test_add_device_with_interfaces`

---

### Frontend "Bulk Edit" Feature

**URL**: Part of device management

**Backend Endpoint**: `POST /tasks/update-devices`

**Tests**:
- `TestBulkEdit::test_update_device_serial_number`
- `TestBulkEdit::test_update_primary_ip_create_new_interface`
- `TestBulkEdit::test_update_primary_ip_update_existing_interface`

---

## Future Enhancements

Potential additional tests:

1. **Multiple device bulk edit**: Update 10+ devices in one operation
2. **Interface management**: Add/update/delete interfaces beyond primary IP
3. **Custom fields**: Test custom field updates
4. **Tags**: Test tag assignments and updates
5. **Validation**: Test field validation and constraints
6. **Performance**: Test large batch operations
7. **Rollback**: Test partial failure handling and rollback

---

## Status

✅ **IMPLEMENTED** - All core device operation tests

- ✅ Add device with interfaces
- ✅ Update serial number
- ✅ Update primary IP (create new interface)
- ✅ Update primary IP (update existing interface)
- ✅ Edge cases (duplicate names, non-existent devices)

**Total Tests**: 6 integration tests

**Test File**: `integration/test_device_operations_real_nautobot.py`

**Documentation**: This file

**Last Updated**: 2025-12-29
