# Service Layer Architecture Documentation

## Overview

The backup system follows a **Service Layer Architecture** pattern, separating business logic from task orchestration. This design improves testability, maintainability, and code reusability.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Celery Tasks Layer                        │
│              (Orchestration & Task Management)               │
│                                                              │
│  tasks/backup_tasks.py                                      │
│  ├── backup_single_device_task (thin wrapper)              │
│  ├── backup_devices_task (orchestrates workflow)           │
│  └── finalize_backup_task (commit & finalize)              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                              │
│              (Business Logic & Operations)                   │
│                                                              │
│  services/device_backup_service.py                          │
│  ├── validate_backup_inputs()                              │
│  ├── backup_single_device()                                │
│  ├── update_nautobot_timestamps()                          │
│  └── prepare_backup_result()                               │
│                                                              │
│  services/device_config_service.py                          │
│  ├── fetch_device_from_nautobot()                          │
│  ├── retrieve_device_configs()                             │
│  ├── parse_config_output()                                 │
│  └── save_configs_to_disk()                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Models Layer                         │
│              (Type Safety & Validation)                      │
│                                                              │
│  models/backup_models.py                                    │
│  ├── DeviceBackupInfo                                       │
│  ├── GitStatus                                              │
│  ├── CredentialInfo                                         │
│  ├── GitCommitStatus                                        │
│  ├── TimestampUpdateStatus                                  │
│  └── BackupResult                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                External Systems Layer                        │
│              (APIs & Infrastructure)                         │
│                                                              │
│  ├── Nautobot (GraphQL API)                                │
│  ├── SSH/Netmiko (Device Connections)                      │
│  ├── Git (Version Control)                                 │
│  └── File System (Config Storage)                          │
└─────────────────────────────────────────────────────────────┘
```

## Design Principles

### 1. Separation of Concerns

Each layer has a single, well-defined responsibility:

- **Tasks Layer**: Celery orchestration, progress tracking, error handling
- **Service Layer**: Business logic, validation, data transformations
- **Models Layer**: Data structures, validation rules, serialization
- **External Systems**: Infrastructure interactions (APIs, SSH, Git, FS)

### 2. Dependency Injection

Services receive their dependencies through constructor injection:

```python
class DeviceBackupService:
    def __init__(
        self,
        device_config_service: DeviceConfigService,
        nautobot_service: NautobotService,
    ):
        self.device_config_service = device_config_service
        self.nautobot_service = nautobot_service
```

**Benefits**:
- Easy to mock dependencies in tests
- Flexible configuration
- Clear dependency graph

### 3. Type Safety with Pydantic

All data structures use Pydantic models for automatic validation:

```python
class DeviceBackupInfo(BaseModel):
    device_id: str
    device_name: str
    device_ip: str
    platform: str
    location_hierarchy: List[str]
    device_role: str
```

**Benefits**:
- Runtime validation
- IDE autocomplete
- Automatic serialization/deserialization
- Self-documenting code

### 4. Immutable Data Flow

Data flows unidirectionally through the layers:

```
Input → Validation → Processing → Output
```

No side effects in service methods (except I/O operations).

## Component Responsibilities

### DeviceConfigService

**Purpose**: Handle device configuration retrieval operations

**Responsibilities**:
- Fetch device metadata from Nautobot (GraphQL)
- Establish SSH connections to devices
- Execute configuration retrieval commands
- Parse and clean configuration output
- Save configurations to file system

**Dependencies**:
- NautobotService (GraphQL client)
- NetmikoService (SSH client)
- NetmikoPlatformMapper (platform normalization)

**Key Methods**:
```python
fetch_device_from_nautobot(device_id) → DeviceBackupInfo | None
retrieve_device_configs(device_info, credential) → Dict[str, str] | None
parse_config_output(output) → str
save_configs_to_disk(device_info, configs, base_path, date_str) → bool
```

### DeviceBackupService

**Purpose**: Orchestrate high-level backup workflows

**Responsibilities**:
- Validate backup inputs (credentials, repositories)
- Coordinate single-device backup operations
- Update Nautobot custom fields with timestamps
- Prepare backup results for task responses

**Dependencies**:
- DeviceConfigService (config operations)
- NautobotService (Nautobot REST API)

**Key Methods**:
```python
validate_backup_inputs(credential, repository) → Tuple[CredentialInfo, Dict] | None
backup_single_device(device_info, credential, base_path, date_str) → Dict
update_nautobot_timestamps(backed_up_devices, write_timestamp, field_name) → TimestampUpdateStatus
prepare_backup_result(backed_up, failed, git_status, ...) → Dict
```

## Data Flow Examples

### Single Device Backup Flow

```
1. Celery Task receives device_id
   └─> backup_single_device_task(device_id, credential, repo, ...)

2. Task creates service instance
   └─> backup_service = DeviceBackupService()

3. Service fetches device info
   └─> device_info = config_service.fetch_device_from_nautobot(device_id)
   
4. Service retrieves configs
   └─> configs = config_service.retrieve_device_configs(device_info, credential)
   
5. Service saves configs to disk
   └─> success = config_service.save_configs_to_disk(device_info, configs, ...)
   
6. Service prepares result
   └─> result = {"success": True, "device_id": ..., "configs": ...}
   
7. Task returns result
   └─> return result
```

### Parallel Backup Flow

```
1. Main task receives device_ids list
   └─> backup_devices_task(device_ids=["dev1", "dev2", "dev3"], ...)

2. Task validates inputs
   └─> credential_info, repo = backup_service.validate_backup_inputs(...)

3. Task sets up Git repository
   └─> git_repo, error = git_service.setup_repository(repo)

4. Task creates parallel subtasks
   └─> tasks = [backup_single_device_task.s(dev_id, ...) for dev_id in device_ids]

5. Task launches chord (parallel + callback)
   └─> chord(tasks)(finalize_backup_task.s(repo_config))

6. Each subtask executes independently
   ├─> backup_single_device_task("dev1") → result1
   ├─> backup_single_device_task("dev2") → result2
   └─> backup_single_device_task("dev3") → result3

7. Finalize task collects results
   └─> finalize_backup_task([result1, result2, result3], repo_config)

8. Finalize commits & pushes to Git
   └─> git_service.commit_and_push(repo, message="Backup config 2024-01-01")

9. Finalize updates Nautobot
   └─> backup_service.update_nautobot_timestamps(backed_up_devices, ...)

10. Task returns final summary
    └─> return {backed_up_count, failed_count, git_status, ...}
```

## Error Handling Strategy

### Service Layer

Services **log errors** but **don't raise exceptions**. Instead, they return `None` or error dictionaries:

```python
def fetch_device_from_nautobot(self, device_id: str) -> Optional[DeviceBackupInfo]:
    try:
        # ... fetch device ...
        return device_info
    except Exception as e:
        logger.error(f"Failed to fetch device: {e}")
        return None  # Graceful degradation
```

**Rationale**: Allows partial success in batch operations.

### Task Layer

Tasks **catch exceptions** and return error status in result dict:

```python
try:
    result = backup_service.backup_single_device(...)
    return result
except Exception as e:
    logger.error(f"Task failed: {e}")
    return {"success": False, "error": str(e)}
```

**Rationale**: Celery tasks should not crash; errors are part of the result.

## Testing Strategy

### Unit Tests

Test services in isolation with mocked dependencies:

```python
def test_backup_single_device_success(mock_device_config_service):
    service = DeviceBackupService(device_config_service=mock_device_config_service)
    
    mock_device_config_service.retrieve_device_configs.return_value = {"running-config": "..."}
    
    result = service.backup_single_device(device_info, credential, "/tmp", "2024-01-01")
    
    assert result["success"] is True
```

### Integration Tests

Test tasks with mocked external systems:

```python
@patch("tasks.backup_tasks.DeviceBackupService")
@patch("tasks.backup_tasks.git_service")
def test_backup_devices_task(mock_git, mock_service):
    result = backup_devices_task(device_ids=["dev1"], ...)
    
    assert mock_service.validate_backup_inputs.called
    assert mock_git.setup_repository.called
```

## Performance Considerations

### Parallel Execution

Use Celery chord for parallel device backups:

```python
# Sequential (slow for many devices)
for device_id in device_ids:
    backup_single_device(device_id)

# Parallel (fast, limited by worker count)
tasks = [backup_single_device_task.s(device_id) for device_id in device_ids]
chord(tasks)(finalize_callback.s())
```

### Caching

Services don't implement caching. Caching should be added at:
- Nautobot API client level (GraphQL query cache)
- Credential manager level (encrypted credential cache)

### Resource Limits

- **SSH connections**: Netmiko uses single connection per device
- **File I/O**: Configurations written to disk sequentially
- **Git operations**: Single commit for entire backup batch

## Extension Points

### Adding New Device Types

1. Add platform mapping in `NetmikoPlatformMapper`:
```python
PLATFORM_MAP = {
    ...
    "new_platform": "netmiko_device_type",
}
```

2. No changes needed in services (abstracted away)

### Adding New Configuration Types

1. Update `retrieve_device_configs` commands list:
```python
commands = [
    "show running-config",
    "show startup-config",
    "show version",  # New command
]
```

2. Update `save_configs_to_disk` to handle new config type

### Adding Custom Validation

1. Extend `DeviceBackupInfo` model:
```python
class DeviceBackupInfo(BaseModel):
    ...
    custom_field: Optional[str] = None
    
    @validator("custom_field")
    def validate_custom_field(cls, v):
        # Custom validation logic
        return v
```

## Best Practices

### Service Methods

✅ **DO**:
- Keep methods focused (single responsibility)
- Return typed objects (Pydantic models) or None
- Log all important operations
- Handle errors gracefully

❌ **DON'T**:
- Raise exceptions for expected failures
- Mix business logic with task orchestration
- Access Celery context from services
- Use global state

### Task Methods

✅ **DO**:
- Delegate business logic to services
- Handle Celery-specific concerns (progress, retries)
- Return standardized result dictionaries
- Catch and log all exceptions

❌ **DON'T**:
- Put business logic in tasks
- Ignore service return values
- Let exceptions crash tasks
- Bypass service layer

### Data Models

✅ **DO**:
- Use Pydantic BaseModel for all data structures
- Define optional fields with Optional[T]
- Add validators for complex rules
- Use model_dump() for serialization

❌ **DON'T**:
- Use plain dictionaries for structured data
- Skip type hints
- Mutate model instances
- Bypass validation

## Migration Guide

### From Old Code to Service Layer

**Old Pattern** (business logic in task):
```python
@shared_task
def backup_device(device_id):
    # GraphQL query here
    device_data = nautobot_service.execute_graphql_query(...)
    
    # SSH connection here
    conn = netmiko_service.connect_to_device(...)
    
    # Config retrieval here
    config = conn.send_command("show running-config")
    
    # File saving here
    with open(f"/configs/{device_id}.txt", "w") as f:
        f.write(config)
    
    return {"success": True}
```

**New Pattern** (thin task, service handles logic):
```python
@shared_task
def backup_device(device_id):
    service = DeviceBackupService()
    
    device_info = service.config_service.fetch_device_from_nautobot(device_id)
    result = service.backup_single_device(device_info, credential, "/configs", "2024-01-01")
    
    return result
```

**Benefits**:
- Task is now 6 lines instead of 50+
- Business logic is testable independently
- Service can be reused in other contexts
- Type safety through Pydantic models

## References

- [Pydantic Documentation](https://docs.pydantic.dev/)
- [Celery Best Practices](https://docs.celeryproject.org/en/stable/userguide/tasks.html#best-practices)
- [Service Layer Pattern](https://martinfowler.com/eaaCatalog/serviceLayer.html)
- [Dependency Injection](https://en.wikipedia.org/wiki/Dependency_injection)
