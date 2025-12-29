# Integration Testing Setup - Quick Reference

## Summary

✅ Integration test infrastructure has been set up for testing against a **real Nautobot instance**.

## What Was Created

### 1. Test Environment Configuration
- **File**: `/backend/.env.test`
- **Purpose**: Store test Nautobot credentials
- **Example**: `/backend/.env.test.example`

### 2. Test Fixtures
- **File**: `/backend/tests/conftest.py`
- **New Fixtures**:
  - `test_nautobot_configured` - Checks if test environment is set up
  - `real_nautobot_service` - Real Nautobot API connection
  - `real_ansible_inventory_service` - Inventory service with real Nautobot

### 3. Integration Test Suite
- **File**: `/backend/tests/integration/test_ansible_inventory_real_nautobot.py`
- **Test Count**: 19 comprehensive tests
- **Coverage**:
  - Basic filtering (location, role, platform, status)
  - Logical operations (AND/OR intersections and unions)
  - String operators (equals, contains, case-insensitive)
  - Special filters (has_primary_ip)
  - Edge cases (empty values, non-existent data)
  - Performance testing
  - Data structure validation

### 4. Documentation
- **File**: `/backend/tests/INTEGRATION_TESTING.md` - Complete setup and usage guide
- **Updated**: `/backend/tests/README.md` - Added integration testing section
- **Updated**: `/backend/pytest.ini` - Added `real_nautobot` marker

## Quick Start

### Step 1: Configure Test Environment

```bash
cd /Users/mp/programming/cockpit-ng/backend

# Copy example file
cp .env.test.example .env.test

# Edit with your test Nautobot credentials
nano .env.test
```

Update these values:
```bash
NAUTOBOT_HOST=http://your-test-nautobot:8080
NAUTOBOT_TOKEN=your-actual-api-token
```

### Step 2: Create Test Data in Nautobot

Your test Nautobot should have:

**Locations**: DC1, DC2
**Roles**: access-switch, distribution-switch, core-router
**Platforms**: cisco_ios, junos
**Devices**: 3-5 test devices with various attributes

### Step 3: Run Tests

```bash
# Run integration tests
pytest -m "integration and nautobot" -v

# Expected output:
# - 19 tests collected
# - All tests should pass if Nautobot is configured
# - Tests auto-skip if .env.test is not configured
```

## Test Organization

### Test Classes

| Class | Tests | Purpose |
|-------|-------|---------|
| `TestBasicFilteringRealNautobot` | 4 | Single-field filters |
| `TestLogicalOperationsRealNautobot` | 3 | AND/OR logic validation |
| `TestStringOperatorsRealNautobot` | 3 | String matching operators |
| `TestSpecialFiltersRealNautobot` | 2 | Special filters (has_primary_ip) |
| `TestEdgeCasesRealNautobot` | 4 | Error handling & edge cases |
| `TestPerformanceRealNautobot` | 1 | Performance benchmarks |
| `TestDataValidationRealNautobot` | 2 | Data structure validation |

## Authentication & Configuration

### How It Works

1. **Environment Loading**: Tests load `.env.test` file
2. **Service Configuration**: `real_nautobot_service` fixture configures NautobotService with test credentials
3. **Auto-Skip**: Tests skip if credentials are missing or placeholders
4. **Same Authentication**: Uses identical authentication as production app (JWT tokens from Nautobot)

### Configuration Hierarchy

```
1. .env.test file (used by integration tests)
   ↓
2. NautobotService.config (configured in fixture)
   ↓
3. Real GraphQL/REST API calls to test Nautobot
```

### No Database Settings Needed

Integration tests **do NOT** need the app's database settings because:
- Tests connect directly to Nautobot API
- No local database operations in ansible-inventory filtering logic
- All data comes from Nautobot GraphQL queries

## Verification Commands

### Check Configuration
```bash
# Verify .env.test exists
ls -la .env.test

# Check configuration (should not show placeholder)
cat .env.test | grep NAUTOBOT_TOKEN
```

### Test Collection
```bash
# Verify tests can be collected
pytest tests/integration/test_ansible_inventory_real_nautobot.py --collect-only

# Expected: "19 tests collected"
```

### Run Specific Tests
```bash
# Run one test class
pytest tests/integration/test_ansible_inventory_real_nautobot.py::TestBasicFilteringRealNautobot -v

# Run one specific test
pytest tests/integration/test_ansible_inventory_real_nautobot.py::TestBasicFilteringRealNautobot::test_filter_by_location_real_data -v
```

## Test Execution Modes

### 1. Unit Tests Only (Default for CI/CD)
```bash
pytest -m unit
# Fast, no external dependencies
```

### 2. Integration Tests (Mocked)
```bash
pytest -m integration
# Uses mocked services (existing tests)
```

### 3. Integration Tests (Real Nautobot)
```bash
pytest -m "integration and nautobot"
# Requires .env.test configuration
# Makes real API calls
```

### 4. All Tests
```bash
pytest
# Runs everything (unit + integration)
```

## Troubleshooting

### Tests Show as SKIPPED

**Cause**: `.env.test` not configured or using placeholder token

**Fix**:
```bash
# Check token is real
grep NAUTOBOT_TOKEN .env.test
# Should NOT be: your-test-nautobot-token-here

# Update with real token
nano .env.test
```

### Connection Refused

**Cause**: Nautobot not accessible

**Fix**:
```bash
# Test connection manually
curl http://localhost:8080/api/

# Verify URL matches .env.test
cat .env.test | grep NAUTOBOT_HOST
```

### 401 Unauthorized

**Cause**: Invalid API token

**Fix**:
1. Log in to Nautobot UI
2. Go to User Settings → API Tokens
3. Create new token or copy existing
4. Update `.env.test`

## Next Steps

1. ✅ **Done**: Configure `.env.test` with test Nautobot
2. ✅ **Done**: Create test data in Nautobot
3. ✅ **Done**: Run integration tests
4. 🔜 **Optional**: Add more integration tests for other services
5. 🔜 **Optional**: Set up CI/CD integration testing pipeline

## Files Modified/Created

```
backend/
├── .env.test                           # NEW: Test environment config
├── .env.test.example                   # NEW: Example config template
├── pytest.ini                          # UPDATED: Added real_nautobot marker
└── tests/
    ├── conftest.py                     # UPDATED: Added real fixtures
    ├── integration/
    │   └── test_ansible_inventory_real_nautobot.py  # NEW: 19 integration tests
    ├── INTEGRATION_TESTING.md          # NEW: Comprehensive guide
    ├── INTEGRATION_SETUP_SUMMARY.md    # NEW: This file
    └── README.md                       # UPDATED: Added integration section
```

## Support

For detailed information, see:
- **Setup Guide**: [INTEGRATION_TESTING.md](INTEGRATION_TESTING.md)
- **Test Documentation**: [README.md](README.md)
- **Main Project Docs**: [../../CLAUDE.md](../../CLAUDE.md)

---

**Status**: ✅ Ready to use
**Created**: 2025-12-29
**Integration Tests**: 19 tests across 7 test classes
