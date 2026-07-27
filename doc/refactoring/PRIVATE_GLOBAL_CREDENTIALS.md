# Refactoring plan — Enforce private/global credential ownership in job scheduling

Closes a gap found while verifying the job-template/job-schedule
private/global model: **private vs. global visibility is correctly
enforced for job templates and job schedules themselves, but the
`credential_id` a job schedule references is never validated against
the credential's `source`/`owner`.** Any authenticated user can point
their own (private or global) job schedule at *any* credential ID —
including another user's private SSH key or password — and the
scheduled/manual job run will silently decrypt and use it.

This document is self-contained: every change lists the exact
"Code before" / "Code after" so it can be implemented without
re-reading the surrounding modules.

---

## 1. Goal & non-goals

### 1.1 Goal

1. A job schedule's `credential_id` must resolve to a credential that
   is actually usable in that schedule's context:
   - **Global schedule** (`is_global=True`) → `credential_id` must
     reference a **`general`** credential.
   - **Private schedule** (`is_global=False`, owned by `user_id`) →
     `credential_id` must reference a **`general`** credential, or a
     **`private`** credential whose `owner` equals that user's
     username.
2. This rule is enforced in two places (defense in depth):
   - **Write path** — `POST /api/job-schedules` and
     `PUT /api/job-schedules/{id}` reject an invalid `credential_id`
     with `404` (credential doesn't exist) or `403` (exists but not
     usable in this context) *before* persisting the schedule.
   - **Execution path** — `tasks.dispatch_job` (Celery) re-validates
     the credential right before running the job, so a schedule that
     was valid at creation time but whose credential's `owner`/`source`
     changed later (e.g. an admin edited the credential, or the
     credential's owner account was reused) cannot silently execute
     with an unauthorized credential.
3. Fix an existing, unrelated bug in the same function we're touching:
   `create_job_schedule` (`backend/routers/jobs/schedules.py`) is
   missing an `except HTTPException: raise` guard, so the existing
   RBAC check (`403` for creating a global schedule without
   `jobs:write`) is currently being swallowed by the generic
   `except Exception` handler and turned into a `500`. This must be
   fixed as a prerequisite, otherwise our new `403`/`404` responses
   would suffer the same fate.

### 1.2 Non-goals

- Job templates do not carry a `credential_id` field (they reference
  Cockpit *agents* via `*_agent_id` fields, which are a different
  concept) — no change needed there.
- No change to the frontend. `schedule-form-dialog.tsx` already only
  offers the user's accessible credentials (general + their own
  private ones) in the picker, so normal UI usage is already
  unaffected. This plan closes the API-level bypass, not a UI bug.
- No change to `/api/credentials` or `/profile` credential CRUD
  endpoints — those already correctly scope private credentials to
  their owner.
- Re-auditing every other `dispatch_job.delay(...)` call site.
  Verified during investigation: `routers/jobs/sync_tasks.py`,
  `services/network/configs/backup_service.py`, and
  `routers/cockpit_agent.py` never pass `credential_id` at all, so
  they cannot originate an unauthorized credential reference. Only
  `routers/jobs/schedules.py` (create/update) lets a caller set
  `credential_id` directly; `routers/jobs/schedules.py` (`/execute`)
  and `routers/jobs/runs.py` only ever forward a schedule's
  already-stored `credential_id`, which is covered by the write-path
  validation plus the dispatch-time defense-in-depth check.

---

## 2. Current state (verified)

### 2.1 Credential model already supports ownership

```17:49:backend/core/models/credentials.py
class Credential(Base):
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)  # Unique per source, not globally
    username = Column(String(255), nullable=False)
    type = Column(
        String(50), nullable=False, default="generic"
    )  # ssh, tacacs, generic, token, ssh_key
    password_encrypted = Column(LargeBinary, nullable=True)  # Nullable for ssh_key type
    ssh_key_encrypted = Column(LargeBinary, nullable=True)  # Encrypted SSH private key
    ssh_passphrase_encrypted = Column(
        LargeBinary, nullable=True
    )  # Encrypted passphrase
    valid_until = Column(String(255))  # ISO8601 datetime string
    is_active = Column(Boolean, nullable=False, default=True)
    source = Column(String(50), nullable=False, default="general")  # general or private
    owner = Column(String(255))
    ...
```

### 2.2 Job schedule create/update never checks the credential

```29:76:backend/routers/jobs/schedules.py
@router.post("", response_model=JobScheduleResponse)
async def create_job_schedule(
    job_data: JobScheduleCreate,
    current_user: dict = Depends(verify_token),
    job_schedule_service: JobScheduleService = Depends(get_job_schedule_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """
    Create a new job schedule

    - Global jobs require 'jobs:write' permission
    - Private jobs can be created by any authenticated user
    """
    try:
        # Check permissions for global jobs
        if job_data.is_global:
            # For global jobs, require admin role or jobs:write permission
            import service_factory

            rbac_manager = service_factory.build_rbac_service()

            has_permission = rbac_manager.has_permission(
                current_user["user_id"], "jobs", "write"
            )
            if not has_permission and current_user.get("role") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global jobs",
                )
        else:
            # For private jobs, set the user_id to current user
            job_data.user_id = current_user["user_id"]

        # Create the job schedule
        job_schedule = job_schedule_service.create_job_schedule(
            job_identifier=job_data.job_identifier,
            job_template_id=job_data.job_template_id,
            schedule_type=job_data.schedule_type,
            cron_expression=job_data.cron_expression,
            interval_minutes=job_data.interval_minutes,
            start_time=job_data.start_time,
            start_date=job_data.start_date,
            is_active=job_data.is_active,
            is_global=job_data.is_global,
            user_id=job_data.user_id,
            credential_id=job_data.credential_id,
            job_parameters=job_data.job_parameters,
        )
        ...
        return JobScheduleResponse(**job_schedule)

    except Exception as e:
        raise_internal_server_error(logger, "Failed to create job schedule: ", e)
```

Note there is **no `except HTTPException: raise`** — the RBAC
`HTTPException(403, ...)` raised above falls into the generic
`except Exception` and gets converted into a `500` by
`raise_internal_server_error`. Contrast with `update_job_schedule`
below, which does it correctly.

```161:220:backend/routers/jobs/schedules.py
@router.put("/{job_id}", response_model=JobScheduleResponse)
async def update_job_schedule(
    job_id: int,
    job_update: JobScheduleUpdate,
    current_user: dict = Depends(verify_token),
    job_schedule_service: JobScheduleService = Depends(get_job_schedule_service),
):
    """Update a job schedule"""
    try:
        # Get existing job
        job = job_schedule_service.get_job_schedule(job_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )

        # Check permissions
        if job.get("is_global"):
            # Global jobs require write permission
            import service_factory

            rbac_manager = service_factory.build_rbac_service()

            has_permission = rbac_manager.has_permission(
                current_user["user_id"], "jobs", "write"
            )
            if not has_permission and current_user.get("role") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global jobs",
                )
        else:
            # Private jobs can only be edited by owner
            if job.get("user_id") != current_user["user_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only edit your own private jobs",
                )

        # Update the job
        updated_job = job_schedule_service.update_job_schedule(
            job_id=job_id,
            job_identifier=job_update.job_identifier,
            schedule_type=job_update.schedule_type,
            cron_expression=job_update.cron_expression,
            interval_minutes=job_update.interval_minutes,
            start_time=job_update.start_time,
            start_date=job_update.start_date,
            is_active=job_update.is_active,
            credential_id=job_update.credential_id,
            job_parameters=job_update.job_parameters,
        )

        return JobScheduleResponse(**updated_job)

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to update job schedule: ", e)
```

Neither endpoint ever inspects `credential_id` before persisting it.

### 2.3 Execution never checks it either (by design — worker trusts the DB row)

```106:115:backend/tasks/scheduling/job_dispatcher.py
        # Execute the appropriate task based on job_type
        result = execute_job_type(
            job_type=job_type,
            schedule_id=schedule_id,
            credential_id=credential_id,
            job_parameters=job_parameters,
            target_devices=target_devices,
            task_context=self,
            template=template,
            job_run_id=job_run_id,
        )
```

Every executor (e.g. `tasks/execution/command_executor.py:138`,
`tasks/execution/backup_executor.py:236`) does a bare
`credentials_manager.get_credential_by_id(credential_id)` with no
owner check — reasonable for a trusted internal call, *provided* the
`credential_id` was validated when it was chosen.

---

## 3. Design

### 3.1 New exception: `CredentialAccessDeniedError`

Add next to the existing `CredentialNotFoundError` in
`backend/services/settings/exceptions.py`.

**File:** `backend/services/settings/exceptions.py`

**Code before**

```python
"""Typed exceptions for settings-domain services."""

from __future__ import annotations


class CredentialNotFoundError(Exception):
    def __init__(self, cred_id: int) -> None:
        super().__init__(f"Credential {cred_id} not found")
        self.cred_id = cred_id


class CredentialMissingFieldError(Exception):
    """Raised when a requested decrypted field (password, SSH key) is absent."""


class ProfileValidationError(Exception):
    """Raised for invalid profile input (duplicate/empty name, built-in mutation)."""
```

**Code after**

```python
"""Typed exceptions for settings-domain services."""

from __future__ import annotations


class CredentialNotFoundError(Exception):
    def __init__(self, cred_id: int) -> None:
        super().__init__(f"Credential {cred_id} not found")
        self.cred_id = cred_id


class CredentialAccessDeniedError(Exception):
    """Raised when a credential exists but is not usable in the requested context.

    Usable means: the credential is 'general', or it is 'private' and
    owned by the requesting user. Distinguishing this from
    CredentialNotFoundError lets callers map it to HTTP 403 instead of
    404 without leaking whether a private credential ID exists.
    """

    def __init__(self, cred_id: int) -> None:
        super().__init__(f"Credential {cred_id} is not accessible in this context")
        self.cred_id = cred_id


class CredentialMissingFieldError(Exception):
    """Raised when a requested decrypted field (password, SSH key) is absent."""


class ProfileValidationError(Exception):
    """Raised for invalid profile input (duplicate/empty name, built-in mutation)."""
```

---

### 3.2 New `CredentialsService.assert_usable(...)` method

This centralizes the ownership rule in the service that owns the
`Credential` domain (repository-pattern SRP), so both the router and
the Celery task can call the same logic.

**File:** `backend/services/settings/credentials_service.py`

**Code before**

Imports block (top of file):

```python
from services.settings.exceptions import (
    CredentialMissingFieldError,
    CredentialNotFoundError,
)
```

Method to insert after (unchanged body, shown for anchoring):

```python
    def get_credential_by_id(self, cred_id: int) -> Optional[Dict[str, Any]]:
        cred = self._repo.get_by_id(cred_id)
        return self._to_dict(cred) if cred else None

    def create_credential(
```

**Code after**

Import line:

```python
from services.settings.exceptions import (
    CredentialAccessDeniedError,
    CredentialMissingFieldError,
    CredentialNotFoundError,
)
```

New method, inserted directly after `get_credential_by_id` and before
`create_credential`:

```python
    def get_credential_by_id(self, cred_id: int) -> Optional[Dict[str, Any]]:
        cred = self._repo.get_by_id(cred_id)
        return self._to_dict(cred) if cred else None

    def assert_usable(
        self,
        cred_id: int,
        *,
        is_global_context: bool,
        owner_username: Optional[str],
    ) -> Dict[str, Any]:
        """Validate that a credential may be referenced in the given context.

        Rules:
        - General credentials (source == "general") are always usable.
        - Private credentials (source == "private") are only usable in a
          non-global context (is_global_context=False) whose owner
          matches owner_username.

        Args:
            cred_id: Credential ID being referenced (e.g. a job schedule's
                credential_id).
            is_global_context: True if the referencing object (e.g. job
                schedule) is global — private credentials are never
                usable in a global context since there is no single
                owner to scope them to.
            owner_username: Username of the referencing object's owner
                (e.g. the job schedule's user). Ignored when
                is_global_context is True.

        Returns:
            The credential dict (as from get_credential_by_id) if usable.

        Raises:
            CredentialNotFoundError: cred_id does not exist.
            CredentialAccessDeniedError: cred_id exists but is not usable
                in this context.
        """
        cred = self.get_credential_by_id(cred_id)
        if not cred:
            raise CredentialNotFoundError(cred_id)

        if cred.get("source") == "general":
            return cred

        # Private credential: only usable by its owner, and only in a
        # non-global (private) context.
        if is_global_context or cred.get("owner") != owner_username:
            raise CredentialAccessDeniedError(cred_id)

        return cred

    def create_credential(
```

---

### 3.3 Enforce it on the write path — `backend/routers/jobs/schedules.py`

#### 3.3.1 Imports

**Code before**

```python
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission, verify_token
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_audit_log_service, get_job_schedule_service
from models.jobs import (
    JobExecutionRequest,
    JobScheduleCreate,
    JobScheduleResponse,
    JobScheduleUpdate,
)
from services.audit.audit_log_service import AuditLogService
from services.jobs.job_schedule_service import JobScheduleService
```

**Code after**

```python
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission, verify_token
from core.safe_http_errors import raise_internal_server_error
from dependencies import (
    get_audit_log_service,
    get_credentials_service,
    get_job_schedule_service,
)
from models.jobs import (
    JobExecutionRequest,
    JobScheduleCreate,
    JobScheduleResponse,
    JobScheduleUpdate,
)
from services.audit.audit_log_service import AuditLogService
from services.jobs.job_schedule_service import JobScheduleService
from services.settings.credentials_service import CredentialsService
from services.settings.exceptions import (
    CredentialAccessDeniedError,
    CredentialNotFoundError,
)
```

#### 3.3.2 `create_job_schedule` — fix the missing `except HTTPException` guard and validate the credential

**Code before**

```python
@router.post("", response_model=JobScheduleResponse)
async def create_job_schedule(
    job_data: JobScheduleCreate,
    current_user: dict = Depends(verify_token),
    job_schedule_service: JobScheduleService = Depends(get_job_schedule_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """
    Create a new job schedule

    - Global jobs require 'jobs:write' permission
    - Private jobs can be created by any authenticated user
    """
    try:
        # Check permissions for global jobs
        if job_data.is_global:
            # For global jobs, require admin role or jobs:write permission
            import service_factory

            rbac_manager = service_factory.build_rbac_service()

            has_permission = rbac_manager.has_permission(
                current_user["user_id"], "jobs", "write"
            )
            if not has_permission and current_user.get("role") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global jobs",
                )
        else:
            # For private jobs, set the user_id to current user
            job_data.user_id = current_user["user_id"]

        # Create the job schedule
        job_schedule = job_schedule_service.create_job_schedule(
            job_identifier=job_data.job_identifier,
            job_template_id=job_data.job_template_id,
            schedule_type=job_data.schedule_type,
            cron_expression=job_data.cron_expression,
            interval_minutes=job_data.interval_minutes,
            start_time=job_data.start_time,
            start_date=job_data.start_date,
            is_active=job_data.is_active,
            is_global=job_data.is_global,
            user_id=job_data.user_id,
            credential_id=job_data.credential_id,
            job_parameters=job_data.job_parameters,
        )

        audit_log.log_event(
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
            event_type="job-schedule-created",
            message=f"Job schedule '{job_data.job_identifier}' created for template ID {job_data.job_template_id}",
            resource_type="job_schedule",
            resource_id=str(job_schedule.get("id")) if job_schedule else None,
            resource_name=job_data.job_identifier,
            severity="info",
            extra_data={
                "job_template_id": job_data.job_template_id,
                "schedule_type": job_data.schedule_type,
                "is_global": job_data.is_global,
            },
        )

        return JobScheduleResponse(**job_schedule)

    except Exception as e:
        raise_internal_server_error(logger, "Failed to create job schedule: ", e)
```

**Code after**

```python
@router.post("", response_model=JobScheduleResponse)
async def create_job_schedule(
    job_data: JobScheduleCreate,
    current_user: dict = Depends(verify_token),
    job_schedule_service: JobScheduleService = Depends(get_job_schedule_service),
    credentials_service: CredentialsService = Depends(get_credentials_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """
    Create a new job schedule

    - Global jobs require 'jobs:write' permission
    - Private jobs can be created by any authenticated user
    - credential_id, if set, must be a general credential, or a private
      credential owned by the requesting user (private credentials are
      never usable in a global schedule)
    """
    try:
        # Check permissions for global jobs
        if job_data.is_global:
            # For global jobs, require admin role or jobs:write permission
            import service_factory

            rbac_manager = service_factory.build_rbac_service()

            has_permission = rbac_manager.has_permission(
                current_user["user_id"], "jobs", "write"
            )
            if not has_permission and current_user.get("role") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global jobs",
                )
        else:
            # For private jobs, set the user_id to current user
            job_data.user_id = current_user["user_id"]

        if job_data.credential_id is not None:
            try:
                credentials_service.assert_usable(
                    job_data.credential_id,
                    is_global_context=job_data.is_global,
                    owner_username=current_user.get("username"),
                )
            except CredentialNotFoundError:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Credential {job_data.credential_id} not found",
                )
            except CredentialAccessDeniedError:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: the selected credential is private "
                    "and not owned by you, or not usable in a global schedule",
                )

        # Create the job schedule
        job_schedule = job_schedule_service.create_job_schedule(
            job_identifier=job_data.job_identifier,
            job_template_id=job_data.job_template_id,
            schedule_type=job_data.schedule_type,
            cron_expression=job_data.cron_expression,
            interval_minutes=job_data.interval_minutes,
            start_time=job_data.start_time,
            start_date=job_data.start_date,
            is_active=job_data.is_active,
            is_global=job_data.is_global,
            user_id=job_data.user_id,
            credential_id=job_data.credential_id,
            job_parameters=job_data.job_parameters,
        )

        audit_log.log_event(
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
            event_type="job-schedule-created",
            message=f"Job schedule '{job_data.job_identifier}' created for template ID {job_data.job_template_id}",
            resource_type="job_schedule",
            resource_id=str(job_schedule.get("id")) if job_schedule else None,
            resource_name=job_data.job_identifier,
            severity="info",
            extra_data={
                "job_template_id": job_data.job_template_id,
                "schedule_type": job_data.schedule_type,
                "is_global": job_data.is_global,
            },
        )

        return JobScheduleResponse(**job_schedule)

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to create job schedule: ", e)
```

Two changes beyond the credential check: added the missing
`except HTTPException: raise` (prerequisite fix, see §1.1.3), and
added the `credentials_service` dependency parameter.

#### 3.3.3 `update_job_schedule` — validate the credential when it changes

**Code before**

```python
@router.put("/{job_id}", response_model=JobScheduleResponse)
async def update_job_schedule(
    job_id: int,
    job_update: JobScheduleUpdate,
    current_user: dict = Depends(verify_token),
    job_schedule_service: JobScheduleService = Depends(get_job_schedule_service),
):
    """Update a job schedule"""
    try:
        # Get existing job
        job = job_schedule_service.get_job_schedule(job_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )

        # Check permissions
        if job.get("is_global"):
            # Global jobs require write permission
            import service_factory

            rbac_manager = service_factory.build_rbac_service()

            has_permission = rbac_manager.has_permission(
                current_user["user_id"], "jobs", "write"
            )
            if not has_permission and current_user.get("role") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global jobs",
                )
        else:
            # Private jobs can only be edited by owner
            if job.get("user_id") != current_user["user_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only edit your own private jobs",
                )

        # Update the job
        updated_job = job_schedule_service.update_job_schedule(
            job_id=job_id,
            job_identifier=job_update.job_identifier,
            schedule_type=job_update.schedule_type,
            cron_expression=job_update.cron_expression,
            interval_minutes=job_update.interval_minutes,
            start_time=job_update.start_time,
            start_date=job_update.start_date,
            is_active=job_update.is_active,
            credential_id=job_update.credential_id,
            job_parameters=job_update.job_parameters,
        )

        return JobScheduleResponse(**updated_job)

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to update job schedule: ", e)
```

**Code after**

```python
@router.put("/{job_id}", response_model=JobScheduleResponse)
async def update_job_schedule(
    job_id: int,
    job_update: JobScheduleUpdate,
    current_user: dict = Depends(verify_token),
    job_schedule_service: JobScheduleService = Depends(get_job_schedule_service),
    credentials_service: CredentialsService = Depends(get_credentials_service),
):
    """Update a job schedule"""
    try:
        # Get existing job
        job = job_schedule_service.get_job_schedule(job_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )

        # Check permissions
        if job.get("is_global"):
            # Global jobs require write permission
            import service_factory

            rbac_manager = service_factory.build_rbac_service()

            has_permission = rbac_manager.has_permission(
                current_user["user_id"], "jobs", "write"
            )
            if not has_permission and current_user.get("role") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global jobs",
                )
        else:
            # Private jobs can only be edited by owner
            if job.get("user_id") != current_user["user_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only edit your own private jobs",
                )

        if job_update.credential_id is not None:
            try:
                credentials_service.assert_usable(
                    job_update.credential_id,
                    is_global_context=job.get("is_global", False),
                    owner_username=current_user.get("username"),
                )
            except CredentialNotFoundError:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Credential {job_update.credential_id} not found",
                )
            except CredentialAccessDeniedError:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: the selected credential is private "
                    "and not owned by you, or not usable in a global schedule",
                )

        # Update the job
        updated_job = job_schedule_service.update_job_schedule(
            job_id=job_id,
            job_identifier=job_update.job_identifier,
            schedule_type=job_update.schedule_type,
            cron_expression=job_update.cron_expression,
            interval_minutes=job_update.interval_minutes,
            start_time=job_update.start_time,
            start_date=job_update.start_date,
            is_active=job_update.is_active,
            credential_id=job_update.credential_id,
            job_parameters=job_update.job_parameters,
        )

        return JobScheduleResponse(**updated_job)

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to update job schedule: ", e)
```

Note: `job.get("is_global", False)` is the **existing** schedule's
global flag (it is immutable via `JobScheduleUpdate` — there is no
`is_global` field on that model), and `current_user`'s username is
safe to use as `owner_username` here because the permission block
above already guarantees that for a private schedule, only its owner
can reach this line (global schedules force `is_global_context=True`,
so `owner_username` is ignored by `assert_usable` in that branch).

---

### 3.4 Defense-in-depth on the execution path — `backend/tasks/scheduling/job_dispatcher.py`

Re-validate right before dispatching to the type-specific executor, so
a schedule whose credential became invalid *after* creation (owner
reassigned, source flipped from private to general and back, etc.)
cannot execute. This only triggers for calls that pass both
`schedule_id` and `credential_id` — i.e. schedule-driven runs. The
other `dispatch_job.delay(...)` call sites (`sync_tasks.py`,
`backup_service.py`, `cockpit_agent.py`) never pass `credential_id`, so
this check is a no-op for them.

**File:** `backend/tasks/scheduling/job_dispatcher.py`

**Code before**

```python
        # Get template details if needed
        if template_id:
            template = _template_svc.get_job_template(template_id)
            logger.info(
                "[DISPATCH] Template ID %s loaded: %s",
                template_id,
                template is not None,
            )
            if template:
                logger.info("[DISPATCH] Template name: %s", template.get("name"))
                logger.info(
                    "[DISPATCH] Template activate_changes_after_sync: %s",
                    template.get("activate_changes_after_sync"),
                )
                if not target_devices:
                    # Get target devices based on inventory_source
                    target_devices = get_target_devices(template, job_parameters)
        else:
            logger.info("[DISPATCH] No template_id provided")

        # Create job run record
        job_run = _jrs.create_job_run(
```

**Code after**

```python
        # Get template details if needed
        if template_id:
            template = _template_svc.get_job_template(template_id)
            logger.info(
                "[DISPATCH] Template ID %s loaded: %s",
                template_id,
                template is not None,
            )
            if template:
                logger.info("[DISPATCH] Template name: %s", template.get("name"))
                logger.info(
                    "[DISPATCH] Template activate_changes_after_sync: %s",
                    template.get("activate_changes_after_sync"),
                )
                if not target_devices:
                    # Get target devices based on inventory_source
                    target_devices = get_target_devices(template, job_parameters)
        else:
            logger.info("[DISPATCH] No template_id provided")

        # Defense-in-depth: re-validate that this schedule is still
        # allowed to use credential_id. The write-path (job schedule
        # create/update routers) already enforces this, but schedules
        # are long-lived and a credential's owner/source can change
        # after the schedule captured the ID.
        if credential_id is not None and schedule_id is not None:
            from services.settings.exceptions import (
                CredentialAccessDeniedError,
                CredentialNotFoundError,
            )

            _schedule_svc = service_factory.build_job_schedule_service()
            _schedule = _schedule_svc.get_job_schedule(schedule_id)
            if _schedule is not None:
                owner_username = None
                schedule_user_id = _schedule.get("user_id")
                if schedule_user_id:
                    from services.auth.user_management import get_user_by_id

                    owner = get_user_by_id(schedule_user_id)
                    owner_username = owner["username"] if owner else None

                _cred_svc = service_factory.build_credentials_service()
                try:
                    _cred_svc.assert_usable(
                        credential_id,
                        is_global_context=_schedule.get("is_global", False),
                        owner_username=owner_username,
                    )
                except (CredentialNotFoundError, CredentialAccessDeniedError) as e:
                    error_msg = (
                        f"Refusing to run job '{job_name}': credential "
                        f"{credential_id} is not accessible for schedule "
                        f"{schedule_id} ({e})"
                    )
                    logger.error(error_msg)
                    return {
                        "success": False,
                        "error": error_msg,
                        "job_name": job_name,
                        "job_type": job_type,
                    }

        # Create job run record
        job_run = _jrs.create_job_run(
```

This uses `service_factory` (already imported at the top of the
function body via `import service_factory`) and follows the existing
local-import style used throughout this task module.

---

## 4. Data migration / one-off audit (run before enabling enforcement)

Because enforcement is new, existing rows in `job_schedules` may
already violate the invariant (created before this fix shipped). Run
this **read-only audit** first so operators can see and fix affected
schedules before the write-path validation blocks their next edit, and
before the dispatch-time check starts silently failing their runs.

Add a one-off script `backend/scripts/audit_schedule_credentials.py`:

```python
"""One-off audit: find job_schedules whose credential_id is not usable
in that schedule's context (general vs. private/owner rules).

Read-only — reports violations, does not modify any row. Run manually
after deploying this refactor's code, before relying on enforcement:

    python scripts/audit_schedule_credentials.py
"""

from __future__ import annotations

import service_factory
from services.auth.user_management import get_user_by_id
from services.settings.exceptions import (
    CredentialAccessDeniedError,
    CredentialNotFoundError,
)


def main() -> None:
    schedule_service = service_factory.build_job_schedule_service()
    credentials_service = service_factory.build_credentials_service()

    schedules = schedule_service.list_job_schedules()
    violations = []

    for schedule in schedules:
        credential_id = schedule.get("credential_id")
        if credential_id is None:
            continue

        owner_username = None
        if schedule.get("user_id"):
            owner = get_user_by_id(schedule["user_id"])
            owner_username = owner["username"] if owner else None

        try:
            credentials_service.assert_usable(
                credential_id,
                is_global_context=schedule.get("is_global", False),
                owner_username=owner_username,
            )
        except CredentialNotFoundError:
            violations.append((schedule, "credential does not exist"))
        except CredentialAccessDeniedError:
            violations.append((schedule, "credential not usable in this context"))

    if not violations:
        print("No violations found.")
        return

    print(f"Found {len(violations)} schedule(s) with an invalid credential_id:\n")
    for schedule, reason in violations:
        print(
            f"  schedule_id={schedule['id']} "
            f"job_identifier={schedule.get('job_identifier')!r} "
            f"is_global={schedule.get('is_global')} "
            f"user_id={schedule.get('user_id')} "
            f"credential_id={schedule.get('credential_id')} "
            f"-> {reason}"
        )


if __name__ == "__main__":
    main()
```

Operator follow-up for each reported row: either reassign
`credential_id` to a credential the schedule owner may use, or clear
it (the schedule's job type will then fail at run time with the
existing "No credentials specified" error already returned by the
executors, e.g. `backend/tasks/execution/command_executor.py:124-130`
— not a new failure mode).

---

## 5. Tests

Follow the existing conventions: `CredentialsService` unit tests mock
the repository (`tests/unit/services/test_credentials_service.py`);
`JobScheduleService` unit tests use `FakeJobScheduleRepository`
(`tests/unit/services/test_job_schedule_service.py`,
`tests/mocks/fake_job_repositories.py`); router tests use `TestClient`
with dependency overrides (`tests/unit/core/test_servers_router.py`).

### 5.1 `tests/unit/services/test_credentials_service.py` — add `assert_usable` cases

Add near the other `CredentialNotFoundError`-raising tests, using the
existing `_cred(**kwargs)` / `_service(mock_repo)` helpers already in
this file:

```python
from services.settings.exceptions import (
    CredentialAccessDeniedError,
    CredentialMissingFieldError,
    CredentialNotFoundError,
)


class TestAssertUsable:
    def test_general_credential_usable_in_any_context(self) -> None:
        repo = MagicMock()
        repo.get_by_id.return_value = _cred(source="general", owner=None)
        svc = _service(repo)

        result = svc.assert_usable(1, is_global_context=True, owner_username=None)
        assert result["id"] == 1

        result = svc.assert_usable(
            1, is_global_context=False, owner_username="alice"
        )
        assert result["id"] == 1

    def test_private_credential_usable_by_owner_in_private_context(self) -> None:
        repo = MagicMock()
        repo.get_by_id.return_value = _cred(source="private", owner="alice")
        svc = _service(repo)

        result = svc.assert_usable(
            1, is_global_context=False, owner_username="alice"
        )
        assert result["owner"] == "alice"

    def test_private_credential_rejected_for_other_owner(self) -> None:
        repo = MagicMock()
        repo.get_by_id.return_value = _cred(source="private", owner="alice")
        svc = _service(repo)

        with pytest.raises(CredentialAccessDeniedError):
            svc.assert_usable(1, is_global_context=False, owner_username="bob")

    def test_private_credential_rejected_in_global_context(self) -> None:
        repo = MagicMock()
        repo.get_by_id.return_value = _cred(source="private", owner="alice")
        svc = _service(repo)

        with pytest.raises(CredentialAccessDeniedError):
            svc.assert_usable(1, is_global_context=True, owner_username="alice")

    def test_missing_credential_raises_not_found(self) -> None:
        repo = MagicMock()
        repo.get_by_id.return_value = None
        svc = _service(repo)

        with pytest.raises(CredentialNotFoundError):
            svc.assert_usable(999, is_global_context=False, owner_username="alice")
```

### 5.2 New router test file: `tests/unit/core/test_job_schedules_router.py`

Model this on `tests/unit/core/test_servers_router.py` (same
`ExitStack`/lifespan-mocking fixture, same
`app.dependency_overrides`/`verify_token` override pattern). Key
cases:

- `POST /api/job-schedules` with `is_global=False`,
  `credential_id=<another user's private credential>` → `403`.
- `POST /api/job-schedules` with `is_global=True`,
  `credential_id=<a private credential>` → `403`.
- `POST /api/job-schedules` with `credential_id=<nonexistent id>` →
  `404`.
- `POST /api/job-schedules` with `is_global=True` and no
  `jobs:write` permission → `403` (regression test for the
  `except HTTPException: raise` fix — currently this asserts `500`
  because of the bug being fixed here).
- `PUT /api/job-schedules/{id}` changing `credential_id` to one not
  owned by the caller → `403`.
- Happy path: general credential, and owner's own private credential,
  both succeed for the appropriate `is_global` value.

Remember (`CLAUDE.md` testing conventions): clean up
`app.dependency_overrides` in a `finally`/fixture teardown so overrides
don't leak into other test modules.

### 5.3 `tests/unit/tasks/test_schedule_checker.py` or a new `test_job_dispatcher.py`

Add a case where `dispatch_job` is invoked with a `schedule_id` whose
stored schedule is private and owned by user A, but `credential_id`
points at a private credential owned by user B — assert the task
returns `{"success": False, ...}` and does **not** call
`execute_job_type` (patch/spy on
`tasks.execution.base_executor.execute_job_type` to confirm no call
occurs).

---

## 6. Rollout steps

1. Implement §3.1–§3.4.
2. `cd backend && ruff format . && ruff check --fix .`
3. `cd backend && pytest -q` (new tests from §5 must pass; full suite
   must stay green).
4. Deploy.
5. Run `python scripts/audit_schedule_credentials.py` (§4) against
   production data; resolve any reported violations before they start
   blocking edits / failing dispatch.
6. Manual smoke test (`curl`, replace `$TOKEN`):
   ```bash
   # Should now be 403, not 500, without jobs:write permission:
   curl -s -o /dev/null -w '%{http_code}\n' \
     -X POST http://localhost:8000/api/job-schedules \
     -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{"job_identifier":"t","job_template_id":1,"schedule_type":"now","is_global":true}'

   # Should be 403: private credential belonging to another user
   curl -s -o /dev/null -w '%{http_code}\n' \
     -X POST http://localhost:8000/api/job-schedules \
     -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{"job_identifier":"t2","job_template_id":1,"schedule_type":"now","is_global":false,"credential_id":<other users private cred id>}'
   ```

---

## 7. Follow-ups (out of scope for this plan)

- Consider adding the same `assert_usable` check anywhere else a
  `credential_id` might be accepted directly from a client in the
  future (there is none today outside job schedules — confirmed via
  `grep -rn credential_id backend/routers`).
- Consider whether `PersonalCredentialData`/profile credential
  deletion (`routers/auth/profile.py`) should proactively null out
  `job_schedules.credential_id` for schedules that reference a private
  credential being deleted, instead of leaving a dangling ID that
  `assert_usable`/`get_credential_by_id` will reject at next
  edit/dispatch. Current behavior (reject at use-time) is safe but
  produces a delayed error rather than an immediate one at deletion
  time.
</content>
