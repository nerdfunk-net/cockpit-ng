# Refactoring Step 3 — Service Extraction

**Date:** 2026-05-09  
**Scope:** Priority 3 items from `doc/AUDIT_REPORT.md`  
**Risk level:** Medium — business logic moves, task signatures unchanged, no API surface changes  
**Estimated effort:** 3–5 days per sub-task  
**Depends on:** Step 1 complete (crypto + normalization); Step 2 can be parallel

The goal is to slim oversized files by moving business logic into dedicated service classes.
After each sub-task the caller becomes a thin delegator (20–80 lines), the new service
is independently testable, and the file that was extracted from drops below 800 lines.

---

## Overview

| Sub-task | Source File (lines) | Extract To | Target Size |
|---|---|---|---|
| 3a | `routers/settings/git/files.py` (1002) | `services/settings/git/file_service.py` | router ~200 lines |
| 3b | `tasks/scan_prefixes_task.py` (814) | `services/network/scanning/prefix_scan_service.py` | task ~50 lines |
| 3c | `tasks/import_or_update_from_csv_task.py` (992) | `services/nautobot/import/csv_import_service.py` | task ~80 lines |
| 3d | `tasks/update_ip_prefixes_from_csv_task.py` (961) | `services/nautobot/import/prefix_update_service.py` | task ~80 lines |
| 3e | `tasks/onboard_device_task.py` (775) | `services/nautobot/onboarding/onboarding_service.py` | task ~50 lines |
| 3f | `services/agents/deployment_service.py` (918) | Sub-methods within same file | ~400 lines (no new file) |

Sub-tasks 3a, 3b, 3c, 3d, and 3e are **fully independent** and can be executed in parallel.  
Sub-task 3f is also independent — it never touches the files above.

---

## Sub-task 3a — Extract Git File Service

**Source:** `backend/routers/settings/git/files.py` (1002 lines, 10 endpoints)  
**Target:** new `backend/services/settings/git/file_service.py`

### Problem

Every endpoint in `files.py` contains inline business logic: filesystem traversal,
git log iteration, CSV parsing, YAML parsing, directory tree building. The router
knows about `os.walk`, `fnmatch`, `csv.reader`, `yaml.safe_load`, and git object
internals — none of which belong in the HTTP layer.

### Endpoint-to-Method Mapping

| Endpoint | Router lines | Extracted method |
|---|---|---|
| `search_repository_files` | ~27–147 | `GitFileService.search_files(repo_id, query, limit)` |
| `get_files` | ~150–199 | `GitFileService.get_commit_files(repo_id, commit_hash, file_path)` |
| `get_file_history` | ~202–256 | `GitFileService.get_file_last_commit(repo_id, file_path)` |
| `get_file_complete_history` | ~259–440 | `GitFileService.get_file_history(repo_id, file_path, from_commit, cache_service)` |
| `get_file_content` | ~443–550 | `GitFileService.get_file_content(repo_id, file_path, commit_hash)` |
| `get_file_content_parsed` | ~553–660 | `GitFileService.get_file_content_parsed(repo_id, file_path, commit_hash)` |
| `get_directory_tree` | ~663–746 | `GitFileService.get_directory_tree(repo_id, commit_hash)` |
| `get_directory_files` | ~749–834 | `GitFileService.get_directory_files(repo_id, commit_hash, directory_path)` |
| `list_csv_files` | ~837–928 | `GitFileService.list_csv_files(repo_id)` |
| `get_csv_headers` | ~931–1002 | `GitFileService.get_csv_headers(repo_id, file_path)` |

### New File: `services/settings/git/file_service.py`

```python
"""Git file read operations — listing, search, history, and content retrieval."""

from __future__ import annotations

import csv
import fnmatch
import io
import logging
import os
from typing import Any, Dict, List, Optional

import yaml
from git import Repo

from services.settings.git.paths import repo_path as git_repo_path
from services.settings.git.shared_utils import get_git_repo_by_id, git_repo_manager

logger = logging.getLogger(__name__)


class GitFileService:
    """Read-only operations on files within a managed Git repository."""

    def search_files(
        self,
        repo_id: int,
        query: str = "",
        limit: int = 50,
    ) -> Dict[str, Any]:
        """Scan directory, filter by query, sort by relevance, paginate."""
        ...

    def get_commit_files(
        self,
        repo_id: int,
        commit_hash: str,
        file_path: Optional[str] = None,
    ) -> Any:
        """List files in a commit, or return single file content when file_path given."""
        ...

    def get_file_last_commit(
        self,
        repo_id: int,
        file_path: str,
    ) -> Dict[str, Any]:
        """Return the most recent commit metadata for a file."""
        ...

    def get_file_history(
        self,
        repo_id: int,
        file_path: str,
        from_commit: Optional[str] = None,
        cache_service=None,
        cache_enabled: bool = True,
    ) -> Dict[str, Any]:
        """Return full commit chain for a file back to its creation."""
        ...

    def get_file_content(
        self,
        repo_id: int,
        file_path: str,
        commit_hash: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Return raw file content at HEAD or a specific commit."""
        ...

    def get_file_content_parsed(
        self,
        repo_id: int,
        file_path: str,
        commit_hash: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Return file content and its parsed representation (YAML/CSV/text)."""
        ...

    def get_directory_tree(
        self,
        repo_id: int,
        commit_hash: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Return nested directory tree for a commit."""
        ...

    def get_directory_files(
        self,
        repo_id: int,
        commit_hash: Optional[str] = None,
        directory_path: str = "",
    ) -> Dict[str, Any]:
        """Return flat list of files in a specific directory."""
        ...

    def list_csv_files(self, repo_id: int) -> Dict[str, Any]:
        """Return all CSV files found in a repository's working directory."""
        ...

    def get_csv_headers(self, repo_id: int, file_path: str) -> Dict[str, Any]:
        """Return the header row of a CSV file from the working directory."""
        ...
```

### Updated Router Pattern

After extraction each router function becomes a thin 10–15 line delegate:

```python
# services/settings/git/file_service.py is a stateless helper class
_git_file_service = GitFileService()

@router.get("/files/search")
async def search_repository_files(
    repo_id: int,
    query: str = "",
    limit: int = 50,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
):
    return _git_file_service.search_files(repo_id, query, limit)
```

The cache dependency used in `get_file_complete_history` should be passed through
from the router parameter rather than imported inside the service:

```python
@router.get("/files/{file_path:path}/complete-history")
async def get_file_complete_history(
    repo_id: int,
    file_path: str,
    from_commit: str = None,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
    cache_service=Depends(get_cache_service),
):
    return _git_file_service.get_file_history(
        repo_id, file_path, from_commit, cache_service
    )
```

The `from settings_manager import settings_manager` lazy import inside
`get_file_complete_history` (line 269) belongs inside `get_file_history()` in the
service, or the cache-enabled flag should be resolved in the router and passed in.
Prefer resolving it in the router: pass `cache_enabled: bool` rather than importing
`settings_manager` inside the service.

### Verification

```bash
wc -l backend/routers/settings/git/files.py
# Expected: ≤ 200

wc -l backend/services/settings/git/file_service.py
# Expected: ≤ 800

cd backend && python -c "
from services.settings.git.file_service import GitFileService
print('GitFileService importable OK')
"

# No inline business logic remains in the router
# Each router function should be ≤ 15 lines
grep -c "def " backend/routers/settings/git/files.py
# Count router functions — each should have ≤ 15 lines of body
```

---

## Sub-task 3b — Extract Prefix Scan Service

**Source:** `backend/tasks/scan_prefixes_task.py` (814 lines)  
**Target:** new `backend/services/network/scanning/prefix_scan_service.py`

### Problem

`_execute_scan_prefixes()` (lines 349–777) is 429 lines — a complete service
compressed into one private function. It handles job run lifecycle, Nautobot prefix
fetching (GraphQL), CIDR expansion, fping execution, DNS resolution, Nautobot IP and
prefix updates (REST), and sub-task splitting. All of these are distinct
responsibilities.

Helper functions also inline in the task file:
- `_fetch_prefixes_by_custom_field()` (lines 19–65) — GraphQL query
- `_update_ip_in_nautobot()` (lines 68–256) — REST create/update for IP addresses
- `_update_prefix_last_scan()` (lines 259–346) — REST PATCH for prefix custom field

### New File: `services/network/scanning/prefix_scan_service.py`

```python
"""Business logic for scanning IP prefixes discovered via Nautobot custom fields."""

from __future__ import annotations

import asyncio
import ipaddress
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests

import service_factory

logger = logging.getLogger(__name__)


class PrefixScanService:
    """Orchestrates prefix discovery, IP scanning, and Nautobot result updates."""

    def execute(
        self,
        custom_field_name: str,
        custom_field_value: str,
        response_custom_field_name: Optional[str] = None,
        set_reachable_ip_active: bool = True,
        resolve_dns: bool = False,
        ping_count: int = 3,
        timeout_ms: int = 500,
        retries: int = 3,
        interval_ms: int = 10,
        executed_by: str = "unknown",
        task_context=None,
        scan_max_ips: Optional[int] = None,
        explicit_prefixes: Optional[List[str]] = None,
        job_run_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Entry point. Delegates to _run_scan() after job run setup.
        Replaces _execute_scan_prefixes() in the task file.
        """
        ...

    # ── Nautobot I/O ──────────────────────────────────────────────────────────

    def _fetch_prefixes_by_custom_field(
        self,
        custom_field_name: str,
        custom_field_value: str,
    ) -> List[str]:
        """GraphQL query: return list of CIDR strings matching custom field."""
        ...

    def _update_ip_in_nautobot(
        self,
        ip_address: str,
        prefix_cidr: str,
        response_custom_field_name: str,
        dns_name: Optional[str] = None,
        set_active: bool = True,
    ) -> bool:
        """Create or update an IP address record via Nautobot REST API."""
        ...

    def _update_prefix_last_scan(
        self,
        prefix_cidr: str,
        prefix_id: Optional[str] = None,
    ) -> bool:
        """PATCH the last_scan custom field on a prefix."""
        ...

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _split_into_subtasks(
        self,
        cidrs: List[str],
        scan_max_ips: int,
        task_context,
        **kwargs,
    ) -> Dict[str, Any]:
        """Dispatch sub-tasks when total IP count exceeds scan_max_ips."""
        ...

    def _run_scan(
        self,
        cidrs: List[str],
        job_run_id: int,
        task_context,
        **scan_params,
    ) -> Dict[str, Any]:
        """Perform fping, DNS resolution, and Nautobot updates for a set of CIDRs."""
        ...
```

### Updated Task File

```python
"""Scan Prefixes Task for Celery (thin entry point)."""

import job_run_manager
from celery import shared_task
from services.network.scanning.prefix_scan_service import PrefixScanService

_scan_service = PrefixScanService()


@shared_task(bind=True, name="tasks.scan_prefixes")
def scan_prefixes_task(self, custom_field_name, custom_field_value, **kwargs):
    return _scan_service.execute(
        custom_field_name=custom_field_name,
        custom_field_value=custom_field_value,
        task_context=self,
        **kwargs,
    )
```

> **Note:** `PrefixScanService` uses `import service_factory` and `import job_run_manager`
> at method call time (not class level) to preserve the existing lazy-import pattern
> for Celery worker process safety on macOS. This is intentional — see MEMORY.md
> for the macOS fork() / asyncio issue.

### Verification

```bash
wc -l backend/tasks/scan_prefixes_task.py
# Expected: ≤ 60

wc -l backend/services/network/scanning/prefix_scan_service.py
# Expected: ≤ 600

cd backend && python -c "
from services.network.scanning.prefix_scan_service import PrefixScanService
print('PrefixScanService importable OK')
"
```

---

## Sub-task 3c — Extract CSV Import Service

**Source:** `backend/tasks/import_or_update_from_csv_task.py` (992 lines)  
**Target:** new `backend/services/nautobot/import/csv_import_service.py`

### Problem

The Celery task entry point (`import_or_update_from_csv_task`) is already thin — it
immediately calls `_run_csv_import()`. But `_run_csv_import()` is 397 lines, plus
four helper functions totalling ~430 more lines:

| Function | Lines | Responsibility |
|---|---|---|
| `_run_csv_import()` | 104–501 (397 lines) | Full orchestration |
| `_filter_nautobot_nulls()` | ~505–543 | Filter null values from Nautobot objects |
| `ImportContext` dataclass | ~544–558 | Request data container |
| `_process_single_object()` | ~559–714 (155 lines) | Single-row create/update logic |
| `_process_cockpit_rows()` | ~715–844 (129 lines) | Batch processor for cockpit format |
| `_extract_interface_config()` | ~845–901 (56 lines) | Interface field extraction |
| `_apply_column_mapping()` | ~902–992 (90 lines) | CSV column → Nautobot field mapping |

### New File: `services/nautobot/import/csv_import_service.py`

Create `backend/services/nautobot/import/` as a new sub-package with
`__init__.py`.

```python
"""Business logic for importing and updating Nautobot objects from CSV files."""

from __future__ import annotations

import asyncio
import csv
import fnmatch
import io
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import service_factory
from services.nautobot.devices.import_service import DeviceImportService
from services.nautobot.devices.update import DeviceUpdateService
from services.settings.git.paths import repo_path as git_repo_path
from services.settings.git.shared_utils import git_repo_manager

logger = logging.getLogger(__name__)

# Nautobot REST endpoints per import type
_ENDPOINT_MAP = {
    "devices": "dcim/devices/",
    "ip-prefixes": "ipam/prefixes/",
    "ip-addresses": "ipam/ip-addresses/",
}

# ... move module-level constants here ...


@dataclass
class ImportContext:
    # move from task file verbatim
    ...


class CsvImportService:
    """Imports or updates Nautobot objects from CSV files in a Git repository."""

    def run_import(
        self,
        task_context,
        repo_id: int,
        file_path: str,
        import_type: str,
        primary_key: str,
        update_existing: bool = True,
        delimiter: str = ",",
        quote_char: str = '"',
        column_mapping: dict[str, str | None] | None = None,
        dry_run: bool = False,
        template_id: int | None = None,
        file_filter: str | None = None,
        defaults: dict[str, str] | None = None,
        import_format: str = "generic",
        add_prefixes: bool = False,
        default_prefix_length: str | None = None,
    ) -> dict:
        """Move _run_csv_import() body here verbatim, then refactor."""
        ...

    # ── Private helpers ───────────────────────────────────────────────────────

    def _resolve_files_to_process(
        self,
        repo_dir: str,
        file_path: str,
        file_filter: str | None,
    ) -> list[str]:
        """Expand file_filter glob or return single file_path."""
        ...

    def _process_single_object(
        self,
        ctx: ImportContext,
        row: dict[str, Any],
        nautobot_service,
        device_import_service: DeviceImportService,
        device_update_service: DeviceUpdateService,
    ) -> dict[str, Any]:
        """Move _process_single_object() here verbatim."""
        ...

    def _process_cockpit_rows(
        self,
        ctx: ImportContext,
        rows: list[dict[str, Any]],
        nautobot_service,
        device_import_service: DeviceImportService,
        device_update_service: DeviceUpdateService,
    ) -> dict[str, Any]:
        """Move _process_cockpit_rows() here verbatim."""
        ...

    @staticmethod
    def _extract_interface_config(row: dict[str, Any]) -> dict[str, Any]:
        """Move _extract_interface_config() here verbatim."""
        ...

    @staticmethod
    def _apply_column_mapping(
        row: dict[str, Any],
        col_map: dict[str, str | None],
    ) -> dict[str, Any]:
        """Move _apply_column_mapping() here verbatim."""
        ...

    @staticmethod
    def _filter_nautobot_nulls(obj: dict[str, Any]) -> dict[str, Any]:
        """Move _filter_nautobot_nulls() here verbatim."""
        ...
```

### Updated Task File

```python
"""Celery task for CSV import — thin entry point."""

from celery_app import celery_app
from services.nautobot.import.csv_import_service import CsvImportService

_csv_import_service = CsvImportService()


@celery_app.task(name="tasks.import_or_update_from_csv", bind=True)
def import_or_update_from_csv_task(self, repo_id, file_path, import_type, primary_key, **kwargs):
    return _csv_import_service.run_import(
        task_context=self,
        repo_id=repo_id,
        file_path=file_path,
        import_type=import_type,
        primary_key=primary_key,
        **kwargs,
    )
```

### Verification

```bash
wc -l backend/tasks/import_or_update_from_csv_task.py
# Expected: ≤ 80

wc -l backend/services/nautobot/import/csv_import_service.py
# Expected: ≤ 700

cd backend && python -c "
from services.nautobot.import.csv_import_service import CsvImportService
print('CsvImportService importable OK')
"

# Confirm Celery task name is unchanged (callers use the string name)
grep 'name="tasks.import_or_update_from_csv"' backend/tasks/import_or_update_from_csv_task.py
```

---

## Sub-task 3d — Extract Prefix Update Service

**Source:** `backend/tasks/update_ip_prefixes_from_csv_task.py` (961 lines)  
**Target:** new `backend/services/nautobot/import/prefix_update_service.py`

### Problem

The task entry point calls inline private functions that total ~920 lines of business
logic. Key functions:

| Function | Lines | Responsibility |
|---|---|---|
| `update_ip_prefixes_from_csv_task()` | 37–546 (509 lines) | Monolith: CSV parse + Nautobot update loop |
| `_get_prefix_by_uuid()` | ~550–600 | REST GET by UUID |
| `_find_prefix_by_prefix_and_namespace_graphql()` | ~603–660 | GraphQL lookup |
| `_update_prefix()` | ~663–840 | REST PATCH with field comparison |
| `_prepare_prefix_update_data()` | ~843–905 | Build PATCH payload |
| `_generate_field_comparison()` | ~908–961 | Field diff for logging |

The entry point itself should be ~40 lines that parse CSV options and call the service.

### New File: `services/nautobot/import/prefix_update_service.py`

```python
"""Business logic for updating Nautobot IP prefixes from CSV data."""

from __future__ import annotations

import asyncio
import csv
import io
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import service_factory

logger = logging.getLogger(__name__)


class PrefixUpdateService:
    """Parses CSV content and applies updates to Nautobot IP prefixes."""

    def run_update(
        self,
        task_context,
        csv_content: str,
        csv_options: Optional[Dict[str, Any]] = None,
        dry_run: bool = False,
        ignore_uuid: bool = True,
        tags_mode: str = "replace",
        column_mapping: Optional[Dict[str, str]] = None,
        selected_columns: Optional[list[str]] = None,
    ) -> dict:
        """Move the body of update_ip_prefixes_from_csv_task() here."""
        ...

    # ── Nautobot I/O ──────────────────────────────────────────────────────────

    def _get_prefix_by_uuid(
        self,
        nautobot_service,
        prefix_id: str,
    ) -> Optional[Dict[str, Any]]:
        """GET /api/ipam/prefixes/{id}/ → return prefix dict or None."""
        ...

    def _find_prefix_by_prefix_and_namespace_graphql(
        self,
        nautobot_service,
        prefix: str,
        namespace_name: str,
    ) -> Optional[Dict[str, Any]]:
        """GraphQL lookup: return prefix dict with id, or None."""
        ...

    def _update_prefix(
        self,
        nautobot_service,
        prefix_id: str,
        update_data: Dict[str, Any],
        dry_run: bool,
    ) -> Tuple[bool, str]:
        """PATCH the prefix; return (success, message)."""
        ...

    # ── Payload builders ──────────────────────────────────────────────────────

    @staticmethod
    def _prepare_prefix_update_data(
        row: Dict[str, Any],
        existing_prefix: Dict[str, Any],
        tags_mode: str,
        column_mapping: Optional[Dict[str, str]],
        selected_columns: Optional[list[str]],
    ) -> Dict[str, Any]:
        """Build the PATCH payload from a CSV row and the existing Nautobot object."""
        ...

    @staticmethod
    def _generate_field_comparison(
        existing: Dict[str, Any],
        update_data: Dict[str, Any],
    ) -> str:
        """Return a human-readable diff string for logging."""
        ...
```

### Updated Task File

```python
"""Celery task for CSV prefix update — thin entry point."""

from celery_app import celery_app
from services.nautobot.import.prefix_update_service import PrefixUpdateService

_prefix_update_service = PrefixUpdateService()


@celery_app.task(name="tasks.update_ip_prefixes_from_csv", bind=True)
def update_ip_prefixes_from_csv_task(self, csv_content, **kwargs):
    return _prefix_update_service.run_update(
        task_context=self,
        csv_content=csv_content,
        **kwargs,
    )
```

### Verification

```bash
wc -l backend/tasks/update_ip_prefixes_from_csv_task.py
# Expected: ≤ 80

wc -l backend/services/nautobot/import/prefix_update_service.py
# Expected: ≤ 600

# Confirm Celery task name unchanged
grep 'name="tasks.update_ip_prefixes_from_csv"' backend/tasks/update_ip_prefixes_from_csv_task.py
```

> **Note for 3c and 3d together:** Once both services exist, create
> `backend/services/nautobot/import/__init__.py` that exports both classes.
> This enables future import consolidation without touching callers.

---

## Sub-task 3e — Extract Device Onboarding Service

**Source:** `backend/tasks/onboard_device_task.py` (775 lines)  
**Target:** new `backend/services/nautobot/onboarding/onboarding_service.py`

### Problem

The task entry point (`onboard_device_task`, lines 17–233) is ~216 lines — already
oversized for a Celery entry point. Private functions below it add ~540 more lines:

| Function | Lines | Responsibility |
|---|---|---|
| `_process_single_device()` | 236–404 (168 lines) | Post-onboarding: lookup + tag/CF update + sync |
| `_trigger_nautobot_onboarding()` | 405–462 (57 lines) | POST to Nautobot onboarding job API |
| `_wait_for_job_completion()` | 463–558 (95 lines) | Poll Nautobot until job reaches terminal state |
| `_get_device_id_from_ip()` | ~560–610 | GraphQL: IP → device UUID |
| `_async_get_device_id()` | ~611–640 | Async wrapper for _get_device_id_from_ip |
| `_update_device_tags()` | ~641–680 | PATCH device tags via REST |
| `_update_device_custom_fields()` | ~681–720 | PATCH custom fields via REST |
| `_sync_network_data()` | ~721–775 | Trigger Nautobot sync job |

Pattern reference: `services/nautobot/offboarding/service.py` follows the same domain.

### New File: `services/nautobot/onboarding/onboarding_service.py`

Create `backend/services/nautobot/onboarding/` as a new sub-package with `__init__.py`.

```python
"""Business logic for onboarding devices into Nautobot."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)


class DeviceOnboardingService:
    """Orchestrates Nautobot onboarding API calls and post-onboarding configuration."""

    def onboard(
        self,
        task_instance,
        ip_address: str,
        location_id: str,
        role_id: str,
        namespace_id: str,
        status_id: str,
        interface_status_id: str,
        ip_address_status_id: str,
        prefix_status_id: str,
        secret_groups_id: str,
        platform_id: str,
        port: int,
        timeout: int,
        onboarding_timeout: int = 120,
        sync_options: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        custom_fields: Optional[Dict[str, str]] = None,
        username: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> dict:
        """
        Orchestrate: trigger Nautobot job, wait, post-process each device.
        Moves the entire body of onboard_device_task() here.
        """
        ...

    # ── Nautobot API calls ────────────────────────────────────────────────────

    def _trigger_nautobot_onboarding(
        self,
        ip_list: List[str],
        location_id: str,
        role_id: str,
        namespace_id: str,
        status_id: str,
        interface_status_id: str,
        ip_address_status_id: str,
        prefix_status_id: str,
        secret_groups_id: str,
        platform_id: str,
        port: int,
        timeout: int,
    ) -> Dict[str, Any]:
        """POST to Nautobot onboarding API; return job_id and job_url."""
        ...

    def _wait_for_job_completion(
        self,
        job_id: str,
        timeout: int = 120,
        task_instance=None,
    ) -> Dict[str, Any]:
        """Poll Nautobot job status until terminal state or timeout."""
        ...

    def _get_device_id_from_ip(self, ip_address: str) -> tuple[Optional[str], Optional[str]]:
        """GraphQL lookup: return (device_id, device_name) for an IP address."""
        ...

    def _update_device_tags(
        self,
        device_id: str,
        tags: List[str],
    ) -> bool:
        """PATCH device tag list via Nautobot REST API."""
        ...

    def _update_device_custom_fields(
        self,
        device_id: str,
        custom_fields: Dict[str, str],
    ) -> bool:
        """PATCH device custom fields via Nautobot REST API."""
        ...

    def _sync_network_data(
        self,
        device_id: str,
        sync_options: List[str],
    ) -> Dict[str, Any]:
        """Trigger Nautobot sync job for a device."""
        ...

    # ── Per-device post-processing ────────────────────────────────────────────

    def _process_single_device(
        self,
        task_instance,
        ip_address: str,
        namespace_id: str,
        prefix_status_id: str,
        interface_status_id: str,
        ip_address_status_id: str,
        sync_options: Optional[List[str]],
        tags: Optional[List[str]],
        custom_fields: Optional[Dict[str, str]],
        device_num: int,
        device_count: int,
        username: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> dict:
        """Lookup, update, and sync one device after Nautobot onboarding completes."""
        ...
```

### Updated Task File

```python
"""Celery task for device onboarding — thin entry point."""

from celery import shared_task
from services.nautobot.onboarding.onboarding_service import DeviceOnboardingService

_onboarding_service = DeviceOnboardingService()


@shared_task(bind=True, name="tasks.onboard_device_task")
def onboard_device_task(self, ip_address, location_id, role_id, namespace_id, **kwargs):
    return _onboarding_service.onboard(
        task_instance=self,
        ip_address=ip_address,
        location_id=location_id,
        role_id=role_id,
        namespace_id=namespace_id,
        **kwargs,
    )
```

### Verification

```bash
wc -l backend/tasks/onboard_device_task.py
# Expected: ≤ 60

wc -l backend/services/nautobot/onboarding/onboarding_service.py
# Expected: ≤ 600

cd backend && python -c "
from services.nautobot.onboarding.onboarding_service import DeviceOnboardingService
print('DeviceOnboardingService importable OK')
"

# Confirm task name unchanged (callers bind to this string)
grep 'name="tasks.onboard_device_task"' backend/tasks/onboard_device_task.py
```

---

## Sub-task 3f — Decompose `AgentDeploymentService.deploy()`

**Source:** `backend/services/agents/deployment_service.py` (918 lines)  
**Target:** same file — no new file, only private method extraction

### Problem

`deploy()` (lines 37–398, 362 lines) and `deploy_multi()` (lines 399–762, 364 lines)
are monolithic methods. Both follow the same 8-step workflow:

1. Load agent configuration from `agents_repository`
2. Load Git repository record
3. Render template(s)
4. Clone/open Git repo on disk
5. Write rendered file(s) to working tree
6. Commit and push
7. Activate agent (calls `_activate_agent()` — already extracted, good pattern)
8. Build and return result dict

The file currently has only one extracted helper: `_activate_agent()` (line 763).
All other steps are inlined. `deploy()` and `deploy_multi()` share steps 1, 2, 4, 6,
and 7 but duplicate them rather than sharing a private method.

### Extraction Plan

Extract these private methods into `AgentDeploymentService`:

| New Method | Responsibility | Called By |
|---|---|---|
| `_load_agent_config(agent_id)` | Load agent settings, validate, return agent dict | `deploy()`, `deploy_multi()` |
| `_load_git_repository(agent)` | Load repo record, validate, return repo dict | `deploy()`, `deploy_multi()` |
| `_render_template(template_id, agent, ...)` | Render one template, return rendered string | `deploy()` |
| `_open_or_clone_repo(repo, agent)` | Clone or open the git Repo object on disk | `deploy()`, `deploy_multi()` |
| `_write_file(git_repo, file_path, content)` | Write rendered content to working tree | `deploy()`, `deploy_multi()` |
| `_commit_and_push(git_repo, repo_record, ...)` | Stage, commit, and push changes | `deploy()`, `deploy_multi()` |

`_activate_agent()` already exists — do not change it.

### Signature Examples

```python
def _load_agent_config(self, agent_id: str) -> Dict[str, Any]:
    """Load and validate agent settings; raise ValueError if not found."""
    agents_settings = self.agents_repository.get_settings()
    if not agents_settings or not agents_settings.agents:
        raise ValueError("No agents configured")
    for a in agents_settings.agents:
        if a.get("agent_id") == agent_id:
            return a
    raise ValueError(f"Agent '{agent_id}' not found in agent settings")


def _load_git_repository(self, agent: Dict[str, Any]) -> Dict[str, Any]:
    """Load Git repository record for the agent; raise ValueError if missing."""
    agent_git_repo_id = agent.get("git_repository_id")
    if not agent_git_repo_id:
        raise ValueError(f"No git repository configured for agent '{agent.get('name')}'")
    repo = self.git_repo_repository.get_by_id(agent_git_repo_id)
    if not repo:
        raise ValueError(f"Git repository ID {agent_git_repo_id} not found")
    return repo


async def _render_template(
    self,
    template_id: int,
    agent: Dict[str, Any],
    custom_variables: Optional[Dict[str, Any]],
    path: Optional[str],
    inventory_id: Optional[int],
) -> tuple[str, str]:
    """Render template; return (rendered_content, file_path)."""
    ...


def _open_or_clone_repo(self, repo: Dict[str, Any], agent: Dict[str, Any]) -> "Repo":
    """Clone or open the git repository working directory; return Repo object."""
    ...


def _write_file(
    self,
    git_repo: "Repo",
    file_path: str,
    content: str,
) -> None:
    """Write content to file_path within the repository working tree."""
    ...


def _commit_and_push(
    self,
    git_repo: "Repo",
    repo_record: Dict[str, Any],
    agent_name: str,
    commit_message: str,
) -> Dict[str, Any]:
    """Stage all changes, commit, and push; return commit metadata dict."""
    ...
```

### Updated `deploy()` Structure After Extraction

```python
async def deploy(self, template_id, agent_id, custom_variables=None, path=None,
                 inventory_id=None, activate_after_deploy=True, task_context=None,
                 username="system") -> Dict[str, Any]:
    try:
        self._update_progress(task_context, 0, "Loading agent configuration...")
        agent = self._load_agent_config(agent_id)

        self._update_progress(task_context, 10, "Loading Git repository...")
        repo_record = self._load_git_repository(agent)

        self._update_progress(task_context, 20, "Rendering template...")
        rendered_content, file_path = await self._render_template(
            template_id, agent, custom_variables, path, inventory_id
        )

        self._update_progress(task_context, 40, "Opening Git repository...")
        git_repo = self._open_or_clone_repo(repo_record, agent)

        self._update_progress(task_context, 60, "Writing configuration file...")
        self._write_file(git_repo, file_path, rendered_content)

        self._update_progress(task_context, 70, "Committing and pushing...")
        commit_info = self._commit_and_push(
            git_repo, repo_record, agent.get("name", agent_id),
            f"Deploy {template_id} to {agent_id}"
        )

        activation_result = {}
        if activate_after_deploy:
            activation_result = self._activate_agent(
                agent.get("agent_id"), agent.get("name", agent_id), username, task_context
            )

        return {"success": True, "commit": commit_info, **activation_result}

    except Exception as e:
        logger.error("AGENT DEPLOYMENT FAILED: %s", e, exc_info=True)
        return {"success": False, "error": str(e), "template_id": template_id, "agent_id": agent_id}
```

`deploy_multi()` follows the same structure, sharing `_load_agent_config()`,
`_load_git_repository()`, `_open_or_clone_repo()`, `_commit_and_push()`, and
`_activate_agent()`.

### Verification

```bash
wc -l backend/services/agents/deployment_service.py
# Expected: ≤ 500

# Methods in class (should be 9: deploy, deploy_multi, _load_agent_config,
# _load_git_repository, _render_template, _open_or_clone_repo, _write_file,
# _commit_and_push, _activate_agent)
grep -c "def " backend/services/agents/deployment_service.py
# Expected: 9

# Longest method ≤ 50 lines
awk '/def /{if(prev) print NR-start, prev; start=NR; prev=$0} END{if(prev) print NR-start+1, prev}' \
  backend/services/agents/deployment_service.py | sort -rn | head -5
# Expected: all values ≤ 50
```

---

## Shared Execution Notes

### Moving Code vs. Rewriting

For all sub-tasks the **preferred strategy** is:

1. **Move first** — copy the function body verbatim into the service method. Verify
   with an import check. Only then refactor internals (rename locals, split further).
2. **Don't fix unrelated issues** — if the moved function has a bug, an f-string log,
   or a raw `requests.get`, leave it as-is and track it for a separate pass.
3. **Keep task names unchanged** — Celery task names are bound in the broker. A rename
   requires a migration window. Never change the `name=` decorator string.

### `asyncio.run()` in Celery Tasks (macOS)

Several functions use `asyncio.run()` inside Celery tasks. This is intentional and
works on macOS with `--pool=solo`. When moving these functions into services do NOT
change this pattern — see MEMORY.md for the macOS fork() constraint.

### `job_run_manager` Imports Inside Methods

Tasks and services that call `job_run_manager` must **import it inside the function
body** (lazy import), not at module level. This avoids circular imports in Celery
worker processes. Preserve this pattern when moving code.

---

## Complete Execution Checklist

```
Sub-task 3a: Git File Service
  [ ] Create backend/services/settings/git/file_service.py
  [ ] Move all 10 business logic bodies into GitFileService methods
  [ ] Update each router function to delegate to _git_file_service
  [ ] Verify: wc -l backend/routers/settings/git/files.py → ≤ 200
  [ ] Verify: python -c "from services.settings.git.file_service import GitFileService; print('OK')"

Sub-task 3b: Prefix Scan Service
  [ ] Create backend/services/network/scanning/prefix_scan_service.py
  [ ] Move _execute_scan_prefixes(), _fetch_prefixes_by_custom_field(),
      _update_ip_in_nautobot(), _update_prefix_last_scan() into PrefixScanService
  [ ] Slim scan_prefixes_task.py to thin Celery entry point
  [ ] Verify: wc -l backend/tasks/scan_prefixes_task.py → ≤ 60
  [ ] Verify: python -c "from services.network.scanning.prefix_scan_service import PrefixScanService; print('OK')"

Sub-task 3c: CSV Import Service
  [ ] Create backend/services/nautobot/import/__init__.py
  [ ] Create backend/services/nautobot/import/csv_import_service.py
  [ ] Move ImportContext dataclass and all helper functions into CsvImportService
  [ ] Slim import_or_update_from_csv_task.py to thin Celery entry point
  [ ] Verify: wc -l backend/tasks/import_or_update_from_csv_task.py → ≤ 80
  [ ] Verify: python -c "from services.nautobot.import.csv_import_service import CsvImportService; print('OK')"
  [ ] Verify: task name unchanged: grep 'name="tasks.import_or_update_from_csv"' ...

Sub-task 3d: Prefix Update Service
  [ ] Create backend/services/nautobot/import/prefix_update_service.py
  [ ] Move all private functions into PrefixUpdateService
  [ ] Slim update_ip_prefixes_from_csv_task.py to thin Celery entry point
  [ ] Verify: wc -l backend/tasks/update_ip_prefixes_from_csv_task.py → ≤ 80
  [ ] Verify: python -c "from services.nautobot.import.prefix_update_service import PrefixUpdateService; print('OK')"
  [ ] Verify: task name unchanged: grep 'name="tasks.update_ip_prefixes_from_csv"' ...

Sub-task 3e: Device Onboarding Service
  [ ] Create backend/services/nautobot/onboarding/__init__.py
  [ ] Create backend/services/nautobot/onboarding/onboarding_service.py
  [ ] Move all private functions into DeviceOnboardingService
  [ ] Slim onboard_device_task.py to thin Celery entry point
  [ ] Verify: wc -l backend/tasks/onboard_device_task.py → ≤ 60
  [ ] Verify: python -c "from services.nautobot.onboarding.onboarding_service import DeviceOnboardingService; print('OK')"
  [ ] Verify: task name unchanged: grep 'name="tasks.onboard_device_task"' ...

Sub-task 3f: Decompose AgentDeploymentService
  [ ] Extract _load_agent_config() from deploy() and deploy_multi()
  [ ] Extract _load_git_repository() from deploy() and deploy_multi()
  [ ] Extract _render_template() from deploy()
  [ ] Extract _open_or_clone_repo() from deploy() and deploy_multi()
  [ ] Extract _write_file() from deploy() and deploy_multi()
  [ ] Extract _commit_and_push() from deploy() and deploy_multi()
  [ ] Verify: wc -l backend/services/agents/deployment_service.py → ≤ 500
  [ ] Verify: no method body > 50 lines

Final integration:
  [ ] pytest backend/tests/ -x -q
  [ ] Start backend: cd backend && python start.py
  [ ] Verify no import errors at startup
  [ ] Trigger one Celery task per modified task file via the API and confirm success
```

---

## What Is NOT In This Document

- **Step 1** — f-string fixes, dead normalization monolith, EncryptionService → `REFACTORING_STEP_1.md`
- **Step 2** — Pydantic model migration out of routers → `REFACTORING_STEP_2.md`
- **Step 4** — Root-level `*_manager.py` migration to `services/` → `REFACTORING_STEP_4.md`
