# Backup Tasks Refactoring Plan

**Date**: 2025-12-18  
**File**: `backend/tasks/backup_tasks.py`  
**Current Size**: 1,240 lines  
**Target**: Reduce to ~200-300 lines by extracting services

---

## Current Problems

1. **Massive functions** (backup_devices_task: ~700 lines)
2. **Code duplication** (GraphQL queries, device backup logic repeated)
3. **Business logic in tasks** (should be in services)
4. **Testing challenges** (large functions, many paths, side effects)
5. **Hard-coded mappings** (platform mapping at bottom of file)
6. **Violation of SRP** (tasks doing Git, Nautobot, SSH, file I/O, progress tracking)

---

## Phase 1: Extract Core Utilities and Models

### 1.1 Create `utils/netmiko_platform_mapper.py`
**Purpose**: Extract platform mapping logic  
**Status**: ✅ COMPLETED

```python
class NetmikoPlatformMapper:
    """Maps Nautobot platforms to Netmiko device types"""
    
    PLATFORM_MAP = {
        "ios": "cisco_ios",
        "cisco ios": "cisco_ios",
        # ... etc
    }
    
    @classmethod
    def map_to_netmiko(cls, platform: str) -> str
```

**Removes**: ~30 lines from backup_tasks.py

---

### 1.2 Create `models/backup_models.py`
**Purpose**: Pydantic models for type safety and validation  
**Status**: ✅ COMPLETED

```python
class DeviceBackupInfo(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    device_ip: Optional[str] = None
    platform: Optional[str] = None
    nautobot_fetch_success: bool = False
    ssh_connection_success: bool = False
    running_config_success: bool = False
    startup_config_success: bool = False
    running_config_bytes: int = 0
    startup_config_bytes: int = 0
    error: Optional[str] = None

class GitStatus(BaseModel):
    repository_existed: bool = False
    operation: Optional[str] = None
    repository_path: Optional[str] = None
    repository_url: Optional[str] = None
    branch: Optional[str] = None

class CredentialInfo(BaseModel):
    credential_id: Optional[int] = None
    credential_name: Optional[str] = None
    username: Optional[str] = None

class GitCommitStatus(BaseModel):
    committed: bool = False
    pushed: bool = False
    commit_hash: Optional[str] = None
    files_changed: int = 0

class TimestampUpdateStatus(BaseModel):
    enabled: bool = False
    custom_field_name: Optional[str] = None
    updated_count: int = 0
    failed_count: int = 0
    errors: List[str] = []
```

**Removes**: Repeated dictionary definitions (~50 lines across functions)

---

### 1.3 Create `services/device_config_service.py`
**Purpose**: Handle device config retrieval from Nautobot and network devices  
**Status**: ✅ COMPLETED

```python
class DeviceConfigService:
    """Service for retrieving device configurations"""
    
    # GraphQL query as class constant
    DEVICE_QUERY_FULL = """..."""
    DEVICE_QUERY_BASIC = """..."""
    
    def __init__(self):
        self.nautobot_service = NautobotService()
        self.netmiko_service = NetmikoService()
    
    def fetch_device_from_nautobot(
        self, 
        device_id: str, 
        full_details: bool = True
    ) -> Optional[dict]
    
    def retrieve_device_configs(
        self,
        device_ip: str,
        device_type: str,
        username: str,
        password: str
    ) -> dict
    
    def parse_config_output(
        self,
        command_outputs: dict,
        fallback_output: str
    ) -> tuple[str, str]
    
    def save_configs_to_disk(
        self,
        running_config: str,
        startup_config: str,
        device: dict,
        repo_path: Path,
        current_date: str,
        running_template: Optional[str] = None,
        startup_template: Optional[str] = None
    ) -> dict
```

**Removes**: ~200 lines from backup_tasks.py (GraphQL query + connection logic)

---

### 1.4 Create `utils/backup_path_generator.py`
**Purpose**: Generate backup file paths from templates  
**Status**: ✅ COMPLETED

```python
class BackupPathGenerator:
    """Generates backup file paths from templates or defaults"""
    
    @staticmethod
    def generate_running_config_path(
        device: dict,
        current_date: str,
        template: Optional[str] = None
    ) -> str
    
    @staticmethod
    def generate_startup_config_path(
        device: dict,
        current_date: str,
        template: Optional[str] = None
    ) -> str
    
    @staticmethod
    def generate_default_paths(
        device_name: str,
        current_date: str
    ) -> tuple[str, str]
```

**Removes**: ~40 lines from backup_tasks.py

---

### 1.5 Create `services/device_backup_service.py`
**Purpose**: Orchestrate device backup operations  
**Status**: ✅ COMPLETED

```python
class DeviceBackupService:
    """Service for device backup orchestration"""
    
    def __init__(self):
        self.config_service = DeviceConfigService()
        self.platform_mapper = NetmikoPlatformMapper()
        self.path_generator = BackupPathGenerator()
    
    def validate_backup_inputs(
        self,
        inventory: List[str],
        config_repository_id: int,
        credential_id: int
    ) -> tuple
    
    def backup_single_device(
        self,
        device_id: str,
        device_index: int,
        total_devices: int,
        repo_dir: Path,
        username: str,
        password: str,
        current_date: str,
        backup_running_config_path: Optional[str] = None,
        backup_startup_config_path: Optional[str] = None,
        job_run_id: Optional[int] = None
    ) -> DeviceBackupInfo
    
    def update_nautobot_timestamps(
        self,
        devices: List[dict],
        custom_field_name: str,
        backup_date: str
    ) -> TimestampUpdateStatus
    
    def prepare_backup_result(
        self,
        backed_up_devices: List[dict],
        failed_devices: List[dict],
        git_status: GitStatus,
        git_commit_status: GitCommitStatus,
        credential_info: CredentialInfo,
        timestamp_update_status: TimestampUpdateStatus,
        repository_name: str,
        commit_date: str
    ) -> dict
```

**Removes**: ~300 lines from backup_tasks.py

---

## Phase 2: Refactor Task Functions

### 2.1 Refactor `backup_single_device_task`
**Current**: ~350 lines  
**Target**: ~50 lines  
**Status**: 🔄 IN PROGRESS

**New structure**:
```python
@shared_task(name="tasks.backup_single_device_task", bind=True)
def backup_single_device_task(
    self,
    device_id: str,
    device_index: int,
    total_devices: int,
    repo_dir: str,
    username: str,
    password: str,
    current_date: str,
    backup_running_config_path: Optional[str] = None,
    backup_startup_config_path: Optional[str] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    # Update progress tracking (Celery-specific)
    if job_run_id:
        update_progress(job_run_id, device_index, total_devices)
    
    # Delegate to service
    backup_service = DeviceBackupService()
    result = backup_service.backup_single_device(
        device_id=device_id,
        device_index=device_index,
        total_devices=total_devices,
        repo_dir=Path(repo_dir),
        username=username,
        password=password,
        current_date=current_date,
        backup_running_config_path=backup_running_config_path,
        backup_startup_config_path=backup_startup_config_path,
        job_run_id=job_run_id
    )
    
    return result.dict()
```

---

### 2.2 Refactor `backup_devices_task`
**Current**: ~700 lines  
**Target**: ~150 lines  
**Status**: ⏳ PENDING

**New structure**:
```python
@shared_task(bind=True, name="tasks.backup_devices")
def backup_devices_task(
    self,
    inventory: Optional[List[str]] = None,
    config_repository_id: Optional[int] = None,
    credential_id: Optional[int] = None,
    write_timestamp_to_custom_field: Optional[bool] = False,
    timestamp_custom_field_name: Optional[str] = None,
    parallel_tasks: int = 1,
) -> dict:
    backup_service = DeviceBackupService()
    
    # Step 1: Validate inputs (delegated to service)
    repository, credential = backup_service.validate_backup_inputs(
        inventory, config_repository_id, credential_id
    )
    
    # Step 2: Setup Git repository (delegated to git_service)
    from services.git_service import git_service
    git_repo = git_service.open_or_clone(dict(repository))
    
    # Step 3: Execute backups
    if parallel_tasks > 1:
        results = execute_parallel_backups(...)
    else:
        results = execute_sequential_backups(...)
    
    # Step 4: Commit and push (delegated to git_service)
    git_commit_status = commit_and_push_changes(...)
    
    # Step 5: Update Nautobot (delegated to service)
    timestamp_status = backup_service.update_nautobot_timestamps(...)
    
    # Prepare final result
    return backup_service.prepare_backup_result(...)
```

---

### 2.3 Refactor `finalize_backup_task`
**Current**: ~170 lines  
**Target**: ~50 lines  
**Status**: ⏳ PENDING

**New structure**:
```python
@shared_task(name="tasks.finalize_backup_task")
def finalize_backup_task(
    device_results: List[Dict[str, Any]],
    repo_config: Dict[str, Any],
) -> Dict[str, Any]:
    backup_service = DeviceBackupService()
    
    # Separate results
    backed_up = [r for r in device_results if not r.get("error")]
    failed = [r for r in device_results if r.get("error")]
    
    # Commit and push (delegated)
    git_commit_status = commit_and_push_if_needed(backed_up, repo_config)
    
    # Update Nautobot timestamps (delegated)
    timestamp_status = backup_service.update_nautobot_timestamps(...)
    
    # Update job run
    update_job_run_if_needed(repo_config.get("job_run_id"), final_result)
    
    return final_result
```

---

## Phase 3: Add Tests

### 3.1 Unit Tests for Services
**Status**: ⏳ PENDING

- `tests/services/test_device_config_service.py`
- `tests/services/test_device_backup_service.py`
- `tests/utils/test_netmiko_platform_mapper.py`
- `tests/utils/test_backup_path_generator.py`

### 3.2 Integration Tests for Tasks
**Status**: ⏳ PENDING

- `tests/tasks/test_backup_tasks.py`

---

## Phase 4: Documentation and Cleanup

### 4.1 Update Documentation
**Status**: ⏳ PENDING

- Update BACKUP_WORKFLOW.md with new architecture
- Add docstrings to all new services
- Update README if needed

### 4.2 Remove Deprecated Code
**Status**: ⏳ PENDING

- Remove old commented code
- Clean up imports
- Verify all tests pass

---

## Success Metrics

- ✅ backup_tasks.py reduced from 1,240 → ~200-300 lines
- ✅ 4 new service files created
- ✅ 2 new utility modules created
- ✅ Pydantic models for type safety
- ✅ All tests passing
- ✅ No breaking changes to API
- ✅ Improved testability (services can be unit tested)
- ✅ Better separation of concerns

---

## Rollback Plan

If issues occur:
1. Keep original backup_tasks.py as `backup_tasks.py.backup`
2. New code in separate files - can be disabled without affecting old code
3. Use feature flags to switch between old/new implementations
4. Gradual migration: Start with sequential execution, then parallel

---

## Timeline

- **Phase 1**: 4-6 hours (Extract utilities and models)
- **Phase 2**: 6-8 hours (Refactor task functions)
- **Phase 3**: 4-6 hours (Add tests)
- **Phase 4**: 2-3 hours (Documentation)

**Total**: 16-23 hours

---

## Current Progress

- [x] Planning document created
- [ ] Phase 1.1: Platform mapper
- [ ] Phase 1.2: Pydantic models
- [ ] Phase 1.3: Device config service
- [ ] Phase 1.4: Path generator
- [ ] Phase 1.5: Device backup service
- [ ] Phase 2.1: Refactor backup_single_device_task
- [ ] Phase 2.2: Refactor backup_devices_task
- [ ] Phase 2.3: Refactor finalize_backup_task
- [ ] Phase 3: Tests
- [ ] Phase 4: Documentation
