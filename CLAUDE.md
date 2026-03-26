# Cockpit-NG - Technical Reference

## Overview
Network management dashboard for NetDevOps with Nautobot & CheckMK integration, RBAC, OIDC/SSO, and network automation.

## Tech Stack

**Frontend:** Next.js 15.5.12 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Shadcn UI, TanStack Query v5, Zustand, Lucide Icons
**Backend:** FastAPI, Python 3.9+, PostgreSQL, SQLAlchemy, JWT auth, Celery/Beat, Netmiko, Ansible, GitPython
**Integrations:** Nautobot API, CheckMK, OIDC multi-provider

## Architecture

### Core Principles
- **Complete separation**: Frontend (port 3000) ↔ Backend (port 8000)
- **API proxy pattern**: Frontend → Next.js `/api/proxy/*` → Backend (NEVER direct backend calls)
- **PostgreSQL single database** with 40+ tables (defined in `/backend/core/models.py`)
- **Layered backend**: Model → Repository → Service → Router
- **Feature-based organization**: Group by domain, not by technical role
- **Server Components default**: Use `'use client'` only when necessary

## CRITICAL: Architectural Standards

**MANDATORY for all new features:**

### Backend Layer Pattern
```
1. SQLAlchemy Model    → /backend/core/models.py (tables, indexes, relationships)
2. Pydantic Models     → /backend/models/{domain}.py (request/response schemas)
3. Repository          → /backend/repositories/{domain}_repository.py (data access)
4. Service             → /backend/services/{domain}_service.py (business logic)
5. Router              → /backend/routers/{domain}.py (HTTP endpoints)
6. Register in main.py → app.include_router({domain}_router)
```

### Frontend Structure
```
/components/features/{domain}/
  ├── components/     # Feature-specific components
  ├── constants/      # Constants (if any)
  ├── hooks/          # Custom hooks (use-{name}.ts)
  ├── dialogs/        # Modal dialogs
  ├── tabs/           # Tab components
  ├── types/          # TypeScript types
  └── utils/          # Utility functions

/app/(dashboard)/{feature}/page.tsx  # Route pages
```

### Naming Conventions
- **Database**: `snake_case` (tables: `job_templates`, columns: `created_at`)
- **Backend**: `snake_case` (files: `user_repository.py`, functions: `create_user()`)
- **Frontend**: `kebab-case` dirs and component files (`bulk-edit/`, `bulk-edit-dialog.tsx`)
- **Models**: `PascalCase` (`JobTemplate`, `UserProfile`)

### Database Requirements
- ✅ Define tables as SQLAlchemy models in `/backend/core/models.py`
- ✅ Add indexes, foreign keys, timestamps (`created_at`, `updated_at`)
- ✅ Use repository pattern (BaseRepository in `/backend/repositories/base.py`)
- ❌ NEVER use SQLite or raw SQL queries
- ❌ NEVER bypass repository layer

## Key File Locations

**Backend Core:**
- `/backend/core/models.py` - All SQLAlchemy table definitions
- `/backend/core/database.py` - DB session, get_db() dependency
- `/backend/core/auth.py` - verify_token, require_permission, verify_admin_token
- `/backend/main.py` - FastAPI app, router registration

**Frontend Core:**
- `/frontend/src/lib/auth-store.ts` - Zustand auth state
- `/frontend/src/lib/query-client.ts` - TanStack Query configuration
- `/frontend/src/lib/query-keys.ts` - Query key factory (hierarchical)
- `/frontend/src/hooks/use-api.ts` - API calling hook
- `/frontend/src/hooks/queries/*` - TanStack Query hooks
- `/frontend/src/app/api/proxy/[...path]/route.ts` - Backend proxy
- `/frontend/src/components/ui/*` - Shadcn UI primitives

## Authentication & Authorization

### JWT Token Structure
```python
{
  "sub": "username",
  "user_id": 123,
  "permissions": 15,  # Bitmask
  "exp": 1234567890
}
```

### Permission Pattern
Format: `{resource}:{action}` (e.g., `users:read`, `settings:write`, `devices:delete`)

### Backend Auth Dependencies
```python
from core.auth import verify_token, require_permission, verify_admin_token

# Basic auth
@router.get("/data")
async def get_data(user: dict = Depends(verify_token)):
    pass

# Permission required (format: "resource" or "resource.subresource", action)
@router.post("/users", dependencies=[Depends(require_permission("users", "write"))])
async def create_user():
    pass

@router.get("/devices", dependencies=[Depends(require_permission("nautobot.devices", "read"))])
async def get_devices():
    pass

# Admin only
@router.delete("/critical")
async def delete_critical(user: dict = Depends(verify_admin_token)):
    pass
```

### Frontend Auth
```typescript
import { useAuthStore } from '@/lib/auth-store'
const user = useAuthStore(state => state.user)
const token = useAuthStore(state => state.token)

// API calls via proxy
fetch('/api/proxy/users', {
  headers: { 'Authorization': `Bearer ${token}` }
})
```

## Database Schema (Key Tables)

**Users & RBAC:** `users`, `roles`, `permissions`, `role_permissions`, `user_roles`
**Settings:** `settings`, `nautobot_settings`, `checkmk_settings`, `git_settings`, `celery_settings`
**Credentials:** `credentials`, `login_credentials`, `snmp_mapping`
**Jobs:** `job_templates`, `job_schedules`, `job_runs`
**Git:** `git_repositories`, `templates`, `template_versions`
**Compliance:** `compliance_rules`, `compliance_checks`, `regex_patterns`
**Sync:** `nb2cmk_sync`, `nb2cmk_jobs`, `nb2cmk_job_results`
**Inventory:** `inventories`
**Snapshots:** `snapshots`, `snapshot_command_templates`, `snapshot_commands`, `snapshot_results`
**Audit & Agents:** `audit_logs`, `cockpit_agent_commands`

## UI/UX Standards

### MUST Use Shadcn UI
```bash
npx shadcn@latest add {component}  # button, dialog, table, form, etc.
```

**DO:**
- ✅ Use Shadcn components for ALL UI primitives
- ✅ Use Tailwind utility classes (`bg-background`, `text-foreground`, NOT `bg-blue-500`)
- ✅ Use Lucide React icons (`import { Check, X } from "lucide-react"`)
- ✅ Forms with react-hook-form + zod validation
- ✅ Toast notifications (`useToast()` hook)
- ✅ Mobile-first responsive design
- ✅ Proper ARIA labels and accessibility

**DON'T:**
- ❌ Build UI from scratch when Shadcn exists
- ❌ Use arbitrary colors or inline styles
- ❌ Mix other UI libraries
- ❌ Use `alert()` or `confirm()` (use Dialog/AlertDialog)

### Common Patterns
```typescript
// Button variants
<Button variant="default|secondary|destructive|outline|ghost|link">

// Dialog
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Form
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

// Toast
import { useToast } from "@/hooks/use-toast"
const { toast } = useToast()
toast({ title: "Success", description: "Done!" })
```

## GraphQL Integration

**Always use centralized service:** `/frontend/src/services/nautobot-graphql.ts`

```typescript
// Add to service file
export const MY_QUERY = `query { ... }`
export interface GraphQLMyData { ... }
export async function fetchMyData(apiCall) { ... }

// Use in component
import { fetchMyData } from '@/services/nautobot-graphql'
const result = await fetchMyData(apiCall)
```

❌ DON'T create inline GraphQL queries or dedicated backend endpoints for each query

## TanStack Query (Data Fetching & Caching)

**MANDATORY for all data fetching:** Use TanStack Query instead of manual state management

### Core Principles
- **Declarative data fetching**: Query hooks replace manual useState/useEffect
- **Automatic caching**: Data persists across navigation, reduces API calls
- **Background refetch**: Fresh data on window focus/reconnect
- **Centralized keys**: Use query key factory for type-safe invalidation
- **Smart polling**: Auto-start/stop based on data state

### Query Hook Pattern

```typescript
// 1. Add query keys to /frontend/src/lib/query-keys.ts
export const queryKeys = {
  myFeature: {
    all: ['myFeature'] as const,
    list: (filters?: { status?: string }) =>
      filters
        ? ([...queryKeys.myFeature.all, 'list', filters] as const)
        : ([...queryKeys.myFeature.all, 'list'] as const),
    detail: (id: string) => [...queryKeys.myFeature.all, 'detail', id] as const,
  },
}

// 2. Create hook in /frontend/src/hooks/queries/use-my-feature-query.ts
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface UseMyFeatureQueryOptions {
  filters?: { status?: string }
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseMyFeatureQueryOptions = {}

export function useMyFeatureQuery(options: UseMyFeatureQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { filters, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.myFeature.list(filters),
    queryFn: async () => apiCall('my-feature', { method: 'GET' }),
    enabled,
    staleTime: 30 * 1000,  // Cache for 30s
  })
}

// 3. Use in component
const { data, isLoading, error, refetch } = useMyFeatureQuery({
  filters: { status: 'active' }
})
const items = data?.items || []
```

### Mutation Hook Pattern

```typescript
// Create mutations in /frontend/src/hooks/queries/use-my-feature-mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'

export function useMyFeatureMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createItem = useMutation({
    mutationFn: async (data: CreateItemInput) => {
      return apiCall('my-feature', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    onSuccess: () => {
      // Automatic cache invalidation → triggers refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.myFeature.list() })
      toast({
        title: 'Success',
        description: 'Item created!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  return { createItem, updateItem, deleteItem }
}
```

### Polling Pattern (Jobs/Tasks)

```typescript
export function useJobQuery(taskId: string) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(taskId),
    queryFn: () => fetchJob(taskId),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2000  // Keep polling

      // Auto-stop when job completes
      if (['SUCCESS', 'FAILURE', 'REVOKED'].includes(data.status)) {
        return false
      }

      return 2000  // Continue polling every 2s
    },
    staleTime: 0,  // Always fetch fresh
  })
}
```

### Optimistic Updates (Instant UI Feedback)

```typescript
const syncRepository = useMutation({
  mutationFn: async (id) => apiCall(`git/${id}/sync`, { method: 'POST' }),

  // Run BEFORE API call
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.git.repositories() })
    const previous = queryClient.getQueryData(queryKeys.git.repositories())

    // Update UI immediately
    queryClient.setQueryData(queryKeys.git.repositories(), (old) => ({
      ...old,
      repositories: old.repositories.map((r) =>
        r.id === id ? { ...r, sync_status: 'syncing' } : r
      )
    }))

    return { previous }  // For rollback
  },

  // Rollback on error
  onError: (err, id, context) => {
    queryClient.setQueryData(queryKeys.git.repositories(), context?.previous)
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
  }
})
```

### DO:
- ✅ Use centralized query key factory (`queryKeys`)
- ✅ Create dedicated hooks for each resource
- ✅ Use `DEFAULT_OPTIONS = {}` constant for default params
- ✅ Invalidate affected queries after mutations
- ✅ Match `staleTime` to data volatility (5min for static, 30s for semi-static, 0 for polling)
- ✅ Use `useMemo` for derived state (not `useState`)
- ✅ Enable `refetchOnWindowFocus` for network monitoring

### DON'T:
- ❌ Use manual `useState + useEffect` for server data
- ❌ Use inline query keys (always use `queryKeys` factory)
- ❌ Store query data in `useState` (use `useMemo` for derived state)
- ❌ Forget to invalidate cache after mutations
- ❌ Use inline object literals as default params (`= {}` creates new object every render)

### Documentation:
- **Best Practices**: `/frontend/src/hooks/queries/BEST_PRACTICES.md`
- **Optimistic Updates**: `/frontend/src/hooks/queries/OPTIMISTIC_UPDATES.md`

## React Best Practices (CRITICAL - Prevents Infinite Loops)

### MUST Follow to Prevent Re-render Loops

**1. Default Parameters - Use Constants**
```typescript
// ❌ WRONG - Creates new array every render
function Component({ items = [] }) { }

// ✅ CORRECT
const EMPTY_ARRAY: string[] = []
function Component({ items = EMPTY_ARRAY }) { }
```

**2. Custom Hooks - Memoize Returns**
```typescript
// ❌ WRONG - New object every render
export function useMyHook() {
  const [state, setState] = useState()
  return { state, setState }  // New object!
}

// ✅ CORRECT
export function useMyHook() {
  const [state, setState] = useState()
  return useMemo(() => ({ state, setState }), [state])
}
```

**3. useEffect Dependencies - MUST Be Stable**
```typescript
// ❌ WRONG
const config = { key: 'value' }
useEffect(() => doSomething(config), [config])  // Runs every render!

// ✅ CORRECT
const DEFAULT_CONFIG = { key: 'value' }  // Outside component
useEffect(() => doSomething(DEFAULT_CONFIG), [])

// OR for dynamic values
const config = useMemo(() => ({ key: someValue }), [someValue])
useEffect(() => doSomething(config), [config])
```

**4. Callbacks to Hooks - ALWAYS useCallback**
```typescript
// ❌ WRONG
const { data } = useMyHook({
  onChange: () => doSomething()  // New function every render!
})

// ✅ CORRECT
const handleChange = useCallback(() => doSomething(), [])
const { data } = useMyHook({ onChange: handleChange })
```

**5. Exhaustive Dependencies - ALWAYS Include All**
```typescript
// ❌ WRONG
useEffect(() => {
  if (isReady) loadData(userId)
}, [])  // Missing dependencies!

// ✅ CORRECT
useEffect(() => {
  if (isReady) loadData(userId)
}, [isReady, userId, loadData])
```

**Enforcement:** ESLint rules + pre-commit hooks block non-compliant code

## Environment Variables

**Backend** (`.env`):
```bash
SECRET_KEY=change-in-production  # JWT signing
BACKEND_SERVER_HOST=127.0.0.1
BACKEND_SERVER_PORT=8000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=cockpit
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
INITIAL_USERNAME=admin
INITIAL_PASSWORD=admin
```

**Frontend** (`.env.local`):
```bash
BACKEND_URL=http://localhost:8000  # Used by Next.js proxy
PORT=3000
```

## Common Tasks

### Adding New Backend Endpoint
1. Define SQLAlchemy model in `/backend/core/models.py`
2. Create Pydantic models in `/backend/models/{domain}.py`
3. Create repository in `/backend/repositories/{domain}_repository.py`
4. Create service in `/backend/services/{domain}_service.py`
5. Create router in `/backend/routers/{domain}.py` with auth dependencies
6. Register router in `/backend/main.py`

### Adding New Frontend Page
1. Create page in `/app/(dashboard)/{path}/page.tsx`
2. Create feature components in `/components/features/{domain}/`
3. Add query keys to `/lib/query-keys.ts`
4. Create TanStack Query hooks in `/hooks/queries/use-{domain}-query.ts`
5. Add sidebar link in `/components/layout/app-sidebar.tsx`
6. Use query hooks in components (NOT manual `useState + useEffect`)

### Adding New Permission
1. UI: `/settings/permissions` → Add Permission → Assign to roles
2. Code: Use `require_permission("resource", "action")` in routers

## Security Checklist
- ✅ Change `SECRET_KEY` and default admin password
- ✅ All backend endpoints use JWT auth
- ✅ Frontend always uses `/api/proxy/*` (never direct backend)
- ✅ Validate inputs with Pydantic models
- ✅ Check permissions with `require_permission()`
- ✅ Use HTTPS in production
- ✅ Never commit `.env` files

## Development Workflow
```bash
# Terminal 1 - Backend
cd backend && python start.py

# Terminal 2 - Frontend
cd frontend && npm run dev

# Default credentials: admin/admin
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

When implementing configuration changes, include verification steps that confirm the change works (e.g., run a quick test, check logs, or validate config loads)

## Nautobot Services Architecture

**IMPORTANT:** Nautobot services follow a specialized pattern for external API integration.

### Architecture Overview
Nautobot services wrap an **external API client** (not local database), so the traditional Repository pattern doesn't apply. Instead, use a modular service layer with dependency injection.

### Directory Structure
```
backend/services/nautobot/
├── client.py                  # NautobotService API client (GraphQL + REST)
├── common/                    # Pure functions (no dependencies)
│   ├── validators.py          # is_valid_uuid, validate_ip_address, etc.
│   ├── utils.py               # flatten_nested_fields, normalize_tags, etc.
│   └── exceptions.py          # Custom exception hierarchy
│
├── resolvers/                 # ID/UUID resolution (read-only)
│   ├── base_resolver.py       # Shared GraphQL query logic
│   ├── device_resolver.py     # Device & device-type resolution
│   ├── metadata_resolver.py   # Status, role, platform, location
│   └── network_resolver.py    # IP, interface, namespace, prefix
│
├── managers/                  # Resource lifecycle (create/update)
│   ├── ip_manager.py          # IP address operations
│   ├── interface_manager.py   # Interface operations
│   ├── prefix_manager.py      # Prefix operations
│   └── device_manager.py      # Device-specific operations
│
└── devices/
    ├── common.py              # Unified facade (recommended for device operations)
    ├── creation.py            # Device creation workflows
    ├── update.py              # Device update workflows
    └── import_service.py      # Bulk device import
```

### Usage Pattern

**✅ RECOMMENDED - Use Facade for Device Operations:**
```python
from services.nautobot import NautobotService
from services.nautobot.devices.common import DeviceCommonService

class MyDeviceService:
    def __init__(self, nautobot_service: NautobotService):
        self.nautobot = nautobot_service
        self.common = DeviceCommonService(nautobot_service)

    async def my_operation(self):
        # All device operations available through facade
        device_id = await self.common.resolve_device_by_name("router1")
        status_id = await self.common.resolve_status_id("active")

        ip_id = await self.common.ensure_ip_address_exists(
            ip_address="10.0.0.1/24",
            namespace_id="...",
            status_name="active"
        )
```

**✅ ALTERNATIVE - Direct Injection (for specialized use cases):**

Use this when you only need specific components or want fine-grained control:

```python
from services.nautobot import NautobotService
from services.nautobot.resolvers import DeviceResolver, MetadataResolver
from services.nautobot.managers import IPManager

class MySpecializedService:
    def __init__(self, nautobot_service: NautobotService):
        self.nautobot = nautobot_service
        # Only inject what you need
        self.device_resolver = DeviceResolver(nautobot_service)
        self.metadata_resolver = MetadataResolver(nautobot_service)
```

### Pure Functions vs. Services

**Pure Functions** (no dependencies, stateless):
```python
from services.nautobot.common import is_valid_uuid, validate_ip_address, normalize_tags

# Can be called directly - no service instance needed
if is_valid_uuid(some_id):
    tags = normalize_tags("tag1,tag2,tag3")
```

**Resolvers** (read-only, injected with NautobotService):
```python
from services.nautobot.resolvers import DeviceResolver

resolver = DeviceResolver(nautobot_service)
device_id = await resolver.resolve_device_by_name("router1")
```

**Managers** (create/update, injected with dependencies):
```python
from services.nautobot.managers import IPManager
from services.nautobot.resolvers import NetworkResolver, MetadataResolver

network_resolver = NetworkResolver(nautobot_service)
metadata_resolver = MetadataResolver(nautobot_service)

ip_manager = IPManager(nautobot_service, network_resolver, metadata_resolver)
ip_id = await ip_manager.ensure_ip_address_exists(...)
```

### When to Create New Nautobot Services

1. **Add to existing resolver** if it's a simple ID/name lookup
2. **Add to existing manager** if it's CRUD for an existing resource type
3. **Create new resolver** if you need a new domain of lookups (e.g., `VLANResolver`)
4. **Create new manager** if you need lifecycle management for a new resource type
5. **Update `devices/common.py`** to expose new resolver/manager methods through the facade

### DO:
- ✅ Use `DeviceCommonService` facade for device operations (simplifies dependency management)
- ✅ Use pure functions from `common/` for validation/transformation
- ✅ Follow Single Responsibility Principle in resolvers/managers
- ✅ Use BaseResolver for common GraphQL patterns
- ✅ Add type hints to all functions
- ✅ Use direct injection when you need only 1-2 specific components
- ✅ Always use type hints in constructor; All manager constructors use the `TYPE_CHECKING` pattern:

### DON'T:
- ❌ Put business logic in resolvers (read-only only)
- ❌ Bypass managers for create/update operations
- ❌ Create monolithic service classes
- ❌ Mix validation logic with API calls

## Key Patterns Summary

**Backend:**
- Repository pattern for data access (local PostgreSQL)
- Resolver + Manager pattern for external APIs (Nautobot, CheckMK)
- Service layer for business logic
- Thin routers that delegate to services
- Dependency injection for auth/permissions
- SQLAlchemy ORM (no raw SQL)

**Frontend:**
- Feature-based organization
- Server Components by default
- API calls via `/api/proxy/*`
- TanStack Query for server state (data fetching, caching, mutations)
- Zustand for client-only state (UI state, preferences)
- Shadcn UI for all components
- react-hook-form + zod for forms

**Database:**
- Single PostgreSQL database
- use complete migration framework to migrate database (./doc/MIGRATION_SYSTEM.md)
- All models in `/backend/core/models.py`
- Connection pooling + health checks

**Authentication:**
- JWT tokens in cookies
- Permission format: `resource:action`
- Backend: `Depends(require_permission("resource", "action"))`
- Frontend: Check `useAuthStore()` user role

## INCORRECT Practices (NEVER DO)

**Backend:**
- ❌ Creating SQLite databases
- ❌ Writing raw SQL instead of SQLAlchemy ORM
- ❌ Bypassing repository pattern for local database
- ❌ Business logic in routers
- ❌ Creating monolithic God Object services (note: DeviceCommonService is a facade, not a God Object)
- ❌ Mixing validation/transformation logic with API calls
- ❌ using f-string in Logging

**Frontend:**
- ❌ Placing components at `/components/` root without feature grouping
- ❌ Direct backend API calls from frontend
- ❌ Inline GraphQL queries in components
- ❌ Building UI from scratch instead of using Shadcn
- ❌ Using inline array/object literals in default params
- ❌ Custom hooks without memoized returns
- ❌ Missing or incomplete useEffect dependencies
- ❌ Manual `useState + useEffect` for server data (use TanStack Query)
- ❌ Inline query keys (always use `queryKeys` factory)
- ❌ Storing query data in `useState` (use `useMemo` for derived state)
- ❌ Forgetting to invalidate cache after mutations

## Suggested CLAUDE.md Additions

## Task Completion

When removing features or debugging issues, always complete the full removal/fix cycle including: 1) Remove all related code, 2) Update configuration files, 3) Clean up imports/dependencies, 4) Verify no references remain with grep

## Python Conventions

For Python/Celery projects: Always add inline documentation comments when modifying queue configurations, task decorators, or worker settings


