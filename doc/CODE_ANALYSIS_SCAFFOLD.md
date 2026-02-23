# Backend Code Analysis

**Date:** 2026-02-22
**Scope:** Security audit, architecture review, code quality assessment
**Target:** `/backend/` directory of the Cockpit-NG scaffold

---

## Executive Summary

The backend is a well-structured FastAPI application following layered architecture principles. The codebase demonstrates strong fundamentals: SQLAlchemy ORM prevents SQL injection, PBKDF2 handles password hashing, Fernet provides authenticated encryption for credentials, and a comprehensive RBAC system protects most endpoints. However, several issues need attention before production deployment, ranging from critical (hardcoded default secrets, legacy SQLite code) to moderate (missing rate limiting, debug endpoints exposed without auth).

### Verdict

| Category | Rating | Notes |
|----------|--------|-------|
| Architecture | Good | Clean layered separation (Model > Repository > Service > Router) |
| SQL Injection | Excellent | SQLAlchemy ORM used consistently, no raw SQL |
| Authentication | Good | JWT + RBAC, but some endpoints lack auth |
| Secret Management | Poor | Hardcoded defaults, credentials logged in plaintext |
| Error Handling | Good | Generic errors to clients, detailed internal logging |
| Input Validation | Good | Pydantic models on all request bodies |
| Code Hygiene | Moderate | Legacy code, dead references, oversized router files |

---

## 1. Critical Security Issues

### 1.1 Hardcoded Default SECRET_KEY

**File:** `backend/config.py:50`
```python
secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
```

**Impact:** If the environment variable is not set, all JWT tokens are signed with a publicly known key. Any attacker can forge valid admin tokens.

**Recommendation:** Fail hard at startup if SECRET_KEY is the default value:
```python
if settings.secret_key == "your-secret-key-change-in-production":
    raise RuntimeError("FATAL: SECRET_KEY must be changed before running the application")
```

---

### 1.2 Default Admin Credentials

**File:** `backend/config.py:57-58`
```python
initial_username: str = os.getenv("INITIAL_USERNAME", "admin")
initial_password: str = os.getenv("INITIAL_PASSWORD", "admin")
```

**Impact:** The initial user `admin/admin` is created on first startup. If the password is never changed and the application is network-exposed, it provides immediate full access.

**Recommendation:**
- Log a prominent WARNING at startup when default credentials are in use
- Consider forcing a password change on first login
- Document this clearly in deployment guides

---

### 1.3 Legacy SQLite API Key Verification

**File:** `backend/core/auth.py:87-149`
```python
def verify_api_key(x_api_key: Optional[str] = None) -> dict:
    import sqlite3
    db_path = os.path.join(config_settings.data_directory, "settings", "cockpit_settings.db")
    conn = sqlite3.connect(db_path)
    user_row = conn.execute(
        "SELECT username FROM user_profiles WHERE api_key = ? AND api_key IS NOT NULL",
        (x_api_key,),
    ).fetchone()
```

**Issues:**
1. Uses SQLite while the entire application runs on PostgreSQL - architectural inconsistency
2. Queries a `user_profiles` table that may not exist in SQLite (schema mismatch)
3. Bypasses the repository pattern entirely
4. The SQLite database file may not even exist in fresh scaffold deployments
5. No unique constraint on `api_key` - collisions possible

**Recommendation:** Rewrite to use the PostgreSQL `UserProfile` model via the repository layer. Add a unique constraint on the `api_key` column.

---

### 1.4 Redis Credentials Printed to stdout

**File:** `backend/celery_app.py:11-14`
```python
print(f"Celery Redis URL: {settings.redis_url}")
print(f"Celery Broker URL: {settings.celery_broker_url}")
print(f"Celery Result Backend: {settings.celery_result_backend}")
```

**Impact:** Redis password is printed in plaintext to stdout on every import of `celery_app`. This appears in Docker logs, systemd journals, and CI/CD output.

**Recommendation:** Remove these debug prints entirely, or mask the password:
```python
logger.info("Celery broker configured (Redis)")  # No URL with password
```

---

## 2. High Severity Issues

### 2.1 Unauthenticated Endpoints

Several endpoints are accessible without any authentication:

| Endpoint | File | Line | Issue |
|----------|------|------|-------|
| `POST /celery/test` | `routers/jobs/celery_api.py` | 130 | Allows submitting Celery tasks without auth |
| `POST /celery/test/progress` | `routers/jobs/celery_api.py` | 147 | Same - arbitrary task submission |
| `GET /oidc/debug` | `routers/auth/oidc.py` | 385 | Exposes OIDC configuration details (client IDs, endpoints) |
| `GET /` | `main.py` | 122 | API info (acceptable) |
| `GET /health` | `main.py` | 134 | Health check (acceptable) |
| `GET /api/test` | `main.py` | 144 | Test endpoint (should be removed in scaffold) |
| `GET /api/health` | `health.py` | 12 | Health check (acceptable) |

The test/debug endpoints (`/celery/test`, `/oidc/debug`, `/api/test`) should either require authentication or be removed from the scaffold.

---

### 2.2 OIDC Debug Endpoint Leaks Configuration

**File:** `backend/routers/auth/oidc.py:385-420`

The `/oidc/debug` endpoint is unauthenticated and exposes:
- Provider IDs and names
- Client IDs
- Whether client secrets are configured
- Authorization, token, and userinfo endpoint URLs
- OIDC discovery URLs

**Recommendation:** Add `Depends(require_role("admin"))` or remove from scaffold.

---

### 2.3 Fernet Key Derivation Uses Simple SHA256

**File:** `backend/credentials_manager.py:23-25`
```python
def _build_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)
```

**Issue:** A single SHA256 iteration is trivially fast to brute-force. If the SECRET_KEY is weak (which it often is with env vars), the encryption key is easily recoverable.

**Recommendation:** Use PBKDF2 with a fixed salt and high iteration count:
```python
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

def _build_key(secret: str) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"cockpit-credential-encryption",  # Fixed salt for determinism
        iterations=100_000,
    )
    return base64.urlsafe_b64encode(kdf.derive(secret.encode()))
```

**Note:** Changing this requires re-encrypting all existing credentials (migration needed).

---

### 2.4 No Rate Limiting

**Finding:** No rate limiting middleware exists anywhere in the application.

**Impact:** The login endpoint (`POST /auth/login`) is vulnerable to brute-force attacks. API endpoints can be abused for denial of service.

**Recommendation:** Add rate limiting at minimum on auth endpoints:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("5/minute")
async def login(...):
```

---

### 2.5 No Security Headers

**Finding:** The FastAPI backend sets no security headers. While the Next.js proxy handles most browser-facing headers, the backend should still set:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Cache-Control: no-store` on auth responses

**Recommendation:** Add a middleware:
```python
@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response
```

---

## 3. Moderate Issues

### 3.1 Admin Permission Check Uses Exact Match

**File:** `backend/core/auth.py:73-84`
```python
def verify_admin_token(user_info: dict = Depends(verify_token)) -> dict:
    user_permissions = user_info["permissions"]
    if user_permissions != PERMISSIONS_ADMIN:  # Exact match
        raise HTTPException(...)
```

**Issue:** Uses `!=` instead of bitwise `&`. If the permission system evolves or an admin has extra flags, this exact match will fail unexpectedly.

**Recommendation:** Use bitwise check or compare against a known admin role via RBAC (which is already implemented separately via `require_role("admin")`). Consider deprecating `verify_admin_token` in favor of `require_role("admin")`.

---

### 3.2 Deprecated `@app.on_event("startup")` Usage

**File:** `backend/main.py:161`
```python
@app.on_event("startup")
async def startup_services():
```

**Issue:** `on_event` is deprecated in modern FastAPI in favor of `lifespan` context managers.

**Recommendation:** Migrate to the lifespan pattern:
```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await startup_services()
    yield
    # Shutdown
    logger.info("Application shutdown completed")

app = FastAPI(lifespan=lifespan)
```

---

### 3.3 Database Sessions Not Scoped to Requests

**File:** `backend/repositories/base.py`

Every repository method creates its own session and closes it:
```python
def get_by_id(self, id: int) -> Optional[T]:
    db = get_db_session()
    try:
        return db.query(self.model).filter(self.model.id == id).first()
    finally:
        db.close()
```

**Issues:**
1. Multiple repository calls in one request use separate database connections (no transaction isolation)
2. Lazy-loaded relationships will fail after the session closes (DetachedInstanceError)
3. No ability to wrap multiple operations in a single transaction
4. Connection pool can be exhausted by complex endpoints making many repository calls

**Recommendation:** Use FastAPI's `Depends(get_db)` to inject a request-scoped session:
```python
class BaseRepository(Generic[T]):
    def __init__(self, model: Type[T], db: Session):
        self.model = model
        self.db = db

    def get_by_id(self, id: int) -> Optional[T]:
        return self.db.query(self.model).filter(self.model.id == id).first()
```

This is the most impactful architectural improvement available.

---

### 3.4 Oversized Router File: celery_api.py

**File:** `backend/routers/jobs/celery_api.py`

This file contains **2000+ lines** and **30+ endpoints** spanning:
- Test tasks
- Device onboarding
- Bulk operations
- CSV imports/exports
- Queue management
- Worker management
- Celery settings
- Backup status
- Network scanning
- Cleanup operations

**Impact:** Violates single-responsibility principle. Hard to navigate, test, and maintain.

**Recommendation:** Split into focused router modules:
```
routers/jobs/
  celery_status.py      # /status, /workers, /queues, /config
  celery_tasks.py       # /test, /tasks/{task_id}
  celery_settings.py    # /settings
  celery_cleanup.py     # /cleanup
```

The domain-specific task endpoints (onboarding, backup, CSV) should be removed from the scaffold entirely as they reference removed features.

---

### 3.5 Dead Domain References in Scaffold

The scaffold still contains references to removed features:

**`backend/routers/jobs/celery_api.py`** contains endpoints for:
- Device onboarding (`/tasks/onboard-device`)
- Bulk device onboarding (`/tasks/bulk-onboard-devices`)
- Device backup (`/tasks/backup-devices`)
- Agent deployment (`/tasks/deploy-agent`)
- Device CSV import/export (`/tasks/export-devices`, `/tasks/import-devices-from-csv`)
- Network scanning (`/tasks/ping-network`, `/tasks/scan-prefixes`)
- Device backup status (`/device-backup-status`)
- IP checking (`/tasks/check-ip`)

**`backend/routers/settings/common.py`** contains endpoints for:
- CheckMK settings (`/checkmk`)
- Agents settings (`/agents`, `/agents/telegraf/config`)
- Nautobot defaults (`/nautobot/defaults`)
- Device offboarding (`/offboarding`)

These endpoints reference removed models, services, and tasks. They will cause runtime ImportErrors or return empty results.

**Recommendation:** Remove all domain-specific endpoints from the scaffold. Keep only generic infrastructure endpoints.

---

### 3.6 `.env` File Tracked in Git History

**File:** `.gitignore:131`
```
.env
```

While `.env` is in `.gitignore`, the backend has a `.env` file at `backend/.env`. The `.gitignore` pattern `.env` matches the root `.env`, but `backend/.env` needs explicit exclusion or a `**/.env` pattern.

**Status:** Verified that `backend/.env` is in `.gitignore` indirectly via the root `.env` rule (git interprets `.env` as matching at any level). However, `backend/.env.test` appears to be tracked and contains test credentials.

---

## 4. What's Done Well

### 4.1 SQLAlchemy ORM - No SQL Injection

All database access goes through SQLAlchemy ORM. No raw SQL queries exist in the codebase (verified via grep). Even the legacy SQLite code in `auth.py` uses parameterized queries.

### 4.2 Password Hashing with PBKDF2

**File:** `backend/core/auth.py:35-42`
```python
from passlib.hash import pbkdf2_sha256

def verify_password(plain_password, hashed_password):
    return pbkdf2_sha256.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pbkdf2_sha256.hash(password)
```

Uses `passlib`'s PBKDF2-SHA256 with automatic salting and 29000+ iterations.

### 4.3 Fernet Authenticated Encryption for Credentials

**File:** `backend/credentials_manager.py:28-42`

Credential passwords and SSH keys are encrypted with Fernet (AES-128-CBC + HMAC-SHA256). Provides both confidentiality and integrity. Proper error handling for invalid tokens.

### 4.4 Comprehensive RBAC System

Three layers of permission checking:
- `require_permission(resource, action)` - granular resource:action checks
- `require_any_permission(resource, actions)` - OR logic
- `require_all_permissions(resource, actions)` - AND logic
- `require_role(role_name)` - role-based checks

All implemented as FastAPI dependencies, consistently used across most routers.

### 4.5 Audit Logging

**File:** `backend/routers/auth/auth.py`

All authentication events (login, logout, token refresh, API key login) are logged to the `audit_logs` table with:
- Username and user ID
- Event type and severity
- Authentication method
- Timestamp and extra metadata

### 4.6 Error Handling - No Information Leakage

**File:** `backend/core/error_handlers.py`

Decorators prevent exception details from reaching clients:
- Internal errors logged with full stack traces
- Clients receive generic messages: `"Failed to {operation}"`
- Authentication errors use generic "Invalid username or password" (no username enumeration)

### 4.7 Pydantic Validation on All Inputs

All request bodies use Pydantic models with type validation. Query parameters use FastAPI's `Query()` with constraints (`ge=1`, `le=100`).

### 4.8 Repository Pattern

Clean separation between data access and business logic. `BaseRepository` provides generic CRUD operations. Domain repositories extend with specific queries.

### 4.9 No Dangerous Operations

Verified via grep:
- No `eval()` or `exec()` calls
- No `pickle` deserialization
- No `os.system()` calls
- `subprocess` usage (in `start_celery.py`) uses list form with timeout, not `shell=True`

### 4.10 SSH Key File Permissions

**File:** `backend/credentials_manager.py:510`
```python
os.chmod(key_filename, 0o600)
```

SSH keys exported to filesystem are properly set to owner-read-only permissions.

---

## 5. Architecture Assessment

### 5.1 Layer Structure

```
Request → Router → Service → Repository → Database
              ↓
         Auth Dependency (verify_token / require_permission)
```

This is a clean, testable architecture. Business logic stays in services, data access in repositories, HTTP concerns in routers.

### 5.2 Directory Layout

```
backend/
├── core/              # Database, auth, models, error handlers
├── repositories/      # Data access layer (BaseRepository + domain repos)
│   ├── auth/
│   ├── jobs/
│   └── settings/
├── services/          # Business logic
│   ├── auth/
│   ├── settings/
│   └── background_jobs/
├── routers/           # HTTP endpoints
│   ├── auth/
│   ├── jobs/
│   └── settings/
├── models/            # Pydantic request/response schemas
├── tasks/             # Celery task definitions
├── migrations/        # Database migrations
├── config.py          # Configuration from environment
├── main.py            # FastAPI app setup
├── celery_app.py      # Celery configuration
├── settings_manager.py # Settings persistence layer
├── credentials_manager.py # Encrypted credential storage
├── user_db_manager.py # User CRUD operations
└── rbac_manager.py    # RBAC operations
```

**Issue:** Several `*_manager.py` files at the root level (`settings_manager.py`, `credentials_manager.py`, `user_db_manager.py`, `rbac_manager.py`) break the layered pattern. They mix service logic with direct database access, bypassing the repository layer.

**Recommendation:** Migrate these into the `services/` directory and have them use the corresponding repositories.

---

### 5.3 Code Size Distribution

| Component | Files | Estimated Lines | Notes |
|-----------|-------|-----------------|-------|
| `routers/jobs/celery_api.py` | 1 | ~2400 | Needs splitting |
| `routers/settings/common.py` | 1 | ~900 | Contains dead domain endpoints |
| `routers/settings/templates.py` | 1 | ~1060 | Complex but organized |
| `core/models.py` | 1 | ~800 | All SQLAlchemy models |
| `settings_manager.py` | 1 | ~650 | Should be in services/ |
| `credentials_manager.py` | 1 | ~580 | Well-structured |

---

## 6. Prioritized Recommendations

### Must Fix (Before Production)

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 1 | Add startup validation for SECRET_KEY | Critical | Low |
| 2 | Remove `print()` statements in `celery_app.py` | Critical | Trivial |
| 3 | Add auth to `/celery/test`, `/celery/test/progress` endpoints | High | Low |
| 4 | Add auth to `/oidc/debug` endpoint | High | Low |
| 5 | Remove `/api/test` endpoint from `main.py` | High | Trivial |
| 6 | Remove dead domain-specific endpoints from scaffold | High | Medium |

### Should Fix (Before Production)

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 7 | Migrate API key verification from SQLite to PostgreSQL | High | Medium |
| 8 | Add rate limiting on `/auth/login` | High | Low |
| 9 | Add security headers middleware | Medium | Low |
| 10 | Improve Fernet key derivation (SHA256 -> PBKDF2) | Medium | Medium (requires migration) |

### Nice to Have (Post-Launch)

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 11 | Request-scoped database sessions (replace per-method sessions) | Medium | High |
| 12 | Split `celery_api.py` into focused modules | Low | Medium |
| 13 | Move `*_manager.py` files into `services/` | Low | Medium |
| 14 | Migrate from `on_event` to `lifespan` context manager | Low | Low |
| 15 | Deprecate `verify_admin_token` in favor of `require_role("admin")` | Low | Low |

---

## 7. Security Checklist for Deployment

- [ ] Change `SECRET_KEY` to a strong random value (min 32 chars)
- [ ] Change default admin password immediately after first login
- [ ] Set strong `COCKPIT_REDIS_PASSWORD` and `COCKPIT_DATABASE_PASSWORD`
- [ ] Remove or protect all `/debug` and `/test` endpoints
- [ ] Enable HTTPS (TLS termination at reverse proxy)
- [ ] Configure rate limiting
- [ ] Set up log rotation (credentials were printed to stdout)
- [ ] Verify `.env` files are not in Docker images
- [ ] Review OIDC provider configuration (client secrets)
- [ ] Enable database SSL (`COCKPIT_DATABASE_SSL=true`) if DB is remote
