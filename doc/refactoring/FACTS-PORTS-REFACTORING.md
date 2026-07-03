# Refactoring plan — Get Server Facts & Get Open Ports

Consolidates the duplicated orchestration between **bulk job executors** (scheduled
or manual Celery runs) and **ad-hoc single-server refresh** (server detail UI), while
keeping the Ansible agent commands and `ServersService` persistence layer unchanged.

---

## 1. Goal & non-goals

### 1.1 Goals

1. **One implementation** for “call Ansible agent → parse output → upsert server” per
   operation type (`get_facts`, `get_open_ports`).
2. **Server-side credential resolution** for all call sites (no frontend password
   fetch for refresh flows).
3. **Thin executors** — Celery tasks delegate to a shared service, not ~280-line
   copy-paste files.
4. **Thin routers** — ad-hoc refresh uses dedicated server endpoints, not raw
   `/api/cockpit-agent/command`.
5. **Parity** — `get_open_ports` gets the same job-template and schedule UI coverage
   that `get_server_facts` already has.

### 1.2 Non-goals

- Changing the Ansible agent playbooks (`get_facts.yml`, `scan_open_ports.yml`) or
  agent `CommandExecutor` — already well-factored via `_run_ansible_playbook`.
- Merging facts and open ports into a single job type (they remain separate templates).
- Removing the generic `/api/cockpit-agent/command` endpoint (still needed for
  debugging and future commands).
- Replacing the dual Python/TypeScript facts parser with a single language (the
  intentional sync documented in `ansible_facts_parser.py` stays; ad-hoc refresh will
  stop needing the TS parser once it calls a backend endpoint).
- Database schema changes (template columns `facts_*` / `open_ports_*` are sufficient).

---

## 2. Current state (before)

### 2.1 Execution paths

There are **two orchestration paths** per feature. Scheduled and manual job runs share
path A; only `triggered_by` differs (`schedule` vs `manual`).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PATH A — Job template (scheduled or manual)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ JobSchedule / manual run                                                    │
│   → tasks.scheduling.job_dispatcher.dispatch_job                            │
│   → tasks.execution.base_executor.execute_job_type                          │
│   → execute_get_server_facts  OR  execute_get_open_ports                    │
│       → CIDR expand + fping (tasks.ping_network_task)                       │
│       → CockpitAgentService.send_ansible_get_facts / send_open_ports_scan   │
│       → parse_ansible_facts / parse_open_ports                              │
│       → ServersService.create / update (+ history)                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PATH B — Ad-hoc single server (UI)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Add server dialog:                                                          │
│   → POST /api/cockpit-agent/ansible/get-facts  (server-side creds) ✓        │
│   → frontend parseAnsibleFacts()                                            │
│   → POST /api/servers                                                       │
│                                                                             │
│ Refresh facts (server detail):                                              │
│   → GET  credentials/{id}/password  (client fetches secret)                 │
│   → POST /api/cockpit-agent/command  command=get_facts  (raw params)        │
│   → frontend parseAnsibleFacts()                                            │
│   → PUT  /api/servers/{id}                                                  │
│                                                                             │
│ Refresh open ports (server detail):                                         │
│   → GET  credentials/{id}/password                                          │
│   → POST /api/cockpit-agent/command  command=get_open_ports                 │
│   → frontend inline parsing                                                 │
│   → PUT  /api/servers/{id}                                                  │
│                                                                             │
│ Note: POST /api/cockpit-agent/open-ports-scan exists but is unused by UI.   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 File inventory

| Layer | Facts | Open Ports | Shared? |
|-------|-------|------------|---------|
| Celery executor | `backend/tasks/execution/get_server_facts_executor.py` (~295 lines) | `backend/tasks/execution/get_open_ports_executor.py` (~284 lines) | Structure ~90% identical |
| Agent convenience API | `CockpitAgentService.send_ansible_get_facts()` | `CockpitAgentService.send_open_ports_scan()` | Auth block ~60 lines duplicated |
| Agent command | `get_facts` | `get_open_ports` | Shared `_run_ansible_playbook()` on agent |
| Output parser | `services/servers/ansible_facts_parser.py` | `services/servers/open_ports_parser.py` | Different shapes (keep separate) |
| Persistence | `ServersService.create/update` + facts history repo | same + open ports history repo | **Shared** |
| Job template DB cols | `facts_prefixes`, `facts_agent_id` | `open_ports_prefixes`, `open_ports_agent_id` | Parallel naming |
| Schedule auth | `job_parameters.facts_auth_type` etc. | `job_parameters.open_ports_auth_type` etc. (backend only) | Frontend UI: facts only |
| Job template UI | `GetServerFactsJobTemplate.tsx` | **Missing** | — |
| Ad-hoc refresh UI | `use-refresh-server-facts.ts` | `use-refresh-server-open-ports.ts` | Both use raw `/command` |
| Unit tests | `test_get_server_facts_executor.py` | `test_get_open_ports_executor.py` | Near-duplicate mocks |

### 2.3 Duplication hotspots (line-level)

**Executors** — identical blocks in both files:

- Auth resolution (`ssh_key` / `ssh_key_passphrase` / `credentials`) — lines ~60–98
- CIDR expansion + empty/no-reachable early returns — lines ~102–140
- Agent online check + per-IP progress loop shell — lines ~157–175
- `AnsibleCredentials` construction — lines ~200–210
- Server create/update branching — lines ~212–253
- Result aggregation return shape — lines ~281–288

Only the per-IP body differs: agent method, parser, and `UpdateServerRequest` fields.

**CockpitAgentService** — `send_ansible_get_facts` (lines 462–526) and
`send_open_ports_scan` (lines 528–592) differ only in `command=` string.

**Frontend refresh hooks** — both:

1. Read `server.ansible_credentials`
2. Fetch password via `credentials/{id}/password` when not SSH-key-only
3. POST to `cockpit-agent/command` with plaintext params (encrypted in transit by
   backend Fernet before Redis, but secret still crosses the browser)
4. Parse locally and `PUT /api/servers/{id}`

### 2.4 What is already good (do not refactor)

| Component | Why leave it |
|-----------|--------------|
| `scripts/cockpit_agent_ansible/executor.py` | `_run_ansible_playbook` already shared |
| `ServersService` history logic | Single persistence gate; content-hash dedup works |
| `dispatch_job` + `execute_job_type` | Standard job routing |
| `parse_ansible_facts` / `parse_open_ports` | Different output contracts; small and testable |
| Dedicated cockpit-agent routes | Keep as low-level escape hatch |

---

## 3. Problems to fix

| # | Problem | Impact |
|---|---------|--------|
| P1 | Two ~280-line executors with copy-pasted scan/auth/upsert logic | Bug fixes must be applied twice |
| P2 | Two ~65-line agent methods with copy-pasted auth resolution | Same |
| P3 | Ad-hoc refresh bypasses convenience endpoints; fetches passwords in browser | Security inconsistency; harder to audit |
| P4 | Refresh logic split across frontend (parse + update) and backend (executors) | Behaviour drift risk between paths |
| P5 | `get_open_ports` job template has backend support but no frontend template/schedule UI | Feature incomplete |
| P6 | `/open-ports-scan` endpoint unused; three ways to invoke same agent command | Confusing API surface |

---

## 4. Target architecture (after)

### 4.1 Layer diagram

```
                    ┌──────────────────────────────────────┐
                    │  Routers (thin)                       │
                    ├──────────────────────────────────────┤
                    │  POST /api/servers/{id}/refresh-facts │
                    │  POST /api/servers/{id}/refresh-ports │
                    │  POST /api/cockpit-agent/ansible/...  │  (add-server only)
                    │  Job manual run / schedule              │
                    └──────────────┬───────────────────────┘
                                   │
                    ┌──────────────▼───────────────────────┐
                    │  ServerAnsibleOperationsService       │  NEW
                    │  (services/servers/ansible_ops.py)    │
                    ├──────────────────────────────────────┤
                    │  refresh_facts(server_id, creds, ...) │
                    │  refresh_open_ports(server_id, ...) │
                    │  gather_facts_for_ip(ip, creds, ...)  │
                    │  scan_ports_for_ip(ip, creds, ...)    │
                    │  run_prefix_scan(operation, config)   │
                    └──────────────┬───────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
   CockpitAgentService    parse_*_parser.py    ServersService
   (thin wrappers)        (unchanged)          (unchanged)
              │
              ▼
   Ansible agent: get_facts | get_open_ports
```

### 4.2 New shared modules

| File | Responsibility |
|------|----------------|
| `backend/services/cockpit_agent/ansible_auth.py` | `ResolvedAnsibleAuth` dataclass + `resolve_ansible_auth(auth_type, credential_id, ansible_user)` |
| `backend/services/servers/ansible_ops.py` | All “agent call → parse → upsert server” logic |
| `backend/models/servers.py` (add) | `RefreshServerFactsResponse`, `RefreshOpenPortsResponse` |
| `frontend/.../utils/parse-open-ports.ts` | Optional until Phase 4 removes client-side parsing |

### 4.3 API after refactor

| Endpoint | Caller | Replaces |
|----------|--------|----------|
| `POST /api/servers/{id}/refresh-facts` | Server detail “Refresh facts” | `/command` + `PUT /servers/{id}` |
| `POST /api/servers/{id}/refresh-open-ports` | Server detail “Scan ports” | `/command` + `PUT /servers/{id}` |
| `POST /api/cockpit-agent/ansible/get-facts` | Add-server dialog | unchanged |
| Celery executors | Scheduled/manual jobs | inline logic → `ansible_ops.run_prefix_scan` |

---

## 5. Phased implementation

PRs are sequenced so each phase is independently shippable. Run backend
`ruff format . && ruff check --fix . && pytest -q` and frontend `npm run lint`
after each phase.

---

### Phase 0 — Baseline & guardrails

**Before:** No shared module; duplication unmeasured.

**Steps:**

1. Add a short comment at the top of both executors pointing to this doc (prevents
   further copy-paste edits during the refactor).
2. Ensure existing tests pass as regression baseline:
   - `backend/tests/unit/tasks/test_get_server_facts_executor.py`
   - `backend/tests/unit/tasks/test_get_open_ports_executor.py`
   - `backend/tests/unit/services/test_ansible_facts_parser.py`
   - `backend/tests/unit/services/test_open_ports_parser.py`

**After:** Green test suite; team aligned on plan.

---

### Phase 1 — Shared Ansible auth resolution

**Before:**

```python
# cockpit_agent_service.py — duplicated in send_ansible_get_facts AND send_open_ports_scan
if use_sshkey and credential_id is None:
    ...
elif credential_id is not None:
    creds_svc = service_factory.build_credentials_service()
    cred = creds_svc.get_credential_by_id(credential_id)
    ...
    secret = creds_svc.get_decrypted_password(credential_id)
    ...
else:
    raise ValueError(...)
```

**After:**

```python
# backend/services/cockpit_agent/ansible_auth.py
@dataclass(frozen=True)
class ResolvedAnsibleAuth:
    ansible_user: str
    use_sshkey: bool
    credential_id: Optional[int]  # for passphrase/password modes
    # Plaintext secrets are resolved only inside CockpitAgentService when building params

def resolve_ansible_auth(
    *,
    auth_type: Literal["ssh_key", "ssh_key_passphrase", "credentials"],
    credential_id: Optional[int],
    ansible_user: Optional[str],
) -> ResolvedAnsibleAuth: ...
```

```python
# cockpit_agent_service.py
def _build_ansible_params(
    self, ip_address: str, auth: ResolvedAnsibleAuth, *, ansible_port: int = 22
) -> dict: ...

def send_ansible_command(
    self, agent_id: str, command: str, ip_address: str,
    auth: ResolvedAnsibleAuth, sent_by: str, *, timeout: int = 60,
) -> dict: ...

def send_ansible_get_facts(...) -> dict:
    auth = resolve_ansible_auth(...)
    return self.send_ansible_command(agent_id, "get_facts", ip_address, auth, ...)

def send_open_ports_scan(...) -> dict:
    auth = resolve_ansible_auth(...)
    return self.send_ansible_command(agent_id, "get_open_ports", ip_address, auth, ...)
```

**Files to touch:**

| Action | File |
|--------|------|
| Create | `backend/services/cockpit_agent/ansible_auth.py` |
| Modify | `backend/services/cockpit_agent/cockpit_agent_service.py` |
| Create | `backend/tests/unit/services/test_ansible_auth.py` |

**Tests:** Unit-test all three auth modes + error cases once in `test_ansible_auth.py`.
Existing executor tests should still pass unchanged.

---

### Phase 2 — `ServerAnsibleOperationsService` (core consolidation)

**Before:** Executors contain full per-IP upsert logic. No backend single-server refresh.

**After:**

```python
# backend/services/servers/ansible_ops.py

@dataclass(frozen=True)
class PrefixScanConfig:
    agent_id: str
    prefixes: list[str]
    auth: ResolvedAnsibleAuth
    sent_by: str
    timeout: int = 90

@dataclass(frozen=True)
class HostScanResult:
    hostname: str
    operation: str  # "create" | "update" | "get_facts" | "get_open_ports"
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None
    server_id: Optional[int] = None

class ServerAnsibleOperationsService:
    def __init__(
        self,
        servers_service: ServersService,
        agent_service: CockpitAgentService,
    ): ...

    # --- Single host (ad-hoc path) ---
    def refresh_facts_for_server(self, server_id: int, sent_by: str) -> HostScanResult: ...
    def refresh_open_ports_for_server(self, server_id: int, sent_by: str) -> HostScanResult: ...

    # --- Bulk prefix scan (job path) ---
    def run_facts_prefix_scan(
        self, config: PrefixScanConfig, progress: Optional[ProgressCallback] = None
    ) -> dict: ...
    def run_open_ports_prefix_scan(
        self, config: PrefixScanConfig, progress: Optional[ProgressCallback] = None
    ) -> dict: ...

    # --- Internal (private) ---
    def _gather_facts_and_upsert(self, ip: str, creds: AnsibleCredentials, ...) -> HostScanResult: ...
    def _scan_ports_and_upsert(self, ip: str, creds: AnsibleCredentials, ...) -> HostScanResult: ...
    def _expand_and_ping(self, prefixes: list[str]) -> tuple[list[str], list[str]]: ...
```

**Key behaviour to preserve when moving code:**

1. `AnsibleCredentials` on server: `credential_id=None` when `use_sshkey=True`.
   `use_sshkey` is `True` for **both** `ssh_key` and `ssh_key_passphrase` modes, so
   the passphrase credential is never persisted on the server (matches
   `models/servers.py` model validator).
2. `ansible_user` is only persisted for plain `ssh_key` mode; it is `None` for
   `ssh_key_passphrase` and `credentials` modes (see executor lines ~179–181).
3. Hostname resolution: facts use `parsed.hostname or ip`; ports use
   `parsed.hostname or ip`.
4. Facts update writes full server fields; ports update writes `hostname`,
   `primary_ipv4`, `open_ports`, `ansible_credentials` only.
5. History recording stays in `ServersService` — ops service must call
   `create`/`update`, not repository directly.
6. Job executor return dict shape unchanged (`success`, `total`, `reachable_count`,
   `scanned_ip_count`, `success_count`, `failed_count`, `results`).

**Files to touch:**

| Action | File |
|--------|------|
| Create | `backend/services/servers/ansible_ops.py` |
| Create | `backend/tests/unit/services/test_server_ansible_ops.py` |
| Modify | `backend/service_factory.py` — `build_server_ansible_ops_service()` |
| Modify | `backend/dependencies.py` — `get_server_ansible_ops_service()` |

**Tests (new):**

- `refresh_facts_for_server` with mocked agent + existing server → update + history
- `refresh_open_ports_for_server` create path when hostname unknown
- `run_facts_prefix_scan` with mocked fping returning 2 IPs, 1 success 1 failure
- Auth error propagation (offline agent, missing credential)

---

### Phase 3 — Thin Celery executors

**Before:** `get_server_facts_executor.py` ~295 lines, `get_open_ports_executor.py` ~284 lines.

**After:** Each executor ~40–60 lines:

```python
# get_server_facts_executor.py (after)
def execute_get_server_facts(..., task_context, ...) -> Dict[str, Any]:
    config, err = _load_prefix_scan_config(
        job_parameters, template, credential_id,
        agent_key="facts_agent_id", prefixes_key="facts_prefixes",
        auth_type_key="facts_auth_type", user_key="facts_ansible_user",
    )
    if err:
        return err

    import service_factory
    from core.database import SessionLocal
    from services.cockpit_agent.cockpit_agent_service import CockpitAgentService

    db = SessionLocal()
    try:
        ops = service_factory.build_server_ansible_ops_service(
            db=db,  # or inject agent_service with session
        )
        return ops.run_facts_prefix_scan(
            config,
            progress=lambda cur, total, status: task_context.update_state(
                state="PROGRESS", meta={"current": cur, "total": total, "status": status}
            ),
        )
    finally:
        db.close()
```

Extract `_load_prefix_scan_config(...)` into
`backend/tasks/execution/_ansible_job_config.py` (shared by both executors; parameterised
field names).

**Files to touch:**

| Action | File |
|--------|------|
| Create | `backend/tasks/execution/_ansible_job_config.py` |
| Shrink | `backend/tasks/execution/get_server_facts_executor.py` |
| Shrink | `backend/tasks/execution/get_open_ports_executor.py` |
| Keep | `backend/tasks/execution/base_executor.py` (mapping unchanged) |

**Tests:** Existing executor unit tests should remain valid (same public contract).
Update mocks to patch `build_server_ansible_ops_service` instead of low-level agent
calls if internals move.

---

### Phase 4 — Server refresh API (ad-hoc backend path)

**Before:**

```
Browser → credentials/{id}/password → cockpit-agent/command → parse → PUT /servers/{id}
```

**After:**

```
Browser → POST /api/servers/{id}/refresh-facts
       → ServerAnsibleOperationsService.refresh_facts_for_server()
       → returns updated ServerResponse
```

**New router endpoints** in `backend/routers/servers/servers.py`:

```python
@router.post("/{server_id}/refresh-facts", response_model=ServerResponse)
def refresh_server_facts(
    server_id: int,
    user: dict = Depends(require_permission("servers", "write")),
    service: ServerAnsibleOperationsService = Depends(get_server_ansible_ops_service),
) -> ServerResponse:
    result = service.refresh_facts_for_server(server_id, sent_by=user["sub"])
    if not result.success:
        raise HTTPException(status_code=422, detail=result.error)
    server = service.servers.get_by_id(server_id)  # or return from result
    return ServerResponse.model_validate(server)


@router.post("/{server_id}/refresh-open-ports", response_model=ServerResponse)
def refresh_server_open_ports(...):  # symmetric
```

Note: `require_permission` already wraps `verify_token` and returns the user dict —
one dependency suffices (matches existing `servers.py` convention of sync `def`
endpoints with a single permission dependency). Expected agent/credential failures
map to 422 with the sanitized `result.error`; unexpected exceptions must go through
`core.safe_http_errors.raise_internal_server_error` (never raw `str(e)` in a 5xx).

**Permission:** `servers:write` (same as update). Agent execute permission is implied
(server already stores `agent_id`).

**Frontend changes:**

| File | Before | After |
|------|--------|-------|
| `use-refresh-server-facts.ts` | ~130 lines, `/command` + password fetch + parse + PUT | ~40 lines, `POST servers/{id}/refresh-facts` |
| `use-refresh-server-open-ports.ts` | same pattern | `POST servers/{id}/refresh-open-ports` |
| `add-server-dialog.tsx` | `/ansible/get-facts` + `createServer` | **Keep** (wizard still needs pre-create gather) |

**Tests:**

- `backend/tests/unit/core/test_servers_router.py` — refresh endpoints (success, 404,
  422 agent error, permission denied)
- Optional: narrow integration test with mocked agent service

---

### Phase 5 — `get_open_ports` job template & schedule UI parity

**Before:**

| Area | Facts | Open Ports |
|------|-------|------------|
| Template form | `GetServerFactsJobTemplate.tsx` | Missing |
| Template types | `facts_prefixes`, `facts_agent_id` | Not in TS types |
| Schedule auth UI | `facts_auth_type` picker | Missing |
| Template payload | sends `facts_*` fields | Never sent |
| Type label/color | in `JOB_TYPE_LABELS` / `JOB_TYPE_COLORS` | **Missing** (badge falls back to raw value + `bg-gray-500`) |

Note: backend `get_job_types()` already returns `get_open_ports`, so the type is
selectable in the template dropdown today — but saving produces a template with no
prefixes/agent config because the form and payload wiring are missing.

**After:**

| Area | Change |
|------|--------|
| `GetOpenPortsJobTemplate.tsx` | Clone/adapt from `GetServerFactsJobTemplate.tsx` (in `templates/components/template-types/`) |
| `template-form-dialog.tsx` | Wire `get_open_ports` validation + payload (`open_ports_prefixes`, `open_ports_agent_id`) |
| `templates/types/index.ts` | Add `open_ports_prefixes`, `open_ports_agent_id` |
| `jobs/scheduler/components/schedule-form-dialog.tsx` | Add `isGetOpenPorts` branch mirroring facts auth (`open_ports_auth_type`, `open_ports_ansible_user`) |
| `templates/utils/constants.ts` | **Add** `get_open_ports` to `JOB_TYPE_LABELS` + `JOB_TYPE_COLORS` (currently missing) |

**Backend:** No changes required (fields already in `job_template_service.py` and DB).

---

### Phase 6 — Cleanup & documentation

**Before:**

- Dead duplication in executors and agent service
- `/open-ports-scan` undocumented relative to refresh flow
- Frontend parses facts in two places for refresh

**After:**

1. Remove any dead code paths uncovered by grep (`send_ansible_get_facts` callers
   should remain for add-server and ops service).
2. Add docstring on `/api/cockpit-agent/open-ports-scan`:
   “Prefer `POST /api/servers/{id}/refresh-open-ports` for UI refresh.”
3. Update `CLAUDE.md` “Adding New Backend Endpoint” example if a servers refresh
   endpoint becomes the canonical pattern.
4. Optional: deprecate client-side `parseAnsibleFacts` in refresh hook (still used by
   add-server dialog until that flow also moves server-side).

---

## 6. Before / after summary table

| Concern | Before | After |
|---------|--------|-------|
| Bulk scan orchestration | 2 executors × ~280 lines | 2 thin executors + `ansible_ops.run_*_prefix_scan` |
| Single-server refresh | Frontend `/command` + parse + PUT | `POST /api/servers/{id}/refresh-*` |
| Agent auth resolution | 2× in `CockpitAgentService` | `ansible_auth.resolve_ansible_auth` once |
| Credential secret in browser | Yes (refresh hooks) | No |
| Parser usage (refresh) | Frontend TS | Backend only |
| Parser usage (add server) | Frontend TS | Unchanged (Phase 4); optional later |
| Job template UI | Facts only | Facts + Open Ports |
| Schedule auth UI | Facts only | Facts + Open Ports |
| Agent playbooks | Shared `_run_ansible_playbook` | Unchanged |
| `ServersService` history | Central | Unchanged |
| Tests | 2 near-duplicate executor suites | 1 ops service suite + thin executor smoke |

---

## 7. Testing strategy

### 7.1 Unit tests (required per phase)

| Phase | New / updated tests |
|-------|---------------------|
| 1 | `test_ansible_auth.py` — 3 auth modes + validation errors |
| 2 | `test_server_ansible_ops.py` — single-host refresh, prefix scan, upsert create/update |
| 3 | Executor tests — same assertions, updated mocks |
| 4 | `test_servers_router.py` — refresh endpoints |
| 5 | Frontend — optional component tests for new template section |

### 7.2 Manual verification checklist

- [ ] Create `get_server_facts` template + schedule → manual run → servers appear in inventory
- [ ] Create `get_open_ports` template + schedule → manual run → `open_ports` populated
- [ ] Server detail → Refresh facts → fields update, history entry when changed
- [ ] Server detail → Scan open ports → TCP/UDP lists update, history entry when changed
- [ ] Add server dialog still works (SSH key + credential modes)
- [ ] Offline agent returns 422 on refresh endpoints, sanitized 5xx on unexpected errors
- [ ] Celery job progress bar still updates during prefix scan

### 7.3 Definition of done (per project standards)

```bash
cd backend && ruff format . && ruff check --fix . && pytest -q
cd frontend && npm run lint
```

---

## 8. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Behaviour drift during extraction | Move code mechanically first; keep executor tests green before deleting old blocks |
| `SessionLocal` lifecycle in Celery | Ops service receives `db` session same as today; document that agent service needs the session for command history |
| Long-running refresh blocks HTTP | Acceptable for single host (~60–90s); matches current UX. Future: async job + polling if needed |
| Add-server still uses frontend parse | Out of scope; refresh path is the security win |
| `credential_id` on SSH-key-with-passphrase | Preserve existing semantics: stored on server only when `use_sshkey=False` |

---

## 9. Optional follow-ups (post-refactor)

1. **Unified prefix-scan job type** — single template with `operations: ["facts", "ports"]`
   (larger product change; not recommended now).
2. **Add-server server-side** — `POST /api/servers/discover` that gathers facts and
   creates in one call (removes last frontend parser dependency).
3. **Extract `_load_prefix_scan_config` auth fields to job template columns** —
   only if schedule `job_parameters` JSON becomes hard to manage.
4. **Parallel per-host scans** — executors are sequential today; ops service could add
   `parallel_tasks` later (mirror `get_client_data`).

---

## 10. Implementation order (quick reference)

```
Phase 0  Baseline tests
Phase 1  ansible_auth.py + thin CockpitAgentService
Phase 2  ansible_ops.py (core logic)
Phase 3  Thin executors + _ansible_job_config.py
Phase 4  Server refresh endpoints + frontend hooks
Phase 5  Open ports job template + schedule UI
Phase 6  Cleanup + docs
```

Estimated touch count: **~8 new files**, **~12 modified files**, **0 migrations**.
