# Backend Testing Guide

## Overview

The Cockpit-NG backend uses **pytest** with **stateful fake implementations** as the primary testing strategy. All tests run offline — no Nautobot, CheckMK, or database connections are required for unit tests. The full suite (~167 tests) completes in under one second.

---

## Directory Layout

```
backend/tests/
├── conftest.py                      # Shared pytest fixtures (markers, mock services, auth)
├── fixtures/                        # Static test data (API response shapes)
│   ├── checkmk_fixtures.py
│   └── nautobot_fixtures.py
├── mocks/                           # Stateful fake implementations
│   ├── fake_checkmk_client.py       # FakeCheckMKClient — drop-in for CheckMKClient
│   ├── fake_nautobot_service.py     # FakeNautobotService — drop-in for NautobotService
│   └── fake_auth_repositories.py   # FakeUserRepository, FakeRBACRepository
├── unit/
│   └── services/                    # One file per service class
│       ├── test_checkmk_host_service.py
│       ├── test_checkmk_folder_service.py
│       └── ...
└── integration/                     # Real-API tests (skipped unless .env.test configured)
    └── workflows/
```

---

## Core Principle: Stateful Fakes over MagicMock

For services that interact with external APIs (CheckMK, Nautobot), use the **stateful fake implementations** in `tests/mocks/`, not `MagicMock`. The fakes maintain in-memory dictionaries that mirror the real service state, allowing tests to verify side effects (host was created, folder was moved) without any network calls.

Use `MagicMock` / `AsyncMock` only for services that are **dependencies of** the class under test, not the class itself.

| Dependency type | Use |
|---|---|
| CheckMK client (the thing being tested) | `FakeCheckMKClient` |
| Nautobot service (injected dep) | `FakeNautobotService` or `AsyncMock` |
| Config service (injected dep) | Inline `_FakeConfig` class |
| Simple async dependency | `AsyncMock` |

---

## Pytest Markers

Every test function carries **three markers**:

```python
@pytest.mark.asyncio    # needed for every async test
@pytest.mark.unit       # or: integration, e2e
@pytest.mark.checkmk    # or: nautobot, slow
```

Markers are registered in `conftest.py`:

```python
def pytest_configure(config):
    config.addinivalue_line("markers", "unit: Unit tests (fast, no external dependencies)")
    config.addinivalue_line("markers", "integration: Integration tests (mocked externals)")
    config.addinivalue_line("markers", "e2e: End-to-end tests (real systems, manual only)")
    config.addinivalue_line("markers", "nautobot: Tests involving Nautobot integration")
    config.addinivalue_line("markers", "checkmk: Tests involving CheckMK integration")
    config.addinivalue_line("markers", "slow: Tests that take >5 seconds")
```

---

## Unit Test Pattern: CheckMK Services

### 1. Define the patch target at module level

The service class imports `CheckMKClientFactory` to build its client. Patch that factory at module level so every test uses the same target string:

```python
_PATCH_TARGET = "services.checkmk.host_service.CheckMKClientFactory.build_client_from_settings"
```

The path is always `<module_where_the_import_lives>.CheckMKClientFactory.build_client_from_settings`.

### 2. Construct a fresh fake per test, seed it, patch the factory

```python
@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_all_hosts_returns_seeded_hosts():
    """Pre-seeded hosts appear in the response."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {"ipaddress": "10.0.0.1"}, folder="/dc1")
    fake.seed_host("switch1", {"ipaddress": "10.0.0.2"}, folder="/dc1/access")

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        result = await svc.get_all_hosts()

    assert result["total"] == 2
    hostnames = {h["host_name"] for h in result["hosts"]}
    assert hostnames == {"router1", "switch1"}
```

Key points:
- Create `fake` **before** entering the patch context.
- Instantiate the service **inside** the `with patch(...)` block.
- Assert **after** the block — the fake retains its state.

### 3. Verify side effects via fake's internal state

After calling the service, inspect the fake's internal dictionaries directly:

```python
async def test_create_host_success():
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        result = await svc.create_host(hostname="new-host", folder="/dc1", attributes={"ipaddress": "192.168.1.10"})

    assert "new-host" in fake._hosts
    assert fake._hosts["new-host"]["extensions"]["attributes"]["ipaddress"] == "192.168.1.10"
```

Available internal stores on `FakeCheckMKClient`:

| Attribute | Contains |
|---|---|
| `fake._hosts` | `hostname → envelope` |
| `fake._folders` | `folder_id → envelope` |
| `fake._host_groups` | `group_name → {name, alias}` |
| `fake._tag_groups` | `group_id → full tag group` |
| `fake._pending_changes` | list of pending change dicts |
| `fake._activations` | `activation_id → status` |
| `fake._discovery_state` | `hostname → {state, mode}` |
| `fake._acknowledgements` | `key → ack data` |
| `fake._downtimes` | `hostname → downtime` |
| `fake._comments` | `key → list of comments` |
| `fake.call_log` | `[(method_name, args), ...]` |

### 4. Simulate errors with `error_on`

```python
# 404 on a specific host
fake = FakeCheckMKClient(error_on={("get_host", "missing"): 404})

# 500 on any call to delete_host
fake = FakeCheckMKClient(error_on={("delete_host", "*"): 500})

# 500 on activate_changes (no argument matters)
fake = FakeCheckMKClient(error_on={("activate_changes", "*"): 500})
```

Then verify the error propagates:

```python
async def test_delete_host_error_propagates():
    fake = FakeCheckMKClient(error_on={("delete_host", "locked-host"): 403})
    fake.seed_host("locked-host", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        with pytest.raises(CheckMKAPIError):
            await svc.delete_host("locked-host")
```

### 5. Request objects: use `SimpleNamespace`

Service methods that accept Pydantic request objects can be given `SimpleNamespace` stand-ins in tests. Define factory helpers at module level:

```python
from types import SimpleNamespace

def _activate_request(sites: list[str] | None = None) -> SimpleNamespace:
    return SimpleNamespace(sites=sites or [], force_foreign_changes=False, redirect=False)

def _host_ack_request(hostname: str, comment: str = "ack") -> SimpleNamespace:
    return SimpleNamespace(
        host_name=hostname, comment=comment,
        sticky=True, persistent=False, notify=True,
    )

def _downtime_request(hostname: str) -> SimpleNamespace:
    return SimpleNamespace(
        host_name=hostname, comment="maintenance",
        start_time="2024-01-01T00:00:00Z",
        end_time="2024-01-01T04:00:00Z",
        downtime_type="host",
    )
```

For services that accept Pydantic models with `.dict()` called internally, use:

```python
from unittest.mock import MagicMock

tag_mocks = [MagicMock(**{"dict.return_value": {"id": t, "title": t}}) for t in tags]
```

---

## Unit Test Pattern: Services with Config Dependencies

Services like normalizers load configuration through an injected config service. Provide an inline `_FakeConfig` class in the test file (not in `tests/mocks/`):

```python
class _FakeConfig:
    """Minimal in-memory config for this test file only."""

    def __init__(self, cfg: dict | None = None, snmp_mapping: dict | None = None):
        self._cfg = cfg or {}
        self._snmp = snmp_mapping or {}

    def load_checkmk_config(self, force_reload: bool = False) -> dict:
        return self._cfg

    def load_snmp_mapping(self, force_reload: bool = False) -> dict:
        return self._snmp

    def get_comparison_keys(self) -> list[str]:
        return self._cfg.get("comparison_keys", ["attributes", "folder"])

    def get_ignore_attributes(self) -> list[str]:
        return self._cfg.get("ignore_attributes", [])

    def reload_config(self) -> None:
        pass
```

Patch the config factory at construction time only:

```python
_PATCH_CONFIG = "service_factory.build_checkmk_config_service"

def _make_service(cfg: dict | None = None) -> MySvc:
    fake_cfg = _FakeConfig(cfg=cfg)
    with patch(_PATCH_CONFIG, return_value=fake_cfg):
        return MySvc()
```

If the service also calls utility functions at call time, patch those per-call:

```python
_PATCH_SITE   = "services.checkmk.normalization.device_normalizer.get_monitored_site"
_PATCH_FOLDER = "services.checkmk.normalization.device_normalizer.get_device_folder"

def _normalize(svc, device_data, site="prod", folder="/dc1"):
    with (
        patch(_PATCH_SITE, return_value=site),
        patch(_PATCH_FOLDER, return_value=folder),
    ):
        return svc.normalize_device(device_data)
```

---

## Unit Test Pattern: Nautobot Services

For services that depend on `NautobotService`, use either `FakeNautobotService` (for tests that need stateful resolution) or `AsyncMock` (for tests that only care about return values).

### When to use `FakeNautobotService`

Use when the service under test calls multiple Nautobot methods that need to be consistent (e.g., resolve a status ID and then use it in a device creation).

```python
from tests.mocks import (
    FakeNautobotService,
    STATUS_ACTIVE_ID, DT_NETWORKA_ID, LOC_CITYA_ID,
)

def test_device_creation_resolves_status():
    fake = FakeNautobotService()
    fake.seed_device("dev-uuid", {
        "name": "router1",
        "status": {"id": STATUS_ACTIVE_ID, "name": "Active"},
    })
    # ... test using fake
```

Well-known seed UUIDs are exported as constants from `tests/mocks/__init__.py`. Always use these constants in tests — never hardcode raw UUID strings.

| Constant | Entity |
|---|---|
| `STATUS_ACTIVE_ID`, `STATUS_PLANNED_ID`, … | Status records |
| `PLATFORM_IOS_ID`, `PLATFORM_NXOS_ID`, … | Platform records |
| `DT_NETWORKA_ID`, `DT_SERVER_ID`, … | Device types |
| `LOC_CITYA_ID`, `LOC_DC_ID`, … | Locations |
| `NS_GLOBAL_ID` | Default namespace |
| `ROLE_NETWORK_ID`, `ROLE_SERVER_ID`, … | Roles |

### When to use `AsyncMock` directly

Use when the service under test calls a single Nautobot method and you only need to control the return value:

```python
from unittest.mock import AsyncMock, MagicMock

mock_nautobot = AsyncMock()
mock_nautobot.graphql_query.return_value = {
    "data": {"devices": [{"id": "abc123", "name": "router1"}]}
}

with patch("service_factory.build_nautobot_service", return_value=mock_nautobot):
    result = await svc.get_devices_diff()
```

---

## Test Class Organization

Group tests that share a service construction pattern into a class. Use `setup_method` (not `@pytest.fixture`) for the simple case:

```python
class TestCompareConfigurations:
    """Direct unit tests for the private _compare_configurations method."""

    def setup_method(self) -> None:
        self.svc = _make_service()

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_identical_configs_return_no_differences(self) -> None:
        """Configs with identical folder and attributes → empty differences list."""
        nb  = {"folder": "/dc1", "attributes": {"ipaddress": "10.0.0.1"}}
        cmk = {"folder": "/dc1", "attributes": {"ipaddress": "10.0.0.1"}}
        diffs = self.svc._compare_configurations(nb, cmk)
        assert diffs == []
```

For async tests inside a class, always include `@pytest.mark.asyncio` on the method.

Use flat (non-class) functions when each test needs a different configuration. Use classes when multiple tests share the same setup.

---

## Naming Conventions

### File names

One test file per service class:

```
services/checkmk/host_service.py  →  tests/unit/services/test_checkmk_host_service.py
services/checkmk/folder.py        →  tests/unit/services/test_checkmk_folder_service.py
```

### Test function names

`test_<method_name>_<scenario>()` where scenario describes what makes this case distinctive:

```python
test_get_all_hosts_empty()
test_get_all_hosts_returns_seeded_hosts()
test_create_host_success()
test_create_host_duplicate_raises()
test_create_host_with_start_discovery()
test_create_host_discovery_failure_does_not_block()
```

### Docstrings

One sentence: state the condition and what should happen. Avoid restating the function name.

```python
def test_get_host_not_found_raises():
    """Getting an unknown host raises HostNotFoundError."""
```

---

## Async Tests

All service methods in this project are `async`. Use `pytest-asyncio`:

```python
@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_my_async_service():
    fake = FakeCheckMKClient()
    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        result = await svc.some_method()
    assert result is not None
```

`asyncio_mode = auto` is set in `pyproject.toml`, but still add `@pytest.mark.asyncio` explicitly for clarity.

---

## FakeCheckMKClient Seeding Reference

```python
fake = FakeCheckMKClient()

# Hosts
fake.seed_host("router1", {"ipaddress": "10.0.0.1"}, folder="/dc1")

# Folders (in addition to default ~, ~dc1, ~dc1~access)
fake.seed_folder("~region", "Region", parent="~")

# Monitored hosts (live monitoring, separate from config hosts)
fake.seed_monitored_host("router1", {"address": "10.0.0.1"})

# Services on a host
fake.seed_host_services("router1", [
    {"description": "CPU load", "state": 0},
    {"description": "Memory", "state": 1},
])
```

Default state seeded on every `FakeCheckMKClient()`:

| Store | Pre-seeded entries |
|---|---|
| `_folders` | `~` (root), `~dc1`, `~dc1~access` |
| `_tag_groups` | `tag_agent` (with cmk-agent, no-agent, snmp-v2) |
| `_host_groups` | `network-devices`, `servers` |

These constants are exported for use in assertions:

```python
from tests.mocks import FOLDER_ROOT, FOLDER_DC1, FOLDER_DC2
from tests.mocks import TAG_GROUP_AGENT_ID
from tests.mocks import HOST_GROUP_NETWORK, HOST_GROUP_SERVERS
```

---

## What to Assert

Prefer asserting on **observable behavior** rather than implementation details. For CheckMK service tests, "observable" includes the fake's internal state because the fake *is* the boundary:

```python
# Assert the service returned what was expected
assert result["total"] == 2
assert result["hosts"][0]["folder"] == "/dc1"

# Assert the fake's state changed correctly (side effect verification)
assert "new-host" in fake._hosts
assert fake._hosts["new-host"]["extensions"]["attributes"]["ipaddress"] == "192.168.1.10"

# Assert errors are raised with the right type and message
with pytest.raises(HostNotFoundError, match="not found"):
    await svc.get_host("nonexistent")

# Assert response structure (not just "not None")
assert "create_result" in result
assert result.get("id") is not None
assert "status" in status
```

---

## Error Path Testing

Every service method that can fail must have at least one test for each distinct failure mode. Use `error_on` to inject failures:

```python
async def test_create_host_discovery_failure_does_not_block():
    """If discovery fails, the host is still created and a warning is recorded."""
    fake = FakeCheckMKClient(
        error_on={("start_service_discovery", "fragile-host"): 500}
    )

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKHostService()
        result = await svc.create_host(
            hostname="fragile-host", folder="/", attributes={}, start_discovery=True,
        )

    # Host was created despite discovery error
    assert "fragile-host" in fake._hosts
    # Error is recorded in the response, not raised
    assert result["discovery"]["started"] is False
```

---

## Integration Tests

Integration tests live in `tests/integration/` and are marked `@pytest.mark.integration`. Tests against real external APIs skip automatically when `.env.test` is not configured:

```python
@pytest.fixture(scope="module")
def real_nautobot_service(test_nautobot_configured):
    if not test_nautobot_configured:
        pytest.skip("Test Nautobot not configured. Set up .env.test.")
    ...
```

Running options:

```bash
# Unit only (default, CI)
pytest -m unit

# Integration only (requires .env.test)
pytest -m "integration and nautobot"

# Skip integration
pytest -m "not integration"
```

---

## Running the Test Suite

```bash
cd backend

# All tests
python -m pytest tests/ -v

# CheckMK unit tests only
python -m pytest tests/unit/services/test_checkmk_*.py -v -m "unit"

# Single file
python -m pytest tests/unit/services/test_checkmk_host_service.py -v

# Single test
python -m pytest tests/unit/services/test_checkmk_host_service.py::test_create_host_success -v

# With coverage
python -m pytest tests/ --cov=services --cov-report=term-missing
```

---

## Adding a New Service Test File

Follow this checklist:

1. **File**: `tests/unit/services/test_<domain>_<service_name>.py`
2. **Docstring**: What service is tested; state "All tests run offline"
3. **Patch target**: `_PATCH_TARGET = "<module_path>.CheckMKClientFactory.build_client_from_settings"`
4. **Request helpers**: Module-level `SimpleNamespace` factory functions for each request model
5. **Test groups**: Organize tests by HTTP verb / service method using comments or classes
6. **Coverage per method**:
   - Happy path (success)
   - Not-found / resource-missing path
   - Error simulation path (via `error_on`)
   - Side-effect verification (fake's internal state)
7. **Markers**: All three (`@pytest.mark.asyncio`, `@pytest.mark.unit`, `@pytest.mark.checkmk`)

### Template

```python
"""Unit tests for CheckMK<Name>Service using FakeCheckMKClient.

All tests run offline — no real CheckMK instance required.
"""

from __future__ import annotations

import pytest
from types import SimpleNamespace
from unittest.mock import patch

from services.checkmk.<module> import CheckMK<Name>Service
from services.checkmk.exceptions import CheckMKAPIError
from tests.mocks import FakeCheckMKClient


_PATCH_TARGET = "services.checkmk.<module>.CheckMKClientFactory.build_client_from_settings"


def _some_request(arg: str) -> SimpleNamespace:
    return SimpleNamespace(arg=arg)


# ── <Method name> ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_<method>_success():
    """<One-sentence description of what should happen.>"""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMK<Name>Service()
        result = await svc.<method>(_some_request("router1"))

    assert result["success"] is True
    # assert fake._<store>["router1"] ... (side-effect verification)


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_<method>_not_found_raises():
    """<One-sentence description.>"""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMK<Name>Service()
        with pytest.raises(CheckMKAPIError):
            await svc.<method>(_some_request("nonexistent"))


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_<method>_error_propagates():
    """Simulated API error propagates out of the service."""
    fake = FakeCheckMKClient(error_on={("<client_method>", "*"): 500})
    fake.seed_host("router1", {})

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMK<Name>Service()
        with pytest.raises(CheckMKAPIError):
            await svc.<method>(_some_request("router1"))
```

---

## Common Pitfalls

| Problem | Cause | Fix |
|---|---|---|
| `RuntimeWarning: coroutine was never awaited` | `Mock` used instead of `AsyncMock` for an async method | Replace `Mock()` with `AsyncMock()` |
| Test passes even though code is broken | Service instantiated *before* entering `with patch(...)` | Always instantiate the service *inside* the patch context |
| Flaky test: state leaks between tests | Shared `FakeCheckMKClient` instance across tests | Create a new `FakeCheckMKClient()` in each test function |
| Wrong patch path | Module path does not match where the symbol is *used*, not defined | The path must be `<importing_module>.<ClassName>.<method>` |
| `CheckMKAPIError` not raised | `error_on` key uses wrong method name | Check `call_log` to see the actual method name that was called |
| Deprecation warnings in tests | Test or application code uses deprecated APIs | Replace deprecated APIs instead of suppressing warnings; for UTC timestamps use `datetime.now(timezone.utc)`, not `datetime.utcnow()` |
