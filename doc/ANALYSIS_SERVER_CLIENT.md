# Server Feature — Backend Analysis & Fix Plan

**Date:** 2026-06-01  
**Scope:** `backend/routers/servers/`, `backend/services/servers/`, `backend/repositories/servers/`, `backend/core/models/servers.py`, `backend/models/servers.py`  
**Frontend trigger:** `frontend/src/components/features/server-clients/server/`

---

## 1. Findings

### 1.1 Bug — `update_server` cannot clear nullable fields (HIGH)

**File:** `backend/routers/servers/servers.py:97`

```python
updates = {k: v for k, v in request.model_dump().items() if v is not None}
```

The `if v is not None` filter silently discards every field that was explicitly set to `null` in the request body. As a result, a client cannot clear an optional field such as `contact`, `cluster`, or `location` once it has been set. The field is simply ignored on every PUT where the client sends `null`.

**Root cause:** `model_dump()` without `exclude_unset=True` returns all fields including defaults. The subsequent `None` filter conflates "not sent by the client" with "explicitly cleared to null".

---

### 1.2 Bug — `group_by` query parameter is accepted but never used (MEDIUM)

**Files:** `backend/routers/servers/servers.py:32-53`, `backend/services/servers/servers_service.py:29-36`

The router declares:
```python
_ALLOWED_GROUP_BY = frozenset({"location", "distribution_release", "distribution_version", "contact"})

group_by: Optional[str] = Query(None, description="Group servers by field …")
```

Neither the frozenset nor the `group_by` variable are referenced anywhere in `list_servers`. The service has a `get_grouped()` method that is never called. The module-level docstring advertises `?group_by=<field>` as a working feature.

The `_ALLOWED_GROUP_BY` frozenset was clearly written in anticipation of wiring `get_grouped()` into the router but the wiring was never completed.

---

### 1.3 Security — `get_grouped()` uses unchecked `getattr` on the ORM model (MEDIUM)

**File:** `backend/services/servers/servers_service.py:34`

```python
key = getattr(server, group_by, None) or "Uncategorized"
```

`group_by` originates from untrusted user input (query string). If a caller passes an arbitrary Python attribute name — for example `_sa_instance_state`, `metadata`, or any SQLAlchemy internal — `getattr` will silently return an object rather than raise an error, potentially leaking internal state in the grouped-response keys. Because `get_grouped()` is currently unreachable from the router this is a latent vulnerability, but it will become exploitable the moment the wiring is added.

---

### 1.4 Security / DoS — No size limit on `ansible_facts` payload (MEDIUM)

**Files:** `backend/models/servers.py:39`, `backend/models/servers.py:80`

```python
ansible_facts: Optional[Dict[str, Any]] = None
```

A client with `servers:write` permission can POST or PUT any size JSON object as `ansible_facts`. Real Ansible facts from a single host can exceed 500 KB. There is no Pydantic validator capping the serialised size, no column-level constraint, and no middleware limit specific to this field. Repeated large writes could degrade database performance or exhaust storage.

---

### 1.5 Data Integrity — No `UNIQUE` constraint on `hostname` (MEDIUM)

**File:** `backend/core/models/servers.py:14`

```python
hostname = Column(String(255), nullable=False, index=True)
```

The column has a plain B-tree index but no uniqueness guarantee. Two `POST /api/servers` calls with the same hostname succeed and create duplicate rows. Downstream logic (Ansible playbooks, inventory exports, CheckMK sync) that assumes hostnames are unique will silently operate on incorrect data.

---

### 1.6 Model/Schema Drift — `JSON` type in model vs `JSONB` in database (LOW)

**File:** `backend/core/models/servers.py:1,15-30`

Migration `035_fix_server_location_to_jsonb.py` converted `servers.location` to `JSONB` in the live database. All other JSON columns (`cluster`, `ansible_facts`, `selected_interfaces`) were created with plain `JSON`. The SQLAlchemy model imports and uses `JSON` for all of them, creating a mismatch between the ORM declaration and the actual column type for `location`.

While SQLAlchemy's generic `JSON` type maps to whatever the column actually is at the DB level, using `JSONB` explicitly in the model:
- makes the actual column type self-documenting,
- enables SQLAlchemy to generate correct DDL if the schema is ever re-created from models,
- allows future use of JSONB-specific operators (containment `@>`, GIN indexes).

---

### 1.7 Code Quality — Untyped `**kwargs` in service methods (LOW)

**File:** `backend/services/servers/servers_service.py:17,23`

```python
def create(self, **kwargs: Any) -> Server:
def update(self, server_id: int, **kwargs: Any) -> Optional[Server]:
```

The service accepts fully untyped keyword arguments and forwards them directly to the repository (which forwards them to the SQLAlchemy model constructor). There is no static-analysis guarantee that only valid `Server` column names are passed. A typo in a column name fails silently at runtime — the key is set on the ORM object but not persisted because SQLAlchemy ignores unknown attributes passed to the model constructor.

---

### 1.8 Input Validation — No format validation on `primary_ipv4` and `nautobot_uuid` (LOW)

**File:** `backend/models/servers.py:52,58`

```python
primary_ipv4: Optional[str] = Field(None, max_length=50)
nautobot_uuid: Optional[str] = Field(None, max_length=255)
```

- `primary_ipv4` accepts any string up to 50 characters. An invalid value like `"not-an-ip"` is stored and returned to clients.
- `nautobot_uuid` accepts any string up to 255 characters. A valid UUID4 has a fixed format; storing arbitrary strings breaks downstream Nautobot API calls that expect a real UUID.

---

## 2. Fix Plan

### Fix 1 — `update_server`: use `exclude_unset=True` to support null-clearing

**Priority:** HIGH — correctness bug affecting every PUT request.

**File to edit:** `backend/routers/servers/servers.py`

**Change:**

```python
# BEFORE (line 97)
updates = {k: v for k, v in request.model_dump().items() if v is not None}

# AFTER
updates = request.model_dump(exclude_unset=True)
```

`exclude_unset=True` returns only the fields that the client actually sent. A field sent as `null` is included with value `None` (allowing the repository to clear it). A field not sent at all is excluded (preserving the existing DB value). Remove the `if v is not None` filter entirely — the repository's `update()` will call `setattr` for every key in the dict, including those set to `None`.

**Verification:**
1. PUT `{"contact": null}` → `contact` column becomes `NULL` in DB.
2. PUT `{"hostname": "new-name"}` (no other fields) → only `hostname` changes; `contact` unchanged.
3. PUT `{"cluster": null}` → `cluster` JSON column becomes `NULL`.

---

### Fix 2 — Wire `group_by` into `list_servers` with proper validation

**Priority:** MEDIUM — dead code / misleading API contract.

**Files to edit:** `backend/routers/servers/servers.py`

**Change:**

```python
@router.get("", response_model=ListServersResponse)
async def list_servers(
    group_by: Optional[str] = Query(
        None, description="Group servers by field (location, distribution_release, …)"
    ),
    _: dict = Depends(require_permission("servers", "read")),
    service: ServersService = Depends(get_servers_service),
) -> ListServersResponse:
    if group_by is not None and group_by not in _ALLOWED_GROUP_BY:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid group_by value. Allowed: {sorted(_ALLOWED_GROUP_BY)}",
        )
    try:
        servers = service.get_all()
        return ListServersResponse(
            servers=[ServerResponse.model_validate(s) for s in servers],
            total=len(servers),
        )
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to list servers", exc)
```

Note: The actual grouping response shape (nested dict vs flat list with a `group` key) needs a product decision before adding `get_grouped()` to the response. Until that decision is made, accept and validate the parameter but keep returning the flat list. This at minimum makes the parameter safe and eliminates dead code.

If the grouped response is desired, add `GroupedServersResponse` to `models/servers.py` and wire `service.get_grouped(group_by)` as an alternative return path.

---

### Fix 3 — Guard `get_grouped()` against arbitrary attribute access

**Priority:** MEDIUM — latent security issue, activated when Fix 2 is fully wired.

**File to edit:** `backend/services/servers/servers_service.py`

**Change:**

```python
_ALLOWED_GROUP_BY = frozenset(
    {"location", "distribution_release", "distribution_version", "contact"}
)

def get_grouped(self, group_by: str) -> Dict[str, List[Server]]:
    if group_by not in _ALLOWED_GROUP_BY:
        raise ValueError(f"group_by must be one of {sorted(_ALLOWED_GROUP_BY)}")
    servers = self._repo.get_all()
    groups: Dict[str, List[Server]] = {}
    for server in servers:
        raw = getattr(server, group_by, None)
        # JSON columns (location) are dicts — extract 'name' for display
        if isinstance(raw, dict):
            key = raw.get("name") or "Uncategorized"
        else:
            key = str(raw) if raw is not None else "Uncategorized"
        groups.setdefault(key, []).append(server)
    return dict(sorted(groups.items()))
```

Move the `_ALLOWED_GROUP_BY` constant from the router into the service so the validation is co-located with the `getattr` call, and the router simply passes the validated value. The router's copy can remain as a cross-check or be removed.

---

### Fix 4 — Add `ansible_facts` size validator

**Priority:** MEDIUM — DoS / storage abuse vector.

**File to edit:** `backend/models/servers.py`

Add a `field_validator` to both `CreateServerRequest` and `UpdateServerRequest`:

```python
import json
from pydantic import field_validator

_ANSIBLE_FACTS_MAX_BYTES = 512 * 1024  # 512 KB

class CreateServerRequest(BaseModel):
    # ... existing fields ...

    @field_validator("ansible_facts", mode="before")
    @classmethod
    def validate_ansible_facts_size(cls, v: Any) -> Any:
        if v is None:
            return v
        size = len(json.dumps(v).encode())
        if size > _ANSIBLE_FACTS_MAX_BYTES:
            raise ValueError(
                f"ansible_facts exceeds maximum allowed size of {_ANSIBLE_FACTS_MAX_BYTES // 1024} KB"
            )
        return v
```

Apply the same validator to `UpdateServerRequest`. Export `_ANSIBLE_FACTS_MAX_BYTES` as a named constant so the limit is visible and adjustable.

---

### Fix 5 — Add `UNIQUE` constraint on `hostname`

**Priority:** MEDIUM — data integrity.

**Step A — Update the SQLAlchemy model:**

`backend/core/models/servers.py`:
```python
hostname = Column(String(255), nullable=False, index=True, unique=True)
```

**Step B — Write a migration:**

Create `backend/migrations/versions/040_add_unique_hostname_to_servers.py`:

```python
"""Migration 040: Add unique constraint on servers.hostname."""

from migrations.base import BaseMigration


class Migration(BaseMigration):
    version = 40

    def up(self, conn):
        # Deduplicate existing rows first — keep the row with the lowest id
        conn.execute("""
            DELETE FROM servers
            WHERE id NOT IN (
                SELECT MIN(id) FROM servers GROUP BY hostname
            )
        """)
        conn.execute(
            "ALTER TABLE servers ADD CONSTRAINT uq_servers_hostname UNIQUE (hostname)"
        )

    def down(self, conn):
        conn.execute(
            "ALTER TABLE servers DROP CONSTRAINT IF EXISTS uq_servers_hostname"
        )

    def describe(self):
        return "Add unique constraint on servers.hostname (deduplicates existing rows)"
```

**Important:** The `up` migration deduplicates before adding the constraint. On a production database this must be reviewed manually to confirm which duplicates to drop. Consider adding a pre-flight check that lists duplicates before running.

---

### Fix 6 — Use `JSONB` in the SQLAlchemy model for all JSON columns

**Priority:** LOW — schema clarity and correctness.

**File to edit:** `backend/core/models/servers.py`

```python
# BEFORE
from sqlalchemy.dialects.postgresql import JSON

location = Column(JSON, nullable=True)
cluster = Column(JSON, nullable=True)
ansible_facts = Column(JSON, nullable=True)
selected_interfaces = Column(JSON, nullable=True)

# AFTER
from sqlalchemy.dialects.postgresql import JSONB

location = Column(JSONB, nullable=True)
cluster = Column(JSONB, nullable=True)
ansible_facts = Column(JSONB, nullable=True)
selected_interfaces = Column(JSONB, nullable=True)
```

**Step B — Write a migration for the remaining non-JSONB columns:**

Create `backend/migrations/versions/041_convert_server_json_columns_to_jsonb.py`:

```python
"""Migration 041: Convert remaining servers JSON columns to JSONB."""

from migrations.base import BaseMigration


class Migration(BaseMigration):
    version = 41

    def up(self, conn):
        for col in ("cluster", "ansible_facts", "selected_interfaces"):
            conn.execute(f"""
                ALTER TABLE servers
                    ALTER COLUMN {col} TYPE JSONB
                    USING {col}::JSONB
            """)

    def down(self, conn):
        for col in ("cluster", "ansible_facts", "selected_interfaces"):
            conn.execute(f"""
                ALTER TABLE servers
                    ALTER COLUMN {col} TYPE JSON
                    USING {col}::JSON
            """)

    def describe(self):
        return "Convert servers cluster/ansible_facts/selected_interfaces from JSON to JSONB"
```

---

### Fix 7 — Type the service methods explicitly

**Priority:** LOW — code quality and static analysis.

**File to edit:** `backend/services/servers/servers_service.py`

Replace the untyped `**kwargs` signatures with explicitly typed parameters using a `TypedDict` or dataclass imported from `models/servers.py`. The simplest approach that stays consistent with the existing codebase is to pass the Pydantic model directly:

```python
from models.servers import CreateServerRequest, UpdateServerRequest

class ServersService:
    def __init__(self, repository: ServersRepository) -> None:
        self._repo = repository

    def get_all(self) -> List[Server]:
        return self._repo.get_all()

    def get_by_id(self, server_id: int) -> Optional[Server]:
        return self._repo.get_by_id(server_id)

    def create(self, data: CreateServerRequest) -> Server:
        fields = data.model_dump()
        if fields.get("is_virtual") is None:
            facts = fields.get("ansible_facts") or {}
            fields["is_virtual"] = facts.get("ansible_virtualization_role") == "guest"
        return self._repo.create(**fields)

    def update(self, server_id: int, data: UpdateServerRequest) -> Optional[Server]:
        fields = data.model_dump(exclude_unset=True)
        return self._repo.update(server_id, **fields)

    def delete(self, server_id: int) -> bool:
        return self._repo.delete(server_id)
```

Update the router to pass the request object directly:

```python
# create_server
server = service.create(request)

# update_server — remove the manual dict comprehension, handled in service
server = service.update(server_id, request)
```

This moves Fix 1 (`exclude_unset=True`) into the service where it belongs, and the router becomes a pure delegation layer.

---

### Fix 8 — Add format validators for `primary_ipv4` and `nautobot_uuid`

**Priority:** LOW — input validation at system boundary.

**File to edit:** `backend/models/servers.py`

```python
import re
from pydantic import field_validator
from pydantic.networks import IPvAnyAddress

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

class CreateServerRequest(BaseModel):
    primary_ipv4: Optional[str] = Field(None, max_length=50)
    nautobot_uuid: Optional[str] = Field(None, max_length=36)

    @field_validator("primary_ipv4", mode="before")
    @classmethod
    def validate_ipv4(cls, v: Any) -> Any:
        if v is None:
            return v
        try:
            IPvAnyAddress(v)
        except Exception:
            raise ValueError(f"primary_ipv4 must be a valid IP address, got: {v!r}")
        return v

    @field_validator("nautobot_uuid", mode="before")
    @classmethod
    def validate_uuid(cls, v: Any) -> Any:
        if v is None:
            return v
        if not _UUID_RE.match(str(v)):
            raise ValueError(f"nautobot_uuid must be a valid UUID4, got: {v!r}")
        return v
```

Apply the same validators to `UpdateServerRequest`. Reduce `nautobot_uuid` max_length from 255 to 36 (the fixed length of a UUID string).

---

## 3. Implementation Order

| Step | Fix | Risk | Effort |
|------|-----|------|--------|
| 1 | Fix 1 — `exclude_unset=True` | Low — no schema change | 5 min |
| 2 | Fix 7 — Type service methods | Low — internal refactor | 20 min |
| 3 | Fix 3 — Guard `get_grouped()` | Low — defensive | 10 min |
| 4 | Fix 2 — Wire `group_by` validation | Low — adds 400 guard | 10 min |
| 5 | Fix 8 — IP / UUID validators | Low — tightens input | 15 min |
| 6 | Fix 4 — `ansible_facts` size limit | Low — adds validator | 10 min |
| 7 | Fix 5 — Unique hostname + migration 040 | Medium — alters DB | 30 min |
| 8 | Fix 6 — JSONB model + migration 041 | Medium — alters DB | 20 min |

Steps 1-6 require no database migrations and can be shipped as a single PR. Steps 7-8 involve schema changes and should be reviewed and tested against a staging database before deploying.

---

## 4. Testing Checklist

After applying all fixes, verify:

- [ ] `PUT /api/servers/{id}` with `{"contact": null}` → `contact` is `NULL` in DB
- [ ] `PUT /api/servers/{id}` with `{"hostname": "x"}` only → all other fields unchanged
- [ ] `GET /api/servers?group_by=invalid` → `400 Bad Request`
- [ ] `GET /api/servers?group_by=location` → `200` with flat server list (until grouped response is implemented)
- [ ] `POST /api/servers` with `ansible_facts` > 512 KB → `422 Unprocessable Entity`
- [ ] `POST /api/servers` with `primary_ipv4: "not-an-ip"` → `422 Unprocessable Entity`
- [ ] `POST /api/servers` with `nautobot_uuid: "not-a-uuid"` → `422 Unprocessable Entity`
- [ ] `POST /api/servers` twice with the same hostname → second call returns `409 Conflict` (after Fix 5 migration)
- [ ] Existing unit tests pass: `pytest tests/unit/ -q`
- [ ] Router regression guards pass: `python scripts/check_http_500_leaks.py`, `python scripts/check_router_repositories.py`
