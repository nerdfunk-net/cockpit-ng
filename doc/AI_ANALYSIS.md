# Backend Code Quality Analysis

**Date:** 2026-06-03
**Scope:** `/backend/` — 708 Python files, ~105k lines (production + test)
**Stack:** FastAPI, SQLAlchemy, PostgreSQL, Celery

---

## What's Working Well

**Architecture consistency** — all four automated guardrail scripts pass cleanly:
- No `asyncio.run()` in routers
- No raw `sqlalchemy.text()` outside the allow-list
- No repository imports leaking into routers
- No 5xx HTTP leaks (strict format enforced)

**Linting** — only 11 ruff violations across the entire codebase, all trivial unused imports in test files. Zero f-string logging violations in production code.

**Test suite** — 1,446 unit tests, 0 failures, full pass in ~14 seconds. The unit/integration separation is cleanly applied.

**Defensive style** — zero bare `except:` clauses, only 11 `type: ignore` suppressions, only 4 TODO/FIXME comments in the entire codebase.

---

## Issues

### HIGH — Integration test failures (4 tests)

`tests/integration/repositories/test_client_data_repository_pg.py` has 4 failing tests indicating logic bugs in the client data repository:

- `TestGetDeviceNamesPg::test_includes_l2_only_device_from_latest_session`
- `TestDeleteOldSessionsPg::test_keeps_newest_sessions_across_mac_and_ip`
- `TestGetClientHistoryPg::test_ip_history_distinct_on_session_and_device`
- `TestDeleteRecordsOlderThanPg::test_removes_rows_older_than_cutoff`

These are correctness failures (wrong record counts and wrong result sets from DB queries), not test setup issues.

### HIGH — Exception text leaking into HTTP responses (78 locations)

`str(e)` is passed directly into `HTTPException(detail=...)` in 78 places across routers. While the automated check covers only 5xx responses, 4xx responses that expose internal exception text are a security and information-disclosure concern.

Key offenders:
- `routers/settings/compliance/rules.py` (4 occurrences)
- `routers/checkmk/tag_groups.py` (4 occurrences)
- `routers/settings/templates/crud.py`, `render.py`, `content.py`, `import_.py`
- `routers/settings/nautobot.py` (response dict messages include `str(e)`)

Fix: use `raise_internal_server_error()` for 5xx; for 4xx with user-facing messages, raise custom domain exceptions with safe, pre-written strings rather than forwarding the raw exception.

### MEDIUM — 8 direct `HTTPException(status_code=500)` bypassing the safe handler

These bypass `raise_internal_server_error()`, meaning no `error_id` is generated for log correlation:

| File | Lines |
|------|-------|
| `routers/cockpit_agent.py` | 151, 199 |
| `routers/jobs/runs.py` | 536, 665 |
| `routers/git/operations.py` | 218, 344 |
| `routers/git/repositories.py` | 148, 184 |

Fix: replace with `raise_internal_server_error(logger, "…", e)`.

### MEDIUM — Test coverage below target

`pyproject.toml` sets `fail_under = 55`; actual coverage is **58.45%**. The project-wide standard requires 80%.

Many Pydantic model files have 0% coverage (`models/backup_models.py`, `models/celery.py`, `models/checkmk.py`, `models/checkmk_priority.py`, `models/client_data.py`, `models/cockpit_agent.py`, `models/credentials.py`, and more).

Notable low-coverage production files:
- `utils/cmk_site_utils.py` — 69%
- `utils/audit_logger.py` — 90%

Fix: raise `fail_under` incrementally toward 80% and add missing model/service tests.

### LOW — File size violations (8 files exceed the 800-line ceiling)

| File | Lines |
|------|-------|
| `services/network/tools/baseline.py` | 1513 |
| `services/network/tools/baseline_generator.py` | 1091 |
| `routers/nautobot/clusters.py` | 970 |
| `services/nautobot/imports/csv_import_service.py` | 890 |
| `routers/settings/rbac.py` | 883 |
| `services/nautobot/devices/creation.py` | 879 |
| `services/git/file_service.py` | 871 |
| `services/nautobot/imports/prefix_update_service.py` | 811 |

The two baseline files are the most egregious at nearly double the limit. Large files indicate accumulated logic without extraction — candidates for splitting by responsibility.

### LOW — High `except Exception` density

888 broad `except Exception` clauses across routers and services. None silently swallow errors (no bare `pass`), but the density makes it hard to distinguish expected error paths from genuine surprises during debugging. Where the exception type is known, prefer narrower exception types.

---

## Summary

The AI-generated code follows the architectural conventions faithfully — layered pattern, naming conventions, and automated guardrails are all respected. The quality gaps are characteristic of AI generation: coverage threshold set to the minimum rather than the target, exception text forwarded to HTTP responses as a "works" shortcut, and files that grew without being split. The integration test failures are the most urgent item — they represent real correctness bugs in the client data repository layer.

### Priority order

1. Fix the 4 failing integration tests in `test_client_data_repository_pg.py`
2. Eliminate `str(e)` in `HTTPException(detail=...)` across 78 router locations
3. Replace the 8 direct `HTTPException(status_code=500)` with `raise_internal_server_error()`
4. Raise `fail_under` toward 80% and add missing coverage
5. Split the 8 oversized files (start with the two baseline files at 1500+ lines)
