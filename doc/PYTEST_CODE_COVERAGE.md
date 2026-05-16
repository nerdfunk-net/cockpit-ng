# pytest Code Coverage Improvement Plan

## Overview

**Current state:** 795 tests, 39.55% coverage (8,733 / 22,081 lines), all passing in ~9 s  
**Target:** ~80% coverage (≈ 17,665 lines)  
**Gap:** ~8,932 lines need new test coverage

Coverage is measured across `services/`, `tasks/`, and `utils/`. Run the baseline any time with:

```bash
cd backend
python -m pytest tests/unit/ --cov=services --cov=tasks --cov=utils --cov-report=term-missing -q
```

---

## What Is Already Covered

The following areas have solid unit-test coverage using `FakeCheckMKClient`, `FakeNautobotService`, and repository mocks (see `doc/TESTING-GUIDE.md`):

| Area | Tested services |
|------|----------------|
| CheckMK host/folder/group | `host_service`, `folder`, `host_group_service` |
| CheckMK lifecycle | `activation_service`, `discovery_service`, `monitoring_service`, `problems_service`, `tag_group_service` |
| CheckMK sync | `normalization/device_normalizer`, `sync/comparison` |
| Nautobot device ops | `devices/creation`, offboarding, resolvers, managers |
| Job scheduling | `job_run_service`, `job_schedule_service`, `job_template_service`, `backup_status_service` |
| Auth | `rbac_service`, `user_service`, `user_management` |
| Inventory | `ansible_inventory_service` |
| Core | `safe_http_errors`, router 5xx sanitization |

---

## Gap Analysis — Files Under 60% Coverage

Sorted by uncovered lines (highest impact first).

| File | Lines | Covered | Uncovered | Category |
|------|-------|---------|-----------|----------|
| `services/settings/git/file_service.py` | 388 | 6% | 364 | Git + filesystem |
| `services/network/tools/baseline.py` | 437 | 5% | 414 | Network/SSH |
| `services/nautobot/imports/prefix_update_service.py` | 351 | 19% | 284 | Nautobot API |
| `services/network/scanning/prefix_scan_service.py` | 288 | 5% | 275 | Network scan |
| `tasks/update_ip_addresses_from_csv_task.py` | 268 | 6% | 252 | Celery task |
| `services/network/automation/netmiko.py` | 266 | 8% | 244 | SSH/netmiko |
| `tasks/execution/backup_executor.py` | 221 | 3% | 215 | Celery exec |
| `services/settings/git/operations.py` | 208 | 0% | 208 | Git |
| `services/nautobot/onboarding/onboarding_service.py` | 226 | 8% | 209 | Nautobot API |
| `tasks/backup_tasks.py` | 221 | 7% | 206 | Celery task |
| `services/templates/template_service.py` | 210 | 0% | 210 | Jinja/DB |
| `services/templates/render_orchestrator.py` | 191 | 0% | 191 | Templates |
| `tasks/execution/command_executor.py` | 189 | 2% | 185 | Celery exec |
| `services/nautobot/devices/update.py` | 188 | 7% | 175 | Nautobot API |
| `tasks/execution/client_data_executor.py` | 206 | 6% | 193 | Celery exec |
| `services/settings/git/cache.py` | 154 | 0% | 154 | Git cache |
| `services/settings/credentials_service.py` | 189 | 19% | 154 | Encryption+DB |
| `tasks/execution/sync_executor.py` | 161 | 6% | 152 | Celery exec |
| `services/nautobot/devices/query.py` | 185 | 18% | 152 | Nautobot GQL |
| `tasks/import_devices_task.py` | 145 | 0% | 145 | Celery task |
| `services/network/scanning/network_scan.py` | 173 | 26% | 128 | Network scan |
| `services/settings/git/auth.py` | 116 | 14% | 100 | Git auth |
| `services/nautobot/imports/csv_import_service.py` | 346 | 67% | 115 | Nautobot API |
| `services/settings/git/service.py` | 246 | 21% | 195 | Git |
| `tasks/periodic_tasks.py` | 224 | 52% | 108 | Celery periodic |
| `tasks/export_devices_task.py` | 127 | 13% | 110 | Celery task |
| `services/settings/git/connection.py` | 78 | 0% | 78 | Git |
| `services/settings/git/repository_service.py` | 95 | 20% | 76 | Pure CRUD |
| `services/nautobot/managers/vm_manager.py` | 87 | 13% | 76 | Nautobot API |
| `services/network/scanning/service.py` | 146 | 16% | 122 | Network |
| `services/settings/git/diff.py` | 88 | 0% | 88 | Git |
| `tasks/execution/set_primary_ip_executor.py` | 155 | 8% | 143 | Celery exec |
| `tasks/bulk_onboard_task.py` | 81 | 7% | 75 | Celery task |
| `services/network/snapshots/comparison_service.py` | 82 | 13% | 71 | Network/DB |
| `services/nautobot/offboarding/service.py` | 179 | 65% | 62 | Nautobot API |
| `utils/cmk_site_utils.py` | 125 | 10% | 112 | Pure logic |
| `services/nautobot/resolvers/cluster_resolver.py` | 51 | 18% | 42 | Nautobot GQL |
| `services/network/snapshots/execution_service.py` | 199 | 11% | 177 | Network/DB |
| `services/network/compliance/check.py` | 104 | 21% | 82 | Compliance |
| `utils/cmk_folder_utils.py` | 110 | 17% | 91 | Pure logic |
| `services/templates/import_service.py` | 97 | 0% | 97 | Templates |
| `services/templates/scan_service.py` | 33 | 0% | 33 | Templates |
| `utils/inventory_converter.py` | 70 | 0% | 70 | Pure logic |
| `utils/path_template.py` | 83 | 0% | 83 | Pure logic |
| `services/audit/audit_log_service.py` | unknown | ~0% | ~30 | Thin wrapper |
| `services/auth/login_recording_service.py` | unknown | ~0% | ~40 | Thin wrapper |
| `services/clients/client_data_service.py` | unknown | ~0% | ~50 | Thin wrapper |
| `services/settings/checkmk_service.py` | 33 | 36% | 21 | CRUD/DB |
| `services/settings/nautobot_service.py` | 57 | 35% | 37 | CRUD/DB |
| `services/settings/cache_settings_service.py` | 35 | 40% | 21 | CRUD/DB |
| `services/settings/agents_service.py` | 37 | 32% | 25 | CRUD/DB |
| `services/settings/system_service.py` | 39 | 23% | 30 | CRUD/DB |
| `services/checkmk/client/_connection_service.py` | ~80 | ~0% | ~80 | CheckMK+cache |

---

## Phased Roadmap

The phases are ordered from lowest to highest implementation effort. Each phase lists target files, the test pattern to use, and the estimated coverage gain.

---

### Phase 1 — Pure Utility Functions (~450 lines, no mocking) ✅ DONE

These are standalone functions with no external dependencies. Tests are plain `assert fn(input) == expected`.

**Target files:**

| File | Uncovered | What to test |
|------|-----------|-------------|
| `utils/cmk_folder_utils.py` | 91 | Path conversions (slash↔tilde), folder splitting, parent extraction |
| `utils/cmk_site_utils.py` | 112 | Site URL parsing, site name extraction, URL validation |
| `utils/inventory_converter.py` | 70 | Device-to-inventory-format transformations |
| `utils/inventory_resolver.py` | 27 | Inventory lookup/resolve helpers |
| `utils/path_template.py` | 83 | Jinja-style path template rendering |
| `utils/nautobot_helpers.py` | 14 | Nautobot field normalization helpers |
| `utils/audit_logger.py` | 31 | Log entry construction, field formatting |
| `utils/task_progress.py` | 13 | Progress percentage calculation |
| `tasks/utils/condition_helpers.py` | 5 | Condition evaluation helpers |
| `tasks/utils/device_helpers.py` | 25 | Device lookup/format helpers |

**Test location:** `tests/unit/utils/test_<module>.py`

**Pattern:**
```python
# tests/unit/utils/test_cmk_folder_utils.py
import pytest
from utils.cmk_folder_utils import slash_to_tilde, split_checkmk_folder_path

@pytest.mark.unit
def test_slash_to_tilde_converts_root():
    assert slash_to_tilde("/") == "~"

@pytest.mark.unit
def test_slash_to_tilde_converts_nested():
    assert slash_to_tilde("/dc1/access") == "~dc1~access"

@pytest.mark.unit
def test_split_checkmk_folder_path_empty():
    assert split_checkmk_folder_path("") == []
```

**Estimated gain:** ~400–470 lines covered

---

### Phase 2 — Thin CRUD Services (DI injection, ~400 lines) ✅ DONE

These services accept optional repository arguments, making them trivial to test with `MagicMock`.

**Target files:**

| File | Uncovered | DI pattern |
|------|-----------|------------|
| `services/audit/audit_log_service.py` | ~30 | `AuditLogService(repository=mock)` |
| `services/auth/login_recording_service.py` | ~40 | `LoginRecordingService(user_repository=mock, audit_repository=mock)` |
| `services/clients/client_data_service.py` | ~50 | `ClientDataService(repository=mock)` |
| `services/settings/checkmk_service.py` | 21 | patch `CheckMKSettingRepository` |
| `services/settings/nautobot_service.py` | 37 | patch `NautobotSettingRepository` |
| `services/settings/git/repository_service.py` | 76 | patch `GitRepositoryRepository` |
| `services/settings/cache_settings_service.py` | 21 | patch internal repo |
| `services/settings/agents_service.py` | 25 | patch internal repo |
| `services/settings/system_service.py` | 30 | patch internal repo |

**Test location:** `tests/unit/services/test_<service>.py`

**Pattern:**
```python
# tests/unit/services/test_audit_log_service.py
import pytest
from unittest.mock import MagicMock
from services.audit.audit_log_service import AuditLogService

@pytest.mark.unit
def test_log_event_delegates_to_repository():
    """log_event passes kwargs through to repository.create_log."""
    mock_repo = MagicMock()
    svc = AuditLogService(repository=mock_repo)
    svc.log_event(action="login", username="admin")
    mock_repo.create_log.assert_called_once_with(action="login", username="admin")

@pytest.mark.unit
def test_log_event_returns_repository_result():
    """Return value from repository is forwarded unchanged."""
    mock_repo = MagicMock()
    mock_repo.create_log.return_value = "audit-entry"
    svc = AuditLogService(repository=mock_repo)
    result = svc.log_event(action="delete")
    assert result == "audit-entry"
```

**Estimated gain:** ~350–420 lines covered

---

### Phase 3 — CheckMK Connection Service + Config Service (~250 lines) ✅ DONE

**Target files:**
- `services/checkmk/client/_connection_service.py` (~80 uncovered)
- `services/checkmk/config.py` (~40 uncovered)

**Test location:** `tests/unit/services/test_checkmk_connection_service.py`, `test_checkmk_config_service.py`

**Patch target (connection service):**
```python
_PATCH_TARGET = "services.checkmk.client._connection_service.CheckMKClientFactory.build_client_from_settings"
```

**Pattern for connection service:**
```python
@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_test_connection_from_settings_success():
    """Successful ping returns connected=True."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKConnectionService()
        result = await svc.test_connection_from_settings()

    assert result["connected"] is True

@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_stats_returns_host_count():
    """get_stats returns a dict with host_count key."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})
    fake.seed_host("switch1", {})
    mock_cache = AsyncMock()
    mock_cache.get.return_value = None  # cache miss

    with patch(_PATCH_TARGET, return_value=fake):
        svc = CheckMKConnectionService()
        result = await svc.get_stats(mock_cache)

    assert result["host_count"] == 2
```

**Pattern for config service (file mocking):**
```python
from unittest.mock import mock_open, patch
import yaml

_SAMPLE_CONFIG = {"default_site": "prod", "comparison_keys": ["folder", "attributes"]}

@pytest.mark.unit
@pytest.mark.checkmk
def test_load_checkmk_config_parses_yaml():
    """load_checkmk_config returns parsed YAML dict."""
    with patch("builtins.open", mock_open(read_data=yaml.dump(_SAMPLE_CONFIG))):
        svc = ConfigService()
        cfg = svc.load_checkmk_config()
    assert cfg["default_site"] == "prod"

@pytest.mark.unit
@pytest.mark.checkmk
def test_get_comparison_keys_returns_configured_list():
    with patch("builtins.open", mock_open(read_data=yaml.dump(_SAMPLE_CONFIG))):
        svc = ConfigService()
        _ = svc.load_checkmk_config()
    assert svc.get_comparison_keys() == ["folder", "attributes"]
```

**Estimated gain:** ~200–260 lines covered

---

### Phase 4 — Nautobot Services (FakeNautobotService / AsyncMock, ~1000 lines)

**Target files:**

| File | Uncovered | Approach |
|------|-----------|----------|
| `services/nautobot/devices/query.py` | 152 | `AsyncMock` with `graphql_query.return_value` |
| `services/nautobot/devices/update.py` | 175 | `FakeNautobotService` for multi-call consistency |
| `services/nautobot/onboarding/onboarding_service.py` | 209 | `FakeNautobotService` + mock device data |
| `services/nautobot/imports/prefix_update_service.py` | 284 | `AsyncMock` for REST calls |
| `services/nautobot/metadata_service.py` | 21 | `AsyncMock` |
| `services/nautobot/managers/vm_manager.py` | 76 | `FakeNautobotService` |
| `services/nautobot/resolvers/cluster_resolver.py` | 42 | `FakeNautobotService` |
| `services/nautobot/offboarding/service.py` | 62 | existing `FakeNautobotService` |

**Test location:** `tests/unit/services/test_nautobot_<name>.py`

**Patch target pattern:**
```python
_PATCH_NAUTOBOT = "service_factory.build_nautobot_service"
```

**Pattern:**
```python
from unittest.mock import AsyncMock, patch
from tests.mocks import FakeNautobotService, STATUS_ACTIVE_ID

@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_query_devices_returns_all():
    """GraphQL device query returns devices from the response."""
    mock_nautobot = AsyncMock()
    mock_nautobot.graphql_query.return_value = {
        "data": {
            "devices": [{"id": "abc", "name": "router1"}, {"id": "def", "name": "switch1"}]
        }
    }

    with patch(_PATCH_NAUTOBOT, return_value=mock_nautobot):
        svc = DeviceQueryService()
        result = await svc.get_all_devices()

    assert len(result) == 2
    assert result[0]["name"] == "router1"
```

**Estimated gain:** ~800–1100 lines covered

---

### Phase 5 — Template Services (~500 lines)

**Target files:**

| File | Uncovered | Dependencies to mock |
|------|-----------|---------------------|
| `services/templates/template_service.py` | 210 | DB repo + Jinja `Environment` |
| `services/templates/render_orchestrator.py` | 191 | `template_service`, device data |
| `services/templates/import_service.py` | 97 | `Path.glob()`, `open()`, DB repo |
| `services/templates/scan_service.py` | 33 | `Path.glob()`, filesystem |

**Test location:** `tests/unit/services/test_template_service.py`, `test_template_render_orchestrator.py`

**Pattern:**
```python
from unittest.mock import MagicMock, patch, mock_open
from services.templates.template_service import TemplateService

@pytest.mark.unit
def test_render_template_with_context():
    """Template variables are substituted correctly."""
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = {
        "id": 1,
        "name": "ssh_config",
        "content": "hostname {{ hostname }}\nip {{ ip_address }}",
    }
    svc = TemplateService(repository=mock_repo)
    rendered = svc.render(template_id=1, context={"hostname": "r1", "ip_address": "10.0.0.1"})
    assert "hostname r1" in rendered
    assert "ip 10.0.0.1" in rendered

@pytest.mark.unit
def test_scan_service_finds_template_files(tmp_path):
    """scan discovers .j2 files in the template directory."""
    (tmp_path / "router.j2").write_text("interface {{ name }}")
    (tmp_path / "switch.j2").write_text("vlan {{ id }}")

    from services.templates.scan_service import TemplateScanService
    svc = TemplateScanService(template_dir=tmp_path)
    files = svc.scan()
    assert len(files) == 2
```

**Estimated gain:** ~420–510 lines covered

---

### Phase 6 — Celery Tasks (call function directly, ~1200 lines)

Celery task functions are regular Python functions decorated with `@app.task`. Call them directly without a broker; mock the service calls they make.

**Target files:**

| File | Uncovered | Approach |
|------|-----------|----------|
| `tasks/backup_tasks.py` | 206 | Mock `BackupService`, call task directly |
| `tasks/execution/backup_executor.py` | 215 | Mock `NetmikoService`, assert commands sent |
| `tasks/execution/command_executor.py` | 185 | Mock `NetmikoService`, assert output stored |
| `tasks/execution/sync_executor.py` | 152 | Mock `NB2CMKSyncService`, assert state updated |
| `tasks/execution/client_data_executor.py` | 193 | Mock `ClientDataService` |
| `tasks/import_devices_task.py` | 145 | Mock `NautobotService` |
| `tasks/bulk_onboard_task.py` | 75 | Mock `onboarding_service` |
| `tasks/export_devices_task.py` | 110 | Mock `DeviceQueryService`, assert file written |
| `tasks/update_ip_addresses_from_csv_task.py` | 252 | Mock `IPAddressService` |
| `tasks/periodic_tasks.py` | 108 | Mock individual sub-task calls |

**Test location:** `tests/unit/tasks/test_<task>.py`

**Pattern:**
```python
# tests/unit/tasks/test_backup_tasks.py
import pytest
from unittest.mock import patch, MagicMock
from tasks.backup_tasks import run_backup_job

_PATCH_BACKUP_SVC = "tasks.backup_tasks.BackupService"
_PATCH_JOB_RUN = "tasks.backup_tasks.job_run_service"

@pytest.mark.unit
def test_run_backup_job_calls_service_for_each_device():
    """run_backup_job invokes BackupService once per device in the job."""
    mock_svc = MagicMock()
    mock_svc.backup_devices.return_value = {"succeeded": 2, "failed": 0}

    with patch(_PATCH_BACKUP_SVC, return_value=mock_svc):
        result = run_backup_job(job_id=1, device_ids=[10, 11])

    mock_svc.backup_devices.assert_called_once()
    assert result["succeeded"] == 2

@pytest.mark.unit
def test_run_backup_job_records_failure_without_raising():
    """Service failure is recorded in the job run, not re-raised."""
    mock_svc = MagicMock()
    mock_svc.backup_devices.side_effect = RuntimeError("connection timeout")
    mock_run = MagicMock()

    with patch(_PATCH_BACKUP_SVC, return_value=mock_svc), \
         patch(_PATCH_JOB_RUN, mock_run):
        result = run_backup_job(job_id=1, device_ids=[10])

    assert result["failed"] > 0
    mock_run.mark_failed.assert_called_once()
```

**Estimated gain:** ~1000–1300 lines covered

---

### Phase 7 — Git Services (mock GitPython, ~900 lines)

**Target files:**

| File | Uncovered | Dependencies to mock |
|------|-----------|---------------------|
| `services/settings/git/service.py` | 195 | `git.Repo`, DB repo |
| `services/settings/git/file_service.py` | 364 | `git.Repo`, `Path`, `open()` |
| `services/settings/git/operations.py` | 208 | `git.Repo` |
| `services/settings/git/cache.py` | 154 | `git.Repo`, Redis cache |
| `services/settings/git/auth.py` | 100 | `git.Repo`, SSH key files |
| `services/settings/git/connection.py` | 78 | `git.Repo.clone_from` |
| `services/settings/git/diff.py` | 88 | `git.Repo`, diff objects |

**Test location:** `tests/unit/services/test_git_service.py`, `test_git_file_service.py`, etc.

**Pattern — use `tmp_path` for real git repos (preferred) or mock `git.Repo`:**
```python
import git
import pytest
from services.settings.git.service import GitService

@pytest.mark.unit
def test_list_branches_returns_branch_names(tmp_path):
    """list_branches returns all branch names from the local clone."""
    # Init a real git repo — no network, instant
    repo = git.Repo.init(tmp_path)
    (tmp_path / "README.md").write_text("init")
    repo.index.add(["README.md"])
    repo.index.commit("init")
    repo.create_head("feature/x")

    svc = GitService(repo_path=str(tmp_path))
    branches = svc.list_branches()
    assert "feature/x" in branches

@pytest.mark.unit
def test_get_diff_between_commits(tmp_path):
    """get_diff returns changed files between two commits."""
    repo = git.Repo.init(tmp_path)
    (tmp_path / "a.txt").write_text("v1")
    repo.index.add(["a.txt"])
    c1 = repo.index.commit("first")
    (tmp_path / "a.txt").write_text("v2")
    repo.index.add(["a.txt"])
    c2 = repo.index.commit("second")

    svc = GitService(repo_path=str(tmp_path))
    diff = svc.get_diff(c1.hexsha, c2.hexsha)
    assert "a.txt" in diff
```

For network-touching operations (clone, push, pull), mock `git.Repo.clone_from`:
```python
from unittest.mock import patch, MagicMock

@pytest.mark.unit
def test_clone_repository_calls_git_clone():
    mock_repo = MagicMock()
    with patch("git.Repo.clone_from", return_value=mock_repo) as mock_clone:
        svc = GitConnectionService()
        svc.clone("https://git.example.com/repo.git", "/tmp/target")
    mock_clone.assert_called_once_with("https://git.example.com/repo.git", "/tmp/target")
```

**Estimated gain:** ~700–950 lines covered

---

### Phase 8 — Network Services (mock SSH/netmiko clients, ~500 lines)

**Target files:**

| File | Uncovered | Dependencies to mock |
|------|-----------|---------------------|
| `services/network/configs/backup_service.py` | 51 | `ConnectHandler` / `netmiko` |
| `services/network/snapshots/execution_service.py` | 177 | `ConnectHandler`, DB repo |
| `services/network/snapshots/comparison_service.py` | 71 | DB repos, diff logic |
| `services/network/snapshots/template_service.py` | 34 | DB repo, Jinja |
| `services/network/compliance/check.py` | 82 | `ConnectHandler`, regex |

**Test location:** `tests/unit/services/test_network_backup_service.py`, etc.

**Pattern — mock netmiko `ConnectHandler`:**
```python
from unittest.mock import patch, MagicMock
import pytest
from services.network.configs.backup_service import ConfigBackupService

_PATCH_NETMIKO = "services.network.configs.backup_service.ConnectHandler"

@pytest.mark.unit
def test_backup_device_sends_show_run():
    """backup_device connects via netmiko and runs 'show running-config'."""
    mock_conn = MagicMock()
    mock_conn.__enter__ = lambda s: mock_conn
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.send_command.return_value = "hostname router1\ninterface Gi0/0"

    with patch(_PATCH_NETMIKO, return_value=mock_conn):
        svc = ConfigBackupService()
        result = svc.backup_device(
            hostname="router1", ip="10.0.0.1",
            username="admin", password="secret",
        )

    mock_conn.send_command.assert_called_with("show running-config")
    assert "hostname router1" in result

@pytest.mark.unit
def test_backup_device_connection_failure_raises():
    """Netmiko connection error propagates as a BackupError."""
    with patch(_PATCH_NETMIKO, side_effect=Exception("SSH timeout")):
        svc = ConfigBackupService()
        with pytest.raises(Exception, match="SSH timeout"):
            svc.backup_device(hostname="dead-host", ip="10.0.0.2",
                              username="admin", password="secret")
```

**Skip pure I/O in network scanning authenticators** — `authenticators/ssh.py`, `authenticators/netmiko.py`, and `authenticators/napalm.py` are thin wrappers that call real connection libraries. Cover their factory/validation logic but leave live-connection paths for integration tests.

**Estimated gain:** ~400–550 lines covered

---

## Quick Wins — Top 10 Easiest Files to Test

Start here for immediate gains with minimal effort:

| Priority | File | Uncovered | Effort | Test pattern |
|----------|------|-----------|--------|-------------|
| 1 | `utils/cmk_folder_utils.py` | 91 | Trivial | `assert fn(x) == y` |
| 2 | `utils/cmk_site_utils.py` | 112 | Trivial | `assert fn(x) == y` |
| 3 | `services/audit/audit_log_service.py` | ~30 | Trivial | `MagicMock` repo |
| 4 | `services/auth/login_recording_service.py` | ~40 | Easy | `MagicMock` repos |
| 5 | `services/clients/client_data_service.py` | ~50 | Easy | `MagicMock` repo |
| 6 | `utils/path_template.py` | 83 | Easy | `assert render(tmpl, ctx) == expected` |
| 7 | `utils/inventory_converter.py` | 70 | Easy | `assert convert(data) == expected` |
| 8 | `services/settings/git/repository_service.py` | 76 | Easy | patch `GitRepositoryRepository` |
| 9 | `services/settings/checkmk_service.py` | 21 | Easy | patch `CheckMKSettingRepository` |
| 10 | `services/settings/nautobot_service.py` | 37 | Easy | patch `NautobotSettingRepository` |

---

## Progress Checkpoints

Run after completing each phase to track coverage progress:

```bash
cd backend

# Quick summary after each phase
python -m pytest tests/unit/ --cov=services --cov=tasks --cov=utils -q 2>&1 | tail -5

# Detailed breakdown for a specific area
python -m pytest tests/unit/ --cov=utils --cov-report=term-missing -q

# Single module
python -m pytest tests/unit/utils/test_cmk_folder_utils.py -v

# Run only new tests fast
python -m pytest tests/unit/ -k "test_cmk_folder or test_audit or test_git" -v
```

**Expected coverage milestones:**

| After Phase | Estimated Coverage | Lines Gained |
|-------------|-------------------|-------------|
| Baseline | 39.6% | — |
| Phase 1 (utils) | ~41–43% | +450 |
| Phase 2 (CRUD services) | ~43–45% | +400 |
| Phase 3 (CheckMK config/conn) | ~44–46% | +250 |
| Phase 4 (Nautobot services) | ~48–51% | +1000 |
| Phase 5 (Templates) | ~50–54% | +500 |
| Phase 6 (Celery tasks) | ~56–60% | +1200 |
| Phase 7 (Git services) | ~60–65% | +900 |
| Phase 8 (Network services) | ~63–68% | +500 |

Reaching exactly 80% requires either completing all 8 phases with high test coverage or adding integration tests (marked `@pytest.mark.integration`) for the hardest paths — particularly `services/network/scanning/prefix_scan_service.py`, `services/network/tools/baseline.py`, and `services/network/automation/netmiko.py`, which together account for 1,000+ uncovered lines of network-I/O-heavy code.

---

## Adding New Test Files — Checklist

Following the conventions in `doc/TESTING-GUIDE.md`:

1. **File location**: `tests/unit/services/test_<domain>_<service>.py` or `tests/unit/utils/test_<module>.py`
2. **Markers**: all three — `@pytest.mark.asyncio` (async only), `@pytest.mark.unit`, domain marker (`@pytest.mark.checkmk` / `@pytest.mark.nautobot`)
3. **Fake choice**:
   - CheckMK client → `FakeCheckMKClient` from `tests.mocks`
   - Nautobot service → `FakeNautobotService` or `AsyncMock`
   - DB repo → `MagicMock()` passed directly
   - Filesystem → `tmp_path` fixture (pytest built-in)
   - Git repo → `git.Repo.init(tmp_path)` or `patch("git.Repo")`
   - SSH/netmiko → `patch("...ConnectHandler")`
4. **Service instantiation**: always inside `with patch(...)` block
5. **Coverage per method**: happy path + not-found + error simulation
6. **No `@pytest.mark.asyncio` missing**: async tests in classes need it on the method

---

## Running with Coverage Report

```bash
cd backend

# Full HTML report (open htmlcov/index.html)
python -m pytest tests/unit/ \
  --cov=services --cov=tasks --cov=utils \
  --cov-report=term-missing \
  --cov-report=html \
  -q

# JSON for tooling
python -m pytest tests/unit/ \
  --cov=services --cov=tasks --cov=utils \
  --cov-report=json \
  -q

# Unit tests only (fastest)
python -m pytest tests/unit/ -m unit -q
```
