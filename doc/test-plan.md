# Plan: Nautobot Service Layer Test Coverage

## Context

The frontend performs 7 device management operations (add, VM, racks, onboard, sync, offboard, export) all backed by the nautobot service layer. Current test coverage is patchy — there are mock tests for import/CSV workflows and real-Nautobot integration tests for device operations, but the core service layer (resolvers, managers, DeviceCreationService, OffboardingService, InterfaceManagerService) has no isolated unit tests. The goal is to:

1. Build a stateful `FakeNautobotService` that routes GraphQL queries and REST calls to in-memory fixture data, enabling all unit tests to run offline
2. Write unit tests for the two highest-priority flows: **Add Device** and **Offboard Device**
3. Follow with integration tests against the real Nautobot instance

---

## Phase 1: FakeNautobotService

### New file: `tests/mocks/fake_nautobot_service.py`

A stateful simulation class that replaces `NautobotService` in unit tests:

```python
class FakeNautobotService:
    """Stateful in-memory Nautobot simulation for unit testing."""

    def __init__(self, seed_data: dict | None = None):
        # In-memory stores keyed by UUID
        self._devices: dict[str, dict] = {}
        self._interfaces: dict[str, dict] = {}
        self._ip_addresses: dict[str, dict] = {}
        self._prefixes: dict[str, dict] = {}
        # Pre-seeded metadata (statuses, platforms, device-types, locations, ...)
        self._statuses: dict[str, dict] = SEED_STATUSES
        self._platforms: dict[str, dict] = SEED_PLATFORMS
        ...
        if seed_data:
            self._load_seed(seed_data)

    async def graphql_query(self, query: str, variables: dict | None = None) -> dict:
        # Route to _handle_graphql_* based on detected operation type
        ...

    async def rest_request(self, endpoint: str, method: str = "GET", data: dict | list | None = None) -> dict:
        # Route by (endpoint_prefix, method) to handler methods
        ...
```

**Design decisions:**
- All created resources get auto-generated UUIDs (`uuid.uuid4()`)
- Responses match real Nautobot API shape (REST envelope + GraphQL `data.*` structure)
- Error simulation: pass `error_on={"dcim/devices/": "POST"}` to constructor to trigger `NautobotAPIError`
- GraphQL routing: inspect `query` string for operation markers (`DeviceList`, `DeviceByName`, `StatusByName`, etc.)
- REST routing: `(endpoint.split("?")[0].rstrip("/"), method)` tuple dispatch

**Seed data constants (in `tests/fixtures/nautobot_fixtures.py`, extend existing file):**
- `SEED_STATUSES` — active, planned, staged, decommissioning
- `SEED_PLATFORMS` — Cisco IOS, Cisco NX-OS, Juniper JunOS
- `SEED_DEVICE_TYPES` — networkA, networkB, server
- `SEED_LOCATIONS` — City A → State West → USA
- `SEED_NAMESPACES` — Global
- `SEED_ROLES` — Network, Server, Firewall

**Update `tests/mocks/__init__.py`:** export `FakeNautobotService`

**Update `tests/conftest.py`:** add `fake_nautobot_service` fixture:

```python
@pytest.fixture
def fake_nautobot_service() -> FakeNautobotService:
    return FakeNautobotService()

@pytest.fixture
def fake_nautobot_service_with_devices() -> FakeNautobotService:
    """Pre-populated with 3 test devices."""
    svc = FakeNautobotService()
    for device in SEED_DEVICES:
        svc._devices[device["id"]] = device
    return svc
```

---

## Phase 2: Unit Tests for Add Device

### New file: `tests/unit/services/test_device_creation_service.py`

Uses `FakeNautobotService` injected into `DeviceCreationService`.

**Test cases:**

1. `test_create_basic_device_success`
   - Minimal `AddDeviceRequest` (name, device_type, location, status)
   - Assert: success=True, device_id set, device exists in fake store

2. `test_create_device_with_loopback_interface`
   - Request includes one interface with IP address
   - Assert: interface + IP created, primary_ip4 assigned to device

3. `test_create_device_with_multiple_interfaces`
   - 3 interfaces, one marked is_primary_ipv4=True
   - Assert: all interfaces created, correct IP promoted to primary

4. `test_create_device_dry_run`
   - dry_run=True → no REST mutations called
   - Assert: success=True, no objects written to fake store

5. `test_create_device_prefix_auto_creation`
   - IP with no matching prefix → `add_prefixes_automatically=True`
   - Assert: prefix created before IP, IP created successfully

6. `test_create_device_with_virtual_chassis`
   - `virtual_chassis_name` in request
   - Assert: virtual chassis created/joined, device has vc_position

7. `test_create_device_duplicate_returns_error`
   - `FakeNautobotService(error_on={"dcim/devices/": "POST"}, error_type="duplicate")`
   - Assert: success=False, message contains "already exists"

8. `test_create_device_missing_required_fields`
   - `AddDeviceRequest` without device_type
   - Assert: raises `NautobotValidationError`

9. `test_create_device_resolves_names_to_uuids`
   - Pass names for status, platform, location, role
   - Assert: REST POST body contains UUIDs, not names

**Helper:** `make_add_device_request(**kwargs)` factory at top of file

---

## Phase 3: Unit Tests for Offboard Device

### New file: `tests/unit/services/test_offboarding_service.py`

Uses `FakeNautobotService` pre-populated with a device + interfaces + IPs.

**Test cases:**

1. `test_offboard_simple_device`
   - Device with 2 IPs, no virtual chassis, no CheckMK
   - Assert: device deleted, IPs deleted, audit log entry created

2. `test_offboard_device_with_virtual_chassis_member`
   - Device is a member (not master) of a VC
   - Assert: device removed from VC, VC updated; other members unaffected

3. `test_offboard_device_with_virtual_chassis_master`
   - Device is the VC master with 2 members
   - Assert: VC deleted or master re-assigned (per offboarding rules)

4. `test_offboard_device_cleans_ip_addresses`
   - Device has primary_ip4 assigned
   - Assert: IP address object deleted from Nautobot

5. `test_offboard_device_with_checkmk_cleanup`
   - `mock_checkmk_client` configured
   - Assert: CheckMK host delete called with correct hostname

6. `test_offboard_device_checkmk_failure_continues`
   - CheckMK delete raises exception
   - Assert: Nautobot cleanup still completes, warning logged

7. `test_offboard_nonexistent_device_raises`
   - Device ID not in fake store
   - Assert: raises `NautobotResourceNotFoundError`

8. `test_offboard_device_ip_cleanup_partial_failure`
   - FakeNautobotService returns error on second IP DELETE
   - Assert: first IP deleted, error recorded in result, device deletion proceeds

---

## Phase 4: Unit Tests for Resolvers and Managers

### New file: `tests/unit/services/test_resolvers.py`

**DeviceResolver:**
- `resolve_device_by_name` — found / not found
- `resolve_device_by_ip` — found / not found
- `resolve_device_id` — prefers UUID → name → IP (strategy cascade)
- `resolve_device_type_id` — found / not found

**MetadataResolver:**
- `resolve_status_id` — found / raises ValueError if missing
- `resolve_role_id`, `resolve_platform_id`, `resolve_location_id` — each found / None
- `resolve_rack_id` — ambiguous raises ValueError

**NetworkResolver:**
- `resolve_namespace_id` — found / raises ValueError
- `resolve_ip_address` — found / None
- `resolve_interface_by_name` — found / None

### New file: `tests/unit/services/test_managers.py`

**IPManager:**
- `ensure_ip_address_exists` — IP already exists (returns existing UUID)
- `ensure_ip_address_exists` — IP missing, prefix missing, auto-create=True
- `ensure_ip_address_exists` — duplicate netmask scenario
- `assign_ip_to_interface` — new assignment / duplicate detection

**InterfaceManager:**
- `ensure_interface_exists` — created / already exists
- `ensure_interface_with_ip` — end-to-end (IP + interface + assignment)
- `update_interface_ip` — old IP found, new IP created, assigned

**DeviceManager:**
- `verify_device_updates` — all fields match / one field differs / custom_field differs
- `assign_primary_ip_to_device` — success / device not found

---

## Phase 5: Integration Tests (Real Nautobot)

### New file: `tests/integration/test_add_device_real_nautobot.py`

Marker: `@pytest.mark.integration @pytest.mark.nautobot`
Uses `real_nautobot_service` fixture (auto-skips if `.env.test` missing).

**Cleanup pattern:** fixture yields created device IDs → teardown deletes each.

**Tests:**
1. `test_create_device_resolves_metadata` — real UUID lookup for status/platform/location
2. `test_create_device_with_interface_and_ip` — full workflow on real API
3. `test_create_and_verify_primary_ip_assignment`
4. `test_create_device_duplicate_detection`

### New file: `tests/integration/test_offboard_real_nautobot.py`

**Tests:**
1. `test_offboard_device_cleans_up_correctly` — create device → offboard → verify gone
2. `test_offboard_cleans_ip_addresses`

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| **Create** | `tests/mocks/fake_nautobot_service.py` |
| **Modify** | `tests/mocks/__init__.py` — export FakeNautobotService |
| **Modify** | `tests/fixtures/nautobot_fixtures.py` — add SEED_* constants |
| **Modify** | `tests/conftest.py` — add fake_nautobot_service fixtures |
| **Create** | `tests/unit/services/test_device_creation_service.py` |
| **Create** | `tests/unit/services/test_offboarding_service.py` |
| **Create** | `tests/unit/services/test_resolvers.py` |
| **Create** | `tests/unit/services/test_managers.py` |
| **Create** | `tests/integration/test_add_device_real_nautobot.py` |
| **Create** | `tests/integration/test_offboard_real_nautobot.py` |

---

## Key Existing Code to Reuse

| Component | Path |
|-----------|------|
| `NautobotService` (real client) | `services/nautobot/client.py` |
| `DeviceCreationService` | `services/nautobot/devices/creation.py` |
| `OffboardingService` | `services/nautobot/offboarding/service.py` |
| `DeviceCommonService` (facade) | `services/nautobot/devices/common.py` |
| `DeviceResolver` | `services/nautobot/resolvers/device_resolver.py` |
| `MetadataResolver` | `services/nautobot/resolvers/metadata_resolver.py` |
| `NetworkResolver` | `services/nautobot/resolvers/network_resolver.py` |
| `IPManager` | `services/nautobot/managers/ip_manager.py` |
| `InterfaceManager` | `services/nautobot/managers/interface_manager.py` |
| `DeviceManager` | `services/nautobot/managers/device_manager.py` |
| `AddDeviceRequest` model | `backend/models/nautobot/devices.py` (verify path) |
| Existing nautobot fixtures | `tests/fixtures/nautobot_fixtures.py` |
| `mock_nautobot_service` fixture | `tests/conftest.py` (keep, alongside new fake) |
| Real Nautobot fixture | `tests/conftest.py` → `real_nautobot_service` |

---

## Verification

```bash
# Run unit tests only (offline, no Nautobot required)
cd backend && pytest tests/unit/ -v -m "not nautobot"

# Run integration tests (requires .env.test with real Nautobot)
pytest tests/integration/test_add_device_real_nautobot.py -v -m "integration and nautobot"

# Coverage report
pytest tests/unit/ --cov=services/nautobot --cov-report=term-missing
```

Target: **≥80% line coverage** on `services/nautobot/` for unit test suite.
