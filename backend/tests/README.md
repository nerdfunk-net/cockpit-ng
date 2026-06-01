# Cockpit-NG Backend Test Suite

## Overview

This directory contains the test suite for the Cockpit-NG backend application. All tests use **comprehensive mocking** to eliminate dependencies on external services (Nautobot, CheckMK), enabling fast, reliable test execution in any environment.

**Current Status: ✅ Full suite: **1,387** tests collected (`pytest tests/`). **1,158** are marked `unit` and run offline with mocks when integration env vars are unset.

**Recently added**: Server inventory (SERVER & CLIENTS / Server UI) — **47** unit tests across service, Pydantic models, and API router.

## Test Statistics

- **Total Tests**: 1,387 (1,158 `unit`, remainder `integration` / `postgres` / other markers)
- **Server inventory tests**: 47 (`test_servers_service`, `test_servers_models`, `test_servers_router`)
- **Execution Time**: Unit-only runs typically complete in seconds (full suite with coverage is longer)
- **Pass Rate**: 100% when run in a correctly configured environment
- **External Dependencies**: None for unit tests (all mocked or dependency-injected fakes)

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

### 5. CheckMK Service Tests (74 tests)

A complete offline test suite for the CheckMK service layer, using a stateful `FakeCheckMKClient` as a drop-in replacement for the real client. No CheckMK instance is required.

#### `test_checkmk_host_service.py` (15 tests)

**What is tested:**
- `get_all_hosts` — empty store, seeded hosts, folder filtering
- `get_host` — found by name, not found raises `CheckMKAPIError`
- `create_host` — success, duplicate raises error, triggers service discovery
- `update_host` — merges attributes, propagates errors
- `delete_host` — success, not found raises error
- `move_host` — changes folder assignment
- `rename_host` — updates hostname key in store
- `bulk_create_hosts` — creates multiple hosts in one call

#### `test_checkmk_folder_service.py` (8 tests)

**What is tested:**
- `get_all_folders` — returns all seeded folders, filtered by parent
- `create_folder_path` — single segment, multi-segment paths, idempotent on existing folder, empty path returns true, API error returns false

#### `test_checkmk_host_group_service.py` (9 tests)

**What is tested:**
- `get_host_groups` — returns seeded groups
- `get_host_group` — found, not found raises error
- `create_host_group` — success, duplicate raises error
- `update_host_group` — updates alias
- `delete_host_group` — success, not found raises error
- `bulk_delete_host_groups` — removes multiple groups

#### `test_checkmk_tag_group_service.py` (8 tests)

**What is tested:**
- `get_all_host_tag_groups` — returns transformed list under `tag_groups` key
- `get_host_tag_group` — found, not found raises error
- `create_host_tag_group` — success with request object, duplicate raises error
- `update_host_tag_group` — updates tags via request object
- `delete_host_tag_group` — success, not found raises error

**Key pattern:** Service methods accept Pydantic model instances. Tests use `SimpleNamespace` with `MagicMock()` tag objects that have a `.dict()` method:

```python
def _create_request(group_id: str, title: str, tags: list[str]) -> SimpleNamespace:
    tag_mocks = [MagicMock(**{"dict.return_value": {"id": t, "title": t}}) for t in tags]
    return SimpleNamespace(id=group_id, title=title, tags=tag_mocks, topic="monitoring", help="")
```

#### `test_checkmk_discovery_service.py` (8 tests)

**What is tested:**
- `get_service_discovery` — returns idle state, transitions after start
- `start_service_discovery` — success, host not found raises, simulated 500 error
- `wait_for_service_discovery` — returns completed status
- `start_bulk_discovery` — triggers discovery for all listed hosts
- `update_discovery_phase` — updates mode in internal state

**Key pattern:** `start_bulk_discovery` accepts a request object with a nested `options` namespace:

```python
def _bulk_request(hostnames: list[str]) -> SimpleNamespace:
    options = SimpleNamespace(
        monitor_undecided_services=True,
        remove_vanished_services=False,
        update_service_labels=False,
        update_service_parameters=False,
        update_host_labels=False,
    )
    return SimpleNamespace(hostnames=hostnames, options=options, do_full_scan=False, bulk_size=10, ignore_errors=False)
```

#### `test_checkmk_activation_service.py` (9 tests)

**What is tested:**
- `get_pending_changes` — empty initially, non-empty after host creation
- `activate_changes` — clears pending changes, returns activation id, simulated error propagates
- `get_activation_status` — unknown id raises, found after activation
- `get_running_activations` — empty initially
- `wait_for_activation_completion` — returns completed status

**Note:** `get_pending_changes()` calls `client._make_request()` directly. `FakeCheckMKClient` implements `_make_request()` and `_handle_response()` stubs that return the pending changes data, making the full service call path testable.

#### `test_checkmk_monitoring_service.py` (8 tests)

**What is tested:**
- `get_all_monitored_hosts` — empty, returns seeded monitored hosts
- `get_monitored_host` — found (returns `{"id": ..., "extensions": {...}}`), not found raises
- `get_host_services` — returns seeded service list, returns empty list when none seeded
- `show_service` — returns service detail envelope, works with columns param

#### `test_checkmk_problems_service.py` (9 tests)

**What is tested:**
- `acknowledge_host_problem` — stores ack in fake, error simulation raises
- `acknowledge_service_problem` — stores ack under `host:service` key
- `delete_acknowledgment` — removes stored ack
- `create_host_downtime` — stores downtime, error simulation raises
- `add_host_comment` — stores comment under hostname key
- `add_service_comment` — stores comment under `host:service` key

**Key pattern:** All problem methods accept request objects. Tests use `SimpleNamespace` helpers:

```python
def _host_ack_request(hostname: str, comment: str = "Ack") -> SimpleNamespace:
    return SimpleNamespace(host_name=hostname, comment=comment, sticky=True, persistent=False, notify=True)

def _downtime_request(hostname: str, comment: str = "Maintenance") -> SimpleNamespace:
    return SimpleNamespace(
        host_name=hostname, comment=comment,
        start_time="2025-01-01T00:00:00", end_time="2025-01-01T02:00:00",
        downtime_type="host",
    )
```

---

### 6. Server Inventory Tests (47 tests)

Offline unit tests for the **Server** feature (`/api/servers`), used by the frontend Server page (`server-page.tsx`). Ansible fact gathering and Nautobot device/VM sync use other APIs; these tests cover the Cockpit server registry (PostgreSQL `servers` table).

| File | Tests | Layer |
|------|-------|--------|
| `unit/services/test_servers_service.py` | 18 | `ServersService` |
| `unit/models/test_servers_models.py` | 14 | Pydantic request/response schemas |
| `unit/core/test_servers_router.py` | 15 | FastAPI `/api/servers` routes |

#### `test_servers_service.py` (18 tests)

**What is tested:**
- Repository delegation: `list_summaries`, `count_all`, `get_by_id`, `get_all`, `delete`
- **create** — field passthrough; `is_virtual` inferred from `ansible_facts.ansible_virtualization_role == "guest"` when omitted; explicit `is_virtual` wins over facts
- **update** — `exclude_unset` fields only; not-found returns `None`
- **get_grouped** — group by `location` (JSON `name`), scalar fields (`contact`, `distribution_release`), `Uncategorized`, sorted keys, invalid `group_by` raises `ValueError`

**How it is tested:**
- Injected `MagicMock` repository (same pattern as `test_client_data_service.py`)
- `SimpleNamespace` stand-ins for `Server` ORM rows

```python
def _make_service() -> tuple[ServersService, MagicMock]:
    mock_repo = MagicMock()
    return ServersService(repository=mock_repo), mock_repo
```

#### `test_servers_models.py` (14 tests)

**What is tested:**
- **CreateServerRequest** — hostname, `primary_ipv4`, `nautobot_uuid`, `ansible_facts` size cap (512 KB), `AnsibleCredentials` (SSH key vs password + `credential_id` rules)
- **UpdateServerRequest** — partial updates, `cluster`, `selected_interfaces`
- **ListServersResponse** — `servers`, `total`, `total_all`

#### `test_servers_router.py` (15 tests)

**What is tested:**
- **GET** `/api/servers` — summaries, `?q=` search, `total` / `total_all`, deprecated `group_by` validation (400), sanitized 5xx
- **GET** `/api/servers/{id}` — 200 with `ansible_facts`, 404
- **POST** `/api/servers` — 201, 422 validation (invalid IP)
- **PUT** `/api/servers/{id}` — 200, 404
- **DELETE** `/api/servers/{id}` — 204, 404
- **403** when RBAC denies `servers:read`

**How it is tested:**
- `TestClient` + `app.dependency_overrides` for `verify_token` and `get_servers_service`
- `patch("service_factory.build_rbac_service")` for permission checks (same pattern as `test_router_5xx_sanitization.py`)

```bash
# Run server inventory tests only
python -m pytest tests/unit/services/test_servers_service.py \
  tests/unit/models/test_servers_models.py \
  tests/unit/core/test_servers_router.py -v -m unit
```

**Not covered here (by design):**
- `ServersRepository.list_summaries` SQL / `JSONB` — requires PostgreSQL (`TEST_DATABASE_URL`); SQLite cannot compile `JSONB` columns
- Nautobot add/update/delete and Cockpit Agent `setup` — separate routers and frontend utilities (`parse-ansible-facts.ts` has its own Vitest tests)

---

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

### Run CheckMK Service Tests
```bash
python -m pytest tests/unit/services/test_checkmk_*.py -v -m "unit"
```

### Run All Unit Tests
```bash
python -m pytest tests/ -v
```

### Run Server Inventory Tests
```bash
python -m pytest tests/unit/services/test_servers_service.py \
  tests/unit/models/test_servers_models.py \
  tests/unit/core/test_servers_router.py -v -m unit
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
├── mocks/
│   ├── __init__.py                     # Exports FakeCheckMKClient + constants
│   └── fake_checkmk_client.py          # Stateful in-memory CheckMK simulation
├── unit/
│   ├── core/
│   │   ├── test_router_5xx_sanitization.py
│   │   └── test_servers_router.py          # Server API routes (15 tests)
│   ├── models/
│   │   └── test_servers_models.py          # Server Pydantic schemas (14 tests)
│   └── services/
│       ├── test_ansible_inventory_service.py
│       ├── test_checkmk_activation_service.py
│       ├── test_checkmk_discovery_service.py
│       ├── test_checkmk_folder_service.py
│       ├── test_checkmk_host_group_service.py
│       ├── test_checkmk_host_service.py
│       ├── test_checkmk_monitoring_service.py
│       ├── test_checkmk_problems_service.py
│       ├── test_checkmk_tag_group_service.py
│       ├── test_servers_service.py         # ServersService (18 tests)
│       └── ...                             # additional service test modules
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
- ✅ CheckMK API calls (`FakeCheckMKClient` — stateful, not `MagicMock`)
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

**CheckMK Client (FakeCheckMKClient):**
```python
from tests.mocks import FakeCheckMKClient

fake = FakeCheckMKClient()
fake.seed_host("router1", {"ipaddress": "10.0.0.1"}, folder="~dc1")
fake.seed_monitored_host("router1", {"address": "10.0.0.1"})
fake.seed_host_services("router1", [{"description": "CPU load"}])

# Simulate a 404 on a specific call
fake_err = FakeCheckMKClient(error_on={('get_host', 'missing-host'): 404})

# Patch the factory so service instantiation picks up the fake
with patch(
    "services.checkmk.host_service.CheckMKClientFactory.build_client_from_settings",
    return_value=fake,
):
    svc = CheckMKHostService()
    result = await svc.get_host("router1")
```

**Legacy CheckMK Client (unittest.mock):**
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
1. `ServersRepository` PostgreSQL integration tests (`list_summaries` search escaping, `JSONB` columns) when `TEST_DATABASE_URL` is set
2. Additional repository layer tests (with in-memory database)
3. More edge case coverage for device creation workflows
4. Performance testing for bulk operations
5. Contract testing for external API integrations
6. Mutation testing to verify test quality
7. ✅ **COMPLETED**: Integration tests with real Nautobot instance

---

**Last Updated**: 2026-06-01
**Test Suite Version**: 1.5
**Total Tests**: 1,387 collected (1,158 `unit`) + integration suites (ansible-inventory baseline, device operations, repository PG tests when configured)
**Server inventory**: 47 unit tests (`test_servers_service`, `test_servers_models`, `test_servers_router`)
**Integration Test Suites**:
- Ansible Inventory (26 tests) - Baseline data validation with logical operations
- Device Operations (6 tests) - Add Device and Bulk Edit workflows
