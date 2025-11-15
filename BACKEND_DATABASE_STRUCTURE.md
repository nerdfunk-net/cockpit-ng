# Backend Database Structure

This document provides a comprehensive overview of the database architecture used in the cockpit-ng backend application.

## Overview

The cockpit-ng backend uses SQLite databases to store various types of application data. The databases are organized by functional domain and stored in specific directories within the `data/` folder structure.

## Database Structure Table

| Database File | Location | Tables | Data Stored | Purpose |
|---------------|----------|--------|-------------|---------|
| **users.db** | `data/settings` | `users` | • User accounts (id, username, realname, email)<br/>• Encrypted passwords (bcrypt)<br/>• ~~User permissions (bitwise flags)~~ **LEGACY**<br/>• Debug settings<br/>• Account status & timestamps | User authentication & basic account management |
| **rbac.db** | `data/settings` | `permissions`<br/>`roles`<br/>`role_permissions`<br/>`user_roles`<br/>`user_permissions` | • **44 granular permissions** (resource:action format)<br/>• **System roles** (admin, operator, network_engineer, viewer)<br/>• **Role-permission mappings**<br/>• **User-role assignments**<br/>• **User permission overrides** | **NEW**: RBAC permission system |
| **credentials.db** | `data/settings` | `credentials` | • SSH/TACACS/Generic/Token credentials<br/>• Encrypted passwords (Fernet encryption)<br/>• Credential names & usernames<br/>• Expiration dates<br/>• **Source** (general/private) ✨<br/>• **Owner** (username for private credentials) ✨ | Secure credential storage with private/shared support |
| **cockpit_settings.db** | `data/settings` | `settings`<br/>`user_profiles` | • Nautobot connection settings (URL, token, timeout)<br/>• Git repository settings (URL, branch, credentials)<br/>• CheckMK settings (URL, site, credentials)<br/>• Cache configuration<br/>• User profiles (realname, email, API keys) | Application configuration |
| **git_repositories.db** | `data/settings/` | `git_repositories` | • Repository definitions (name, URL, branch)<br/>• Categories (configs, templates, onboarding, inventory)<br/>• Credentials & SSL settings<br/>• Sync status & timestamps<br/>• Active/inactive status | Git repository management |
| **cockpit_templates.db** | `data/settings` | `templates`<br/>`template_versions` | • Template definitions (name, type, category)<br/>• Git-sourced templates (repo URL, path, branch)<br/>• File/WebEditor templates (content, filename)<br/>• Template variables & tags<br/>• **Source** (general/private) ✨<br/>• **Created by** (username) ✨<br/>• Version history & change tracking | Template management with private/shared support |
| **nb2cmk.db** | `data/settings` | `nb2cmk_jobs`<br/>`nb2cmk_device_results` | • Background job tracking (status, progress)<br/>• Device comparison results<br/>• Diff data & configurations<br/>• CheckMK sync status<br/>• Error messages & timestamps | Nautobot-to-CheckMK operations |
| **jobs.db** | `data/jobs/` | `jobs`<br/>`job_results` | • APScheduler job management<br/>• Network scan jobs<br/>• Device comparison/sync jobs<br/>• Job progress & status tracking<br/>• Per-device results & errors | General job management |
| **apscheduler_jobs.db** | `data/jobs` | APScheduler tables | • Scheduled job definitions<br/>• Job triggers & schedules<br/>• Job state & execution history | APScheduler persistence |

## Detailed Database Descriptions

### 🆕 RBAC System (`rbac.db`)

**Location**: `data/settings/rbac.db`

**NEW in 2025**: Comprehensive Role-Based Access Control system replacing legacy bitwise permissions.

#### Tables:

**1. `permissions` table**
```sql
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource TEXT NOT NULL,        -- e.g., 'nautobot.devices', 'git.repositories'
    action TEXT NOT NULL,           -- 'read', 'write', 'delete', 'execute'
    description TEXT,
    UNIQUE(resource, action)
);
```
- **44 granular permissions** covering all system operations
- Permission format: `resource:action` (e.g., `nautobot.devices:read`)
- Actions: `read`, `write`, `delete`, `execute`

**2. `roles` table**
```sql
CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```
- **4 system roles**: admin, operator, network_engineer, viewer
- Support for custom roles created by administrators
- System roles cannot be deleted

**3. `role_permissions` table**
```sql
CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted BOOLEAN DEFAULT 1,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);
```
- Maps which permissions each role has
- `granted` field allows explicit deny (for inheritance scenarios)

**4. `user_roles` table**
```sql
CREATE TABLE user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER,
    PRIMARY KEY (user_id, role_id)
);
```
- Maps users to their assigned roles
- Users can have multiple roles (permissions are merged)
- Tracks who assigned the role and when

**5. `user_permissions` table**
```sql
CREATE TABLE user_permissions (
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted BOOLEAN NOT NULL,
    assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, permission_id)
);
```
- User-specific permission overrides
- Can grant or deny specific permissions to individual users
- Overrides take precedence over role-based permissions

#### Permission Categories:

**Nautobot Permissions (5)**
- `nautobot.devices:read/write/delete`
- `nautobot.locations:read/write`

**CheckMK Permissions (3)**
- `checkmk.devices:read/write/delete`

**Configuration Permissions (3)**
- `configs:read`
- `configs.backup:execute`
- `configs.compare:execute`

**Network Automation (6)**
- `network.inventory:read/write`
- `network.templates:read/write/delete`
- `network.netmiko:execute`

**Git Permissions (4)**
- `git.repositories:read/write/delete`
- `git.operations:execute`

**Device Operations (3)**
- `scan:execute`
- `devices.onboard:execute`
- `devices.offboard:execute`

**Settings Permissions (11)**
- `settings.nautobot:read/write`
- `settings.checkmk:read/write`
- `settings.cache:read/write`
- `settings.credentials:read/write/delete`
- `settings.templates:read/write`

**User Management (5)**
- `users:read/write/delete`
- `users.roles:write`
- `users.permissions:write`

**Jobs Permissions (4)**
- `jobs:read/write/delete/execute`

### User Management (`users.db`)

**Location**: `data/settings/users.db`

This database handles user authentication and basic account information:

- **User Accounts**: Stores user credentials, profile information, and account metadata
- **Password Security**: Uses bcrypt hashing for secure password storage
- **~~Permissions System~~**: **LEGACY** - Old bitwise permission flags (being phased out)
  - Legacy system still exists for backward compatibility
  - **Use RBAC system (`rbac.db`) for all new permission checks**
- **Debug Settings**: Per-user debug configuration
- **Account Status**: Active/inactive status tracking with timestamps

**Migration Status**: User authentication remains in `users.db`, but authorization moved to `rbac.db`

### Credential Management (`credentials.db`)

**Location**: `data/settings/credentials.db`

Secure storage for device and system credentials with **private credential support**:

#### Schema:
```sql
CREATE TABLE credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,        -- Encrypted with Fernet
    type TEXT NOT NULL,             -- 'ssh', 'tacacs', 'generic', 'token'
    expiration_date TEXT,
    source TEXT DEFAULT 'general',  -- ✨ 'general' or 'private'
    created_by TEXT,                -- ✨ Username who created (for private creds)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Key Features**:
- **Credential Types**: SSH, TACACS, Generic, Token-based authentication
- **Encryption**: All passwords encrypted using Fernet (AES 128) with application SECRET_KEY
- **Ownership**:
  - **General credentials**: Available to all users (system-wide)
  - **Private credentials**: Only visible to the creating user ✨
- **Metadata**: Names, usernames, expiration dates, and source tracking
- **Security**: Encrypted at rest with key rotation support

**Access Control**:
- Requires `settings.credentials:read` to view
- Requires `settings.credentials:write` to create/modify
- Requires `settings.credentials:delete` to delete
- Users can only see their own private credentials + all general credentials

### Application Settings (`cockpit_settings.db`)

**Location**: `data/settings/cockpit_settings.db`

Central configuration storage:

- **External Integrations**:
  - Nautobot connection settings (URL, API token, timeout)
  - CheckMK integration (URL, site name, credentials)
  - Git repository configurations
- **System Configuration**: Cache settings, logging levels, feature flags
- **User Profiles**: Extended user information including API keys and preferences

**Access Control**: Requires `settings.nautobot:read/write`, `settings.checkmk:read/write`, etc.

### Git Repository Management (`git_repositories.db`)

**Location**: `data/settings/git_repositories.db`

Git integration and repository tracking:

- **Repository Definitions**: URLs, branches, authentication settings
- **Categories**: Organization by purpose (configs, templates, onboarding, inventory)
- **Sync Management**: Status tracking, timestamps, error handling
- **SSL Configuration**: Certificate validation settings
- **Activation Status**: Enable/disable repositories without deletion

**Access Control**:
- Requires `git.repositories:read` to view
- Requires `git.repositories:write` to create/modify
- Requires `git.repositories:delete` to delete

### Template System (`cockpit_templates.db`)

**Location**: `data/settings/cockpit_templates.db`

Template management and versioning with **private template support**:

#### Schema Updates:
```sql
CREATE TABLE templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    type TEXT NOT NULL,             -- 'git', 'file', 'webeditor'
    content TEXT,
    source TEXT DEFAULT 'general',  -- ✨ 'general' or 'private'
    created_by TEXT,                -- ✨ Username who created
    active BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    -- ... other fields ...
);
```

**Key Features**:
- **Template Types**:
  - Git-sourced templates (linked to repositories)
  - File-based templates (direct file content)
  - WebEditor templates (inline editing)
- **Ownership**:
  - **General templates**: Available to all users
  - **Private templates**: Only visible to the creating user ✨
- **Metadata**: Names, categories, descriptions, variable definitions
- **Version Control**: Template change tracking and history
- **Content Storage**: Template content and associated files

**Access Control**:
- Requires `network.templates:read` to view
- Requires `network.templates:write` to create/modify
- Requires `network.templates:delete` to delete
- Users can only see their own private templates + all general templates

### Nautobot-CheckMK Operations (`nb2cmk.db`)

**Location**: `data/settings/nb2cmk.db`

Specialized database for Nautobot to CheckMK synchronization:

- **Job Tracking**: Background operation status and progress
- **Device Results**: Per-device comparison and sync results
- **Configuration Diffs**: Change tracking between systems
- **Error Handling**: Detailed error messages and troubleshooting data
- **Sync History**: Historical sync operations and outcomes

### Job Management (`jobs.db`)

**Location**: `data/jobs/jobs.db`

General job execution and tracking:

- **Job Types**: Network scans, device discovery, bulk operations
- **Progress Tracking**: Real-time status updates and completion percentages
- **Result Storage**: Per-device and per-operation results
- **Error Management**: Detailed error logging and recovery information
- **Performance Metrics**: Execution times and resource usage

**Access Control**: Requires `jobs:read/write/delete/execute` permissions

### APScheduler Persistence (`apscheduler_jobs.db`)

**Location**: `data/jobs/apscheduler_jobs.db`

APScheduler framework persistence:

- **Job Scheduling**: Cron-like job definitions and triggers
- **Execution State**: Job run history and status tracking
- **Failure Handling**: Retry logic and failure recovery
- **Performance**: Job execution statistics and monitoring

## Security Features

### Encryption
- **User Passwords**: Secured using bcrypt hashing with salt
- **Device Credentials**: Encrypted with Fernet (AES 128) symmetric encryption
- **API Tokens**: Secure storage for external service authentication
- **Secret Management**: Centralized SECRET_KEY for encryption operations

### Access Control (NEW RBAC System)
- **Granular Permissions**: 44 fine-grained permissions vs 5 legacy bitwise flags
- **Role-Based Access**: 4 system roles + custom roles
- **User Isolation**: Private credentials and templates visible only to owner
- **Permission Overrides**: User-specific permission grants/denies
- **Audit Trail**: Track who assigned roles and when

### Legacy Permissions (Being Phased Out)
- Old bitwise flags: `READ=1`, `WRITE=2`, `ADMIN=4`, `DELETE=8`, `USER_MANAGE=16`
- Still stored in `users.db` for backward compatibility
- **Do not use for new development - use RBAC instead**

### Data Integrity
- **Foreign Key Constraints**: Referential integrity between related tables
- **Transaction Safety**: ACID compliance for data consistency
- **Backup Support**: SQLite database files support standard backup procedures
- **Migration Support**: Schema versioning and upgrade procedures

## Storage Architecture

### Directory Structure
```
data/
├── settings/           # Configuration and metadata databases
│   ├── users.db                   # User accounts (auth only)
│   ├── rbac.db                    # ✨ NEW: RBAC permissions
│   ├── credentials.db             # ✨ Updated: Private credential support
│   ├── cockpit_settings.db        # Application settings
│   ├── git_repositories.db        # Git repository configs
│   ├── cockpit_templates.db       # ✨ Updated: Private template support
│   └── nb2cmk.db                  # Nautobot-CheckMK sync
├── jobs/              # Job management and scheduling
│   ├── jobs.db                    # General jobs
│   └── apscheduler_jobs.db        # APScheduler state
├── templates/         # Template file storage
└── git/              # Git repository clones
```

### Data Relationships

1. **Users → RBAC**: Users get roles from `user_roles`, permissions from roles
2. **Users → Credentials**: Users can own private credentials (`created_by` field)
3. **Users → Templates**: Users can own private templates (`created_by` field)
4. **Roles → Permissions**: Many-to-many via `role_permissions` table
5. **Git Repositories → Credentials**: Repositories reference credentials for authentication
6. **Templates → Git Repositories**: Templates can source content from Git repositories
7. **Jobs → Users**: Jobs track the initiating user for auditing
8. **Settings → All**: Central configuration affects all system operations

## RBAC Migration Status

### Migrated Routers (15/23 - 65%)
These routers now use `require_permission()` instead of `verify_token()/verify_admin_token()`:

1. ✅ nautobot.py - 33 endpoints
2. ✅ checkmk.py - 54 endpoints
3. ✅ templates.py - Template management
4. ✅ credentials.py - Credential management
5. ✅ ansible_inventory.py - Inventory management
6. ✅ netmiko.py - Device command execution
7. ✅ git_repositories.py - Git repo CRUD
8. ✅ git_operations.py - Git operations
9. ✅ user_management.py - User CRUD
10. ✅ scan_and_add.py - Network scanning
11. ✅ config.py - Configuration files
12. ✅ settings.py - Settings management
13. ✅ cache.py - Cache management
14. ✅ jobs.py - Job management
15. ✅ rbac.py - RBAC administration

### Legacy Auth Routers (8/23 - 35%)
These still use old `verify_token()` (low security risk - mostly read-only):
- file_compare.py
- git_compare.py
- git_files.py
- git_version_control.py
- nb2cmk.py
- profile.py
- auth.py (public endpoints)
- oidc.py (public endpoints)

## Maintenance and Monitoring

### Database Health
- **Size Monitoring**: Track database growth and performance
- **Index Optimization**: Regular analysis of query performance
- **Cleanup Procedures**: Archival of old jobs and results
- **Backup Strategies**: Regular database backups and recovery testing

### Performance Considerations
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Indexed columns for frequent queries
- **Batch Operations**: Bulk inserts and updates for large datasets
- **Caching**: In-memory caching for frequently accessed configuration

## Development Guidelines

### Database Access
- Use the provided manager classes (`UserDBManager`, `CredentialsManager`, `RBACManager`, etc.)
- Always use parameterized queries to prevent SQL injection
- Handle database exceptions gracefully with appropriate error messages
- Close database connections properly to prevent resource leaks

### RBAC Implementation
```python
from core.auth import require_permission

# Protect an endpoint with RBAC
@router.get("/devices")
async def list_devices(
    current_user: dict = Depends(require_permission("nautobot.devices", "read"))
):
    username = current_user["username"]
    # Only users with nautobot.devices:read permission can access
    pass
```

### Private Resources
When implementing private resource support:
1. Add `source` field ('general' or 'private')
2. Add `created_by` field (username)
3. Filter queries by username: `WHERE source = 'general' OR created_by = ?`

### Schema Changes
- Update model definitions in the `models/` directory
- Create migration scripts for schema changes
- Test migrations with sample data
- Update this documentation when adding new databases or tables

### Security Best Practices
- Never store plaintext passwords or sensitive credentials
- Use RBAC system (`require_permission()`) for all new endpoints
- Implement private resource isolation for user data
- Regular security audits of stored data and access patterns

---

## Change Log

- **2025-01**: Added RBAC system (`rbac.db`) with 44 granular permissions
- **2025-01**: Added private credential support to `credentials.db`
- **2025-01**: Added private template support to `cockpit_templates.db`
- **2025-01**: Migrated 15 routers (140+ endpoints) to RBAC
- **2024**: Initial database structure with legacy bitwise permissions

---

**Last Updated**: January 2025
**Version**: 2.0
**Author**: Cockpit-NG Development Team