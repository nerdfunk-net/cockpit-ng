# Cockpit-NG Backend Test Suite

## Overview

This directory contains the test suite for the Cockpit-NG backend application. All tests use **comprehensive mocking** to eliminate dependencies on external services (Nautobot, CheckMK), enabling fast, reliable test execution in any environment.

**Current Status: ✅ 93 passing tests, 0 failures, 0 skipped**

## Test Statistics

- **Total Tests**: 93
- **Execution Time**: ~0.6 seconds
- **Pass Rate**: 100%
- **External Dependencies**: None (all mocked)

## Test Files

### 1. `test_device_common_service.py` (34 tests)

Tests the `DeviceCommonService` class, which provides shared utility methods used across multiple services.

**What is tested:**
- **Device Resolution** (7 tests)
  - Resolving devices by name, IP address, or UUID
  - Fallback resolution strategies
  - GraphQL error handling

- **Resource Resolution** (6 tests)
  - Resolving status, namespace, platform, role, location, device type IDs
  - Name-to-UUID conversion for Nautobot resources
  - Error handling for missing resources

- **Validation Methods** (4 tests)
  - Required field validation
  - IP address validation (IPv4 and IPv6)
  - MAC address validation
  - UUID format validation

- **Data Processing** (9 tests)
  - Nested field flattening (e.g., `platform.name` → `platform`)
  - Tag normalization (string/list/comma-separated)
  - Update data preparation from CSV rows
  - Nested value extraction

- **Interface & IP Helpers** (4 tests)
  - Ensuring IP addresses exist (create if missing)
  - Ensuring interfaces exist
  - Assigning IPs to interfaces
  - Handling existing vs. new assignments

- **Error Handling** (4 tests)
  - Duplicate error detection
  - Already-exists error handling
  - Graceful error recovery

**How it is tested:**
```python
# Example: Mocking Nautobot service
@pytest.fixture
def mock_nautobot_service():
    service = MagicMock(spec=NautobotService)
    service.graphql_query = AsyncMock()
    service.rest_request = AsyncMock()
    return service

# Test uses AsyncMock for async operations
@pytest.mark.asyncio
async def test_resolve_device_by_name_success(common_service, mock_nautobot_service):
    mock_nautobot_service.graphql_query.return_value = {
        "data": {"devices": [{"id": "device-uuid-123", "name": "test-device"}]}
    }
    result = await common_service.resolve_device_by_name("test-device")
    assert result == "device-uuid-123"
```

---

### 2. `test_device_import_service.py` (18 tests)

Tests the `DeviceImportService` class for bulk device import operations.

**What is tested:**
- CSV data parsing and validation
- Device data transformation
- Bulk import workflows
- Error handling during imports
- Partial failure scenarios
- Data mapping and field resolution

**How it is tested:**
- Mocks Nautobot API responses for device creation
- Uses sample CSV data structures
- Tests both success and error paths
- Validates data transformation logic

---

### 3. `test_ansible_inventory_service.py` (28 tests)

Tests the `AnsibleInventoryService` class for generating Ansible inventory from Nautobot data.

**What is tested:**
- **Inventory Preview** (4 tests)
  - Preview by location
  - Preview by role
  - Preview with AND conditions
  - Preview with OR conditions

- **Device Filtering** (4 tests)
  - Filter by name
  - Filter by tag
  - Filter by platform
  - Filter by primary IP presence

- **Inventory Generation** (2 tests)
  - Inventory format generation
  - Device variables inclusion

- **Custom Fields** (2 tests)
  - Custom field type fetching
  - Custom field caching

- **Complex Queries** (2 tests)
  - Complex AND/OR combinations
  - Empty operations handling

- **GraphQL Query Construction** (8 tests) **[NEW]**
  - Location equals/contains query building
  - Name equals/contains query building
  - Role, status, platform filter queries
  - Verification that AND makes multiple queries

- **Client-Side Filtering Logic** (3 tests) **[NEW]**
  - AND operation returns intersection
  - OR operation returns union
  - Empty result when no intersection

- **Error Handling** (3 tests)
  - GraphQL error handling
  - Invalid field name handling
  - Empty filter value handling

**How it is tested:**
```python
# Example: Testing GraphQL query construction
@pytest.mark.asyncio
async def test_location_equals_builds_correct_query(mock_nautobot_service):
    mock_nautobot_service.graphql_query = AsyncMock(return_value={"data": {"devices": []}})

    operations = [
        LogicalOperation(
            operation_type="AND",
            conditions=[LogicalCondition(field="location", operator="equals", value="DC1")]
        )
    ]

    await service.preview_inventory(operations)

    # Verify the GraphQL query was constructed correctly
    call_args = mock_nautobot_service.graphql_query.call_args
    query = call_args[0][0]
    variables = call_args[0][1]

    assert "devices (location:" in query
    assert variables.get("location_filter") == ["DC1"]

# Example: Testing client-side filtering logic
@pytest.mark.asyncio
async def test_and_operation_returns_intersection(mock_nautobot_service):
    # Query 1 returns: device-1, device-2, device-3
    # Query 2 returns: device-2, device-3, device-4
    # Expected: device-2, device-3 (intersection)

    location_devices = {"data": {"devices": [
        {"id": "device-1", "name": "sw-1"},
        {"id": "device-2", "name": "sw-2"},
        {"id": "device-3", "name": "sw-3"},
    ]}}

    role_devices = {"data": {"devices": [
        {"id": "device-2", "name": "sw-2"},
        {"id": "device-3", "name": "sw-3"},
        {"id": "device-4", "name": "sw-4"},
    ]}}

    mock_nautobot_service.graphql_query = AsyncMock(side_effect=[location_devices, role_devices])

    result_devices, _ = await service.preview_inventory(operations)

    # Should only return intersection
    assert len(result_devices) == 2
    device_ids = {d.id for d in result_devices}
    assert device_ids == {"device-2", "device-3"}
```

**Key Features:**
- ✅ 100% test coverage of all filtering scenarios
- ✅ **NEW**: Verifies GraphQL queries are correctly constructed
- ✅ **NEW**: Validates AND/OR filtering logic with realistic mock data
- ✅ Comprehensive edge case testing

---

### 4. `test_nb2cmk_sync_workflow.py` (13 tests)

Tests the Nautobot to CheckMK synchronization workflow.

**What is tested:**
- **Device Fetching** (3 tests)
  - Fetching all devices from Nautobot via GraphQL
  - Handling GraphQL errors
  - Handling empty results

- **Device Comparison** (2 tests)
  - Identifying new devices (in Nautobot but not in CheckMK)
  - Identifying orphaned devices (in CheckMK but not in Nautobot)

- **Sync Operations** (3 tests)
  - Adding new devices to CheckMK
  - Updating existing devices
  - Handling host-exists errors

- **Error Handling** (2 tests)
  - Partial sync failures
  - Progress tracking

- **Data Transformation** (2 tests)
  - Nautobot → CheckMK format conversion
  - Handling missing optional fields

- **Integration** (1 test)
  - Complete end-to-end sync workflow

**How it is tested:**
```python
# Example: Mocking both Nautobot and CheckMK
@pytest.fixture(autouse=True)
def setup(self, mock_nautobot_service):
    with patch('routers.checkmk._get_checkmk_client') as mock_checkmk_client:
        # Mock CheckMK client
        mock_checkmk_client.return_value.get_hosts.return_value = {...}
        mock_checkmk_client.return_value.create_host.return_value = {...}

        # Mock Nautobot GraphQL
        mock_nautobot_service.graphql_query = AsyncMock(return_value={...})

        yield

@pytest.mark.asyncio
async def test_transforms_nautobot_to_checkmk_format():
    nautobot_device = {
        "name": "switch01",
        "primary_ip4": {"address": "10.0.0.1/24"},
        "platform": {"name": "cisco_ios"}
    }

    checkmk_format = transform_to_checkmk(nautobot_device)

    assert checkmk_format["host_name"] == "switch01"
    assert checkmk_format["ipaddress"] == "10.0.0.1"
```

**Key Features:**
- ✅ 100% test coverage of sync workflow
- ✅ Mocks both external services (Nautobot + CheckMK)
- ✅ Tests data transformation accuracy
- ✅ Integration test included

---

## Test Infrastructure

### Fixtures (`conftest.py`)

The test suite uses centralized fixtures for consistent test setup:

```python
@pytest.fixture
def mock_nautobot_service():
    """Mock NautobotService with AsyncMock for API calls."""
    service = MagicMock(spec=NautobotService)
    service.graphql_query = AsyncMock()
    service.rest_request = AsyncMock()
    return service
```

**Available Fixtures:**
- `mock_nautobot_service` - Mocked Nautobot API client
- `mock_checkmk_client` - Mocked CheckMK API client
- `mock_netmiko_service` - Mocked Netmiko SSH client
- Sample data fixtures (devices, interfaces, IPs, etc.)

### Pytest Configuration (`pytest.ini`)

```ini
[pytest]
asyncio_mode = auto

markers =
    unit: Unit tests (fast, no external dependencies)
    integration: Integration tests (mocked externals)
    asyncio: Async tests using pytest-asyncio

addopts =
    -v
    --tb=short
    --strict-markers

testpaths = tests
console_output_style = progress
```

### Test Patterns

#### 1. **Async Testing**
```python
@pytest.mark.asyncio
async def test_async_operation():
    mock_service.async_method = AsyncMock(return_value=expected_data)
    result = await service.perform_operation()
    assert result == expected_data
```

#### 2. **Mocking External APIs**
```python
def test_with_mocked_api(mock_nautobot_service):
    # Setup mock response
    mock_nautobot_service.rest_request.return_value = {"id": "uuid", "name": "device"}

    # Test service method
    result = service.create_device(...)

    # Verify mock was called correctly
    mock_nautobot_service.rest_request.assert_called_once_with(
        endpoint="dcim/devices/",
        method="POST",
        data={"name": "device", ...}
    )
```

#### 3. **Testing Error Handling**
```python
@pytest.mark.asyncio
async def test_handles_api_error():
    mock_service.api_call.side_effect = Exception("API Error")

    result = await service.operation_that_might_fail()

    assert result["success"] is False
    assert "error" in result
```

#### 4. **Parameterized Tests**
```python
@pytest.mark.parametrize("input_value,expected", [
    ("192.168.1.1", True),
    ("10.0.0.1/24", True),
    ("invalid", False),
])
def test_ip_validation(common_service, input_value, expected):
    result = common_service.validate_ip_address(input_value)
    assert result == expected
```

## Running Tests

### Run All Tests
```bash
cd backend
python -m pytest tests/ -v
```

### Run Specific Test File
```bash
python -m pytest tests/test_device_common_service.py -v
```

### Run Specific Test
```bash
python -m pytest tests/test_device_common_service.py::TestDeviceResolution::test_resolve_device_by_name_success -v
```

### Run Tests by Marker
```bash
# Run only unit tests
python -m pytest -m unit

# Run only integration tests
python -m pytest -m integration

# Run only async tests
python -m pytest -m asyncio
```

### Run with Coverage
```bash
python -m pytest tests/ --cov=services --cov=repositories --cov-report=html
```

## Test Organization

```
tests/
├── conftest.py                          # Shared fixtures and configuration
├── pytest.ini                           # Pytest settings
├── fixtures/                            # Centralized test data
│   ├── __init__.py
│   ├── nautobot_fixtures.py            # Nautobot mock responses
│   └── checkmk_fixtures.py             # CheckMK mock responses
├── unit/
│   └── services/
│       └── test_ansible_inventory_service.py
├── integration/
│   └── workflows/
│       └── test_nb2cmk_sync_workflow.py
├── test_device_common_service.py        # Utility service tests
└── test_device_import_service.py        # Import service tests
```

## Mocking Strategy

### Why Mock Everything?

1. **Speed**: Tests run in ~0.5 seconds (vs. minutes with real APIs)
2. **Reliability**: No network issues, API rate limits, or service downtime
3. **Isolation**: Tests verify code logic, not external service behavior
4. **Portability**: Tests run anywhere (CI/CD, local, air-gapped environments)

### What is Mocked

- ✅ Nautobot GraphQL API calls
- ✅ Nautobot REST API calls
- ✅ CheckMK API calls
- ✅ Netmiko SSH connections
- ✅ Database operations (where applicable)
- ✅ External service dependencies

### Mock Examples

**Nautobot GraphQL Query:**
```python
mock_nautobot_service.graphql_query = AsyncMock(return_value={
    "data": {
        "devices": [
            {"id": "uuid-1", "name": "switch01"},
            {"id": "uuid-2", "name": "switch02"}
        ]
    }
})
```

**Nautobot REST Request:**
```python
mock_nautobot_service.rest_request = AsyncMock(return_value={
    "id": "device-uuid",
    "name": "new-device",
    "status": {"name": "Active"}
})
```

**CheckMK Client:**
```python
with patch('routers.checkmk._get_checkmk_client') as mock_client:
    mock_client.return_value.get_hosts.return_value = [
        {"host_name": "switch01", "ipaddress": "10.0.0.1"}
    ]
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Backend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-mock pytest-cov

      - name: Run tests
        run: |
          cd backend
          pytest tests/ -v --cov=services --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          file: ./backend/coverage.xml
```

## Best Practices

### ✅ DO

- Use `AsyncMock` for async methods
- Mock at the boundary (external APIs, not internal methods)
- Test both success and failure paths
- Use descriptive test names
- Keep tests independent
- Use fixtures for shared setup
- Test edge cases

### ❌ DON'T

- Make real API calls
- Test implementation details (test behavior, not internals)
- Share state between tests
- Skip error handling tests
- Use sleep() or wait() (use mocks instead)
- Test framework code (test your code)

## Adding New Tests

### 1. Create Test File

```python
"""Tests for MyNewService."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from services.my_new_service import MyNewService

@pytest.fixture
def service(mock_nautobot_service):
    return MyNewService(mock_nautobot_service)

class TestMyNewService:
    """Test suite for MyNewService."""

    @pytest.mark.asyncio
    async def test_my_operation(self, service, mock_nautobot_service):
        """Test successful operation."""
        # Arrange
        mock_nautobot_service.api_call = AsyncMock(return_value={...})

        # Act
        result = await service.perform_operation()

        # Assert
        assert result["success"] is True
```

### 2. Add Fixtures (if needed)

In `conftest.py` or `fixtures/`:
```python
@pytest.fixture
def sample_data():
    return {
        "field1": "value1",
        "field2": "value2"
    }
```

### 3. Run and Verify

```bash
python -m pytest tests/test_my_new_service.py -v
```

## Troubleshooting

### Common Issues

**Issue**: `RuntimeWarning: coroutine was never awaited`
**Solution**: Use `AsyncMock` instead of `Mock` for async methods

**Issue**: `AttributeError: Mock object has no attribute 'X'`
**Solution**: Use `spec=` parameter when creating mocks: `MagicMock(spec=ServiceClass)`

**Issue**: Tests pass locally but fail in CI
**Solution**: Ensure no environment-specific dependencies; check mocks are complete

**Issue**: Slow test execution
**Solution**: Verify all external calls are mocked, not hitting real APIs

## Metrics

- **Test Coverage**: Focus on service and repository layers
- **Test Speed**: All tests complete in < 1 second
- **Test Reliability**: 100% pass rate, no flaky tests
- **Maintainability**: Clear test names, good documentation

## Integration Testing with Real Nautobot

**NEW:** The test suite now supports integration tests with a real Nautobot instance!

### Quick Setup

```bash
# 1. Configure test environment
cp ../.env.test.example ../.env.test
nano ../.env.test  # Add your test Nautobot URL and token

# 2. Run integration tests
pytest -m "integration and nautobot" -v
```

### Test Types

| Type | File | Mocking | External Deps |
|------|------|---------|---------------|
| Unit | `unit/` | All mocked | None |
| Integration (Mocked) | `integration/workflows/` | External APIs mocked | None |
| Integration (Real) | `integration/test_ansible_inventory_baseline.py` | None | Real Nautobot |
| Integration (Real) | `integration/test_device_operations_real_nautobot.py` | None | Real Nautobot |

### Integration Test Features

- **Real API Calls**: Tests make actual GraphQL/REST calls to test Nautobot
- **Complex Logic Validation**: Verifies AND/OR operations work correctly with real data
- **Edge Case Testing**: Tests real-world scenarios and edge cases
- **Auto-Skip**: Tests skip automatically if `.env.test` not configured

### Running Integration Tests

```bash
# All integration tests (mocked + real)
pytest -m integration

# Only real Nautobot integration tests
pytest -m "integration and nautobot"

# Skip integration tests (unit only)
pytest -m "not integration"
```

### Documentation

**General Integration Testing**:
- [INTEGRATION_TESTING.md](INTEGRATION_TESTING.md) - Comprehensive setup guide
- [RUN_INTEGRATION_TESTS.md](RUN_INTEGRATION_TESTS.md) - Quick run guide
- `../.env.test` - Test environment (create from `../.env.test.example`)

**Specific Test Suites**:
- [BASELINE_TEST_DATA.md](BASELINE_TEST_DATA.md) - Ansible inventory baseline test data
- [DEVICE_OPERATIONS_TESTS.md](DEVICE_OPERATIONS_TESTS.md) - Add Device and Bulk Edit tests
- [FINAL_SUMMARY.md](FINAL_SUMMARY.md) - Complete integration test summary

---

## Future Enhancements

Potential areas for expansion:
1. Additional repository layer tests (with in-memory database)
2. More edge case coverage for device creation workflows
3. Performance testing for bulk operations
4. Contract testing for external API integrations
5. Mutation testing to verify test quality
6. ✅ **COMPLETED**: Integration tests with real Nautobot instance

---

**Last Updated**: 2025-12-29
**Test Suite Version**: 1.3
**Total Tests**: 93 passing unit tests + 32 integration tests (26 ansible-inventory + 6 device operations)
**Integration Test Suites**:
- Ansible Inventory (26 tests) - Baseline data validation with logical operations
- Device Operations (6 tests) - Add Device and Bulk Edit workflows
