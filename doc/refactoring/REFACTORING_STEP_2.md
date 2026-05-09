# Refactoring Step 2 — Pydantic Model Migration

**Date:** 2026-05-09  
**Scope:** Priority 2 items from `doc/AUDIT_REPORT.md`  
**Risk level:** Low — import path changes only, no logic moves  
**Estimated effort:** 1–2 days  
**Depends on:** Step 1 complete (optional but recommended)

CLAUDE.md mandates: _"Pydantic Models → `/backend/models/{domain}.py` (request/response schemas)"_.  
32 models are currently defined inside router files. This step moves all of them to
their canonical homes and also resolves the three fragmented job model files.

---

## Overview

| Sub-task | Scope | Models Moved |
|---|---|---|
| 2a | `routers/network/automation/netmiko.py` → new `models/netmiko.py` | 6 |
| 2b | `routers/nautobot/stacks.py` → extend `models/nautobot.py` | 4 (1 renamed) |
| 2c | `routers/nautobot/rack_mappings.py` → extend `models/nautobot.py` | 3 (2 consolidated) |
| 2d | `routers/nautobot/rack_reservations.py` → extend `models/nautobot.py` | 1 |
| 2e | `routers/nautobot/tools/scan_and_add.py` → extend `models/nautobot.py` | 4 |
| 2f | `routers/tools/certificates.py` → new `models/tools.py` | 4 |
| 2g | `routers/auth/profile.py` → extend `models/auth.py` | 3 |
| 2h | `routers/settings/connections/config.py` → extend `models/settings.py` | 1 |
| 2i | Consolidate `models/job_models.py` | Delete dead file |

---

## Sub-task 2a — Create `models/netmiko.py`

**Source:** `routers/network/automation/netmiko.py` lines 21–148  
**Target:** new `backend/models/netmiko.py`

### Models to move

| Class | Line | Notes |
|---|---|---|
| `DeviceCommand` | 21 | Has `Field` validators with `min_items` |
| `CommandResult` | 58 | |
| `CommandExecutionResponse` | 71 | |
| `TemplateExecutionRequest` | 82 | |
| `TemplateExecutionResult` | 130 | |
| `TemplateExecutionResponse` | 141 | |

### New file: `models/netmiko.py`

```python
"""Pydantic models for Netmiko command execution."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DeviceCommand(BaseModel):
    devices: List[Dict[str, str]] = Field(
        ..., description="List of devices with 'ip' or 'primary_ip4' and 'platform' fields"
    )
    commands: List[str] = Field(..., description="List of commands to execute", min_items=1)
    credential_id: Optional[int] = Field(default=None)
    username: Optional[str] = Field(default=None)
    password: Optional[str] = Field(default=None)
    enable_mode: bool = Field(default=False)
    write_config: bool = Field(default=False)
    use_textfsm: bool = Field(default=False)
    session_id: Optional[str] = Field(default=None)


class CommandResult(BaseModel):
    device: str
    success: bool
    output: str
    error: Optional[str] = None
    command_outputs: Optional[Dict[str, Any]] = Field(default=None)


class CommandExecutionResponse(BaseModel):
    session_id: str
    results: List[CommandResult]
    total_devices: int
    successful: int
    failed: int
    cancelled: int


class TemplateExecutionRequest(BaseModel):
    device_ids: List[str] = Field(..., description="List of device UUIDs from Nautobot", min_items=1)
    template_id: Optional[int] = Field(default=None)
    template_content: Optional[str] = Field(default=None)
    user_variables: Dict[str, Any] = Field(default_factory=dict)
    use_nautobot_context: bool = Field(default=True)
    dry_run: bool = Field(default=False)
    credential_id: Optional[int] = Field(default=None)
    username: Optional[str] = Field(default=None)
    password: Optional[str] = Field(default=None)
    enable_mode: bool = Field(default=False)
    write_config: bool = Field(default=False)
    session_id: Optional[str] = Field(default=None)


class TemplateExecutionResult(BaseModel):
    device_id: str
    device_name: str
    success: bool
    rendered_content: Optional[str] = None
    output: Optional[str] = None
    error: Optional[str] = None


class TemplateExecutionResponse(BaseModel):
    session_id: str
    results: List[TemplateExecutionResult]
    summary: Dict[str, int] = Field(
        description="Summary statistics (total, rendered_successfully, executed_successfully, failed, cancelled)"
    )
```

### Update `routers/network/automation/netmiko.py`

Remove the 6 class definitions (lines 21–148) and replace the `from pydantic import BaseModel, Field` import with:

```python
from models.netmiko import (
    DeviceCommand,
    CommandResult,
    CommandExecutionResponse,
    TemplateExecutionRequest,
    TemplateExecutionResult,
    TemplateExecutionResponse,
)
```

Remove `from pydantic import BaseModel, Field` if no other Pydantic usage remains in the router.

### Verification

```bash
grep -n "class.*BaseModel" backend/routers/network/automation/netmiko.py
# Expected: no output

cd backend && python -c "from models.netmiko import DeviceCommand, TemplateExecutionRequest; print('OK')"
```

---

## Sub-task 2b — Move Stacks Models to `models/nautobot.py`

**Source:** `routers/nautobot/stacks.py` lines 33–76  
**Target:** append to `backend/models/nautobot.py`

### ⚠️ Name Collision: `DeviceResult`

`stacks.py` defines `class DeviceResult` (stacks workflow result). `models/job_models.py`
also defines `class DeviceResult` (job processing result — unrelated fields). To prevent
future confusion when both model files are imported in the same scope, **rename** the
stacks class:

- `DeviceResult` → `StackProcessingResult`

Update all usages within `stacks.py` and its `response_model` references.

### Models to add to `models/nautobot.py`

```python
# --- Stacks ---

class StackDeviceInfo(BaseModel):
    id: str
    name: str
    serial: str
    location: Optional[Dict[str, Any]] = None
    device_type: Optional[Dict[str, Any]] = None


class ProcessStacksRequest(BaseModel):
    device_ids: List[str] = Field(..., min_items=1)
    separator: str = Field(default=",")


class StackProcessingResult(BaseModel):  # was DeviceResult — renamed to avoid collision
    device_id: str
    device_name: str
    success: bool
    message: str
    created_devices: List[str] = Field(default_factory=list)
    virtual_chassis_id: Optional[str] = None
    virtual_chassis_name: Optional[str] = None


class ProcessStacksResponse(BaseModel):
    results: List[StackProcessingResult]
    total: int
    succeeded: int
    failed: int
```

### Update `routers/nautobot/stacks.py`

Remove the 4 class definitions and replace with:

```python
from models.nautobot import (
    StackDeviceInfo,
    ProcessStacksRequest,
    StackProcessingResult,
    ProcessStacksResponse,
)
```

Update all references to `DeviceResult` inside `stacks.py` to `StackProcessingResult`.

---

## Sub-task 2c — Move Rack Mapping Models to `models/nautobot.py`

**Source:** `routers/nautobot/rack_mappings.py` lines 28–41  
**Target:** append to `backend/models/nautobot.py`

### ⚠️ Duplicate Classes: `MappingEntry` and `RackMappingItem`

Both classes have identical fields:

```python
class MappingEntry(BaseModel):
    origin_name: str
    mapped_name: str

class RackMappingItem(BaseModel):
    origin_name: str
    mapped_name: str
```

`MappingEntry` is used inside `RackMappingsCreate.mappings: List[MappingEntry]`.  
`RackMappingItem` is used as `response_model=List[RackMappingItem]`.

**Consolidate:** keep `RackMappingItem` only and replace `MappingEntry` everywhere with it.

### Models to add to `models/nautobot.py`

```python
# --- Rack Mappings ---

class RackMappingItem(BaseModel):
    origin_name: str
    mapped_name: str


class RackMappingsCreate(BaseModel):
    rack_name: str
    location_id: str
    mappings: List[RackMappingItem]  # was List[MappingEntry] — unified
```

### Update `routers/nautobot/rack_mappings.py`

Remove the 3 class definitions (lines 28–41) and replace with:

```python
from models.nautobot import RackMappingItem, RackMappingsCreate
```

---

## Sub-task 2d — Move Rack Reservation Model to `models/nautobot.py`

**Source:** `routers/nautobot/rack_reservations.py` line 26  
**Target:** append to `backend/models/nautobot.py`

### Model to add

```python
# --- Rack Reservations ---

class RackReservationCreate(BaseModel):
    rack_id: str
    units: List[int]
    description: str
    location_id: str
```

### Update `routers/nautobot/rack_reservations.py`

Remove the class definition and add:

```python
from models.nautobot import RackReservationCreate
```

---

## Sub-task 2e — Move Scan-and-Add Models to `models/nautobot.py`

**Source:** `routers/nautobot/tools/scan_and_add.py` lines 20–112  
**Target:** append to `backend/models/nautobot.py`

### Note on validators

`ScanStartRequest` contains Pydantic v1-style `@validator` methods with validation
business logic. These move with the model — they belong to the model, not the router.
The import of `validator` must be included in `models/nautobot.py`.

### Models to add

```python
# --- Network Scan and Add ---

import ipaddress  # add to existing nautobot.py imports

from pydantic import validator  # add alongside existing pydantic imports


class ScanStartRequest(BaseModel):
    cidrs: List[str] = Field(..., max_items=10)
    credential_ids: Optional[List[int]] = Field(default=None)
    discovery_mode: str = Field(default="netmiko")
    ping_mode: str = Field(default="fping")
    parser_template_ids: Optional[List[int]] = Field(default=None)

    @validator("cidrs")
    def validate_cidrs(cls, v: List[str]) -> List[str]:
        # (copy validator body verbatim from scan_and_add.py)
        ...

    @validator("credential_ids")
    def validate_credentials(cls, v):
        ...

    @validator("discovery_mode")
    def validate_discovery_mode(cls, v: str) -> str:
        ...

    @validator("ping_mode")
    def validate_ping_mode_for_no_credentials(cls, v: str, values: dict) -> str:
        ...


class ScanStartResponse(BaseModel):
    job_id: str
    total_targets: int
    state: str


class ScanProgress(BaseModel):
    total: int
    scanned: int
    alive: int
    authenticated: int
    unreachable: int
    auth_failed: int
    driver_not_supported: int


class ScanStatusResponse(BaseModel):
    job_id: str
    state: str
    progress: ScanProgress
    results: List[Dict[str, Any]]
```

### Update `routers/nautobot/tools/scan_and_add.py`

Remove the 4 class definitions (lines 20–112) and replace with:

```python
from models.nautobot import (
    ScanStartRequest,
    ScanStartResponse,
    ScanProgress,
    ScanStatusResponse,
)
```

Remove the now-unused `from pydantic import BaseModel, Field, validator` and
`import ipaddress` from the router if nothing else uses them.

---

## Sub-task 2f — Create `models/tools.py`

**Source:** `routers/tools/certificates.py` lines 27–58  
**Target:** new `backend/models/tools.py`

### New file: `models/tools.py`

```python
"""Pydantic models for tool endpoints (certificates, schema, etc.)."""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class CertificateInfo(BaseModel):
    filename: str
    path: str
    size: int
    exists_in_system: bool


class ScanResponse(BaseModel):
    success: bool
    certificates: list[CertificateInfo]
    certs_directory: str
    message: Optional[str] = None


class AddCertificateRequest(BaseModel):
    filename: str


class AddCertificateResponse(BaseModel):
    success: bool
    message: str
    output: Optional[str] = None
    error: Optional[str] = None
    command_output: Optional[str] = None
```

### Update `routers/tools/certificates.py`

Remove the 4 class definitions (lines 27–58) and replace with:

```python
from models.tools import (
    CertificateInfo,
    ScanResponse,
    AddCertificateRequest,
    AddCertificateResponse,
)
```

Remove `from pydantic import BaseModel` if nothing else uses it in the router.

---

## Sub-task 2g — Move Profile Models to `models/auth.py`

**Source:** `routers/auth/profile.py` lines 18–43  
**Target:** append to `backend/models/auth.py`

### Models to add to `models/auth.py`

```python
# --- User Profile ---

class PersonalCredentialData(BaseModel):
    id: str
    name: str
    username: str
    type: str
    password: Optional[str] = None
    ssh_private_key: Optional[str] = None
    ssh_passphrase: Optional[str] = None
    has_ssh_key: Optional[bool] = None


class ProfileResponse(BaseModel):
    username: str
    realname: str
    email: str
    api_key: Optional[str]
    personal_credentials: Optional[List[PersonalCredentialData]] = []


class ProfileUpdateRequest(BaseModel):
    realname: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    api_key: Optional[str] = None
    personal_credentials: Optional[List[PersonalCredentialData]] = []
```

Add `List` to the existing `from typing import ...` import in `models/auth.py`.

### Update `routers/auth/profile.py`

Remove the 3 class definitions (lines 18–43) and replace with:

```python
from models.auth import PersonalCredentialData, ProfileResponse, ProfileUpdateRequest
```

Remove `from pydantic import BaseModel` from the router.

---

## Sub-task 2h — Move Config Model to `models/settings.py`

**Source:** `routers/settings/connections/config.py` line 23  
**Target:** append to `backend/models/settings.py`

### Model to add to `models/settings.py`

```python
# --- Config File ---

class ConfigFileContent(BaseModel):
    content: str
```

### Update `routers/settings/connections/config.py`

Remove the class definition and add:

```python
from models.settings import ConfigFileContent
```

Remove `from pydantic import BaseModel` if nothing else uses it.

---

## Sub-task 2i — Delete Dead `models/job_models.py`

**File:** `backend/models/job_models.py` (125 lines)

### Analysis

A global grep confirms `job_models.py` has **zero importers** in the backend codebase:

```bash
grep -rn "from models.job_models import\|from models import.*job_models" backend/ --include="*.py"
# Result: no output
```

The `models/__init__.py` does **not** re-export anything from `job_models.py`.

The classes inside (`JobStatus`, `JobType` enums; `JobProgress`, `DeviceResult`, `Job`,
`JobStartResponse`, `JobListResponse`, `JobDetailResponse`, `NetworkScanRequest`,
`NetworkScanResponse`) appear to be an earlier draft that was superseded by the current
split between `models/jobs.py` and `models/job_templates.py`.

The `JobStatus` enum here (PENDING/RUNNING/COMPLETED/FAILED/CANCELLED) is functionally
covered by the `Literal["pending", "running", ...]` type used in `models/jobs.py`
`JobRunUpdate`. The `NetworkScanRequest` is superseded by `ScanStartRequest` being
migrated to `models/nautobot.py` in sub-task 2e.

### Action

1. Confirm zero importers (grep above)
2. Delete the file:
   ```bash
   rm backend/models/job_models.py
   ```

### Model File Naming Convention (Post-cleanup)

After deleting `job_models.py`, the three job-domain files have clear, non-overlapping
scopes and should be left as-is (no merge needed):

| File | Lines | Contents |
|---|---|---|
| `models/jobs.py` | 185 | Job schedules, job runs, execution requests |
| `models/job_templates.py` | 451 | Job template config, deploy entries, template CRUD |

Both are within the 800-line size limit and serve distinct sub-domains.

---

## Final `models/nautobot.py` Size Check

After adding sub-tasks 2b–2e, `models/nautobot.py` grows by approximately +90 lines
(13 models × ~7 lines average). Current size: 401 lines → projected: ~490 lines.
This is within the 800-line limit. If it approaches 700+ lines in a future step,
split into `models/nautobot/stacks.py`, `models/nautobot/rack.py`, etc.

---

## Complete Execution Checklist

```
Sub-task 2a: Create models/netmiko.py, update netmiko router
  [ ] Create backend/models/netmiko.py with 6 classes
  [ ] Remove 6 class defs from routers/network/automation/netmiko.py (lines 21–148)
  [ ] Add import from models.netmiko in netmiko router
  [ ] Verify: grep -n "class.*BaseModel" backend/routers/network/automation/netmiko.py → empty
  [ ] Verify: python -c "from models.netmiko import DeviceCommand; print('OK')"

Sub-task 2b: Stacks models → models/nautobot.py
  [ ] Add 4 classes (DeviceResult renamed to StackProcessingResult)
  [ ] Update stacks.py: remove class defs, add import, rename DeviceResult refs
  [ ] Verify: grep -n "class.*BaseModel" backend/routers/nautobot/stacks.py → empty

Sub-task 2c: Rack mapping models → models/nautobot.py
  [ ] Add RackMappingItem, RackMappingsCreate (MappingEntry eliminated)
  [ ] Update rack_mappings.py: remove 3 class defs, add import
  [ ] Verify: grep -n "class.*BaseModel" backend/routers/nautobot/rack_mappings.py → empty

Sub-task 2d: RackReservationCreate → models/nautobot.py
  [ ] Add RackReservationCreate
  [ ] Update rack_reservations.py
  [ ] Verify: grep -n "class.*BaseModel" backend/routers/nautobot/rack_reservations.py → empty

Sub-task 2e: Scan-and-add models → models/nautobot.py
  [ ] Add 4 classes (validators included)
  [ ] Update scan_and_add.py: remove class defs, add import
  [ ] Verify: grep -n "class.*BaseModel" backend/routers/nautobot/tools/scan_and_add.py → empty

Sub-task 2f: Create models/tools.py, update certificates router
  [ ] Create backend/models/tools.py with 4 classes
  [ ] Update routers/tools/certificates.py
  [ ] Verify: grep -n "class.*BaseModel" backend/routers/tools/certificates.py → empty
  [ ] Verify: python -c "from models.tools import CertificateInfo; print('OK')"

Sub-task 2g: Profile models → models/auth.py
  [ ] Append 3 classes to models/auth.py
  [ ] Update routers/auth/profile.py
  [ ] Verify: grep -n "class.*BaseModel" backend/routers/auth/profile.py → empty

Sub-task 2h: ConfigFileContent → models/settings.py
  [ ] Append 1 class to models/settings.py
  [ ] Update routers/settings/connections/config.py
  [ ] Verify: grep -n "class.*BaseModel" backend/routers/settings/connections/config.py → empty

Sub-task 2i: Delete job_models.py
  [ ] Confirm zero importers: grep -rn "from models.job_models" backend/ → empty
  [ ] rm backend/models/job_models.py
  [ ] Verify: python -c "import models; print('OK')"

Final sweep:
  [ ] grep -rn "class.*BaseModel" backend/routers/ --include="*.py" → zero hits
  [ ] Run test suite: pytest backend/tests/ -x -q
```

---

## What Is NOT In This Document

- **Step 1** — f-string fixes, dead normalization monolith, EncryptionService extraction → `REFACTORING_STEP_1.md`
- **Step 3** — Service extraction from oversized files (git files router, task business logic) → `REFACTORING_STEP_3.md`
- **Step 4** — Root-level `*_manager.py` migration to `services/` → `REFACTORING_STEP_4.md`
