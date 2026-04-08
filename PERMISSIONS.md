# Role-Based Access Control (RBAC)

Cockpit-NG uses a fine-grained, role-based permission system. Access to every feature is controlled by **permissions** that are grouped into **roles** and then assigned to **users**. Individual permission overrides can be layered on top of role-based grants for exceptional cases.

---

## Concepts

| Concept | Description |
|---------|-------------|
| **Permission** | The smallest access unit — a `resource:action` pair (e.g., `nautobot.devices:read`) |
| **Role** | A named collection of permissions (e.g., `operator`) |
| **User** | Has one or more roles; may also have direct permission overrides |
| **System role** | A built-in role that cannot be deleted |

### Permission Resolution Order

When a request is made, permissions are resolved in this priority order:

```
1. User-specific permission override  ← highest priority (can GRANT or DENY)
2. Role-based permissions
3. Default DENY                       ← if nothing matches
```

A direct **deny** override on a user will block access even if a role grants the permission.

---

## Permission Format

Every permission follows the pattern:

```
<resource>:<action>
```

**Actions** are one of: `read`, `write`, `delete`, `execute`

**Resources** are dot-namespaced identifiers organized by domain.

---

## All Permissions

### Dashboard

| Permission | Description |
|------------|-------------|
| `dashboard.settings:read` | Access to Settings menu and pages |

### Nautobot Integration

| Permission | Description |
|------------|-------------|
| `nautobot.devices:read` | View Nautobot devices |
| `nautobot.devices:write` | Create/update Nautobot devices |
| `nautobot.devices:delete` | Delete Nautobot devices |
| `nautobot.locations:read` | View Nautobot locations |
| `nautobot.locations:write` | Create/update Nautobot locations |
| `nautobot.export:execute` | Export Nautobot device data |
| `nautobot.export:read` | Download exported device files |
| `nautobot.csv_updates:read` | View CSV updates |
| `nautobot.csv_updates:write` | Create/modify CSV updates |
| `nautobot.csv_updates:execute` | Execute CSV update operations |
| `settings.nautobot:read` | View Nautobot connection settings |
| `settings.nautobot:write` | Modify Nautobot connection settings |

### CheckMK Integration

| Permission | Description |
|------------|-------------|
| `checkmk.devices:read` | View CheckMK devices |
| `checkmk.devices:write` | Create/update CheckMK devices |
| `checkmk.devices:delete` | Delete CheckMK devices |
| `settings.checkmk:read` | View CheckMK connection settings |
| `settings.checkmk:write` | Modify CheckMK connection settings |

### Compliance

| Permission | Description |
|------------|-------------|
| `compliance.check:execute` | Run compliance checks |
| `settings.compliance:read` | View compliance rules and settings |
| `settings.compliance:write` | Create/modify compliance rules |

### Configurations & Backups

| Permission | Description |
|------------|-------------|
| `configs:read` | View device configurations |
| `configs.backup:execute` | Trigger configuration backups |
| `configs.compare:execute` | Run configuration diff/compare |
| `network.backup:read` | View device backup status and history |
| `network.backup:write` | Execute device configuration backups |

### Inventory

| Permission | Description |
|------------|-------------|
| `general.inventory:read` | View device inventory |
| `general.inventory:write` | Modify device inventory |
| `general.inventory:delete` | Delete inventory entries |

### Network Automation

| Permission | Description |
|------------|-------------|
| `network.templates:read` | View configuration templates |
| `network.templates:write` | Create/modify templates |
| `network.templates:delete` | Delete templates |
| `network.netmiko:execute` | Execute commands on devices via SSH (Netmiko) |
| `network.ping:execute` | Run network ping operations |

### Snapshots

| Permission | Description |
|------------|-------------|
| `snapshots:read` | View network snapshots |
| `snapshots:write` | Create/execute network snapshots |
| `snapshots:delete` | Delete network snapshots |

### Git Repositories

| Permission | Description |
|------------|-------------|
| `git.repositories:read` | View git repositories |
| `git.repositories:write` | Create/modify git repositories |
| `git.repositories:delete` | Delete git repositories |
| `git.operations:execute` | Execute git operations (commit, push, pull) |

### Device Lifecycle

| Permission | Description |
|------------|-------------|
| `scan:execute` | Run network scans |
| `devices.onboard:execute` | Onboard new devices |
| `devices.offboard:execute` | Offboard devices |

### Cockpit Agents

| Permission | Description |
|------------|-------------|
| `cockpit_agents:read` | View agent status and command history |
| `cockpit_agents:execute` | Send commands to agents |

### Scheduled Jobs

| Permission | Description |
|------------|-------------|
| `jobs:read` | View scheduled jobs and their results |
| `jobs:write` | Create/modify scheduled jobs |
| `jobs:delete` | Delete scheduled jobs |
| `jobs:execute` | Trigger jobs manually |

### Settings

| Permission | Description |
|------------|-------------|
| `settings.cache:read` | View cache settings |
| `settings.cache:write` | Modify cache settings |
| `settings.celery:read` | View Celery task queue status |
| `settings.celery:write` | Manage Celery tasks and workers |
| `settings.credentials:read` | View stored credentials |
| `settings.credentials:write` | Create/modify credentials |
| `settings.credentials:delete` | Delete credentials |
| `settings.common:read` | View common settings (incl. SNMP passwords) |
| `settings.common:write` | Modify common settings (SNMP mapping) |
| `settings.templates:read` | View template settings |
| `settings.templates:write` | Modify template settings |

### User Management

| Permission | Description |
|------------|-------------|
| `users:read` | View user accounts |
| `users:write` | Create/modify user accounts |
| `users:delete` | Delete user accounts |
| `users.roles:write` | Assign roles to users |
| `users.permissions:write` | Assign permission overrides to users |

### RBAC Management

| Permission | Description |
|------------|-------------|
| `rbac.roles:read` | View roles and their permissions |
| `rbac.roles:write` | Create/modify roles |
| `rbac.roles:delete` | Delete custom roles |
| `rbac.permissions:read` | View all permissions in the system |

### Audit Logs

| Permission | Description |
|------------|-------------|
| `general.logs:read` | View audit logs |

---

## Built-in Roles

Four system roles are created on first startup. System roles **cannot be deleted** but can be used as a base that you extend with custom roles.

### `admin` — Full System Administrator

Has every permission. Intended for system administrators only.

### `operator` — Device & Config Manager

Can manage devices, configurations, and scheduled jobs. Cannot modify system settings or user accounts.

Key permissions: `nautobot.devices:*`, `checkmk.devices:*`, `configs:read`, `configs.backup:execute`, `network.backup:*`, `jobs:*`, `scan:execute`, `devices.onboard:execute`

Settings access: read-only (`settings.nautobot:read`, `settings.checkmk:read`, `settings.cache:read`)

### `network_engineer` — Network Automation Specialist

Full access to all network tooling (templates, Netmiko, snapshots, Git). Read-only for system settings.

Key additions over `operator`: `network.templates:*`, `network.netmiko:execute`, `network.ping:execute`, `snapshots:delete`, `git.*`, `general.inventory:delete`, `nautobot.csv_updates:write`

### `viewer` — Read-Only

Can view devices, configurations, jobs, and logs. Cannot modify anything or access sensitive settings (`settings.credentials`, `settings.common`).

---

## Managing Roles and Permissions in the UI

Navigate to **Settings → Permissions**:

1. **Create a permission** — define a `resource:action` pair with a description
2. **Create a role** — give it a name, then assign permissions to it
3. **Assign roles to users** — go to **Settings → User Management**, open a user, and assign one or more roles

Multiple roles can be assigned to a single user. Effective permissions are the union of all granted permissions from all roles, subject to any direct overrides.

---

## Direct Permission Overrides

For exceptional cases where a single user needs access to one extra permission (or must be blocked from one), use direct overrides instead of creating a dedicated role.

In **Settings → User Management → [user] → Permissions**:

- Set `granted: true` to explicitly grant a permission regardless of roles
- Set `granted: false` to explicitly **deny** a permission, overriding any role that grants it

Overrides take precedence over role-based permissions in all cases.

---

## Creating Custom Roles

1. Navigate to **Settings → Permissions → Roles**
2. Click **Add Role**
3. Enter a name and description
4. Assign the desired permissions
5. Assign the role to users via **Settings → User Management**

Custom roles behave identically to system roles but can be deleted.

---

## Backend Reference

### Protecting an Endpoint

```python
from fastapi import Depends
from core.auth import require_permission, verify_token, verify_admin_token

# Require a specific permission
@router.get("/devices", dependencies=[Depends(require_permission("nautobot.devices", "read"))])
async def list_devices():
    pass

# Require write permission
@router.post("/devices", dependencies=[Depends(require_permission("nautobot.devices", "write"))])
async def create_device():
    pass

# Require admin role
@router.delete("/critical", dependencies=[Depends(verify_admin_token)])
async def delete_critical():
    pass

# Access current user info
@router.get("/me")
async def get_me(user: dict = Depends(verify_token)):
    return user
```

### Checking Permissions Programmatically

```python
import rbac_manager as rbac

# Check a single permission
if rbac.has_permission(user_id, "nautobot.devices", "write"):
    ...

# Check if user has any of several actions
if rbac.check_any_permission(user_id, "network.netmiko", ["execute"]):
    ...

# Get all effective permissions for a user
permissions = rbac.get_user_permissions(user_id)
```

---

## Seeding / Resetting RBAC Data

The RBAC system is seeded automatically on first startup. To re-seed manually (e.g., after adding new permissions):

```bash
# From the backend directory
cd backend
python tools/seed_rbac.py

# Reset ALL RBAC data and re-seed (WARNING: removes all role assignments)
python tools/seed_rbac.py --remove-existing-permissions
```

> After a reset, all users lose their role assignments and must be re-assigned manually.
