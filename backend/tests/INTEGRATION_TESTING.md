# Integration Testing Guide

This guide explains how to run integration tests for Cockpit-NG that connect to a real Nautobot instance.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Test Environment Setup](#test-environment-setup)
- [Running Tests](#running-tests)
- [Test Categories](#test-categories)
- [Writing Integration Tests](#writing-integration-tests)
- [Troubleshooting](#troubleshooting)

---

## Overview

Cockpit-NG has two types of tests:

| Test Type | Description | External Dependencies | Speed |
|-----------|-------------|----------------------|-------|
| **Unit Tests** | Fast tests with mocked services | None (all mocked) | Very fast |
| **Integration Tests** | Tests with real Nautobot instance | Real Nautobot instance | Slower |

Integration tests verify that:
- Complex logical operations work correctly with real data
- GraphQL queries are correctly constructed
- Client-side filtering produces expected results
- Edge cases are handled properly

---

## Quick Start

### 1. Configure Test Environment

```bash
cd backend

# Copy the test environment template
cp .env.test.example .env.test  # Or edit existing .env.test

# Edit .env.test with your test Nautobot credentials
nano .env.test
```

Update these values in `.env.test`:
```bash
NAUTOBOT_HOST=http://your-test-nautobot:8080
NAUTOBOT_TOKEN=your-actual-test-token
NAUTOBOT_TIMEOUT=30
```

### 2. Create Test Data in Nautobot

Your test Nautobot instance should have:

**Locations:**
- DC1 (Data Center 1)
- DC2 (Data Center 2)

**Roles:**
- access-switch
- distribution-switch
- core-router

**Platforms:**
- cisco_ios
- junos

**Test Devices:**
- test-switch-01 (Location: DC1, Role: access-switch, IP: 10.0.0.1)
- test-switch-02 (Location: DC1, Role: access-switch, IP: 10.0.0.2)
- test-router-01 (Location: DC2, Role: core-router, IP: 10.0.1.1)

### 3. Run Integration Tests

```bash
# Run only integration tests with Nautobot
pytest -m "integration and nautobot"

# Run all tests (unit + integration)
pytest

# Skip integration tests (run only unit tests)
pytest -m "not integration"
```

---

## Test Environment Setup

### Prerequisites

1. **Test Nautobot Instance**
   - Can be local Docker, staging environment, or dedicated test server
   - Should be SEPARATE from production
   - Should have consistent test data

2. **API Token**
   - Generate in Nautobot: User Settings → API Tokens
   - Token should have read permissions for:
     - Devices
     - Locations
     - Roles
     - Platforms
     - IP Addresses

### Setting Up Test Nautobot (Docker)

If you don't have a test Nautobot instance:

```bash
# Start Nautobot with Docker Compose
docker-compose -f docker-compose.nautobot.yml up -d

# Wait for Nautobot to start (check http://localhost:8080)

# Create superuser
docker exec -it nautobot nautobot-server createsuperuser

# Log in to Nautobot web UI
# Navigate to User Settings → API Tokens
# Create a new token and copy it

# Update .env.test with the token
```

### Creating Test Data

Use the Nautobot UI or API to create test data:

**Via Nautobot UI:**
1. Organization → Locations → Add locations (DC1, DC2)
2. Devices → Roles → Add roles (access-switch, core-router)
3. Devices → Platforms → Add platforms (cisco_ios, junos)
4. Devices → Devices → Add test devices

**Via Python Script:**
```python
# scripts/create_test_data.py
import requests

NAUTOBOT_URL = "http://localhost:8080"
TOKEN = "your-token"

headers = {
    "Authorization": f"Token {TOKEN}",
    "Content-Type": "application/json"
}

# Create locations
locations = [
    {"name": "DC1", "location_type": "data-center-uuid"},
    {"name": "DC2", "location_type": "data-center-uuid"}
]

for loc in locations:
    requests.post(f"{NAUTOBOT_URL}/api/dcim/locations/",
                  json=loc, headers=headers)

# Add more test data creation...
```

---

## Running Tests

### Basic Test Execution

```bash
# All tests
pytest

# Only unit tests (fast)
pytest -m unit

# Only integration tests
pytest -m integration

# Only Nautobot integration tests
pytest -m "integration and nautobot"

# Verbose output
pytest -v -m "integration and nautobot"

# Show print statements
pytest -s -m "integration and nautobot"
```

### Selective Test Execution

```bash
# Run specific test file
pytest tests/integration/test_ansible_inventory_real_nautobot.py

# Run specific test class
pytest tests/integration/test_ansible_inventory_real_nautobot.py::TestBasicFilteringRealNautobot

# Run specific test method
pytest tests/integration/test_ansible_inventory_real_nautobot.py::TestBasicFilteringRealNautobot::test_filter_by_location_real_data

# Run tests matching keyword
pytest -k "location" -m integration
```

### Test Output Options

```bash
# Short summary
pytest -m integration --tb=short

# Detailed failure info
pytest -m integration --tb=long

# Stop on first failure
pytest -m integration -x

# Show slowest tests
pytest -m integration --durations=10
```

### Skipping Tests

Tests automatically skip if `.env.test` is not configured:

```bash
# This will skip integration tests if .env.test is missing
pytest -m "integration and nautobot"

# Output:
# SKIPPED [1] tests/conftest.py:442: Test Nautobot instance not configured
```

---

## Test Categories

### 1. Basic Filtering Tests

**File:** `test_ansible_inventory_real_nautobot.py::TestBasicFilteringRealNautobot`

Tests single-field filtering:
- Filter by location
- Filter by role
- Filter by platform
- Filter by status

```bash
pytest tests/integration/test_ansible_inventory_real_nautobot.py::TestBasicFilteringRealNautobot -v
```

### 2. Logical Operations Tests

**File:** `test_ansible_inventory_real_nautobot.py::TestLogicalOperationsRealNautobot`

Tests AND/OR logic:
- AND operation (intersection)
- OR operation (union)
- Complex combinations

```bash
pytest tests/integration/test_ansible_inventory_real_nautobot.py::TestLogicalOperationsRealNautobot -v
```

### 3. String Operators Tests

**File:** `test_ansible_inventory_real_nautobot.py::TestStringOperatorsRealNautobot`

Tests string matching:
- Exact match (equals)
- Partial match (contains)
- Case-insensitive matching

```bash
pytest tests/integration/test_ansible_inventory_real_nautobot.py::TestStringOperatorsRealNautobot -v
```

### 4. Special Filters Tests

**File:** `test_ansible_inventory_real_nautobot.py::TestSpecialFiltersRealNautobot`

Tests special filters:
- has_primary_ip (true/false)

```bash
pytest tests/integration/test_ansible_inventory_real_nautobot.py::TestSpecialFiltersRealNautobot -v
```

### 5. Edge Cases Tests

**File:** `test_ansible_inventory_real_nautobot.py::TestEdgeCasesRealNautobot`

Tests error handling:
- Empty filter values
- Non-existent locations
- Contradictory conditions

```bash
pytest tests/integration/test_ansible_inventory_real_nautobot.py::TestEdgeCasesRealNautobot -v
```

### 6. Performance Tests

**File:** `test_ansible_inventory_real_nautobot.py::TestPerformanceRealNautobot`

Tests performance (marked as `@pytest.mark.slow`):
- Complex query performance

```bash
pytest tests/integration/test_ansible_inventory_real_nautobot.py::TestPerformanceRealNautobot -v
```

---

## Writing Integration Tests

### Basic Integration Test Template

```python
import pytest
from models.ansible_inventory import LogicalOperation, LogicalCondition


@pytest.mark.integration
@pytest.mark.nautobot
class TestMyFeatureRealNautobot:
    """Integration tests for my feature."""

    @pytest.mark.asyncio
    async def test_my_feature(self, real_ansible_inventory_service):
        """Test my feature with real Nautobot data."""
        # Arrange
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(
                        field="location",
                        operator="equals",
                        value="DC1"
                    )
                ]
            )
        ]

        # Act
        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        # Assert
        assert isinstance(devices, list)
        assert count >= 0

        # Verify results match expected filter
        for device in devices:
            location = getattr(device, 'location', None)
            if location:
                location_name = location.get('name') if isinstance(location, dict) else getattr(location, 'name', None)
                assert location_name == "DC1"
```

### Available Fixtures

#### `real_nautobot_service`
Direct access to Nautobot API:

```python
@pytest.mark.asyncio
async def test_with_nautobot(real_nautobot_service):
    query = """
    query {
        devices {
            id
            name
        }
    }
    """
    result = await real_nautobot_service.graphql_query(query)
    assert result["data"]["devices"]
```

#### `real_ansible_inventory_service`
Pre-configured ansible inventory service:

```python
@pytest.mark.asyncio
async def test_inventory(real_ansible_inventory_service):
    operations = [...]
    devices, count = await real_ansible_inventory_service.preview_inventory(operations)
```

### Test Markers

Always use appropriate markers:

```python
@pytest.mark.integration  # Required: marks as integration test
@pytest.mark.nautobot     # Required: marks as Nautobot test
@pytest.mark.slow         # Optional: if test takes >5 seconds
@pytest.mark.asyncio      # Required: for async tests
```

---

## Troubleshooting

### Tests Are Skipped

**Problem:** Tests show as SKIPPED

**Solution:**
```bash
# Check if .env.test exists
ls -la .env.test

# Verify configuration
cat .env.test

# Ensure token is not placeholder
grep NAUTOBOT_TOKEN .env.test
# Should NOT be: your-test-nautobot-token-here
```

### Connection Errors

**Problem:** `Connection refused` or timeout errors

**Solution:**
1. Verify Nautobot is running:
   ```bash
   curl http://localhost:8080/api/
   ```

2. Check URL in `.env.test`:
   ```bash
   # Should match where Nautobot is running
   NAUTOBOT_HOST=http://localhost:8080
   ```

3. Test token manually:
   ```bash
   curl -H "Authorization: Token YOUR-TOKEN" \
        http://localhost:8080/api/dcim/devices/
   ```

### Authentication Errors

**Problem:** `401 Unauthorized` or `403 Forbidden`

**Solution:**
1. Verify token is valid:
   - Log in to Nautobot UI
   - Navigate to User Settings → API Tokens
   - Verify token exists and is active

2. Check token permissions:
   - Token needs read access to devices, locations, roles, platforms

3. Update `.env.test` with correct token

### No Test Data Found

**Problem:** Tests pass but return empty results

**Solution:**
1. Verify test data exists in Nautobot:
   ```bash
   curl -H "Authorization: Token YOUR-TOKEN" \
        http://localhost:8080/api/dcim/devices/
   ```

2. Check location/role names match:
   - Test looks for "DC1" → must exist exactly as "DC1"
   - Names are case-sensitive

3. Update test data or test assertions to match

### GraphQL Errors

**Problem:** GraphQL syntax errors or schema errors

**Solution:**
1. Check Nautobot version compatibility
2. Test GraphQL query in Nautobot GraphiQL interface:
   - Navigate to: `http://localhost:8080/graphql/`
   - Paste query from test
   - Verify it works

3. Update query syntax if Nautobot schema changed

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest

    services:
      nautobot:
        image: networktocode/nautobot:latest
        env:
          NAUTOBOT_SECRET_KEY: test-secret-key
        ports:
          - 8080:8080

    steps:
      - uses: actions/checkout@v2

      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Create test environment
        run: |
          cd backend
          cat > .env.test << EOF
          NAUTOBOT_HOST=http://localhost:8080
          NAUTOBOT_TOKEN=${{ secrets.NAUTOBOT_TEST_TOKEN }}
          EOF

      - name: Run integration tests
        run: |
          cd backend
          pytest -m "integration and nautobot" -v
```

---

## Best Practices

### 1. Keep Test Data Consistent
- Document test data in `.env.test` comments
- Use fixtures to create/clean up test data
- Don't rely on auto-incrementing IDs

### 2. Test Isolation
- Don't modify Nautobot data in tests (read-only)
- If writes needed, clean up in teardown
- Use unique names for created objects

### 3. Performance
- Mark slow tests with `@pytest.mark.slow`
- Run slow tests separately in CI
- Cache expensive queries when possible

### 4. Assertions
- Verify data structure, not just presence
- Check relationships are loaded correctly
- Validate expected behavior, not implementation

### 5. Documentation
- Document test data requirements
- Explain complex test logic
- Add troubleshooting tips in docstrings

---

## Additional Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Nautobot API Documentation](https://nautobot.readthedocs.io/en/latest/rest-api/overview/)
- [Nautobot GraphQL Guide](https://nautobot.readthedocs.io/en/latest/additional-features/graphql/)
- [Main Test Documentation](../TESTING.md)

---

## Support

If you encounter issues:

1. Check this troubleshooting guide
2. Review test output with `-v` and `-s` flags
3. Verify `.env.test` configuration
4. Test Nautobot connection manually
5. Check test data exists in Nautobot
6. Open an issue with error details
