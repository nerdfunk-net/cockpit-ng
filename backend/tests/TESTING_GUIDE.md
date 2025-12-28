# Comprehensive Testing Guide for Cockpit-NG

## Overview

This guide provides complete instructions for running and writing tests for the Cockpit-NG network automation application. The test suite covers device creation, CheckMK synchronization, and other critical workflows **without requiring real Nautobot or CheckMK instances**.

## Quick Start

### Install Test Dependencies

```bash
cd backend
pip install pytest pytest-asyncio pytest-mock pytest-cov
```

### Run All Tests

```bash
# Run all tests
pytest

# Run with coverage report
pytest --cov=services --cov=models --cov-report=html

# View coverage report
open htmlcov/index.html  # macOS
```

### Run Specific Test Categories

```bash
# Unit tests only (fast)
pytest -m unit

# Integration tests only
pytest -m integration

# Nautobot-related tests
pytest -m nautobot

# CheckMK-related tests
pytest -m checkmk

# Skip slow tests
pytest -m "not slow"
```

### Run Specific Test Files

```bash
# Device creation tests
pytest tests/unit/services/test_device_creation_service.py

# NB2CMK sync tests
pytest tests/integration/workflows/test_nb2cmk_sync_workflow.py

# Existing backup tests
pytest tests/services/test_device_backup_service.py
```

## Test Structure

```
backend/tests/
├── conftest.py                      # Shared fixtures and pytest config
├── README.md                         # Original backup testing docs
├── TESTING_GUIDE.md                 # This file
│
├── fixtures/                        # Centralized test data
│   ├── __init__.py
│   ├── nautobot_fixtures.py        # Nautobot mock responses
│   └── checkmk_fixtures.py         # CheckMK mock responses
│
├── mocks/                           # Reusable mock classes (future)
│   └── __init__.py
│
├── unit/                            # Unit tests (fast, isolated)
│   ├── services/
│   │   └── test_device_creation_service.py
│   └── repositories/                # (future)
│
├── integration/                     # Integration tests (mocked externals)
│   ├── workflows/
│   │   └── test_nb2cmk_sync_workflow.py
│   └── routers/                     # (future)
│
├── services/                        # Existing service tests
│   ├── test_device_config_service.py
│   └── test_device_backup_service.py
│
└── tasks/                           # Existing task tests
    └── test_backup_tasks.py
```

## Available Fixtures

### Mock Services

All fixtures are automatically available in test functions:

```python
def test_example(mock_nautobot_service, mock_checkmk_client):
    """Test with mocked dependencies."""
    # Use the mocks
    mock_nautobot_service.graphql_query = AsyncMock(return_value={...})
    mock_checkmk_client.add_host = Mock(return_value={"result": "success"})
```

**Available Mock Fixtures:**
- `mock_nautobot_service` - Nautobot API client
- `mock_checkmk_client` - CheckMK API client
- `mock_netmiko_service` - SSH/Netmiko connections
- `mock_git_service` - Git operations
- `mock_device_creation_service` - Device creation service
- `mock_nb2cmk_service` - NB2CMK sync service
- `mock_ansible_inventory_service` - Ansible inventory service

### Test Data Fixtures

Pre-populated with realistic data:

```python
def test_with_data(nautobot_device, checkmk_host):
    """Test with standard test data."""
    assert nautobot_device["name"] == "test-switch-01"
    assert checkmk_host["hostname"] == "test-switch-01"
```

**Available Data Fixtures:**
- `nautobot_device` - Standard Nautobot device
- `nautobot_devices_list` - List of Nautobot devices
- `nautobot_device_factory` - Factory for custom devices
- `checkmk_host` - Standard CheckMK host
- `checkmk_hosts_list` - List of CheckMK hosts
- `checkmk_host_factory` - Factory for custom hosts

### Database Fixtures

```python
def test_database_operation(db_session):
    """Test with in-memory SQLite database."""
    # db_session is ready to use - no setup needed!
    from core.models import JobTemplate

    template = JobTemplate(name="test", template_type="backup")
    db_session.add(template)
    db_session.commit()

    # Test your repository/database logic
```

## Writing New Tests

### Example: Testing Device Creation

```python
import pytest
from unittest.mock import AsyncMock, patch
from services.device_creation_service import DeviceCreationService
from models.nautobot import AddDeviceRequest, InterfaceRequest

@pytest.mark.unit
@pytest.mark.nautobot
class TestMyDeviceFeature:
    """Test my device feature."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up for each test."""
        self.service = DeviceCreationService()

    @pytest.mark.asyncio
    async def test_create_device_success(self, mock_nautobot_service):
        """Test successful device creation - NO REAL NAUTOBOT NEEDED!"""
        # Arrange: Mock the response Nautobot would return
        with patch('services.device_creation_service.nautobot_service', mock_nautobot_service):
            mock_nautobot_service.rest_request = AsyncMock(return_value={
                "id": "new-device-uuid",
                "name": "new-switch"
            })

            request = AddDeviceRequest(
                name="new-switch",
                device_type="catalyst-9300",
                role="access-switch",
                location="dc1",
                status="active",
                interfaces=[]
            )

            # Act: Test your logic
            result = await self.service.create_device_with_interfaces(request)

            # Assert: Verify it works
            assert result["success"] is True
            assert result["device_id"] == "new-device-uuid"
            mock_nautobot_service.rest_request.assert_called_once()
```

### Example: Testing NB2CMK Sync

```python
import pytest
from unittest.mock import AsyncMock, Mock, patch
from services.nb2cmk_base_service import NautobotToCheckMKService
from tests.fixtures import NAUTOBOT_DEVICES_LIST, CHECKMK_HOSTS_LIST

@pytest.mark.integration
@pytest.mark.checkmk
class TestMySyncFeature:
    """Test sync feature."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.service = NautobotToCheckMKService()

    @pytest.mark.asyncio
    async def test_sync_devices(self, mock_nautobot_service, mock_checkmk_client):
        """Test device sync - NO REAL SYSTEMS NEEDED!"""
        # Arrange: Mock both systems
        with patch('services.nb2cmk_base_service.nautobot_service', mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value=NAUTOBOT_DEVICES_LIST.copy()
            )
            mock_checkmk_client.get_all_hosts = Mock(return_value={})
            mock_checkmk_client.add_host = Mock(return_value={"result": "success"})

            # Act
            result = await self.service.get_devices_for_sync()

            # Assert
            assert result.total == 2
```

## Test Markers

Tests are organized with pytest markers for easy filtering:

- `@pytest.mark.unit` - Unit tests (fast, isolated)
- `@pytest.mark.integration` - Integration tests (mocked externals)
- `@pytest.mark.e2e` - End-to-end tests (requires real systems)
- `@pytest.mark.nautobot` - Nautobot-related tests
- `@pytest.mark.checkmk` - CheckMK-related tests
- `@pytest.mark.slow` - Tests taking >5 seconds

**Usage:**
```python
@pytest.mark.unit
@pytest.mark.nautobot
def test_my_feature():
    pass
```

## Common Patterns

### Pattern 1: Mock External API Calls

```python
mock_service.rest_request = AsyncMock(return_value={
    "id": "uuid-123",
    "name": "device-name"
})
```

### Pattern 2: Mock Multiple API Calls in Sequence

```python
mock_service.rest_request = AsyncMock(side_effect=[
    {"id": "device-uuid"},  # First call
    {"id": "ip-uuid"},       # Second call
    {"id": "int-uuid"},      # Third call
])
```

### Pattern 3: Mock Errors

```python
mock_service.rest_request = AsyncMock(
    side_effect=Exception("Device already exists")
)
```

### Pattern 4: Factory Fixtures for Custom Data

```python
def test_with_custom_data(nautobot_device_factory):
    device = nautobot_device_factory(
        name="custom-switch",
        ip="10.0.0.5",
        platform="junos"
    )
    # Use custom device
```

## Coverage Goals

Target coverage by module:
- **Services**: 90%+
- **Models**: 80%+
- **Tasks**: 70%+
- **Utils**: 90%+

Check coverage:
```bash
pytest --cov=services --cov-report=term-missing
```

## CI/CD Integration

Tests are designed for CI/CD pipelines:

```yaml
# .github/workflows/tests.yml
- name: Run tests
  run: |
    pip install -r requirements.txt
    pytest --cov --cov-report=xml -m "not e2e"
```

## Troubleshooting

### Import Errors
```bash
# Ensure you're in backend directory
cd backend

# Verify fixtures load
python -c "from tests.fixtures import NAUTOBOT_DEVICE_STANDARD; print('OK')"
```

### Async Test Failures
Ensure `pytest-asyncio` is installed and tests are marked:
```python
@pytest.mark.asyncio
async def test_async_function():
    pass
```

### Fixture Not Found
Check that `conftest.py` is in the tests directory and fixtures are defined there.

## Next Steps

### Priority Tests to Implement

1. **Device Onboarding Workflow** (HIGH)
   - File: `tests/integration/workflows/test_device_onboarding_workflow.py`
   - Tests complete device creation with validation

2. **Device Offboarding** (HIGH)
   - File: `tests/integration/workflows/test_device_offboarding_workflow.py`
   - Tests device removal and cleanup

3. **Bulk Edit** (MEDIUM)
   - File: `tests/integration/workflows/test_bulk_edit_workflow.py`
   - Tests batch device updates

4. **Ansible Inventory** (MEDIUM)
   - File: `tests/unit/services/test_ansible_inventory_service.py`
   - Tests inventory generation

5. **Repository Layer** (MEDIUM)
   - File: `tests/unit/repositories/test_job_template_repository.py`
   - Tests database operations

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [unittest.mock](https://docs.python.org/3/library/unittest.mock.html)
- [Coverage.py](https://coverage.readthedocs.io/)

## Summary

**Key Points:**
✅ **No real Nautobot/CheckMK needed** - All external dependencies are mocked
✅ **Fast tests** - Unit tests run in milliseconds
✅ **Comprehensive fixtures** - Pre-built test data for all scenarios
✅ **Easy to extend** - Add new tests using existing patterns
✅ **CI/CD ready** - Designed for automated testing pipelines

**Getting Started:**
1. Install: `pip install pytest pytest-asyncio pytest-mock`
2. Run: `pytest -m unit` (fast unit tests)
3. Write: Copy patterns from existing tests
4. Extend: Add new test files following the structure above
