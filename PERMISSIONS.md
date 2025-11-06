# Application Permissions Documentation

This document details the permission requirements for all endpoints and features in the Cockpit-NG application.

## Permission System Overview

The application implements a bitwise permission system with two primary user roles:

### Permission Flags

| Flag | Value | Description |
|------|-------|-------------|
| `PERMISSION_READ` | 1 | Read access to resources |
| `PERMISSION_WRITE` | 2 | Write/modify access to resources |
| `PERMISSION_ADMIN` | 4 | Administrative privileges |
| `PERMISSION_DELETE` | 8 | Delete permissions |
| `PERMISSION_USER_MANAGE` | 16 | User management capabilities |

### Role Presets

| Role | Permissions | Bitwise Value | Description |
|------|-------------|---------------|-------------|
| **Viewer** | READ | 1 | Read-only access to resources |
| **User** | READ + WRITE | 3 | Can read and modify resources |
| **Admin** | READ + WRITE + ADMIN + DELETE + USER_MANAGE | 31 | Full system access |
| **Custom** | Variable | Variable | Custom permission combination |

## Authentication Methods

The application supports three authentication methods:

1. **JWT Token Authentication** (`verify_token`) - Standard user authentication
2. **Admin Token Authentication** (`verify_admin_token`) - Requires full admin permissions
3. **API Key Authentication** (`verify_api_key`) - API key-based authentication with user permissions

## Application Modules & Required Permissions

### 1. Authentication (`/api/auth`)

**Permission Required:** None (Public endpoints) or User

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/login` | POST | None | User login with username/password |
| `/refresh` | POST | User | Refresh JWT token |
| `/api-key-login` | POST | None | Login using API key |

---

### 2. User Management (`/api/user-management`)

**Permission Required:** Admin

All user management endpoints require **full admin permissions** to ensure only authorized administrators can manage user accounts.

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/` | GET | **Admin** | List all users |
| `/` | POST | **Admin** | Create new user |
| `/{user_id}` | GET | **Admin** | Get user details |
| `/{user_id}` | PUT | **Admin** | Update user |
| `/{user_id}` | DELETE | **Admin** | Delete user (soft delete) |
| `/{user_id}/toggle-status` | PATCH | **Admin** | Toggle user active status |
| `/bulk-action` | POST | **Admin** | Bulk operations on users |

---

### 3. Settings Management (`/api/settings`)

**Permission Required:** Admin

All settings endpoints require **admin permissions** as they control critical system configuration.

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/all` | GET | **Admin** | Get all settings |
| `/nautobot` | GET | **Admin** | Get Nautobot settings |
| `/nautobot` | POST | **Admin** | Update Nautobot settings |
| `/nautobot/test` | POST | **Admin** | Test Nautobot connection |
| `/git` | GET | **Admin** | Get Git settings |
| `/git/test` | POST | **Admin** | Test Git connection |
| `/git/global` | POST | **Admin** | Update global Git settings |
| `/git/template-repo` | GET | **Admin** | Get template repository settings |
| `/git/template-repo` | POST | **Admin** | Update template repository settings |
| `/checkmk` | GET | **Admin** | Get CheckMK settings |
| `/checkmk` | POST | **Admin** | Update CheckMK settings |
| `/checkmk/test` | POST | **Admin** | Test CheckMK connection |
| `/cache` | GET | **Admin** | Get cache settings |
| `/cache` | POST | **Admin** | Update cache settings |
| `/reset` | POST | **Admin** | Reset settings to defaults |
| `/health` | GET | **Admin** | Check settings health |
| `/templates` | GET | **Admin** | Get template settings |
| `/templates` | POST | **Admin** | Update template settings |
| `/nautobot/defaults` | GET | User | Get Nautobot defaults |
| `/nautobot/defaults` | POST | **Admin** | Update Nautobot defaults |
| `/nautobot-defaults/{key}` | DELETE | **Admin** | Delete Nautobot default |

---

### 4. Git Repository Management (`/api/git-repositories`)

**Permission Required:** Admin

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/` | GET | **Admin** | List all Git repositories |
| `/` | POST | **Admin** | Create new repository |
| `/{repo_id}` | GET | **Admin** | Get repository details |
| `/{repo_id}` | PUT | **Admin** | Update repository |
| `/{repo_id}` | DELETE | **Admin** | Delete repository |
| `/{repo_id}/edit` | GET | **Admin** | Get repository for editing |
| `/test-connection` | POST | **Admin** | Test repository connection |
| `/health` | GET | **Admin** | Repository health check |

---

### 5. Git Operations (`/api/git-operations`)

**Permission Required:** Mixed (User/Admin)

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/status` | GET | User | Get repository status |
| `/sync` | POST | **Admin** | Sync repository (write operation) |
| `/remove-and-sync` | POST | **Admin** | Remove and sync repository |
| `/info` | GET | User | Get repository information |
| `/debug` | GET | User | Debug repository status |

---

### 6. Git Version Control (`/api/git-version-control`)

**Permission Required:** User

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/branches` | GET | User | List branches |
| `/branches` | POST | User | Create new branch |
| `/commits/{branch_name}` | GET | User | Get commits for branch |
| `/commits` | POST | User | Create commit |
| `/commits/{commit_hash}/diff` | GET | User | Get commit diff |
| `/diff` | POST | User | Compare commits/branches |

---

### 7. Git Files (`/api/git-files`)

**Permission Required:** User

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/files/search` | GET | User | Search files in repository |
| `/files/{commit_hash}/commit` | GET | User | Get files changed in commit |
| `/files/{file_path}/history` | GET | User | Get file history |
| `/files/{file_path}/complete-history` | GET | User | Get complete file history |

---

### 8. Git Comparison (`/api/git-compare`)

**Permission Required:** User

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/repos` | POST | User | Compare repositories |

---

### 9. Nautobot Integration (`/api/nautobot`)

**Permission Required:** User

All Nautobot endpoints require **user permissions** for read and write operations.

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/test` | GET | User | Test Nautobot connection |
| `/devices` | GET | User | List devices |
| `/devices` | POST | User | Search devices |
| `/devices/{device_id}` | GET | User | Get device details |
| `/devices/{device_id}` | PUT | User | Update device |
| `/devices/{device_id}` | DELETE | User | Delete device |
| `/devices/{device_id}/details` | GET | User | Get detailed device info |
| `/devices/search` | POST | User | Search devices |
| `/devices/onboard` | POST | User | Onboard new device |
| `/check-ip` | POST | User | Check IP availability |
| `/sync-network-data` | POST | User | Sync network data |
| `/offboard/{device_id}` | POST | User | Offboard device |
| `/locations` | GET | User | Get locations |
| `/namespaces` | GET | User | Get IP namespaces |
| `/stats` | GET | User | Get Nautobot statistics |
| `/roles` | GET | User | Get device roles |
| `/roles/devices` | GET | User | Get device roles |
| `/platforms` | GET | User | Get platforms |
| `/statuses` | GET | User | Get statuses |
| `/statuses/device` | GET | User | Get device statuses |
| `/statuses/interface` | GET | User | Get interface statuses |
| `/statuses/ipaddress` | GET | User | Get IP address statuses |
| `/statuses/prefix` | GET | User | Get prefix statuses |
| `/statuses/combined` | GET | User | Get combined statuses |
| `/secret-groups` | GET | User | Get secret groups |
| `/device-types` | GET | User | Get device types |
| `/manufacturers` | GET | User | Get manufacturers |
| `/tags` | GET | User | Get tags |
| `/tags/devices` | GET | User | Get device tags |
| `/custom-fields/devices` | GET | User | Get custom fields |
| `/custom-field-choices/{custom_field_name}` | GET | User | Get custom field choices |
| `/jobs/{job_id}/results` | GET | User | Get job results |
| `/health-check` | GET | User | Health check |
| `/ip-address/{ip_id}` | DELETE | User | Delete IP address |

---

### 10. CheckMK Integration (`/api/checkmk`)

**Permission Required:** Mixed (User/Admin)

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/test` | GET | **Admin** | Test CheckMK connection |
| `/test` | POST | **Admin** | Test CheckMK connection (detailed) |
| `/stats` | GET | User | Get CheckMK statistics |
| `/version` | GET | **Admin** | Get CheckMK version |
| `/hosts` | GET | **Admin** | List hosts |
| `/hosts` | POST | **Admin** | Bulk create hosts |
| `/hosts/create` | POST | User | Create single host |
| `/hosts/{hostname}` | GET | **Admin** | Get host details |
| `/hosts/{hostname}` | PUT | **Admin** | Update host |
| `/hosts/{hostname}` | DELETE | **Admin** | Delete host |
| `/hosts/{hostname}/move` | POST | **Admin** | Move host |
| `/hosts/{hostname}/rename` | POST | **Admin** | Rename host |
| `/hosts/{hostname}/services` | GET | **Admin** | Get host services |
| `/hosts/{hostname}/discovery` | GET | **Admin** | Service discovery |
| `/hosts/bulk-create` | POST | **Admin** | Bulk create hosts |
| `/hosts/bulk-update` | POST | **Admin** | Bulk update hosts |
| `/hosts/bulk-delete` | POST | **Admin** | Bulk delete hosts |
| `/monitoring/hosts` | GET | **Admin** | Get monitoring hosts |
| `/monitoring/hosts/{hostname}` | GET | **Admin** | Get host monitoring status |
| And more... | Various | **Admin** | Various monitoring operations |

---

### 11. Nautobot to CheckMK Sync (`/api/nb2cmk`)

**Permission Required:** User

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/jobs` | GET | User | List sync jobs |
| `/start` | POST | User | Start sync job |
| `/jobs/{job_id}` | GET | User | Get job details |
| `/jobs/{job_id}/progress` | GET | User | Get job progress |
| `/jobs/{job_id}/results` | GET | User | Get job results |
| `/jobs/{job_id}/cancel` | POST | User | Cancel job |
| `/devices/{device_id}/mapping` | GET | User | Get device mapping |
| `/devices/{device_id}/preview` | GET | User | Preview device sync |
| `/devices/{device_id}/sync` | POST | User | Sync device |
| `/devices/{device_id}/compare` | GET | User | Compare device |
| `/default-site` | GET | User | Get default site |
| `/sites` | GET | User | List CheckMK sites |

---

### 12. Templates Management (`/api/templates`)

**Permission Required:** Admin

All template endpoints require **admin permissions** as templates define system behavior.

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/` | GET | **Admin** | List templates |
| `/` | POST | **Admin** | Create template |
| `/{template_id}` | GET | **Admin** | Get template |
| `/{template_id}` | PUT | **Admin** | Update template |
| `/{template_id}` | DELETE | **Admin** | Delete template |
| `/name/{template_name}` | GET | **Admin** | Get template by name |
| `/{template_id}/content` | GET | **Admin** | Get template content |
| `/{template_id}/render` | POST | **Admin** | Render template |
| `/{template_id}/versions` | GET | **Admin** | Get template versions |
| `/categories` | GET | **Admin** | Get template categories |
| `/upload` | POST | **Admin** | Upload template |
| `/scan-import` | GET | **Admin** | Scan for importable templates |
| `/import` | POST | **Admin** | Import templates |
| `/sync` | POST | **Admin** | Sync templates from Git |
| `/git/test` | POST | **Admin** | Test Git template connection |
| `/health` | GET | **Admin** | Template health check |

---

### 13. Credentials Management (`/api/credentials`)

**Permission Required:** Admin

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/` | GET | **Admin** | List credentials |
| `/` | POST | **Admin** | Create credential |
| `/{cred_id}` | PUT | **Admin** | Update credential |
| `/{cred_id}` | DELETE | **Admin** | Delete credential |

---

### 14. Jobs Management (`/api/jobs`)

**Permission Required:** User

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/` | GET | User | List jobs |
| `/{job_id}` | GET | User | Get job details |
| `/{job_id}` | DELETE | User | Delete job |
| `/{job_id}/cancel` | DELETE | User | Cancel job |
| `/compare-devices` | POST | User | Start device comparison job |
| `/get-all-devices` | POST | User | Start get all devices job |
| `/scan-network/{cidr}` | POST | User | Start network scan job |
| `/scheduler-status` | GET | User | Get scheduler status |
| `/cleanup` | POST | User | Cleanup old jobs |

---

### 15. Cache Management (`/api/cache`)

**Permission Required:** Admin

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/stats` | GET | **Admin** | Get cache statistics |
| `/entries` | GET | **Admin** | List cache entries |
| `/namespace/{namespace}` | GET | **Admin** | Get namespace entries |
| `/performance` | GET | **Admin** | Get performance metrics |
| `/clear` | POST | **Admin** | Clear cache |
| `/cleanup` | POST | **Admin** | Cleanup expired cache |
| `/devices/clear` | POST | **Admin** | Clear device cache |
| `/devices/stats` | GET | **Admin** | Get device cache stats |

---

### 16. Profile Management (`/api/profile`)

**Permission Required:** User

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/` | GET | User | Get user profile |
| `/` | PUT | User | Update user profile |

---

### 17. Configuration Files (`/api/config`)

**Permission Required:** User

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/` | GET | User | List configuration files |
| `/{filename}` | GET | User | Get configuration file |
| `/{filename}` | POST | User | Update configuration file |

---

### 18. File Comparison (`/api/file-compare`)

**Permission Required:** User

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/list` | GET | User | List comparable files |
| `/compare` | POST | User | Compare files |
| `/export-diff` | POST | User | Export file differences |
| `/config` | GET | User | Get comparison configuration |

---

### 19. Ansible Inventory (`/api/ansible-inventory`)

**Permission Required:** User

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/preview` | POST | User | Preview inventory |
| `/generate` | POST | User | Generate inventory |
| `/download` | POST | User | Download inventory |
| `/field-options` | GET | User | Get field options |
| `/custom-fields` | GET | User | Get custom fields |
| `/field-values/{field_name}` | GET | User | Get field values |
| `/git-repositories` | GET | User | List Git repositories |
| `/push-to-git` | POST | User | Push inventory to Git |

---

### 20. Scan and Add (`/api/scan`)

**Permission Required:** User

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/start` | POST | User | Start network scan |
| `/{job_id}/status` | GET | User | Get scan status |
| `/{job_id}/onboard` | POST | User | Onboard scanned devices |
| `/{job_id}` | DELETE | User | Delete scan job |
| `/jobs` | GET | User | List scan jobs |

---

### 21. OIDC Authentication (`/api/oidc`)

**Permission Required:** None (Public endpoints)

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/enabled` | GET | None | Check if OIDC is enabled |
| `/login` | GET | None | Initiate OIDC login |
| `/callback` | POST | None | OIDC callback handler |
| `/logout` | POST | None | OIDC logout |

---

## Permission Summary by Module

### Admin-Only Modules
These modules require **full admin permissions** (value: 31):

- User Management
- Settings Management (with exception: GET `/nautobot/defaults` is user-accessible)
- Git Repository Management (CRUD operations)
- CheckMK Integration (most endpoints)
- Templates Management
- Credentials Management
- Cache Management

### User Modules
These modules are accessible to **any authenticated user** (user or admin):

- Git Operations (read-only)
- Git Version Control
- Git Files
- Git Comparison
- Nautobot Integration (all operations)
- Jobs Management
- Profile Management
- Configuration Files
- File Comparison
- Ansible Inventory
- Scan and Add
- Nautobot to CheckMK Sync

### Public Modules
These modules do not require authentication:

- Authentication endpoints (`/api/auth/login`, `/api/auth/api-key-login`)
- OIDC endpoints

---

## Security Best Practices

1. **Default Admin Account**: The system creates a default admin account on first run. Change the default password immediately.

2. **API Key Usage**: API keys inherit the permissions of their associated user account. Store them securely.

3. **Permission Checking**: All admin endpoints verify exact permission match (`PERMISSIONS_ADMIN = 31`), not just presence of admin flag.

4. **Token Expiration**: JWT tokens have configurable expiration times. Refresh tokens regularly.

5. **User Roles**: 
   - Assign **Viewer** role for read-only access
   - Assign **User** role for standard operations
   - Assign **Admin** role only to trusted administrators

6. **Inactive Accounts**: Administrators can deactivate user accounts without deletion for security purposes.

---

## Implementation Notes

### Authentication Flow

1. User provides credentials via `/api/auth/login` or `/api/auth/api-key-login`
2. Backend validates credentials against `users.db`
3. JWT token is generated with user's permissions encoded
4. Token is included in subsequent requests via `Authorization: Bearer <token>` header
5. Each endpoint validates token and checks required permissions

### Permission Validation

- **verify_token()**: Validates JWT token, returns user info with permissions
- **verify_admin_token()**: Validates JWT token AND ensures full admin permissions
- **get_current_username()**: Extracts username from token (backward compatibility)
- **verify_api_key()**: Validates API key and returns associated user permissions

### Database Structure

User permissions are stored in `data/settings/users.db` with the following schema:

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    realname TEXT NOT NULL,
    email TEXT,
    password TEXT NOT NULL,
    permissions INTEGER DEFAULT 3,
    debug BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
);
```

---

## Change Log

- **2024**: Initial permission system implementation with bitwise flags
- **2024**: Added user management with roles (admin, user, viewer, custom)
- **2024**: Implemented OIDC integration for SSO support
- **2024**: Added API key authentication support

---

For questions or issues regarding permissions, consult the system administrator or refer to the source code in `backend/core/auth.py` and `backend/user_db_manager.py`.
