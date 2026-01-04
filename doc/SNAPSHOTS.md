# Network Snapshots Feature Documentation

## Overview

The Network Snapshots feature allows users to capture device state snapshots, parse them with TextFSM, store them in Git repositories, and compare snapshots to identify differences. This feature is located under **Network > Automation > Snapshots** in the sidebar.

**Key Capabilities:**
- Execute commands on network devices via Netmiko
- Parse command output using TextFSM templates (per-command configuration)
- Store parsed JSON data in Git repositories with customizable paths
- Support for both stored credentials and manual SSH credentials
- Direct execution without modal dialogs
- Track execution status and results per device
- Compare two snapshots to identify differences

**UI Structure:**
The page is organized into 4 tabs:
1. **Devices** - Select target devices using shared device selector
2. **Commands** - Create and manage command lists with per-command TextFSM flags
3. **Execute Snapshot** - Configure path, credentials, git repository, and execute snapshots
4. **Manage Snapshots** - View table of snapshots, select and compare, delete snapshots

## Architecture

The implementation follows the layered architecture defined in `CLAUDE.md`:

### Backend Structure

```
backend/
├── core/models.py
│   └── SnapshotCommandTemplate, SnapshotCommand, Snapshot, SnapshotResult
│
├── models/snapshots.py
│   └── Pydantic models for API validation (SnapshotExecuteRequest, etc.)
│
├── repositories/snapshots/
│   ├── template_repository.py    # Template CRUD operations
│   └── snapshot_repository.py    # Snapshot execution data access
│
├── services/network/snapshots/
│   ├── template_service.py       # Template business logic
│   ├── execution_service.py      # Snapshot execution orchestration
│   └── comparison_service.py     # Snapshot comparison logic
│
├── services/network/automation/
│   └── netmiko.py                # Netmiko service with TextFSM support
│
├── services/settings/git/
│   └── service.py                # Git operations (commit_and_push)
│
└── routers/network/snapshots/
    ├── templates.py               # /api/network/snapshots/templates/*
    └── snapshots.py               # /api/network/snapshots/*
```

### Frontend Structure

```
frontend/src/components/features/network/snapshots/
├── types/
│   └── snapshot-types.ts         # TypeScript type definitions
│
├── hooks/
│   ├── use-snapshot-templates.ts # Template management hook
│   └── use-snapshots.ts          # Snapshot execution & comparison hook
│
├── tabs/
│   ├── devices-tab.tsx           # Device selector (reuses shared component)
│   ├── commands-tab.tsx          # Command management with TextFSM toggles
│   ├── snapshots-tab.tsx         # Execute snapshot (direct execution)
│   └── manage-snapshots-tab.tsx  # Manage snapshots (view, select, compare)
│
├── dialogs/
│   ├── save-template-dialog.tsx      # Save command templates
│   ├── compare-snapshots-dialog.tsx  # Compare two snapshots
│   ├── delete-snapshot-dialog.tsx    # Delete snapshot confirmation
│   └── view-snapshot-dialog.tsx      # View snapshot details and outputs
│
├── snapshots-page.tsx            # Main page component (4 tabs)
└── page.tsx (route)              # /network/snapshots
```

## Database Schema

### Tables (PostgreSQL)

**1. snapshot_command_templates**
- Stores reusable command template definitions
- Fields: id, name, description, scope (global/private), created_by, is_active
- Relationships: One-to-many with snapshot_commands
- Indexes: scope + created_by, is_active

**2. snapshot_commands**
- Individual commands within a template
- Fields: id, template_id, command, use_textfsm, order
- Relationships: Many-to-one with snapshot_command_templates
- Indexes: template_id

**3. snapshots**
- Snapshot execution records
- Fields: id, name, description, template_id, template_name, git_repository_id, snapshot_path, executed_by, status, device_count, success_count, failed_count, started_at, completed_at
- Status values: pending, running, completed, failed
- Relationships: One-to-many with snapshot_results
- Indexes: status, executed_by, created_at

**4. snapshot_results**
- Per-device snapshot results with parsed data
- Fields: id, snapshot_id, device_name, device_ip, status, git_file_path, git_commit_hash, parsed_data (JSON text), error_message, started_at, completed_at
- Status values: pending, running, success, failed
- Relationships: Many-to-one with snapshots
- Indexes: snapshot_id, device_name, status
- Cascade delete: When snapshot is deleted, all results are deleted

## Backend Implementation

### Execution Flow (execution_service.py)

The snapshot execution service orchestrates the entire snapshot workflow:

**1. Credential Management**
```python
# Supports both stored credentials and manual input
if request.credential_id is not None:
    # Fetch from credentials manager
    credential = cred_mgr.get_credential(request.credential_id)
    username = credential["username"]
    password = cred_mgr.get_decrypted_password(request.credential_id)
else:
    # Use manual credentials
    username = request.username
    password = request.password
```

**2. Database Record Creation**
```python
# Create snapshot record
snapshot = snapshot_repo.create_snapshot(
    name=request.name,
    git_repository_id=request.git_repository_id,
    snapshot_path=request.snapshot_path,
    executed_by=username,
    device_count=len(request.devices),
    status="running"
)

# Create result record for each device
for device in request.devices:
    result = snapshot_repo.create_result(
        snapshot_id=snapshot.id,
        device_name=device.get("name"),
        device_ip=extract_ip(device),
        status="pending"
    )
```

**3. Command Execution via Netmiko Service**
```python
# Prepare commands list
command_list = [cmd.command for cmd in request.commands]

# Check if any command has TextFSM enabled
use_textfsm = any(cmd.use_textfsm for cmd in request.commands)

# Execute commands on all devices concurrently
session_id, results = await netmiko_service.execute_commands(
    devices=netmiko_devices,
    commands=command_list,
    username=username,
    password=password,
    enable_mode=False,      # Snapshots always use exec mode
    write_config=False,     # Never write config for snapshots
    use_textfsm=use_textfsm # Global TextFSM flag
)
```

**4. TextFSM Parsing (netmiko.py)**
```python
# In netmiko service, for each command:
cmd_output = connection.send_command(
    command,
    use_textfsm=use_textfsm,  # Netmiko handles TextFSM parsing
    read_timeout=30,
)

# Store output (can be string or list of dicts if TextFSM parsed)
command_outputs[command] = cmd_output
```

**5. Git Storage**
```python
# For each successful device execution:
def _save_to_git(git_repo_id, file_path, content, commit_message):
    # Get repository metadata
    repo_data = git_manager.get_repository(git_repo_id)

    # Open or clone repository
    repo = git_service.open_or_clone(repo_data)

    # Get local repository path
    local_repo_path = repo_path(repo_data)

    # Write JSON file
    full_path = Path(local_repo_path) / file_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(content, encoding='utf-8')

    # Commit and push
    result = git_service.commit_and_push(
        repository=repo_data,
        message=commit_message,
        files=[file_path],
        repo=repo
    )

    return result.commit_sha
```

**6. Result Processing**
```python
# Build JSON structure: command -> output mapping
snapshot_data = {}
if "command_outputs" in result and result["command_outputs"]:
    snapshot_data = result["command_outputs"]  # Per-command data

# Convert to JSON
json_content = json.dumps(snapshot_data, indent=2, default=str)

# Render file path with placeholders
file_path = render_path(snapshot_path, device, timestamp)
# Example: snapshots/router1-2024-01-04T10-30-00.json

# Save to Git
commit_hash = _save_to_git(
    git_repo_id=git_repository_id,
    file_path=file_path,
    content=json_content,
    commit_message=f"Snapshot: {name} - {device_name} - {timestamp}"
)

# Update database
snapshot_repo.update_result(
    result_id=result_id,
    status="success",
    git_file_path=file_path,
    git_commit_hash=commit_hash,
    parsed_data=json_content,
    completed_at=datetime.utcnow()
)
```

**7. Completion**
```python
# Update snapshot status
snapshot_repo.update_snapshot_status(
    snapshot_id=snapshot.id,
    status="completed",
    completed_at=datetime.utcnow()
)
```

### API Request Model (SnapshotExecuteRequest)

```python
class SnapshotExecuteRequest(BaseModel):
    name: str                          # Auto-generated snapshot name
    description: Optional[str]         # Always None (not used)
    commands: List[SnapshotCommandCreate]  # Commands with use_textfsm flags
    git_repository_id: int             # Git repo to store results
    snapshot_path: str                 # Path with placeholders + filename
    devices: List[Dict[str, Any]]      # Devices from selector

    # Credentials (one or the other)
    credential_id: Optional[int]       # Stored credential ID
    username: Optional[str]            # Manual username
    password: Optional[str]            # Manual password

    template_id: Optional[int]         # Optional template association
    template_name: Optional[str]       # Template name for path placeholders
```

### Netmiko Service Integration

The snapshot execution service uses the centralized Netmiko service with TextFSM support:

**Key Features:**
- ✅ Concurrent execution on multiple devices
- ✅ Per-command TextFSM parsing support
- ✅ Returns `command_outputs` dict with command → output mapping
- ✅ Handles both raw text and parsed JSON output
- ✅ Proper error handling and timeout management

**TextFSM Behavior:**
- If `use_textfsm=True`: Netmiko parses output using ntc-templates
- Output format: `List[Dict]` (structured data)
- If `use_textfsm=False`: Returns raw text output
- Output format: `str` (unstructured text)

## Frontend Implementation

### Execute Snapshot Tab UI

The Execute Snapshot tab provides direct execution without modal dialogs:

**3 Color-Coded Configuration Sections:**

1. **🟨 Amber: Snapshot Path Configuration**
   - Input field for path template
   - Supports placeholders: `{device_name}`, `{timestamp}`, `{template_name}`, `{custom_field.*}`
   - Must include filename with `.json` extension
   - Example: `snapshots/{device_name}-{template_name}.json`

2. **🟪 Purple: SSH Credentials**
   - Credential selector component (reused from Netmiko)
   - Dropdown: "Enter SSH Credentials" or stored credentials
   - Manual mode: Shows username/password fields
   - Stored mode: Auto-loads credentials

3. **🔷 Teal: Git Repository Selection**
   - Dropdown to select Git repository
   - Lists all configured Git repositories
   - Required for execution

**Execute Button:**
- Blue button with loading state
- Shows spinner icon when executing
- Disabled when:
  - Path is empty
  - No commands configured
  - No devices selected
  - No Git repository selected
  - Manual credentials incomplete
  - Currently executing

### Execution Logic (snapshots-tab.tsx)

```typescript
const handleExecuteSnapshot = async () => {
  // Validate inputs
  if (!snapshotGitRepoId || commands.length === 0 || !snapshotPath.trim()) {
    // Show validation error
    return
  }

  setExecuting(true)
  try {
    // Prepare credential payload
    const credentialPayload = selectedCredentialId === 'manual'
      ? { username, password }
      : { credential_id: parseInt(selectedCredentialId) }

    // Auto-generate snapshot name
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
    const snapshotName = `snapshot-${timestamp}`

    // Execute snapshot
    await executeSnapshot({
      name: snapshotName,
      description: undefined,
      commands,                    // Array with use_textfsm flags
      git_repository_id: snapshotGitRepoId,
      snapshot_path: snapshotPath,
      devices: selectedDevices,
      template_id: selectedTemplateId || undefined,
      template_name: selectedTemplateName || undefined,  // For {template_name} placeholder
      ...credentialPayload
    })

    toast({ title: 'Snapshot Executed', description: 'Success' })
  } catch (error) {
    toast({ title: 'Execution Failed', variant: 'destructive' })
  } finally {
    setExecuting(false)
  }
}
```

## Complete Workflow

### User Workflow

**Step 1: Select Devices (Devices Tab)**
1. Use shared device selector to choose target devices
2. Can filter by location, platform, role, status, etc.
3. Selected devices persist across tabs

**Step 2: Configure Commands (Commands Tab)**
1. Add commands using the "+" button
2. Toggle "Parse with TextFSM" checkbox per command
3. Optionally save as template (private or global)
4. Commands persist across tabs

**Step 3: Execute Snapshot (Execute Snapshot Tab)**
1. **Configure Path** (amber section):
   - Enter path with placeholders
   - Example: `snapshots/{device_name}-{template_name}.json`

2. **Select Credentials** (purple section):
   - Choose stored credential OR
   - Enter manual username/password

3. **Select Git Repository** (teal section):
   - Choose repository for storage

4. **Click Execute Snapshot**:
   - Button shows loading spinner
   - Executes immediately (no modal)

**Step 4: View Results (Manage Snapshots Tab)**
1. Table shows all snapshots with status
2. **View snapshot details**:
   - Click eye icon to view full snapshot information
   - **Overview tab**: Shows general info, execution details, statistics, and Git info
   - **Results & Commands tab**: Shows per-device results with expandable command outputs
   - Command outputs displayed as parsed JSON (TextFSM) or raw text
3. **Compare snapshots**:
   - Select two snapshots to compare
   - View detailed comparison results
4. **Delete snapshots**:
   - Click trash icon on any snapshot
   - Choose deletion mode:
     - **Cancel**: Close dialog without changes
     - **Remove from DB**: Delete database record only (files remain in Git)
     - **Remove DB & Files**: Delete database record AND remove all files from Git repository

### Backend Workflow

```
1. API Request Received
   ↓
2. Validate Credentials
   - Fetch stored credential OR use manual
   ↓
3. Create Database Records
   - Create snapshot record (status: running)
   - Create result record per device (status: pending)
   ↓
4. Execute Commands via Netmiko Service
   - Connect to devices concurrently
   - Execute commands with optional TextFSM
   - Return command_outputs dict
   ↓
5. Process Results
   - For each device:
     a. Extract command_outputs
     b. Convert to JSON
     c. Render file path with placeholders
     d. Write file to local Git repository
     e. Git commit and push
     f. Update database with commit hash
   ↓
6. Update Snapshot Status
   - Mark snapshot as completed
   - Update success/failed counts
   ↓
7. Return Response
   - Frontend shows success toast
```

### Data Flow Example

**Input:**
```json
{
  "name": "snapshot-2024-01-04T10-30-00",
  "commands": [
    { "command": "show ip route", "use_textfsm": true, "order": 1 },
    { "command": "show version", "use_textfsm": true, "order": 2 }
  ],
  "devices": [{ "name": "router1", "primary_ip4": "192.168.1.1", "platform": "cisco_ios" }],
  "git_repository_id": 1,
  "snapshot_path": "snapshots/{device_name}-{template_name}.json",
  "template_name": "cisco-baseline",
  "credential_id": 5
}
```

**Netmiko Execution:**
```python
# Executes on router1
command_outputs = {
  "show ip route": [
    {"protocol": "C", "network": "192.168.1.0", "mask": "24", ...},
    {"protocol": "S", "network": "0.0.0.0", "mask": "0", ...}
  ],
  "show version": [
    {"version": "15.7(3)M3", "hostname": "router1", "uptime": "2 days", ...}
  ]
}
```

**Git Storage:**
```
Repository: /path/to/git/repo
File: snapshots/router1-cisco-baseline.json
Content:
{
  "show ip route": [
    {"protocol": "C", "network": "192.168.1.0", "mask": "24", ...},
    {"protocol": "S", "network": "0.0.0.0", "mask": "0", ...}
  ],
  "show version": [
    {"version": "15.7(3)M3", "hostname": "router1", "uptime": "2 days", ...}
  ]
}

Commit: a1b2c3d4 "Snapshot: snapshot-2024-01-04T10-30-00 - router1 - 2024-01-04T10-30-00"
```

**Database:**
```sql
-- snapshots table
id: 123
name: "snapshot-2024-01-04T10-30-00"
template_name: "cisco-baseline"
git_repository_id: 1
snapshot_path: "snapshots/{device_name}-{template_name}.json"
status: "completed"
device_count: 1
success_count: 1

-- snapshot_results table
id: 456
snapshot_id: 123
device_name: "router1"
device_ip: "192.168.1.1"
status: "success"
git_file_path: "snapshots/router1-cisco-baseline.json"
git_commit_hash: "a1b2c3d4"
parsed_data: '{"show ip route": [...], "show version": [...]}'
```

## Path Placeholders

The snapshot path supports dynamic placeholders:

**Available Placeholders:**
- `{device_name}` - Device name from Nautobot
- `{timestamp}` - ISO timestamp (colons replaced with hyphens)
- `{template_name}` - Template name (if a template is selected)
- `{custom_field.FIELD_NAME}` - Custom field values from device

**Example Paths:**
```
snapshots/{device_name}-{template_name}.json
→ snapshots/router1-cisco-baseline.json

snapshots/{device_name}-{timestamp}.json
→ snapshots/router1-2024-01-04T10-30-00.json

network/{custom_field.site}/devices/{device_name}-{template_name}.json
→ network/NYC/devices/router1-cisco-baseline.json

daily-snapshots/{timestamp}/{device_name}.json
→ daily-snapshots/2024-01-04T10-30-00/router1.json
```

**Rendering Logic** (`execution_service.py:30-61`):
```python
def _render_path(
    path_template: str,
    device: Dict,
    timestamp: str,
    template_name: Optional[str] = None
) -> str:
    device_name = device.get("name", "unknown")
    rendered = path_template.replace("{device_name}", device_name)
    rendered = rendered.replace("{timestamp}", timestamp)

    # Replace template_name placeholder if provided
    if template_name:
        rendered = rendered.replace("{template_name}", template_name)

    # Handle custom fields
    if "custom_fields" in device and device["custom_fields"]:
        for key, value in device["custom_fields"].items():
            placeholder = f"{{custom_field.{key}}}"
            rendered = rendered.replace(placeholder, str(value))

    return rendered
```

**Template Name Behavior:**
- When a template is selected in the Commands tab, the template name is automatically tracked
- Frontend passes `template_name` to backend when executing snapshots
- If no template is selected, the `{template_name}` placeholder remains unreplaced
- Backend can also look up template name from `template_id` if not provided by frontend

## Snapshot Comparison

The comparison service performs deep diff analysis on JSON snapshots:

**Comparison Levels:**
1. **Device Level**: same, different, missing_in_snapshot1, missing_in_snapshot2
2. **Command Level**: added, removed, modified, unchanged
3. **Data Level**: Deep diff of parsed JSON structures

**Usage:**
```python
result = comparison_service.compare_snapshots({
    "snapshot_id_1": 123,
    "snapshot_id_2": 456,
    "device_filter": ["router1", "router2"]  # Optional
})

# Returns:
{
    "snapshot1": {...},
    "snapshot2": {...},
    "devices": [
        {
            "device_name": "router1",
            "status": "different",
            "commands": [
                {
                    "command": "show ip route",
                    "status": "modified",
                    "diff": {...}
                }
            ]
        }
    ],
    "summary": {
        "same_count": 0,
        "different_count": 1,
        "missing_in_snapshot1": 0,
        "missing_in_snapshot2": 0
    }
}
```

## Snapshot Deletion

Snapshots can be deleted in two modes:

**1. Remove from Database Only**
- Deletes snapshot and result records from database
- Files remain in Git repository
- Use case: Clean up database while preserving historical data
- Endpoint: `DELETE /api/network/snapshots/{snapshot_id}`

**2. Remove Database & Files**
- Deletes snapshot and result records from database
- Removes all snapshot files from Git repository
- Commits deletion to Git with descriptive message
- Use case: Complete removal of snapshot data
- Endpoint: `DELETE /api/network/snapshots/{snapshot_id}/files`

**Deletion Workflow:**

```python
# Backend service (execution_service.py)

def delete_snapshot_with_files(self, snapshot_id: int) -> bool:
    """Delete snapshot from DB and remove files from Git."""
    # 1. Get snapshot with results
    snapshot = self.snapshot_repo.get_by_id(snapshot_id)

    # 2. Get git repository
    repo_data = self.git_manager.get_repository(snapshot.git_repository_id)
    repo = git_service.open_or_clone(repo_data)

    # 3. Collect file paths from results
    files_to_delete = [result.git_file_path for result in snapshot.results]

    # 4. Delete files from local repo
    for file_path in files_to_delete:
        full_path.unlink()

    # 5. Commit and push deletion
    git_service.commit_and_push(
        repository=repo_data,
        message=f"Delete snapshot: {snapshot.name}",
        files=files_to_delete,
        repo=repo
    )

    # 6. Delete from database
    self.snapshot_repo.delete_snapshot(snapshot_id)
```

**UI Flow:**
1. User clicks trash icon in Manage Snapshots tab
2. Delete confirmation dialog appears with three options
3. User selects deletion mode
4. Backend executes appropriate deletion
5. Success/error toast notification shown
6. Snapshots table refreshes automatically


## Permissions & RBAC

**Permissions:**
- `snapshots:read` - View snapshots and templates
- `snapshots:write` - Create/execute snapshots and templates
- `snapshots:delete` - Delete templates

**Role Assignments:**
- **admin**: Full access
- **network_engineer**: Full access
- **operator**: Read and write
- **viewer**: Read-only

## Known Limitations

### Per-Command vs Global TextFSM

**Current Implementation:**
- Frontend allows per-command `use_textfsm` flags
- Backend detects if ANY command has `use_textfsm=True`
- Netmiko applies TextFSM to ALL commands if enabled

**Implication:**
- If one command has TextFSM enabled, ALL commands get parsed
- This is a Netmiko service limitation (global flag per connection)

**Future Enhancement:**
- Execute commands in separate batches (TextFSM vs non-TextFSM)
- Or execute each command individually with its own flag

### Git Integration

**Implemented:**
- ✅ Full Git write/commit/push functionality
- ✅ Uses `git_service.commit_and_push()`
- ✅ Creates directory structure automatically
- ✅ Stores commit hash in database

## Troubleshooting

### Issue: Snapshot execution fails with credential error

**Cause**: Invalid or expired credential
**Solution**:
1. Check credential validity in Settings > Credentials
2. Verify SSH access to devices manually
3. Try manual credential input instead

### Issue: Git commit fails

**Cause**: Git repository not accessible or authentication failed
**Solution**:
1. Check Git repository configuration in Settings > Git
2. Verify SSH keys or tokens are configured
3. Test Git operations manually using Settings > Git > Test Connection

### Issue: TextFSM parsing not working

**Cause**: No TextFSM template available for command/platform combination
**Solution**:
1. Verify ntc-templates package is installed
2. Check if template exists for your platform and command
3. Fall back to `use_textfsm=False` for raw output

### Issue: Placeholder not rendering in path

**Cause**: Placeholder data not available (e.g., custom field, template name)
**Solution**:
1. For `{template_name}`: Select a template in the Commands tab before executing
2. For `{custom_field.*}`: Verify custom field exists in Nautobot and device has a value
3. Check device has value for the custom field
4. Use only standard placeholders: `{device_name}`, `{timestamp}` (always available)

## File Locations

### Backend
- Models: `/backend/core/models.py:1117-1257`
- Pydantic: `/backend/models/snapshots.py`
- Repositories: `/backend/repositories/snapshots/`
- Services: `/backend/services/network/snapshots/`
- Netmiko Service: `/backend/services/network/automation/netmiko.py`
- Git Service: `/backend/services/settings/git/service.py`
- Routers: `/backend/routers/network/snapshots/`

### Frontend
- Page: `/frontend/src/app/(dashboard)/network/snapshots/page.tsx`
- Main Component: `/frontend/src/components/features/network/snapshots/snapshots-page.tsx`
- Execute Tab: `/frontend/src/components/features/network/snapshots/tabs/snapshots-tab.tsx`
- Commands Tab: `/frontend/src/components/features/network/snapshots/tabs/commands-tab.tsx`
- Types: `/frontend/src/components/features/network/snapshots/types/snapshot-types.ts`
- Hooks: `/frontend/src/components/features/network/snapshots/hooks/`

## Future Enhancements

1. **Per-Command TextFSM Control**: Execute commands in batches based on TextFSM flag
2. **Snapshot Scheduling**: Integrate with Celery Beat for automated snapshots
3. **Background Execution**: Use Celery for long-running snapshot jobs
4. **Result Viewing**: UI to view individual snapshot JSON data
5. **Baseline Management**: Mark snapshots as "baseline" for comparisons
6. **Alerting**: Send alerts when snapshot diffs exceed threshold
7. **Compliance Integration**: Link snapshots to compliance checks
8. **Report Generation**: PDF reports of snapshot comparisons
9. **Rollback Generation**: Use snapshot data to generate rollback configurations
10. **Edit Snapshot Metadata**: Allow editing snapshot name and description
