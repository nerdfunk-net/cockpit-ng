# Refactoring Plan: Nautobot Device Common Service (UPDATED)

## Executive Summary

The file `backend/services/nautobot/devices/common.py` has grown into a "God Object" (approx. 1800 lines) with mixed responsibilities. This plan proposes decomposing it into a structured package with specialized modules following the project's architectural standards defined in CLAUDE.md.

**Current Metrics:**
- **Lines:** ~1784
- **Classes:** 1 (`DeviceCommonService`)
- **Responsibilities:** ID resolution, Data validation, Data normalization, Resource lifecycle management (IPs, Interfaces, Prefixes), Device API interactions.

## Architectural Context

**Important Distinction:**
- `NautobotService` is an **API client** for external Nautobot GraphQL/REST APIs (not local database)
- Traditional Repository pattern (for PostgreSQL) does NOT apply here
- This is a **service wrapper layer** around external API calls
- However, we still follow layered architecture: Utils → API Client → Domain Services → Consumers

**Alignment with CLAUDE.md:**
- ✅ Feature-based organization by domain
- ✅ `snake_case` naming for backend files
- ✅ Dependency injection pattern
- ✅ Pydantic models for request/response validation
- ✅ Separation of concerns (pure functions vs. stateful services)

## Directory Structure (UPDATED)

```text
backend/
├── models/
│   └── nautobot.py                   # [EXISTS] Pydantic models for Nautobot API
│
├── services/
│   └── nautobot/
│       ├── client.py                 # [EXISTS] NautobotService API client
│       ├── common/                   # [NEW] Shared utilities package
│       │   ├── __init__.py           # Exposes public API
│       │   ├── validators.py         # Pure validation functions
│       │   ├── utils.py              # Pure data transformation functions
│       │   └── exceptions.py         # [NEW] Custom exception classes
│       │
│       ├── resolvers/                # [NEW] ID/UUID resolution services
│       │   ├── __init__.py
│       │   ├── base_resolver.py      # Base class with shared logic
│       │   ├── device_resolver.py    # Device-specific resolution
│       │   ├── network_resolver.py   # IP/Interface/Prefix resolution
│       │   └── metadata_resolver.py  # Status/Role/Platform resolution
│       │
│       ├── managers/                 # [NEW] Resource lifecycle management
│       │   ├── __init__.py
│       │   ├── ip_manager.py         # IP address operations
│       │   ├── interface_manager.py  # Interface operations (merge with existing)
│       │   ├── prefix_manager.py     # Prefix operations
│       │   └── device_manager.py     # Device-specific operations
│       │
│       └── devices/
│           ├── __init__.py
│           ├── common.py             # [REFACTOR] Becomes facade (backward compat)
│           ├── creation.py           # [EXISTS]
│           ├── update.py             # [EXISTS]
│           ├── query.py              # [EXISTS]
│           ├── import_service.py     # [EXISTS]
│           ├── interface_manager.py  # [EXISTS] Will be merged/refactored
│           └── types.py              # [EXISTS]
```

**Key Changes from Original Plan:**
1. **Added `models/nautobot.py` awareness** - Already exists with Pydantic schemas
2. **Separated resolvers by domain** - Device, Network, Metadata (better SRP)
3. **Renamed `resources` → `managers`** - Clearer intent (lifecycle management)
4. **Added `exceptions.py`** - Centralized error handling
5. **Created `resolvers/base_resolver.py`** - DRY for common resolution logic
6. **Aligned with existing `interface_manager.py`** - Will merge/refactor existing code

## Module Responsibilities & Dependencies

### 1. `common/validators.py` (Pure Functions)
**Responsibility:** Stateless validation logic. Zero dependencies on services.

**Exports:**
- `is_valid_uuid(uuid_str: str) -> bool`
- `validate_ip_address(ip: str) -> bool`
- `validate_mac_address(mac: str) -> bool`
- `validate_cidr(cidr: str) -> bool`
- `validate_required_fields(data: Dict, required_fields: List[str]) -> None`

**Dependencies:** `re`, `ipaddress` (stdlib only)

---

### 2. `common/utils.py` (Pure Functions)
**Responsibility:** Data transformation and normalization. Zero service dependencies.

**Exports:**
- `flatten_nested_fields(data: Dict) -> Dict`
- `extract_nested_value(data: Dict, path: str) -> Any`
- `normalize_tags(tags: Any) -> List[str]`
- `prepare_update_data(current: Dict, updates: Dict) -> Tuple[Dict, bool]`
- `extract_id_from_url(url: str) -> Optional[str]`

**Dependencies:** None (stdlib only)

---

### 3. `common/exceptions.py` (NEW)
**Responsibility:** Custom exception hierarchy for Nautobot operations.

**Exports:**
```python
class NautobotError(Exception):
    """Base exception for Nautobot operations."""
    pass

class NautobotValidationError(NautobotError):
    """Validation failed."""
    pass

class NautobotResourceNotFoundError(NautobotError):
    """Resource not found in Nautobot."""
    def __init__(self, resource_type: str, identifier: str):
        self.resource_type = resource_type
        self.identifier = identifier
        super().__init__(f"{resource_type} not found: {identifier}")

class NautobotDuplicateResourceError(NautobotError):
    """Resource already exists."""
    def __init__(self, resource_type: str, identifier: str):
        self.resource_type = resource_type
        self.identifier = identifier
        super().__init__(f"{resource_type} already exists: {identifier}")

class NautobotAPIError(NautobotError):
    """API request failed."""
    pass
```

**Dependencies:** None

---

### 4. `resolvers/base_resolver.py` (NEW)
**Responsibility:** Base class with shared GraphQL resolution logic (DRY).

**Exports:**
```python
class BaseResolver:
    """Base resolver with common GraphQL query logic."""

    def __init__(self, nautobot_service: NautobotService):
        self.nautobot = nautobot_service

    async def _resolve_by_field(
        self,
        resource_type: str,
        field_name: str,
        field_value: Any,
        return_field: str = "id"
    ) -> Optional[str]:
        """Generic field-based resolution."""
        # Common GraphQL query logic
        pass

    async def _resolve_by_name(
        self,
        resource_type: str,
        name: str
    ) -> Optional[str]:
        """Resolve resource by name (common pattern)."""
        return await self._resolve_by_field(resource_type, "name", name)
```

**Dependencies:** `NautobotService`, `common.exceptions`

---

### 5. `resolvers/device_resolver.py`
**Responsibility:** Device and device-related entity resolution.

**Exports:**
```python
class DeviceResolver(BaseResolver):
    async def resolve_device_by_name(self, name: str) -> Optional[str]
    async def resolve_device_by_ip(self, ip_address: str) -> Optional[str]
    async def resolve_device_id(self, identifier: str) -> str  # Raises if not found
    async def resolve_device_type_id(self, name: str) -> Optional[str]
    async def get_device_type_display(self, device_type_id: str) -> str
```

**Dependencies:** `NautobotService`, `BaseResolver`, `common.validators`, `common.exceptions`

---

### 6. `resolvers/metadata_resolver.py`
**Responsibility:** Metadata resolution (Status, Role, Platform, Location, etc.).

**Exports:**
```python
class MetadataResolver(BaseResolver):
    async def resolve_status_id(self, name: str, content_type: str) -> Optional[str]
    async def resolve_role_id(self, name: str) -> Optional[str]
    async def resolve_platform_id(self, name: str) -> Optional[str]
    async def get_platform_name(self, platform_id: str) -> str
    async def resolve_location_id(self, name: str) -> Optional[str]
```

**Dependencies:** `NautobotService`, `BaseResolver`, `common.exceptions`

---

### 7. `resolvers/network_resolver.py`
**Responsibility:** Network resource resolution (IP addresses, Interfaces, Namespaces, Prefixes).

**Exports:**
```python
class NetworkResolver(BaseResolver):
    async def resolve_ip_address(self, ip: str, namespace: str) -> Optional[str]
    async def resolve_interface_by_name(self, device_id: str, name: str) -> Optional[str]
    async def resolve_namespace_id(self, name: str) -> Optional[str]
    async def resolve_prefix(self, prefix: str, namespace: str) -> Optional[str]
    async def find_interface_with_ip(self, device_id: str, ip: str) -> Optional[Dict]
```

**Dependencies:** `NautobotService`, `BaseResolver`, `common.validators`, `common.exceptions`

---

### 8. `managers/ip_manager.py`
**Responsibility:** IP address lifecycle (create, update, assign).

**Exports:**
```python
class IPManager:
    def __init__(
        self,
        nautobot_service: NautobotService,
        network_resolver: NetworkResolver,
        metadata_resolver: MetadataResolver
    ):
        self.nautobot = nautobot_service
        self.network_resolver = network_resolver
        self.metadata_resolver = metadata_resolver

    async def ensure_ip_address_exists(
        self,
        ip_address: str,
        namespace_id: str,
        status: str = "Active"
    ) -> str:
        """Ensure IP exists, create if missing. Returns IP UUID."""
        pass

    async def assign_ip_to_interface(
        self,
        ip_address_id: str,
        interface_id: str
    ) -> Dict:
        """Assign existing IP to interface."""
        pass

    async def update_interface_ip(
        self,
        interface_id: str,
        old_ip: str,
        new_ip: str,
        namespace_id: str
    ) -> Dict:
        """Update IP assignment for interface."""
        pass
```

**Dependencies:** `NautobotService`, `NetworkResolver`, `MetadataResolver`, `common.validators`, `common.exceptions`

---

### 9. `managers/interface_manager.py`
**Responsibility:** Interface lifecycle (create, update, configure).

**Note:** Merge with existing `/backend/services/nautobot/devices/interface_manager.py`

**Exports:**
```python
class InterfaceManager:
    def __init__(
        self,
        nautobot_service: NautobotService,
        network_resolver: NetworkResolver,
        metadata_resolver: MetadataResolver,
        ip_manager: IPManager
    ):
        self.nautobot = nautobot_service
        self.network_resolver = network_resolver
        self.metadata_resolver = metadata_resolver
        self.ip_manager = ip_manager

    async def ensure_interface_exists(
        self,
        device_id: str,
        interface_data: Dict
    ) -> str:
        """Ensure interface exists, create/update as needed."""
        pass

    async def ensure_interface_with_ip(
        self,
        device_id: str,
        interface_name: str,
        ip_address: str,
        namespace_id: str,
        **kwargs
    ) -> Tuple[str, str]:
        """Ensure interface + IP assignment. Returns (interface_id, ip_id)."""
        pass
```

**Dependencies:** `NautobotService`, resolvers, `IPManager`, `common.validators`, `common.exceptions`

---

### 10. `managers/prefix_manager.py`
**Responsibility:** Prefix lifecycle (create, update).

**Exports:**
```python
class PrefixManager:
    def __init__(
        self,
        nautobot_service: NautobotService,
        network_resolver: NetworkResolver,
        metadata_resolver: MetadataResolver
    ):
        self.nautobot = nautobot_service
        self.network_resolver = network_resolver
        self.metadata_resolver = metadata_resolver

    async def ensure_prefix_exists(
        self,
        prefix: str,
        namespace_id: str,
        status: str = "Active"
    ) -> str:
        """Ensure prefix exists, create if missing."""
        pass
```

**Dependencies:** `NautobotService`, resolvers, `common.validators`, `common.exceptions`

---

### 11. `managers/device_manager.py`
**Responsibility:** Device-specific operations (primary IP, device updates, details).

**Exports:**
```python
class DeviceManager:
    def __init__(
        self,
        nautobot_service: NautobotService,
        device_resolver: DeviceResolver,
        network_resolver: NetworkResolver
    ):
        self.nautobot = nautobot_service
        self.device_resolver = device_resolver
        self.network_resolver = network_resolver

    async def get_device_details(self, device_id: str) -> Dict
    async def extract_primary_ip_address(self, device_data: Dict) -> Optional[str]
    async def assign_primary_ip_to_device(self, device_id: str, ip_id: str) -> Dict
    async def verify_device_updates(self, device_id: str, expected_data: Dict) -> bool
```

**Dependencies:** `NautobotService`, resolvers, `common.exceptions`

---

### 12. `devices/common.py` (REFACTORED - Facade)
**Responsibility:** Backward compatibility facade. Delegates all calls to new modules.

**CRITICAL:** DO NOT delete this file during refactoring. Update incrementally.

**Implementation Pattern:**
```python
from services.nautobot import NautobotService
from services.nautobot.resolvers import (
    DeviceResolver,
    MetadataResolver,
    NetworkResolver
)
from services.nautobot.managers import (
    IPManager,
    InterfaceManager,
    PrefixManager,
    DeviceManager
)
from services.nautobot.common.validators import *
from services.nautobot.common.utils import *

class DeviceCommonService:
    """
    Facade for backward compatibility.

    DEPRECATED: New code should inject specific resolvers/managers directly.
    This class will be removed in a future version.
    """

    def __init__(self, nautobot_service: NautobotService):
        self.nautobot = nautobot_service

        # Initialize resolvers
        self.device_resolver = DeviceResolver(nautobot_service)
        self.metadata_resolver = MetadataResolver(nautobot_service)
        self.network_resolver = NetworkResolver(nautobot_service)

        # Initialize managers
        self.ip_manager = IPManager(
            nautobot_service,
            self.network_resolver,
            self.metadata_resolver
        )
        self.interface_manager = InterfaceManager(
            nautobot_service,
            self.network_resolver,
            self.metadata_resolver,
            self.ip_manager
        )
        self.prefix_manager = PrefixManager(
            nautobot_service,
            self.network_resolver,
            self.metadata_resolver
        )
        self.device_manager = DeviceManager(
            nautobot_service,
            self.device_resolver,
            self.network_resolver
        )

    # Delegate all methods (examples)
    async def resolve_device_by_name(self, device_name: str) -> Optional[str]:
        return await self.device_resolver.resolve_device_by_name(device_name)

    async def ensure_ip_address_exists(self, *args, **kwargs):
        return await self.ip_manager.ensure_ip_address_exists(*args, **kwargs)

    # ... (all other methods follow same pattern)
```

---

## Implementation Steps

### Phase 1: Foundation (Pure Functions & Base Classes)

1. **Create package structure:**
   ```bash
   mkdir -p backend/services/nautobot/common
   mkdir -p backend/services/nautobot/resolvers
   mkdir -p backend/services/nautobot/managers
   touch backend/services/nautobot/common/__init__.py
   touch backend/services/nautobot/resolvers/__init__.py
   touch backend/services/nautobot/managers/__init__.py
   ```

2. **Create `common/exceptions.py`:**
   - Define exception hierarchy
   - Add utility function: `is_duplicate_error(error: Exception) -> bool`
   - Add utility function: `handle_already_exists_error(error, resource_type) -> Dict`

3. **Create `common/validators.py`:**
   - Extract pure validation functions from `common.py`
   - Remove `self` parameter, make them standalone
   - Add comprehensive type hints
   - Add docstrings with examples

4. **Create `common/utils.py`:**
   - Extract pure transformation functions
   - Remove `self` parameter
   - Add type hints and docstrings

5. **Update `common/__init__.py`:**
   ```python
   from .validators import *
   from .utils import *
   from .exceptions import *
   ```

### Phase 2: Resolvers (Read-Only Operations)

6. **Create `resolvers/base_resolver.py`:**
   - Implement `BaseResolver` with `_resolve_by_field()` and `_resolve_by_name()`
   - Add error handling with custom exceptions
   - Add logging

7. **Create resolver modules:**
   - `device_resolver.py` (extends `BaseResolver`)
   - `metadata_resolver.py` (extends `BaseResolver`)
   - `network_resolver.py` (extends `BaseResolver`)
   - Extract methods from `common.py`, removing `self.` → `self.nautobot.`

8. **Update `resolvers/__init__.py`:**
   ```python
   from .base_resolver import BaseResolver
   from .device_resolver import DeviceResolver
   from .metadata_resolver import MetadataResolver
   from .network_resolver import NetworkResolver

   __all__ = [
       "BaseResolver",
       "DeviceResolver",
       "MetadataResolver",
       "NetworkResolver"
   ]
   ```

### Phase 3: Managers (Write Operations)

9. **Create manager modules:**
   - `ip_manager.py`
   - `prefix_manager.py`
   - `device_manager.py`
   - Extract lifecycle methods from `common.py`
   - Inject resolver dependencies in `__init__`

10. **Refactor existing `interface_manager.py`:**
    - Move to `managers/interface_manager.py`
    - Update to use new resolver pattern
    - Inject dependencies instead of accessing globals

11. **Update `managers/__init__.py`:**
    ```python
    from .ip_manager import IPManager
    from .interface_manager import InterfaceManager
    from .prefix_manager import PrefixManager
    from .device_manager import DeviceManager

    __all__ = [
        "IPManager",
        "InterfaceManager",
        "PrefixManager",
        "DeviceManager"
    ]
    ```

### Phase 4: Facade Refactoring

12. **Update `devices/common.py`:**
    - **DO NOT delete the file**
    - Import new modules
    - Update `__init__` to instantiate resolvers and managers
    - Replace every method body with delegation call
    - Add deprecation warnings in docstrings

13. **Update `devices/__init__.py`:**
    ```python
    from .common import DeviceCommonService
    # Export for backward compatibility
    __all__ = ["DeviceCommonService"]
    ```

### Phase 5: Verification & Testing

14. **Run existing tests:**
    ```bash
    pytest backend/tests/services/nautobot/ -v
    ```
    - All tests should pass without modification
    - Facade ensures backward compatibility

15. **Add unit tests for new modules:**
    - `tests/services/nautobot/common/test_validators.py`
    - `tests/services/nautobot/common/test_utils.py`
    - `tests/services/nautobot/resolvers/test_device_resolver.py`
    - `tests/services/nautobot/managers/test_ip_manager.py`
    - Mock `NautobotService` using `pytest-mock`

16. **Integration testing:**
    - Test `DeviceImportService` end-to-end
    - Test `DeviceUpdateService` end-to-end
    - Verify no regressions

### Phase 6: Documentation

17. **Update documentation:**
    - Create `/doc/architecture/NAUTOBOT_SERVICES.md` explaining new structure
    - Update inline docstrings with examples
    - Add migration guide for consumers

18. **Code review checklist:**
    - [ ] All methods have type hints
    - [ ] All classes use dependency injection
    - [ ] No circular imports
    - [ ] Custom exceptions used consistently
    - [ ] Logging added for key operations
    - [ ] All tests pass

---

## Migration Path (Future Work)

**Goal:** Remove the facade and migrate consumers to direct injection.

### Step 1: Update `DeviceImportService`
```python
# OLD (via facade)
class DeviceImportService:
    def __init__(self, nautobot_service):
        self.common = DeviceCommonService(nautobot_service)

    async def import_device(self):
        device_id = await self.common.resolve_device_by_name(name)

# NEW (direct injection)
class DeviceImportService:
    def __init__(
        self,
        nautobot_service: NautobotService,
        device_resolver: DeviceResolver,
        ip_manager: IPManager
    ):
        self.nautobot = nautobot_service
        self.device_resolver = device_resolver
        self.ip_manager = ip_manager

    async def import_device(self):
        device_id = await self.device_resolver.resolve_device_by_name(name)
```

### Step 2: Update Router Dependency Injection
```python
# In backend/routers/nautobot.py
from services.nautobot.resolvers import DeviceResolver, MetadataResolver
from services.nautobot.managers import IPManager, DeviceManager

def get_device_resolver(
    nautobot: NautobotService = Depends(get_nautobot_service)
) -> DeviceResolver:
    return DeviceResolver(nautobot)

def get_ip_manager(
    nautobot: NautobotService = Depends(get_nautobot_service),
    network_resolver: NetworkResolver = Depends(get_network_resolver),
    metadata_resolver: MetadataResolver = Depends(get_metadata_resolver)
) -> IPManager:
    return IPManager(nautobot, network_resolver, metadata_resolver)

@router.post("/devices/import")
async def import_device(
    request: DeviceImportRequest,
    device_resolver: DeviceResolver = Depends(get_device_resolver),
    ip_manager: IPManager = Depends(get_ip_manager)
):
    # Use injected dependencies directly
    pass
```

### Step 3: Delete `DeviceCommonService`
Once all consumers are migrated:
```bash
git rm backend/services/nautobot/devices/common.py
```

---

## Benefits

### Immediate (Phase 1-4)
- ✅ **Single Responsibility:** Each module has one clear purpose
- ✅ **Testability:** Pure functions and dependency injection enable unit testing
- ✅ **Reusability:** Validators and utils can be imported anywhere
- ✅ **Maintainability:** ~1800 lines → 10 focused modules (~100-200 lines each)
- ✅ **Backward Compatibility:** Facade ensures zero breaking changes

### Future (Phase 6)
- ✅ **Performance:** Direct injection removes facade overhead
- ✅ **Type Safety:** Explicit types for all dependencies
- ✅ **Flexibility:** Can swap implementations (e.g., caching resolver)
- ✅ **Observability:** Clearer boundaries for logging/monitoring

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing consumers | Use facade pattern for backward compatibility |
| Circular imports | Strict dependency hierarchy: utils → resolvers → managers → facade |
| Test coverage gaps | Add unit tests for each new module before refactoring |
| Over-engineering | Start with minimal viable modules, iterate based on usage patterns |
| Incomplete migration | Document migration path clearly; deprecation warnings in facade |

---

## Success Metrics

- [ ] All existing tests pass without modification
- [ ] New modules have >80% test coverage
- [ ] `common.py` reduced from ~1800 → ~200 lines (facade only)
- [ ] No method has >50 lines of code
- [ ] Zero circular imports
- [ ] All classes use dependency injection
- [ ] Documentation complete with examples

---

## Open Questions

1. **Caching Strategy:** Should resolvers cache GraphQL responses? (e.g., device type IDs rarely change)
2. **Rate Limiting:** Should we add rate limiting to avoid overwhelming Nautobot API?
3. **Retry Logic:** Should managers implement automatic retry on transient failures?
4. **Async Batching:** Can we batch multiple GraphQL queries for performance?

---

## References

- **CLAUDE.md:** Project architectural standards
- **Existing Repositories:** `/backend/repositories/` for pattern examples
- **Pydantic Models:** `/backend/models/nautobot.py` for request/response schemas
- **Dependency Injection:** `/backend/routers/` for FastAPI dependency patterns
