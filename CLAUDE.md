# Cockpit-NG - Tech Stack and File Structure

## Overview

Cockpit-NG is a modern network management dashboard designed for network engineers and NetDevOps teams. It provides a comprehensive platform for managing network devices, configurations, and automation workflows with seamless integration to Nautobot and CheckMK. The application features authentication, user management, role-based access control (RBAC), OIDC/SSO support, and extensive network automation capabilities.

## Tech Stack

### Frontend
- **Framework**: Next.js 15.4.7 with App Router
- **Language**: TypeScript 5
- **UI Framework**: React 19.1.0
- **Styling**: Tailwind CSS 4
- **UI Components**: Shadcn UI (built on Radix UI)
- **State Management**: Zustand 5.0 for client-side state
- **Icons**: Lucide React
- **HTTP Client**: Native fetch API
- **Cookies**: js-cookie for cookie management
- **Development**: Turbopack for fast refresh

### Backend
- **Framework**: FastAPI (Python)
- **Language**: Python 3.9+
- **Database**: SQLite (dual databases - users.db and rbac.db)
- **ORM**: SQLAlchemy
- **Authentication**: JWT tokens with passlib for password hashing
- **Validation**: Pydantic models
- **CORS**: Configured for frontend communication
- **Task Scheduling**: APScheduler for background jobs
- **Network Automation**: 
  - Netmiko for device connections
  - Ansible for configuration management
  - Git operations (GitPython)
- **External Integrations**:
  - Nautobot API client
  - CheckMK integration
- **OIDC**: OpenID Connect (OIDC) multi-provider support
- **Template Engine**: Jinja2 for configuration templates

## Architecture

### Separation of Concerns
- **Frontend and Backend are completely separated**
- Frontend runs on port 3000 (Next.js)
- Backend runs on port 8000 (FastAPI)
- Frontend uses Next.js API routes as proxy/middleware to communicate with backend
- All backend endpoints require authentication (JWT tokens)

### Database Structure
Two separate SQLite databases:
- `data/settings/users.db` - User accounts and authentication
- `data/settings/rbac.db` - Roles, permissions, and access control

## File Structure

### Frontend (`/frontend`)

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── layout.tsx               # Root layout with providers
│   │   ├── page.tsx                 # Home/dashboard page
│   │   ├── globals.css              # Global styles
│   │   ├── api/                     # Next.js API routes (proxy to backend)
│   │   │   └── proxy/              # Backend proxy endpoints
│   │   ├── auth/                    # Auth-related pages
│   │   ├── login/                   # Login page and callbacks
│   │   │   ├── page.tsx            # Main login page
│   │   │   ├── callback/           # OAuth callbacks
│   │   │   └── approval-pending/   # Pending approval page
│   │   ├── profile/                 # User profile page
│   │   │   └── page.tsx
│   │   └── settings/                # Settings section
│   │       ├── layout.tsx          # Settings layout
│   │       ├── page.tsx            # Settings home
│   │       └── permissions/        # User & role management
│   │
│   ├── components/                  # React components
│   │   ├── app-sidebar.tsx         # Main application sidebar
│   │   ├── dashboard-layout.tsx    # Dashboard wrapper component
│   │   ├── dashboard-overview.tsx  # Dashboard home page
│   │   ├── session-status.tsx      # Session status indicator
│   │   ├── sidebar-context.tsx     # Sidebar state management
│   │   ├── auth/                   # Authentication components
│   │   │   └── auth-hydration.tsx  # Auth state hydration
│   │   ├── profile/                # Profile components
│   │   │   └── profile-page.tsx
│   │   ├── settings/               # Settings components
│   │   │   ├── user-management.tsx
│   │   │   ├── permissions-management.tsx
│   │   │   ├── credentials-management.tsx
│   │   │   ├── git-management.tsx
│   │   │   ├── template-management.tsx
│   │   │   ├── checkmk-settings.tsx
│   │   │   ├── cache-management.tsx
│   │   │   └── permissions/        # Permission-related components
│   │   ├── netmiko/                # Network device command execution
│   │   │   ├── netmiko-page.tsx    # Main Netmiko interface
│   │   │   ├── hooks/              # Custom hooks for Netmiko
│   │   │   ├── components/         # Netmiko-specific components
│   │   │   ├── tabs/               # Tab components
│   │   │   ├── dialogs/            # Dialog components
│   │   │   └── utils/              # Utility functions
│   │   ├── ansible-inventory/      # Ansible inventory management
│   │   ├── backup/                 # Configuration backup
│   │   ├── checkmk/                # CheckMK integration UI
│   │   │   └── live-update-page.tsx
│   │   ├── compare/                # Configuration comparison
│   │   │   ├── file-compare.tsx
│   │   │   ├── git-compare.tsx
│   │   │   └── file-history-compare.tsx
│   │   ├── configs/                # Configuration management
│   │   │   └── configs-view-page.tsx
│   │   ├── onboard-device/         # Device onboarding
│   │   ├── offboard-device/        # Device offboarding
│   │   ├── scan-and-add/           # Network scanning
│   │   ├── sync-devices/           # Nautobot sync
│   │   ├── debug/                  # Debug utilities
│   │   ├── shared/                 # Shared/reusable components
│   │   │   └── device-selector.tsx
│   │   └── ui/                     # Shadcn UI primitives
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       └── ... (other UI components)
│   │
│   ├── contexts/                    # React contexts
│   │   └── debug-context.tsx       # Debug mode context
│   │
│   ├── hooks/                       # Custom React hooks
│   │   ├── use-api.ts              # API calling hook
│   │   ├── use-mobile.ts           # Mobile detection hook
│   │   ├── use-session-manager.ts  # Session management hook
│   │   └── use-toast.ts            # Toast notifications hook
│   │
│   ├── services/                    # Service layer for API integration
│   │   └── nautobot-graphql.ts     # Nautobot GraphQL queries and types
│   │
│   └── lib/                         # Utility libraries
│       ├── utils.ts                # General utilities
│       ├── auth-store.ts           # Zustand auth store
│       ├── auth-debug.ts           # Auth debugging utilities
│       ├── security.ts             # Security utilities
│       ├── local-fonts.ts          # Local font configuration
│       ├── air-gap-config.ts       # Air-gapped environment config
│       └── debug.ts                # Debug utilities
│
├── public/                          # Static assets
│   ├── avatars/                    # User avatar images
│   ├── fonts/                      # Local font files
│   │   ├── geist.css
│   │   └── geist-mono.css
│   └── airgap-fallback.css         # Fallback styles for air-gapped mode
│
├── components.json                  # Shadcn UI configuration
├── next.config.ts                   # Next.js configuration
├── tailwind.config.ts              # Tailwind CSS configuration
├── tsconfig.json                    # TypeScript configuration
├── package.json                     # Dependencies and scripts
└── postcss.config.mjs              # PostCSS configuration
```

### Backend (`/backend`)

```
backend/
├── main.py                          # FastAPI application entry point
├── config.py                        # Configuration settings
├── start.py                         # Production startup script
├── start_isolated.py               # Development startup script
├── health.py                        # Health check endpoints
├── requirements.txt                 # Python dependencies
│
├── core/                            # Core utilities and configuration
│   ├── __init__.py
│   ├── auth.py                     # JWT authentication utilities
│   └── config.py                   # Core configuration
│
├── models/                          # Pydantic models (request/response)
│   ├── __init__.py
│   ├── auth.py                     # Authentication models
│   ├── user_management.py          # User management models
│   └── rbac.py                     # RBAC models
│
├── routers/                         # API route handlers
│   ├── __init__.py
│   ├── auth.py                     # /auth/* endpoints (login, logout, etc.)
│   ├── profile.py                  # /profile/* endpoints
│   ├── user_management.py          # /users/* endpoints (CRUD)
│   ├── rbac.py                     # /rbac/* endpoints (roles, permissions)
│   ├── oidc.py                     # /oidc/* endpoints (OpenID Connect)
│   ├── nautobot.py                 # /nautobot/* endpoints (Nautobot API proxy)
│   ├── checkmk.py                  # /checkmk/* endpoints (CheckMK integration)
│   ├── nb2cmk.py                   # /nb2cmk/* endpoints (Nautobot to CheckMK sync)
│   ├── netmiko.py                  # /netmiko/* endpoints (device connections)
│   ├── ansible_inventory.py        # /ansible-inventory/* endpoints
│   ├── templates.py                # /templates/* endpoints (Jinja2 templates)
│   ├── credentials.py              # /credentials/* endpoints (encrypted credentials)
│   ├── git_repositories.py         # /git-repositories/* endpoints
│   ├── git_operations.py           # /git/* endpoints (Git operations)
│   ├── git_files.py                # /git-files/* endpoints
│   ├── git_compare.py              # /git-compare/* endpoints
│   ├── file_compare.py             # /file-compare/* endpoints
│   ├── jobs.py                     # /jobs/* endpoints (background jobs)
│   ├── cache.py                    # /cache/* endpoints (cache management)
│   ├── config.py                   # /config/* endpoints (YAML config files)
│   ├── settings.py                 # /settings/* endpoints (app settings)
│   ├── scan_and_add.py             # /scan-and-add/* endpoints (network scanning)
│   └── offboarding.py              # /offboarding/* endpoints (device offboarding)
│
├── services/                        # Business logic layer
│   ├── __init__.py
│   ├── user_management.py          # User management service
│   ├── oidc_service.py             # OIDC service
│   ├── nautobot.py                 # Nautobot API client service
│   ├── checkmk.py                  # CheckMK API service
│   ├── cmk_config_service.py       # CheckMK configuration service
│   ├── cmk_device_normalization_service.py  # Device normalization
│   ├── cmk_folder_service.py       # CheckMK folder management
│   ├── nb2cmk_base_service.py      # Nautobot to CheckMK base service
│   ├── nb2cmk_background_service.py # Background sync service
│   ├── nb2cmk_database_service.py  # Sync database operations
│   ├── netmiko_service.py          # Netmiko device connections
│   ├── ansible_inventory.py        # Ansible inventory generation
│   ├── render_service.py           # Jinja2 template rendering
│   ├── git_utils.py                # Git operations utilities
│   ├── git_shared_utils.py         # Shared Git utilities
│   ├── cache_service.py            # Caching service
│   ├── apscheduler_job_service.py  # Background job scheduling
│   ├── job_database_service.py     # Job persistence service
│   ├── network_scan_service.py     # Network scanning service
│   ├── scan_service.py             # Device scanning service
│   └── offboarding_service.py      # Device offboarding workflows
│
├── user_db_manager.py              # User database operations (SQLAlchemy)
├── rbac_manager.py                 # RBAC database operations
├── profile_manager.py              # Profile operations
├── credentials_manager.py          # Encrypted credential storage
├── template_manager.py             # Template storage and management
├── git_repositories_manager.py     # Git repository configuration
├── settings_manager.py             # Application settings manager
├── connection_tester.py            # Network connection testing
├── seed_rbac.py                    # RBAC initialization
└── checkmk/                        # CheckMK client library
    ├── __init__.py
    └── client.py                   # CheckMK API client
```

### Configuration (`/config`)

```
config/
├── oidc_providers.yaml             # OIDC providers configuration
├── oidc_providers.yaml.example     # OIDC config template
├── checkmk.yaml                    # CheckMK configuration
├── snmp_mapping.yaml               # SNMP device mapping
├── README.md                        # Configuration documentation
└── certs/                          # SSL certificates directory
    └── README.md
```

### Data (`/data`)

```
data/
└── settings/                        # Application data storage
    ├── users.db                    # User database (auto-created)
    └── rbac.db                     # RBAC database (auto-created)
```

### Documentation (`/doc`)

```
doc/
└── oidc/                           # OIDC implementation documentation
    ├── OIDC_IMPLEMENTATION_GUIDE.md
    ├── OIDC_SETUP.md
    ├── router/
    │   └── oidc.py                # OIDC router documentation
    └── services/
        └── oidc_service.py        # OIDC service documentation
```

## Key Architectural Patterns

### Authentication Flow
1. User submits credentials to frontend `/login` page
2. Frontend sends request to Next.js API route (`/api/proxy`)
3. Next.js proxy forwards to backend `/auth/login`
4. Backend validates credentials, generates JWT token
5. Token returned to frontend, stored in auth store (Zustand)
6. Subsequent requests include JWT in Authorization header

### API Communication Pattern
- Frontend **NEVER** calls backend directly
- All backend calls go through Next.js API routes (middleware/proxy)
- Example: `fetch('/api/proxy/users')` → proxied to → `http://localhost:8000/users`
- This enables SSR, security, and environment flexibility

### Component Structure
- Server Components by default (Next.js 15)
- Client Components marked with `'use client'` (minimal usage)
- Shared UI components in `/components/ui` (Shadcn)
- Feature components in feature-specific directories
- Layout components for page structure

### State Management
- Server-side: React Server Components (no state)
- Client-side: Zustand stores (auth-store.ts)
- Session management: use-session-manager hook
- Form state: React useState (local)

### Styling Approach
- Tailwind CSS utility-first approach
- Mobile-first responsive design
- Shadcn UI component variants
- CSS variables for theming (globals.css)
- Local fonts (no external CDN)

## Development Workflow

### Running the Application
1. **Start Backend** (Terminal 1):
   ```bash
   cd backend
   python start.py  # or start_isolated.py for dev
   ```

2. **Start Frontend** (Terminal 2):
   ```bash
   cd frontend
   npm run dev
   ```

### Default Credentials
- Username: `admin`
- Password: `admin`
- Change immediately in production!

## Important Notes

### Backend Communication
- All backend endpoints require authentication (JWT token)
- Frontend must use Next.js API routes as proxy
- Backend runs separately on port 8000
- CORS is configured to allow frontend origin

### Database Management
- Databases auto-create on first run
- SQLite files stored in `data/settings/`
- Separate databases for users and RBAC
- Use SQLAlchemy for all database operations

### Security Considerations
- JWT tokens for authentication
- Password hashing with passlib
- CORS configuration in main.py
- Environment variables for secrets
- Never commit .env files

### UI/UX Patterns
- Collapsible sidebar navigation
- Role-based menu visibility
- Toast notifications for feedback
- Loading states with Suspense
- Error boundaries for error handling
- Responsive mobile design

## Environment Variables & Configuration

### Backend Environment Variables (`.env`)

Located in `/backend/.env`. Copy from `/backend/.env.example`:

```bash
# Server Configuration
BACKEND_SERVER_HOST=127.0.0.1
BACKEND_SERVER_PORT=8000
DEBUG=false
LOG_LEVEL=INFO

# Authentication
SECRET_KEY=your-secret-key-change-in-production  # REQUIRED: Change in production!
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Initial Admin Credentials
INITIAL_USERNAME=admin
INITIAL_PASSWORD=admin

# Data Storage
DATA_DIRECTORY=../data  # Relative to backend directory
```

**Critical Settings**:
- `SECRET_KEY`: Must be changed in production. Used for JWT signing.
- `INITIAL_USERNAME/PASSWORD`: Creates default admin on first run. Change immediately!
- `BACKEND_SERVER_PORT`: Must match frontend's BACKEND_URL port

### Frontend Environment Variables (`.env.local`)

Located in `/frontend/.env.local`. Copy from `/frontend/.env.example`:

```bash
# Backend API URL (used by Next.js proxy)
BACKEND_URL=http://localhost:8000

# Development server port
PORT=3000
```

**Important**: 
- `BACKEND_URL` is used server-side by Next.js API routes
- Never expose backend URL directly to client
- Frontend always calls `/api/proxy/*` routes

### Air-Gapped/Offline Mode

For deployments without internet access, use `/frontend/.env.airgap`:

```bash
NEXT_PUBLIC_AIR_GAPPED=true
NEXT_PUBLIC_ANALYTICS_DISABLED=true
NEXT_PUBLIC_CDN_DISABLED=true
BACKEND_URL=http://localhost:8000
```

This enables:
- Local font loading (no Google Fonts CDN)
- Fallback CSS (`/public/airgap-fallback.css`)
- Disabled external analytics/tracking

## OIDC/SSO Authentication

### OIDC Configuration

OIDC is configured via YAML file (recommended) rather than environment variables.

**Configuration File**: `/config/oidc_providers.yaml`
**Example**: `/config/oidc_providers.yaml.example`
**Documentation**: `/doc/oidc/OIDC_SETUP.md`

### OIDC Structure

```
backend/
├── oidc_config.py          # YAML config loader
├── routers/oidc.py         # OIDC endpoints (/oidc/*)
└── services/oidc_service.py # OIDC business logic

config/
└── oidc_providers.yaml     # Provider configurations
```

### Key OIDC Functions

- `get_oidc_providers()`: Get all configured providers
- `get_oidc_provider(provider_id)`: Get specific provider config
- `get_enabled_oidc_providers()`: Get list of enabled providers
- `is_oidc_enabled()`: Check if any provider is enabled

### OIDC Flow

1. User clicks SSO login button (provider detected from config)
2. Frontend redirects to `/oidc/login/{provider_id}`
3. Backend redirects to OIDC provider for authentication
4. User authenticates with provider
5. Provider redirects to `/login/callback` with code
6. Backend exchanges code for tokens, creates/updates user
7. JWT token issued, user logged in

## Authentication & Authorization Patterns

### JWT Token Structure

Tokens contain:
```python
{
    "sub": "username",           # Subject (username)
    "user_id": 123,             # User ID
    "permissions": 15,          # Permission bitmask
    "exp": 1234567890           # Expiration timestamp
}
```

### Cookie Management

**Cookie Names**:
- `cockpit_auth_token`: JWT authentication token
- `cockpit_user_info`: Serialized user information (JSON)

**Cookie Configuration** (see `/frontend/src/lib/auth-store.ts`):
```typescript
{
  expires: 1,                    // 1 day
  secure: true,                  // Production only
  sameSite: 'strict'            // CSRF protection
}
```

**Hydration Pattern**:
- Server renders without auth state
- Client hydrates from cookies on mount
- Prevents SSR/client mismatch issues

### Dependency Injection (FastAPI)

**Basic Authentication** (`verify_token`):
```python
from core.auth import verify_token

@router.get("/protected")
async def protected_route(user_info: dict = Depends(verify_token)):
    # user_info contains: username, user_id, permissions
    return {"user": user_info["username"]}
```

**Permission-Based** (`require_permission`):
```python
from core.auth import require_permission

@router.get("/users", dependencies=[Depends(require_permission("users", "read"))])
async def list_users(current_user: dict = Depends(require_permission("users", "write"))):
    # Requires "users:write" permission
    # current_user contains user info if permission granted
    pass
```

**Multiple Permissions** (`require_any_permission`):
```python
from core.auth import require_any_permission

@router.get("/data")
async def get_data(user: dict = Depends(require_any_permission("data", ["read", "write"]))):
    # User needs either "data:read" OR "data:write"
    pass
```

**Admin Only** (`verify_admin_token`):
```python
from core.auth import verify_admin_token

@router.post("/admin/action")
async def admin_action(user: dict = Depends(verify_admin_token)):
    # Only users with full admin permissions
    pass
```

### Permission System Details

**Resource and Action Pattern**:
```
{resource}:{action}
```

**Standard Actions**:
- `read`: View/list resources
- `write`: Create/update resources
- `delete`: Remove resources
- `admin`: Full control over resource

**Common Resources**:
- `users`: User management
- `settings`: Application settings
- `rbac`: Role and permission management

**Example Permissions**:
- `users:read` - View user list
- `users:write` - Create/edit users
- `users:delete` - Delete users
- `settings:admin` - Full settings control

**Checking Permissions in Backend**:
```python
import rbac_manager as rbac

# Check if user has permission
if rbac.has_permission(user_id, "users", "write"):
    # Allow action
    pass
```

**Checking Permissions in Frontend**:
```typescript
// Check user's role or permissions from auth store
import { useAuthStore } from '@/lib/auth-store'

const user = useAuthStore(state => state.user)
if (user?.role === 'admin') {
  // Show admin UI
}
```

## API Proxy Pattern

### Proxy Architecture

**Flow**: Frontend → Next.js API Route → Backend API

```
Client Request:  fetch('/api/proxy/users')
                      ↓
Next.js Proxy:   /api/proxy/[...path]/route.ts
                      ↓
Backend API:     http://localhost:8000/users
```

### Proxy Implementation

Located at: `/frontend/src/app/api/proxy/[...path]/route.ts`

**Key Features**:
- Forwards all HTTP methods (GET, POST, PUT, DELETE, PATCH)
- Forwards Authorization header automatically
- Forwards Content-Type header
- Handles query parameters
- Returns backend response with proper status codes

**Example Proxy Usage**:
```typescript
// Frontend code
const response = await fetch('/api/proxy/users', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

### Adding New Proxy Endpoints

No changes needed! The `[...path]` catch-all route handles all paths automatically.

To add a new backend endpoint:
1. Create route in `/backend/routers/`
2. Frontend calls `/api/proxy/{your-endpoint}`
3. Proxy automatically forwards to backend

### Error Handling in Proxy

```typescript
try {
  const response = await fetch(backendUrl, {...})
  // Forward response as-is
  return new NextResponse(data, { status: response.status })
} catch (error) {
  // Log error server-side
  console.error('Proxy error:', error)
  // Return 500 to client
  return NextResponse.json({ error: 'Failed to fetch from backend' }, { status: 500 })
}
```

## GraphQL Integration Pattern

### Overview

When integrating with Nautobot's GraphQL API, **ALWAYS use the centralized service layer** instead of inline GraphQL queries. This ensures consistency, type safety, and maintainability.

### Service Layer Location

**File**: `/frontend/src/services/nautobot-graphql.ts`

This file contains:
- All GraphQL query definitions
- TypeScript type definitions for responses
- Helper functions for executing queries

### When to Use GraphQL Service Layer

Use the GraphQL service layer when:
- Fetching data from Nautobot's GraphQL API
- You need related data in a single query (e.g., device types with manufacturer)
- The REST API doesn't provide all needed fields
- You want to avoid multiple REST API calls

### Architecture

**Flow**: Component → Service Layer → useApi Hook → Proxy → Backend → Nautobot GraphQL

```
Component:        fetchDeviceTypesWithManufacturer(apiCall)
                           ↓
Service Layer:    /services/nautobot-graphql.ts
                           ↓
useApi Hook:      apiCall('nautobot/graphql', { method: 'POST', body: ... })
                           ↓
Proxy:            /api/proxy/nautobot/graphql
                           ↓
Backend:          /nautobot/graphql endpoint
                           ↓
Nautobot:         GraphQL API
```

### Adding New GraphQL Queries

**Step 1**: Add query definition to `/frontend/src/services/nautobot-graphql.ts`

```typescript
// Add query constant
export const MY_NEW_QUERY = `
  query {
    my_data {
      id
      name
      related_field {
        id
        name
      }
    }
  }
`

// Add TypeScript interface
export interface GraphQLMyData {
  id: string
  name: string
  related_field: {
    id: string
    name: string
  }
}

// Add helper function
export async function fetchMyData(
  apiCall: (path: string, options?: ApiOptions) => Promise<unknown>
): Promise<GraphQLResponse<{ my_data: GraphQLMyData[] }>> {
  return executeNautobotQuery(
    apiCall as (path: string, options?: ApiOptions) => Promise<GraphQLResponse<{ my_data: GraphQLMyData[] }>>,
    MY_NEW_QUERY
  )
}
```

**Step 2**: Use in component

```typescript
import { fetchMyData } from '@/services/nautobot-graphql'
import { useApi } from '@/hooks/use-api'

function MyComponent() {
  const { apiCall } = useApi()

  useEffect(() => {
    const loadData = async () => {
      const result = await fetchMyData(apiCall)
      const data = result.data.my_data
      // Use data...
    }
    loadData()
  }, [apiCall])
}
```

### Best Practices

**DO**:
- ✅ Add all GraphQL queries to `/frontend/src/services/nautobot-graphql.ts`
- ✅ Create TypeScript interfaces for all query responses
- ✅ Use helper functions (`fetchDeviceTypesWithManufacturer`, etc.)
- ✅ Reuse existing queries when possible
- ✅ Use the generic `/nautobot/graphql` endpoint

**DON'T**:
- ❌ Write inline GraphQL queries in components
- ❌ Create dedicated backend endpoints for each GraphQL query (e.g., `/device-types/graphql`)
- ❌ Use REST API when GraphQL provides better data structure
- ❌ Duplicate query definitions across multiple files

### Why Use This Pattern?

1. **Centralization**: All GraphQL queries in one location
2. **Type Safety**: Full TypeScript support with defined interfaces
3. **Reusability**: Same query used across multiple components
4. **Maintainability**: Update queries in one place
5. **Documentation**: Self-documenting with clear function names
6. **No Backend Changes**: Leverages existing `/nautobot/graphql` endpoint
7. **GraphQL Philosophy**: Single endpoint for all GraphQL operations

### Example: Device Types with Manufacturer

```typescript
// In component
import { fetchDeviceTypesWithManufacturer } from '@/services/nautobot-graphql'

const deviceTypesRaw = await fetchDeviceTypesWithManufacturer(apiCall)
const deviceTypes = deviceTypesRaw.data.device_types

deviceTypes.forEach(dt => {
  console.log(`${dt.model} by ${dt.manufacturer.name}`)
})
```

### Available Queries

Current queries in the service layer:
- `fetchDeviceTypesWithManufacturer()` - Device types with manufacturer info
- `fetchLocationsWithHierarchy()` - Locations with parent relationships
- `fetchDevicesDetailed()` - Comprehensive device data

### Generic Query Execution

For one-off or custom queries, use the generic executor:

```typescript
import { executeNautobotQuery } from '@/services/nautobot-graphql'

const customQuery = `
  query {
    custom_data {
      field1
      field2
    }
  }
`

const result = await executeNautobotQuery(apiCall, customQuery)
```

## Database Management

### Database Initialization

**Automatic Creation**:
- Databases auto-create on first backend startup
- Located in `data/settings/users.db` and `data/settings/rbac.db`
- Schema created by SQLAlchemy models

**RBAC Initialization** (`init_rbac.py`):
```bash
cd backend
python init_rbac.py
```

This creates:
- Default permissions (users:read, users:write, etc.)
- Default roles (admin, operator, viewer)
- Permission assignments to roles

**Default Role Permissions**:
- **admin**: All permissions
- **operator**: users:read, users:write, settings:read, settings:write, rbac:read
- **viewer**: Read-only access

**First User Creation**:
On first startup, creates admin user with:
- Username: `INITIAL_USERNAME` from .env (default: "admin")
- Password: `INITIAL_PASSWORD` from .env (default: "admin")
- Role: admin with all permissions

### Database Operations

**User Database** (`user_db_manager.py`):
- `create_user()`: Create new user
- `get_user_by_username()`: Find user by username
- `get_user_by_id()`: Find user by ID
- `update_user()`: Update user details
- `delete_user()`: Remove user
- `list_users()`: Get all users

**RBAC Database** (`rbac_manager.py`):
- `create_permission()`: Create permission
- `create_role()`: Create role
- `assign_permission_to_role()`: Link permission to role
- `assign_role_to_user()`: Assign role to user
- `has_permission()`: Check user permission
- `get_user_permissions()`: Get all user permissions

### Database Schema

**Users Table**:
```sql
- id: INTEGER PRIMARY KEY
- username: TEXT UNIQUE
- email: TEXT
- hashed_password: TEXT
- is_active: BOOLEAN
- created_at: TIMESTAMP
```

**Roles Table**:
```sql
- id: INTEGER PRIMARY KEY
- name: TEXT UNIQUE
- description: TEXT
- is_system: BOOLEAN
```

**Permissions Table**:
```sql
- id: INTEGER PRIMARY KEY
- resource: TEXT
- action: TEXT
- description: TEXT
- UNIQUE(resource, action)
```

## Error Handling Patterns

### Backend Error Handling

**HTTPException Usage**:
```python
from fastapi import HTTPException, status

# Not found
raise HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="User not found"
)

# Unauthorized
raise HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid credentials",
    headers={"WWW-Authenticate": "Bearer"}
)

# Forbidden
raise HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Permission denied: users:write required"
)

# Bad request
raise HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="Username already exists"
)
```

**Try-Catch Pattern in Routers**:
```python
try:
    # Database operation
    result = user_db_manager.create_user(...)
    return result
except ValueError as e:
    # Business logic error
    raise HTTPException(status_code=400, detail=str(e))
except HTTPException:
    # Re-raise HTTP exceptions
    raise
except Exception as e:
    # Unexpected error
    logger.error(f"Unexpected error: {e}")
    raise HTTPException(status_code=500, detail="Internal server error")
```

### Frontend Error Handling

**API Call Error Handling**:
```typescript
try {
  const response = await fetch('/api/proxy/users')
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Request failed')
  }
  const data = await response.json()
  return data
} catch (error) {
  console.error('API error:', error)
  // Show toast notification
  toast.error(error.message)
}
```

**Error Boundaries**:
Use React error boundaries for component-level error handling.

## Logging

### Backend Logging Configuration

**Setup** (in `start.py`):
```python
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
```

**Log Levels** (from .env):
- `DEBUG`: Detailed diagnostic info
- `INFO`: General informational messages (default)
- `WARNING`: Warning messages
- `ERROR`: Error messages
- `CRITICAL`: Critical errors

**Usage in Code**:
```python
import logging

logger = logging.getLogger(__name__)

logger.debug("Detailed debug information")
logger.info("General info message")
logger.warning("Warning message")
logger.error(f"Error occurred: {error}")
logger.critical("Critical failure")
```

**When to Log**:
- INFO: Startup, shutdown, successful operations
- WARNING: Deprecated usage, recoverable errors
- ERROR: Failed operations, exceptions
- DEBUG: Detailed flow, variable values (dev only)

### Frontend Logging

**Console Logging**:
```typescript
console.log("Info message")
console.warn("Warning message")
console.error("Error message")
```

**Debug Mode**:
Check for debug context and conditionally log:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log("Development-only log")
}
```

## Startup Scripts

### `start.py` (Production/Standard)

**Purpose**: Standard startup for production or development

**Features**:
- Loads configuration from .env
- Configures logging based on LOG_LEVEL
- Changes to backend directory for isolated file watching
- Starts uvicorn with reload in debug mode
- Only watches backend directory (excludes data/)

**Usage**:
```bash
cd backend
python start.py
```

**Reload Behavior**:
- `reload=settings.debug`: Auto-reload when debug=true
- `reload_dirs=["."]`: Only watch current (backend) directory
- `reload_excludes=["../data/**", "data/**"]`: Ignore database changes

### `start_isolated.py` (Specialized)

**Purpose**: Specialized startup with additional initialization

**Features**:
- Ensures running from backend directory (auto-changes)
- Initializes database settings from environment
- Nautobot-specific configuration
- More verbose logging during startup

**Usage**:
```bash
cd backend
python start_isolated.py
```

**When to Use**:
- First-time setup with Nautobot integration
- Need automatic database initialization
- Development with frequent configuration changes

### Running from Project Root

Both scripts handle directory changes automatically:
```bash
# From project root
cd backend && python start.py

# Or use VS Code tasks
# Task is already configured in .vscode/tasks.json
```

## Testing Conventions

### Backend Testing

**Test Location**: Place tests adjacent to code or in `/backend/tests/`

**Test File Naming**: `test_{module}.py`

**Example Structure**:
```
backend/
├── routers/
│   └── auth.py
└── tests/
    └── test_auth.py
```

**Testing Authenticated Endpoints**:
```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_protected_endpoint():
    # Get token first
    response = client.post("/auth/login", json={
        "username": "admin",
        "password": "admin"
    })
    token = response.json()["access_token"]
    
    # Use token for protected endpoint
    response = client.get(
        "/users",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
```

### Frontend Testing

**Test Location**: Adjacent to components or in `/frontend/__tests__/`

**Test File Naming**: `{component}.test.tsx` or `{component}.spec.tsx`

**Example**:
```typescript
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders button text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })
})
```

## Extension Points

When adding new features:

### 1. New Backend Endpoint

**Steps**:
1. Create Pydantic models in `/backend/models/{feature}.py`
2. Add router in `/backend/routers/{feature}.py`
3. Add business logic in `/backend/services/{feature}.py` (optional)
4. Register router in `/backend/main.py`:
   ```python
   from routers.{feature} import router as feature_router
   app.include_router(feature_router)
   ```
5. Add permission checks using `require_permission()` decorator
6. No proxy changes needed - automatic via `[...path]` route

**Example**:
```python
# backend/routers/devices.py
from fastapi import APIRouter, Depends
from core.auth import require_permission

router = APIRouter(prefix="/devices", tags=["devices"])

@router.get("")
async def list_devices(user: dict = Depends(require_permission("devices", "read"))):
    return {"devices": []}
```

### 2. New Frontend Page

**Steps**:
1. Create page in `/frontend/src/app/{path}/page.tsx`
2. Create components in `/frontend/src/components/{feature}/`
3. Add API calls to `/api/proxy/{backend-endpoint}`
4. Update sidebar in `/frontend/src/components/app-sidebar.tsx`:
   ```typescript
   {
     title: "New Feature",
     url: "/new-feature",
     icon: IconName,
   }
   ```
5. Add route to layout if needed

**Example**:
```typescript
// frontend/src/app/devices/page.tsx
'use client'

export default function DevicesPage() {
  const [devices, setDevices] = useState([])
  
  useEffect(() => {
    fetch('/api/proxy/devices', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setDevices)
  }, [])
  
  return <div>Devices: {devices.length}</div>
}
```

### 3. New Permission

**Via UI** (Recommended):
1. Navigate to `/settings/permissions`
2. Click "Add Permission"
3. Enter resource and action
4. Assign to roles

**Via Code**:
```python
# Add to init_rbac.py
permissions = [
    ("devices", "read", "View devices"),
    ("devices", "write", "Manage devices"),
]
```

**In Backend Route**:
```python
@router.get("/devices")
async def list_devices(user: dict = Depends(require_permission("devices", "read"))):
    pass
```

**In Frontend**:
```typescript
// Conditionally render based on role
{user?.role === 'admin' && <AdminButton />}
```

### 4. New UI Component

**Using Shadcn** (Recommended):
```bash
cd frontend
npx shadcn@latest add {component-name}
```

**Custom Component**:
1. Create in `/frontend/src/components/ui/{component}.tsx`
2. Follow Tailwind and TypeScript conventions
3. Export from component file
4. Import where needed:
   ```typescript
   import { CustomComponent } from '@/components/ui/custom-component'
   ```

### 5. New Database Table

**Steps**:
1. Define SQLAlchemy model in appropriate manager file
2. Create table creation function
3. Call on application startup or in init script
4. Add CRUD operations to manager

**Example**:
```python
# In user_db_manager.py or new manager
def create_devices_table():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
```

## Best Practices Summary

### Security
- ✅ Always use JWT authentication for protected routes
- ✅ Check permissions with `require_permission()` decorator
- ✅ Never expose backend URL to client (use proxy)
- ✅ Change default SECRET_KEY and admin password
- ✅ Use HTTPS in production
- ✅ Validate all user inputs with Pydantic models

### Architecture
- ✅ Keep frontend and backend completely separated
- ✅ Use Next.js API routes as proxy (never direct backend calls)
- ✅ Server Components by default, Client Components when needed
- ✅ Store auth tokens in cookies (not localStorage for SSR)
- ✅ Use Zustand for client-side state management

### Code Organization
- ✅ Routers handle HTTP layer only
- ✅ Business logic goes in services layer
- ✅ Database operations in manager files
- ✅ Pydantic models for request/response validation
- ✅ TypeScript interfaces for type safety

### React Best Practices (CRITICAL - Prevents Infinite Loops)

**MUST-FOLLOW RULES to prevent re-render loops:**

#### 1. Default Parameters - NEVER Use Inline Literals
```typescript
// ❌ WRONG - Creates new array every render
function Component({ items = [], config = {} }) {
  // This causes infinite loops in child components!
}

// ✅ CORRECT - Use constants
const EMPTY_ARRAY: string[] = []
const EMPTY_OBJECT = {}
function Component({ items = EMPTY_ARRAY, config = EMPTY_OBJECT }) {
  // Stable references prevent re-renders
}
```

#### 2. Custom Hooks - ALWAYS Memoize Return Values
```typescript
// ❌ WRONG - Returns new object every render
export function useMyHook() {
  const [state, setState] = useState()
  return { state, setState }  // New object each time!
}

// ✅ CORRECT - Memoize the return value
export function useMyHook() {
  const [state, setState] = useState()
  return useMemo(() => ({
    state,
    setState
  }), [state])  // Stable reference
}
```

#### 3. useEffect Dependencies - MUST Be Stable
```typescript
// ❌ WRONG - Unstable dependencies
function Component() {
  const config = { key: 'value' }  // New object each render!
  
  useEffect(() => {
    doSomething(config)
  }, [config])  // Runs every render = infinite loop!
}

// ✅ CORRECT - Stable dependencies
const DEFAULT_CONFIG = { key: 'value' }  // Outside component

function Component() {
  useEffect(() => {
    doSomething(DEFAULT_CONFIG)
  }, [])  // Runs once
  
  // OR use useMemo for dynamic values
  const config = useMemo(() => ({ key: someValue }), [someValue])
  useEffect(() => {
    doSomething(config)
  }, [config])  // Only runs when someValue changes
}
```

#### 4. Component Prop Passing - Avoid Circular Dependencies
```typescript
// ❌ WRONG - Parent passes data that child loads
function Parent() {
  const [data, setData] = useState([])
  
  return <Child 
    initialData={data}  // Child sets this in parent
    onDataLoad={setData}  // Creates circular dependency
  />
}

// ✅ CORRECT - Lift state or use separate effects
function Parent() {
  const [data, setData] = useState([])
  
  useEffect(() => {
    loadData().then(setData)  // Parent loads its own data
  }, [])
  
  return <Child data={data} />
}
```

#### 5. Exhaustive Dependencies - ALWAYS Include All
```typescript
// ❌ WRONG - Missing dependencies
useEffect(() => {
  if (isReady) {
    loadData(userId)  // Uses isReady and userId
  }
}, [])  // Missing dependencies!

// ✅ CORRECT - All dependencies included
useEffect(() => {
  if (isReady) {
    loadData(userId)
  }
}, [isReady, userId, loadData])  // Complete dependency array
```

**Enforcement:**
- ESLint rule `react-hooks/exhaustive-deps` set to `error`
- Custom ESLint rule `no-inline-defaults` catches inline literals
- Pre-commit hooks block non-compliant code
- TypeScript strict mode enforces type safety

#### 6. Callbacks Passed to Hooks - ALWAYS Use useCallback
```typescript
// ❌ WRONG - Inline callback creates new function every render
const { data } = useMyHook({
  onChange: () => {
    doSomething()
  }
})  // Hook sees new callback → re-runs logic → infinite loop!

// ✅ CORRECT - Stable callback with useCallback
const handleChange = useCallback(() => {
  doSomething()
}, [])  // Empty deps = never changes

const { data } = useMyHook({
  onChange: handleChange  // Same function every time
})
```

**When Writing Code:**
1. ✅ Declare constants outside component for empty arrays/objects
2. ✅ Wrap all custom hook returns in `useMemo()`
3. ✅ Always use complete dependency arrays in useEffect/useMemo/useCallback
4. ✅ Move object/array creation outside render or wrap in useMemo
5. ✅ Avoid passing both initial data and setters that create circular deps
6. ✅ **ALWAYS wrap callbacks passed to custom hooks in `useCallback()`**
7. ✅ Use React DevTools to check for unnecessary re-renders

### Performance
- ✅ Minimize 'use client' directives
- ✅ Use dynamic imports for heavy components
- ✅ Implement proper loading states
- ✅ Cache API responses appropriately
- ✅ Optimize images (WebP, lazy loading)
- ✅ Memoize expensive computations
- ✅ Use React.memo() for expensive pure components

### Development Workflow
- ✅ Run backend and frontend in separate terminals
- ✅ Use `.env` files for configuration (never commit)
- ✅ Check logs for errors and warnings
- ✅ Test authenticated endpoints with valid tokens
- ✅ Use VS Code tasks for common operations
- ✅ Run `npm run check` before committing
- ✅ Pre-commit hooks will auto-fix and block bad code
- ✅ All CI/CD checks must pass before merging
