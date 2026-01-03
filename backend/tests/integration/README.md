# Integration Tests

This directory contains tests for CheckMK integration with different approaches.

## Test Files Overview

### 1. `test_checkmk_baseline.py` - Integration Tests (Real Systems) ✅

**Uses**: Real Nautobot + Real CheckMK instances
**Purpose**: End-to-end integration testing with actual running systems
**Speed**: Slower (requires live systems)
**Data**: 120 baseline devices from `baseline.yaml`

```bash
# Run integration tests (requires Nautobot + CheckMK running)
pytest tests/integration/test_checkmk_baseline.py -v
```

**What it tests**:
- Real Nautobot GraphQL queries
- Real CheckMK API calls
- Device normalization with real data
- SNMP credential mapping
- Comparison logic (correctly detects when devices aren't in CheckMK)

**Results**: 8 passed, 1 skipped (expected)

---

### 2. `test_checkmk_api_structure.py` - Unit Tests (Mocked Services) 📦

**Uses**: Captured real API responses + Mocked services
**Purpose**: Validate API structure and data compatibility without live systems
**Speed**: Fast (no network calls)
**Data**: Real API responses captured from production (2026-01-03)

```bash
# Run unit tests (no live systems required)
pytest tests/integration/test_checkmk_api_structure.py -v
```

**What it tests**:
- CheckMK REST API v1.0 response structure
- HAL/REST links format
- Metadata fields
- SNMP community structures
- Attribute comparison logic
- Folder path formats

**Use case**: CI/CD pipelines, fast validation, structure regression tests

---

### 3. `test_snmp_mapping_comparison.py` - SNMP Version Detection Tests

**Uses**: Mocked config service
**Purpose**: Test SNMP version detection and normalization
**Speed**: Fast

```bash
# Run SNMP tests
pytest tests/integration/test_snmp_mapping_comparison.py -v
```

**What it tests**:
- SNMP v1, v2, v3 detection
- Integer vs string version formats (`2` vs `"v2"`)
- SNMPv3 auth+privacy vs auth-only
- Config reload without worker restart

---

### 4. `test_checkmk_device_lifecycle.py` - Device Lifecycle Tests (Real CheckMK) 🔄

**Uses**: Real CheckMK instance + Test device creation
**Purpose**: End-to-end device lifecycle testing (Create → Compare → Sync → Delete)
**Speed**: Slower (creates/deletes real devices)
**Data**: Creates 3 test devices with different SNMP configurations

```bash
# Run device lifecycle tests (requires CheckMK running)
pytest tests/integration/test_checkmk_device_lifecycle.py -v
```

**What it tests**:
- Device creation in CheckMK via `/api/checkmk/hosts/create`
- Device retrieval and verification
- Device comparison with Nautobot
- Device updates in CheckMK
- SNMP v2 and v3 configuration validation
- Config reload without worker restart
- Device deletion and cleanup

**Special Features**:
- ✅ **Automatic cleanup**: All created devices are deleted after tests (even on failure)
- ✅ **Self-contained**: Creates its own test devices, doesn't rely on baseline
- ✅ **SNMP testing**: Tests both SNMPv2 and SNMPv3 devices
- ✅ **Real API usage**: Uses actual CheckMK endpoints via `/api/checkmk/hosts/create`

**Test Phases**:
1. **Setup**: Create 3 test devices in CheckMK (SNMPv2, SNMPv3, agent-only)
2. **Verification**: Verify devices exist and have correct attributes
3. **Comparison**: Test comparison logic with both existing and non-existing devices
4. **Updates**: Test device attribute updates
5. **Cleanup**: Delete test devices and verify deletion

---

## When to Use Which Tests

### Use `test_checkmk_baseline.py` when:
- ✅ Testing full integration workflow with baseline data
- ✅ Validating Nautobot→CheckMK comparison logic
- ✅ Testing with 120 baseline devices
- ✅ Verifying SNMP mapping coverage

### Use `test_checkmk_api_structure.py` when:
- ✅ Running in CI/CD without live systems
- ✅ Validating API structure compatibility
- ✅ Fast regression testing
- ✅ Testing comparison logic without side effects

### Use `test_snmp_mapping_comparison.py` when:
- ✅ Testing SNMP credential handling
- ✅ Validating version detection logic
- ✅ Testing config reload functionality

### Use `test_checkmk_device_lifecycle.py` when:
- ✅ Testing device creation via `/api/checkmk/hosts/create`
- ✅ End-to-end device management workflow
- ✅ Testing device updates and deletions
- ✅ Validating SNMP configurations in real CheckMK
- ✅ Testing comparison/sync with devices that exist in CheckMK
- ✅ Verifying the complete create→compare→sync→delete cycle

## Quick Commands

```bash
# Run all CheckMK tests
pytest tests/integration/ -m checkmk -v

# Run only integration tests (real systems)
pytest tests/integration/test_checkmk_baseline.py -v

# Run device lifecycle tests (creates/deletes real devices)
pytest tests/integration/test_checkmk_device_lifecycle.py -v

# Run only unit tests (mocked)
pytest tests/integration/test_checkmk_api_structure.py -v

# Run SNMP tests
pytest tests/integration/test_snmp_mapping_comparison.py -v

# Run with coverage
pytest tests/integration/ --cov=services.checkmk --cov-report=html

# Run specific test
pytest tests/integration/test_checkmk_baseline.py::TestCheckMKWithBaseline::test_fetch_baseline_devices -v

# Run lifecycle test class
pytest tests/integration/test_checkmk_device_lifecycle.py::TestCheckMKDeviceLifecycle -v

# Run SNMP configuration tests only
pytest tests/integration/test_checkmk_device_lifecycle.py::TestCheckMKSNMPConfiguration -v
```

## Test Markers

- `@pytest.mark.integration` - Requires real systems
- `@pytest.mark.unit` - Uses mocks, no real systems
- `@pytest.mark.checkmk` - CheckMK-related tests
- `@pytest.mark.nautobot` - Nautobot-related tests
- `@pytest.mark.snmp` - SNMP-specific tests

## Prerequisites

### For Integration Tests (`test_checkmk_baseline.py`):
1. ✅ Nautobot running with baseline data loaded
2. ✅ CheckMK running and configured
3. ✅ Backend `.env` configured with correct URLs

### For Device Lifecycle Tests (`test_checkmk_device_lifecycle.py`):
1. ✅ CheckMK running and configured in backend settings
2. ✅ Backend `.env` configured with CheckMK connection details
3. ✅ CheckMK user has permissions to create/update/delete hosts
4. ⚠️ **Note**: Creates and deletes real devices in CheckMK (with automatic cleanup)

### For Unit Tests (`test_checkmk_api_structure.py`):
- No prerequisites - uses mocked data

### For SNMP Tests (`test_snmp_mapping_comparison.py`):
- No prerequisites - uses mocked config service

## Test Data Sources

- **Baseline Data**: `backend/tests/baseline.yaml` (120 devices)
- **SNMP Fixtures**: `backend/tests/fixtures/snmp_fixtures.py`
- **CheckMK Fixtures**: `backend/tests/fixtures/checkmk_fixtures.py` (real API responses)
- **SNMP Mapping**: `/config/snmp_mapping.yaml` (6 credential types)

## Current Status

✅ All tests passing
✅ Real production data captured
✅ Baseline integration complete
✅ SNMP version detection fixed
✅ Config reload working
