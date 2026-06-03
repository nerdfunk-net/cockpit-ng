# Integration Tests - Quick Start Guide

## One-Time Setup

### 1. Configure Test Environment

```bash
cd backend

# Copy example file
cp .env.test.example .env.test

# Edit with your test Nautobot credentials
nano .env.test
```

**Required values**:
```bash
NAUTOBOT_HOST=http://localhost:8080
NAUTOBOT_TOKEN=your-real-api-token-here
NAUTOBOT_TIMEOUT=30
```

### 2. Load Baseline Data

**Canonical file**: `contributing-data/tests_baseline/baseline.yaml` (also linked from `backend/tests/baseline.yaml`).

**Regenerate** (Pytest profile — 120 devices, unique IPs, golden metadata):

```bash
cd backend
python tests/generate_baseline.py --profile pytest --output ../contributing-data/tests_baseline
python scripts/expect_inventory_counts.py --write-manifest
python scripts/verify_baseline_parity.py --mode full
# Or from repo root: make baseline-manifest && make verify-baseline
```

Then import via **Tools → Baseline Management → Import**, or:

```bash
curl -X POST http://localhost:8000/api/tools/tests-baseline \
  -H "Authorization: Bearer $TOKEN"
```

**Contains**:
- 120 devices (100 network `lab-001`…`lab-100` + 20 servers `server-01`…`server-20`)
- 6 city locations under Country A/B/C
- Tags: Production (39), Staging (52), lab (29)
- Statuses: Active (66), Offline (54)

**Verify baseline loaded**:
```bash
# Check if lab-100 exists
curl http://localhost:8080/api/dcim/devices/?name=lab-100 \
  -H "Authorization: Token your-token"
```

---

## Running Tests

### All Integration Tests (32 tests)

```bash
cd backend
pytest -m "integration and nautobot" -v
```

**Expected output**:
```
========================= 32 passed in XX.XXs ==========================
```

---

### Ansible Inventory Tests (26 tests)

```bash
pytest tests/integration/test_ansible_inventory_baseline.py -v
```

**What it tests**:
- Basic filtering (location, role, platform, tag)
- Logical AND operations (intersections)
- Logical OR operations (unions)
- String operators (equals, contains)
- Complex scenarios (multi-condition)
- Special filters (has_primary_ip)
- Edge cases

**Time**: ~7 seconds

---

### Device Operations Tests (6 tests)

```bash
pytest tests/integration/test_device_operations_real_nautobot.py -v
```

**What it tests**:
- Add Device workflow
- Bulk Edit serial number
- Bulk Edit primary IP (create new interface)
- Bulk Edit primary IP (update existing interface)
- Edge cases (duplicate names, non-existent devices)

**Time**: ~10-15 seconds

---

### CheckMK Baseline Tests (live Nautobot + CheckMK)

```bash
pytest tests/integration/test_checkmk_baseline.py -v -m "integration and checkmk"
```

**Requires**: `backend/.env.test` with `NAUTOBOT_*` and `CHECKMK_*`, plus baseline imported into that Nautobot.

Full guide: [README.md#test-environment-file-backendenvtest](README.md#test-environment-file-backendenvtest).

---

## Run Specific Test Suites

### Add Device Only

```bash
pytest tests/integration/test_device_operations_real_nautobot.py::TestAddDevice -v
```

**Tests**: 1 test (device creation workflow)

---

### Bulk Edit Only

```bash
pytest tests/integration/test_device_operations_real_nautobot.py::TestBulkEdit -v
```

**Tests**: 3 tests (serial + IP updates)

---

### Ansible Inventory - Basic Filtering

```bash
pytest tests/integration/test_ansible_inventory_baseline.py::TestBaselineBasicFiltering -v
```

**Tests**: 6 tests (location, role, platform, tag filters)

---

### Ansible Inventory - Logical Operations

```bash
# AND operations
pytest tests/integration/test_ansible_inventory_baseline.py::TestBaselineLogicalAND -v

# OR operations
pytest tests/integration/test_ansible_inventory_baseline.py::TestBaselineLogicalOR -v
```

---

## Verbose Output

To see detailed logs and print statements:

```bash
pytest tests/integration/test_device_operations_real_nautobot.py -v -s
```

The `-s` flag shows:
- Logger output
- Print statements
- Cleanup messages

---

## Test Results

### Success

```
tests/integration/test_ansible_inventory_baseline.py::TestBaselineBasicFiltering::test_filter_by_location_city_a PASSED
tests/integration/test_ansible_inventory_baseline.py::TestBaselineBasicFiltering::test_filter_by_location_city_b PASSED
...
tests/integration/test_device_operations_real_nautobot.py::TestAddDevice::test_add_device_with_interfaces PASSED
tests/integration/test_device_operations_real_nautobot.py::TestBulkEdit::test_update_device_serial_number PASSED
...

========================= 32 passed in XX.XXs ==========================
```

### Skipped

```
tests/integration/test_ansible_inventory_baseline.py SKIPPED [...]
Reason: Test Nautobot instance not configured. Set up .env.test file.
```

**Fix**: Configure `.env.test` with valid credentials

---

## Common Commands

```bash
# All integration tests
pytest -m "integration and nautobot" -v

# Ansible inventory only
pytest tests/integration/test_ansible_inventory_baseline.py -v

# Device operations only
pytest tests/integration/test_device_operations_real_nautobot.py -v

# With verbose output
pytest -m "integration and nautobot" -v -s

# Skip integration tests (unit only)
pytest -m "not integration"

# Run specific test
pytest tests/integration/test_device_operations_real_nautobot.py::TestAddDevice::test_add_device_with_interfaces -v
```

---

## Troubleshooting

### Tests Skipped

**Problem**: All tests show `SKIPPED`

**Solution**:
1. Check `.env.test` exists
2. Verify `NAUTOBOT_TOKEN` is not placeholder value
3. Test connection:
   ```bash
   curl http://localhost:8080/api/ \
     -H "Authorization: Token your-token"
   ```

---

### Connection Errors

**Problem**: `Connection refused` or `Timeout`

**Solution**:
1. Verify Nautobot is running: `http://localhost:8080`
2. Check `NAUTOBOT_HOST` in `.env.test`
3. Verify network connectivity

---

### Wrong Counts

**Problem**: `Expected 58 devices, found 0`

**Solution**:
1. Verify baseline data loaded
2. Check devices exist in Nautobot UI
3. Verify device names match baseline (lab-01, lab-02, etc.)

---

### Cleanup Warnings

**Problem**: Warnings about failed cleanup

**Solution**:
1. Check API token has delete permissions
2. Manually delete test devices if needed:
   - `test-device-001`
   - Test IPs: 192.168.100.x, 192.168.200.x, 192.168.201.x
3. Restore baseline devices via UI if needed

---

## Test Data

### Baseline Devices Used

**Ansible Inventory Tests**: All 120 baseline devices

**Device Operations Tests**:
- `lab-100`: Network device for IP update (new interface) test
- `server-20`: Server device for serial and IP update (existing interface) tests

**Created During Tests**:
- `test-device-001`: Temporary device (auto-deleted)

---

## Documentation

**Quick Guides**:
- This file - Quick start
- [RUN_INTEGRATION_TESTS.md](RUN_INTEGRATION_TESTS.md) - Detailed run guide

**Test-Specific**:
- [DEVICE_OPERATIONS_TESTS.md](DEVICE_OPERATIONS_TESTS.md) - Device operations tests
- [BASELINE_TEST_DATA.md](BASELINE_TEST_DATA.md) - Ansible inventory baseline data

**General**:
- [INTEGRATION_TESTING.md](INTEGRATION_TESTING.md) - Complete setup guide
- [README.md](README.md) - Main test documentation

---

## Summary

**Total Integration Tests**: 32
- **26 Ansible Inventory**: Baseline data validation
- **6 Device Operations**: Add Device + Bulk Edit

**Prerequisites**:
- ✅ Test Nautobot instance running
- ✅ `.env.test` configured
- ✅ Baseline data loaded (120 devices)

**Command**:
```bash
cd backend
pytest -m "integration and nautobot" -v
```

**Expected**: All 32 tests pass in ~20-30 seconds

---

**Ready to run!** 🚀
