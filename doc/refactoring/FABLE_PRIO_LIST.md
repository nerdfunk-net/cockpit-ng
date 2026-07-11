# Refactoring Plan — FABLE Prioritized Action List

**Source analysis:** `doc/FABLE_ANALYSIS.md`
**Date:** 2026-07-12
**Status:** ✅ **ALL ITEMS DONE** (implemented 2026-07-12) — see per-item status below.
**Goal:** Close the security and robustness gaps found in the backend audit with small, low-risk, copy-pasteable changes.

Each item below is self-contained: a **Why**, the **Before** code, the **After** code, exact file/line anchors, and a **Verify** step. Items are ordered by priority. You can ship them one PR at a time.

> **Implementation note:** P2-2's actual leak count in `services/` was larger than
> the representative list below (17 sites across 5 files, including one file —
> `services/nautobot/offboarding/service.py` — not originally called out); all
> were fixed and the widened `check_http_500_leaks.py` guard now passes clean.
> P3-1's caching also required cache invalidation on role/permission
> grant-revoke (not just the TTL-only version) plus a `FakeCacheService` test
> double, after the naive version broke `test_rbac_enforcement_pg.py` via
> cross-test cache staleness. Full backend suite: 2388 passed, 3 skipped.

---

## Legend

| Priority | Meaning |
|----------|---------|
| 🔴 P1 | Security hole — ship first |
| 🟠 P2 | Correctness / robustness |
| 🟢 P3 | Performance / maintainability |

**After every change run:**
```bash
cd backend
ruff format . && ruff check --fix .
python scripts/check_http_500_leaks.py
pytest -q
```

---

## ✅ DONE — 🔴 P1-1 — Authenticate the GraphQL proxy

**Why:** `POST /api/nautobot/graphql` currently accepts unauthenticated requests and forwards arbitrary GraphQL to Nautobot with the backend's privileged token, bypassing all RBAC.

**File:** `backend/main.py` (~line 306)

### Before
```python
@app.post("/api/nautobot/graphql")
async def nautobot_graphql_endpoint(
    query_data: dict,
    request: Request,
):
    """
    Execute GraphQL query against Nautobot - compatibility endpoint.

    This endpoint maintains backward compatibility with existing frontend code.
    """
    from fastapi import HTTPException, status

    nautobot_service = request.app.state.nautobot_service
```

### After
```python
@app.post(
    "/api/nautobot/graphql",
    dependencies=[Depends(require_permission("nautobot", "read"))],
)
async def nautobot_graphql_endpoint(
    query_data: dict,
    request: Request,
):
    """
    Execute GraphQL query against Nautobot - compatibility endpoint.

    Requires the ``nautobot:read`` permission. This endpoint forwards queries
    to Nautobot using the backend service token, so it MUST stay authenticated
    to avoid RBAC bypass.
    """
    from fastapi import HTTPException, status

    nautobot_service = request.app.state.nautobot_service
```

**Add the import** near the top of `main.py` (next to the other `core` imports):
```python
from core.auth import require_permission
```

**Verify:**
```bash
# Unauthenticated request must now be rejected (401), authenticated allowed.
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/nautobot/graphql \
  -H "Content-Type: application/json" -d '{"query":"{ __typename }"}'   # expect 401
```

> **Note:** if any read-only frontend page relies on this endpoint, confirm the calling user's role includes `nautobot:read`. If a lighter gate is needed, swap to `Depends(verify_token)` (authentication only). Do not leave it open.

---

## ✅ DONE — 🔴 P1-2 — Verify OIDC `state` server-side (CSRF)

**Why:** `state` is generated with good entropy but never stored, so the callback can't verify it — the CSRF protection is effectively absent. We already have a Redis cache service (`build_cache_service()`), so store the issued state with a short TTL and require an exact match on callback.

### Step 1 — store state when issuing the auth URL

**File:** `backend/routers/auth/oidc.py`, `oidc_login` (~line 98)

#### Before
```python
    try:
        config = await oidc_service.get_oidc_config(provider_id)
        state = oidc_service.generate_state()

        # Include provider_id in state for callback validation
        state_with_provider = f"{provider_id}:{state}"

        # Generate authorization URL
        auth_url = oidc_service.generate_authorization_url(
            provider_id, config, state_with_provider, redirect_uri
        )
```

#### After
```python
    try:
        config = await oidc_service.get_oidc_config(provider_id)
        state = oidc_service.generate_state()

        # Include provider_id in state for callback validation
        state_with_provider = f"{provider_id}:{state}"

        # Persist the issued state so the callback can verify it (CSRF defense).
        # TTL matches a realistic auth round-trip window.
        _store_oidc_state(state_with_provider)

        # Generate authorization URL
        auth_url = oidc_service.generate_authorization_url(
            provider_id, config, state_with_provider, redirect_uri
        )
```

### Step 2 — add the helper (module-level, near the top of `oidc.py`)

```python
import service_factory

# OIDC state lives in Redis for one auth round-trip. 10 minutes is generous
# for a human completing the provider login and returning.
_OIDC_STATE_TTL_SECONDS = 600
_OIDC_STATE_PREFIX = "oidc-state"


def _store_oidc_state(state: str) -> None:
    """Persist an issued OIDC state token for later single-use verification."""
    cache = service_factory.build_cache_service()
    cache.set(f"{_OIDC_STATE_PREFIX}:{state}", "1", _OIDC_STATE_TTL_SECONDS)


def _consume_oidc_state(state: str) -> bool:
    """Return True exactly once for a valid, unexpired state, then delete it."""
    cache = service_factory.build_cache_service()
    key = f"{_OIDC_STATE_PREFIX}:{state}"
    if cache.get(key) is None:
        return False
    cache.delete(key)  # single-use: prevent replay
    return True
```

### Step 3 — verify (and consume) in the callback

**File:** `backend/routers/auth/oidc.py`, `oidc_callback` (~line 211)

#### Before
```python
    try:
        # Validate state parameter includes correct provider_id
        if callback_data.state:
            state_parts = callback_data.state.split(":", 1)
            if len(state_parts) == 2:
                state_provider_id, _ = state_parts
                if state_provider_id != provider_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="State parameter provider mismatch",
                    )
```

#### After
```python
    try:
        # Validate state: must be present, match this provider, AND match a
        # state we actually issued (single-use, unexpired). This is the CSRF
        # defense — without the server-side check the state is unverifiable.
        if not callback_data.state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing state parameter",
            )

        state_parts = callback_data.state.split(":", 1)
        if len(state_parts) != 2 or state_parts[0] != provider_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="State parameter provider mismatch",
            )

        if not _consume_oidc_state(callback_data.state):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired state parameter",
            )
```

> Apply the same `_store_oidc_state(...)` call in `oidc_test_login` (~line 147) so the test flow also round-trips a verifiable state.

**Verify:**
```bash
# A callback with a state that was never issued must be rejected.
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:8000/auth/oidc/<provider>/callback \
  -H "Content-Type: application/json" \
  -d '{"code":"x","state":"<provider>:forged","redirect_uri":"..."}'   # expect 400
```
Plus a full happy-path login through the UI to confirm a legitimately issued state still authenticates.

---

## ✅ DONE — 🟠 P2-1 — CSP + HSTS headers, drop `X-XSS-Protection`

**Why:** No `Content-Security-Policy` or `Strict-Transport-Security`. `X-XSS-Protection` is deprecated and OWASP now recommends against it.

**File:** `backend/main.py`, `security_headers` middleware (~line 177)

### Before
```python
@app.middleware("http")
async def security_headers(request: Request, call_next) -> Response:
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response
```

### After
```python
# Content-Security-Policy for the JSON API + self-hosted Swagger UI assets.
# The API returns JSON; the only HTML it serves is /docs and /redoc, which load
# assets from /api/static/swagger-ui (same origin). Tighten further if the API
# never needs to render HTML in your deployment.
_CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'"
)


@app.middleware("http")
async def security_headers(request: Request, call_next) -> Response:
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = _CSP
    # HSTS is only meaningful over HTTPS; harmless over plain HTTP (ignored by
    # browsers) but only send it when the request arrived as https.
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response
```

**Verify:**
```bash
curl -sI http://localhost:8000/health | grep -i "content-security-policy\|x-xss"
# CSP present; X-XSS-Protection absent.
```
Then load `/docs` in a browser and confirm Swagger UI still renders (no CSP console errors). Relax `script-src`/`style-src` only if it breaks.

---

## ✅ DONE — 🟠 P2-2 — Stop leaking exceptions from the service layer

**Why:** Services raise `HTTPException(detail=f"...{e}")` for what become 5xx responses, leaking internals. The 5xx guard only scans `routers/`, so these slip through. Fix the call sites **and** widen the guard so it can't regress.

### Part A — sanitize the CheckMK sync 5xx raises

**Representative file:** `backend/services/checkmk/sync/queries.py` (~line 122). Apply the same pattern to the other flagged sites:
`services/checkmk/sync/queries.py:127,280`, `services/checkmk/sync/comparison.py:154,361`, `services/checkmk/sync/operations.py:208,388`, `services/nautobot/offboarding/virtual_chassis_cleanup.py:66,129`.

#### Before
```python
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error getting devices for CheckMK sync: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get devices for CheckMK sync: {e}",
            )
```

#### After
```python
        except HTTPException:
            raise
        except Exception as e:
            raise_internal_server_error(
                logger, "Error getting devices for CheckMK sync", e
            )
```

**Add the import** at the top of each edited file:
```python
from core.safe_http_errors import raise_internal_server_error
```

> `raise_internal_server_error` logs with a traceback and an `error_id`, and raises a 500 whose body is only `{message, error_id}` — so you can drop the now-redundant `logger.error(...)` line. For genuinely non-500 cases (e.g. a CheckMK 502), pass `status_code=status.HTTP_502_BAD_GATEWAY`.

### Part B — widen the regression guard to `services/`

**File:** `backend/scripts/check_http_500_leaks.py`

#### Before
```python
def main() -> int:
    routers = _routers_dir()
    if not routers.is_dir():
        print(f"routers directory not found at {routers}", file=sys.stderr)
        return 2

    backend_dir = routers.parent
    all_failures: list[tuple[Path, int, str]] = []
    for py in sorted(routers.rglob("*.py")):
        rel = py.relative_to(backend_dir).as_posix()
        if rel in ALLOW_LIST:
            continue
        for line_no, snippet in _scan_file(py):
            all_failures.append((py, line_no, snippet))

    if not all_failures:
        print("[OK] no leaky 5xx HTTPException detail strings under backend/routers/")
        return 0
```

#### After
```python
def _scanned_dirs() -> list[Path]:
    backend = Path(__file__).resolve().parent.parent
    return [backend / "routers", backend / "services"]


def main() -> int:
    dirs = [d for d in _scanned_dirs() if d.is_dir()]
    if not dirs:
        print("no routers/ or services/ directory found", file=sys.stderr)
        return 2

    backend_dir = dirs[0].parent
    all_failures: list[tuple[Path, int, str]] = []
    for base in dirs:
        for py in sorted(base.rglob("*.py")):
            rel = py.relative_to(backend_dir).as_posix()
            if rel in ALLOW_LIST:
                continue
            for line_no, snippet in _scan_file(py):
                all_failures.append((py, line_no, snippet))

    if not all_failures:
        print("[OK] no leaky 5xx HTTPException detail strings under routers/ + services/")
        return 0
```

**Verify:**
```bash
cd backend && python scripts/check_http_500_leaks.py   # must print [OK]
```
Run this *after* Part A; it will list any sites you missed. Keep `ALLOW_LIST` empty.

---

## ✅ DONE — 🟠 P2-3 — Don't return raw exception text from git debug endpoints

**Why:** `routers/git/debug.py` returns `str(e)` and paths in 200-level JSON bodies, leaking filesystem detail to the client.

**File:** `backend/routers/git/debug.py` (multiple handlers; pattern shown for the read handler ~line 80)

### Before
```python
        except Exception as e:
            return {
                "success": False,
                "message": f"Error reading file: {str(e)}",
                "details": {
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "file_path": str(test_file_path),
                },
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Debug read test failed for repo %s: %s", repo_id, e)
        return {
            "success": False,
            "message": f"Debug test failed: {str(e)}",
            "details": {
                "error": str(e),
                "error_type": type(e).__name__,
                "stage": "repository_access",
            },
        }
```

### After
```python
        except Exception as e:
            logger.warning(
                "Debug read failed for repo %s: %s", repo_id, e, exc_info=True
            )
            return {
                "success": False,
                "message": "Error reading file",
                "details": {
                    "error_type": type(e).__name__,
                    "file_path": str(test_file_path),
                },
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Debug read test failed for repo %s: %s", repo_id, e, exc_info=True
        )
        return {
            "success": False,
            "message": "Debug test failed",
            "details": {
                "error_type": type(e).__name__,
                "stage": "repository_access",
            },
        }
```

**Rule of thumb for this file:** keep the exception *type* (useful, low-risk) and log the full `str(e)` server-side with `exc_info=True`; never put `str(e)` in the response body or the `message`. Apply to every handler in `debug.py`.

**Verify:** trigger a debug op against a repo path you can make unreadable and confirm the JSON body no longer contains the OS error string.

---

## ✅ DONE — 🟠 P2-4 — Don't report success when user cleanup partially fails

**Why:** `delete_user_with_rbac` swallows credential/profile deletion errors with `logger.warning` and still returns success, so a partial failure looks clean.

**File:** `backend/services/auth/rbac_service.py`, `delete_user_with_rbac` (~line 273)

### Before
```python
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
            try:
                from services.auth.profile_service import delete_user_profile

                delete_user_profile(username)
            except Exception as e:
                logger.warning("Failed to delete profile for user %s: %s", username, e)
        return self._user_service.hard_delete_user(user_id)
```

### After
```python
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

`RBACConstraintError` is already imported at the top of the file. The router that calls this maps RBAC exceptions to HTTP responses, so the caller now learns the delete was incomplete.

**Verify:** unit-test `delete_user_with_rbac` with a mocked `CredentialsService.delete_credentials_by_owner` raising — assert it raises `RBACConstraintError` and does **not** hard-delete.

---

## ✅ DONE — 🟢 P3-1 — Cache the per-request RBAC permission check

**Why:** Every protected request runs `has_permission`, which opens 4–6 short-lived DB sessions (permission lookup + override + roles + one query per role). Cache the boolean result for the token's short lifetime.

**File:** `backend/services/auth/rbac_service.py`, `has_permission` (~line 159)

### Before
```python
    def has_permission(self, user_id: int, resource: str, action: str) -> bool:
        perm = self._rbac_repo.get_permission(resource, action)
        if not perm:
            return False
        override = self._rbac_repo.get_user_permission_override(user_id, perm.id)
        if override is not None:
            return override
        for role in self._rbac_repo.get_user_roles(user_id):
            if any(
                p.id == perm.id for p in self._rbac_repo.get_role_permissions(role.id)
            ):
                return True
        return False
```

### After
```python
    def has_permission(self, user_id: int, resource: str, action: str) -> bool:
        cache = self._permission_cache()
        cache_key = f"rbac-perm:{user_id}:{resource}:{action}"
        cached = cache.get(cache_key)
        if cached is not None:
            return bool(cached)

        result = self._compute_permission(user_id, resource, action)
        # TTL shorter than the access-token lifetime so a permission change
        # takes effect within one cache window. Adjust to taste.
        cache.set(cache_key, 1 if result else 0, ttl_seconds=60)
        return result

    def _compute_permission(self, user_id: int, resource: str, action: str) -> bool:
        perm = self._rbac_repo.get_permission(resource, action)
        if not perm:
            return False
        override = self._rbac_repo.get_user_permission_override(user_id, perm.id)
        if override is not None:
            return override
        for role in self._rbac_repo.get_user_roles(user_id):
            if any(
                p.id == perm.id for p in self._rbac_repo.get_role_permissions(role.id)
            ):
                return True
        return False

    def _permission_cache(self):
        import service_factory

        return service_factory.build_cache_service()
```

> **Cache-invalidation caveat:** with a 60s TTL a revoked permission lingers up to a minute. If that's unacceptable, additionally clear the keys on writes — call a small helper that deletes `rbac-perm:{user_id}:*` inside `assign_permission_to_user`, `remove_permission_from_user`, `assign_role_to_user`, and `remove_role_from_user`. Start with the TTL-only version (simplest); add invalidation only if needed.

**Verify:** hit a protected endpoint twice and confirm (via SQL echo or a repo-level log) the second call issues no RBAC queries. Then flip a permission and confirm it takes effect within the TTL.

---

## ✅ DONE — 🟢 P3-2 — Extract the duplicated login-response builder

**Why:** ~40 lines of role-priority logic and response assembly are copy-pasted between `login` and `refresh_token`.

**File:** `backend/routers/auth/auth.py`

### Before (appears twice — in `login` and `refresh_token`)
```python
            role_names = [r["name"] for r in user_with_roles.get("roles", [])]

            primary_role = None
            if "admin" in role_names:
                primary_role = "admin"
            elif "operator" in role_names:
                primary_role = "operator"
            elif "network_engineer" in role_names:
                primary_role = "network_engineer"
            elif "viewer" in role_names:
                primary_role = "viewer"
            elif role_names:
                primary_role = role_names[0]
            # ... then build access_token and LoginResponse(user={...}) ...
```

### After — one module-level helper

```python
# Legacy single-role field is derived from RBAC roles by priority.
_ROLE_PRIORITY = ("admin", "operator", "network_engineer", "viewer")


def _primary_role(role_names: list[str]) -> str | None:
    for role in _ROLE_PRIORITY:
        if role in role_names:
            return role
    return role_names[0] if role_names else None


def _build_login_response(user: dict, user_with_roles: dict) -> LoginResponse:
    """Assemble the JWT + response payload shared by login and refresh."""
    from config import settings

    role_names = [r["name"] for r in user_with_roles.get("roles", [])]
    access_token = create_access_token(
        data={
            "sub": user["username"],
            "user_id": user["id"],
            "permissions": user["permissions"],
        },
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
        user={
            "id": user_with_roles["id"],
            "username": user_with_roles["username"],
            "realname": user_with_roles["realname"],
            "email": user_with_roles.get("email"),
            "role": _primary_role(role_names),
            "roles": role_names,
            "permissions": user_with_roles.get("permissions", []),
            "debug": user_with_roles.get("debug", False),
        },
    )
```

Then both handlers reduce to:
```python
    return _build_login_response(user, user_with_roles)
```

**Verify:** `pytest -q tests` covering login + refresh; confirm the response shape is byte-for-byte the same (roles array, primary role, expiry).

---

## ✅ DONE — 🟢 P3-3 — Pin dependencies (reproducible builds)

**Why:** Most of `requirements.txt` is unpinned (`fastapi`, `sqlalchemy`, `passlib`, …), so a rebuild can silently pull a breaking major version.

**File:** `backend/requirements.txt`

### Before
```
fastapi
uvicorn
pydantic[dotenv]
pydantic-settings
requests
httpx
pyjwt
passlib
...
sqlalchemy
psycopg2-binary
```

### After (pin to whatever is currently installed)
```bash
cd backend
# Snapshot the exact versions that currently work:
pip freeze > requirements.lock.txt
```
Then either commit `requirements.lock.txt` and install from it in CI/Docker, or copy the resolved versions back into `requirements.txt` as `==` pins, e.g.:
```
fastapi==0.115.6
sqlalchemy==2.0.36
passlib==1.7.4
# ...
```

> This is a process change, not a code refactor — do it in its own PR so a dependency bump is never mixed with logic changes. Lowest priority; ship last.

---

## Suggested PR sequencing

| PR | Items | Risk | Status |
|----|-------|------|--------|
| 1 | P1-1 (GraphQL auth) | Low, high value — ship immediately | ✅ Done |
| 2 | P1-2 (OIDC state) | Low; test the OIDC happy path | ✅ Done |
| 3 | P2-1 (headers), P2-3 (git debug) | Low | ✅ Done |
| 4 | P2-2 (service errors + guard) | Low; guard proves completeness | ✅ Done |
| 5 | P2-4 (user-delete failure surfacing) | Low; add the unit test | ✅ Done |
| 6 | P3-1 (RBAC cache) | Medium; measure, watch invalidation | ✅ Done |
| 7 | P3-2 (login helper), P3-3 (pin deps) | Low; pure cleanup | ✅ Done |

Each PR is independently revertable and independently verifiable with the commands in its section.

All items implemented in a single pass on 2026-07-12. Regression guards
(`check_asyncio_run.py`, `check_http_500_leaks.py`, `check_router_repositories.py`,
`check_text_sql.py`, `check_blocking_http_in_async.py`) and `ruff format`/`ruff check`
are clean; full backend suite passes (2388 passed, 3 skipped).
