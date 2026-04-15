# Plan: "Get Client Data" Job Template

## Context

Add a new job template type `get_client_data` that SSHs into network devices via Netmiko, runs `show ip arp` and `show mac address-table` with TextFSM parsing, DNS-resolves the IPs, and stores the results in three new database tables. The feature mirrors the existing `run_commands` pattern end-to-end: DB model → migration → Pydantic → repository → executor → Celery task → API endpoint → frontend panel.

A TextFSM test script is also needed first so the user can verify the parsed output field names against a real device before implementation is finalized.

---

## Files to Create (New)

| File | Purpose |
|------|---------|
| `backend/scripts/textfsm_test/test_commands.py` | Standalone CLI script to preview raw + TextFSM output |
| `backend/migrations/versions/026_add_client_data.py` | DB migration |
| `backend/models/client_data.py` | Pydantic models for new tables |
| `backend/repositories/client_data_repository.py` | Bulk insert for 3 tables |
| `backend/tasks/execution/client_data_executor.py` | Core executor logic |
| `backend/tasks/get_client_data_task.py` | Celery task wrapper |
| `frontend/src/components/features/jobs/templates/components/template-types/GetClientDataJobTemplate.tsx` | UI panel with 3 checkboxes |

## Files to Modify

| File | Change |
|------|--------|
| `backend/core/models.py` | Add 3 new table models + 3 bool columns on `JobTemplate` |
| `backend/models/job_templates.py` | Add `"get_client_data"` to `JobTemplateType`, add `collect_*` fields |
| `backend/models/celery.py` | Add `GetClientDataRequest` |
| `backend/job_template_manager.py` | create/update/get_job_types/_model_to_dict |
| `backend/tasks/execution/base_executor.py` | Register executor in `job_executors` dict |
| `backend/tasks/__init__.py` | Export new task |
| `backend/celery_app.py` | Add task routing to `"network"` queue |
| `backend/routers/jobs/device_tasks.py` | Add `POST /api/celery/tasks/get-client-data` |
| `frontend/src/components/features/jobs/templates/types/index.ts` | Add `collect_*` fields to `JobTemplate` |
| `frontend/src/components/features/jobs/templates/components/template-form-dialog.tsx` | Wire new component, state, payload |
| `frontend/src/components/features/jobs/templates/schemas/template-schema.ts` | Add `getClientDataTemplateSchema` |
| `frontend/src/components/features/jobs/templates/utils/constants.ts` | Add `get_client_data` to `JOB_TYPE_COLORS` |
| `frontend/src/components/features/jobs/scheduler/components/schedule-form-dialog.tsx` | Add `get_client_data` to `requiresCredential` |

---

## Step 1 — TextFSM Test Script

**`backend/scripts/textfsm_test/test_commands.py`**

CLI script: `python test_commands.py --host 192.168.1.1 -u admin -p secret [--platform cisco_ios]`

- Connects via Netmiko
- For each of `show ip arp` and `show mac address-table`:
  - Prints first 2000 chars of raw output
  - Calls `netmiko.utilities.get_structured_data(raw, platform, command)`
  - Prints first 5 parsed rows + total count, or a "no template" message

This lets the user confirm the actual field names before the executor is finalized.

---

## Step 2 — Database Schema

### New columns on `JobTemplate` (in `backend/core/models.py`)

```python
collect_ip_address  = Column(Boolean, nullable=False, default=True)
collect_mac_address = Column(Boolean, nullable=False, default=True)
collect_hostname    = Column(Boolean, nullable=False, default=True)
```

### Three new SQLAlchemy models (appended after `RackDeviceMapping`)

**`ClientIpAddress`** → `client_ip_addresses`
- `id`, `session_id` (VARCHAR 36, indexed), `ip_address`, `mac_address`, `interface`, `device_name` (indexed), `collected_at`

**`ClientMacAddress`** → `client_mac_addresses`
- `id`, `session_id`, `mac_address`, `vlan`, `port`, `device_name`, `collected_at`

**`ClientHostname`** → `client_hostnames`
- `id`, `session_id`, `ip_address`, `hostname`, `device_name`, `collected_at`

The `session_id` (UUID string, generated per collection run) is the cross-table join key. `mac_address` links ARP rows to MAC-table rows (both use Cisco dotted-quad format, normalise to lowercase). `ip_address` links ARP rows to hostname rows.

---

## Step 3 — Migration

**`backend/migrations/versions/026_add_client_data.py`**

Uses `AutoSchemaMigration` (same pattern as migration 025). Creates the 3 new tables and adds the 3 boolean columns to `job_templates`.

---

## Step 4 — Pydantic Models

**`backend/models/client_data.py`**: `ClientIpAddressCreate/Response`, `ClientMacAddressCreate/Response`, `ClientHostnameCreate/Response`

**`backend/models/job_templates.py`**:
- Add `"get_client_data"` to `JobTemplateType` Literal
- Add to `JobTemplateBase`:
  ```python
  collect_ip_address:  Optional[bool] = Field(True, ...)
  collect_mac_address: Optional[bool] = Field(True, ...)
  collect_hostname:    Optional[bool] = Field(True, ...)
  ```

---

## Step 5 — Repository

**`backend/repositories/client_data_repository.py`**

Uses `Session.bulk_insert_mappings()` for efficiency:
- `bulk_insert_ip_addresses(records: list[dict]) -> int`
- `bulk_insert_mac_addresses(records: list[dict]) -> int`
- `bulk_insert_hostnames(records: list[dict]) -> int`

---

## Step 6 — Executor

**`backend/tasks/execution/client_data_executor.py`**

`execute_get_client_data(schedule_id, credential_id, job_parameters, target_devices, task_context, template=None, job_run_id=None)`

Execution flow:
1. Load credential, determine `collect_*` flags from `template` dict (fallback `True`)
2. Generate `session_id = str(uuid.uuid4())`
3. Resolve device list (from Nautobot if `target_devices` empty, same as `command_executor`)
4. For each device:
   a. Fetch IP + platform from Nautobot via GraphQL (copy pattern from `command_executor`)
   b. Build command list based on `collect_ip_address` / `collect_mac_address` flags
   c. Call `NetmikoService._connect_and_execute()` with `use_textfsm=True`
   d. Parse ARP output: check `isinstance(output, list)` — if `str`, log warning and skip
      - Expected ntc-templates fields (cisco_ios): `address`, `mac`, `interface`
   e. Parse MAC-table output: same guard
      - Expected ntc-templates fields (cisco_ios): `destination_address`, `vlan`, `destination_port`
   f. Normalise `mac_address.lower().strip()` for consistent joins
   g. DNS resolve unique IPs via `socket.gethostbyaddr()` (try/except per IP)
   h. Update progress per device
5. Bulk insert all collected rows via `ClientDataRepository`
6. Return summary: `{session_id, total_devices, success_count, failed_count, arp_entries, mac_entries, hostname_entries}`

**TextFSM fallback**: If output is raw string (no template available), log warning, store first 500 chars in result dict for debugging, continue without crashing.

**MAC normalisation**: Both ARP and MAC table use identical dotted-quad format on Cisco IOS. Store as-is after `.lower().strip()`. No format conversion needed.

---

## Step 7 — Celery Task

**`backend/tasks/get_client_data_task.py`**

```python
@shared_task(bind=True, name="tasks.get_client_data_task")
def get_client_data_task(self, ...):
    return execute_get_client_data(..., task_context=self)
```

**`backend/tasks/__init__.py`**: Export `get_client_data_task`

**`backend/celery_app.py`** `task_routes`:
```python
"tasks.get_client_data_task": {"queue": "network"},
```

**`backend/tasks/execution/base_executor.py`**:
```python
"get_client_data": execute_get_client_data,
```

---

## Step 8 — API Endpoint

**`backend/models/celery.py`**: Add `GetClientDataRequest`:
```python
class GetClientDataRequest(BaseModel):
    inventory: List[str]
    credential_id: int
    collect_ip_address: bool = True
    collect_mac_address: bool = True
    collect_hostname: bool = True
```

**`backend/routers/jobs/device_tasks.py`**: Add `POST /api/celery/tasks/get-client-data`
- Permission: `require_permission("devices.manage", "execute")`
- Creates job_run, calls `get_client_data_task.apply_async(..., queue="network")`, returns `TaskWithJobResponse`
- `job_parameters` carries the `collect_*` flags

---

## Step 9 — job_template_manager.py

- `create_job_template()`: add 3 new kwargs (default `True`)
- `update_job_template()`: add 3 optional kwargs, conditionally add to `update_data`
- `_model_to_dict()`: add `collect_ip_address`, `collect_mac_address`, `collect_hostname`
- `get_job_types()`: append `{"value": "get_client_data", "label": "Get Client Data", "description": "..."}`

---

## Step 10 — Frontend

### New component: `GetClientDataJobTemplate.tsx`
- Emerald color scheme (`border-emerald-200`, `bg-emerald-50/30`)
- `Database` Lucide icon
- Panel label: "Collect Properties"
- Three `Checkbox` rows: "IP Address (ARP table)", "MAC Address (MAC address table)", "Resolve Hostname (DNS)"
- All default `true`
- Helper text: "Requires SSH credentials. Data is joined by session ID and MAC address."

### `types/index.ts`
Add to `JobTemplate`: `collect_ip_address?: boolean`, `collect_mac_address?: boolean`, `collect_hostname?: boolean`

### `template-form-dialog.tsx`
- 3 new `useState(true)` hooks
- Import + render `<GetClientDataJobTemplate>` when `formJobType === 'get_client_data'`
- Add to `resetForm()` and edit pre-fill `useEffect`
- Add payload: `collect_ip_address: formJobType === 'get_client_data' ? formCollectIpAddress : undefined` (×3)
- `isFormValid`: no extra validation needed (all checkboxes optional)

### `schedule-form-dialog.tsx` (line ~106)
```typescript
const requiresCredential = selectedTemplate &&
  (selectedTemplate.job_type === 'backup' ||
   selectedTemplate.job_type === 'run_commands' ||
   selectedTemplate.job_type === 'get_client_data')
```

### `template-schema.ts`
Add `getClientDataTemplateSchema` with `collect_ip_address/mac_address/hostname: z.boolean()`, include in discriminated union.

### `constants.ts`
Add `'get_client_data': 'bg-emerald-500'` to `JOB_TYPE_COLORS`.

---

## Implementation Order

```
1. backend/core/models.py
2. backend/migrations/versions/026_add_client_data.py
3. backend/models/client_data.py
4. backend/models/job_templates.py
5. backend/repositories/client_data_repository.py
6. backend/job_template_manager.py
7. backend/tasks/execution/client_data_executor.py
8. backend/tasks/get_client_data_task.py
9. backend/tasks/__init__.py + backend/celery_app.py
10. backend/tasks/execution/base_executor.py
11. backend/models/celery.py + backend/routers/jobs/device_tasks.py
12. frontend: types/index.ts
13. frontend: GetClientDataJobTemplate.tsx
14. frontend: template-form-dialog.tsx
15. frontend: schedule-form-dialog.tsx
16. frontend: template-schema.ts + constants.ts
17. backend/scripts/textfsm_test/test_commands.py
```

---

## Verification

1. **TextFSM script**: `python backend/scripts/textfsm_test/test_commands.py --host <ip> -u <user> -p <pass>` — confirm field names in parsed output
2. **Migration**: Restart backend → check logs for `026_add_client_data applied`; confirm columns exist in DB
3. **UI**: Create a "get Client Data" template → verify emerald panel with 3 checked checkboxes appears
4. **Scheduler**: Schedule the template → verify credential dropdown appears
5. **Task**: Trigger via API `POST /api/celery/tasks/get-client-data` with a known device → check job_runs for status → query `client_ip_addresses`, `client_mac_addresses`, `client_hostnames` to verify data
6. **Join test**: `SELECT i.ip_address, i.mac_address, m.vlan, m.port, h.hostname FROM client_ip_addresses i LEFT JOIN client_mac_addresses m ON i.mac_address = m.mac_address AND i.session_id = m.session_id LEFT JOIN client_hostnames h ON i.ip_address = h.ip_address AND i.session_id = h.session_id WHERE i.session_id = '<uuid>';`
