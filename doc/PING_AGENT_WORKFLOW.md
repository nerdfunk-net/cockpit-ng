# Ping Agent — Job Template Implementation Guide

## Overview

The `ping_agent` background job is already fully functional as an **ad-hoc operation** triggered from the Cockpit Agents page. This document describes what is still needed to make it a schedulable **Job Template** (visible in Jobs → Templates, executable via schedule or manual run from Jobs → Schedules).

---

## What Is Already Done

| Layer | File | Status |
|-------|------|--------|
| Celery executor | `backend/tasks/execution/ping_agent_executor.py` | ✅ Done |
| Job type routing | `backend/tasks/execution/base_executor.py` | ✅ Done |
| API endpoint (non-blocking) | `backend/routers/cockpit_agent.py` | ✅ Done |
| Response model | `backend/models/cockpit_agent.py` (`PingJobResponse`) | ✅ Done |
| Frontend result viewer | `frontend/.../jobs/view/results/ping-agent-result.tsx` | ✅ Done |
| Job type label/color | `frontend/.../jobs/templates/utils/constants.ts` | ✅ Done |
| Type guards | `frontend/.../jobs/view/types/job-results.ts` | ✅ Done |

The executor (`execute_ping_agent`) already reads `agent_id` from both:
- `job_parameters["agent_id"]` — used by ad-hoc API calls
- `template.get("ping_agent_id")` — used by scheduled job templates (column not yet in DB)

---

## What Still Needs to Be Done

### 1. Database Migration — Add `ping_agent_id` to `job_templates`

**File to create:** `backend/migrations/versions/024_add_ping_agent_job_template.py`

Look at any existing migration (e.g. `019_add_csv_import_file_filter.py`) for the exact pattern.
The migration runner is in `backend/migrations/runner.py` and runs automatically at startup via `backend/start.py`.

```python
from migrations.base import BaseMigration

class Migration(BaseMigration):
    version = "024"
    description = "Add ping_agent_id to job_templates"

    def up(self, connection):
        connection.execute(text(
            "ALTER TABLE job_templates "
            "ADD COLUMN IF NOT EXISTS ping_agent_id VARCHAR(255)"
        ))

    def down(self, connection):
        connection.execute(text(
            "ALTER TABLE job_templates DROP COLUMN IF EXISTS ping_agent_id"
        ))
```

---

### 2. SQLAlchemy Model — `backend/core/models.py`

Add one column to the `JobTemplate` class (around line 458, after the `ip_*` fields):

```python
# Ping Agent (ping_agent type)
ping_agent_id = Column(
    String(255), nullable=True
)  # ID of the cockpit agent to ping through (ping_agent type)
```

---

### 3. Pydantic Schemas — `backend/models/job_templates.py`

Find the `JobTemplateCreate` / `JobTemplateUpdate` / `JobTemplateResponse` models and add:

```python
ping_agent_id: Optional[str] = None
```

to all three.

If job types are validated as enums, add `"ping_agent"` to the allowed values.

---

### 4. Executor Already Supports Templates

`backend/tasks/execution/ping_agent_executor.py` line 55–56 already reads:

```python
agent_id = params.get("agent_id") or tmpl.get("ping_agent_id")
```

When a Job Template runs via `dispatch_job`, the `template` dict is passed automatically — no executor changes needed.

For the inventory: the executor reads `job_parameters.get("inventory_id")` and calls
`_resolve_devices_from_inventory()`. For scheduled runs, this inventory_id comes from
`job_parameters` set on the `JobSchedule`. Alternatively, `inventory_name` from the
template is resolved the same way other templates do it (via `service_factory`).

**Recommendation:** Follow the `deploy_agent_executor.py` pattern — resolve `inventory_name`
from the template to get `inventory_id` at execution time. The executor's
`_resolve_devices_from_inventory()` function is already wired up for this.

---

### 5. Frontend — New Template Type Component

**Create:** `frontend/src/components/features/jobs/templates/components/template-types/PingAgentJobTemplate.tsx`

This component only needs one field: a dropdown to select the cockpit agent.
The inventory is handled by the shared `JobTemplateInventorySection` component.

```tsx
'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bot } from 'lucide-react'

interface Agent {
  agent_id: string
  hostname: string
  status: string
}

interface PingAgentJobTemplateProps {
  formPingAgentId: string
  setFormPingAgentId: (value: string) => void
  agents: Agent[]
  loadingAgents: boolean
}

export function PingAgentJobTemplate({
  formPingAgentId, setFormPingAgentId, agents, loadingAgents
}: PingAgentJobTemplateProps) {
  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="font-medium flex items-center gap-2">
        <Bot className="h-4 w-4" />
        Ping Agent Settings
      </h3>
      <div className="space-y-2">
        <Label>Cockpit Agent</Label>
        <Select value={formPingAgentId} onValueChange={setFormPingAgentId} disabled={loadingAgents}>
          <SelectTrigger>
            <SelectValue placeholder="Select agent..." />
          </SelectTrigger>
          <SelectContent>
            {agents.map(agent => (
              <SelectItem key={agent.agent_id} value={agent.agent_id}>
                {agent.hostname} ({agent.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

**Agent data source:** Fetch from `GET /api/cockpit-agent/list` — returns `{ agents: [{agent_id, hostname, status, ...}] }`.
Create a TanStack Query hook similar to the existing agent list hooks, or inline the fetch in a `useEffect`.
The `DeployAgentJobTemplate.tsx` component already does this exact fetch at `/api/proxy/cockpit-agent/list` — copy its pattern.

---

### 6. Frontend — Wire Into `template-form-dialog.tsx`

Six touch points in `frontend/src/components/features/jobs/templates/components/template-form-dialog.tsx`:

#### 6a. Import the new component
```tsx
import { PingAgentJobTemplate } from './template-types/PingAgentJobTemplate'
```

#### 6b. Add state variables
```tsx
const [formPingAgentId, setFormPingAgentId] = useState('')
// (agents list can be fetched inside PingAgentJobTemplate or via a hook here)
```

#### 6c. Add to `resetForm()`
```tsx
setFormPingAgentId('')
```

#### 6d. Add to the `useEffect` that loads editing template data
```tsx
setFormPingAgentId(editingTemplate.ping_agent_id || '')
```

#### 6e. Add validation in `isFormValid()`
```ts
if (formJobType === 'ping_agent') {
  if (!formPingAgentId) return false
}
```

Also, update the inventory exclusion list (line ~723) — `ping_agent` DOES use inventory, so do NOT add it to the exclusion list. The inventory section will show up automatically.

#### 6f. Add to the `payload` object in `handleSubmit()`
```tsx
ping_agent_id: formJobType === 'ping_agent' ? formPingAgentId : undefined,
```

#### 6g. Render the type-specific section
Add after the existing job type blocks:
```tsx
{formJobType === 'ping_agent' && (
  <PingAgentJobTemplate
    formPingAgentId={formPingAgentId}
    setFormPingAgentId={setFormPingAgentId}
    agents={agents}          // fetched inside component or from a hook
    loadingAgents={false}
  />
)}
```

---

### 7. Frontend — `JobTemplate` Type Definition

**File:** `frontend/src/components/features/jobs/templates/types/index.ts`

Add to the `JobTemplate` interface:
```ts
ping_agent_id?: string | null
```

---

## Full Data Flow for Scheduled Ping

```
User creates Job Template:
  - job_type = "ping_agent"
  - ping_agent_id = "my-agent"
  - inventory_source = "inventory"
  - inventory_name = "Production Routers"

User creates Job Schedule pointing to that template.

Celery Beat fires at scheduled time:
  check_job_schedules_task → dispatch_job.delay(
      schedule_id=N, template_id=M,
      job_name="Ping - Production Routers",
      job_type="ping_agent"
  )

dispatch_job task:
  1. Creates JobRun (status=pending)
  2. Calls execute_ping_agent(
       template={"ping_agent_id": "my-agent", "inventory_name": "Production Routers", ...},
       job_parameters={}
     )

execute_ping_agent:
  1. agent_id = template["ping_agent_id"]   → "my-agent"
  2. devices = job_parameters["devices"]    → None (not pre-resolved)
  3. inventory_id = job_parameters["inventory_id"] → None
  4. Falls into _resolve_devices_from_inventory() using inventory_name
     (need to add inventory_name resolution — see note below)
  5. Sends ping via CockpitAgentService
  6. Returns structured result

dispatch_job:
  3. Marks JobRun as completed with ping result JSON
```

### Note on Inventory Resolution in Executor

Currently the executor resolves inventory by `inventory_id`. For the scheduled template path,
you also need resolution by `inventory_name`. Add this to `ping_agent_executor.py`:

```python
# After the devices/inventory_id extraction:
inventory_name: Optional[str] = params.get("inventory_name") or tmpl.get("inventory_name")

if not devices and not inventory_id and inventory_name:
    import service_factory
    persistence_svc = service_factory.build_inventory_persistence_service()
    inv = persistence_svc.get_inventory_by_name(inventory_name, "celery_scheduler")
    if inv:
        inventory_id = inv.get("id")
```

This is the same pattern used by `deploy_agent_executor.py` (lines ~107–122).

---

## File Checklist for Implementation

| # | File | Action |
|---|------|--------|
| 1 | `backend/migrations/versions/024_add_ping_agent_job_template.py` | Create |
| 2 | `backend/core/models.py` | Add `ping_agent_id` column to `JobTemplate` |
| 3 | `backend/models/job_templates.py` | Add `ping_agent_id` field to Pydantic models |
| 4 | `backend/tasks/execution/ping_agent_executor.py` | Add `inventory_name` fallback resolution |
| 5 | `frontend/.../template-types/PingAgentJobTemplate.tsx` | Create agent selector component |
| 6 | `frontend/.../template-form-dialog.tsx` | Wire state, validation, payload, render |
| 7 | `frontend/.../templates/types/index.ts` | Add `ping_agent_id` to `JobTemplate` interface |

No changes needed to:
- `tasks/execution/base_executor.py` (already done)
- `tasks/__init__.py` (dispatch_job handles all job types)
- `celery_app.py` (routing via dispatch_job)
- Job result dialog / viewer (already done)
- Job type constants (already done)

---

## Key File Locations Reference

```
backend/
  core/models.py                              # SQLAlchemy JobTemplate table
  models/job_templates.py                     # Pydantic schemas
  tasks/execution/ping_agent_executor.py      # Celery executor (already done)
  tasks/execution/base_executor.py            # Job type → executor mapping
  migrations/versions/                        # Migration files (next: 024_...)
  migrations/base.py                          # BaseMigration pattern

frontend/src/components/features/jobs/
  templates/
    components/
      template-form-dialog.tsx                # Main form (6 touch points)
      template-types/
        PingAgentJobTemplate.tsx              # New — agent selector section
        DeployAgentJobTemplate.tsx            # Reference for agent list fetch pattern
    types/index.ts                            # JobTemplate interface
    utils/constants.ts                        # JOB_TYPE_LABELS (ping_agent already added)
  view/
    results/ping-agent-result.tsx             # Result viewer (already done)
    types/job-results.ts                      # Type guards (already done)
    dialogs/job-result-dialog.tsx             # Result routing (already done)
```
