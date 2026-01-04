# Network Snapshots Feature Documentation

## Overview

The Network Snapshots feature allows users to capture device state snapshots, parse them with TextFSM, store them in Git repositories, and compare snapshots to identify differences. This feature is located under **Network > Automation > Snapshots** in the sidebar.

**Key Capabilities:**
- Execute commands on network devices via Netmiko
- Parse command output using TextFSM templates
- Store parsed JSON data in Git repositories with customizable paths
- Create and manage reusable command templates (private or global)
- Compare two snapshots to identify differences
- Track execution status and results per device

## Architecture

The implementation follows the layered architecture defined in `CLAUDE.md`:

### Backend Structure

```
backend/
├── core/models.py
│   └── SnapshotCommandTemplate, SnapshotCommand, Snapshot, SnapshotResult
│
├── models/snapshots.py
│   └── Pydantic models for API validation
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
└── routers/network/snapshots/
    ├── templates.py               # /api/network/snapshots/templates/*
    └── snapshots.py              # /api/network/snapshots/*
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
│   ├── commands-tab.tsx          # Template & command management
│   └── snapshots-tab.tsx         # Execute & compare snapshots
│
├── dialogs/
│   ├── save-template-dialog.tsx      # Save command templates
│   ├── execute-snapshot-dialog.tsx   # Execute snapshot on devices
│   └── compare-snapshots-dialog.tsx  # Compare two snapshots
│
├── snapshots-page.tsx            # Main page component (3 tabs)
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

## API Endpoints

### Template Management
- `POST /api/network/snapshots/templates` - Create template
- `GET /api/network/snapshots/templates` - List accessible templates
- `GET /api/network/snapshots/templates/{id}` - Get template details
- `PUT /api/network/snapshots/templates/{id}` - Update template
- `DELETE /api/network/snapshots/templates/{id}` - Soft delete template

### Snapshot Execution & Comparison
- `POST /api/network/snapshots/execute` - Execute snapshot
- `GET /api/network/snapshots` - List snapshots (most recent first)
- `GET /api/network/snapshots/{id}` - Get snapshot with results
- `POST /api/network/snapshots/compare` - Compare two snapshots

## Key Implementation Details

### 1. Template Scope (Private vs Global)

Templates can be marked as:
- **Private**: Only visible to the creator
- **Global**: Visible to all users

**Repository Logic** (`template_repository.py:89-104`):
```python
if created_by:
    # Show global templates + user's private templates
    query = query.filter(
        (SnapshotCommandTemplate.scope == "global")
        | (
            (SnapshotCommandTemplate.scope == "private")
            & (SnapshotCommandTemplate.created_by == created_by)
        )
    )
```

### 2. SQLAlchemy Session Management

**CRITICAL**: Relationships must be eagerly loaded before closing the session to avoid `DetachedInstanceError`.

**Fix Applied** (`template_repository.py:60-61`):
```python
db.commit()
db.refresh(template)
# Eagerly load commands relationship before closing session
_ = template.commands  # Forces SQLAlchemy to load the relationship
return template
```

Without this, Pydantic serialization fails when accessing `template.commands` after session closure.

### 3. Device Data Handling

Device objects come from the shared device selector and may have varying structures. The code uses defensive programming to handle both nested objects and strings.

**Safe Extraction Pattern** (`execution_service.py:78-97`):
```python
# Handle device data safely
device_name = device.get("name", "unknown") if isinstance(device, dict) else str(device)

# Extract IP address
primary_ip4 = device.get("primary_ip4") if isinstance(device, dict) else None
if isinstance(primary_ip4, dict):
    device_ip = primary_ip4.get("address", "").split("/")[0]
elif isinstance(primary_ip4, str):
    device_ip = primary_ip4.split("/")[0]
else:
    device_ip = ""

# Extract platform
platform_data = device.get("platform") if isinstance(device, dict) else None
if isinstance(platform_data, dict):
    platform = platform_data.get("name", "cisco_ios")
elif isinstance(platform_data, str):
    platform = platform_data
else:
    platform = "cisco_ios"
```

This handles:
- Nested objects: `{primary_ip4: {address: "192.168.1.1/24"}}`
- Direct strings: `{primary_ip4: "192.168.1.1/24"}`
- Missing data: Graceful fallback to defaults

### 4. Snapshot Path Placeholders

The snapshot path supports placeholders similar to backup templates:
- `{device}` - Device name
- `{timestamp}` - ISO timestamp (colons replaced with hyphens)
- `{custom_field.net}` - Custom field values

**Rendering Logic** (`execution_service.py:32-48`):
```python
def _render_path(self, path_template: str, device: Dict[str, Any], timestamp: str) -> str:
    rendered = path_template.replace("{device}", device.get("name", "unknown"))
    rendered = rendered.replace("{timestamp}", timestamp)

    # Handle custom fields
    if "custom_fields" in device and device["custom_fields"]:
        for key, value in device["custom_fields"].items():
            placeholder = f"{{custom_field.{key}}}"
            if placeholder in rendered:
                rendered = rendered.replace(placeholder, str(value))

    return rendered
```

**Default Path**: `snapshots/{device}/{timestamp}.json`

### 5. TextFSM Parsing with Netmiko

Commands are executed using Netmiko with optional TextFSM parsing:

```python
output = connection.send_command(
    command,
    use_textfsm=use_textfsm,  # Boolean flag per command
    read_timeout=30,
)
```

When `use_textfsm=True`:
- Netmiko automatically detects the platform
- Searches for matching TextFSM templates in ntc-templates
- Returns structured data (list of dicts) instead of raw text

When `use_textfsm=False`:
- Returns raw command output as string

**Storage**: Parsed data is stored as JSON in `snapshot_results.parsed_data` (TEXT column)

### 6. Snapshot Comparison Algorithm

The comparison service performs deep diff analysis on JSON data:

**Comparison Levels** (`comparison_service.py:23-74`):
1. **Device Level**: same, different, missing_in_snapshot1, missing_in_snapshot2
2. **Command Level**: added, removed, modified, unchanged
3. **Data Level**: Deep diff of parsed JSON structures

**Deep Diff Logic**:
```python
def _deep_diff(self, data1: Any, data2: Any, path: str = "") -> Optional[Dict[str, Any]]:
    # Type changes
    if type(data1) != type(data2):
        return {"type": "type_change", "path": path, ...}

    # Dictionary changes
    if isinstance(data1, dict):
        diff = {"type": "dict_diff", "path": path, "changes": []}
        for key in all_keys:
            if key not in data1:
                diff["changes"].append({"type": "added", ...})
            elif key not in data2:
                diff["changes"].append({"type": "removed", ...})
            else:
                nested_diff = self._deep_diff(data1[key], data2[key], key_path)
                if nested_diff:
                    diff["changes"].append(nested_diff)

    # List and primitive comparisons
    ...
```

### 7. Git Integration (Placeholder)

**Current Status**: The Git save functionality is a placeholder (`execution_service.py:175-181`):

```python
# TODO: Implement Git file writing and commit
# This should use the existing Git service
# For now, return a placeholder
logger.warning("Git integration not yet implemented in snapshot service")
return "pending_git_integration"
```

**Future Implementation**:
- Use existing `GitRepositoryManager` to get repository details
- Use Git service to write JSON files to the repository
- Commit with message: `f"Snapshot: {request.name} - {device.get('name')}"`
- Store commit hash in `snapshot_results.git_commit_hash`
- Store file path in `snapshot_results.git_file_path`

### 8. Permissions & RBAC

**Permissions Added** (`seed_rbac.py:112-115`):
- `snapshots:read` - View snapshots and templates
- `snapshots:write` - Create/execute snapshots and templates
- `snapshots:delete` - Delete templates

**Role Assignments**:
- **admin**: Full access (read, write, delete)
- **network_engineer**: Full access (read, write, delete)
- **operator**: Read and write only
- **viewer**: Read-only access

**Router Protection Example**:
```python
@router.post("/execute")
async def execute_snapshot(
    request: SnapshotExecuteRequest,
    current_user: dict = Depends(require_permission("snapshots", "write"))
):
    ...
```

### 9. Frontend-Backend API Path Convention

**CRITICAL**: All backend routes must use `/api/` prefix to work with Next.js proxy.

**Correct**:
```python
router = APIRouter(prefix="/api/network/snapshots/templates", tags=["snapshots"])
```

**Incorrect** (will cause 404 errors):
```python
router = APIRouter(prefix="/network/snapshots/templates", tags=["snapshots"])
```

The Next.js proxy (`frontend/src/app/api/proxy/[...path]/route.ts:70`) adds `/api/` prefix to all paths except `auth/*` and `profile`.

### 10. Git Repositories API Response Format

The Git repositories endpoint returns an object, not a direct array:

```json
{
  "repositories": [
    {"id": 1, "name": "configs", ...},
    {"id": 2, "name": "cockpit configs", ...}
  ],
  "total": 2
}
```

**Frontend must extract the array** (`execute-snapshot-dialog.tsx:69-70`):
```typescript
const response = await apiCall<{ repositories: GitRepository[] }>('git-repositories')
setGitRepos(response.repositories || EMPTY_REPOS)
```

## User Workflow

### Creating a Command Template

1. Navigate to **Commands** tab
2. Click **Add Command** (+) to add commands like:
   - `show ip route`
   - `show cdp neighbors`
   - `show spanning-tree`
3. Toggle **Parse with TextFSM** checkbox per command
4. Click **Save Template**
5. Enter name, description, and scope (private/global)
6. Template is saved to database

### Executing a Snapshot

1. Navigate to **Devices** tab → select devices
2. Navigate to **Commands** tab → load/create template
3. Navigate to **Snapshots** tab
4. Click **Execute Snapshot**
5. Configure:
   - Snapshot name (supports placeholders)
   - Git repository for storage
   - Snapshot path template
6. Click **Execute**
7. Backend:
   - Connects to each device via Netmiko
   - Executes commands with TextFSM parsing
   - Stores JSON results in database
   - (TODO) Commits to Git repository

### Comparing Snapshots

1. Navigate to **Snapshots** tab
2. Click on two snapshots to select them
3. Click **Compare Selected**
4. View comparison dialog showing:
   - Summary statistics (identical, different, missing devices)
   - Per-device comparisons
   - Per-command diffs with JSON changes

## Known Limitations & TODOs

### 1. Git Integration Not Implemented

**Current**: Snapshot data is stored in PostgreSQL only
**TODO**: Implement actual Git file writing and commits
**Location**: `execution_service.py:_save_to_git()`

**Implementation Steps**:
```python
def _save_to_git(self, git_repo_id: int, file_path: str, content: str, commit_message: str):
    repo_data = self.git_manager.get_repository(git_repo_id)
    # Use existing Git service to:
    # 1. Clone/pull repository
    # 2. Write file to path
    # 3. Git add
    # 4. Git commit with message
    # 5. Git push
    # 6. Return commit hash
```

### 2. Credentials Management

**Current**: Uses hardcoded placeholder credentials
**TODO**: Integrate with existing credentials manager

**Location**: `execution_service.py:272-275`
```python
credentials = {
    "username": "admin",  # TODO: Get from credentials manager
    "password": "admin",  # TODO: Get from credentials manager
}
```

**Implementation**:
- Use existing `CredentialsManager` from `credentials_manager.py`
- Allow user to select credential set in Execute Snapshot dialog
- Pass credential_id through to execution service

### 3. Background Job Execution

**Current**: Snapshots execute synchronously within the API request
**TODO**: Use Celery for background execution

**Benefits**:
- Non-blocking API responses
- Progress tracking
- Cancellation support
- Better timeout handling

**Implementation**:
- Create Celery task in `tasks/`
- Return task ID from `/execute` endpoint
- Use WebSocket or polling for progress updates
- Similar to existing job execution pattern

### 4. Snapshot Deletion

**Missing**: No endpoint to delete snapshots
**TODO**: Add DELETE endpoint with cascade to results

```python
@router.delete("/{snapshot_id}")
async def delete_snapshot(
    snapshot_id: int,
    current_user: dict = Depends(require_permission("snapshots", "delete"))
):
    # Delete snapshot record (cascade deletes results)
    # Optionally delete Git files
    ...
```

### 5. Snapshot Result Viewing

**Missing**: No UI to view individual snapshot results/JSON
**TODO**: Add view dialog or expand accordion to show parsed JSON

**Implementation**:
- Add "View" button in snapshots table
- Dialog showing prettified JSON per device
- Filter/search within JSON data

### 6. Export Comparison Results

**Missing**: No way to export comparison results
**TODO**: Add export button for CSV/JSON/PDF

### 7. Scheduled Snapshots

**Missing**: No integration with job scheduler
**TODO**: Create job template type for snapshots

**Implementation**:
- Add `snapshot_template` job type to job templates
- Allow scheduling recurring snapshots
- Store snapshot_id in job run results
- Link to existing Celery Beat scheduler

### 8. Snapshot Retention Policy

**Missing**: No automatic cleanup of old snapshots
**TODO**: Add retention settings (keep last N snapshots, delete after X days)

## Testing Checklist

- [ ] Create private template (verify only creator sees it)
- [ ] Create global template (verify all users see it)
- [ ] Load existing template into Commands tab
- [ ] Execute snapshot with TextFSM parsing enabled
- [ ] Execute snapshot with TextFSM parsing disabled
- [ ] Execute snapshot with placeholder path `{device}/{timestamp}`
- [ ] Execute snapshot with custom field placeholder `{custom_field.*}`
- [ ] View snapshot results in database
- [ ] Compare two identical snapshots (should show "same")
- [ ] Compare two different snapshots (should show diffs)
- [ ] Test with missing devices in one snapshot
- [ ] Test permissions (viewer can't create, admin can)
- [ ] Test error handling (invalid credentials, unreachable device)

## Common Issues & Solutions

### Issue: 404 Not Found on API calls

**Cause**: Router prefix missing `/api/`
**Solution**: Ensure all routers use `/api/` prefix:
```python
router = APIRouter(prefix="/api/network/snapshots/...", ...)
```

### Issue: DetachedInstanceError when creating template

**Cause**: SQLAlchemy session closed before relationship loaded
**Solution**: Eagerly load relationships before closing session:
```python
db.refresh(template)
_ = template.commands  # Force load
return template
```

### Issue: 'str' object has no attribute 'get'

**Cause**: Assuming device data structure without validation
**Solution**: Use defensive programming with `isinstance()` checks:
```python
device_name = device.get("name", "unknown") if isinstance(device, dict) else str(device)
```

### Issue: Git repositories not loading (404)

**Cause**: Wrong endpoint path
**Solution**: Use `git-repositories` (with hyphen), not `git/repositories`

### Issue: Git repositories returns "not a function"

**Cause**: Response is object with `repositories` array, not direct array
**Solution**: Extract array from response:
```typescript
const response = await apiCall<{ repositories: GitRepository[] }>('git-repositories')
setGitRepos(response.repositories || EMPTY_REPOS)
```

## File Locations Reference

### Backend
- Models: `/backend/core/models.py:1117-1257`
- Pydantic: `/backend/models/snapshots.py`
- Repositories: `/backend/repositories/snapshots/`
- Services: `/backend/services/network/snapshots/`
- Routers: `/backend/routers/network/snapshots/`
- Permissions: `/backend/seed_rbac.py:112-115`

### Frontend
- Page: `/frontend/src/app/(dashboard)/network/snapshots/page.tsx`
- Main Component: `/frontend/src/components/features/network/snapshots/snapshots-page.tsx`
- Types: `/frontend/src/components/features/network/snapshots/types/snapshot-types.ts`
- Hooks: `/frontend/src/components/features/network/snapshots/hooks/`
- Tabs: `/frontend/src/components/features/network/snapshots/tabs/`
- Dialogs: `/frontend/src/components/features/network/snapshots/dialogs/`
- Sidebar: `/frontend/src/components/layout/app-sidebar.tsx:110` (Network > Automation > Snapshots)

## Future Enhancements

1. **Snapshot Scheduling**: Integrate with Celery Beat for automated snapshots
2. **Diff Visualization**: Better visual diff viewer (side-by-side, syntax highlighting)
3. **Snapshot Templates**: Pre-built templates for common use cases (routing, switching, security)
4. **Baseline Management**: Mark a snapshot as "baseline" for all future comparisons
5. **Alerting**: Send alerts when snapshot diffs exceed threshold
6. **Compliance Integration**: Link snapshots to compliance checks
7. **Report Generation**: PDF reports of snapshot comparisons
8. **Snapshot Rollback**: Use snapshot data to generate rollback configurations
9. **Change Detection**: Automatic snapshot comparison between scheduled runs
10. **Multi-Device Comparison**: Compare same command across multiple devices in one view
