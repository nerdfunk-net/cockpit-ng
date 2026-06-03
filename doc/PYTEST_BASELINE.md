# Pytest Baseline Profile — Implementation Plan

## Document status

| Field | Value |
|-------|-------|
| **Status** | Implemented |
| **Owner** | Cockpit-NG / NetDevOps tooling |
| **Related docs** | `backend/tests/BASELINE_TEST_DATA.md`, `backend/tests/README.md`, `doc/TESTING-GUIDE.md` |
| **Canonical data** | `contributing-data/tests_baseline/baseline.yaml` (`backend/tests/baseline.yaml` is a symlink) |
| **Golden metadata** | `backend/tests/baseline.golden.yaml` (tag/status/location parity reference) |
| **Import path** | `contributing-data/tests_baseline/*.yaml` via `TestBaselineService` (`BASELINE_DIR` env override) |
| **Generator (today)** | `backend/services/network/tools/baseline_generator.py`, UI: Tools → Baseline Management |

---

## 1. Goals and non-goals

### 1.1 Goals

1. **Single reproducible baseline** for Nautobot integration tests, generated from the Baseline Management UI (or CLI), not hand-edited YAML.
2. **“Pytest” profile** — one preset that encodes every dimension current integration tests depend on (locations, names, counts, tags, statuses, roles, prefixes, anchor devices).
3. **Fix data quality** in the canonical baseline: unique `primary_ip4` per device, consistent secondary interface IPs, optional VMs/clusters for future tests.
4. **Align** `contributing-data/tests_baseline/baseline.yaml` and `backend/tests/baseline.yaml` (one source of truth; the other is copy or symlink policy — see §5).
5. **Optional Phase B**: `baseline_manifest` pytest fixture so count assertions are derived from YAML, not duplicated in test code.

### 1.2 Non-goals (this project)

- Making integration tests work with *arbitrary* generated baselines (only the **Pytest** profile contract).
- Running integration tests in CI without a real Nautobot (`.env.test` still required).
- Replacing unit tests with integration tests.
- Auto-importing into Nautobot from pytest (import remains explicit: UI, API, or documented script).

---

## 2. Problem statement

### 2.1 Current pain

| Issue | Detail |
|-------|--------|
| **Duplicate IPs** | `backend/tests/baseline.yaml` has 12 duplicate `primary_ip4` values across devices; interface IPs often repeat other devices’ primaries. |
| **Split sources** | Tests document `backend/tests/baseline.yaml`; import reads `contributing-data/tests_baseline/`. Content diverges (contributing file may be a small generator sample). |
| **Generator ≠ tests** | Default generator uses `Location A`, IP-based names (`lab-192-168-178-1`), per-leaf country trees, round-robin tags/statuses. Tests expect `City A`, `lab-001`, fixed tag/status totals. |
| **Hardcoded expectations** | `test_inventory_baseline.py` has ~20 exact `len(devices) == N` assertions and 50+ string literals (`City A`, `lab-0`, etc.). |
| **Test/data drift** | Custom-field tests filter `net == 10.0.0.0/24` and `checkmk_site == site1`; canonical YAML uses select values `netA` / `siteA`. Device-op fixture comments say `lab-100` is “City B, Staging” but YAML has `Another City C`, `Staging`, `Active`. |

### 2.2 Target end state

```text
Operator selects "Pytest" profile → Generate → copy/replace baseline.yaml
    → POST /api/tools/tests-baseline (import)
    → pytest -m "integration and nautobot"  # green
```

Developers never hand-edit 3000+ line YAML except via profile + generator.

---

## 3. Canonical “Pytest baseline” contract

This section is the **authoritative spec** the generator must satisfy when `profile: pytest` (or `layout: pytest_legacy`). All implementation and verification refer here.

### 3.1 Scale

| Resource | Count |
|----------|------:|
| Network devices | 100 |
| Server devices | 20 |
| **Total DCIM devices** | **120** |
| Virtual machines (phase 1) | 0 |
| Clusters (phase 1) | 0 |
| Leaf locations (cities) | 6 |
| Countries / states | 3 each (`Country A/B/C`, `State A/B/C`) |

Phase 2 (optional): add VMs/clusters without breaking existing tests (separate profile `pytest-with-vms` or bump only after new tests exist).

### 3.2 Location topology (`layout: pytest_legacy`)

**Location types** (in order, with parent chain):

```text
Country → State → City → Building → Room
```

- `Room` includes `content_types: dcim.rack` (matches current YAML).
- Intermediate nodes `Building *` / `Room *` exist under each city in the reference file; inventory filters use **city-level names** (`City A`, not `Building A`).

**Countries and states** (fixed names):

| Country | State | Cities (children of state, siblings) |
|---------|-------|--------------------------------------|
| Country A | State A | `City A`, `Another City A` |
| Country B | State B | `City B`, `Another City B` |
| Country C | State C | `City C`, `Another City C` |

**Do not** use generator’s default `build_locations()` (separate `Country Location A` tree per leaf). Implement **`build_pytest_locations()`** that emits the 3×(state + 2 cities) structure above, plus building/room nodes if required for import parity with existing YAML.

### 3.3 Per-leaf device distribution (manual)

Used for `distribution.mode: manual`. Counts are **network + server = total** per city:

| Leaf location | Network | Server | Total |
|---------------|--------:|-------:|------:|
| City A | 19 | 2 | 21 |
| City B | 15 | 5 | 20 |
| City C | 13 | 3 | 16 |
| Another City A | 16 | 2 | 18 |
| Another City B | 17 | 3 | 20 |
| Another City C | 20 | 5 | 25 |
| **Sum** | **100** | **20** | **120** |

**Device generation order** (important for tag/status schedules):

1. Iterate cities in fixed order: `City A`, `Another City A`, `City B`, `Another City B`, `City C`, `Another City C`.
2. Within each city: emit all **network** devices for that city, then all **server** devices (matches reference YAML clustering).

### 3.4 Naming (`naming_scheme: sequential`)

| Kind | Pattern | Examples |
|------|---------|----------|
| Network | `lab-{index:03d}` | `lab-001` … `lab-100` |
| Server | `server-{index:02d}` | `server-01` … `server-20` |

**Anchor devices** (used by device-operation tests; must exist with stable names):

| Name | Role | Reference YAML location | Reference tags/status |
|------|------|-------------------------|---------------------|
| `lab-100` | Network | `Another City C` | `Staging`, `Active` |
| `server-20` | server | `City B` | `Production`, `Offline` |

Update **incorrect** docstrings in `test_device_operations_real_nautobot.py` during implementation to match this table.

### 3.5 Roles, platforms, manufacturers

| Field | Value |
|-------|-------|
| Network role name | `Network` |
| Server role name | `server` (lowercase — tests filter `"server"`) |
| Extra role in YAML | `lab` (role definition present; not required for 120-device counts) |
| Network device type | `networkA` / `NetworkInc` |
| Server device type | `serverA` / `ServerInc` |
| Network platform | `Cisco IOS` (manufacturer `Cisco`, driver `cisco_ios`) |
| Server platform | `ServerPlatform` / `ServerInc` |

### 3.6 Tags and statuses (quota-based, not round-robin)

**Global totals** (must match exactly):

| Tag | Count |
|-----|------:|
| Production | 39 |
| Staging | 52 |
| lab | 29 |

| Status | Count |
|--------|------:|
| Active | 66 |
| Offline | 54 |

**Implementation requirement**: add `tag_assignment: quota` and `status_assignment: quota` with explicit count maps in the Pytest profile. Assignment algorithm:

1. Build ordered list of 120 devices in §3.3 generation order.
2. Assign tags according to a **fixed schedule** (list of 120 tag names) stored in profile JSON *or* computed by a deterministic algorithm documented in §8.2.
3. Same for status.

**Verification**: after generation, `compute_stats()` must match §3.1–3.6. If exact parity with legacy YAML tag *per device* is required for intersection tests, run **`scripts/verify_baseline_parity.py`** (new) comparing tag/status/location per device name to golden file.

> **Note**: Intersection tests (e.g. City A ∧ ¬Staging == 9) depend on **per-device** tag placement, not only global totals. Phase 1 must either (a) port per-device tag/status from golden `backend/tests/baseline.yaml` while regenerating IPs, or (b) reproduce golden schedule exactly. Recommended: **(a) golden parity for metadata, new IP allocator for addresses** in first PR; refactor to pure quota schedule in PR 2 once parity script passes.

### 3.7 Prefixes and IP allocation

**Prefixes** (unchanged):

```text
192.168.178.0/24  # Network A
192.168.179.0/24  # Network B (secondary interfaces)
192.168.180.0/24  # Server Network
192.168.181.0/24  # LAB Network (add-device tests use .181.x)
```

**Rules**:

1. Every device has unique `primary_ip4` (no duplicates across 120 devices).
2. Network devices: `GigabitEthernet1/0/1` → primary on pool 0 (`178.x`); `GigabitEthernet1/0/2` → secondary on pool 1 (`179.x`) with **unique** host per device.
3. Servers: single `eth0` with primary; allocate from pool 2 (`180.x`) sequentially.
4. Avoid IPs used by integration tests that **create** devices: reserve/document `192.168.181.254`, `192.168.184.253`, `192.168.183.254`, `10.99.99.x` (see §10).

Use existing `IpAllocator` extended with **cross-device uniqueness tracking** for primaries and secondaries.

### 3.8 Custom fields

**Definitions** (match current YAML): `net`, `checkmk_site`, `free_textfield`, `last_backup`, `snmp_credentials` with choices `netA|netB|netC`, `siteA|siteB|siteC`, etc.

**Per-device values**: follow golden YAML pattern (`free_textfield: Network device in City A`, etc.) when using golden parity mode.

**Integration tests to fix** (do not encode invalid select values):

| Test | Current filter | Fix |
|------|----------------|-----|
| `test_filter_by_custom_field_net` | `10.0.0.0/24` | `netA` (or another value that exists on ≥1 device; assert count in manifest) |
| `test_filter_by_custom_field_checkmk_site` | `site1` | `siteA` |

### 3.9 Metadata sections in YAML

Generated file must include, in dependency order for import:

`location_types`, `location`, `roles`, `tags`, `manufacturers`, `device_types`, `platforms`, `prefixes`, `custom_field_choices`, `custom_fields`, `devices`.

Header comment block (already produced by `write_yaml_with_blank_lines`) must reflect `compute_stats()` output.

---

## 4. Integration test dependency matrix

Use this when implementing or refactoring tests.

### 4.1 `test_inventory_baseline.py` (~32 tests)

**Markers**: `@pytest.mark.integration`, `@pytest.mark.nautobot`  
**Fixture**: `real_ansible_inventory_service`  
**File**: `backend/tests/integration/test_inventory_baseline.py`

#### Exact count assertions

| Test method | Expected count | Filter summary |
|-------------|---------------:|----------------|
| `test_filter_by_location_city_a` | 21 | location = City A |
| `test_filter_by_role_network` | 100 | role = Network |
| `test_filter_by_role_server` | 20 | role = server |
| `test_filter_by_platform_cisco_ios` | 100 | platform = Cisco IOS |
| `test_filter_by_tag_production` | 39 | tag = Production |
| `test_filter_by_tag_staging` | 52 | tag = Staging |
| `test_filter_by_tag_lab` | 29 | tag = lab |
| `test_filter_by_status_active` | 66 | status = Active |
| `test_filter_by_status_offline` | 54 | status = Offline |
| `test_filter_by_location_state_a` | 39 | location = State A (see §4.1.1) |
| `test_filter_multiple_operations_or` (City A ∨ City B) | 41 | 21 + 20 |
| `test_filter_three_locations_or` | 57 | 21 + 20 + 16 |
| `test_filter_not_equals_operator` (not City A) | 99 | 120 - 21 |
| `test_filter_using_equals_and_not_equals_operator` | 21 | State A AND NOT Another City A |
| `test_filter_contains_operator` | 99 | name contains `lab-0` (excludes `lab-100` if pattern is `lab-0` — **verify**: matches lab-001–lab-099 only) |
| `test_filter_not_contains_operator` | 100 | name not contains `server` |
| `test_filter_tag_not_equals_operator` | 9 | City A AND tag NOT Staging |
| `test_not_operator_simple` | 18 | State A NOT City A |
| `test_not_operator_multiple_exclusions` | 0 | (complex; verify against golden) |
| `test_location_not_equals_operator` | 99 | location NOT City A |
| `test_complex_nested_not_with_role_and_status` | 13 | State A, NOT Another City A, Network, Active |
| `test_not_equals_operator_with_role_and_status` | 13 | duplicate scenario |
| `test_empty_filter_returns_all` | 120 | empty filter |

Tests with `len(devices) > 0` only: AND combinations, complex OR — still require correct **subset** properties.

#### 4.1.1 Location field behavior

Ansible inventory preview returns **leaf location name** on `device.location` for city filters (`City A`). State-level filter tests sometimes assert:

- `device.location in ("City A", "Another City A")`, or
- `device.location == "State A"` OR `Another City A`

**Implementation task**: Run one exploratory test against Nautobot after import; document actual `device.location` for state-level filters in `BASELINE_TEST_DATA.md`. Normalize assertions if inventory returns state vs city consistently.

#### String literals to preserve (Pytest profile)

`City A`, `City B`, `City C`, `Another City A`, `Another City B`, `Another City C`, `State A`, `State B`, `State C`, `Network`, `server`, `Production`, `Staging`, `lab`, `Active`, `Offline`, `Cisco IOS`, `lab-0`, `server`.

### 4.2 `test_device_operations_real_nautobot.py`

| Dependency | Detail |
|------------|--------|
| Device names | GraphQL lookup `lab-100`, `server-20` |
| Locations | Resolves `City A`, `City B` for add-device scenarios |
| Prefix | Bulk edit uses `192.168.178.0/24`; new IPs `.128+`, `.129`, `.130` |
| Roles | `Network`, `server` |
| Restore fixture | `baseline_device_ids` saves/restores serial and primary IP |

### 4.3 `test_add_device_form_data.py`

| Constant | Value |
|----------|-------|
| `LOCATION_NAME` | `City A` |
| `ROLE_NAME` | `Network` |
| Test IP | `192.168.181.254/24` |
| Manufacturer / type | `NetworkInc`, `networkA` |

### 4.4 `test_import_devices_from_csv.py`

| Constant | Value |
|----------|-------|
| UTF-8 test location | `Another City C` |
| Generic test location | `City A` |
| IPs | `192.168.183.254`, `192.168.184.253` |
| Custom field text | `Network device in Another City C` |

### 4.5 `test_checkmk_baseline.py`

| Dependency | Detail |
|------------|--------|
| Sample device | `lab-001` (skip if missing) |
| SNMP / normalize | Any baseline device with credentials |

### 4.6 Documentation files to update

- `backend/tests/BASELINE_TEST_DATA.md` — regenerate tables from `compute_stats` / manifest.
- `backend/tests/README.md`, `QUICK_START_INTEGRATION_TESTS.md`, `RUN_INTEGRATION_TESTS.md` — single path to Pytest profile workflow.
- Fix router docstring in `backend/routers/tools/schema.py` line 131: wrong path `contributing-data/checkmk/tests_baseline` → `contributing-data/tests_baseline`.

---

## 5. Single source of truth policy

| Artifact | Role after implementation |
|----------|---------------------------|
| `data/baseline/profiles/pytest.json` | Machine-readable profile (not imported into Nautobot) |
| `data/baseline/baseline.yaml` | Default generator output (gitignored or committed — **decision**: commit Pytest output under `contributing-data/tests_baseline/baseline.yaml`) |
| `backend/tests/baseline.yaml` | **Option A (recommended)**: Delete and replace with symlink or doc pointer to `contributing-data/tests_baseline/baseline.yaml`. **Option B**: Keep duplicate; CI check fails if files differ. |
| `backend/tests/fixtures/baseline_manifest.json` | Optional; generated by script from YAML |

**Recommended**: One committed file `contributing-data/tests_baseline/baseline.yaml`; `backend/tests/baseline.yaml` removed or generated in pre-commit from profile.

---

## 6. Profile system design

### 6.1 Profile file format

**Path**: `data/baseline/profiles/{profile_id}.json`

**Schema** (extends `CreateBaselineRequest`):

```json
{
  "id": "pytest",
  "label": "Pytest integration tests",
  "description": "120 devices, City A/B/C layout, lab-001 naming",
  "output": {
    "filename": "baseline",
    "suggested_import_dir": "contributing-data/tests_baseline"
  },
  "request": {
    "name": "baseline",
    "profile": "pytest",
    "layout": "pytest_legacy",
    "naming_scheme": "sequential",
    "network_device_prefix": "lab",
    "network_device_index_width": 3,
    "server_device_prefix": "server",
    "server_device_index_width": 2,
    "prefixes": "192.168.178.0/24,192.168.179.0/24,192.168.180.0/24,192.168.181.0/24",
    "network_device_role": "Network",
    "server_role": "server",
    "vm_role": "Virtual Machine",
    "tags": "Production,Staging,lab",
    "custom_fields": "",
    "location_hierarchy": "Country -> State -> City -> Building -> Room",
    "number_of_locations": 6,
    "number_of_network_devices": 100,
    "number_of_servers": 20,
    "number_of_virtual_machines": 0,
    "number_of_clusters": 0,
    "distribution": {
      "mode": "manual",
      "seed": 42,
      "by_location": [
        { "location": "City A", "network": 19, "server": 2, "vm": 0 },
        { "location": "Another City A", "network": 16, "server": 2, "vm": 0 },
        { "location": "City B", "network": 15, "server": 5, "vm": 0 },
        { "location": "Another City B", "network": 17, "server": 3, "vm": 0 },
        { "location": "City C", "network": 13, "server": 3, "vm": 0 },
        { "location": "Another City C", "network": 20, "server": 5, "vm": 0 }
      ]
    },
    "tag_quotas": { "Production": 39, "Staging": 52, "lab": 29 },
    "status_quotas": { "Active": 66, "Offline": 54 },
    "metadata_mode": "golden_parity",
    "golden_reference_path": "backend/tests/baseline.yaml"
  }
}
```

Additional profiles (future):

| `id` | Purpose |
|------|---------|
| `minimal` | 3 devices, smoke import |
| `demo` | Current UI defaults (`Location A`, 10+2 devices) |
| `pytest-with-vms` | Pytest + VMs/clusters |

### 6.2 API surface

| Method | Path | Change |
|--------|------|--------|
| `GET` | `/api/tools/baseline-profiles` | List profiles (`id`, `label`, `description`) |
| `GET` | `/api/tools/baseline-profiles/{id}` | Return full profile JSON for UI |
| `POST` | `/api/tools/create-baseline` | Accept extended `CreateBaselineRequest` (see §7) |
| `POST` | `/api/tools/tests-baseline` | Optional query/body `directory` override (§9) |

Auth: same as today (`verify_token`). Permission: document if `tools:write` or admin-only is required (match existing tools routes).

### 6.3 Frontend (Baseline Management)

**Files**:

- `frontend/src/components/features/tools/tests-baseline/constants.ts` — add `BASELINE_PROFILES` or fetch from API.
- `frontend/src/components/features/tools/tests-baseline/tests-baseline-page.tsx` — profile `<Select>` at top; on change, `form.reset(profileToFormValues(profile))`.
- `frontend/src/components/features/tools/baseline-management/baseline-management-page.tsx` — mention Pytest profile in copy.
- `frontend/src/components/features/tools/tests-baseline/types.ts` — extend types mirroring backend.

**UX**:

1. Profile dropdown: Pytest / Demo / Minimal / Custom.
2. “Custom” unlocks all fields; locked fields show lock icon for Pytest (optional).
3. After generate, toast shows path + “Next: Import tab” + stats summary from response.

---

## 7. Backend model changes

**File**: `backend/models/tools.py`

Add to `CreateBaselineRequest`:

```python
# Profile / layout
profile: Optional[str] = None  # e.g. "pytest"; informational + default merge
layout: Literal["default", "pytest_legacy"] = "default"
naming_scheme: Literal["ip", "sequential"] = "ip"

# Sequential naming (when naming_scheme == "sequential")
network_device_prefix: str = "lab"
network_device_index_width: int = Field(ge=1, default=3)
server_device_prefix: str = "server"
server_device_index_width: int = Field(ge=1, default=2)

# Quota assignment (when layout == pytest_legacy)
tag_quotas: Optional[dict[str, int]] = None
status_quotas: Optional[dict[str, int]] = None
metadata_mode: Literal["generated", "golden_parity"] = "generated"
golden_reference_path: Optional[str] = None  # repo-relative for parity copy
```

**Validation rules**:

- If `layout == pytest_legacy`: require `distribution.mode == manual`, `number_of_locations == 6`, sums match device counts.
- If `tag_quotas` provided: sum must equal `number_of_network_devices + number_of_servers`.
- `golden_reference_path` only allowed when `metadata_mode == golden_parity`.

**Response** (`CreateBaselineResponse`): add optional `profile: str`, `warnings: list[str]`.

---

## 8. Generator implementation details

**File**: `backend/services/network/tools/baseline_generator.py`

### 8.1 New functions (suggested)

| Function | Responsibility |
|----------|----------------|
| `load_profile(profile_id: str) -> dict` | Load JSON from `data/baseline/profiles/{id}.json` |
| `merge_profile_into_request(request) -> CreateBaselineRequest` | CLI/UI sends `profile=pytest` only |
| `build_pytest_locations() -> tuple[list, list[str]]` | §3.2 topology; returns locations + leaf names |
| `assign_sequential_name(kind, index) -> str` | §3.4 |
| `assign_tags_quota(devices, quotas, schedule) -> None` | Mutate device dicts in place |
| `apply_golden_metadata(devices, golden_path) -> None` | Copy tag/status/CF/location from golden by device name |
| `allocate_ips_pytest(devices, prefixes) -> None` | Unique IPs §3.7 |

### 8.2 Tag/status schedule (if not using golden parity)

Document deterministic schedule in code comments:

- Example: fill `Staging` in pass 1 on every 2nd device until quota exhausted, etc.
- Must be reproduced from legacy file using analysis script; **do not guess** — run `python scripts/analyze_baseline_schedule.py` (new) on `backend/tests/baseline.yaml` to export `tag_schedule.json` committed to repo.

### 8.3 `generate_baseline_dict` control flow

```text
if request.layout == "pytest_legacy":
    locations, leaves = build_pytest_locations()
    validate manual distribution against leaves
    devices = build_devices_pytest(...)
    if metadata_mode == golden_parity:
        apply_golden_metadata(devices, golden_path)
    else:
        assign_tags_quota(...); assign_status_quota(...)
    allocate_ips_pytest(devices, ...)  # always regenerate IPs
else:
    existing logic (default generator)
```

### 8.4 `compute_stats` updates

- Include VMs in totals (already does).
- Add unit test: generated Pytest baseline stats match §3.1.

---

## 9. Import path and environment

### 9.1 `TestBaselineService`

**File**: `backend/services/network/tools/baseline.py`

```python
async def load_baseline_files(
    self, directory: str | None = None
) -> list[dict]:
    directory = directory or os.environ.get(
        "BASELINE_DIR",
        "../contributing-data/tests_baseline",
    )
```

Resolve path relative to **backend/** working directory (document in README).

### 9.2 Optional API body for import

```python
class ImportBaselineRequest(BaseModel):
    directory: Optional[str] = None
```

`POST /api/tools/tests-baseline` accepts optional bodydivorced from empty body for backward compatibility.

### 9.3 Pytest `conftest.py` (Phase B)

```python
@pytest.fixture(scope="session")
def baseline_manifest():
    path = Path(os.environ.get("BASELINE_YAML", REPO_ROOT / "contributing-data/tests_baseline/baseline.yaml"))
    data = yaml.safe_load(path.read_text())
    return compute_stats(data), data
```

---

## 10. Reserved IPs and test-created resources

Integration tests **create and delete** resources; baseline must not use conflicting IPs/names.

| Resource | IP / name | Test file |
|----------|-----------|-----------|
| Add device | `192.168.181.254/24`, name `testdevice` | `test_add_device_form_data.py` |
| CSV UTF-8 | `192.168.183.254/24`, `Another City C` | `test_import_devices_from_csv.py` |
| CSV generic | `192.168.184.253/24`, `City A` | `test_import_devices_from_csv.py` |
| Bulk edit new IP | `192.168.178.128+`, `10.99.99.x` | `test_device_operations_real_nautobot.py` |

**Generator rule**: IpAllocator skips `.254` on prefixes used by tests or document that tests use high host numbers; generator uses low sequential hosts starting at `.1`.

---

## 11. Tooling and verification scripts

### 11.1 `backend/scripts/verify_baseline_parity.py` (new)

**Inputs**: `--generated path`, `--golden path`, `--mode {stats,full}`

**Checks**:

- `stats`: totals per §3.1, §3.6.
- `full`: per-device name, location, tag[0], status, role; ignore `primary_ip4` and interfaces (IPs intentionally change).

Exit code 0 required in CI for Pytest profile PR.

### 11.2 `backend/scripts/analyze_baseline_schedule.py` (new)

Exports `data/baseline/pytest_tag_schedule.json` from golden YAML for quota reproduction.

### 11.3 `backend/scripts/expect_inventory_counts.py` (new, Phase B)

Reads YAML + filter JSON fixtures; prints expected counts using in-Python filter simulation (no Nautobot). Used to refresh test constants or manifest.

### 11.4 CLI

**File**: `backend/tests/generate_baseline.py`

```bash
cd backend
python tests/generate_baseline.py --profile pytest
python tests/generate_baseline.py --profile pytest --output ../contributing-data/tests_baseline
```

---

## 12. Test migration plan

### Phase A — Generator + profile (no test assertion changes)

1. Implement Pytest profile + `golden_parity` metadata + new IP allocation.
2. Generate `contributing-data/tests_baseline/baseline.yaml`.
3. `verify_baseline_parity.py --mode full` (metadata only).
4. Manual import to test Nautobot; smoke `lab-001`, `lab-100` exist.

### Phase B — Fix broken tests

| File | Changes |
|------|---------|
| `test_inventory_baseline.py` | Fix custom field filters (`netA`, `siteA`); verify `lab-0` contains count (99 vs 100); fix state location assertions |
| `test_device_operations_real_nautobot.py` | Fix fixture docstrings; confirm no hard dependency on wrong city for `lab-100` |
| `test_checkmk_baseline.py` | Keep `lab-001`; optional skip remains |

### Phase C — Manifest (implemented)

1. `baseline_manifest` session fixture in `backend/tests/conftest.py`.
2. `test_inventory_baseline.py` uses `baseline_manifest.assert_device_count()` for exact-count tests.
3. `backend/tests/fixtures/baseline_manifest.json` — regenerate via `make baseline-manifest`.
4. `backend/scripts/expect_inventory_counts.py` — print or write manifest counts from YAML simulation.

### Phase D — CI documentation

- Document that CI does **not** run integration tests by default.
- Add optional nightly job with Nautobot + import (out of scope unless requested).

---

## 13. Unit tests to add

| File | Cases |
|------|-------|
| `tests/unit/services/test_baseline_generator.py` | `layout=pytest_legacy`, sequential names, manual dist sums, unique IPs |
| `tests/unit/services/test_baseline_profiles.py` | Load `pytest.json`, merge into request |
| `tests/unit/scripts/test_verify_baseline_parity.py` | Pass/fail on synthetic YAML |

---

## 14. Implementation checklist (ordered)

### Sprint 1 — Profile + generator core

- [ ] Add `data/baseline/profiles/pytest.json` (§6.1).
- [ ] Extend `CreateBaselineRequest` (§7).
- [ ] Implement `build_pytest_locations()` (§3.2).
- [ ] Implement sequential naming (§3.4).
- [ ] Implement manual distribution with pytest city names (§3.3).
- [ ] Implement `golden_parity` metadata copy (§8.3).
- [ ] Implement unique IP allocation (§3.7).
- [ ] `GET baseline-profiles` endpoints.
- [ ] Unit tests §13.

### Sprint 2 — UI + CLI + import

- [ ] Profile selector in `tests-baseline-page.tsx` (§6.3).
- [ ] `generate_baseline.py --profile pytest` (§11.4).
- [ ] `BASELINE_DIR` env support (§9.1).
- [ ] Fix router docstring path (§4.6).
- [ ] Generate and commit `contributing-data/tests_baseline/baseline.yaml`.
- [x] `verify_baseline_parity.py` in pre-commit (`.pre-commit-config.yaml`) and `make verify-baseline`.

### Sprint 3 — Integration test fixes + docs

- [ ] Fix custom field tests (§3.8).
- [ ] Re-run full integration suite; fix remaining count/location assertions.
- [ ] Update `BASELINE_TEST_DATA.md` from stats.
- [ ] Update quick-start guides (§4.6).
- [ ] Resolve `backend/tests/baseline.yaml` duplication policy (§5).

### Sprint 4 (optional) — Manifest

- [ ] `baseline_manifest` fixture (§9.3).
- [ ] Refactor inventory tests to manifest-driven counts.
- [ ] `expect_inventory_counts.py` (§11.3).

---

## 15. Acceptance criteria

1. Selecting **Pytest** profile and generating produces YAML that passes `verify_baseline_parity.py --mode full` against golden metadata.
2. All `primary_ip4` values in generated YAML are unique.
3. Import into test Nautobot succeeds (`POST /api/tools/tests-baseline`).
4. `pytest tests/integration/test_inventory_baseline.py -m "integration and nautobot"` passes against imported data.
5. `pytest tests/integration/test_device_operations_real_nautobot.py` passes (restore fixture works for `lab-100`, `server-20`).
6. `pytest tests/integration/test_add_device_form_data.py` and CSV import tests pass.
7. Documentation describes one workflow: Profile → Generate → Copy (if needed) → Import → pytest.

---

## 16. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Per-device tag placement differs from golden → intersection tests fail | Use `golden_parity` for tags/status in v1; parity script in CI |
| Nautobot state-level filter returns city vs state name | Exploratory test §4.1.1; align assertions |
| Import idempotency leaves stale devices | Document clean-up or use dedicated test Nautobot |
| Golden file duplicates IPs | Regenerate IPs only; never copy IP fields from golden |
| `contains lab-0` matches `lab-100` | Confirm Ansible/inventory behavior; adjust pattern to `lab-00` if needed |

---

## 17. Appendix A — Pytest profile quick reference

```yaml
# Logical preset (see data/baseline/profiles/pytest.json for full JSON)
layout: pytest_legacy
naming_scheme: sequential
devices: 100 network + 20 server
locations: City A, Another City A, City B, Another City B, City C, Another City C
roles: Network, server
tags: Production (39), Staging (52), lab (29)
statuses: Active (66), Offline (54)
anchors: lab-100, server-20
```

---

## 18. Appendix B — File touch list

| Path | Action |
|------|--------|
| `doc/PYTEST_BASELINE.md` | This plan |
| `data/baseline/profiles/pytest.json` | Create |
| `data/baseline/profiles/demo.json` | Create (optional) |
| `backend/models/tools.py` | Extend models |
| `backend/services/network/tools/baseline_generator.py` | Pytest layout |
| `backend/services/network/tools/baseline.py` | `BASELINE_DIR` |
| `backend/routers/tools/schema.py` | Profiles API, import body, doc fix |
| `backend/tests/generate_baseline.py` | `--profile` |
| `backend/scripts/verify_baseline_parity.py` | Create |
| `backend/scripts/analyze_baseline_schedule.py` | Create |
| `frontend/.../tests-baseline/*` | Profile UI |
| `contributing-data/tests_baseline/baseline.yaml` | Regenerate |
| `backend/tests/baseline.yaml` | Remove or sync per §5 |
| `backend/tests/integration/test_inventory_baseline.py` | Fix CF + verify counts |
| `backend/tests/integration/test_device_operations_real_nautobot.py` | Docstrings |
| `backend/tests/BASELINE_TEST_DATA.md` | Regenerate |
| `backend/tests/conftest.py` | Optional manifest fixture |
| `backend/tests/unit/services/test_baseline_*.py` | New tests |

---

## 19. Appendix C — `contains "lab-0"` analysis

- Device names: `lab-001` … `lab-099`, `lab-100`.
- Pattern `lab-0` matches substring of `lab-001`–`lab-099` and also `lab-100` (contains `lab-0` at start).
- **Action during implementation**: Run `test_filter_contains_operator` against imported baseline; if count is 100 not 99, update test expectation to 100 or change pattern to `lab-00` (match only zero-padded segment). Document outcome in `BASELINE_TEST_DATA.md`.

---

*End of plan.*
