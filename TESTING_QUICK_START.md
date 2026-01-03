# Testing Quick Start Guide

## Run the Tests

```bash
cd backend

# Run integration tests with REAL systems (Nautobot + CheckMK)
pytest tests/integration/test_checkmk_baseline.py -v

# Run device lifecycle tests (creates/deletes real devices in CheckMK)
pytest tests/integration/test_checkmk_device_lifecycle.py -v

# Run unit tests with captured API data (fast, no real systems)
pytest tests/integration/test_checkmk_api_structure.py -v

# Run SNMP version detection tests
pytest tests/integration/test_snmp_mapping_comparison.py::TestSNMPVersionDetection -v

# Run all CheckMK tests
pytest tests/integration/ -m checkmk -v

# Run with coverage
pytest tests/integration/ --cov=services.checkmk --cov-report=html
```

## View Test Results

After running tests with coverage:
```bash
open backend/htmlcov/index.html
```

## Capture New Test Data

1. **Enable debug logging**:
   ```bash
   # In backend/.env
   LOG_LEVEL=DEBUG
   ```

2. **Run a comparison** (via UI or Celery task)

3. **Check logs** for:
   ```
   [CHECKMK API] get_host(...) full response:
   [NORMALIZE] Device ... normalized config:
   ```

4. **Copy data** to test fixtures:
   - `backend/tests/fixtures/checkmk_fixtures.py`
   - `backend/tests/fixtures/snmp_fixtures.py`

## Test Files

- **Integration Tests (Baseline)**: `backend/tests/integration/test_checkmk_baseline.py`
- **Device Lifecycle Tests**: `backend/tests/integration/test_checkmk_device_lifecycle.py` ⭐ NEW
- **Unit Tests (Mocked)**: `backend/tests/integration/test_checkmk_api_structure.py`
- **SNMP Tests**: `backend/tests/integration/test_snmp_mapping_comparison.py`
- **SNMP Fixtures**: `backend/tests/fixtures/snmp_fixtures.py`
- **CheckMK Fixtures**: `backend/tests/fixtures/checkmk_fixtures.py`
- **Summary**: `backend/tests/REAL_API_TEST_SUMMARY.md`

## What Was Fixed

✅ **SNMP Version Detection Bug** - Integer vs string handling
✅ **Config Reload in Celery** - No worker restart needed
✅ **Debug Logging** - Capture real API responses
✅ **Test Infrastructure** - Real production data

All tests use **real CheckMK API responses** captured on 2026-01-03! 🎉
