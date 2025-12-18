# Usage Examples: Backup Service Layer

This document provides practical examples of using the backup service layer components.

## Table of Contents

1. [Basic Device Backup](#basic-device-backup)
2. [Batch Device Backup](#batch-device-backup)
3. [Custom Configuration Retrieval](#custom-configuration-retrieval)
4. [Error Handling Patterns](#error-handling-patterns)
5. [Testing Examples](#testing-examples)
6. [Integration with Celery](#integration-with-celery)

## Basic Device Backup

### Example 1: Backup Single Device

```python
from services.device_backup_service import DeviceBackupService
from services.device_config_service import DeviceConfigService
from datetime import datetime

# Initialize services
config_service = DeviceConfigService()
backup_service = DeviceBackupService(device_config_service=config_service)

# Fetch device from Nautobot
device_info = config_service.fetch_device_from_nautobot("device-uuid-123")

if device_info:
    # Prepare credential
    credential = {
        "username": "admin",
        "password": "password123",
        "enable_password": None,
    }
    
    # Perform backup
    date_str = datetime.now().strftime("%Y-%m-%d")
    result = backup_service.backup_single_device(
        device_info=device_info,
        credential=credential,
        base_path="/backups/configs",
        date_str=date_str,
    )
    
    # Check result
    if result["success"]:
        print(f"✓ Backed up {result['device_name']}")
        print(f"  Configs: {', '.join(result['configs_retrieved'])}")
    else:
        print(f"✗ Backup failed: {result['error']}")
```

### Example 2: With Validation

```python
from services.device_backup_service import DeviceBackupService

backup_service = DeviceBackupService()

# Validate inputs first
credential = {
    "id": 1,
    "name": "default-creds",
    "username": "admin",
    "password": "password123",
}

repository = {
    "id": 1,
    "name": "backup-repo",
    "url": "https://github.com/org/backups.git",
    "local_path": "/backups/repo",
}

validation_result = backup_service.validate_backup_inputs(
    credential=credential,
    repository=repository,
)

if validation_result:
    credential_info, repo = validation_result
    print(f"✓ Validated credential: {credential_info.credential_name}")
    print(f"✓ Validated repository: {repo['name']}")
    
    # Proceed with backup...
else:
    print("✗ Validation failed")
```

## Batch Device Backup

### Example 3: Sequential Backup

```python
from services.device_backup_service import DeviceBackupService
from services.device_config_service import DeviceConfigService
from datetime import datetime

# Initialize
config_service = DeviceConfigService()
backup_service = DeviceBackupService(device_config_service=config_service)

device_ids = ["dev-1", "dev-2", "dev-3"]
credential = {"username": "admin", "password": "pass"}
date_str = datetime.now().strftime("%Y-%m-%d")

backed_up = []
failed = []

for device_id in device_ids:
    # Fetch device info
    device_info = config_service.fetch_device_from_nautobot(device_id)
    
    if not device_info:
        failed.append({"device_id": device_id, "error": "Not found in Nautobot"})
        continue
    
    # Backup device
    result = backup_service.backup_single_device(
        device_info=device_info,
        credential=credential,
        base_path="/backups",
        date_str=date_str,
    )
    
    if result["success"]:
        backed_up.append(result)
    else:
        failed.append(result)

print(f"Backed up: {len(backed_up)} devices")
print(f"Failed: {len(failed)} devices")
```

### Example 4: With Progress Tracking

```python
from tqdm import tqdm

device_ids = ["dev-1", "dev-2", "dev-3", "dev-4", "dev-5"]

for idx, device_id in enumerate(tqdm(device_ids, desc="Backing up devices")):
    device_info = config_service.fetch_device_from_nautobot(
        device_id=device_id,
        device_index=idx + 1,  # For logging
    )
    
    if device_info:
        result = backup_service.backup_single_device(
            device_info=device_info,
            credential=credential,
            base_path="/backups",
            date_str=date_str,
        )
        
        # Update progress bar with status
        tqdm.write(f"{'✓' if result['success'] else '✗'} {result['device_name']}")
```

## Custom Configuration Retrieval

### Example 5: Custom Commands

```python
from services.netmiko_service import NetmikoService

netmiko_service = NetmikoService()

# Define custom commands for specific device type
commands = [
    "show running-config",
    "show version",
    "show inventory",
    "show ip interface brief",
]

result = netmiko_service._connect_and_execute(
    device_ip="192.168.1.1",
    device_type="cisco_ios",
    username="admin",
    password="password",
    commands=commands,
    enable_mode=False,
    privileged=True,
)

if result["success"]:
    for cmd, output in result["command_outputs"].items():
        print(f"\n=== {cmd} ===")
        print(output[:200])  # First 200 chars
```

### Example 6: Config Parsing

```python
from services.device_config_service import DeviceConfigService

config_service = DeviceConfigService()

# Raw output from device (with headers)
raw_output = """
Building configuration...

Current configuration : 12345 bytes
!
hostname router01
!
interface GigabitEthernet0/1
 description Uplink
!
end
"""

# Parse and clean
cleaned_config = config_service.parse_config_output(raw_output)

print(cleaned_config)
# Output:
# hostname router01
# !
# interface GigabitEthernet0/1
#  description Uplink
# !
# end
```

## Error Handling Patterns

### Example 7: Graceful Degradation

```python
from typing import Optional

def backup_with_fallback(device_id: str) -> dict:
    """Backup device with fallback strategies."""
    
    # Try to fetch device
    device_info = config_service.fetch_device_from_nautobot(device_id)
    
    if not device_info:
        return {
            "success": False,
            "error": "Device not found in Nautobot",
            "device_id": device_id,
        }
    
    # Try primary credential
    result = backup_service.backup_single_device(
        device_info=device_info,
        credential=primary_credential,
        base_path="/backups",
        date_str=date_str,
    )
    
    # Fallback to secondary credential if primary fails
    if not result["success"] and "authentication" in result["error"].lower():
        print(f"Primary auth failed, trying fallback credential...")
        result = backup_service.backup_single_device(
            device_info=device_info,
            credential=fallback_credential,
            base_path="/backups",
            date_str=date_str,
        )
    
    return result
```

### Example 8: Partial Success Handling

```python
def backup_batch_with_summary(device_ids: list) -> dict:
    """Backup multiple devices and return detailed summary."""
    
    backed_up = []
    failed = []
    skipped = []
    
    for device_id in device_ids:
        try:
            device_info = config_service.fetch_device_from_nautobot(device_id)
            
            if not device_info:
                skipped.append({
                    "device_id": device_id,
                    "reason": "Not found in Nautobot"
                })
                continue
            
            result = backup_service.backup_single_device(
                device_info=device_info,
                credential=credential,
                base_path="/backups",
                date_str=date_str,
            )
            
            if result["success"]:
                backed_up.append(result)
            else:
                failed.append(result)
                
        except Exception as e:
            failed.append({
                "device_id": device_id,
                "error": f"Unexpected error: {str(e)}",
            })
    
    return {
        "total": len(device_ids),
        "backed_up": len(backed_up),
        "failed": len(failed),
        "skipped": len(skipped),
        "backed_up_devices": backed_up,
        "failed_devices": failed,
        "skipped_devices": skipped,
    }
```

## Testing Examples

### Example 9: Unit Test with Mocks

```python
from unittest.mock import Mock, MagicMock
import pytest

def test_backup_single_device_success():
    # Arrange: Create mocked dependencies
    mock_config_service = Mock()
    mock_config_service.retrieve_device_configs.return_value = {
        "running-config": "hostname router01",
        "startup-config": "hostname router01",
    }
    mock_config_service.save_configs_to_disk.return_value = True
    
    backup_service = DeviceBackupService(
        device_config_service=mock_config_service
    )
    
    device_info = DeviceBackupInfo(
        device_id="test-id",
        device_name="router01",
        device_ip="192.168.1.1",
        platform="cisco_ios",
        location_hierarchy=["DC1"],
        device_role="Router",
    )
    
    credential = {"username": "admin", "password": "pass"}
    
    # Act: Execute backup
    result = backup_service.backup_single_device(
        device_info=device_info,
        credential=credential,
        base_path="/tmp",
        date_str="2024-01-01",
    )
    
    # Assert: Verify results
    assert result["success"] is True
    assert result["device_name"] == "router01"
    assert "running-config" in result["configs_retrieved"]
    
    # Verify service calls
    mock_config_service.retrieve_device_configs.assert_called_once()
    mock_config_service.save_configs_to_disk.assert_called_once()
```

### Example 10: Integration Test

```python
@pytest.mark.integration
def test_full_backup_workflow(tmp_path):
    """Test complete backup workflow with real file system."""
    
    # Use real services (with mocked external APIs)
    config_service = DeviceConfigService()
    backup_service = DeviceBackupService(device_config_service=config_service)
    
    # Mock Nautobot response
    with patch.object(config_service.nautobot_service, 'execute_graphql_query') as mock_gql:
        mock_gql.return_value = {
            "data": {
                "device": {
                    "id": "test-id",
                    "name": "router01",
                    "primary_ip4": {"address": "192.168.1.1/24"},
                    "platform": {"name": "Cisco IOS"},
                    "location": {"name": "DC1", "parent": None},
                    "device_role": {"name": "Router"},
                }
            }
        }
        
        # Mock Netmiko connection
        mock_conn = MagicMock()
        mock_conn.send_command.return_value = "hostname router01"
        
        with patch.object(config_service.netmiko_service, 'connect_to_device') as mock_netmiko:
            mock_netmiko.return_value = mock_conn
            
            # Execute backup
            device_info = config_service.fetch_device_from_nautobot("test-id")
            result = backup_service.backup_single_device(
                device_info=device_info,
                credential={"username": "admin", "password": "pass"},
                base_path=str(tmp_path),
                date_str="2024-01-01",
            )
            
            # Verify files were created
            assert result["success"] is True
            config_files = list(tmp_path.rglob("*.txt"))
            assert len(config_files) > 0
```

## Integration with Celery

### Example 11: Simple Celery Task

```python
from celery import shared_task
from services.device_backup_service import DeviceBackupService

@shared_task(name="backup.single_device")
def backup_device_task(device_id: str, credential: dict, repo_path: str) -> dict:
    """Celery task for backing up a single device."""
    
    from services.device_config_service import DeviceConfigService
    from datetime import datetime
    
    config_service = DeviceConfigService()
    backup_service = DeviceBackupService(device_config_service=config_service)
    
    # Fetch device
    device_info = config_service.fetch_device_from_nautobot(device_id)
    
    if not device_info:
        return {
            "success": False,
            "error": "Device not found",
            "device_id": device_id,
        }
    
    # Backup
    date_str = datetime.now().strftime("%Y-%m-%d")
    result = backup_service.backup_single_device(
        device_info=device_info,
        credential=credential,
        base_path=repo_path,
        date_str=date_str,
    )
    
    return result
```

### Example 12: Task with Progress Updates

```python
from celery import shared_task

@shared_task(bind=True, name="backup.batch_devices")
def backup_batch_task(self, device_ids: list, credential: dict, repo_path: str):
    """Backup multiple devices with progress tracking."""
    
    config_service = DeviceConfigService()
    backup_service = DeviceBackupService(device_config_service=config_service)
    
    total = len(device_ids)
    backed_up = []
    failed = []
    
    for idx, device_id in enumerate(device_ids, 1):
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={
                "current": idx,
                "total": total,
                "status": f"Backing up device {idx}/{total}",
            }
        )
        
        # Fetch and backup
        device_info = config_service.fetch_device_from_nautobot(device_id)
        
        if device_info:
            result = backup_service.backup_single_device(
                device_info=device_info,
                credential=credential,
                base_path=repo_path,
                date_str=datetime.now().strftime("%Y-%m-%d"),
            )
            
            if result["success"]:
                backed_up.append(result)
            else:
                failed.append(result)
        else:
            failed.append({"device_id": device_id, "error": "Not found"})
    
    return {
        "backed_up_count": len(backed_up),
        "failed_count": len(failed),
        "backed_up_devices": backed_up,
        "failed_devices": failed,
    }
```

### Example 13: Parallel Execution with Chord

```python
from celery import shared_task, chord

@shared_task
def backup_single_device_subtask(device_id: str, credential: dict, repo_path: str):
    """Subtask for parallel execution."""
    config_service = DeviceConfigService()
    backup_service = DeviceBackupService(device_config_service=config_service)
    
    device_info = config_service.fetch_device_from_nautobot(device_id)
    
    if not device_info:
        return {"success": False, "device_id": device_id}
    
    return backup_service.backup_single_device(
        device_info=device_info,
        credential=credential,
        base_path=repo_path,
        date_str=datetime.now().strftime("%Y-%m-%d"),
    )

@shared_task
def finalize_backup(results: list, repo_config: dict):
    """Callback after all backups complete."""
    backed_up = [r for r in results if r.get("success")]
    failed = [r for r in results if not r.get("success")]
    
    print(f"Backup complete: {len(backed_up)} succeeded, {len(failed)} failed")
    
    # Commit to Git
    # ... git operations ...
    
    return {
        "backed_up_count": len(backed_up),
        "failed_count": len(failed),
    }

@shared_task
def backup_devices_parallel(device_ids: list, credential: dict, repo_path: str, repo_config: dict):
    """Orchestrate parallel backup with finalization."""
    
    # Create subtasks
    tasks = [
        backup_single_device_subtask.s(device_id, credential, repo_path)
        for device_id in device_ids
    ]
    
    # Execute in parallel with callback
    callback = finalize_backup.s(repo_config)
    chord(tasks)(callback)
    
    return {"status": "launched", "device_count": len(device_ids)}
```

## Advanced Patterns

### Example 14: Nautobot Timestamp Update

```python
def backup_and_update_nautobot(device_ids: list):
    """Backup devices and update Nautobot custom fields."""
    
    # Perform backups
    backed_up = []
    for device_id in device_ids:
        device_info = config_service.fetch_device_from_nautobot(device_id)
        result = backup_service.backup_single_device(
            device_info=device_info,
            credential=credential,
            base_path="/backups",
            date_str=datetime.now().strftime("%Y-%m-%d"),
        )
        
        if result["success"]:
            backed_up.append(result)
    
    # Update Nautobot custom fields
    timestamp_status = backup_service.update_nautobot_timestamps(
        backed_up_devices=backed_up,
        write_timestamp_to_custom_field=True,
        timestamp_custom_field_name="last_backup_date",
    )
    
    print(f"Updated timestamps: {timestamp_status.updated_count} devices")
    if timestamp_status.errors:
        print(f"Errors: {timestamp_status.errors}")
```

### Example 15: Custom Result Preparation

```python
from models.backup_models import GitStatus, GitCommitStatus, CredentialInfo, TimestampUpdateStatus

def prepare_detailed_backup_report(backed_up: list, failed: list, repo: dict):
    """Prepare comprehensive backup report."""
    
    git_status = GitStatus(
        repository_name=repo["name"],
        initialized=True,
        branch="main",
        local_path=repo["local_path"],
    )
    
    git_commit_status = GitCommitStatus(
        committed=True,
        pushed=True,
        commit_hash="abc123",
        files_changed=len(backed_up),
    )
    
    credential_info = CredentialInfo(
        credential_id=1,
        credential_name="default",
    )
    
    timestamp_status = TimestampUpdateStatus(
        enabled=True,
        custom_field_name="last_backup",
        updated_count=len(backed_up),
    )
    
    result = backup_service.prepare_backup_result(
        backed_up_devices=backed_up,
        failed_devices=failed,
        git_status=git_status,
        git_commit_status=git_commit_status,
        credential_info=credential_info,
        timestamp_update_status=timestamp_status,
        repository_name=repo["name"],
        commit_date=datetime.now().strftime("%Y-%m-%d"),
    )
    
    return result
```

## Tips and Best Practices

1. **Always validate inputs** before starting backup operations
2. **Use Pydantic models** for type safety and validation
3. **Handle None returns** from service methods gracefully
4. **Log extensively** for debugging and auditing
5. **Use progress callbacks** for long-running operations
6. **Implement retry logic** for transient failures
7. **Clean up resources** (connections, file handles) properly
8. **Test with mocks** before running against real infrastructure
9. **Monitor task status** when using Celery
10. **Handle partial successes** in batch operations

## Troubleshooting

### Common Issues

**Issue**: Device not found in Nautobot
```python
device_info = config_service.fetch_device_from_nautobot(device_id)
if not device_info:
    # Check if device ID is correct
    # Verify device exists in Nautobot
    # Check Nautobot API connectivity
```

**Issue**: SSH connection fails
```python
result = backup_service.backup_single_device(...)
if not result["success"] and "connect" in result["error"].lower():
    # Check device IP is reachable
    # Verify credentials are correct
    # Check firewall rules
    # Verify platform mapping is correct
```

**Issue**: Config file not created
```python
# Check file permissions on base_path
# Verify location hierarchy is valid
# Check disk space
# Review logs for save_configs_to_disk errors
```

## Further Reading

- [Service Layer Architecture](../docs/SERVICE_LAYER_ARCHITECTURE.md)
- [Test Documentation](../tests/README.md)
- [API Reference](../docs/API_REFERENCE.md) (if available)
- [Celery Documentation](https://docs.celeryproject.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
