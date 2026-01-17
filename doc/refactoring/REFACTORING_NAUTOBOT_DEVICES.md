# Refactoring Plan: Nautobot Device Services

## Executive Summary

The `backend/services/nautobot/devices/` directory contains **7 service files** totaling approximately **3,200+ lines** with significant code duplication across device creation, import, and update workflows. Multiple services implement the same functionality independently, violating the DRY (Don't Repeat Yourself) principle and making the codebase difficult to maintain.

**Estimated reduction:** ~400-500 lines of redundant code can be eliminated through proper consolidation.

---

## Current Architecture

```
backend/services/nautobot/devices/
├── __init__.py              # 35 lines - Exports
├── types.py                 # 154 lines - Pydantic models (GOOD - keep as is)
├── common.py                # 1,604 lines - Shared utilities (GOOD - needs minor additions)
├── query.py                 # 421 lines - Device queries (GOOD - keep as is)
├── creation.py              # 820 lines - Device creation workflow
├── update.py                # 583 lines - Device update workflow
├── import_service.py        # 600 lines - Device import workflow
└── interface_manager.py     # 695 lines - Interface management
```

---

## Problem Analysis

### Problem 1: Three Implementations of Interface Creation

**Affected Files:**
- `creation.py:498-754` - `_step3_create_interfaces()` (~257 lines)
- `import_service.py:384-599` - `_create_device_interfaces()` (~217 lines)
- `interface_manager.py:43-187` - `update_device_interfaces()` (~145 lines)

**What They All Do:**
```python
# All three implement this same workflow:
1. Separate LAG interfaces (must create first for dependencies)
2. Map frontend IDs to Nautobot IDs
3. Build interface payloads with optional fields
4. Create interfaces via REST API (POST /dcim/interfaces/)
5. Handle "already exists" errors with GraphQL lookup
6. Assign IP addresses to interfaces
7. Track and determine primary IPv4
```

**Code Example - Nearly Identical Error Handling:**

```python
# creation.py:593-635
except Exception as create_error:
    if "must make a unique set" in str(create_error).lower():
        logger.info(f"Interface {interface.name} already exists, looking it up...")
        # GraphQL lookup code...

# interface_manager.py:397-412
except Exception as create_error:
    if "must make a unique set" in str(create_error).lower():
        interface_id = await self._lookup_existing_interface(...)
        # Same logic...

# import_service.py doesn't handle this case - BUG!
```

**Issue:** `DeviceCreationService` does NOT use `InterfaceManagerService` at all - it has its own complete inline implementation.

---

### Problem 2: Duplicate IP Address Creation Logic

**Affected Files:**
- `creation.py:284-496` - `_step2_create_ip_addresses()` (~213 lines)
- `interface_manager.py:189-348` - `_create_ip_addresses()` (~160 lines)

**What They Both Do:**
```python
# Both implement:
1. Build IP payload with status, namespace, role
2. POST to /ipam/ip-addresses/
3. Handle "already exists" error
4. GraphQL lookup for existing IP
5. Map "interface_name:ip_address" → UUID
6. Update existing IP role if needed
```

**Code Comparison:**

```python
# creation.py:333-347
ip_payload = {
    "address": ip_data.address,
    "status": interface_status,
    "namespace": ip_data.namespace,
}
if ip_data.ip_role and ip_data.ip_role != 'none':
    ip_payload["role"] = ip_data.ip_role

# interface_manager.py:258-274
ip_payload = {
    "address": ip_address,
    "status": status_id,
    "namespace": namespace_id,
}
if ip_role and ip_role != 'none':
    ip_payload["role"] = ip_role
```

**These are functionally identical implementations.**

---

### Problem 3: Three Primary IPv4 Assignment Methods

**Affected Files:**
- `creation.py:788-815` - `_assign_primary_ipv4()`
- `common.py:1454-1485` - `assign_primary_ip_to_device()`
- `interface_manager.py:532-556` - `_set_primary_ipv4()`

**All Three Do The Same Thing:**
```python
# All execute:
await self.nautobot.rest_request(
    endpoint=f"dcim/devices/{device_id}/",
    method="PATCH",
    data={"primary_ip4": ip_address_id}
)
```

**Code Evidence:**

```python
# creation.py:802-805
endpoint = f"dcim/devices/{device_id}/"
await nautobot_service.rest_request(
    endpoint=endpoint, method="PATCH", data={"primary_ip4": ip_address_id}
)

# common.py:1470-1475
endpoint = f"dcim/devices/{device_id}/"
await self.nautobot.rest_request(
    endpoint=endpoint,
    method="PATCH",
    data={"primary_ip4": ip_address_id},
)

# interface_manager.py:547-552
update_payload = {"primary_ip4": primary_ipv4_id}
await self.nautobot.rest_request(
    endpoint=f"dcim/devices/{device_id}/",
    method="PATCH",
    data=update_payload,
)
```

**Three identical implementations of a 5-line function.**

---

### Problem 4: Duplicate Interface Lookup (GraphQL)

**Affected Files:**
- `creation.py:598-631` - Inline GraphQL lookup
- `interface_manager.py:613-665` - `_lookup_existing_interface()`

**Both Execute This Query:**
```graphql
query GetInterface($device: [String], $name: [String]) {
  interfaces(device_id: $device, name: $name) {
    id
    name
  }
}
```

**Issue:** This should be a method in `DeviceCommonService` but isn't.

---

### Problem 5: Duplicate IP Address Lookup (GraphQL)

**Affected Files:**
- `creation.py:392-447` - Inline GraphQL lookup
- `interface_manager.py:557-611` - `_lookup_existing_ip()`

**Both Execute This Query:**
```graphql
query GetIPAddress($filter: [String], $namespace: [String]) {
  ip_addresses(address: $filter, namespace: $namespace) {
    id
    address
  }
}
```

**Same pattern - duplicated instead of centralized.**

---

### Problem 6: DeviceImportService ≈ DeviceCreationService

**Similarity Analysis:**

| Feature | DeviceCreationService | DeviceImportService |
|---------|----------------------|---------------------|
| Input format | `AddDeviceRequest` Pydantic model | Plain dict |
| Create device | Yes | Yes |
| Create interfaces | Yes (inline) | Yes (inline) |
| Create IP addresses | Yes (separate step) | Yes (inline in interface creation) |
| Handle "already exists" | Yes | Yes |
| Assign primary IP | Yes | Yes |
| Use DeviceCommonService | Minimal | Yes |
| Use InterfaceManagerService | No | No |

**These services duplicate ~80% of workflow logic** with different input formats.

---

### Problem 7: Unnecessary Wrapper Methods

**In `interface_manager.py:667-694`:**

```python
async def _resolve_status_id(self, status: str, content_type: str) -> str:
    if not self.common._is_valid_uuid(status):
        return await self.common.resolve_status_id(status, content_type)
    return status

async def _resolve_namespace_id(self, namespace: str) -> str:
    if not self.common._is_valid_uuid(namespace):
        return await self.common.resolve_namespace_id(namespace)
    return namespace
```

**Issue:** `DeviceCommonService.resolve_status_id()` should already handle UUID checking internally. These wrappers add no value.

---

### Problem 8: Inconsistent Service Instantiation

**Different patterns used:**

```python
# creation.py - Creates own instance
class DeviceCreationService:
    def __init__(self):
        self.common_service = DeviceCommonService(nautobot_service)

# update.py - Receives instance via constructor
class DeviceUpdateService:
    def __init__(self, nautobot_service: NautobotService):
        self.common = DeviceCommonService(nautobot_service)

# import_service.py - Same as update.py
class DeviceImportService:
    def __init__(self, nautobot_service: NautobotService):
        self.common = DeviceCommonService(nautobot_service)
```

**Inconsistent dependency injection patterns.**

---

## Proposed Refactoring Plan

### Phase 1: Add Missing Methods to DeviceCommonService

**File:** `common.py`

Add these reusable methods that are currently duplicated:

```python
class DeviceCommonService:
    # ADD: Interface lookup by device and name
    async def resolve_interface_by_name(
        self, device_id: str, interface_name: str
    ) -> Optional[str]:
        """
        Resolve interface UUID from device ID and interface name using GraphQL.

        Returns:
            Interface UUID if found, None otherwise
        """
        query = """
        query GetInterface($device: [String], $name: [String]) {
          interfaces(device_id: $device, name: $name) {
            id
            name
          }
        }
        """
        variables = {"device": [device_id], "name": [interface_name]}
        result = await self.nautobot.graphql_query(query, variables)

        if "errors" in result:
            logger.error(f"GraphQL error resolving interface: {result['errors']}")
            return None

        interfaces = result.get("data", {}).get("interfaces", [])
        if interfaces and len(interfaces) > 0:
            return interfaces[0]["id"]
        return None

    # ADD: IP address lookup by address and namespace
    async def resolve_ip_address(
        self, ip_address: str, namespace_id: str
    ) -> Optional[str]:
        """
        Resolve IP address UUID from address and namespace using GraphQL.

        Returns:
            IP address UUID if found, None otherwise
        """
        query = """
        query GetIPAddress($filter: [String], $namespace: [String]) {
          ip_addresses(address: $filter, namespace: $namespace) {
            id
            address
          }
        }
        """
        variables = {"filter": [ip_address], "namespace": [namespace_id]}
        result = await self.nautobot.graphql_query(query, variables)

        if "errors" in result:
            logger.error(f"GraphQL error resolving IP address: {result['errors']}")
            return None

        ip_addresses = result.get("data", {}).get("ip_addresses", [])
        if ip_addresses and len(ip_addresses) > 0:
            return ip_addresses[0]["id"]
        return None
```

**Estimated effort:** 1 hour

---

### Phase 2: Consolidate IP Address Creation in InterfaceManagerService

**File:** `interface_manager.py`

Make `_create_ip_addresses()` the single source of truth for IP creation.

**Changes:**
1. Move the GraphQL lookup to use `DeviceCommonService.resolve_ip_address()`
2. Add support for both array format (`ip_addresses`) and legacy format (`ip_address`)
3. Ensure all callers use this method

```python
async def create_ip_address(
    self,
    ip_address: str,
    namespace: str,
    status: str = "active",
    ip_role: Optional[str] = None,
) -> Optional[str]:
    """
    Create or get existing IP address.

    Single source of truth for IP address creation.

    Returns:
        IP address UUID if successful, None otherwise
    """
    # Resolve to UUIDs
    status_id = await self.common.resolve_status_id(status, "ipam.ipaddress")
    namespace_id = await self.common.resolve_namespace_id(namespace)

    # Build payload
    ip_payload = {
        "address": ip_address,
        "status": status_id,
        "namespace": namespace_id,
    }
    if ip_role and ip_role != 'none':
        ip_payload["role"] = ip_role

    try:
        response = await self.nautobot.rest_request(
            endpoint="ipam/ip-addresses/",
            method="POST",
            data=ip_payload,
        )
        if response and "id" in response:
            return response["id"]
    except Exception as e:
        if "already exists" in str(e).lower():
            # Use common service for lookup
            return await self.common.resolve_ip_address(ip_address, namespace_id)
        raise

    return None
```

**Estimated effort:** 2 hours

---

### Phase 3: Consolidate Interface Creation in InterfaceManagerService

**File:** `interface_manager.py`

Enhance `update_device_interfaces()` to be the single interface creation entry point.

**Changes:**
1. Add proper LAG ordering support
2. Add frontend-to-Nautobot ID mapping
3. Add "already exists" handling using `DeviceCommonService.resolve_interface_by_name()`
4. Support all optional interface fields from `creation.py`

```python
async def create_interface(
    self,
    device_id: str,
    name: str,
    interface_type: str,
    status: str = "active",
    **optional_fields,
) -> Optional[str]:
    """
    Create or get existing interface.

    Single source of truth for interface creation.

    Returns:
        Interface UUID if successful, None otherwise
    """
    status_id = await self.common.resolve_status_id(status, "dcim.interface")

    payload = {
        "name": name,
        "device": device_id,
        "type": interface_type,
        "status": status_id,
    }

    # Add optional fields
    for field in ["enabled", "mgmt_only", "description", "mac_address",
                  "mtu", "mode", "lag", "parent_interface", "bridge",
                  "untagged_vlan", "tagged_vlans", "tags"]:
        if field in optional_fields and optional_fields[field] is not None:
            payload[field] = optional_fields[field]

    try:
        response = await self.nautobot.rest_request(
            endpoint="dcim/interfaces/",
            method="POST",
            data=payload,
        )
        if response and "id" in response:
            return response["id"]
    except Exception as e:
        if "must make a unique set" in str(e).lower():
            # Use common service for lookup
            return await self.common.resolve_interface_by_name(device_id, name)
        raise

    return None
```

**Estimated effort:** 3 hours

---

### Phase 4: Refactor DeviceCreationService to Use InterfaceManagerService

**File:** `creation.py`

**Current state:** `DeviceCreationService` has its own inline implementation of:
- `_step2_create_ip_addresses()` - 213 lines
- `_step3_create_interfaces()` - 257 lines
- `_assign_primary_ipv4()` - 28 lines

**Proposed changes:**

```python
class DeviceCreationService:
    def __init__(self):
        self.common_service = DeviceCommonService(nautobot_service)
        self.interface_manager = InterfaceManagerService(nautobot_service)  # ADD THIS

    async def create_device_with_interfaces(self, request: AddDeviceRequest) -> dict:
        # ... Step 1: Create device (keep as is)

        # Step 1.5: Create prefixes if needed (keep as is)

        # REPLACE Steps 2-4 with InterfaceManagerService:
        if request.interfaces:
            # Convert AddDeviceRequest interfaces to InterfaceManagerService format
            interface_specs = self._convert_interfaces_to_spec(request.interfaces)

            result = await self.interface_manager.update_device_interfaces(
                device_id=device_id,
                interfaces=interface_specs,
            )

            # Use result.primary_ip4_id, result.interfaces_created, etc.
```

**Delete these methods (use InterfaceManagerService instead):**
- `_step2_create_ip_addresses()` - DELETE (~213 lines)
- `_step3_create_interfaces()` - DELETE (~257 lines)
- `_step4_assign_primary_ip()` - Simplify to use result from InterfaceManagerService
- `_assign_primary_ipv4()` - DELETE, use `common.assign_primary_ip_to_device()`

**Estimated effort:** 4 hours

---

### Phase 5: Refactor DeviceImportService to Use InterfaceManagerService

**File:** `import_service.py`

**Current state:** Has its own `_create_device_interfaces()` method (~217 lines)

**Proposed changes:**

```python
class DeviceImportService:
    def __init__(self, nautobot_service: NautobotService):
        self.nautobot = nautobot_service
        self.common = DeviceCommonService(nautobot_service)
        self.interface_manager = InterfaceManagerService(nautobot_service)  # ADD THIS

    async def import_device(self, device_data: Dict, interface_config: List = None, ...):
        # ... Create device (keep as is)

        # REPLACE interface creation:
        if interface_config:
            result = await self.interface_manager.update_device_interfaces(
                device_id=device_id,
                interfaces=interface_config,
            )
            primary_ipv4_id = result.primary_ip4_id
```

**Delete these methods:**
- `_create_device_interfaces()` - DELETE (~217 lines)

**Estimated effort:** 2 hours

---

### Phase 6: Remove Redundant Methods from InterfaceManagerService

**File:** `interface_manager.py`

**Delete these unnecessary wrapper methods:**

```python
# DELETE - Just calls common.resolve_status_id()
async def _resolve_status_id(self, status: str, content_type: str) -> str:
    ...

# DELETE - Just calls common.resolve_namespace_id()
async def _resolve_namespace_id(self, namespace: str) -> str:
    ...
```

**Replace calls with direct `self.common.resolve_status_id()` and `self.common.resolve_namespace_id()`**

**Estimated effort:** 30 minutes

---

### Phase 7: Consider Merging DeviceCreationService and DeviceImportService

**Analysis:**

| Aspect | DeviceCreationService | DeviceImportService |
|--------|----------------------|---------------------|
| Purpose | Create device from UI form | Create device from CSV/API |
| Input | Pydantic `AddDeviceRequest` | Plain dict |
| Workflow | Create device → interfaces → primary IP | Create device → interfaces → primary IP |
| Overlap | ~80% identical | ~80% identical |

**Option A: Keep Separate (Recommended for now)**
- Pros: Clear separation of concerns, different input validation
- Cons: Some duplication remains

**Option B: Merge into Single Service**
- Create `DeviceCreationService` that accepts either format
- Use Pydantic model internally for validation
- Single workflow implementation

```python
class DeviceCreationService:
    async def create_device(
        self,
        device_data: Union[AddDeviceRequest, Dict[str, Any]],
        skip_if_exists: bool = False,
    ) -> Dict[str, Any]:
        # Normalize input
        if isinstance(device_data, dict):
            device_data = AddDeviceRequest(**device_data)

        # Single workflow...
```

**Recommendation:** Start with Option A (keep separate) after Phase 4-5 refactoring. Evaluate merge after seeing the reduced code.

**Estimated effort:** 4 hours (if merging)

---

### Phase 8: Standardize Service Instantiation

**Current inconsistency:**

```python
# Some use global singleton
device_creation_service = DeviceCreationService()

# Some require dependency injection
def __init__(self, nautobot_service: NautobotService):
```

**Standardize to dependency injection:**

```python
# All services should accept NautobotService in constructor
class DeviceCreationService:
    def __init__(self, nautobot_service: NautobotService):
        self.nautobot = nautobot_service
        self.common = DeviceCommonService(nautobot_service)
        self.interface_manager = InterfaceManagerService(nautobot_service)

# Create singletons at module level
device_creation_service = DeviceCreationService(nautobot_service)
```

**Estimated effort:** 1 hour

---

## Final Directory Structure (After Refactoring)

```
backend/services/nautobot/devices/
├── __init__.py              # 40 lines - Exports
├── types.py                 # 154 lines - Pydantic models (unchanged)
├── common.py                # ~1,700 lines - Shared utilities (+2 new methods)
├── query.py                 # 421 lines - Device queries (unchanged)
├── creation.py              # ~350 lines - Device creation (was 820, -470 lines)
├── update.py                # 583 lines - Device update (mostly unchanged)
├── import_service.py        # ~380 lines - Device import (was 600, -220 lines)
└── interface_manager.py     # ~620 lines - Interface management (was 695, -75 lines)
```

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `common.py` | 1,604 lines | ~1,700 lines | +96 lines (new methods) |
| `creation.py` | 820 lines | ~350 lines | **-470 lines** |
| `import_service.py` | 600 lines | ~380 lines | **-220 lines** |
| `interface_manager.py` | 695 lines | ~620 lines | **-75 lines** |
| **Total** | **3,719 lines** | **~3,050 lines** | **-669 lines (~18%)** |

---

## Estimated Total Effort

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Add missing methods to DeviceCommonService | 1 hour |
| 2 | Consolidate IP address creation | 2 hours |
| 3 | Consolidate interface creation | 3 hours |
| 4 | Refactor DeviceCreationService | 4 hours |
| 5 | Refactor DeviceImportService | 2 hours |
| 6 | Remove redundant wrapper methods | 30 minutes |
| 7 | Evaluate merge (optional) | 4 hours |
| 8 | Standardize service instantiation | 1 hour |
| - | Testing & Integration | 4 hours |
| **Total** | | **~21.5 hours** |

---

## Benefits After Refactoring

1. **DRY Compliance**: Each piece of functionality implemented once
2. **Maintainability**: Bug fixes only need to be made in one place
3. **Testability**: Smaller, focused methods are easier to unit test
4. **Consistency**: All device operations use the same underlying code
5. **Reduced Bug Surface**: Fewer implementations = fewer places for bugs
6. **Easier Onboarding**: New developers see clear, non-duplicated code
7. **Performance**: Potential for shared caching of resolved UUIDs

---

## Recommended Refactoring Order

1. **Phase 1** - Add methods to DeviceCommonService (foundation, no breaking changes)
2. **Phase 6** - Remove wrapper methods (quick win, low risk)
3. **Phase 2** - Consolidate IP creation (self-contained)
4. **Phase 3** - Consolidate interface creation (builds on Phase 2)
5. **Phase 5** - Refactor DeviceImportService (simpler, good test case)
6. **Phase 4** - Refactor DeviceCreationService (larger change)
7. **Phase 8** - Standardize instantiation (cleanup)
8. **Phase 7** - Evaluate merge (optional, after seeing results)

---

## Testing Strategy

### Unit Tests Required

```python
# test_common_service.py
def test_resolve_interface_by_name_found():
def test_resolve_interface_by_name_not_found():
def test_resolve_ip_address_found():
def test_resolve_ip_address_not_found():

# test_interface_manager.py
def test_create_ip_address_new():
def test_create_ip_address_existing():
def test_create_interface_new():
def test_create_interface_existing():
def test_update_device_interfaces_with_lag():
def test_update_device_interfaces_primary_ip():

# test_creation_service.py
def test_create_device_with_interfaces():
def test_create_device_no_interfaces():
def test_create_device_with_prefix():

# test_import_service.py
def test_import_device_new():
def test_import_device_exists_skip():
def test_import_device_with_interfaces():
```

### Integration Tests

- Create device with multiple interfaces and IPs
- Update device interfaces (add, modify, remove)
- Import device from CSV format
- Handle "already exists" scenarios

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing API | Medium | High | Comprehensive testing, phased rollout |
| Performance regression | Low | Medium | Benchmark before/after |
| Missing edge cases | Medium | Medium | Review existing tests, add new ones |
| Merge conflicts | Low | Low | Work on feature branch |

---

## Notes

- Ensure backward compatibility of all public methods
- Refactor one phase at a time with full testing before proceeding
- Keep detailed commit messages for each phase
- Consider adding deprecation warnings before removing old methods
- Update any routers/tasks that directly instantiate these services

---

## Appendix: Detailed Code Duplication Examples

### Example 1: Primary IP Assignment (3 implementations)

```python
# === creation.py:788-815 ===
async def _assign_primary_ipv4(self, device_id: str, ip_address_id: str) -> bool:
    try:
        logger.info(f"Assigning primary IPv4 {ip_address_id} to device {device_id}")
        endpoint = f"dcim/devices/{device_id}/"
        await nautobot_service.rest_request(
            endpoint=endpoint, method="PATCH", data={"primary_ip4": ip_address_id}
        )
        logger.info(f"Successfully assigned primary IPv4 {ip_address_id} to device {device_id}")
        return True
    except Exception as e:
        logger.error(f"Error assigning primary IPv4 to device {device_id}: {str(e)}")
        return False

# === common.py:1454-1485 ===
async def assign_primary_ip_to_device(self, device_id: str, ip_address_id: str) -> bool:
    try:
        logger.info(f"Assigning primary IPv4 {ip_address_id} to device {device_id}")
        endpoint = f"dcim/devices/{device_id}/"
        await self.nautobot.rest_request(
            endpoint=endpoint,
            method="PATCH",
            data={"primary_ip4": ip_address_id},
        )
        logger.info(f"Successfully assigned primary IPv4 to device {device_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to assign primary IPv4 to device {device_id}: {str(e)}")
        return False

# === interface_manager.py:532-556 ===
async def _set_primary_ipv4(self, device_id: str, primary_ipv4_id: str, warnings: List[str]) -> None:
    try:
        update_payload = {"primary_ip4": primary_ipv4_id}
        await self.nautobot.rest_request(
            endpoint=f"dcim/devices/{device_id}/",
            method="PATCH",
            data=update_payload,
        )
        logger.info(f"Set primary IPv4 to {primary_ipv4_id}")
    except Exception as e:
        warnings.append(f"Failed to set primary IPv4: {str(e)}")
```

**After refactoring:** Only `common.py:assign_primary_ip_to_device()` will exist.

---

### Example 2: Interface "Already Exists" Handling (2 implementations)

```python
# === creation.py:593-631 ===
except Exception as create_error:
    if "must make a unique set" in str(create_error).lower():
        logger.info(f"Interface {interface.name} already exists, looking it up...")
        try:
            query = """
            query GetInterface($device: [String], $name: [String]) {
              interfaces(device_id: $device, name: $name) {
                id
                name
              }
            }
            """
            variables = {"device": [device_id], "name": [interface.name]}
            result = await nautobot_service.graphql_query(query, variables)
            if result and "data" in result and "interfaces" in result["data"]:
                interfaces_list = result["data"]["interfaces"]
                if interfaces_list and len(interfaces_list) > 0:
                    existing_interface = interfaces_list[0]
                    interface_id = existing_interface["id"]
                    # ...

# === interface_manager.py:397-412 + 613-665 ===
except Exception as create_error:
    if "must make a unique set" in str(create_error).lower():
        interface_id = await self._lookup_existing_interface(
            device_id=device_id,
            interface_name=interface["name"],
            warnings=warnings,
        )
        # ...

async def _lookup_existing_interface(self, device_id: str, interface_name: str, warnings: List[str]) -> Optional[str]:
    # Same GraphQL query as creation.py
```

**After refactoring:** Both will use `common.resolve_interface_by_name()`.

---

**Document Version:** 1.0
**Created:** January 2025
**Status:** Proposed
