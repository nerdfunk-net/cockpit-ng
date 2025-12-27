# Device Import & Update Services Refactoring Plan

## Overview

This refactoring consolidates device import and bulk-edit functionality into clean, reusable services with shared common utilities. The Celery tasks will become thin wrappers that handle CSV parsing and async job management, while services handle all business logic, validation, and Nautobot API interactions.

---

## Architecture Design

### **Service Layer Structure**

```
backend/services/
├── device_common_service.py      # Shared utilities (NEW)
├── device_import_service.py      # Import service (NEW)
├── device_update_service.py      # Update service (NEW)
└── nautobot.py                   # Existing Nautobot client
```

### **Task Layer Structure** (Thin Wrappers)

```
backend/tasks/
├── import_devices_task.py        # CSV → Import Service (NEW/REFACTORED)
├── update_devices_task.py        # CSV → Update Service (REFACTORED)
└── export_devices_task.py        # Existing (unchanged)
```

### **Data Flow**

```
Frontend
    ↓
Celery API Router (/api/celery/tasks/...)
    ↓
Celery Task (CSV parsing, progress tracking)
    ↓
Service Layer (validation, business logic)
    ↓
Common Service (shared utilities)
    ↓
Nautobot API (GraphQL/REST)
```

---

## Component Design

### **1. Common Service** (`device_common_service.py`)

**Purpose**: Shared utilities used by both import and update services

**Responsibilities**:
- Name-to-UUID resolution (devices, platforms, statuses, namespaces, etc.)
- GraphQL query builders
- Data validation helpers
- Error handling patterns
- API response parsing

**Key Methods**:

```python
class DeviceCommonService:
    def __init__(self, nautobot_service: NautobotService):
        self.nautobot = nautobot_service

    # Resolution Methods
    async def resolve_device_by_name(self, device_name: str) -> Optional[str]
    async def resolve_device_by_ip(self, ip_address: str) -> Optional[str]
    async def resolve_status_id(self, status_name: str, content_type: str) -> str
    async def resolve_namespace_id(self, namespace_name: str) -> str
    async def resolve_platform_id(self, platform_name: str) -> Optional[str]
    async def resolve_role_id(self, role_name: str) -> Optional[str]
    async def resolve_location_id(self, location_name: str) -> Optional[str]
    async def resolve_device_type_id(self, model: str, manufacturer: str) -> Optional[str]

    # Validation Methods
    def validate_required_fields(self, data: dict, required_fields: List[str]) -> None
    def validate_ip_address(self, ip: str) -> bool
    def validate_mac_address(self, mac: str) -> bool

    # Data Processing
    def flatten_nested_fields(self, data: dict) -> dict
    def extract_nested_value(self, data: dict, path: str) -> Any
    def normalize_tags(self, tags: Any) -> List[str]

    # Interface/IP Helpers
    async def ensure_ip_address_exists(
        self,
        ip_address: str,
        namespace_id: str,
        **kwargs
    ) -> str  # Returns IP UUID

    async def ensure_interface_exists(
        self,
        device_id: str,
        interface_name: str,
        **kwargs
    ) -> str  # Returns interface UUID

    async def assign_ip_to_interface(
        self,
        ip_id: str,
        interface_id: str
    ) -> dict

    # Error Handling
    def handle_already_exists_error(self, error: Exception, resource_type: str) -> dict
    def is_duplicate_error(self, error: Exception) -> bool
```

**Data Sources**:
- Current validation logic from `update_devices_task.py` (lines 325-820)
- Resolution logic from `device_creation_service.py`
- Helper functions from both import and update workflows

---

### **2. Import Service** (`device_import_service.py`)

**Purpose**: Create new devices in Nautobot with interfaces and IPs

**Responsibilities**:
- Validate import data for required fields
- Convert names to UUIDs using common service
- Create devices via REST API
- Create interfaces and IP addresses
- Assign primary IP to device
- Handle "already exists" errors gracefully

**Key Methods**:

```python
class DeviceImportService:
    def __init__(self, nautobot_service: NautobotService):
        self.nautobot = nautobot_service
        self.common = DeviceCommonService(nautobot_service)

    async def import_device(
        self,
        device_data: dict,
        interface_config: Optional[dict] = None,
        skip_if_exists: bool = False
    ) -> dict:
        """
        Import a single device with optional interface configuration.

        Returns:
            {
                "success": bool,
                "device_id": str,
                "device_name": str,
                "message": str,
                "created": bool,  # False if already existed
                "warnings": List[str]
            }
        """

    async def validate_import_data(self, device_data: dict) -> dict:
        """
        Validate device data before import.

        Required fields:
        - name
        - device_type (or device_type_id)
        - role (or role_id)
        - location (or location_id)
        - status (or status_id)

        Returns validated data with UUIDs resolved.
        """

    async def _create_device(self, validated_data: dict) -> str:
        """Create device in Nautobot, returns device UUID"""

    async def _create_device_interfaces(
        self,
        device_id: str,
        interface_config: dict
    ) -> dict:
        """
        Create interfaces and IP addresses for device.

        Returns:
            {
                "interfaces": List[str],  # Interface UUIDs
                "ip_addresses": List[str],  # IP UUIDs
                "primary_ip": Optional[str]
            }
        """

    async def _assign_primary_ip(
        self,
        device_id: str,
        ip_id: str
    ) -> None:
        """Assign primary IPv4 to device"""
```

**Data Sources**:
- `device_creation_service.py` (lines 80-400) - Direct device creation workflow
- `update_devices_task.py` (lines 583-700) - Interface/IP creation logic
- Validation patterns from bulk onboarding

---

### **3. Update Service** (`device_update_service.py`)

**Purpose**: Update existing devices in Nautobot

**Responsibilities**:
- Validate update data
- Resolve device by ID/name/IP
- Convert field names to UUIDs
- Update device properties via PATCH
- Update/create interfaces and IPs if needed
- Update tags and custom fields

**Key Methods**:

```python
class DeviceUpdateService:
    def __init__(self, nautobot_service: NautobotService):
        self.nautobot = nautobot_service
        self.common = DeviceCommonService(nautobot_service)

    async def update_device(
        self,
        device_identifier: dict,  # {id: ..., name: ..., or ip_address: ...}
        update_data: dict,
        interface_config: Optional[dict] = None,
        create_if_missing: bool = False
    ) -> dict:
        """
        Update a single device.

        Returns:
            {
                "success": bool,
                "device_id": str,
                "device_name": str,
                "message": str,
                "updated_fields": List[str],
                "warnings": List[str]
            }
        """

    async def validate_update_data(
        self,
        device_identifier: dict,
        update_data: dict
    ) -> Tuple[str, dict]:
        """
        Validate update data and resolve device ID.

        Returns: (device_id, validated_update_data)
        """

    async def _resolve_device_id(
        self,
        device_identifier: dict
    ) -> Optional[str]:
        """
        Resolve device UUID from identifier.

        Accepts:
        - {id: "uuid"}
        - {name: "device-name"}
        - {ip_address: "10.0.0.1"}
        """

    async def _update_device_properties(
        self,
        device_id: str,
        update_data: dict
    ) -> dict:
        """PATCH device with validated data"""

    async def _update_device_interfaces(
        self,
        device_id: str,
        interface_config: dict
    ) -> dict:
        """Update or create interfaces for device"""

    async def _verify_updates(
        self,
        device_id: str,
        expected_updates: dict
    ) -> bool:
        """Verify updates were applied successfully"""
```

**Data Sources**:
- `update_devices_task.py` (lines 325-900) - All update logic
- Interface/IP handling patterns
- Tag and custom field update logic

---

## Detailed Implementation Plan

### **Phase 1: Common Service Implementation**

**File**: `/backend/services/device_common_service.py`

**Extract from**:
- `update_devices_task.py`:
  - `_resolve_device_id()` → `resolve_device_by_name()` + `resolve_device_by_ip()`
  - `_resolve_status_id()` → `resolve_status_id()`
  - `_resolve_namespace_id()` → `resolve_namespace_id()`
  - Platform/role/location resolution logic (inline code) → dedicated methods

- `device_creation_service.py`:
  - IP creation logic (lines 250-280) → `ensure_ip_address_exists()`
  - Interface creation logic (lines 310-370) → `ensure_interface_exists()`
  - IP-to-interface assignment (lines 380-400) → `assign_ip_to_interface()`

- Common patterns:
  - GraphQL query builders
  - "Already exists" error handling
  - Name normalization (tags, nested fields)

**New utilities**:
- Field validation helpers
- Data structure normalization
- Error message formatting

---

### **Phase 2: Import Service Implementation**

**File**: `/backend/services/device_import_service.py`

**Based on**: `device_creation_service.py` workflow

**Methods**:

1. **`validate_import_data(device_data)`**:
   - Check required fields: name, device_type, role, location, status
   - Resolve all names to UUIDs using `common` service
   - Validate data types and formats
   - Return validated dict with UUIDs

2. **`_create_device(validated_data)`**:
   - Extract from `device_creation_service.py._step1_create_device()`
   - POST to `/dcim/devices/`
   - Handle duplicate errors (skip or raise based on config)
   - Return device UUID

3. **`_create_device_interfaces(device_id, interface_config)`**:
   - Extract from `device_creation_service.py._step2_create_ip_addresses()` and `_step3_create_interfaces()`
   - For each interface in config:
     - Create IP address (if specified)
     - Create interface
     - Assign IP to interface
   - Handle LAG dependencies
   - Return created resource UUIDs

4. **`_assign_primary_ip(device_id, ip_id)`**:
   - Extract from `device_creation_service.py._step4_assign_primary_ip()`
   - PATCH device with primary_ip4

5. **`import_device(device_data, interface_config, skip_if_exists)`**:
   - Orchestrate full workflow
   - Call methods in sequence
   - Collect warnings and errors
   - Return comprehensive result dict

**Error Handling**:
- "Already exists" → Skip or update based on flag
- Validation errors → Raise with clear messages
- Partial success → Return warnings in result

---

### **Phase 3: Update Service Implementation**

**File**: `/backend/services/device_update_service.py`

**Based on**: `update_devices_task.py` logic

**Methods**:

1. **`_resolve_device_id(device_identifier)`**:
   - Extract from `update_devices_task.py._resolve_device_id()`
   - Support resolution by ID, name, or IP
   - Use `common.resolve_device_by_name()` and `common.resolve_device_by_ip()`
   - Raise clear error if device not found

2. **`validate_update_data(device_identifier, update_data)`**:
   - Resolve device ID
   - Convert all name fields to UUIDs:
     - status → status_id
     - platform → platform_id
     - location → location_id
     - role → role_id
     - device_type → device_type_id
   - Extract interface config from update_data
   - Return (device_id, validated_data, interface_config)

3. **`_update_device_properties(device_id, update_data)`**:
   - Extract from `update_devices_task.py._update_device_in_nautobot()`
   - Handle special case: `primary_ip4` (ensure interface exists first)
   - PATCH device with validated data
   - Return updated fields

4. **`_update_device_interfaces(device_id, interface_config)`**:
   - Extract from `update_devices_task.py._ensure_interface_with_ip()`
   - Check if interface exists
   - Create if missing
   - Assign/update IP address
   - Use `common` service for helper operations

5. **`_verify_updates(device_id, expected_updates)`**:
   - GET device from Nautobot
   - Compare actual vs expected values
   - Return verification result

6. **`update_device(device_identifier, update_data, interface_config, create_if_missing)`**:
   - Orchestrate full workflow
   - Optionally create device if missing (calls import service)
   - Collect warnings
   - Return comprehensive result dict

**Special Handling**:
- Tags: Normalize to list, PATCH separately if needed
- Custom fields: Extract `cf_*` prefix, update via PATCH
- Nested fields: Flatten before update (e.g., `platform.name` → `platform_id`)

---

### **Phase 4: Refactor Celery Tasks**

#### **A. Update Task** (`update_devices_task.py`)

**Before** (900+ lines):
- CSV parsing
- Data validation
- Name resolution
- Device updates
- Progress tracking

**After** (~200 lines):
```python
from services.device_update_service import DeviceUpdateService
from services.nautobot import NautobotService

@shared_task(bind=True)
def update_devices_from_csv_task(self, file_path, options):
    # Parse CSV
    devices_data = _parse_csv(file_path, options)

    # Initialize service
    nautobot_service = NautobotService()
    update_service = DeviceUpdateService(nautobot_service)

    # Process each device
    results = []
    for idx, row_data in enumerate(devices_data):
        # Update progress
        self.update_state(state="PROGRESS", meta={...})

        # Extract device identifier and update data
        device_id, update_data, interface_config = _prepare_row_data(row_data)

        # Call service
        try:
            result = await update_service.update_device(
                device_identifier=device_id,
                update_data=update_data,
                interface_config=interface_config
            )
            results.append(result)
        except Exception as e:
            results.append({"success": False, "error": str(e)})

    return {"results": results, "total": len(devices_data)}
```

**Task responsibilities**:
- CSV parsing and structure validation
- Progress updates to Celery
- Dry-run mode handling
- Result aggregation
- Error collection

**Service responsibilities** (moved out):
- Data validation
- Name-to-UUID conversion
- Nautobot API calls
- Business logic

#### **B. Import Task** (NEW/REFACTORED)

**Create new**: `/backend/tasks/import_devices_task.py`

**Based on**:
- CSV structure from `export_devices_task.py`
- Device creation from `device_creation_service.py`
- Workflow pattern from `update_devices_task.py`

```python
from services.device_import_service import DeviceImportService
from services.nautobot import NautobotService

@shared_task(bind=True)
def import_devices_from_csv_task(self, file_path, options):
    # Parse CSV
    devices_data = _parse_csv(file_path, options)

    # Initialize service
    nautobot_service = NautobotService()
    import_service = DeviceImportService(nautobot_service)

    # Process each device
    results = []
    for idx, row_data in enumerate(devices_data):
        # Update progress
        self.update_state(state="PROGRESS", meta={...})

        # Extract device data and interface config
        device_data, interface_config = _prepare_device_data(row_data)

        # Call service
        try:
            result = await import_service.import_device(
                device_data=device_data,
                interface_config=interface_config,
                skip_if_exists=options.get("skip_duplicates", False)
            )
            results.append(result)
        except Exception as e:
            results.append({"success": False, "error": str(e)})

    return {"results": results, "total": len(devices_data)}
```

---

### **Phase 5: Router Integration**

**File**: `/backend/routers/celery_api.py`

**Add new endpoint**:

```python
@router.post("/tasks/import-devices-from-csv")
async def import_devices_from_csv(
    request: Request,
    current_user: dict = Depends(require_permission("devices", "write"))
):
    """
    Import new devices from CSV file.

    Expects multipart/form-data with:
    - file: CSV file
    - options: JSON string with import options
    """
    # Parse request
    form = await request.form()
    file = form.get("file")
    options = json.loads(form.get("options", "{}"))

    # Save CSV temporarily
    file_path = await _save_uploaded_file(file)

    # Create job run for tracking
    job_run_id = job_run_manager.create_job_run(
        name="Import Devices from CSV",
        user=current_user["username"]
    )

    # Trigger Celery task
    task = import_devices_from_csv_task.apply_async(
        args=[file_path, options],
        task_id=str(job_run_id)
    )

    return {
        "task_id": task.id,
        "job_run_id": job_run_id,
        "status": "started"
    }
```

**Update existing endpoint** (`update-devices-from-csv`):
- No changes to endpoint signature
- Task implementation changes are transparent

---

## File Structure After Refactoring

```
backend/
├── services/
│   ├── device_common_service.py       # NEW - Shared utilities
│   ├── device_import_service.py       # NEW - Import logic
│   ├── device_update_service.py       # NEW - Update logic
│   ├── device_creation_service.py     # EXISTING - May be deprecated/merged
│   └── nautobot.py                    # EXISTING - Unchanged
│
├── tasks/
│   ├── import_devices_task.py         # NEW - Import CSV task (thin wrapper)
│   ├── update_devices_task.py         # REFACTORED - Update CSV task (thin wrapper)
│   ├── export_devices_task.py         # EXISTING - Unchanged
│   ├── bulk_onboard_task.py           # EXISTING - Different workflow (unchanged)
│   └── onboard_device_task.py         # EXISTING - Different workflow (unchanged)
│
├── routers/
│   └── celery_api.py                  # UPDATED - Add import endpoint
│
└── models/
    └── device_operations.py            # NEW (optional) - Pydantic models
```

---

## Testing Strategy

### **Unit Tests**

1. **`test_device_common_service.py`**:
   - Test each resolution method
   - Test validation helpers
   - Mock Nautobot API responses

2. **`test_device_import_service.py`**:
   - Test import workflow
   - Test validation
   - Test error handling (duplicates, missing fields)
   - Test interface creation

3. **`test_device_update_service.py`**:
   - Test update workflow
   - Test device resolution (by ID/name/IP)
   - Test field updates
   - Test interface updates

### **Integration Tests**

1. **CSV Import Flow**:
   - Upload CSV → Parse → Import → Verify in Nautobot

2. **CSV Update Flow**:
   - Upload CSV → Parse → Update → Verify changes

3. **Error Cases**:
   - Invalid CSV structure
   - Missing required fields
   - Duplicate devices
   - Network errors

### **Manual Testing Checklist**

- [ ] Import single device with no interfaces
- [ ] Import single device with one interface
- [ ] Import single device with multiple interfaces
- [ ] Import duplicate device (skip mode)
- [ ] Import duplicate device (error mode)
- [ ] Update existing device properties
- [ ] Update device interfaces
- [ ] Update device tags
- [ ] Update device custom fields
- [ ] Dry-run mode for both import and update
- [ ] Progress tracking in UI
- [ ] Error messages are clear and actionable

---

## Migration Strategy

### **Step 1: Implement Services (No Breaking Changes)**
- Create new service files
- Services can coexist with old task code
- No impact on existing functionality

### **Step 2: Refactor Update Task**
- Update `update_devices_task.py` to use new services
- Keep same Celery task signature
- Frontend sees no changes

### **Step 3: Create Import Task & Endpoint**
- Add new task and router endpoint
- Frontend can start using when ready
- No impact on existing flows

### **Step 4: Deprecate Old Code (Optional)**
- Mark `device_creation_service.py` as deprecated if fully replaced
- Remove dead code from tasks
- Update documentation

---

## Benefits of This Refactoring

### **Code Quality**
✅ **Single Responsibility**: Each service has one clear purpose
✅ **DRY**: No duplicate validation/resolution logic
✅ **Testability**: Services can be unit tested independently
✅ **Maintainability**: Business logic separated from infrastructure

### **Flexibility**
✅ **Reusability**: Services can be used by other tasks/endpoints
✅ **Composability**: Services can call each other
✅ **Extensibility**: Easy to add new import/update sources (API, UI forms, etc.)

### **Performance**
✅ **Async/Await**: Services are async-ready
✅ **Batch Operations**: Can extend services to support batch mode
✅ **Caching**: Common service can cache resolution lookups

### **Developer Experience**
✅ **Clear Boundaries**: Task vs Service responsibilities obvious
✅ **Type Safety**: Pydantic models for data validation
✅ **Error Messages**: Consistent, actionable error handling
✅ **Documentation**: Self-documenting method signatures

---

## Implementation Timeline

### **Phase 1: Foundation** (Est. 1-2 days)
- [ ] Create `device_common_service.py` skeleton
- [ ] Extract and test resolution methods
- [ ] Extract and test validation helpers
- [ ] Add comprehensive docstrings

### **Phase 2: Import Service** (Est. 1-2 days)
- [ ] Create `device_import_service.py`
- [ ] Implement device creation workflow
- [ ] Implement interface creation
- [ ] Add validation and error handling
- [ ] Write unit tests

### **Phase 3: Update Service** (Est. 1-2 days)
- [ ] Create `device_update_service.py`
- [ ] Implement device resolution
- [ ] Implement update workflow
- [ ] Implement interface updates
- [ ] Write unit tests

### **Phase 4: Task Refactoring** (Est. 1 day)
- [ ] Refactor `update_devices_task.py`
- [ ] Create `import_devices_task.py`
- [ ] Add router endpoint for import
- [ ] Test Celery integration

### **Phase 5: Testing & Documentation** (Est. 1 day)
- [ ] Integration tests
- [ ] Manual testing with real Nautobot instance
- [ ] Update documentation
- [ ] Code review

**Total Estimated Effort**: 5-7 days

---

## Success Criteria

- [ ] All existing bulk-edit functionality works unchanged
- [ ] New import functionality matches device creation service behavior
- [ ] No code duplication between import and update services
- [ ] Common service is used by both services
- [ ] Celery tasks are < 200 lines (thin wrappers)
- [ ] Services have > 80% test coverage
- [ ] All tests pass
- [ ] Documentation is complete
- [ ] Frontend integration works (same API endpoints)

---

## Open Questions / Decisions Needed

1. **Pydantic Models**: Should we create strict Pydantic models for service inputs/outputs?
   - Pro: Type safety, automatic validation
   - Con: More boilerplate

2. **Service Dependency Injection**: Should services receive NautobotService via constructor or use singleton?
   - Current plan: Constructor injection (better for testing)

3. **Error Handling Strategy**: Should services raise exceptions or return Result objects?
   - Current plan: Raise exceptions for errors, return dicts with warnings

4. **Backwards Compatibility**: Should we keep `device_creation_service.py` or deprecate it?
   - Recommendation: Keep for now, deprecate in future release

5. **Batch Mode**: Should services support batch operations natively or only via tasks?
   - Current plan: Single-device mode only, tasks handle batching

---

## Next Steps

1. **Review this plan** - Get feedback and approval
2. **Set up development branch** - `feature/device-services-refactor`
3. **Start with Phase 1** - Common service foundation
4. **Iterate with testing** - Test after each phase
5. **Merge when stable** - After all success criteria met

---

## Notes

- This refactoring **does not change** the onboarding workflow (that's separate)
- CSV parsing remains in tasks (not moved to services)
- Frontend continues using same endpoints (transparent changes)
- Services are designed for future expansion (API endpoints, UI forms, webhooks, etc.)
- Common service can be extended for other device operations (delete, clone, etc.)
