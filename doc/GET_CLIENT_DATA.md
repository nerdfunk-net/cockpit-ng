# Get Client Data

A job template type `get_client_data` that SSHs into network devices via Netmiko, runs `show ip arp` and `show mac address-table` with TextFSM parsing, DNS-resolves the collected IPs, and stores everything in three PostgreSQL tables. A dedicated Clients page lets users search and correlate the collected data.

---

## Implemented Files

### Backend

| File | Notes |
|------|-------|
| `backend/core/models.py` | 3 new table models + 3 bool columns on `JobTemplate` |
| `backend/migrations/versions/026_add_client_data.py` | Auto-runs on backend startup |
| `backend/models/client_data.py` | Pydantic Create/Response models for all 3 tables |
| `backend/models/job_templates.py` | `get_client_data` added to `JobTemplateType`; `collect_*` fields added |
| `backend/models/celery.py` | `GetClientDataRequest` model added |
| `backend/repositories/client_data_repository.py` | Bulk insert and correlated query for all 3 tables |
| `backend/job_template_manager.py` | create/update/get_job_types/\_model\_to\_dict all handle the new type |
| `backend/routers/jobs/templates.py` | Passes `collect_*` fields through create/update |
| `backend/routers/jobs/device_tasks.py` | `POST /api/celery/tasks/get-client-data` endpoint |
| `backend/routers/clients.py` | `GET /api/clients/devices` and `GET /api/clients/data` endpoints |
| `backend/tasks/execution/client_data_executor.py` | Core logic: connect → TextFSM → DNS → bulk insert |
| `backend/tasks/execution/base_executor.py` | Routes `get_client_data` to the executor |
| `backend/tasks/get_client_data_task.py` | Celery task wrapper |
| `backend/tasks/__init__.py` | Exports `get_client_data_task` |
| `backend/celery_app.py` | Routes task to `network` queue |
| `backend/scripts/textfsm_test/test_commands.py` | Standalone CLI to verify TextFSM output on a real device |

### Frontend

| File | Notes |
|------|-------|
| `frontend/src/app/(dashboard)/clients/page.tsx` | Route page — renders `ClientsPage` |
| `frontend/src/components/features/network/clients/components/clients-page.tsx` | Top-level layout: device picker + data table |
| `frontend/src/components/features/network/clients/components/clients-table.tsx` | Filterable, paginated data table |
| `frontend/src/components/features/network/clients/components/device-list.tsx` | Left-sidebar device picker |
| `frontend/src/components/features/network/clients/types/index.ts` | `ClientDataItem`, `ClientDataResponse`, `ClientDataFilters` |
| `frontend/src/hooks/queries/use-clients-query.ts` | `useClientDevicesQuery` and `useClientDataQuery` TanStack Query hooks |
| `frontend/src/lib/query-keys.ts` | `queryKeys.clients` factory |
| `frontend/src/components/features/jobs/templates/types/index.ts` | `collect_ip_address/mac_address/hostname` added to `JobTemplate` |
| `frontend/src/components/features/jobs/templates/components/template-types/GetClientDataJobTemplate.tsx` | Emerald panel with 3 checkboxes |
| `frontend/src/components/features/jobs/templates/components/template-form-dialog.tsx` | State, reset, pre-fill, payload, render block wired |
| `frontend/src/components/features/jobs/scheduler/components/schedule-form-dialog.tsx` | `get_client_data` added to `requiresCredential` |
| `frontend/src/components/features/jobs/templates/schemas/template-schema.ts` | `getClientDataTemplateSchema` in discriminated union |
| `frontend/src/components/features/jobs/templates/utils/constants.ts` | Label + emerald color for `get_client_data` |

---

## Database Schema

### New Tables

**`client_ip_addresses`** — ARP table entries

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `session_id` | String(36) | UUID, indexed — cross-table join key for one collection run |
| `ip_address` | String(45) | IPv4 or IPv6 |
| `mac_address` | String(20) | Lowercase Cisco dotted-quad format; join key → `client_mac_addresses` |
| `interface` | String(255) | ARP interface (nullable) |
| `device_name` | String(255) | Source device name, indexed |
| `device_ip` | String(45) | Source device primary IP (nullable) |
| `collected_at` | DateTime(tz) | Set server-side at insert time |

Indexes: `idx_client_ip_session`, `idx_client_ip_device`, `idx_client_ip_mac`

**`client_mac_addresses`** — MAC address table entries

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `session_id` | String(36) | UUID, indexed |
| `mac_address` | String(20) | Lowercase dotted-quad; join key → `client_ip_addresses` |
| `vlan` | String(20) | nullable |
| `port` | String(255) | Switch port (nullable) |
| `device_name` | String(255) | Indexed |
| `device_ip` | String(45) | nullable |
| `collected_at` | DateTime(tz) | |

Indexes: `idx_client_mac_session`, `idx_client_mac_device`, `idx_client_mac_mac`

**`client_hostnames`** — DNS-resolved names

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `session_id` | String(36) | UUID, indexed |
| `ip_address` | String(45) | Join key → `client_ip_addresses.ip_address` |
| `hostname` | String(255) | DNS-resolved name |
| `device_name` | String(255) | |
| `device_ip` | String(45) | nullable |
| `collected_at` | DateTime(tz) | |

Indexes: `idx_client_hostname_session`, `idx_client_hostname_ip`

### Changes to `job_templates`

Three new boolean columns, all default `TRUE`:

```
collect_ip_address  BOOLEAN NOT NULL DEFAULT TRUE
collect_mac_address BOOLEAN NOT NULL DEFAULT TRUE
collect_hostname    BOOLEAN NOT NULL DEFAULT TRUE
```

### Join Key Strategy

- `session_id` (UUID per collection run) groups all rows from the same job across all three tables.
- `mac_address + device_name` is the primary key for a client observation (one row per MAC per device).
- `mac_address + session_id` joins `client_ip_addresses` ↔ `client_mac_addresses` (same-device preferred; cross-device for L2).
- `ip_address + session_id` joins `client_ip_addresses` ↔ `client_hostnames`.

### Example Correlation Query

```sql
-- One row per (mac, device) with IP from same-device ARP, port/VLAN from MAC table
SELECT
    COALESCE(ae.ip_address, bim.ip_address) AS ip_address,
    m.mac_address,
    m.vlan,
    m.port,
    h.hostname,
    m.device_name,
    m.collected_at
FROM client_mac_addresses m
LEFT JOIN client_ip_addresses ae
    ON m.mac_address = ae.mac_address AND m.session_id = ae.session_id
   AND m.device_name = ae.device_name   -- same-device ARP
LEFT JOIN (
    SELECT DISTINCT ON (mac_address) mac_address, ip_address
    FROM client_ip_addresses
    WHERE session_id = '<uuid-from-job-result>' AND mac_address IS NOT NULL
    ORDER BY mac_address, collected_at DESC
) bim ON m.mac_address = bim.mac_address  -- cross-device fallback
LEFT JOIN client_hostnames h
    ON COALESCE(ae.ip_address, bim.ip_address) = h.ip_address
   AND m.session_id = h.session_id
WHERE m.session_id = '<uuid-from-job-result>';
```

---

## Backend: How Data Collection Works

### 1. Triggering a Collection

A collection run is started by calling:

```
POST /api/celery/tasks/get-client-data
```

Required permission: `devices:read`

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

The endpoint creates a `job_run` record and dispatches `get_client_data_task` to the `network` Celery queue.

### 2. Executor — `client_data_executor.py`

The executor (`execute_get_client_data`) runs inside the Celery worker.

**Step-by-step flow:**

1. **Flag resolution** — `collect_*` flags are resolved in this priority order: explicit `job_parameters` → template defaults → `True`.
2. **Credential validation** — checks that `credential_id` exists and its password decrypts successfully.
3. **Device list** — uses the `inventory` list of Nautobot UUIDs when provided; otherwise fetches all devices from Nautobot via `device_query_service.get_devices()`.
4. **Session ID** — generates a single `uuid.uuid4()` shared by every row inserted in this run.
5. **Per-device loop** (progress reported 10–90%):
   - GraphQL query to Nautobot for `name`, `primary_ip4.host`, `platform.network_driver`.
   - Devices without a primary IP are skipped.
   - `network_driver` is mapped to a Netmiko `device_type` via `netmiko_service._map_platform_to_device_type()`.
   - Netmiko SSHs into the device and runs the required commands.
   - Output is parsed with ntc-templates TextFSM.
   - Parsed rows are accumulated in memory (not inserted per device).
6. **Bulk insert** (progress ~92%) — all accumulated rows are inserted at once via `ClientDataRepository`.
7. **Session cleanup** — `repo.delete_old_sessions(keep=5)` deletes rows from runs older than the 5 most recent sessions.

### 3. TextFSM Parsing

The executor expects these ntc-templates field names for **cisco_ios**:

| Command | Expected Fields |
|---------|----------------|
| `show ip arp` | `ip_address` (or `address`), `mac_address` (or `mac`), `interface` |
| `show mac address-table` | `destination_address`, `vlan_id`, `destination_port` (list) |

MAC addresses are normalised to lowercase Cisco dotted-quad format (`aabb.cc00.0100`) by `_normalise_mac()`.

If TextFSM has no template for the device platform, the executor logs a warning and skips structured insertion for that device (graceful fallback).

**Verify TextFSM output against a real device:**

```bash
cd backend/
python scripts/textfsm_test/test_commands.py \
    --host <device-ip> \
    --username <user> \
    --password <pass> \
    [--platform cisco_ios]
```

If field names differ from the table above, update `_parse_arp_output()` and `_parse_mac_output()` in `backend/tasks/execution/client_data_executor.py`.

### 4. DNS Resolution

When `collect_hostname=True`, the executor calls `_resolve_hostnames()` for every IP in the collected ARP table. It uses `socket.gethostbyaddr()`. Addresses with no reverse DNS record are silently skipped.

### 5. Task Result

Viewable via `GET /api/celery/tasks/{task_id}`:

```json
{
  "success": true,
  "session_id": "uuid-of-this-run",
  "total_devices": 2,
  "success_count": 2,
  "failed_count": 0,
  "arp_entries": 42,
  "mac_entries": 38,
  "hostname_entries": 31,
  "successful_devices": ["router1", "switch1"],
  "failed_devices": [],
  "credential_info": { "...": "..." }
}
```

### 6. Session Retention

After every successful collection the 5 most recent sessions are kept. Older sessions are deleted from all three tables. This prevents unbounded table growth while retaining recent history for audit purposes.

---

## Backend: How Collected Data Is Queried

All read operations go through `ClientDataRepository.get_client_data()`, called by `GET /api/clients/data`.

### SQL Strategy

The query is **MAC-centric**: `client_mac_addresses` is the primary driver. This ensures Layer-2-only devices (which have no ARP table and therefore no rows in `client_ip_addresses`) are still visible.

**Output row semantics**: one row per **(mac_address, device_name)** pair in the latest session.

| Column | Source |
|--------|--------|
| `mac_address` | always present |
| `device_name` | device that observed this MAC |
| `port`, `vlan` | that device's MAC address table entry |
| `ip_address` | same-device ARP first; cross-device ARP fallback for L2 devices |
| `hostname` | DNS-resolved from the resolved IP |

**CTEs:**

- **`latest_session`** — UNIONs both tables to find the most-recent session_id even when one table is empty (e.g. `collect_mac_address=False`).
- **`mac_table_entries`** — one row per (mac, device) from `client_mac_addresses`; provides port and VLAN.
- **`arp_entries`** — one row per (mac, device) from `client_ip_addresses` (mac must be non-null); provides the IP seen by that device.
- **`best_ip_for_mac`** — single best IP per MAC across all devices; used as cross-device fallback so L2 switches show an IP from a neighbouring L3 device.
- **`hostname_for_ip`** — one hostname per IP.
- **`all_device_mac_pairs`** — UNION of mac_table_entries and arp_entries; the full driving universe.
- **`combined`** — joins everything; `ip_address = COALESCE(same-device ARP, cross-device ARP)`.

```sql
WITH latest_session AS (
    SELECT session_id FROM (
        SELECT session_id, MAX(collected_at) AS ts FROM client_mac_addresses GROUP BY session_id
        UNION ALL
        SELECT session_id, MAX(collected_at) AS ts FROM client_ip_addresses  GROUP BY session_id
    ) t GROUP BY session_id ORDER BY MAX(ts) DESC LIMIT 1
),
mac_table_entries AS (
    SELECT DISTINCT ON (m.mac_address, m.device_name)
        m.mac_address, m.vlan, m.port, m.device_name, m.session_id, m.collected_at
    FROM client_mac_addresses m
    JOIN latest_session ls ON m.session_id = ls.session_id
    ORDER BY m.mac_address, m.device_name, m.collected_at DESC
),
arp_entries AS (
    SELECT DISTINCT ON (i.mac_address, i.device_name)
        i.mac_address, i.ip_address, i.device_name, i.session_id, i.collected_at
    FROM client_ip_addresses i
    JOIN latest_session ls ON i.session_id = ls.session_id
    WHERE i.mac_address IS NOT NULL
    ORDER BY i.mac_address, i.device_name, i.collected_at DESC
),
best_ip_for_mac AS (
    SELECT DISTINCT ON (i.mac_address) i.mac_address, i.ip_address
    FROM client_ip_addresses i
    JOIN latest_session ls ON i.session_id = ls.session_id
    WHERE i.mac_address IS NOT NULL
    ORDER BY i.mac_address, i.collected_at DESC
),
hostname_for_ip AS (
    SELECT DISTINCT ON (h.ip_address) h.ip_address, h.hostname
    FROM client_hostnames h
    JOIN latest_session ls ON h.session_id = ls.session_id
    ORDER BY h.ip_address, h.collected_at DESC
),
all_device_mac_pairs AS (
    SELECT mac_address, device_name, session_id FROM mac_table_entries
    UNION
    SELECT mac_address, device_name, session_id FROM arp_entries
),
combined AS (
    SELECT
        p.mac_address, p.device_name,
        mt.port, mt.vlan,
        COALESCE(ae.ip_address, bim.ip_address) AS ip_address,
        hfi.hostname,
        p.session_id,
        COALESCE(mt.collected_at, ae.collected_at) AS collected_at
    FROM all_device_mac_pairs p
    LEFT JOIN mac_table_entries mt  ON p.mac_address = mt.mac_address  AND p.device_name = mt.device_name
    LEFT JOIN arp_entries ae        ON p.mac_address = ae.mac_address  AND p.device_name = ae.device_name
    LEFT JOIN best_ip_for_mac bim   ON p.mac_address = bim.mac_address
    LEFT JOIN hostname_for_ip hfi   ON COALESCE(ae.ip_address, bim.ip_address) = hfi.ip_address
)
SELECT mac_address, port, vlan, ip_address, hostname, device_name, session_id, collected_at
FROM combined
WHERE [device_name ILIKE ...]   -- all filters use ILIKE %value%
  AND [mac_address ILIKE ...]
  AND [ip_address  ILIKE ...]
  AND [port        ILIKE ...]
  AND [vlan        ILIKE ...]
  AND [hostname    ILIKE ...]
ORDER BY ip_address NULLS LAST, mac_address, device_name
LIMIT :limit OFFSET :offset
```

### `GET /api/clients/data` — Query Parameters

Required permission: `network.clients:read`

All string filters use `ILIKE %value%` (case-insensitive partial match).

| Parameter | Type | Description |
|-----------|------|-------------|
| `device_name` | string | Partial match on the device that observed the MAC |
| `ip_address` | string | Partial match |
| `mac_address` | string | Partial match |
| `port` | string | Partial match on switch port |
| `vlan` | string | Partial match on VLAN |
| `hostname` | string | Partial match |
| `page` | int | Default 1 |
| `page_size` | int | Default 50, max 500 |

Response:
```json
{
  "items": [
    {
      "ip_address": "10.0.0.1",
      "mac_address": "aabb.cc00.0100",
      "port": "GigabitEthernet0/1",
      "vlan": "10",
      "hostname": "workstation1.local",
      "device_name": "core-switch",
      "session_id": "uuid",
      "collected_at": "2026-04-16T10:00:00+00:00"
    }
  ],
  "total": 250,
  "page": 1,
  "page_size": 50
}
```

### `GET /api/clients/devices`

Required permission: `network.clients:read`

Returns distinct device names from the latest session only, sorted alphabetically:

```json
{ "devices": ["core-switch", "distribution-switch"] }
```

---

## Frontend: Clients Page

Location: `/app/(dashboard)/clients/page.tsx`
Feature components: `frontend/src/components/features/network/clients/`

### Layout

A two-column layout with:
- **Left column** (`DeviceList`) — device picker sourced from Nautobot (`GET /api/nautobot/devices`). Shows "All" + one button per device on the current page. Selecting a device filters the right table. Includes a search input at the top and a pagination bar at the bottom.
- **Right columns** (`ClientsTable`) — the main data table with filters and pagination.

### Data Table

Six visible columns:

| Column | Description |
|--------|-------------|
| **IP Address** | IPv4/IPv6 in monospace font; null (`—`) when only seen on an L2 device and no L3 neighbour resolved the IP |
| **MAC Address** | Lowercase dotted-quad in monospace font |
| **Port** | Switch port the client is connected to |
| **VLAN** | VLAN the port belongs to |
| **Hostname** | DNS-resolved hostname (empty if not resolved) |
| **Device** | Network device that observed this MAC — shows why the same MAC appears in multiple rows when seen on more than one device |

A second header row below the column names contains inline filter `<Input>` fields for each column. Filters are debounced by 300 ms before triggering an API call. Changing any filter resets the table to page 1.

Pagination shows "startRow–endRow of total" with a **page-size selector** (10 / 25 / 50 / 100 / 200 / 500) and **Previous** / **Next** buttons. Changing the page size resets the table to page 1.

Empty states:
- No data collected: "Run a Get Client Data job to collect data"
- Filters return nothing: "Try clearing the filters"

### DeviceList Controls

The left panel sources its device list directly from Nautobot (not from the collected client data):

- **Search input** — debounced 300 ms; queries `GET /api/nautobot/devices?filter_type=name__ic&filter_value=<text>`. Changing the search resets to page 1.
- **Page-size selector** — values 10 / 25 / 50 / 100 / 200 / 500 (default 25). Changing resets to page 1.
- **`<` / `>` navigation buttons** — move between pages; disabled at boundaries.
- **Count label** — shows `startRow–endRow / total` in the footer.

Selecting a device from the list filters the right table to that device's client data. Selecting "All" removes the device filter.

### TanStack Query Hooks — `use-clients-query.ts`

| Hook | Endpoint | `staleTime` | Notes |
|------|----------|-------------|-------|
| `useNautobotDevicesSearchQuery(params)` | `GET /api/nautobot/devices` | 30 s | `keepPreviousData`; params: `search`, `page`, `pageSize`; uses `filter_type=name__ic` |
| `useClientDataQuery(filters)` | `GET /api/clients/data?...` | 30 s | `keepPreviousData` — no flash on page change |

Query keys:
```typescript
['nautobot', 'clients-device-search', { search, page, pageSize }]
queryKeys.clients.data(filters)       // ['clients', 'data', filters]
```

### TypeScript Types

```typescript
interface ClientDataItem {
  ip_address: string | null
  mac_address: string | null
  port: string | null
  vlan: string | null
  hostname: string | null
  device_name: string
  session_id: string
  collected_at: string | null
}

interface ClientDataFilters {
  deviceName?: string
  ipAddress?: string
  macAddress?: string
  port?: string
  vlan?: string
  hostname?: string
  page?: number
  pageSize?: number
}

interface NautobotDevicesSearchResponse {
  devices: Array<{ id: string; name: string }>
  count: number
  has_more: boolean
}
```

---

## Job Template UI

When creating a job template of type `get_client_data`, an emerald-styled "Collect Properties" panel shows three checkboxes (all checked by default):

- **IP Address** — (from ARP table)
- **MAC Address** — (from MAC address table)
- **Resolve Hostname** — (DNS lookup)

Footer note: *"Requires SSH credentials. All collected rows share a session ID as the join key."*

The schedule form requires credentials for `get_client_data` templates (same as other SSH-based job types).

---

## End-to-End Data Flow

```
User triggers job (UI or API or scheduler)
  → POST /api/celery/tasks/get-client-data
    → get_client_data_task  (Celery, queue="network")
      → execute_get_client_data()
        → Validate credential
        → Resolve device list (explicit inventory or all Nautobot devices)
        → Generate session_id (UUID)
        → For each device:
            GraphQL → Nautobot: name, primary_ip4, platform.network_driver
            Netmiko SSH → "show ip arp"            → TextFSM → ARP rows
            Netmiko SSH → "show mac address-table" → TextFSM → MAC rows
            socket.gethostbyaddr() per IP           → hostname rows
        → Bulk insert all rows (shared session_id)
        → delete_old_sessions(keep=5)

User views results in Clients page
  → GET /api/clients/devices
      latest_session CTE (UNION both tables) → distinct device_names → DeviceList
  → GET /api/clients/data?device_name=...&ip_address=...&page=1
      latest_session CTE (UNION both tables)
      → mac_table_entries  DISTINCT ON (mac, device) from client_mac_addresses
      → arp_entries        DISTINCT ON (mac, device) from client_ip_addresses
      → best_ip_for_mac    cross-device IP fallback for L2-only devices
      → all_device_mac_pairs  UNION of above (one row per mac+device)
      → LEFT JOIN mac data (port, vlan)
      → LEFT JOIN arp data (same-device IP)
      → COALESCE(same-device IP, cross-device IP)
      → LEFT JOIN hostname
      → ILIKE filters (all columns including device_name) → LIMIT/OFFSET
      → ClientsTable rows  [IP | MAC | Port | VLAN | Hostname | Device]
```

---

## Verifying the Migration

The migration `026_add_client_data` auto-runs on backend startup. Confirm in logs:

```
026_add_client_data applied
```

Then confirm in the database:

```sql
\dt client_*         -- should show 3 new tables
\d job_templates     -- should show collect_ip_address, collect_mac_address, collect_hostname columns
```

---

## TextFSM Field Reference

| Command | ntc-templates field | Used as |
|---------|---------------------|---------|
| `show ip arp` | `ip_address` or `address` | `ip_address` |
| `show ip arp` | `mac_address` or `mac` | `mac_address` (normalised) |
| `show ip arp` | `interface` | `interface` |
| `show mac address-table` | `destination_address` | `mac_address` (normalised) |
| `show mac address-table` | `vlan_id` | `vlan` |
| `show mac address-table` | `destination_port` (list) | `port` (first element unwrapped) |

If field names differ on your platform, update `_parse_arp_output()` and `_parse_mac_output()` in `backend/tasks/execution/client_data_executor.py`.

---

## Optional Enhancements

### Support Other Platforms

The executor has graceful fallback: if ntc-templates has no template for the device's platform, it logs a warning and skips structured insertion for that device. For explicit multi-platform support, add platform-specific field name mappings in `client_data_executor.py`.

### Adjust Session Retention

The `delete_old_sessions(keep=5)` call in the executor controls how many runs are retained. Increase `keep` to preserve more history.
