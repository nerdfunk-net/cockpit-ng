# Refactoring Plan: Nautobot Device Common Service

## Execuitve Summary

The file `backend/services/nautobot/devices/common.py` has grown into a "God Object" (approx. 1800 lines) with mixed responsibilities. This plan proposes decomposing it into a structured package `backend/services/nautobot/common/` with specialized modules.

**Current Metrics:**
- **Lines:** ~1784
- **Classes:** 1 (`DeviceCommonService`)
- **Responsibilities:** ID resolution, Data validation, Data normalization, Resource lifecycle management (IPs, Interfaces, Prefixes), Device API interactions.

## Directory Structure

We will implement the following directory structure to lift generic capabilities out of `devices/` and into `common/`.

```text
backend/services/nautobot/
├── common/                          # [NEW] Shared Nautobot utilities package
│   ├── __init__.py                  # Exposes the new classes/functions
│   ├── validators.py                # Pure functions for validation (IPs, UUIDs)
│   ├── utils.py                     # Pure functions for data processing (flattening, tags)
│   ├── resolvers.py                 # Service for looking up UUIDs (Names, Statuses, Roles)
│   ├── resources.py                 # Service for managing dependent resources (IPs, Prefixes, Interfaces)
│   └── device_ops.py                # Device-specific operations (Primary IP, updates)
│
└── devices/
    ├── common.py                    # [EXISTING] Will be refactored to wrap the new modules (Facade)
    ├── ...                          # Other existing device services
```

## Dependency Analysis & Architecture

The current `DeviceCommonService` heavily relies on `self.nautobot` (the `NautobotService` instance) for API calls. To maintain testability and clean separation, we will use **Dependency Injection**.

We will create a new package directory: `backend/services/nautobot/common/`.

### 1. `validators.py` (Pure Functions)
**Responsibility:** Stateless validation logic. No dependencies on `NautobotService`.

*   **Imports**: `re`
*   **Functions**:
    *   `is_valid_uuid(uuid_str: str) -> bool` (Renamed from `_is_valid_uuid`)
    *   `validate_ip_address(ip: str) -> bool`
    *   `validate_mac_address(mac: str) -> bool`
    *   `validate_required_fields(data: Dict, required_fields: List[str]) -> None`
    *   `is_duplicate_error(error: Exception) -> bool`
    *   `handle_already_exists_error(error: Exception, resource_type: str) -> Dict`

### 2. `utils.py` (Pure Functions)
**Responsibility:** Data transformation and normalization. No dependencies on `NautobotService`.

*   **Functions**:
    *   `flatten_nested_fields(data: Dict) -> Dict`
    *   `extract_nested_value(data: Dict, path: str) -> Any`
    *   `normalize_tags(tags: Any) -> List[str]`
    *   `prepare_update_data(...) -> Tuple`

### 3. `resolvers.py` (Service Class)
**Responsibility:** Read-only operations to resolve names/identifiers to UUIDs.

*   **Class**: `NautobotResolver`
*   **Dependencies**: `NautobotService` (injected in `__init__`)
*   **Imports**: `validators` (for `is_valid_uuid`)
*   **Methods**:
    *   `__init__(self, nautobot_service: NautobotService)`
    *   `resolve_device_by_name`
    *   `resolve_device_by_ip`
    *   `resolve_device_id`
    *   `resolve_interface_by_name`
    *   `resolve_ip_address`
    *   `resolve_status_id`
    *   `resolve_namespace_id`
    *   `resolve_platform_id`
    *   `get_platform_name`
    *   `resolve_role_id`
    *   `resolve_location_id`
    *   `resolve_device_type_id`
    *   `get_device_type_display`

### 4. `resources.py` (Service Class)
**Responsibility:** Lifecycle management (Create/Update) for non-device resources (IPs, Prefixes, Interfaces).

*   **Class**: `NautobotResourceManager`
*   **Dependencies**: `NautobotService` (injected), `NautobotResolver` (injected)
*   **Imports**: `validators`, `utils`
*   **Methods**:
    *   `__init__(self, nautobot_service: NautobotService, resolver: NautobotResolver)`
    *   `ensure_ip_address_exists` (Uses `resolver.resolve_status_id`)
    *   `ensure_prefix_exists`
    *   `ensure_interface_exists`
    *   `assign_ip_to_interface`
    *   `ensure_interface_with_ip`
    *   `update_interface_ip`

### 5. `device_ops.py` (Service Class)
**Responsibility:** Direct operations on the Device model itself.

*   **Class**: `DeviceOperations`
*   **Dependencies**: `NautobotService` (injected)
*   **Methods**:
    *   `__init__(self, nautobot_service: NautobotService)`
    *   `get_device_details`
    *   `extract_primary_ip_address`
    *   `assign_primary_ip_to_device`
    *   `verify_device_updates`
    *   `find_interface_with_ip`

## Implementation Steps

1.  **Create Package Structure**:
    ```bash
    mkdir -p backend/services/nautobot/common
    touch backend/services/nautobot/common/__init__.py
    ```

2.  **Move Pure Functions**:
    *   Create `validators.py` and `utils.py`.
    *   Copy respective methods, removing `self` and making them standalone functions.

3.  **Create Service Classes**:
    *   Create `resolvers.py`. Instantiate `NautobotResolver` taking `nautobot_service`.
    *   Create `resources.py`. Instantiate `NautobotResourceManager` taking `nautobot_service` and `resolver`.
    *   Create `device_ops.py`. Instantiate `DeviceOperations`.

4.  **Refactor `DeviceCommonService` (The "Facade")**:
    *   **CRITICAL**: Do not delete `backend/services/nautobot/devices/common.py` yet.
    *   Modify `DeviceCommonService` to import the new classes.
    *   Update `__init__` to instantiate the new services:
        ```python
        def __init__(self, nautobot_service: NautobotService):
            self.nautobot = nautobot_service
            self.resolver = NautobotResolver(nautobot_service)
            self.resources = NautobotResourceManager(nautobot_service, self.resolver)
            self.device_ops = DeviceOperations(nautobot_service)
        ```
    *   Replace every method in `DeviceCommonService` with a delegation call:
        ```python
        async def resolve_device_by_name(self, device_name: str) -> Optional[str]:
            return await self.resolver.resolve_device_by_name(device_name)
        ```
    *   For pure functions, just wrap them:
        ```python
        def validate_ip_address(self, ip: str) -> bool:
            return validate_ip_address(ip)
        ```

5.  **Verification**:
    *   Since the public API signature of `DeviceCommonService` is unchanged, all existing tests and consumers (`DeviceImportService`, etc.) should pass without modification.
    *   We will run existing tests to confirm no regression.

## Future Work (Beyond this PR)

*   Update consumers (`DeviceImportService`) to inject `NautobotResolver` etc. directly.
*   Delete `DeviceCommonService` once all consumers are migrated.
