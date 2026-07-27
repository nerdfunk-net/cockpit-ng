# Refactoring plan — Clean up global/private job templates & schedules on user deletion

Companion to `doc/refactoring/PRIAVTE_GLOBAL_CREDENTIALS.md`. Closes a
gap found while verifying what happens to job templates/schedules when
their creator is removed from the app: **`job_templates.user_id` and
`job_schedules.user_id` are real, non-nullable-on-delete foreign keys
to `users.id` with no `ondelete=` behavior, and
`RBACService.delete_user_with_rbac` never cleans up either table
before hard-deleting the user.** Concretely, today:

- Global templates/schedules created by the deleted user silently
  keep existing/running forever — harmless, but there is no way to
  reassign them to a live user, and (for schedules) no reliable record
  of who created them in the first place.
- If the deleted user owns **any private** template or schedule, the
  final `DELETE FROM users ...` raises an uncaught
  `IntegrityError` (FK violation) — by which point roles, permission
  overrides, private credentials, and the profile have *already* been
  deleted (each in its own auto-committed session), leaving the user
  half-deleted and undeletable.

This document is self-contained: every change lists the exact
"Code before" / "Code after" so it can be implemented without
re-reading the surrounding modules.

---

## 1. Goal & non-goals

### 1.1 Goal

1. **Global items need an owner to reassign to.** When an admin
   deletes a user who created global templates and/or global
   schedules, the API must require the admin to pick which user those
   items are reassigned to, instead of silently leaving them
   ownerless/attributed to a vanished account.
   - Templates already carry a reliable, always-populated
     `created_by` (username string) regardless of `is_global` — no
     schema change needed there.
   - Schedules have **no equivalent** today: `JobSchedule.user_id` is
     only set for private schedules (frontend never sends `user_id`
     for a global one, and the router doesn't default it), so a
     global schedule's creator is currently unrecoverable. This plan
     fixes `create_job_schedule` to always record `user_id`
     regardless of `is_global` (verified safe — see §3.1).
2. **Private items need explicit admin confirmation before removal.**
   When the deleted user owns private templates and/or private
   schedules, deletion must be blocked until the admin explicitly
   confirms they should be hard-deleted, instead of failing with an
   opaque `IntegrityError`/500.
3. Surface *everything* that will be affected — including private
   templates whose deletion will cascade-delete schedules owned by
   **other** users (via the existing `JobTemplate` → `JobSchedule`
   cascade relationship, see §2.3) — in one preview so the admin isn't
   surprised.
4. The new reassignment/removal steps must be atomic (all-or-nothing)
   and must run *before* any of the existing destructive steps
   (role/permission/credential/profile cleanup), so a failure here
   leaves the user record completely untouched rather than
   half-deleted.

### 1.2 Non-goals

- **Full end-to-end atomicity of `delete_user_with_rbac`.** The
  pre-existing gap — role/permission removal, credential deletion,
  and profile deletion each run in their own auto-committing session,
  so a late failure (e.g. profile deletion) still leaves those earlier
  steps committed — is **not** fixed here. Fixing it would require
  retrofitting `RBACRepository`, the profile repository, and
  `CredentialsRepository` to all accept a shared `db: Session` (none
  of them do today; only `BaseRepository`'s own methods do). That's a
  separate, larger refactor — tracked as a follow-up in §7. This plan
  only guarantees that *its own new steps* (reassignment, private-item
  deletion) are atomic and run first, so they don't introduce a new
  partial-failure mode.
- **Bulk delete (`POST /settings/rbac/users/bulk-delete` →
  `bulk_delete_users_with_rbac`) does not get a reassignment UI.** It
  already catches per-user exceptions and reports them as strings
  (`errors.append(f"User {uid}: {e}")`); a user with blocking global
  or private items will now simply show up in that error list instead
  of silently corrupting state, same as before but with a clearer
  message. Deleting such users individually (via the single-user
  endpoint, with the new query parameters) is the correct workflow —
  no code change to bulk delete is proposed here.
- Not touching `JobRun` — it already has
  `ondelete="SET NULL"` on both `job_schedule_id` and
  `job_template_id` (`backend/core/models/jobs.py:330-341`), so run
  history survives template/schedule deletion untouched.
- Not re-validating `job_template_id` ownership at schedule-creation
  time (the same class of IDOR as the `credential_id` issue fixed in
  `PRIAVTE_GLOBAL_CREDENTIALS.md` potentially applies to
  `job_template_id` too — unverified, out of scope here, noted as a
  follow-up in §7).

---

## 2. Current state (verified)

### 2.1 FKs with no `ondelete`, no cleanup on user deletion

```272:304:backend/core/models/jobs.py
    is_global = Column(Boolean, nullable=False, default=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_by = Column(String(255))  # Username of creator
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ...

class JobSchedule(Base):
    __tablename__ = "job_schedules"

    id = Column(Integer, primary_key=True, index=True)
    job_identifier = Column(String(255), nullable=False, index=True)
    job_template_id = Column(Integer, ForeignKey("job_templates.id"), nullable=False)
    schedule_type = Column(String(50), nullable=False)
    cron_expression = Column(String(255))
    interval_minutes = Column(Integer)
    start_time = Column(String(50))
    start_date = Column(String(50))
    is_active = Column(Boolean, nullable=False, default=True)
    is_global = Column(Boolean, nullable=False, default=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    credential_id = Column(Integer)
```

No `ondelete=` on either `user_id` FK. Schema is created verbatim from
these models (`AutoSchemaMigration` in `backend/core/database.py:116-121`;
`backend/migrations/versions/` is empty — no Alembic-style overrides).
Postgres therefore enforces the default `ON DELETE NO ACTION`.

### 2.2 `delete_user_with_rbac` never touches templates/schedules

```306:344:backend/services/auth/rbac_service.py
    def delete_user_with_rbac(self, user_id: int) -> bool:
        user = self._user_service.get_user_by_id(user_id, include_inactive=True)
        if not user:
            return False
        username = user.get("username")
        for role in self.get_user_roles(user_id):
            self.remove_role_from_user(user_id, role["id"])
        for override in self.get_user_permission_overrides(user_id):
            self.remove_permission_from_user(user_id, override["id"])
        cleanup_errors: list[str] = []
        if username:
            try:
                from services.settings.credentials_service import CredentialsService

                cred_svc = CredentialsService()
                deleted = cred_svc.delete_credentials_by_owner(username)
                logger.info(
                    "Deleted %s private credentials for user %s", deleted, username
                )
            except Exception as e:
                logger.warning(
                    "Failed to delete credentials for user %s: %s", username, e
                )
                cleanup_errors.append("credentials")
            try:
                from services.auth.profile_service import delete_user_profile

                delete_user_profile(username)
            except Exception as e:
                logger.warning("Failed to delete profile for user %s: %s", username, e)
                cleanup_errors.append("profile")

        if cleanup_errors:
            # Surface partial failure instead of silently reporting success.
            raise RBACConstraintError(
                f"User {user_id} deletion incomplete; failed to remove: "
                f"{', '.join(cleanup_errors)}"
            )
        return self._user_service.hard_delete_user(user_id)
```

`hard_delete_user` → `UserRepository.delete()` → `BaseRepository.delete()`
(`backend/repositories/base.py:154-179`) issues a plain
`DELETE FROM users ...` with no try/except around `s.commit()`. If any
`job_templates`/`job_schedules` row still has `user_id = <this user>`,
Postgres raises a `ForeignKeyViolation`, which propagates uncaught all
the way to the router's generic `except Exception` (`500`) — *after*
roles, permission overrides, private credentials, and the profile have
already been deleted.

### 2.3 Existing cascade: deleting a template deletes its schedules

```318:321:backend/core/models/jobs.py
    # Relationship to JobTemplate
    template = relationship(
        "JobTemplate", backref=backref("schedules", cascade="all, delete-orphan")
    )
```

This is pre-existing behavior, not something this plan introduces:
ORM-deleting a `JobTemplate` (`session.delete(template_obj)`) cascades
to delete every `JobSchedule` row whose `job_template_id` points at
it — **regardless of who owns that schedule**. This matters because
§3.6 will hard-delete the removed user's private templates, which
could cascade-delete another user's schedule if it happens to
reference one of those templates. The impact preview (§3.4) surfaces
this explicitly so the admin sees it before confirming.

### 2.4 Schedule creator is not reliably recorded for global schedules

```58:60:backend/routers/jobs/schedules.py
        else:
            # For private jobs, set the user_id to current user
            job_data.user_id = current_user["user_id"]
```

`user_id` is only set in the `else` (private) branch. For a global
schedule, `job_data.user_id` stays whatever the client sent — the
frontend never sends it (confirmed: no `user_id` reference anywhere
under `frontend/src/components/features/jobs`), so it defaults to
`None` (`JobScheduleCreate.user_id: Optional[int] = Field(None, ...)`,
`backend/models/jobs.py:51`). Contrast with `JobTemplate`, which always
records the creator in `created_by` regardless of `is_global`
(`backend/services/jobs/job_template_service.py:235`).

Verified this is safe to change: the only two places that read
`schedule.user_id` both gate on `is_global` first via short-circuit,
so populating `user_id` for global schedules changes no authorization
behavior:

```147:147:backend/routers/jobs/schedules.py
        if not job.get("is_global") and job.get("user_id") != current_user["user_id"]:
```

```318:318:backend/routers/jobs/schedules.py
        if not job.get("is_global") and job.get("user_id") != current_user["user_id"]:
```

`JobScheduleRepository.get_with_filters`/`get_user_schedules` only
ever use `user_id` inside `or_(user_id == X, is_global)`, so a
populated `user_id` on a global row doesn't change who can list it
either.

---

## 3. Design

### 3.1 Always record the creator on `JobSchedule.user_id`

**File:** `backend/routers/jobs/schedules.py`

**Code before**

```python
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
```

**Code after**

```python
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

        # Always record the creator, even for global schedules — this is
        # what lets a later user-deletion reassign global schedules to a
        # live user (see doc/refactoring/REMOVE_USER_CLEANUP.md). It has
        # no effect on visibility/authorization: both existing ownership
        # checks below gate on `is_global` first.
        job_data.user_id = current_user["user_id"]
```

(This is applied together with the `except HTTPException: raise` fix
from `PRIAVTE_GLOBAL_CREDENTIALS.md` §3.3.2, which touches the same
function — implement both in the same change.)

---

### 3.2 New exception: `UserDeletionBlockedError`

**File:** `backend/services/auth/exceptions.py`

**Code before**

```python
"""Typed exceptions for the auth/RBAC service domain."""

from __future__ import annotations


class RBACNotFoundError(Exception):
    def __init__(self, resource: str, id_val: int) -> None:
        super().__init__(f"{resource} with id {id_val} not found")
        self.resource = resource
        self.id_val = id_val


class RBACConflictError(Exception):
    """Raised when a resource already exists (duplicate name/key)."""


class RBACConstraintError(Exception):
    """Raised when an operation violates a business constraint (e.g. system role)."""
```

**Code after**

```python
"""Typed exceptions for the auth/RBAC service domain."""

from __future__ import annotations

from typing import Any, Dict


class RBACNotFoundError(Exception):
    def __init__(self, resource: str, id_val: int) -> None:
        super().__init__(f"{resource} with id {id_val} not found")
        self.resource = resource
        self.id_val = id_val


class RBACConflictError(Exception):
    """Raised when a resource already exists (duplicate name/key)."""


class RBACConstraintError(Exception):
    """Raised when an operation violates a business constraint (e.g. system role)."""


class UserDeletionBlockedError(Exception):
    """Raised when deleting a user requires input the caller didn't supply:
    a target user to reassign the deleted user's global templates/schedules
    to, and/or explicit confirmation to hard-delete their private
    templates/schedules.

    ``impact`` is the same dict returned by
    ``RBACService.get_user_deletion_impact`` — callers (the router) surface
    it verbatim in the 409 response body so the admin/frontend can render
    a confirmation prompt and retry with the missing parameters.
    """

    def __init__(self, impact: Dict[str, Any]) -> None:
        super().__init__("User deletion requires additional confirmation")
        self.impact = impact
```

---

### 3.3 Repository additions

#### 3.3.1 `JobTemplateRepository`

**File:** `backend/repositories/jobs/job_template_repository.py`

**Code before**

```python
"""
JobTemplate Repository
Handles database operations for job templates.
"""

from typing import List, Optional

from sqlalchemy import or_

from core.models import JobTemplate
from repositories.base import BaseRepository


class JobTemplateRepository(BaseRepository[JobTemplate]):
    """Repository for job template operations"""

    def __init__(self):
        super().__init__(JobTemplate)
```

**Code after**

```python
"""
JobTemplate Repository
Handles database operations for job templates.
"""

from typing import List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.models import JobTemplate
from repositories.base import BaseRepository


class JobTemplateRepository(BaseRepository[JobTemplate]):
    """Repository for job template operations"""

    def __init__(self):
        super().__init__(JobTemplate)
```

Append these three methods at the **end** of the class (after
`check_name_exists`, i.e. after line 116 of the current file):

```python
    def get_by_created_by(
        self, created_by: str, db: Optional[Session] = None
    ) -> List[JobTemplate]:
        """All templates (global or private) recorded as created by this
        username. Used to preview/reassign a departing user's global
        templates — `created_by` is always populated (unlike `user_id`,
        which is nulled for global templates), so this is the reliable
        way to find "templates this user created" regardless of the
        template's current `is_global` value."""
        with self._db_session(db) as session:
            return (
                session.query(self.model)
                .filter(self.model.created_by == created_by)
                .order_by(self.model.name.asc())
                .all()
            )

    def reassign_global_by_created_by(
        self,
        old_created_by: str,
        new_created_by: str,
        db: Optional[Session] = None,
    ) -> int:
        """Bulk-reassign this user's global templates to a new creator.
        Only touches rows where is_global is True — private templates are
        handled by delete_by_user_id instead. Returns the number of rows
        updated."""
        with self._db_session(db) as session:
            count = (
                session.query(self.model)
                .filter(
                    self.model.created_by == old_created_by,
                    self.model.is_global.is_(True),
                )
                .update({"created_by": new_created_by}, synchronize_session=False)
            )
            if db is None:
                session.commit()
            return count

    def delete_by_user_id(
        self, user_id: int, db: Optional[Session] = None
    ) -> List[int]:
        """Hard-delete all private templates owned by user_id. Uses
        per-object session.delete() (not a bulk query.delete()) so the
        JobTemplate -> JobSchedule cascade (see
        core/models/jobs.py JobSchedule.template backref,
        cascade="all, delete-orphan") actually fires for any schedules
        still pointing at these templates. Returns the deleted template
        ids."""
        with self._db_session(db) as session:
            templates = (
                session.query(self.model)
                .filter(
                    self.model.user_id == user_id,
                    self.model.is_global.is_(False),
                )
                .all()
            )
            ids = [t.id for t in templates]
            for template in templates:
                session.delete(template)
            if db is None:
                session.commit()
            return ids
```

#### 3.3.2 `JobScheduleRepository`

**File:** `backend/repositories/jobs/job_schedule_repository.py`

**Code before**

```python
"""
JobSchedule Repository
Handles database operations for job schedules.
"""

from typing import List, Optional

from sqlalchemy import or_

from core.models import JobSchedule
from repositories.base import BaseRepository


class JobScheduleRepository(BaseRepository[JobSchedule]):
    """Repository for job schedule operations"""

    def __init__(self):
        super().__init__(JobSchedule)
```

**Code after**

```python
"""
JobSchedule Repository
Handles database operations for job schedules.
"""

from typing import List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.models import JobSchedule
from repositories.base import BaseRepository


class JobScheduleRepository(BaseRepository[JobSchedule]):
    """Repository for job schedule operations"""

    def __init__(self):
        super().__init__(JobSchedule)
```

Append these four methods at the **end** of the class (after
`get_with_filters`, i.e. after line 115 of the current file):

```python
    def get_by_owner(
        self, user_id: int, db: Optional[Session] = None
    ) -> List[JobSchedule]:
        """All schedules (global or private) recorded as created by this
        user_id — a strict `user_id == X` match with no `OR is_global`
        widening, unlike get_user_schedules/get_with_filters which are
        for "accessible to X", not "created by X"."""
        with self._db_session(db) as session:
            return (
                session.query(self.model)
                .filter(self.model.user_id == user_id)
                .order_by(self.model.created_at.desc())
                .all()
            )

    def reassign_global_by_owner(
        self, old_user_id: int, new_user_id: int, db: Optional[Session] = None
    ) -> int:
        """Bulk-reassign this user's global schedules to a new owner.
        Only touches rows where is_global is True — private schedules are
        handled by delete_by_user_id instead. Returns rows updated."""
        with self._db_session(db) as session:
            count = (
                session.query(self.model)
                .filter(
                    self.model.user_id == old_user_id,
                    self.model.is_global.is_(True),
                )
                .update({"user_id": new_user_id}, synchronize_session=False)
            )
            if db is None:
                session.commit()
            return count

    def delete_by_user_id(
        self, user_id: int, db: Optional[Session] = None
    ) -> List[int]:
        """Hard-delete all private schedules owned by user_id. Returns the
        deleted schedule ids."""
        with self._db_session(db) as session:
            schedules = (
                session.query(self.model)
                .filter(
                    self.model.user_id == user_id,
                    self.model.is_global.is_(False),
                )
                .all()
            )
            ids = [s.id for s in schedules]
            for schedule in schedules:
                session.delete(schedule)
            if db is None:
                session.commit()
            return ids

    def get_by_template_ids(
        self, template_ids: List[int], db: Optional[Session] = None
    ) -> List[JobSchedule]:
        """All schedules referencing any of the given template ids,
        regardless of owner. Used to detect the cross-owner cascade risk
        described in core/models/jobs.py JobSchedule.template's
        cascade="all, delete-orphan" before a user's private templates
        are deleted."""
        if not template_ids:
            return []
        with self._db_session(db) as session:
            return (
                session.query(self.model)
                .filter(self.model.job_template_id.in_(template_ids))
                .all()
            )
```

---

### 3.4 Service additions

#### 3.4.1 `JobTemplateService`

**File:** `backend/services/jobs/job_template_service.py`

Append after `get_user_job_templates` (after line 268 of the current
file):

```python
    def get_templates_created_by(self, username: str) -> List[Dict[str, Any]]:
        return [self._to_dict(t) for t in self._repo.get_by_created_by(username)]

    def reassign_global_templates(
        self, old_created_by: str, new_created_by: str, db: Optional[Any] = None
    ) -> int:
        return self._repo.reassign_global_by_created_by(
            old_created_by, new_created_by, db=db
        )

    def delete_private_templates_for_user(
        self, user_id: int, db: Optional[Any] = None
    ) -> List[int]:
        return self._repo.delete_by_user_id(user_id, db=db)
```

(`Any` is already imported at the top of this file
(`from typing import Any, Dict, List, Optional`); using `Any` instead
of importing `sqlalchemy.orm.Session` here keeps this service
decoupled from the ORM session type, consistent with the rest of the
file, which never imports `Session` today.)

#### 3.4.2 `JobScheduleService`

**File:** `backend/services/jobs/job_schedule_service.py`

Append after `get_global_job_schedules` (after line 200 of the current
file):

```python
    def get_schedules_owned_by(self, user_id: int) -> List[Dict[str, Any]]:
        return [self._to_dict(s) for s in self._repo.get_by_owner(user_id)]

    def reassign_global_schedules(
        self, old_user_id: int, new_user_id: int, db: Optional[Any] = None
    ) -> int:
        return self._repo.reassign_global_by_owner(old_user_id, new_user_id, db=db)

    def delete_private_schedules_for_user(
        self, user_id: int, db: Optional[Any] = None
    ) -> List[int]:
        return self._repo.delete_by_user_id(user_id, db=db)

    def get_schedules_for_templates(
        self, template_ids: List[int]
    ) -> List[Dict[str, Any]]:
        return [self._to_dict(s) for s in self._repo.get_by_template_ids(template_ids)]
```

(`Any` is already imported at the top of this file
(`from typing import TYPE_CHECKING, Any, Dict, List, Optional`).)

---

### 3.5 `RBACService`: deletion-impact preview + reassignment/confirmation flow

**File:** `backend/services/auth/rbac_service.py`

#### 3.5.1 Import the new exception

**Code before**

```python
from services.auth.exceptions import (
    RBACConflictError,
    RBACConstraintError,
    RBACNotFoundError,
)
```

**Code after**

```python
from services.auth.exceptions import (
    RBACConflictError,
    RBACConstraintError,
    RBACNotFoundError,
    UserDeletionBlockedError,
)
```

#### 3.5.2 New method: `get_user_deletion_impact`

Insert immediately **before** `delete_user_with_rbac` (i.e. right
after the `create_user_with_roles`/`get_user_with_rbac`/
`list_users_with_rbac`/`update_user_profile` block, before line 306 of
the current file):

```python
    def get_user_deletion_impact(self, user_id: int) -> Dict[str, Any]:
        """Preview what deleting this user would affect.

        - global_templates / global_schedules: items this user created
          that are currently global — deleting the user requires picking
          a live user to reassign them to.
        - private_templates / private_schedules: items this user owns
          privately — deleting the user requires explicit confirmation
          to hard-delete them.
        - cascade_schedules_from_other_users: schedules owned by OTHER
          users that reference one of this user's private templates.
          These will be cascade-deleted as a side effect of removing the
          private templates (see JobSchedule.template's
          cascade="all, delete-orphan" in core/models/jobs.py) — surfaced
          here so the admin isn't surprised.
        """
        user = self._user_service.get_user_by_id(user_id, include_inactive=True)
        if not user:
            raise RBACNotFoundError("User", user_id)
        username = user["username"]

        from services.jobs.job_schedule_service import JobScheduleService
        from services.jobs.job_template_service import JobTemplateService
        from services.settings.credentials_service import CredentialsService

        template_service = JobTemplateService()
        schedule_service = JobScheduleService(template_service=template_service)
        credentials_service = CredentialsService()

        created_templates = template_service.get_templates_created_by(username)
        global_templates = [t for t in created_templates if t["is_global"]]
        private_templates = [t for t in created_templates if not t["is_global"]]

        owned_schedules = schedule_service.get_schedules_owned_by(user_id)
        global_schedules = [s for s in owned_schedules if s["is_global"]]
        private_schedules = [s for s in owned_schedules if not s["is_global"]]

        cascade_schedules: List[Dict[str, Any]] = []
        if private_templates:
            template_ids = [t["id"] for t in private_templates]
            referencing = schedule_service.get_schedules_for_templates(template_ids)
            cascade_schedules = [
                s for s in referencing if s.get("user_id") != user_id
            ]

        private_creds = credentials_service.list_credentials(
            include_expired=True, source="private"
        )
        private_credentials_count = len(
            [c for c in private_creds if c.get("owner") == username]
        )

        return {
            "user_id": user_id,
            "username": username,
            "global_templates": [
                {"id": t["id"], "name": t["name"], "job_type": t["job_type"]}
                for t in global_templates
            ],
            "global_schedules": [
                {
                    "id": s["id"],
                    "job_identifier": s["job_identifier"],
                    "template_name": s.get("template_name"),
                }
                for s in global_schedules
            ],
            "private_templates": [
                {"id": t["id"], "name": t["name"], "job_type": t["job_type"]}
                for t in private_templates
            ],
            "private_schedules": [
                {
                    "id": s["id"],
                    "job_identifier": s["job_identifier"],
                    "template_name": s.get("template_name"),
                }
                for s in private_schedules
            ],
            "cascade_schedules_from_other_users": [
                {
                    "id": s["id"],
                    "job_identifier": s["job_identifier"],
                    "owner_user_id": s.get("user_id"),
                    "is_global": s["is_global"],
                }
                for s in cascade_schedules
            ],
            "private_credentials_count": private_credentials_count,
            "requires_global_reassignment": bool(
                global_templates or global_schedules
            ),
            "requires_private_confirmation": bool(
                private_templates or private_schedules
            ),
        }
```

#### 3.5.3 Rewrite `delete_user_with_rbac`

**Code before**

```python
    def delete_user_with_rbac(self, user_id: int) -> bool:
        user = self._user_service.get_user_by_id(user_id, include_inactive=True)
        if not user:
            return False
        username = user.get("username")
        for role in self.get_user_roles(user_id):
            self.remove_role_from_user(user_id, role["id"])
        for override in self.get_user_permission_overrides(user_id):
            self.remove_permission_from_user(user_id, override["id"])
        cleanup_errors: list[str] = []
        if username:
            try:
                from services.settings.credentials_service import CredentialsService

                cred_svc = CredentialsService()
                deleted = cred_svc.delete_credentials_by_owner(username)
                logger.info(
                    "Deleted %s private credentials for user %s", deleted, username
                )
            except Exception as e:
                logger.warning(
                    "Failed to delete credentials for user %s: %s", username, e
                )
                cleanup_errors.append("credentials")
            try:
                from services.auth.profile_service import delete_user_profile

                delete_user_profile(username)
            except Exception as e:
                logger.warning("Failed to delete profile for user %s: %s", username, e)
                cleanup_errors.append("profile")

        if cleanup_errors:
            # Surface partial failure instead of silently reporting success.
            raise RBACConstraintError(
                f"User {user_id} deletion incomplete; failed to remove: "
                f"{', '.join(cleanup_errors)}"
            )
        return self._user_service.hard_delete_user(user_id)
```

**Code after**

```python
    def delete_user_with_rbac(
        self,
        user_id: int,
        *,
        reassign_global_items_to_user_id: Optional[int] = None,
        delete_private_items: bool = False,
    ) -> bool:
        user = self._user_service.get_user_by_id(user_id, include_inactive=True)
        if not user:
            return False
        username = user.get("username")

        impact = self.get_user_deletion_impact(user_id)

        if impact["requires_global_reassignment"] and (
            reassign_global_items_to_user_id is None
        ):
            raise UserDeletionBlockedError(impact)
        if impact["requires_private_confirmation"] and not delete_private_items:
            raise UserDeletionBlockedError(impact)

        from services.jobs.job_schedule_service import JobScheduleService
        from services.jobs.job_template_service import JobTemplateService

        template_service = JobTemplateService()
        schedule_service = JobScheduleService(template_service=template_service)

        # --- New steps first: run and commit atomically, before anything
        # below is touched, so a failure here leaves the user record and
        # all its other data completely untouched. ---
        if impact["requires_global_reassignment"]:
            target_user = self._user_service.get_user_by_id(
                reassign_global_items_to_user_id
            )
            if not target_user:
                raise RBACNotFoundError(
                    "User", reassign_global_items_to_user_id
                )
            from core.database import db_transaction

            with db_transaction() as db:
                template_service.reassign_global_templates(
                    old_created_by=username,
                    new_created_by=target_user["username"],
                    db=db,
                )
                schedule_service.reassign_global_schedules(
                    old_user_id=user_id,
                    new_user_id=target_user["id"],
                    db=db,
                )
            logger.info(
                "Reassigned global templates/schedules from user %s to user %s",
                username,
                target_user["username"],
            )

        if impact["requires_private_confirmation"]:
            from core.database import db_transaction

            with db_transaction() as db:
                # Schedules before templates: harmless either way given the
                # ORM cascade (see JobSchedule.template's
                # cascade="all, delete-orphan"), but this ordering means the
                # log below reports real, not-yet-cascaded counts for both.
                deleted_schedule_ids = schedule_service.delete_private_schedules_for_user(
                    user_id, db=db
                )
                deleted_template_ids = template_service.delete_private_templates_for_user(
                    user_id, db=db
                )
            logger.info(
                "Deleted %s private schedule(s) and %s private template(s) "
                "for user %s",
                len(deleted_schedule_ids),
                len(deleted_template_ids),
                username,
            )

        # --- Existing cleanup, unchanged below this point ---
        for role in self.get_user_roles(user_id):
            self.remove_role_from_user(user_id, role["id"])
        for override in self.get_user_permission_overrides(user_id):
            self.remove_permission_from_user(user_id, override["id"])
        cleanup_errors: list[str] = []
        if username:
            try:
                from services.settings.credentials_service import CredentialsService

                cred_svc = CredentialsService()
                deleted = cred_svc.delete_credentials_by_owner(username)
                logger.info(
                    "Deleted %s private credentials for user %s", deleted, username
                )
            except Exception as e:
                logger.warning(
                    "Failed to delete credentials for user %s: %s", username, e
                )
                cleanup_errors.append("credentials")
            try:
                from services.auth.profile_service import delete_user_profile

                delete_user_profile(username)
            except Exception as e:
                logger.warning("Failed to delete profile for user %s: %s", username, e)
                cleanup_errors.append("profile")

        if cleanup_errors:
            # Surface partial failure instead of silently reporting success.
            raise RBACConstraintError(
                f"User {user_id} deletion incomplete; failed to remove: "
                f"{', '.join(cleanup_errors)}"
            )
        return self._user_service.hard_delete_user(user_id)
```

`Optional` is already imported at the top of this file
(`from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple`).

#### 3.5.4 `bulk_delete_users_with_rbac` — no code change

Left as-is (`backend/services/auth/rbac_service.py:346-356`): it
already wraps each call in `try/except Exception` and appends
`f"User {uid}: {e}"` to the error list, so a `UserDeletionBlockedError`
for a given user now simply shows up there instead of crashing/leaving
bad state. Per §1.2, resolving blocking items through bulk delete is
out of scope — affected users must be deleted individually.

---

### 3.6 New Pydantic models

**File:** `backend/models/rbac.py`

Append at the end of the file (after `BulkUserDelete`):

```python
class UserDeletionImpactTemplate(BaseModel):
    """One template affected by a pending user deletion."""

    id: int
    name: str
    job_type: str


class UserDeletionImpactSchedule(BaseModel):
    """One schedule affected by a pending user deletion."""

    id: int
    job_identifier: str
    template_name: Optional[str] = None


class UserDeletionImpactCascadeSchedule(BaseModel):
    """A schedule owned by ANOTHER user that will be cascade-deleted if
    the departing user's private templates are removed."""

    id: int
    job_identifier: str
    owner_user_id: Optional[int] = None
    is_global: bool


class UserDeletionImpact(BaseModel):
    """Preview of what deleting a user would affect."""

    user_id: int
    username: str
    global_templates: List[UserDeletionImpactTemplate] = Field(default_factory=list)
    global_schedules: List[UserDeletionImpactSchedule] = Field(default_factory=list)
    private_templates: List[UserDeletionImpactTemplate] = Field(default_factory=list)
    private_schedules: List[UserDeletionImpactSchedule] = Field(default_factory=list)
    cascade_schedules_from_other_users: List[UserDeletionImpactCascadeSchedule] = (
        Field(default_factory=list)
    )
    private_credentials_count: int = 0
    requires_global_reassignment: bool = False
    requires_private_confirmation: bool = False
```

---

### 3.7 Router changes

**File:** `backend/routers/settings/rbac_users.py`

#### 3.7.1 Imports

**Code before**

```python
"""RBAC user management endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_role, verify_token
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_audit_log_service, get_rbac_service
from models.rbac import (
    BulkUserDelete,
    UserCreate,
    UserListResponse,
    UserResponse,
    UserUpdate,
)
from services.audit.audit_log_service import AuditLogService
from services.auth.exceptions import RBACNotFoundError
from services.auth.rbac_service import RBACService

logger = logging.getLogger(__name__)

router = APIRouter()
```

**Code after**

```python
"""RBAC user management endpoints."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_role, verify_token
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_audit_log_service, get_rbac_service
from models.rbac import (
    BulkUserDelete,
    UserCreate,
    UserDeletionImpact,
    UserListResponse,
    UserResponse,
    UserUpdate,
)
from services.audit.audit_log_service import AuditLogService
from services.auth.exceptions import (
    RBACConstraintError,
    RBACNotFoundError,
    UserDeletionBlockedError,
)
from services.auth.rbac_service import RBACService

logger = logging.getLogger(__name__)

router = APIRouter()
```

#### 3.7.2 New endpoint: preview deletion impact

Insert directly **before** the existing `delete_user` endpoint
(before line 166 of the current file):

```python
@router.get("/users/{user_id}/deletion-impact", response_model=UserDeletionImpact)
async def get_user_deletion_impact(
    user_id: int,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Preview what deleting this user would affect (admin only).

    Use this before calling DELETE /users/{user_id} to know whether
    reassign_global_items_to_user_id and/or delete_private_items will be
    required.
    """
    try:
        impact = rbac.get_user_deletion_impact(user_id)
        return UserDeletionImpact(**impact)
    except RBACNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error computing deletion impact for user %s: %s",
            user_id,
            str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to compute user deletion impact",
        )
```

#### 3.7.3 Updated `delete_user` endpoint

**Code before**

```python
@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """Delete a user and all RBAC associations (admin only)."""
    try:
        success = rbac.delete_user_with_rbac(user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
        audit_log.log_event(
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
            event_type="rbac-user-deleted",
            message=f"User '{user_id}' deleted",
            resource_type="user",
            resource_id=str(user_id),
            resource_name=str(user_id),
            severity="info",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting user %s: %s", user_id, str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user",
        )
```

**Code after**

```python
@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    reassign_global_items_to_user_id: Optional[int] = None,
    delete_private_items: bool = False,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """Delete a user and all RBAC associations (admin only).

    - If the user created any global job templates/schedules,
      `reassign_global_items_to_user_id` must be supplied — otherwise this
      returns 409 with a `UserDeletionImpact` body describing what's
      blocking (call GET .../deletion-impact first to preview it).
    - If the user owns any private job templates/schedules,
      `delete_private_items=true` must be supplied to confirm their
      removal — otherwise 409, same impact body.
    """
    try:
        success = rbac.delete_user_with_rbac(
            user_id,
            reassign_global_items_to_user_id=reassign_global_items_to_user_id,
            delete_private_items=delete_private_items,
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
        audit_log.log_event(
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
            event_type="rbac-user-deleted",
            message=f"User '{user_id}' deleted",
            resource_type="user",
            resource_id=str(user_id),
            resource_name=str(user_id),
            severity="info",
            extra_data={
                "reassigned_global_items_to_user_id": reassign_global_items_to_user_id,
                "deleted_private_items": delete_private_items,
            },
        )
    except HTTPException:
        raise
    except UserDeletionBlockedError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "User deletion requires additional confirmation",
                "impact": e.impact,
            },
        )
    except RBACNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RBACConstraintError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error("Error deleting user %s: %s", user_id, str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user",
        )
```

`reassign_global_items_to_user_id`/`delete_private_items` are declared
as plain query parameters (FastAPI infers this automatically for
non-body-model, non-path params on a function with no request body) —
deliberately not a JSON request body, to avoid relying on DELETE
requests carrying a body (inconsistently supported by some HTTP
clients/proxies). Frontend call shape:
`DELETE /settings/rbac/users/5?reassign_global_items_to_user_id=2&delete_private_items=true`.

---

## 4. Frontend (not implemented here — sequencing note only)

Out of scope for this backend-focused plan, but the intended UX this
API enables:

1. Admin clicks "Delete user" → frontend calls
   `GET /settings/rbac/users/{id}/deletion-impact` first.
2. If `requires_global_reassignment`, show a user picker
   ("Reassign N global template(s)/schedule(s) to:") and require a
   selection before enabling the delete button.
3. If `requires_private_confirmation`, show the list of private
   templates/schedules (plus, if non-empty,
   `cascade_schedules_from_other_users` as a distinct warning: "N
   schedule(s) belonging to other users reference these templates and
   will also be removed") and require an explicit checkbox/confirm.
4. Call `DELETE /settings/rbac/users/{id}?...` with the resolved
   parameters. A `409` mid-flow (e.g. impact changed between preview
   and delete) should re-fetch the impact and re-prompt rather than
   retry blindly.

---

## 5. Tests

### 5.1 Update existing `RBACService` tests to mock the new dependency

**File:** `backend/tests/unit/services/test_rbac_service.py`

These three existing tests currently pass without mocking
`JobTemplateService`/`JobScheduleService` because
`delete_user_with_rbac` never touched them. After §3.5.3, it always
calls `get_user_deletion_impact`, which constructs real
`JobTemplateService()`/`JobScheduleService()` instances backed by real
repositories that hit the DB. Since this test file is explicitly
"offline — no database required", **these three tests must be updated**
to monkeypatch the two new lookup methods to return empty lists
(no owned items → `requires_global_reassignment` and
`requires_private_confirmation` both `False`, so behavior is unchanged
from before):

```python
    def test_delete_removes_user_and_cleans_roles(
        self, rbac_svc: RBACService, alice_id: int, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        import services.jobs.job_schedule_service as schedule_service_module
        import services.jobs.job_template_service as template_service_module

        monkeypatch.setattr(
            template_service_module.JobTemplateService,
            "get_templates_created_by",
            lambda self, username: [],
        )
        monkeypatch.setattr(
            schedule_service_module.JobScheduleService,
            "get_schedules_owned_by",
            lambda self, user_id: [],
        )

        role = rbac_svc.create_role("editor")
        rbac_svc.assign_role_to_user(alice_id, role["id"])

        result = rbac_svc.delete_user_with_rbac(alice_id)
        assert result is True
        assert rbac_svc.get_user_with_rbac(alice_id, include_inactive=True) is None
        # Role still exists; only the assignment should be gone
        assert rbac_svc.get_role(role["id"]) is not None
```

Apply the same two `monkeypatch.setattr(...)` calls at the top of
`test_bulk_delete_users_with_rbac` and
`test_delete_raises_and_keeps_user_when_credential_cleanup_fails`.
Consider factoring them into a `no_owned_job_items` autouse fixture
scoped to `TestDeleteUserWithRBAC` if that reads cleaner.

### 5.2 New `RBACService` tests

Add to `TestDeleteUserWithRBAC` in the same file (still using the
`get_templates_created_by`/`get_schedules_owned_by` monkeypatches from
§5.1 as the default "nothing owned" baseline, then overriding return
values per test):

- `test_delete_blocked_when_user_owns_global_template_without_reassignment`:
  monkeypatch `get_templates_created_by` to return one dict with
  `is_global=True`; call `delete_user_with_rbac(alice_id)` with no
  `reassign_global_items_to_user_id` → assert
  `pytest.raises(UserDeletionBlockedError)` and that
  `exc.value.impact["requires_global_reassignment"] is True`; assert
  the user still exists afterward.
- `test_delete_reassigns_global_items_then_succeeds`: same setup, but
  also monkeypatch `JobTemplateService.reassign_global_templates` and
  `JobScheduleService.reassign_global_schedules` to record their call
  args on a list; call with a valid
  `reassign_global_items_to_user_id=<a second seeded user>`; assert
  both reassignment methods were called with the expected
  `old_created_by`/`new_created_by` (or `old_user_id`/`new_user_id`),
  and that the delete succeeds.
- `test_delete_blocked_when_user_owns_private_template_without_confirmation`:
  monkeypatch `get_templates_created_by` to return one
  `is_global=False` dict; call without `delete_private_items` →
  `UserDeletionBlockedError` with
  `impact["requires_private_confirmation"] is True`; user still
  exists.
- `test_delete_removes_private_items_when_confirmed`: same setup, plus
  monkeypatch `JobTemplateService.delete_private_templates_for_user`
  and `JobScheduleService.delete_private_schedules_for_user` to record
  calls; call with `delete_private_items=True` → both called with
  `alice_id`, delete succeeds.
- `test_delete_reassign_target_user_not_found_raises`: global item
  present, `reassign_global_items_to_user_id=99999` (nonexistent) →
  `pytest.raises(RBACNotFoundError)`.

Add a new `TestGetUserDeletionImpact` class:

- `test_impact_reports_no_items_for_clean_user`: default monkeypatched
  empty lists → both `requires_*` flags `False`, all list fields `[]`.
- `test_impact_splits_global_vs_private`: `get_templates_created_by`
  returns one global + one private dict;
  `get_schedules_owned_by` returns one global + one private dict →
  assert they land in the correct `global_*`/`private_*` impact lists.
- `test_impact_reports_cascade_schedules_from_other_users`:
  `get_templates_created_by` returns one private template (id=5);
  monkeypatch `JobScheduleService.get_schedules_for_templates` to
  return one schedule with `user_id != alice_id` when called with
  `[5]` → assert it appears in
  `cascade_schedules_from_other_users`, and that a schedule with
  `user_id == alice_id` in that same list is excluded (it's the user's
  own, already counted in `private_schedules`, not a "cascade
  surprise").
- `test_impact_raises_not_found_for_missing_user`:
  `get_user_deletion_impact(99999)` → `RBACNotFoundError`.

### 5.3 Repository unit tests

**File:** `backend/tests/unit/repositories/test_job_template_repository.py` /
`test_job_schedule_repository.py` (create if they don't already exist —
check first; if templates/schedules currently have no direct
repository-level tests, add a new minimal file using a real in-memory
SQLite session, consistent with `CLAUDE.md`'s "in-memory SQLite in
unit tests is acceptable when queries do not rely on
PostgreSQL-only features" — these queries (`filter`, `.in_()`, bulk
`.update()`) are portable).

Cover, at minimum:

- `get_by_created_by` returns both global and private templates for a
  given username, and excludes other users' templates.
- `reassign_global_by_created_by` updates `created_by` only on rows
  where `is_global=True`, leaves private rows with the old
  `created_by` untouched.
- `delete_by_user_id` (templates) deletes only `is_global=False` rows
  for that user, and — using a real (non-mocked) SQLite session so the
  ORM cascade actually runs — that a `JobSchedule` row referencing a
  deleted private template is also removed (proves the cascade
  documented in §2.3 is real, not assumed).
- `get_by_owner` (schedules) returns both global and private rows for
  a `user_id`, strictly (no `OR is_global` widening to other users'
  globals).
- `reassign_global_by_owner` / `delete_by_user_id` (schedules): same
  shape as the template versions.
- `get_by_template_ids` returns schedules across multiple owners for a
  set of template ids, empty list short-circuits without a query.

### 5.4 Router tests

**File:** `backend/tests/unit/core/test_rbac_users_router.py` (create
if it doesn't exist — check first; model on
`tests/unit/core/test_servers_router.py`'s `TestClient` +
`app.dependency_overrides` + lifespan-mocking fixture pattern).

- `GET /settings/rbac/users/{id}/deletion-impact` → 200 with the
  mocked impact dict, for an admin caller; 404 for unknown user.
- `DELETE /settings/rbac/users/{id}` with no query params, service
  raising `UserDeletionBlockedError(impact)` → 409, body
  `{"detail": {"message": ..., "impact": {...}}}`.
- Same endpoint with `reassign_global_items_to_user_id` and
  `delete_private_items=true` supplied, service returning `True` → 204.
- Regression test for the `except HTTPException: raise` ordering
  already fixed in `PRIAVTE_GLOBAL_CREDENTIALS.md`: not applicable to
  this router (it already had the guard), but do verify
  `RBACNotFoundError`/`RBACConstraintError` map to 404/409 and not 500
  now that they're explicitly caught.

Remember (`CLAUDE.md` testing conventions): clean up
`app.dependency_overrides` in a `finally`/fixture teardown.

---

## 6. Rollout steps

1. Implement §3.1–§3.7 in order (§3.1 first — the other pieces depend
   on schedules reliably recording `user_id`).
2. Update the three existing tests per §5.1 — do this *before* running
   the suite, or they will fail/hang trying to reach a real DB.
3. Add new tests per §5.2–§5.4.
4. `cd backend && ruff format . && ruff check --fix .`
5. `cd backend && pytest -q` — full suite green.
6. Deploy.
7. Manual smoke test against a throwaway user (replace `$TOKEN`,
   `$ADMIN_ID`, `$OTHER_ID`):
   ```bash
   # Preview impact
   curl -s http://localhost:8000/settings/rbac/users/$ADMIN_ID/deletion-impact \
     -H "Authorization: Bearer $TOKEN" | jq

   # Attempt delete without resolving blocking items -> expect 409
   curl -s -o /dev/null -w '%{http_code}\n' \
     -X DELETE http://localhost:8000/settings/rbac/users/$ADMIN_ID \
     -H "Authorization: Bearer $TOKEN"

   # Delete with reassignment + private-item confirmation -> expect 204
   curl -s -o /dev/null -w '%{http_code}\n' \
     -X DELETE "http://localhost:8000/settings/rbac/users/$ADMIN_ID?reassign_global_items_to_user_id=$OTHER_ID&delete_private_items=true" \
     -H "Authorization: Bearer $TOKEN"
   ```

---

## 7. Follow-ups (out of scope for this plan)

- **Full transactional `delete_user_with_rbac`.** Retrofit
  `RBACRepository`, the profile repository, and
  `CredentialsRepository` to accept an optional shared `db: Session`
  (mirroring the pattern `BaseRepository` and this plan's new
  repository methods already use), and wrap the *entire*
  `delete_user_with_rbac` body — including role/permission removal,
  credential deletion, profile deletion, and the final
  `hard_delete_user` — in one `db_transaction()` block. This plan only
  makes its own new steps atomic; the pre-existing gap between
  credential/profile cleanup and the final hard delete (§1.2) remains.
- **Validate `job_template_id` ownership at schedule-creation time.**
  Same class of issue as the `credential_id` IDOR fixed in
  `PRIAVTE_GLOBAL_CREDENTIALS.md`: `create_job_schedule` never checks
  that `job_template_id` is a global template or one owned by the
  requesting user. Unverified whether this is exploitable in practice
  (would need the same investigation pass as the credentials case) —
  worth a dedicated look.
- **Frontend implementation** of the confirmation UX described in §4.
- Consider whether `toggle_user_activation` (soft-deactivate, not
  delete) should also surface a warning when deactivating a user who
  owns private templates/schedules — today deactivation leaves those
  rows completely untouched and accessible to no one (not broken, just
  orphaned/unmanageable until the account is reactivated or deleted
  through this new flow).
</content>
