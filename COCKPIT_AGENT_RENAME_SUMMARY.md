# Cockpit Agent Rename Summary

All references to "Grafana Agent" have been renamed to "Cockpit Agent" to make it more generic for use with any application.

## Files Renamed

### Agent Directory
- `scripts/grafana_agent/` → `scripts/cockpit_agent/`
- `scripts/cockpit_agent/grafana-agent.service` → `scripts/cockpit_agent/cockpit-agent.service`

### Backend Files
- `backend/models/grafana_agent.py` → `backend/models/cockpit_agent.py`
- `backend/repositories/grafana_agent_repository.py` → `backend/repositories/cockpit_agent_repository.py`
- `backend/services/grafana_agent_service.py` → `backend/services/cockpit_agent_service.py`
- `backend/routers/grafana_agent.py` → `backend/routers/cockpit_agent.py`
- `backend/migrations/versions/002_grafana_agent.py` → `backend/migrations/versions/002_cockpit_agent.py`

### Documentation
- `doc/GRAFANA_AGENT_IMPLEMENTATION.md` → `doc/COCKPIT_AGENT_IMPLEMENTATION.md`

## Code Changes

### Database
**Table:**
- `grafana_agent_commands` → `cockpit_agent_commands`

**Model Class:**
- `GrafanaAgentCommand` → `CockpitAgentCommand`

**Indexes:**
- `idx_grafana_agent_command_agent` → `idx_cockpit_agent_command_agent`
- `idx_grafana_agent_command_sent_at` → `idx_cockpit_agent_command_sent_at`
- `idx_grafana_agent_command_status` → `idx_cockpit_agent_command_status`

### Backend Classes
- `GrafanaAgentRepository` → `CockpitAgentRepository`
- `GrafanaAgentService` → `CockpitAgentService`

### Agent
**Class:**
- `GrafanaAgent` → `CockpitAgent`

**Redis Channels:**
- `grafana-agent:{hostname}` → `cockpit-agent:{hostname}`
- `grafana-agent-response:{hostname}` → `cockpit-agent-response:{hostname}`

**Agent Registry Key:**
- `agents:{hostname}` (unchanged - already generic)

### API Endpoints
**Prefix:**
- `/api/grafana-agent/*` → `/api/cockpit-agent/*`

**Endpoints:**
- `POST /api/cockpit-agent/command`
- `POST /api/cockpit-agent/git-pull`
- `POST /api/cockpit-agent/docker-restart`
- `GET /api/cockpit-agent/{agent_id}/status`
- `GET /api/cockpit-agent/list`
- `GET /api/cockpit-agent/{agent_id}/history`
- `GET /api/cockpit-agent/history/all`

### RBAC Permissions
- `grafana_agents:read` → `cockpit_agents:read`
- `grafana_agents:write` → `cockpit_agents:write`

### Configuration
**Environment Variables (unchanged):**
- `AGENT_HOSTNAME` - Agent identifier
- `GIT_REPO_PATH` - Git repository path
- `DOCKER_CONTAINER_NAME` - Container name

**Default Values Updated:**
- Git path: `/opt/grafana/config` → `/opt/app/config`
- Container: `grafana` → `app`
- Hostname example: `grafana-prod-01` → `app-prod-01`

### Import Changes in main.py
```python
# Before
from routers.grafana_agent import router as grafana_agent_router
app.include_router(grafana_agent_router)

# After
from routers.cockpit_agent import router as cockpit_agent_router
app.include_router(cockpit_agent_router)
```

### Migration Changes
**Migration Name:**
- `002_grafana_agent` → `002_cockpit_agent`

**Migration Description:**
- "Add grafana_agent_commands table for tracking remote commands sent to Grafana agents"
- → "Add cockpit_agent_commands table for tracking remote commands sent to Cockpit agents"

## Verification

All imports verified successfully:

```bash
# Agent
✓ CockpitAgent class imports
✓ Command channel: cockpit-agent:{hostname}
✓ Response channel: cockpit-agent-response:{hostname}

# Backend
✓ Router imports OK
✓ Models import OK
✓ Service imports OK
✓ Repository imports OK
✓ Database model imports OK
✓ Table name: cockpit_agent_commands

# Migration
✓ Migration name: 002_cockpit_agent
✓ Description updated correctly
```

## Next Steps

### Database Migration

**NOTE:** The user will manually drop the old `grafana_agent_commands` table if it exists.

When you restart the backend:
1. Migration `002_cockpit_agent` will run automatically
2. It will create the new `cockpit_agent_commands` table
3. All indexes will be created

### RBAC Permissions

Update permissions in the UI:
1. Go to `/settings/permissions`
2. Add new permissions:
   - Resource: `cockpit_agents`
   - Actions: `read`, `write`
3. Assign to appropriate roles (Admin, etc.)

### Agent Deployment

The agent can now be used for any application, not just Grafana:

**Example use cases:**
- Git pull + Docker restart for Grafana
- Git pull + Docker restart for custom apps
- Any remote command execution needs

**Deploy to remote host:**
```bash
# Copy agent files
sudo cp -r scripts/cockpit_agent /opt/cockpit-agent

# Configure for your app
sudo nano /opt/cockpit-agent/.env
# Set GIT_REPO_PATH, DOCKER_CONTAINER_NAME, etc.

# Install systemd service
sudo cp /opt/cockpit-agent/cockpit-agent.service /etc/systemd/system/
sudo systemctl enable cockpit-agent
sudo systemctl start cockpit-agent
```

## Documentation Updated

All documentation has been updated:
- `doc/COCKPIT_AGENT_IMPLEMENTATION.md` - Complete implementation guide
- `scripts/cockpit_agent/README.md` - Agent deployment guide
- Generic terminology used throughout (remote hosts instead of Grafana hosts)

## Generic Design Benefits

The renamed "Cockpit Agent" is now:
- ✅ **Generic** - Can be used for any application
- ✅ **Flexible** - Configure different git repos and containers
- ✅ **Scalable** - Deploy to multiple hosts running different apps
- ✅ **Consistent** - Matches Cockpit branding
- ✅ **Extensible** - Easy to add new commands via plugin architecture

## Example Multi-App Deployment

```bash
# Host 1: Grafana
AGENT_HOSTNAME=grafana-prod-01
GIT_REPO_PATH=/opt/grafana/config
DOCKER_CONTAINER_NAME=grafana

# Host 2: Custom App
AGENT_HOSTNAME=myapp-prod-01
GIT_REPO_PATH=/opt/myapp/config
DOCKER_CONTAINER_NAME=myapp

# Host 3: Another Service
AGENT_HOSTNAME=service-staging-01
GIT_REPO_PATH=/opt/service/config
DOCKER_CONTAINER_NAME=service
```

All agents managed from the same Cockpit backend! 🎯
