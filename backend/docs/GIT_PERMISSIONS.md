# Git Module Permissions

## Overview

The Git module uses a two-tier permission structure that separates repository configuration from repository operations:

1. **`git.repositories`** - Permissions for managing repository configurations (CRUD)
2. **`git.operations`** - Permissions for executing git operations on repository content

This separation provides better security by allowing users to have different levels of access to repository configuration vs. repository content.

## Permission Structure

### Repository Configuration Permissions (`git.repositories`)

These permissions control who can manage the repository configurations in the system:

| Permission | Action | Description | Endpoints |
|------------|--------|-------------|-----------|
| `git.repositories:read` | View | View repository configurations, browse files, view commits | GET /api/git-repositories/, GET /api/git-repositories/{id}, GET /api/git/{repo_id}/files, GET /api/git/{repo_id}/commits |
| `git.repositories:write` | Modify | Create/update repository configurations, test connections | POST /api/git-repositories/, PUT /api/git-repositories/{id}, POST /api/git-repositories/test-connection |
| `git.repositories:delete` | Delete | Delete repository configurations | DELETE /api/git-repositories/{id} |

### Repository Operations Permissions (`git.operations`)

These permissions control who can execute git operations that modify repository content:

| Permission | Action | Description | Endpoints |
|------------|--------|-------------|-----------|
| `git.operations:execute` | Execute | Sync repositories, create commits, checkout branches, run git operations | POST /api/git/{repo_id}/sync, POST /api/git/{repo_id}/commit, POST /api/git/{repo_id}/checkout, GET /api/git/{repo_id}/status |

## Router Permission Matrix

### git_repositories.py - Repository CRUD

| Endpoint | Method | Permission | Action |
|----------|--------|------------|--------|
| `/` | GET | `git.repositories:read` | List all repositories |
| `/{repo_id}` | GET | `git.repositories:read` | Get repository details |
| `/{repo_id}/edit` | GET | `git.repositories:write` | Get repository for editing |
| `/` | POST | `git.repositories:write` | Create new repository |
| `/{repo_id}` | PUT | `git.repositories:write` | Update repository |
| `/{repo_id}` | DELETE | `git.repositories:delete` | Delete repository |
| `/test-connection` | POST | `git.repositories:write` | Test repository connection |
| `/health` | GET | `git.repositories:read` | Health check |

### git_operations.py - Sync & Status

| Endpoint | Method | Permission | Action |
|----------|--------|------------|--------|
| `/status` | GET | `git.operations:execute` | Get repository status |
| `/sync` | POST | `git.operations:execute` | Sync repository |
| `/remove-and-sync` | POST | `git.operations:execute` | Force re-clone |
| `/gc` | POST | `git.operations:execute` | Run garbage collection |
| `/reset` | POST | `git.operations:execute` | Reset repository |

### git_version_control.py - Branches & Commits

| Endpoint | Method | Permission | Action |
|----------|--------|------------|--------|
| `/branches` | GET | `git.operations:execute` | List branches |
| `/checkout` | POST | `git.operations:execute` | Checkout branch |
| `/commits` | GET | `git.repositories:read` | List commits (read-only) |
| `/commit` | POST | `git.operations:execute` | Create commit |
| `/commits/{hash}` | GET | `git.repositories:read` | Get commit details |
| `/diff` | POST | `git.operations:execute` | Generate diff |

### git_files.py - File Operations

| Endpoint | Method | Permission | Action |
|----------|--------|------------|--------|
| `/files` | GET | `git.repositories:read` | Browse files |
| `/files/download` | GET | `git.repositories:read` | Download file |
| `/files/content` | GET | `git.repositories:read` | View file content |
| `/files/history` | GET | `git.repositories:read` | View file history |

### git_compare.py - Cross-Repository Comparison

| Endpoint | Method | Permission | Action |
|----------|--------|------------|--------|
| `/repos` | POST | `git.operations:execute` | Compare files across repos |

### git_debug.py - Debug Endpoints

| Endpoint | Method | Permission | Action |
|----------|--------|------------|--------|
| `/debug/read` | POST | `git.repositories:write` | Debug read test |
| `/debug/write` | POST | `git.repositories:write` | Debug write test |
| `/debug/delete` | POST | `git.repositories:write` | Debug delete test |
| `/debug/push` | POST | `git.repositories:write` | Debug push test |
| `/debug/diagnostics` | GET | `git.repositories:read` | Get diagnostics |

## Role Assignments

### Admin Role
- `git.repositories:read`
- `git.repositories:write`
- `git.repositories:delete`
- `git.operations:execute`

### Operator Role
- `git.repositories:read`
- `git.repositories:write`
- `git.operations:execute`

### Network Engineer Role
- `git.repositories:read`
- `git.operations:execute`

### Viewer Role
- `git.repositories:read`

## Permission Logic Rationale

### Why Two Permission Categories?

**Separation of Concerns:**
- Repository configuration (where repos are stored, credentials, URLs) is separate from repository content
- A user might need to sync/commit (operations) but not create/delete repository configs
- Network engineers can work with repository content without managing repository configurations

**Security Benefits:**
- Prevent accidental deletion of repository configurations while allowing content operations
- Fine-grained control over who can add new repository integrations vs. who can use them
- Audit trail separation between config changes and content changes

### Read-Only Access Pattern

Certain operations are read-only even though they use `git.operations:execute`:
- `GET /status` - While it uses `execute` permission, it's read-only
- This is intentional to keep operations grouped logically rather than by HTTP method

### Why `execute` Instead of `write` for Operations?

Using `execute` for operations makes it clear these are active operations that modify state, distinct from:
- `write` which typically means CRUD modifications
- `execute` which means running an action/command

## Future Considerations

If push operations are added in the future, they should use:
- `git.operations:push` - A new permission for pushing to remote repositories
- This would allow even finer control: users who can commit locally but not push to origin

## Consistency Check

✅ All routers use consistent permission naming
✅ All CRUD operations use `git.repositories` permissions
✅ All content operations use `git.operations` permissions
✅ Permission hierarchy is clear and logical
✅ Role assignments follow principle of least privilege
