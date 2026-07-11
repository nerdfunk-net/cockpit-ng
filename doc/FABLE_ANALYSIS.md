# Cockpit-NG Backend — Senior Python Analysis

**Date:** 2026-07-12
**Scope:** `/backend` — architecture, CLAUDE.md conformance, Python best practices, directory structure, security, RBAC/auth, code quality, exception handling, SQLAlchemy.
**Method:** Static review of core modules, auth/RBAC layer, repositories, routers, services, config, plus the repo's own regression guard scripts.
**Remediation status (2026-07-12):** All items from `doc/refactoring/FABLE_PRIO_LIST.md` (§8 items 1–6, 8, 10) are ✅ DONE. Items 7 and 10 landed partially — see §8 for the exact remainder. Findings below are marked inline: ✅ DONE, 🟡 PARTIAL, or unmarked (⬜ still open — see the "Still open for the next pass" list at the end of §8).

---

## Executive Summary

The backend is **well-architected and disciplined**. The layered pattern (Model → Repository → Service → Router) is real, not aspirational, and the team has built automated guardrails (`scripts/check_*.py`) that actually enforce the rules in CLAUDE.md. All five guard scripts pass cleanly. Security fundamentals are strong: credential encryption at rest, API-key hashing, sanitized 5xx errors, a SECRET_KEY pre-flight check, rate-limited login, and security headers.

That said, there are **a handful of real issues** — one genuine security hole (an unauthenticated GraphQL proxy), inconsistent error sanitization in the CheckMK and git-debug layers, an OIDC flow that doesn't verify `state` server-side, and per-request RBAC checks that hit the database several times without caching. None are architectural rot; they're localized and fixable.

**Overall grade: B+ / strong.** The scaffolding is better than most FastAPI codebases I review. The findings below are about closing gaps, not restructuring.

---

## 1. CLAUDE.md Conformance

| Rule | Status | Notes |
|------|--------|-------|
| Layered backend (Model→Repo→Service→Router) | ✅ | Consistently applied |
| `text()` only in repos/allowlist | ✅ | `check_text_sql.py` passes; only `SELECT 1` health check in `core/database.py` |
| No `asyncio.run()` in routers | ✅ | `check_asyncio_run.py` passes |
| No repository imports in routers | ✅ | `check_router_repositories.py` passes (git/debug imports a `git_repo_manager` service, not a repo) |
| No blocking HTTP in `async def` | ✅ | `check_blocking_http_in_async.py` passes |
| No leaky 5xx in `routers/` | ✅ | `check_http_500_leaks.py` passes — **but the guard only scans `routers/`, not `services/`** (see §4) |
| No f-string logging | ✅ | 0 occurrences found |
| `raise_internal_server_error` for 5xx | ✅ | 451 call sites — excellent adoption |
| Models one-file-per-domain, exported | ✅ | Matches the documented layout in `core/models/` |
| Timestamps/indexes/FKs on tables | ✅ | RBAC models show proper `created_at/updated_at`, `Index`, `ondelete="CASCADE"` |

**Verdict:** Conformance is high and, crucially, *machine-enforced*. This is the strongest signal in the codebase.

---

## 2. Directory Structure

Clean and domain-oriented. `core/`, `repositories/{domain}/`, `services/{domain}/`, `routers/{domain}/`, `models/`, `tasks/`, `migrations/` all match the documented convention. The Nautobot sub-tree (`resolvers/`, `managers/`, `common/`, `devices/`) is a good example of splitting an external-API integration into read-only resolvers vs. lifecycle managers vs. pure functions.

**Minor structural notes:**
- `service_factory.py` (528 lines) is a central construction hub. It's a legitimate composition root, but it's also a single point every layer imports from, and `core/auth.py` calls `import service_factory` inside every permission dependency. Acceptable, but it couples auth to the factory.
- `services/auth/user_management.py` builds a runtime proxy object via `type("_Proxy", ...)` with a `__getattr__` that forwards to `build_user_service()`. This is clever but obscure — it re-resolves the service on *every attribute access*. A module-level function or explicit accessor would be clearer and cheaper.

---

## 3. Security Review

### 3.1 Strengths
- **Credential encryption at rest** (`core/crypto.py`): Fernet with PBKDF2-HMAC-SHA256, dedicated `CREDENTIAL_ENCRYPTION_KEY` decoupled from `SECRET_KEY`, documented key-rotation runbook, and a path to OWASP-recommended 600k iterations. This is well thought out.
- **API keys hashed at rest** (`core/api_keys.py`): SHA-256 with an idempotent plaintext→hash startup migration. SHA-256 (not bcrypt) is correctly justified — keys are 42-char high-entropy tokens, not human passwords.
- **Passwords** hashed with `pbkdf2_sha256` (passlib).
- **SECRET_KEY pre-flight** (`main.py:354`): startup *fails hard* if the default secret is in use. Default admin password only warns — reasonable.
- **Security headers** middleware (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`).
- **Rate limiting** on `/auth/login` (10/min) via slowapi.
- **Sanitized 5xx** via `raise_internal_server_error` (opaque `error_id` + generic message).

### 3.2 Findings

**✅ DONE — 🔴 HIGH — Unauthenticated GraphQL proxy.**
`main.py:306` `POST /api/nautobot/graphql` has **no auth dependency**. It forwards arbitrary caller-supplied GraphQL queries and variables straight to Nautobot using the backend's privileged token. Any client that can reach the backend can read (and depending on Nautobot's schema, mutate) Nautobot data with the service account's permissions, bypassing the entire RBAC layer. The docstring calls it a "compatibility endpoint" — that's exactly the kind of thing that outlives its excuse. Add `Depends(verify_token)` at minimum, ideally `require_permission("nautobot", "read")`, and consider rejecting mutations.

**✅ DONE — 🟠 MEDIUM — Missing CSP header.** The security-headers middleware omits `Content-Security-Policy` and `Strict-Transport-Security`. `X-XSS-Protection: 1; mode=block` is also set, which modern browsers ignore and OWASP now recommends *against* (it can introduce vulnerabilities). Replace it with a CSP and add HSTS when served over TLS.

**✅ DONE — 🟠 MEDIUM — OIDC `state` is generated but never verified server-side.**
`OIDCService.generate_state()` returns `secrets.token_urlsafe(32)` (good entropy), and `oidc_callback` (`routers/auth/oidc.py:213`) only checks that the `provider_id` prefix of the returned state matches — it does **not** verify the random portion against anything stored server-side. That means the CSRF protection `state` is meant to provide is effectively absent; the callback trusts whatever `state` the client returns. Store the issued state (Redis is already a dependency) with a short TTL and require an exact match on callback. Also confirm a `nonce` is validated inside `verify_id_token`.
*(State store/verify implemented in `routers/auth/oidc.py`; the `nonce` sub-item was not re-checked — still open for the next pass.)*

**✅ DONE — 🟡 LOW — Information leak in `routers/git/debug.py`.**
The debug endpoints (properly permission-gated) return raw `str(e)` and `type(e).__name__` in JSON response bodies (`Error reading file: {str(e)}`, etc.). These are 200-level responses so the 5xx guard doesn't catch them, but they leak filesystem paths and internal error text to the client. Since they're behind `git.repositories:write`, the blast radius is limited, but debug affordances like this tend to leak more than intended.

**🟡 LOW — `verify_api_key` swallows into a bare 500.** `core/auth.py:151` catches `except Exception` and raises a generic 500. Fine for safety, but it hides genuine DB/lookup failures behind an auth error. Prefer routing through `raise_internal_server_error` so it gets an `error_id` and traceback logging.

---

## 4. Exception Handling

**Good:**
- Dedicated exception hierarchies per domain (`services/auth/exceptions.py`, `nautobot/common/exceptions.py` with a proper `NautobotError` base and subclasses, `checkmk/exceptions.py`, `compliance`, `settings`).
- Zero bare `except:` clauses.
- The `raise_internal_server_error` helper is well designed (opaque error IDs, `exc_info` logging, configurable status for sanitized 502/503).

**Concerns:**

**✅ DONE — 🟠 MEDIUM — Raw exception text in service-layer HTTPExceptions.** The 5xx guard only scans `routers/`. Services raise HTTPExceptions directly with interpolated exceptions:
- `services/checkmk/sync/queries.py:127,280` — `detail=f"Failed to get devices for CheckMK sync: {e}"`
- `services/checkmk/sync/comparison.py:154,361`
- `services/checkmk/sync/operations.py:208,388`
- `services/nautobot/offboarding/virtual_chassis_cleanup.py:66,129` — `detail=f"...: {exc}"`

Some of these are labeled 4xx (allowed), but several are effectively server failures that end up as 5xx with raw internals in the body. **Recommendation:** extend `check_http_500_leaks.py` to also scan `services/` (services shouldn't raise HTTPException at all under the layering rules — that's a router concern), or route them through `raise_internal_server_error`.
*(The actual sweep found 17 leak sites across 5 files — more than listed above, including `services/nautobot/offboarding/service.py` which wasn't originally called out. All fixed via `raise_internal_server_error`; guard now scans `routers/` + `services/` and passes clean.)*

**🟡 LOW — Very broad `except Exception` usage (~1053 sites).** Many are legitimate top-of-handler catches, but a large fraction are `except Exception as e: logger.warning(...)` that silently continue (e.g. `rbac_service.delete_user_with_rbac` swallows credential/profile deletion failures). This violates the "never silently swallow errors" rule in spirit — the deletion reports success even if cleanup partially failed. Consider narrowing to expected exception types and surfacing partial failures.
*(✅ DONE for the cited example: `delete_user_with_rbac` now raises `RBACConstraintError` on partial cleanup failure instead of reporting success, with a unit test. The broader ~1053-site `except Exception` audit is still open.)*

**🟡 LOW — `user_management.py` re-wraps exceptions as bare `Exception`.** `get_user_by_username`/`authenticate_user` do `raise Exception(f"Failed to get user: {str(e)}")`, collapsing typed errors into the base class and interpolating the original message. Use a domain exception (`AuthError`) and `raise ... from e`.

---

## 5. RBAC & Authentication

**Design (strong):** The RBAC model is textbook — `roles`, `permissions`, `role_permissions`, `user_roles`, `user_permissions` with a per-user *override* layer (grant/deny) that takes precedence over role-derived permissions. `RBACService.has_permission` correctly checks overrides first, then roles. The FastAPI dependency helpers (`require_permission`, `require_any_permission`, `require_all_permissions`, `require_role`) are clean and composable, and routers use them consistently (verified `cockpit_agent.py`, `git/debug.py`).

**Auth correctness (good):**
- `verify_token` correctly returns **401 with `WWW-Authenticate`** for missing/invalid credentials (RFC 7235), with a well-documented rationale for `auto_error=False`. This is more correct than most FastAPI code.
- `verify_admin_token` uses a proper *bitmask subset* check (`& == PERMISSIONS_ADMIN`) rather than equality, with a comment explaining why — good catch by whoever fixed that.
- Inactive users are rejected at `authenticate_user` and `get_user_by_username` (`user_service.py:80,88`).
- `refresh_token` verifies signature while allowing expiry — a reasonable, deliberate design with signature still enforced.

**Findings:**

**🟡 PARTIAL — 🟠 MEDIUM — Per-request RBAC does N DB round-trips with no caching.**
`require_permission` → `has_permission` issues, per check: 1 query for the permission, 1 for the override, 1 for the user's roles, then **one `get_role_permissions` query per role**. Each `RBACRepository` method opens and closes *its own session* (`get_db_session()` … `finally: db.close()`). A single protected endpoint call can therefore open 4–6 short-lived DB connections just for authorization. `get_user_permissions` is worse (nested role→permission loop). Under load this is a real bottleneck and an N+1 pattern.
**Recommendation:** batch the queries (join role_permissions in one statement), share a single session per permission check, and cache the user's effective permission set for the token's short lifetime (10 min) in Redis. The permission bitmask is already in the JWT — for many checks you may not need the DB at all.
*(✅ DONE — Redis caching added to `RBACService.has_permission` with a 60s TTL and invalidation on grant/revoke, so a cache hit skips the DB entirely. ⬜ STILL OPEN — the underlying query pattern itself (1 query per role, no join batching, no shared session) is unchanged; only cache hits benefit. `get_user_permissions`'s nested loop is also untouched.)*

**✅ DONE — 🟡 LOW — Duplicated login/refresh logic.** The role-priority mapping and response-user assembly (~40 lines) are copy-pasted between `login` and `refresh_token` in `routers/auth/auth.py`. Extract a `_build_login_response(user)` helper.

**🟡 LOW — `verify_admin_token` marked deprecated** in favor of `require_role("admin")`, which is good — track down remaining callers and migrate.

---

## 6. SQLAlchemy

**Good:**
- `BaseRepository` (`repositories/base.py`) is a clean generic (`Generic[T]`) with an elegant `_db_session` context manager that either reuses a caller-supplied session (shared transaction) or opens/closes its own. The `create`/`update`/`delete` methods correctly `flush()` (not `commit()`) when given a shared session, letting the caller own the transaction boundary. This is the right pattern.
- `db_transaction()` context manager for multi-repo transactions is well documented.
- Engine config is production-appropriate: `pool_pre_ping=True`, `pool_recycle=3600`, `pool_size=5`, `max_overflow=10`, credentials masked in the connection log.
- ORM used throughout; no raw SQL outside the health check.
- Models use `server_default=func.now()`, `onupdate=func.now()`, proper `Index` and `UniqueConstraint`, and `ondelete="CASCADE"` with matching relationship cascades.

**Findings:**

**🟡 LOW — `BaseRepository.update`/`filter` silently ignore unknown fields.** `if hasattr(obj, key)` / `if hasattr(self.model, key)` means a typo'd column name is silently dropped rather than raising. This can mask bugs (a field "saved" that never persists — exactly the class of silent-persistence failure CLAUDE.md warns about). Consider raising on unknown keys, at least in debug.

**🟡 LOW — Repository session-per-method prevents true read consistency** for multi-step reads unless callers thread a `db=` session through. The API supports it; the RBAC service just doesn't use it (see §5).

**🟢 Note — `pool_size=5 + max_overflow=10` (15 max)** combined with the RBAC round-trip pattern could exhaust the pool under concurrency. Tune once §5 is addressed.

---

## 7. Code Quality / Python Best Practices

**Good:**
- `ruff` configured (line-length 88, `E,F,I,B,UP,DTZ` selected) with a documented, deliberately-scoped ignore list and tracked baselines — mature approach.
- `from __future__ import annotations` used widely; type hints on signatures are the norm.
- Logging uses lazy `%s` interpolation everywhere (0 f-string logging).
- 213 test files — substantial coverage surface.
- Naive-datetime usage held to an 18-site baseline with `DTZ003/DTZ004` still enforced (banning `utcnow()`).

**Findings:**

**🟡 LOW — Files exceeding the 800-line hard max** (per `common/coding-style.md`):
| File | Lines |
|------|-------|
| `services/network/tools/baseline_generator.py` | 1087 |
| `services/nautobot/imports/csv_import_service.py` | 890 |
| `services/nautobot/devices/creation.py` | 879 |
| `routers/cockpit_agent.py` | 868 |
| `services/network/scanning/prefix_scan_service.py` | 819 |
| `services/nautobot/imports/prefix_update_service.py` | 811 |

`routers/cockpit_agent.py` at 868 lines is notable — routers are supposed to be thin. Worth splitting by sub-resource. `baseline_generator.py` at 1087 is the clearest candidate for decomposition.

**🟢 God objects — mostly not.** The classes with the most methods are `DeviceCommonService` (43) and `RBACService` (36). `DeviceCommonService` is an *explicitly documented facade* (CLAUDE.md sanctions it), so it's a delegation surface, not a God Object. `RBACService` at 36 methods is large but cohesive (permissions/roles/assignments/checks) — borderline; could split "permission checking" from "user lifecycle" but not urgent. `SettingsManager` (31) is the one I'd watch next.

**🟡 LOW — `config.py` isn't Pydantic `BaseSettings`.** It's a hand-rolled `Settings` class with class-level `os.getenv` calls evaluated at import time. It works and is readable, but you lose type coercion/validation and it's inconsistent with `pydantic-settings` being in `requirements.txt`. Also, class-level evaluation means env vars set after import won't be picked up (matters in tests).

**✅ DONE — 🟡 LOW — Dependencies largely unpinned** in `requirements.txt` (`fastapi`, `sqlalchemy`, `passlib`, etc. have no version bound; only a few use `>=`). This makes builds non-reproducible and risks a surprise breaking upgrade. Pin with `==` or a lockfile (pip-tools / uv).
*(Previously-bare packages pinned to `==` exact installed versions; packages that already had `>=` floors were left as-is. No lockfile/pip-tools adopted.)*

---

## 8. Prioritized Recommendations

**Do now (security):**
1. ✅ DONE — **Add auth to `POST /api/nautobot/graphql`** (`main.py:306`) — HIGH. Unauthenticated privileged proxy.
2. ✅ DONE — **Verify OIDC `state` server-side** (store in Redis w/ TTL, exact match on callback) — MEDIUM CSRF gap.
3. ✅ DONE — **Add CSP + HSTS headers; drop `X-XSS-Protection`** — MEDIUM.

**Do soon (correctness/robustness):**
4. ✅ DONE — Extend `check_http_500_leaks.py` to `services/`, and stop raising `HTTPException` from services (CheckMK sync, virtual-chassis cleanup) — route through `raise_internal_server_error`.
5. ✅ DONE — Stop returning `str(e)` in `routers/git/debug.py` response bodies.
6. ✅ DONE — Narrow the credential/profile-cleanup `except Exception` swallows in `delete_user_with_rbac` so partial failures aren't reported as success.

**Do when convenient (performance/maintainability):**
7. 🟡 PARTIAL — Batch + cache RBAC permission checks (biggest perf win; currently 4–6 DB connections per protected request). Caching landed (60s TTL + invalidation); query batching/session-sharing still open.
8. ✅ DONE — Extract shared `_build_login_response` from `login`/`refresh_token`.
9. ⬜ OPEN — Split the 800+ line files, starting with `baseline_generator.py` and the `cockpit_agent` router.
10. 🟡 PARTIAL — Pin dependencies; consider migrating `config.py` to `pydantic-settings`. Pinning done; `config.py` migration still open.

---

**Still open for the next pass (nothing above marked ✅ DONE or 🟡 PARTIAL's remainder):**
- OIDC `nonce` validation inside `verify_id_token` (§3.2) — not re-checked.
- `verify_api_key` swallowing into a bare 500 instead of `raise_internal_server_error` (§3.2).
- Broader `except Exception` audit beyond `delete_user_with_rbac` (~1053 sites, §4).
- `user_management.py` re-wrapping exceptions as bare `Exception` (§4).
- RBAC query batching / shared session per permission check (§5, §8.7).
- `verify_admin_token` deprecation — migrate remaining callers to `require_role("admin")` (§5).
- `BaseRepository.update`/`filter` silently ignoring unknown fields (§6).
- Repository session-per-method / read consistency (§6).
- DB pool sizing re-tune once RBAC batching lands (§6).
- Splitting 800+ line files (§7, §8.9).
- `config.py` → `pydantic-settings` migration (§7, §8.10).

---

## 9. Bottom Line

This is a **mature, well-disciplined FastAPI backend**. The layering is genuine, the security posture is above average (encryption at rest, hashed keys, sanitized errors, startup guards), and — most importantly — the team enforces its own rules with automated checks that all pass. The RBAC model is correctly designed.

The issues that matter are **narrow and concrete**: one unauthenticated GraphQL endpoint, OIDC state not verified, error-sanitization gaps in the service layer, and an un-cached RBAC hot path. Fix the GraphQL auth first — everything else is hardening and polish on an already-solid foundation.
