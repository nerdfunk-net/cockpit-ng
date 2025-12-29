# Running Integration Tests - Quick Guide

## Prerequisites

✅ Test Nautobot instance with baseline data loaded
✅ `.env.test` configured with Nautobot credentials

## Quick Start

```bash
cd backend

# Update .env.test with your credentials
nano .env.test

# Run all integration tests
pytest -m "integration and nautobot" -v

# Run only baseline-specific tests
pytest tests/integration/test_ansible_inventory_baseline.py -v
```

---

## Test Files

### 1. Generic Integration Tests
**File**: `test_ansible_inventory_real_nautobot.py`
**Tests**: 19 generic tests
**Purpose**: General integration tests that work with any Nautobot data
**Use when**: Testing with custom/different test data

### 2. Baseline-Specific Tests ⭐
**File**: `test_ansible_inventory_baseline.py`
**Tests**: 26 tests specifically for baseline data
**Purpose**: Validate logical operations with known baseline data
**Use when**: Your test Nautobot has baseline.yaml loaded

**Test Coverage**:
- 6 basic filtering tests
- 6 logical AND tests
- 3 logical OR tests
- 3 string operator tests
- 2 complex scenario tests
- 2 special filter tests
- 3 edge case tests

---

## Running Tests

### All Integration Tests

```bash
# Run all integration tests (generic + baseline)
pytest -m "integration and nautobot" -v

# Expected: 45 tests collected (19 generic + 26 baseline)
```

### Baseline Tests Only

```bash
# Run only baseline-specific tests
pytest tests/integration/test_ansible_inventory_baseline.py -v

# Expected: 26 tests collected
```

### Specific Test Class

```bash
# Run only AND operation tests
pytest tests/integration/test_ansible_inventory_baseline.py::TestBaselineLogicalAND -v

# Expected: 6 tests collected
```

### Single Test

```bash
# Run one specific test
pytest tests/integration/test_ansible_inventory_baseline.py::TestBaselineBasicFiltering::test_filter_by_location_city_a -v
```

### With Output

```bash
# Show print statements and full output
pytest tests/integration/test_ansible_inventory_baseline.py -v -s
```

---

## Expected Results

### If Baseline Data Loaded

All 26 baseline tests should **PASS**:

```
tests/integration/test_ansible_inventory_baseline.py::TestBaselineBasicFiltering::test_filter_by_location_city_a PASSED
tests/integration/test_ansible_inventory_baseline.py::TestBaselineBasicFiltering::test_filter_by_location_city_b PASSED
...
========================= 26 passed in 15.23s ==========================
```

### If Baseline Data NOT Loaded

Tests will **FAIL** with assertion errors:

```
AssertionError: Expected 58 devices in City A, found 0
```

**Fix**: Load baseline data into Nautobot:
```bash
# Use the baseline import tool or UI
# See BASELINE_TEST_DATA.md for details
```

### If .env.test NOT Configured

Tests will **SKIP**:

```
tests/integration/test_ansible_inventory_baseline.py SKIPPED [...]
Reason: Test Nautobot instance not configured. Set up .env.test file.
```

**Fix**: Configure `.env.test` with your Nautobot credentials

---

## Test Data Requirements

For baseline tests to pass, your Nautobot must have:

### Locations
- City A
- City B

### Roles
- Network
- server

### Tags
- Production
- Staging

### Platforms
- Cisco IOS
- ServerPlatform

### Devices
- 100 network devices (lab-01 to lab-100)
- 20 server devices (server-01 to server-20)

**See** [`BASELINE_TEST_DATA.md`](BASELINE_TEST_DATA.md) for complete details.

---

## Troubleshooting

### All tests fail with wrong counts

**Cause**: Baseline data not loaded or incomplete

**Fix**:
1. Verify data in Nautobot UI
2. Reload baseline: `contributing-data/tests_baseline/baseline.yaml`
3. Check device counts match expected values

### Connection errors

**Cause**: Cannot reach test Nautobot

**Fix**:
```bash
# Test connection
curl http://localhost:8080/api/

# Check .env.test
cat .env.test | grep NAUTOBOT_HOST
```

### Authentication errors

**Cause**: Invalid API token

**Fix**:
1. Generate new token in Nautobot UI
2. Update `NAUTOBOT_TOKEN` in `.env.test`
3. Verify token has read permissions

### Tests timeout

**Cause**: Large number of devices or slow Nautobot

**Fix**:
```bash
# Increase timeout in .env.test
NAUTOBOT_TIMEOUT=60

# Run tests with longer timeout
pytest --timeout=120 -m "integration and nautobot"
```

---

## Test Markers

```bash
# All integration tests
pytest -m integration

# Only Nautobot integration tests
pytest -m "integration and nautobot"

# Skip slow tests
pytest -m "integration and nautobot and not slow"
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
integration-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v2

    - name: Set up Python
      uses: actions/setup-python@v2

    - name: Configure test environment
      run: |
        cd backend
        cat > .env.test << EOF
        NAUTOBOT_HOST=${{ secrets.TEST_NAUTOBOT_URL }}
        NAUTOBOT_TOKEN=${{ secrets.TEST_NAUTOBOT_TOKEN }}
        EOF

    - name: Run integration tests
      run: |
        cd backend
        pytest -m "integration and nautobot" -v
```

---

## Performance Benchmarks

Expected execution times (120 devices in baseline):

- **Basic filtering** (~1-2s per test)
- **Logical operations** (~2-3s per test)
- **Complex scenarios** (~3-5s per test)
- **Full baseline suite** (~30-60s total)

Slow tests are marked with `@pytest.mark.slow` marker.

---

## Next Steps

1. ✅ Configure `.env.test`
2. ✅ Load baseline data
3. ✅ Run: `pytest tests/integration/test_ansible_inventory_baseline.py -v`
4. ✅ Verify all 26 tests pass
5. 🎯 Add more integration tests for other services

---

## Resources

- **Baseline Data**: [`BASELINE_TEST_DATA.md`](BASELINE_TEST_DATA.md)
- **Setup Guide**: [`INTEGRATION_TESTING.md`](INTEGRATION_TESTING.md)
- **Test Suite**: [`README.md`](README.md)
