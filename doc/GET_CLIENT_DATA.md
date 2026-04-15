# Get Client Data — Implementation Status

## What Was Built

A new job template type `get_client_data` that SSHs into network devices via Netmiko, runs `show ip arp` and `show mac address-table` with TextFSM parsing, DNS-resolves the collected IPs, and stores everything in three new database tables.

---

## Completed

### Backend

| File | Status | Notes |
|------|--------|-------|
| `backend/core/models.py` | ✅ Done | 3 new table models + 3 bool columns on `JobTemplate` |
| `backend/migrations/versions/026_add_client_data.py` | ✅ Done | Auto-runs on backend startup |
| `backend/models/client_data.py` | ✅ Done | Pydantic Create/Response models for all 3 tables |
| `backend/models/job_templates.py` | ✅ Done | `get_client_data` added to `JobTemplateType`; `collect_*` fields added |
| `backend/models/celery.py` | ✅ Done | `GetClientDataRequest` model added |
| `backend/repositories/client_data_repository.py` | ✅ Done | Bulk insert for all 3 tables |
| `backend/job_template_manager.py` | ✅ Done | create/update/get_job_types/\_model\_to\_dict all handle new type |
| `backend/routers/jobs/templates.py` | ✅ Done | Passes `collect_*` fields through create/update |
| `backend/routers/jobs/device_tasks.py` | ✅ Done | `POST /api/celery/tasks/get-client-data` endpoint |
| `backend/tasks/execution/client_data_executor.py` | ✅ Done | Core logic: connect → TextFSM → DNS → bulk insert |
| `backend/tasks/execution/base_executor.py` | ✅ Done | Routes `get_client_data` to executor |
| `backend/tasks/get_client_data_task.py` | ✅ Done | Celery task wrapper |
| `backend/tasks/__init__.py` | ✅ Done | Exports `get_client_data_task` |
| `backend/celery_app.py` | ✅ Done | Routes task to `network` queue |
| `backend/scripts/textfsm_test/test_commands.py` | ✅ Done | Standalone CLI to verify TextFSM output on real device |

### Frontend

| File | Status | Notes |
|------|--------|-------|
| `frontend/src/components/features/jobs/templates/types/index.ts` | ✅ Done | `collect_ip_address/mac_address/hostname` added to `JobTemplate` |
| `frontend/src/components/features/jobs/templates/components/template-types/GetClientDataJobTemplate.tsx` | ✅ Done | Emerald panel with 3 checkboxes (all default checked) |
| `frontend/src/components/features/jobs/templates/components/template-form-dialog.tsx` | ✅ Done | State, reset, pre-fill, payload, render block all wired |
| `frontend/src/components/features/jobs/scheduler/components/schedule-form-dialog.tsx` | ✅ Done | `get_client_data` added to `requiresCredential` |
| `frontend/src/components/features/jobs/templates/schemas/template-schema.ts` | ✅ Done | `getClientDataTemplateSchema` in discriminated union |
| `frontend/src/components/features/jobs/templates/utils/constants.ts` | ✅ Done | Label + emerald color for `get_client_data` |

---

## Database Schema

### New Tables

**`client_ip_addresses`** — ARP table entries
```
id, session_id (UUID, indexed), ip_address, mac_address, interface, device_name (indexed), collected_at
```

**`client_mac_addresses`** — MAC address table entries
```
id, session_id (UUID, indexed), mac_address, vlan, port, device_name (indexed), collected_at
```

**`client_hostnames`** — DNS-resolved names
```
id, session_id (UUID, indexed), ip_address, hostname, device_name (indexed), collected_at
```

**`job_templates`** — 3 new columns
```
collect_ip_address  BOOLEAN NOT NULL DEFAULT TRUE
collect_mac_address BOOLEAN NOT NULL DEFAULT TRUE
collect_hostname    BOOLEAN NOT NULL DEFAULT TRUE
```

### Join Key Strategy
- `session_id` (UUID, generated per collection run) groups all rows from the same job
- `mac_address` joins `client_ip_addresses` ↔ `client_mac_addresses`
- `ip_address` joins `client_ip_addresses` ↔ `client_hostnames`

### Example Correlation Query
```sql
SELECT
    i.ip_address,
    i.mac_address,
    m.vlan,
    m.port,
    h.hostname,
    i.device_name,
    i.collected_at
FROM client_ip_addresses i
LEFT JOIN client_mac_addresses m
    ON i.mac_address = m.mac_address AND i.session_id = m.session_id
LEFT JOIN client_hostnames h
    ON i.ip_address = h.ip_address AND i.session_id = h.session_id
WHERE i.session_id = '<uuid-from-job-result>';
```

---

## TextFSM Field Names (IMPORTANT — Verify First!)

The executor assumes ntc-templates field names for **cisco_ios**:

| Command | Expected Fields |
|---------|----------------|
| `show ip arp` | `address`, `mac`, `interface` |
| `show mac address-table` | `destination_address`, `vlan`, `destination_port` |

**Before running a real job**, verify with:
```bash
cd backend/
python scripts/textfsm_test/test_commands.py \
    --host <device-ip> \
    --username <user> \
    --password <pass> \
    [--platform cisco_ios]
```

If field names differ, update `_parse_arp_output()` and `_parse_mac_output()` in:
`backend/tasks/execution/client_data_executor.py`

---

## New API Endpoint

```
POST /api/celery/tasks/get-client-data
```

Request body:
```json
{
  "inventory": ["nautobot-uuid-1", "nautobot-uuid-2"],
  "credential_id": 1,
  "collect_ip_address": true,
  "collect_mac_address": true,
  "collect_hostname": true
}
```

Response:
```json
{
  "task_id": "celery-uuid",
  "job_id": "42",
  "status": "queued",
  "message": "Get Client Data task queued for 2 devices"
}
```

The task result (viewable via `GET /api/celery/tasks/{task_id}`) contains:
```json
{
  "success": true,
  "session_id": "uuid-of-this-run",
  "total_devices": 2,
  "success_count": 2,
  "failed_count": 0,
  "arp_entries": 42,
  "mac_entries": 38,
  "hostname_entries": 31
}
```

---

## TODO — Still To Be Done

### 1. Verify TextFSM Output (Blocker)
Run the test script against a real device and check if the parsed field names match what the executor expects. If they differ, update the parse helpers in `client_data_executor.py`.

### 2. Migration Runs On Next Backend Restart
The migration `026_add_client_data` will auto-run when the backend starts. Verify in logs:
```
026_add_client_data applied
```
Then confirm in DB:
```sql
\dt client_*   -- should show 3 new tables
\d job_templates  -- should show collect_* columns
```

### 3. End-to-End Test
1. Create a "Get Client Data" template in the UI → verify the emerald "Collect Properties" panel appears with 3 checked boxes
2. Schedule it → verify the credential dropdown appears
3. Trigger via API or scheduler → check Jobs page for progress/result
4. Query the 3 tables to confirm data was stored

### 4. Future: Client Correlation App (New Feature)
A new app/page to search and correlate all collected client data. Requirements:
- Search by MAC address, IP address, or hostname
- Show correlated view: for a given MAC → its IP(s), hostname(s), VLAN, port
- Filter by device, session, or time range
- Suggested location: `/app/(dashboard)/clients/page.tsx`
- Will need new API endpoints to query the 3 tables with joins
- Suggested backend router: `backend/routers/clients.py`
- Use TanStack Query pattern (see `frontend/src/hooks/queries/`)

### 5. Optional: Remove Duplicate Session Data on Re-run
Currently every job run appends new rows. If you re-run the same inventory daily, old rows accumulate. Options:
- Add a `DELETE WHERE session_id = <old>` before inserting (pass a `replace_existing=True` flag)
- Or add a cleanup job that purges rows older than N days
- Or keep all runs for trending/history (current behavior)

### 6. Optional: Support Other Platforms
The TextFSM field names may differ on non-Cisco platforms. The executor already has graceful fallback (logs warning + skips structured insert if no TextFSM template). For explicit multi-platform support, add platform-specific field name mapping in `client_data_executor.py`.
