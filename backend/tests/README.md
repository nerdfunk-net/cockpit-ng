# Testing Documentation

## Overview

This directory contains comprehensive tests for the backup system refactoring. The test suite validates the service layer architecture and ensures business logic correctness independent of Celery task orchestration.

## Test Structure

```
tests/
├── __init__.py                              # Test package marker
├── conftest.py                              # Shared pytest fixtures
├── services/                                # Service layer tests
│   ├── test_device_config_service.py       # DeviceConfigService unit tests
│   └── test_device_backup_service.py       # DeviceBackupService unit tests
└── tasks/                                   # Task integration tests
    └── test_backup_tasks.py                # Celery task integration tests
```

## Test Categories

### Unit Tests (services/)

**Purpose**: Test individual service methods in isolation with mocked dependencies.

**test_device_config_service.py** (18 tests):
- Device fetching from Nautobot GraphQL API
- SSH config retrieval via Netmiko
- Config parsing and cleaning
- File system operations (saving configs)
- Path generation logic
- Error handling for API failures

**test_device_backup_service.py** (12 tests):
- Backup input validation
- Single device backup orchestration
- Nautobot timestamp updates
- Backup result preparation
- Pydantic model serialization
- Partial failure handling

### Integration Tests (tasks/)

**Purpose**: Test end-to-end workflows with mocked external dependencies (Nautobot, Netmiko, Git).

**test_backup_tasks.py** (9 tests):
- Single device backup Celery tasks
- Parallel backup orchestration
- Sequential backup orchestration
- Finalization with Git commit/push
- Error propagation through task chain
- Job run status updates

## Running Tests

### Prerequisites

Install test dependencies:
```bash
cd backend
pip install -r requirements.txt
```

This installs:
- `pytest>=7.4.0` - Test framework
- `pytest-mock>=3.12.0` - Enhanced mocking
- `pytest-cov>=4.1.0` - Code coverage
- `pytest-asyncio>=0.21.0` - Async test support

### Run All Tests

```bash
# From backend directory
pytest

# Or use the test runner
python run_tests.py
```

### Run Specific Test Types

```bash
# Unit tests only (fast)
pytest -m unit

# Integration tests only
pytest -m integration

# Specific test file
pytest tests/services/test_device_config_service.py

# Specific test class or function
pytest tests/services/test_device_config_service.py::TestDeviceConfigService::test_fetch_device_from_nautobot_success
```

### Coverage Reports

```bash
# Generate coverage report
pytest --cov=services --cov=models --cov=tasks --cov-report=html

# View HTML report
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
```

### Verbose Output

```bash
# Show detailed test output
pytest -v

# Show print statements
pytest -s

# Show local variables on failure
pytest -l
```

## Test Fixtures

Shared fixtures are defined in `conftest.py`:

### Mock Services
- `mock_nautobot_service`: Mock Nautobot API client
- `mock_netmiko_service`: Mock SSH connection service
- `mock_git_service`: Mock Git operations service

### Sample Data
- `sample_device_data`: Nautobot GraphQL device response
- `sample_credential`: Device credential configuration
- `sample_repository`: Git repository configuration
- `sample_netmiko_connection`: Mock SSH connection
- `sample_git_repo`: Temporary Git repository
- `sample_device_backup_info`: DeviceBackupInfo Pydantic model
- `sample_git_status`: GitStatus Pydantic model
- `sample_backup_configs`: Device running/startup configs

## Writing New Tests

### Unit Test Template

```python
from unittest.mock import Mock, patch
import pytest

class TestYourService:
    """Test suite for YourService."""
    
    @pytest.fixture(autouse=True)
    def setup(self, mock_dependency):
        """Set up test fixtures."""
        self.service = YourService(dependency=mock_dependency)
    
    def test_your_method_success(self):
        """Test successful operation."""
        # Arrange
        # ... setup test data
        
        # Act
        result = self.service.your_method()
        
        # Assert
        assert result is not None
```

### Integration Test Template

```python
from unittest.mock import patch
import pytest

class TestYourTask:
    """Integration tests for your_task."""
    
    @patch("tasks.your_module.dependency")
    def test_your_task_success(self, mock_dependency):
        """Test successful task execution."""
        # Arrange
        mock_dependency.method.return_value = expected_value
        
        # Act
        result = your_task(arg1, arg2)
        
        # Assert
        assert result["success"] is True
```

## Best Practices

### 1. Arrange-Act-Assert Pattern
Structure tests with clear sections:
- **Arrange**: Set up test data and mocks
- **Act**: Execute the code under test
- **Assert**: Verify results and side effects

### 2. Descriptive Test Names
Use descriptive test names that explain what is being tested:
```python
def test_fetch_device_from_nautobot_success(self):  # ✓ Good
def test_fetch_device(self):  # ✗ Too vague
```

### 3. Test One Thing
Each test should verify one specific behavior:
```python
def test_backup_single_device_success(self):
    # Tests successful backup only
    
def test_backup_single_device_config_retrieval_fails(self):
    # Tests config retrieval failure separately
```

### 4. Mock External Dependencies
Always mock external services (APIs, databases, file systems in production paths):
```python
@patch("services.device_config_service.NautobotService")
def test_with_mocked_nautobot(self, mock_nautobot):
    # NautobotService is mocked, no real API calls
```

### 5. Use Temporary Directories for File Tests
For tests that write files, use `tmp_path` fixture:
```python
def test_save_configs(self, tmp_path):
    base_path = tmp_path / "configs"
    # Files written to temporary directory, auto-cleaned
```

## Coverage Goals

Target coverage levels:
- **Services**: 90%+ coverage
- **Models**: 80%+ coverage (mostly validation logic)
- **Tasks**: 70%+ coverage (orchestration logic)
- **Utils**: 90%+ coverage

Current coverage (after refactoring):
- DeviceConfigService: ~85%
- DeviceBackupService: ~90%
- backup_tasks.py: ~65% (task orchestration)

## Continuous Integration

Tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: |
    pip install -r requirements.txt
    pytest --cov --cov-report=xml
    
- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage.xml
```

## Known Test Limitations

1. **Celery Task Testing**: Integration tests mock Celery's `.s()` and chord execution since actual Celery worker isn't running
2. **Git Operations**: Tests use temporary Git repos, not actual remote repositories
3. **SSH Connections**: Netmiko connections are mocked; no real device connections
4. **GraphQL Queries**: Nautobot GraphQL responses are mocked with sample data

## Troubleshooting

### Import Errors
```bash
# Ensure you're in the backend directory
cd backend

# Install in development mode
pip install -e .
```

### Fixture Not Found
```bash
# Ensure conftest.py is in the tests directory
ls tests/conftest.py
```

### Coverage Not Working
```bash
# Verify pytest-cov is installed
pip list | grep pytest-cov

# Run with explicit coverage
pytest --cov=services --cov-report=term-missing
```

## Implemented Test Suites

### Unit Tests
- ✅ **Device Creation** (`tests/unit/services/test_device_creation_service.py`) - 15+ tests
- ✅ **Ansible Inventory** (`tests/unit/services/test_ansible_inventory_service.py`) - 20+ tests
- ✅ **Job Template Repository** (`tests/unit/repositories/test_job_template_repository.py`) - 12+ tests
- ✅ **Credentials Repository** (`tests/unit/repositories/test_credentials_repository.py`) - 10+ tests
- ✅ **Device Config Service** (`tests/services/test_device_config_service.py`) - 18 tests (existing)
- ✅ **Device Backup Service** (`tests/services/test_device_backup_service.py`) - 12 tests (existing)

### Integration Tests
- ✅ **NB2CMK Sync Workflow** (`tests/integration/workflows/test_nb2cmk_sync_workflow.py`) - 15+ tests
- ✅ **Device Offboarding** (`tests/integration/workflows/test_device_offboarding_workflow.py`) - 15+ tests
- ✅ **Bulk Edit Workflow** (`tests/integration/workflows/test_bulk_edit_workflow.py`) - 20+ tests
- ✅ **Backup Tasks** (`tests/tasks/test_backup_tasks.py`) - 9 tests (existing)

## Future Enhancements

- [ ] Add Router/API endpoint tests
- [ ] Add performance benchmarking tests
- [ ] Add load testing for parallel backup execution
- [ ] Add property-based tests with Hypothesis
- [ ] Add mutation testing with mutmut
- [ ] Add end-to-end tests with real Nautobot instance (optional)
- [ ] Add tests for error recovery and retry logic

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [pytest-mock](https://pytest-mock.readthedocs.io/)
- [Coverage.py](https://coverage.readthedocs.io/)
- [Python Testing Best Practices](https://docs.python-guide.org/writing/tests/)
