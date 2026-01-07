# Cockpit-NG - Technical Reference

## Overview
Network management dashboard for NetDevOps with Nautobot & CheckMK integration, RBAC, OIDC/SSO, and network automation.

## Tech Stack

**Frontend:** Next.js 15.4.7 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Shadcn UI, Zustand, Lucide Icons
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
- **Frontend**: `kebab-case` dirs, `PascalCase` components (`bulk-edit/`, `BulkEditDialog.tsx`)
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
- `/frontend/src/hooks/use-api.ts` - API calling hook
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

# Permission required
@router.post("/users", dependencies=[Depends(require_permission("users", "write"))])
async def create_user():
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
3. Add sidebar link in `/components/layout/app-sidebar.tsx`
4. Call backend via `/api/proxy/{endpoint}`

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

## Key Patterns Summary

**Backend:**
- Repository pattern for data access
- Service layer for business logic
- Thin routers that delegate to services
- Dependency injection for auth/permissions
- SQLAlchemy ORM (no raw SQL)

**Frontend:**
- Feature-based organization
- Server Components by default
- API calls via `/api/proxy/*`
- Shadcn UI for all components
- Zustand for client state
- react-hook-form + zod for forms

**Database:**
- Single PostgreSQL database
- Auto-migrations via schema_manager
- All models in `/backend/core/models.py`
- Connection pooling + health checks

**Authentication:**
- JWT tokens in cookies
- Permission format: `resource:action`
- Backend: `Depends(require_permission("resource", "action"))`
- Frontend: Check `useAuthStore()` user role

## INCORRECT Practices (NEVER DO)
- ❌ Creating SQLite databases
- ❌ Placing components at `/components/` root without feature grouping
- ❌ Writing raw SQL instead of SQLAlchemy ORM
- ❌ Bypassing repository pattern
- ❌ Business logic in routers
- ❌ Direct backend API calls from frontend
- ❌ Inline GraphQL queries in components
- ❌ Building UI from scratch instead of using Shadcn
- ❌ Using inline array/object literals in default params
- ❌ Custom hooks without memoized returns
- ❌ Missing or incomplete useEffect dependencies
