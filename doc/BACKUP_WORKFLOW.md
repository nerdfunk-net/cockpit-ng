# Backup Workflow Documentation

## Overview

This document describes the complete backup workflow in Cockpit-NG after the service layer refactoring. The backup system retrieves device configurations from network devices via SSH and stores them in a Git repository for version control.

## Architecture

The backup system consists of four layers:

1. **Celery Tasks Layer** - Orchestrates workflows and manages task execution
2. **Service Layer** - Contains business logic and operations
3. **Data Models Layer** - Provides type safety with Pydantic
4. **External Systems** - Nautobot, SSH/Netmiko, Git, File System

See [Service Layer Architecture](./SERVICE_LAYER_ARCHITECTURE.md) for detailed architecture documentation.

## Workflow Stages

### Stage 1: Validation

**Purpose**: Validate backup inputs before starting

**Process**:
1. Validate credential exists and has required fields
2. Validate repository configuration
3. Create Pydantic models for type safety

**Services Used**:
- `DeviceBackupService.validate_backup_inputs()`

**Models Created**:
- `CredentialInfo` - Validated credential information
- Repository dict - Validated repository configuration

**Success Criteria**:
- Credential has username and password
- Repository has URL and local_path
- All required fields present

**Failure Handling**:
- Returns None if validation fails
- Task aborts with error message

### Stage 2: Git Repository Setup

**Purpose**: Initialize or update local Git repository

**Process**:
1. Check if local repository exists
2. Clone if not exists, pull if exists
3. Verify Git authentication (SSH key or token)
4. Create GitStatus model

**Services Used**:
- `git_service.setup_repository()`

**Models Created**:
- `GitStatus` - Repository status and configuration

**Success Criteria**:
- Local repository exists
- Repository is up to date with remote
- Authentication successful

**Failure Handling**:
- Clone errors logged and task aborted
- Authentication failures reported
- Git errors returned in GitStatus

### Stage 3: Device Information Retrieval

**Purpose**: Fetch device metadata from Nautobot

**Process**:
1. Query Nautobot GraphQL API with device ID
2. Extract device metadata (name, IP, platform, location)
3. Validate device has primary IP address
4. Create DeviceBackupInfo model

**Services Used**:
- `DeviceConfigService.fetch_device_from_nautobot()`

**Models Created**:
- `DeviceBackupInfo` - Complete device metadata

**Success Criteria**:
- Device found in Nautobot
- Device has primary IP address
- Platform information available

**Failure Handling**:
- Device not found → add to failed list, continue
- No primary IP → add to failed list, continue
- GraphQL error → retry or skip

### Stage 4: Configuration Retrieval

**Purpose**: Connect to device and retrieve configurations

**Process**:
1. Map platform to Netmiko device type
2. Establish SSH connection using credentials
3. Execute "show running-config" command
4. Execute "show startup-config" command (if supported)
5. Parse and clean configuration output

**Services Used**:
- `NetmikoPlatformMapper.map_to_netmiko()`
- `DeviceConfigService.retrieve_device_configs()`
- `DeviceConfigService.parse_config_output()`

**Success Criteria**:
- SSH connection successful
- Running config retrieved (minimum requirement)
- Configs parsed and cleaned

**Failure Handling**:
- Connection timeout → retry with exponential backoff
- Authentication failure → try alternate credentials
- Command failure → log and mark as failed
- Parse error → save raw output

### Stage 5: File Storage

**Purpose**: Save configurations to disk in hierarchical structure

**Process**:
1. Generate device path based on location hierarchy
2. Create directory structure
3. Save running-config with timestamp
4. Save startup-config with timestamp (if available)
5. Return success/failure status

**Services Used**:
- `DeviceConfigService.save_configs_to_disk()`
- `DeviceConfigService._generate_device_path()`

**File Structure**:
```
/backups/repo/
└── Region1/
    └── DC1/
        └── switch01/
            ├── switch01_running-config_2024-01-01.txt
            └── switch01_startup-config_2024-01-01.txt
```

**Success Criteria**:
- Directories created successfully
- Files written successfully
- File permissions correct

**Failure Handling**:
- Permission denied → log error, mark as failed
- Disk full → abort batch, return partial results
- I/O error → retry once, then mark as failed

### Stage 6: Git Commit and Push

**Purpose**: Commit backed-up configurations to Git

**Process**:
1. Stage all changed files (`git add .`)
2. Create commit with date-stamped message
3. Push to remote repository
4. Record commit hash and file count

**Services Used**:
- `git_service.commit_and_push()`

**Models Updated**:
- `GitCommitStatus` - Commit details and push status

**Success Criteria**:
- All files staged successfully
- Commit created with changes
- Push to remote successful

**Failure Handling**:
- No changes → skip commit, mark as success
- Commit failed → log error, return partial success
- Push failed → leave local commit, report push failure

### Stage 7: Nautobot Timestamp Update

**Purpose**: Update custom field in Nautobot with backup timestamp

**Process**:
1. Check if timestamp update is enabled
2. Format current date (YYYY-MM-DD)
3. For each backed-up device:
   - Call Nautobot REST API to update custom field
   - Track successes and failures
4. Create TimestampUpdateStatus model

**Services Used**:
- `DeviceBackupService.update_nautobot_timestamps()`

**Models Created**:
- `TimestampUpdateStatus` - Update results

**Success Criteria**:
- All devices updated successfully
- Custom field name is valid
- API authentication successful

**Failure Handling**:
- Update disabled → skip, return status
- Device update fails → log, continue with others
- Partial failure → report counts and errors

### Stage 8: Result Preparation

**Purpose**: Prepare final backup result for task response

**Process**:
1. Collect all backed-up devices
2. Collect all failed devices
3. Serialize Pydantic models to dicts
4. Assemble final result dictionary

**Services Used**:
- `DeviceBackupService.prepare_backup_result()`

**Result Structure**:
```python
{
    "success": True,
    "backed_up_count": 5,
    "failed_count": 1,
    "backed_up_devices": [...],
    "failed_devices": [...],
    "git_status": {...},
    "git_commit_status": {...},
    "credential_info": {...},
    "timestamp_update_status": {...},
    "repository": "backup-repo",
    "commit_date": "2024-01-01",
}
```

## Execution Modes

### Sequential Execution

**When to Use**:
- Small number of devices (< 10)
- Devices with rate limiting
- Debugging individual device issues
- First-time setup

**Process**:
1. Loop through device IDs
2. Fetch → Backup → Save (one at a time)
3. Collect results after each device
4. Continue on individual failures

**Advantages**:
- Predictable resource usage
- Easier to debug
- No worker coordination needed

**Disadvantages**:
- Slower for large device counts
- Underutilizes available resources

### Parallel Execution

**When to Use**:
- Large number of devices (10+)
- Production backups
- Time-sensitive operations

**Process**:
1. Create subtask for each device
2. Launch all subtasks via Celery chord
3. Subtasks execute independently
4. Callback (finalize) runs after all complete

**Advantages**:
- Fast execution (limited by workers)
- Efficient resource utilization
- Automatic retry on worker failure

**Disadvantages**:
- Requires Celery workers
- More complex debugging
- Higher resource usage spike

## Task Orchestration

### Task: `backup_single_device_task`

**Purpose**: Backup a single device (used as subtask in parallel mode)

**Parameters**:
- `device_info`: Device metadata dict
- `credential`: Credential dict
- `base_path`: Local repository path
- `date_str`: Timestamp string

**Returns**:
- Success dict with device info and configs
- Failure dict with error message

**Execution Time**: 10-30 seconds per device

### Task: `backup_devices_task`

**Purpose**: Main orchestration task for batch backups

**Parameters**:
- `device_ids`: List of device UUIDs
- `credential_id`: Credential ID
- `repo_id`: Repository ID
- `execution_mode`: "sequential" or "parallel"
- `job_run_id`: Optional job run tracking ID

**Returns**:
- Summary dict with counts and device lists

**Execution Time**:
- Sequential: (devices × 20 seconds)
- Parallel: ~60 seconds (regardless of device count, up to worker limit)

### Task: `finalize_backup_task`

**Purpose**: Finalize backup after all devices complete (chord callback)

**Parameters**:
- `device_results`: List of device backup results
- `repo_config`: Repository and job configuration

**Returns**:
- Final summary with Git status

**Execution Time**: 5-15 seconds

## Error Handling

### Recoverable Errors

**Connection Timeouts**:
- Retry with exponential backoff (3 attempts)
- If all retries fail, mark device as failed
- Continue with other devices

**Authentication Failures**:
- Log detailed error
- Try alternate credentials if available
- Mark device as failed if no alternates

**Temporary API Failures**:
- Retry GraphQL/REST requests (3 attempts)
- Cache successful responses
- Continue with other devices

### Non-Recoverable Errors

**Invalid Credentials**:
- Abort entire batch
- Report error immediately
- Don't waste time on remaining devices

**Repository Access Denied**:
- Abort entire batch
- Cannot store backups without Git access
- Report configuration error

**Disk Full**:
- Abort with partial results
- Report backed-up devices before failure
- Alert administrators

## Monitoring and Logging

### Logging Levels

**INFO**: Normal operation progress
- Device fetch started/completed
- SSH connection established
- Config saved
- Git commit/push succeeded

**WARNING**: Recoverable issues
- Device not found in Nautobot
- Startup config not available
- Timestamp update failed for some devices

**ERROR**: Operation failures
- SSH connection failed
- Config retrieval failed
- Git push failed
- Critical validation errors

### Progress Tracking

**Celery State Updates**:
```python
self.update_state(
    state="PROGRESS",
    meta={
        "current": 5,
        "total": 10,
        "status": "Backing up device 5/10: switch-05"
    }
)
```

**Job Run Updates** (if enabled):
- Status: queued → running → completed/failed
- Progress percentage
- Device counts (backed up / failed / total)
- Error messages

## Performance Considerations

### Bottlenecks

1. **SSH Connection Establishment**: 2-5 seconds per device
2. **Config Retrieval**: 5-15 seconds per device (varies by config size)
3. **Git Push**: 1-5 seconds (depends on network and changes)
4. **Nautobot Updates**: 0.5-1 second per device

### Optimization Strategies

**Parallel Execution**:
- Use workers equal to expected concurrent devices
- Limit to avoid overwhelming target devices

**Connection Pooling**:
- Not currently implemented (Netmiko limitation)
- Consider connection reuse for multiple commands

**Caching**:
- Cache Nautobot device queries (short TTL)
- Cache credentials (encrypted)
- Don't cache configs (defeats backup purpose)

**Batch Operations**:
- Commit all device configs in single Git commit
- Batch Nautobot timestamp updates (if API supports)

## Troubleshooting

### Common Issues

**Issue**: "Device not found in Nautobot"
- **Cause**: Device ID invalid or device deleted
- **Solution**: Verify device exists, check UUID format

**Issue**: "No primary IP address"
- **Cause**: Device not configured in Nautobot
- **Solution**: Add primary IP in Nautobot, re-run backup

**Issue**: "SSH connection timeout"
- **Cause**: Device unreachable, firewall, wrong IP
- **Solution**: Test connectivity, verify IP, check firewall rules

**Issue**: "Authentication failed"
- **Cause**: Wrong credentials, expired password
- **Solution**: Verify credentials, update if needed

**Issue**: "Git push failed: rejected"
- **Cause**: Repository has changes, authentication failed
- **Solution**: Pull latest changes, verify Git credentials

**Issue**: "Permission denied writing file"
- **Cause**: File system permissions, disk full
- **Solution**: Check directory permissions, check disk space

### Debug Mode

Enable debug logging for detailed trace:

```python
import logging
logging.getLogger("services").setLevel(logging.DEBUG)
logging.getLogger("tasks").setLevel(logging.DEBUG)
```

View detailed logs:
- SSH connection attempts
- Command outputs (truncated)
- File paths being created
- Git operations

## Best Practices

1. **Test with Small Batch First**: Always test with 1-5 devices before running on hundreds
2. **Use Parallel Mode for Production**: Much faster for large device counts
3. **Monitor Resource Usage**: CPU, memory, network during backups
4. **Set Appropriate Timeouts**: Balance between slow devices and failures
5. **Enable Nautobot Timestamps**: Track when devices were last backed up
6. **Review Failed Devices**: Investigate patterns in failures
7. **Regular Git Cleanup**: Archive old commits to keep repository size manageable
8. **Rotate Credentials**: Update SSH passwords regularly
9. **Backup the Backup Repo**: Ensure Git remote is also backed up
10. **Document Device-Specific Issues**: Some devices need special handling

## Future Enhancements

- [ ] Differential backups (only changed configs)
- [ ] Config validation (syntax checking)
- [ ] Automatic retry scheduling for failed devices
- [ ] Email notifications on backup completion
- [ ] Backup verification (restore test)
- [ ] Multi-vendor template support
- [ ] Config diff visualization in UI
- [ ] Backup scheduling with cron expressions
- [ ] Device grouping and batch management
- [ ] Integration with change management systems

## See Also

- [Service Layer Architecture](./SERVICE_LAYER_ARCHITECTURE.md) - Detailed architecture
- [Usage Examples](./USAGE_EXAMPLES.md) - Code examples
- [Testing Guide](../tests/README.md) - How to test
- [API Reference](../README.md) - Service API documentation
