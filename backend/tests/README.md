# Cockpit-NG Backend Test Suite

## Overview

This directory contains the test suite for the Cockpit-NG backend application. All tests use **comprehensive mocking** to eliminate dependencies on external services (Nautobot, CheckMK), enabling fast, reliable test execution in any environment.

**Current Status: ✅ Full suite: **1,387** tests collected (`pytest tests/`). **1,158** are marked `unit` and run offline with mocks when integration env vars are unset.

**Recently added**: Server inventory (SERVER & CLIENTS / Server UI) — **47** unit tests across service, Pydantic models, and API router.

## Quick navigation

| Topic | Where in this file |
|-------|-------------------|
| **`.env.test` configuration** (start here) | [Test environment file](#test-environment-file-backendenvtest) |
| **PostgreSQL, `init_db`, external services** | [Setting up dependencies](#setting-up-dependencies) |
| **Pytest baseline** (generate/import `baseline.yaml`, manifest) | [Pytest baseline](#pytest-baseline--build-baselineyaml-and-what-to-do-next) |
| **CheckMK integration** (live Nautobot + CheckMK) | [CheckMK integration tests](#checkmk-integration-tests-live-nautobot--checkmk) |
| **Nautobot integration** | [Running Integration Tests](#running-integration-tests) |
| **Run pytest** (markers, coverage) | [Running Tests](#running-tests) |

## Test environment file (`backend/.env.test`)

Create **one** file for optional integration tests (Nautobot, CheckMK, PostgreSQL). Pytest loads it automatically at startup (`tests/test_env.py` sets `COCKPIT_TEST_ENV=1` so live tests use these values, **not** Cockpit Settings in the UI). Your normal `backend/.env` and the Settings UI are unchanged.

### Create the file

```bash
cd backend
cp .env.test.example .env.test
```

Edit `.env.test` and enable only the sections you need. Tests for missing configuration are **skipped**, not failed.

### Example (from `.env.test.example`)

```bash
# Cockpit backend — integration / optional live-service tests
# Omit sections you do not need; matching tests are skipped.

# =============================================================================
# Nautobot (inventory, device ops, CSV import, CheckMK baseline tests)
# =============================================================================
NAUTOBOT_HOST=http://localhost:8080
NAUTOBOT_TOKEN=your-test-nautobot-token-here
NAUTOBOT_TIMEOUT=30
NAUTOBOT_VERIFY_SSL=true

# =============================================================================
# CheckMK (test_checkmk_baseline.py, test_checkmk_device_lifecycle.py)
# Server root only (no /check_mk path). Site is the OMD site id (often "cmk").
# =============================================================================
CHECKMK_URL=http://192.168.178.101:8080
CHECKMK_SITE=cmk
# Or: CHECKMK_URL=http://192.168.178.101:8080/cmk  (CHECKMK_SITE optional)
CHECKMK_USERNAME=automation
CHECKMK_PASSWORD=your-automation-secret
CHECKMK_VERIFY_SSL=false

# =============================================================================
# PostgreSQL repository tests (tests/integration/repositories/, @pytest.mark.postgres)
# Either set TEST_DATABASE_URL directly:
# TEST_DATABASE_URL=postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/cockpit_test
#
# Or use COCKPIT_DATABASE_* (TEST_DATABASE_URL is derived if unset):
# =============================================================================
COCKPIT_DATABASE_HOST=127.0.0.1
COCKPIT_DATABASE_PORT=5432
COCKPIT_DATABASE_NAME=cockpit_test
COCKPIT_DATABASE_USERNAME=postgres
COCKPIT_DATABASE_PASSWORD=postgres

# Required when running init_db() against the test database
SECRET_KEY=local-test-secret-not-for-production
```

Canonical template: [`backend/.env.test.example`](../.env.test.example) (keep in sync when adding variables).

### Variable reference

| Variables | Used by |
|-----------|---------|
| `NAUTOBOT_HOST`, `NAUTOBOT_TOKEN`, `NAUTOBOT_TIMEOUT`, `NAUTOBOT_VERIFY_SSL` | `@pytest.mark.nautobot` integration tests |
| `CHECKMK_URL`, `CHECKMK_SITE`, `CHECKMK_USERNAME`, `CHECKMK_PASSWORD`, `CHECKMK_VERIFY_SSL` | `@pytest.mark.checkmk` integration tests |
| `TEST_DATABASE_URL` **or** `COCKPIT_DATABASE_*` | `@pytest.mark.postgres` repository tests; pytest derives `TEST_DATABASE_URL` from `COCKPIT_DATABASE_*` when unset |
| `SECRET_KEY` | `init_db()` when applying migrations to the test database |

## Setting up dependencies

After `.env.test` exists, start external services and apply the database schema before running integration or PostgreSQL tests.

### PostgreSQL test database

Repository tests under `tests/integration/repositories/` run SQL against a **real PostgreSQL** instance (JSONB, `DISTINCT ON`, aggregates). They use the marker **`postgres`** and are **skipped** unless `TEST_DATABASE_URL` is set (from `.env.test` or the shell).

| File | What it covers |
|------|----------------|
| `integration/repositories/test_client_data_repository_pg.py` | `ClientDataRepository` — L2-only devices, session history, retention cleanup |
| `integration/repositories/test_job_run_repository_pg.py` | `JobRunRepository` — status aggregates, recent backup window |
| `integration/repositories/test_servers_repository_pg.py` | `ServersRepository` — summary `load_only`, `ilike` search escaping, `JSONB` |

Package notes: [integration/repositories/README.md](integration/repositories/README.md).

**Safety:** Use a **dedicated** database (for example `cockpit_test`), not production or your normal dev Cockpit DB. Tests **truncate** client-data tables before each client-data test, **truncate** `servers` before each servers-repository test, and **delete all rows** from `job_runs` before each job-run test.

**Start PostgreSQL** (example with Docker; match host/port/name/user/password in `.env.test`):

```bash
docker run -d --name cockpit-pg-test \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=cockpit_test \
  -p 5432:5432 \
  postgres:16-alpine
```

### Apply schema (`init_db`)

`init_db()` uses `COCKPIT_DATABASE_*` and `SECRET_KEY` from `.env.test` (not `TEST_DATABASE_URL` alone). Point those variables at the **same** database pytest will use.

Required for **`job_runs`** (job-run tests skip if the table is missing). Client-data tables may be created via `create_all` in fixtures, but running migrations is the supported path:

```bash
cd backend
set -a && source .env.test && set +a
python -c "from core.database import init_db; init_db()"
```

### Unit test coverage (pyproject scope)

Coverage tracks `services`, `models`, `tasks`, and `utils` (see `[tool.coverage.run]` in `pyproject.toml`). Routers and repositories are excluded until dedicated unit tests exist.

```bash
cd backend

# Canonical coverage check (matches CI; phased gate fail_under in pyproject.toml)
python -m pytest tests/unit/ -q -m unit \
  --cov=services --cov=models --cov=tasks --cov=utils \
  --cov-report=term-missing
```

Manual CheckMK dev script `services/checkmk/client/test_client.py` is omitted from coverage metrics.

CI enforces a phased minimum via `[tool.coverage.report] fail_under` in `pyproject.toml` (currently **59%**; target **70%**).

**Phase 2 unit test modules** (compliance, CheckMK priority models, inventory/site utils):

```bash
python -m pytest tests/unit/services/test_compliance_service.py \
  tests/unit/models/test_checkmk_priority_models.py \
  tests/unit/utils/test_inventory_resolver.py \
  tests/unit/utils/test_cmk_site_utils.py \
  tests/unit/utils/test_nautobot_helpers.py \
  tests/unit/utils/test_netmiko_platform_mapper.py -v -m unit
```

**Phase 1 unit test modules** (git cache/operations, agent template render, NB2CMK background, Redis cache, credentials):

```bash
python -m pytest tests/unit/services/test_git_cache_service.py \
  tests/unit/services/test_git_operations_service.py \
  tests/unit/services/test_template_render_service.py \
  tests/unit/services/test_nb2cmk_background_service.py \
  tests/unit/services/test_redis_cache_service.py \
  tests/unit/services/test_credentials_service.py -v -m unit
```

### Run PostgreSQL tests

```bash
cd backend

# Repository tests only (pytest loads .env.test automatically)
python -m pytest tests/integration/repositories -v -m postgres

# Same as GitHub Actions (unit + repository PG)
python -m pytest tests/unit tests/integration/repositories -v
```

CI: [`.github/workflows/backend-tests.yml`](../../.github/workflows/backend-tests.yml) — PostgreSQL 16 service, `init_db()`, then `pytest tests/unit tests/integration/repositories`.

### Other integration prerequisites

| Suite | Besides `.env.test` |
|-------|---------------------|
| `@pytest.mark.nautobot` | Live Nautobot; [baseline data](#3-load-data-into-test-nautobot) for inventory/CheckMK baseline tests |
| `@pytest.mark.checkmk` | Live CheckMK; see [CheckMK integration tests](#checkmk-integration-tests-live-nautobot--checkmk) |
| Unit tests (`tests/unit/`) | No `.env.test` required |

## CheckMK integration tests (live Nautobot + CheckMK)

| File | Needs in `.env.test` | Run |
|------|----------------------|-----|
| `integration/test_checkmk_baseline.py` | Nautobot + CheckMK; baseline imported | `pytest tests/integration/test_checkmk_baseline.py -v -m "integration and checkmk"` |
| `integration/test_checkmk_device_lifecycle.py` | CheckMK (Nautobot for one compare test) | `pytest tests/integration/test_checkmk_device_lifecycle.py -v -m "integration and checkmk"` |
| `integration/test_checkmk_api_structure.py` | None (offline) | `pytest tests/integration/test_checkmk_api_structure.py -v` |

### Prerequisites

1. **`backend/.env.test`** from `.env.test.example` with valid `NAUTOBOT_*` and `CHECKMK_*` values.
2. **Baseline in Nautobot** — [Pytest baseline §3](#3-load-data-into-test-nautobot).

### Troubleshooting: CheckMK `Invalid JSON response: <!DOCTYPE HTML`

The client received an HTML page instead of the REST API (wrong URL/site or auth). Configure:

- **`CHECKMK_URL`** — server root only, e.g. `http://192.168.178.101:8080` (not `/check_mk/...`)
- **`CHECKMK_SITE`** — OMD site id, often `cmk` (API path is `/{site}/check_mk/api/1.0`)
- **`CHECKMK_USERNAME` / `CHECKMK_PASSWORD`** — CheckMK **automation** user (not the admin UI password)
- **`CHECKMK_VERIFY_SSL=false`** — if the site uses a self-signed certificate

You may also set `CHECKMK_URL=http://host:8080/cmk` and omit `CHECKMK_SITE`. Verify:

```bash
source .env.test  # or: set -a && source .env.test && set +a
curl -sS -u "${CHECKMK_USERNAME}:${CHECKMK_PASSWORD}" \
  -H "Accept: application/json" \
  "${CHECKMK_URL%/}/${CHECKMK_SITE}/check_mk/api/1.0/version"
```

The connection prerequisite test prints the resolved API base on success; on failure the error includes it.

### Troubleshooting: Nautobot `403` / `Invalid token`

Usually `NAUTOBOT_TOKEN` in `.env.test` is wrong, expired, or still the placeholder. Verify:

```bash
curl -sS -X POST "$NAUTOBOT_HOST/api/graphql/" \
  -H "Authorization: Token $NAUTOBOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ devices { name } }"}'
```

**Offline alternative:** `pytest tests/integration/test_checkmk_api_structure.py -v`

## Test Statistics

- **Total Tests**: 1,387 (1,158 `unit`, remainder `integration` / `postgres` / other markers)
- **Server inventory tests**: 63 unit (`test_servers_service`, `test_servers_models`, `test_servers_router`) + 6 PostgreSQL (`test_servers_repository_pg`, when `TEST_DATABASE_URL` is set)
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

### 6. Server Inventory Tests (63 unit + 6 PostgreSQL)

Offline unit tests for the **Server** feature (`/api/servers`), used by the frontend Server page (`server-page.tsx`). Ansible fact gathering and Nautobot device/VM sync use other APIs; these tests cover the Cockpit server registry (PostgreSQL `servers` table).

| File | Tests | Layer |
|------|-------|--------|
| `unit/services/test_servers_service.py` | 18 | `ServersService` |
| `unit/models/test_servers_models.py` | 23 | Pydantic request/response schemas, `normalize_contacts` |
| `unit/core/test_servers_router.py` | 22 | FastAPI `/api/servers` routes |
| `integration/repositories/test_servers_repository_pg.py` | 6 | `ServersRepository` (requires `TEST_DATABASE_URL`) |

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

#### `test_servers_models.py` (23 tests)

**What is tested:**
- **CreateServerRequest** — hostname, `primary_ipv4`, `nautobot_uuid`, `ansible_facts` size cap (512 KB), `AnsibleCredentials` (SSH key vs password + `credential_id` rules)
- **UpdateServerRequest** — partial updates, `cluster`, `selected_interfaces`
- **normalize_contacts** — `None`, legacy dict, array, invalid type
- **ListServersResponse** — `servers`, `total`, `total_all`

#### `test_servers_router.py` (22 tests)

**What is tested:**
- **GET** `/api/servers` — summaries, `?q=` search, `total` / `total_all`, deprecated `group_by` validation (400), sanitized 5xx
- **GET** `/api/servers/{id}` — 200 with `ansible_facts`, 404, sanitized 5xx
- **POST** `/api/servers` — 201, 422 validation (invalid IP), sanitized 5xx
- **PUT** `/api/servers/{id}` — 200, 404, sanitized 5xx
- **DELETE** `/api/servers/{id}` — 204, 404
- **403** when RBAC denies `servers:read`, `servers:write`, or `servers:delete`

#### `test_servers_repository_pg.py` (6 tests, PostgreSQL)

**What is tested:**
- **count_all**, **list_summaries** — substring search, hostname ordering
- **ilike** escaping — literal `%` and `_` in hostnames
- **load_only** — `ansible_facts` deferred on summary rows

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
- Nautobot add/update/delete and Cockpit Agent `setup` — separate routers and frontend utilities (`parse-ansible-facts.ts` has its own Vitest tests)

**PostgreSQL repository tests** (skipped without `TEST_DATABASE_URL`):

```bash
pytest tests/integration/repositories/test_servers_repository_pg.py -v -m postgres
```

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

# PostgreSQL repository tests — see top of this README
python -m pytest -m postgres

# Run only async tests
python -m pytest -m asyncio
```

PostgreSQL setup: **[Setting up dependencies](#setting-up-dependencies)** and **[Test environment file](#test-environment-file-backendenvtest)** at the top of this file.

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
│   │   └── test_servers_router.py          # Server API routes (22 tests)
│   ├── models/
│   │   └── test_servers_models.py          # Server Pydantic schemas (23 tests)
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
│   ├── repositories/                    # PostgreSQL (@pytest.mark.postgres, TEST_DATABASE_URL)
│   │   ├── conftest.py
│   │   ├── README.md
│   │   ├── test_client_data_repository_pg.py
│   │   ├── test_job_run_repository_pg.py
│   │   └── test_servers_repository_pg.py
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
cp .env.test.example .env.test
nano .env.test  # Nautobot, CheckMK, PostgreSQL as needed

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
# All integration tests (mocked + real Nautobot; PG tests only if TEST_DATABASE_URL is set)
pytest -m integration

# Only real Nautobot integration tests (.env.test)
pytest -m "integration and nautobot"

# Only PostgreSQL repository tests (TEST_DATABASE_URL required)
pytest -m postgres

# Skip integration tests (unit only)
pytest -m "not integration"
```

PostgreSQL setup: [Setting up dependencies](#setting-up-dependencies) (near the top of this file).

### Pytest baseline — build `baseline.yaml` and what to do next

The **Pytest profile** produces the canonical 120-device dataset used by inventory, device-operation, CSV import, and CheckMK integration tests. Full design: [`doc/PYTEST_BASELINE.md`](../../doc/PYTEST_BASELINE.md).

| Artifact | Path | Role |
|----------|------|------|
| Canonical YAML | `contributing-data/tests_baseline/baseline.yaml` | Import into Nautobot; commit this file |
| Symlink (tests/docs) | `backend/tests/baseline.yaml` → contributing file | Same content; do not edit separately |
| Golden metadata | `backend/tests/baseline.golden.yaml` | Tag/status/location reference for parity checks (not imported) |
| Expected counts | `tests/fixtures/baseline_manifest.json` | Integration test assertions; regenerate after YAML changes |

#### 1. Generate `baseline.yaml`

**CLI (from `backend/`):**

```bash
cd backend
python tests/generate_baseline.py --profile pytest \
  --output ../contributing-data/tests_baseline
```

**UI:** Tools → Baseline Management → Generate → select profile **Pytest** → Generate. Copy the generated file into `contributing-data/tests_baseline/baseline.yaml` if the API wrote elsewhere (default generator output is under `data/baseline/`).

The Pytest profile uses sequential names (`lab-001` … `lab-100`, `server-01` … `server-20`), six city locations, unique IPs, and metadata aligned with `baseline.golden.yaml`.

#### 2. After generating — verify, manifest, commit

Run from the **repository root** (or use equivalent `cd backend && python scripts/...` commands):

```bash
# 1) Stats, unique IPs, and per-device metadata vs golden (pre-commit runs this too)
make verify-baseline

# 2) Refresh integration-test expected counts (manifest-driven assertions)
make baseline-manifest

# 3) Optional: inspect a single filter count
cd backend && python scripts/expect_inventory_counts.py --filter filter_by_location_city_a
```

Commit at least:

- `contributing-data/tests_baseline/baseline.yaml`
- `tests/fixtures/baseline_manifest.json` (if counts changed)

Install git hooks once (requires `pre-commit` from `backend/requirements.txt`):

```bash
pip install -r backend/requirements.txt   # includes pre-commit
pre-commit install                        # from repo root
```

On commit, the `verify-baseline-parity` hook re-runs `verify_baseline_parity.py` when baseline-related files change.

#### 3. Load data into test Nautobot

Baseline data is **not** imported by pytest. Load explicitly:

- **UI:** Tools → Baseline Management → **Import** tab  
- **API:** `POST /api/tools/tests-baseline` (optional body: `{"directory": "../contributing-data/tests_baseline"}`)  
- Override directory: env `BASELINE_DIR` (path relative to `backend/` unless absolute)

Import is idempotent (existing objects are skipped).

#### 4. Run integration tests

```bash
cd backend
cp .env.test.example .env.test   # set NAUTOBOT_HOST and NAUTOBOT_TOKEN
pytest -m "integration and nautobot" tests/integration/test_inventory_baseline.py -v
```

Tests with exact device counts use the `baseline_manifest` fixture (`assert_device_count` vs `baseline_manifest.json`). Nautobot must match the imported YAML or those tests fail even when YAML and manifest are correct.

Quick reference: [QUICK_START_INTEGRATION_TESTS.md](QUICK_START_INTEGRATION_TESTS.md).

### Documentation

**General Integration Testing**:
- [INTEGRATION_TESTING.md](INTEGRATION_TESTING.md) - Comprehensive setup guide
- [RUN_INTEGRATION_TESTS.md](RUN_INTEGRATION_TESTS.md) - Quick run guide
- `backend/.env.test` - Single test config (create from `backend/.env.test.example`)

**Specific Test Suites**:
- [BASELINE_TEST_DATA.md](BASELINE_TEST_DATA.md) - Per-location device breakdown and filter examples
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

**Last Updated**: 2026-06-03
**Test Suite Version**: 1.5
**Total Tests**: 1,387 collected (1,158 `unit`) + integration suites (ansible-inventory baseline, device operations, repository PG tests when configured)
**Server inventory**: 63 unit tests (`test_servers_service`, `test_servers_models`, `test_servers_router`) + 6 PostgreSQL (`test_servers_repository_pg` when configured)
**Integration Test Suites**:
- Ansible Inventory (26 tests) - Baseline data validation with logical operations
- Device Operations (6 tests) - Add Device and Bulk Edit workflows
