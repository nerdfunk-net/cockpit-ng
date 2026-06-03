# Repository PostgreSQL integration tests

These tests use **`TEST_DATABASE_URL`** (SQLAlchemy URL, typically `postgresql+psycopg2://…`). You can set it in **`backend/.env.test`** (or export it); if omitted, pytest derives it from `COCKPIT_DATABASE_*` in the same file.

Full setup: **[`tests/README.md` — Test environment file](../../README.md#test-environment-file-backendenvtest)** then **[Setting up dependencies](../../README.md#setting-up-dependencies)**.

## Requirements

1. A PostgreSQL instance the tests can reach.
2. **`TEST_DATABASE_URL`** set in the environment.
3. **Client-data tests** (`test_client_data_repository_pg.py`): tables `client_ip_addresses`, `client_mac_addresses`, and `client_hostnames` are created with SQLAlchemy `create_all` if missing.
4. **Job run tests** (`test_job_run_repository_pg.py`): the **`job_runs`** table must already exist (run **`init_db()`** / migrations against that database, as in CI).

## Safety

Tests **truncate** client-data tables before every test and **delete all rows** from `job_runs` before each job-run test. Use a **dedicated** database (for example `cockpit_test`), not production.

## Continuous integration

GitHub Actions workflow **`.github/workflows/backend-tests.yml`** starts PostgreSQL, runs `init_db`, sets `TEST_DATABASE_URL`, and executes `pytest tests/unit tests/integration/repositories`.
