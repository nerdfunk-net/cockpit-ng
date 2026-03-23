# Integration Tests

This directory contains integration tests for Nautobot inventory and CheckMK with different approaches.

## Test Files Overview

### 1. `test_inventory_baseline.py` - Ansible Inventory Integration Tests (Real Nautobot) ✅

**Uses**: Real Nautobot instance
**Purpose**: End-to-end inventory filtering tests with actual baseline data using the tree-based logical expression structure
**Speed**: Slower (requires live Nautobot)
**Data**: 120 baseline devices from `baseline.yaml`

```bash
# Run inventory baseline tests (requires Nautobot running with baseline data)
pytest -m "integration and nautobot" tests/integration/test_inventory_baseline.py -v
```

**What it tests**:
- Basic filtering by location, role, platform, tag, and status
- AND logic with multiple conditions
- OR logic using nested groups
- Operators: `equals`, `not_equals`, `contains`, `not_contains`
- NOT operator with nested groups
- Custom field filtering
- Empty filter (returns all devices)

**Test classes**:
- `TestBaselineBasicFiltering` — single-field filters (location, role, platform, tag, status)
- `TestBaselineAndLogic` — multiple AND conditions
- `TestBaselineOrLogic` — OR logic with nested groups
- `TestBaselineOperators` — operator variants (`not_equals`, `contains`, `not_contains`)
- `TestBaselineNotLogic` — NOT operator and complex exclusions
- `TestBaselineCustomFields` — custom field filtering
- `TestBaselineEmptyFilters` — no-filter baseline (all 120 devices)

**Prerequisites**:
1. Nautobot running with baseline data loaded (`tests/baseline.yaml`)
2. Backend `.env.test` configured with Nautobot credentials

---

### 2. `test_add_device_form_data.py` - Add Device Integration Tests (Real Nautobot) 🖊️

**Uses**: Real Nautobot instance
**Purpose**: End-to-end tests for the `POST /nautobot/add-device` endpoint, mirroring the data a user enters in the frontend Add Device form
**Speed**: Slower (requires live Nautobot)
**Data**: Creates and cleans up a test device (`testdevice`) with a Loopback interface and IP `192.168.180.254/24`

```bash
# Run add-device tests (requires Nautobot running)
pytest -m "integration and nautobot" tests/integration/test_add_device_form_data.py -v
```

**What it tests**:
- UUID resolution for all form resources (role, status, location, device type, platform, namespace)
- Full 4-step device creation workflow: device → IP addresses → interfaces → primary IP
- Auto-prefix creation (`192.168.180.0/24`) when `add_prefix=True`
- Interface metadata (`type=virtual`, `enabled=True`, IP assignment)
- Duplicate device name rejection

**Test class**: `TestAddDeviceFormData`
- `test_resource_ids_resolved_correctly` — validates UUID resolution without creating a device
- `test_add_device_with_auto_prefix` — full happy-path with GraphQL verification
- `test_add_device_interface_metadata` — interface type and IP assignment
- `test_device_name_uniqueness` — duplicate-name rejection

**Prerequisites**:
1. Nautobot running with baseline data loaded (`tests/baseline.yaml`)
2. Backend `.env.test` configured with Nautobot credentials
3. Resources exist in Nautobot: role `network`, status `Active`, location `City A`, namespace `Global`

---

### 3. `test_checkmk_baseline.py` - Integration Tests (Real Systems) ✅

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

### 4. `test_checkmk_api_structure.py` - Unit Tests (Mocked Services) 📦

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

### 5. `test_snmp_mapping_comparison.py` - SNMP Version Detection Tests

**Uses**: Mocked config service + Real CheckMK devices (optional)
**Purpose**: Test SNMP version detection and normalization
**Speed**: Fast (with mocks) / Medium (with real CheckMK)

```bash
# Run SNMP tests (unit tests with mocks)
pytest tests/integration/test_snmp_mapping_comparison.py -v

# Or run with real CheckMK (requires test devices from test_checkmk_device_lifecycle.py)
pytest tests/integration/test_checkmk_device_lifecycle.py -v  # Create devices first
pytest tests/integration/test_snmp_mapping_comparison.py::TestDeviceComparisonLiveUpdate -v
```

**What it tests**:
- **Unit tests** (mocked):
  - SNMP v1, v2, v3 detection
  - Integer vs string version formats (`2` vs `"v2"`)
  - SNMPv3 auth+privacy vs auth-only
  - Config reload without worker restart
- **Integration tests** (real CheckMK):
  - Real SNMPv3 device verification (`test-device-02`)
  - Real SNMPv2 device verification (`test-device-01`)
  - Real non-SNMP device verification (`test-device-03`)

---

### 6. `test_checkmk_device_lifecycle.py` - Device Lifecycle Tests (Real CheckMK) 🔄

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

### Use `test_inventory_baseline.py` when:
- ✅ Testing Ansible inventory filtering logic with real Nautobot data
- ✅ Validating tree-based logical expressions (AND, OR, NOT)
- ✅ Testing operator variants (`equals`, `not_equals`, `contains`, `not_contains`)
- ✅ Verifying custom field filtering
- ✅ Regression testing against the 120-device baseline

### Use `test_add_device_form_data.py` when:
- ✅ Testing the Add Device form backend workflow end-to-end
- ✅ Validating 4-step device creation (device → IPs → interfaces → primary IP)
- ✅ Checking auto-prefix creation behaviour
- ✅ Verifying duplicate device name rejection

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
# Run inventory baseline tests (requires Nautobot)
pytest -m "integration and nautobot" tests/integration/test_inventory_baseline.py -v

# Run add-device tests (requires Nautobot)
pytest -m "integration and nautobot" tests/integration/test_add_device_form_data.py -v

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

# Run lifecycle test class (includes SNMP tests)
pytest tests/integration/test_checkmk_device_lifecycle.py::TestCheckMKDeviceLifecycle -v

# Run connection prerequisites only
pytest tests/integration/test_checkmk_device_lifecycle.py::TestCheckMKConnectionPrerequisites -v
```

## Test Markers

- `@pytest.mark.integration` - Requires real systems
- `@pytest.mark.unit` - Uses mocks, no real systems
- `@pytest.mark.checkmk` - CheckMK-related tests
- `@pytest.mark.nautobot` - Nautobot-related tests
- `@pytest.mark.snmp` - SNMP-specific tests

## Prerequisites

### For Inventory Baseline Tests (`test_inventory_baseline.py`):
1. ✅ Nautobot running with baseline data loaded (`tests/baseline.yaml`)
2. ✅ Backend `.env.test` configured with Nautobot credentials

### For Add Device Tests (`test_add_device_form_data.py`):
1. ✅ Nautobot running with baseline data loaded
2. ✅ Backend `.env.test` configured with Nautobot credentials
3. ✅ Resources exist in Nautobot: role `network`, status `Active`, location `City A`, namespace `Global`
4. ℹ️ **Note**: Creates and deletes `testdevice` and `192.168.180.0/24` prefix during each test

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
