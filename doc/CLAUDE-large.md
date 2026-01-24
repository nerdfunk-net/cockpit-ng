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
- **State Management**: TanStack Query v5, Zustand 5.0 for client-side state
- **Icons**: Lucide React
- **HTTP Client**: Native fetch API
- **Cookies**: js-cookie for cookie management
- **Development**: Turbopack for fast refresh

### Backend
- **Framework**: FastAPI (Python)
- **Language**: Python 3.9+
- **Database**: PostgreSQL (single database with 40+ tables)
- **ORM**: SQLAlchemy
- **Authentication**: JWT tokens with passlib for password hashing
- **Validation**: Pydantic models
- **CORS**: Configured for frontend communication
- **Task Scheduling**: Celery with Beat scheduler for background jobs and periodic tasks
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

**Database Type**: PostgreSQL (replaced SQLite in production)

The application uses a single PostgreSQL database with comprehensive table organization. On first startup, the database schema is automatically created through SQLAlchemy models defined in `/backend/core/models.py`.

**Database Configuration** (from environment variables):
- `DATABASE_HOST` - PostgreSQL server hostname
- `DATABASE_PORT` - PostgreSQL server port (default: 5432)
- `DATABASE_NAME` - Database name
- `DATABASE_USERNAME` - Database username
- `DATABASE_PASSWORD` - Database password
- Connection pooling with 5 persistent connections + 10 overflow

**Schema Organization** (40+ tables across domains):

**User Management & RBAC:**
- `users` - User accounts with authentication and permissions
- `user_profiles` - Extended user profile information
- `roles` - Role definitions (admin, operator, viewer, etc.)
- `permissions` - Permission definitions (resource:action pairs)
- `role_permissions` - Many-to-many mapping of roles to permissions
- `user_roles` - Many-to-many mapping of users to roles
- `user_permissions` - Direct user permission assignments

**Settings & Configuration:**
- `settings` - General key-value settings storage
- `nautobot_settings` - Nautobot connection configuration
- `checkmk_settings` - CheckMK integration settings
- `grafana_settings` - Grafana deployment configuration
- `git_settings` - Git repository settings for configs
- `cache_settings` - Cache configuration and intervals
- `celery_settings` - Celery worker and task queue settings
- `nautobot_defaults` - Default values for Nautobot device creation
- `device_offboarding_settings` - Device offboarding workflow settings
- `settings_metadata` - Settings versioning and metadata

**Credentials & Security:**
- `credentials` - Encrypted credentials (SSH, TACACS, tokens, SSH keys)
- `login_credentials` - Encrypted login credentials
- `snmp_mapping` - SNMP v1/v2c/v3 credential mappings

**Git & Version Control:**
- `git_repositories` - Git repository configurations for configs, templates, inventory
- `templates` - Configuration templates (Jinja2, TextFSM, etc.)
- `template_versions` - Template version history

**Job Management (Celery):**
- `jobs` - Legacy job tracking
- `job_templates` - Reusable job configurations (backup, sync, commands, compliance)
- `job_schedules` - Scheduled job definitions with cron/interval
- `job_runs` - Individual job execution records with Celery task tracking

**Compliance:**
- `compliance_rules` - Compliance rule definitions
- `compliance_checks` - Compliance check results per device
- `regex_patterns` - Regex patterns for compliance validation

**Nautobot to CheckMK Sync:**
- `nb2cmk_sync` - Sync operation tracking
- `nb2cmk_jobs` - Background sync job tracking
- `nb2cmk_job_results` - Per-device comparison results with diff tracking

**Inventory Management:**
- `inventories` - Stored Ansible inventory configurations with dynamic filtering

**Database Features:**
- **Auto-initialization**: Schema created automatically on first run via `init_db()`
- **Automatic migrations**: Column additions handled via migration functions in `core/database.py`
- **Schema manager**: `/core/schema_manager.py` compares models to actual schema and applies changes
- **Connection pooling**: 5 persistent connections with 10 overflow connections
- **Health checks**: `pool_pre_ping=True` verifies connections before use
- **Connection recycling**: Connections recycled after 1 hour to prevent stale connections
- **Indexes**: Comprehensive indexing on frequently queried columns
- **Foreign keys**: CASCADE deletes for referential integrity
- **Timestamps**: Automatic `created_at` and `updated_at` timestamps on all tables
- **Relationships**: SQLAlchemy relationships with proper cascade behavior

### IMPORTANT: Architectural Standards for New Features

**CRITICAL REQUIREMENT**: All new features MUST follow the established architectural patterns documented in this file. Deviation from these patterns is NOT permitted without explicit architectural review.

**When implementing new features, you MUST:**

1. **Follow the File Structure**:
   - ✅ **Frontend**: Place components under `/components/features/{domain}/` with proper subdirectories (components, hooks, dialogs, tabs, utils, types)
   - ✅ **Backend**: Follow the layered architecture - models in `/models/`, routers in `/routers/`, services in `/services/`, repositories in `/repositories/`
   - ❌ **DO NOT** create flat structures or place files outside the established organization
   - ❌ **DO NOT** mix concerns (e.g., business logic in routers, database operations in services)

2. **Use PostgreSQL Database**:
   - ✅ **REQUIRED**: Define new tables as SQLAlchemy models in `/backend/core/models.py`
   - ✅ **REQUIRED**: Use the existing PostgreSQL connection and session management from `/backend/core/database.py`
   - ✅ **REQUIRED**: Add proper indexes, foreign keys, and timestamps to all new tables
   - ✅ **REQUIRED**: Create a repository class in `/backend/repositories/` for data access
   - ❌ **NEVER** use SQLite or create new database connections
   - ❌ **NEVER** write raw SQL queries - always use SQLAlchemy ORM
   - ❌ **NEVER** bypass the repository pattern for database access

3. **Follow Backend Patterns**:
   - ✅ **Repository Pattern**: All database operations through repository classes
   - ✅ **Service Layer**: Business logic in service classes that orchestrate repositories
   - ✅ **Router Layer**: Thin HTTP layer that delegates to services
   - ✅ **Dependency Injection**: Use FastAPI dependencies for authentication and permissions
   - ✅ **Error Handling**: Use standardized error handlers from `/backend/core/error_handlers.py`

4. **Follow Frontend Patterns**:
   - ✅ **Feature-Based**: Group related functionality under `/components/features/{domain}/`
   - ✅ **Self-Contained**: Each feature has its own components, hooks, dialogs, tabs, types, utils
   - ✅ **Server Components**: Use server components by default, client components only when needed
   - ✅ **Route Groups**: Place pages under `(dashboard)/` route group
   - ✅ **Type Safety**: Define TypeScript types in feature-specific `/types/` directories

5. **Follow Naming Conventions**:
   - ✅ **Database**: Snake_case for tables and columns (e.g., `job_templates`, `created_at`)
   - ✅ **Backend**: Snake_case for files and functions (e.g., `user_repository.py`, `create_user()`)
   - ✅ **Frontend**: kebab-case for directories, PascalCase for components (e.g., `bulk-edit/`, `BulkEditDialog.tsx`)
   - ✅ **Models**: PascalCase for Pydantic and SQLAlchemy models (e.g., `JobTemplate`, `UserProfile`)

**Examples of Correct Implementation**:

```
New Feature: Device Monitoring

✅ CORRECT Structure:
frontend/src/components/features/monitoring/
  ├── components/
  │   ├── MonitoringDashboard.tsx
  │   └── DeviceStatusCard.tsx
  ├── hooks/
  │   └── use-monitoring-data.ts
  ├── dialogs/
  │   └── ConfigureMonitoringDialog.tsx
  └── types/
      └── monitoring-types.ts

backend/core/models.py:
  class MonitoringCheck(Base):
      __tablename__ = "monitoring_checks"
      ...

backend/repositories/monitoring_repository.py:
  class MonitoringRepository(BaseRepository):
      ...

backend/services/monitoring_service.py:
  class MonitoringService:
      def __init__(self, monitoring_repo: MonitoringRepository):
          ...

backend/routers/monitoring.py:
  @router.get("/checks")
  async def get_checks(
      service: MonitoringService = Depends(get_monitoring_service)
  ):
      return await service.get_checks()
```

```
❌ INCORRECT Practices:
- Creating SQLite databases for new features
- Placing components at /components/ root without feature grouping
- Writing SQL queries instead of using SQLAlchemy ORM
- Bypassing the repository pattern
- Putting business logic in routers
- Creating separate backend endpoints for GraphQL queries
- Mixing server and client components unnecessarily
- Manual `useState + useEffect` for server data (use TanStack Query)
- Inline query keys (always use `queryKeys` factory)
- Storing query data in `useState` (use `useMemo` for derived state)
- Forgetting to invalidate cache after mutations

```

**Enforcement**:
- Code reviews will reject changes that don't follow these patterns
- Database schema changes require SQLAlchemy models
- New features require architectural approval if deviating from these patterns
- Consult this document before starting any new feature implementation

## File Structure

### Frontend (`/frontend`)

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── (dashboard)/             # Route group for dashboard pages
│   │   │   ├── add-certificate/    # SSL certificate management
│   │   │   ├── automation/
│   │   │   │   └── templates/      # Automation templates
│   │   │   ├── backup/             # Configuration backup
│   │   │   ├── checkmk/
│   │   │   │   ├── hosts-inventory/  # CheckMK host inventory
│   │   │   │   ├── live-update/      # Live update display
│   │   │   │   └── sync-devices/     # Device sync page
│   │   │   ├── compare/            # Configuration comparison
│   │   │   ├── compliance/         # Compliance management
│   │   │   ├── configs/            # Configuration viewing
│   │   │   ├── inventory/          # Device inventory builder
│   │   │   ├── jobs/               # Job management
│   │   │   │   ├── scheduler/      # Job scheduler
│   │   │   │   ├── templates/      # Job templates
│   │   │   │   └── view/           # Job viewing
│   │   │   ├── nautobot/           # Nautobot integration
│   │   │   ├── nautobot-add-device/ # Device addition
│   │   │   ├── nautobot-export/    # Export functionality
│   │   │   ├── netmiko/            # Netmiko interface
│   │   │   ├── offboard-device/    # Device offboarding
│   │   │   ├── oidc-test/          # OIDC testing
│   │   │   ├── onboard-device/     # Device onboarding
│   │   │   ├── profile/            # User profile
│   │   │   ├── settings/           # Settings section
│   │   │   │   ├── cache/          # Cache management
│   │   │   │   ├── celery/         # Celery task queue settings
│   │   │   │   ├── checkmk/        # CheckMK settings
│   │   │   │   ├── common/         # Common settings
│   │   │   │   ├── compliance/     # Compliance settings
│   │   │   │   ├── credentials/    # Credentials management
│   │   │   │   ├── git/            # Git repository settings
│   │   │   │   ├── grafana/        # Grafana connections
│   │   │   │   ├── nautobot/       # Nautobot connection settings
│   │   │   │   ├── permissions/    # User & role management
│   │   │   │   └── templates/      # Template management
│   │   │   ├── sync-devices/       # Nautobot sync
│   │   │   └── tools/
│   │   │       ├── database-migration/ # Database migration tools
│   │   │       └── ping/           # Network ping utility
│   │   ├── api/                    # Next.js API routes
│   │   │   ├── auth/               # Authentication endpoints
│   │   │   │   ├── login/          # Login endpoint
│   │   │   │   ├── logout/         # Logout endpoint
│   │   │   │   └── refresh/        # Token refresh endpoint
│   │   │   ├── health/             # Health check endpoint
│   │   │   └── proxy/              # Backend proxy endpoints
│   │   │       └── [...path]/      # Catch-all proxy route
│   │   ├── login/                  # Login page and callbacks
│   │   │   ├── page.tsx            # Main login page
│   │   │   ├── approval-pending/   # Pending approval page
│   │   │   ├── callback/           # OAuth callbacks
│   │   │   └── oidc-test-callback/ # OIDC test callback
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── page.tsx                # Home/dashboard page
│   │   └── globals.css             # Global styles
│   │
│   ├── components/                 # React components (feature-based architecture)
│   │   ├── layout/                 # Layout components
│   │   │   ├── app-sidebar.tsx    # Main application sidebar
│   │   │   ├── dashboard-layout.tsx # Dashboard wrapper component
│   │   │   ├── dashboard-overview.tsx # Dashboard home page
│   │   │   ├── dashboard-job-stats.tsx # Job statistics widget
│   │   │   ├── dashboard-checkmk-sync-status.tsx # CheckMK sync status
│   │   │   ├── dashboard-device-backup-status.tsx # Backup status
│   │   │   ├── session-status.tsx  # Session status indicator
│   │   │   └── sidebar-context.tsx # Sidebar state management
│   │   │
│   │   ├── features/               # Feature-based component organization
│   │   │   ├── checkmk/           # CheckMK integration features
│   │   │   │   ├── hosts-inventory/ # Host inventory management
│   │   │   │   ├── live-update/    # Live update display
│   │   │   │   ├── modals/         # Modal dialogs
│   │   │   │   ├── renderers/      # Data rendering components
│   │   │   │   └── sync-devices/   # Device synchronization
│   │   │   │
│   │   │   ├── jobs/              # Job scheduling and management
│   │   │   │   ├── job-template-types/ # Template type management
│   │   │   │   ├── results/        # Job results display
│   │   │   │   ├── scheduler/      # Job scheduling interface
│   │   │   │   ├── shared/         # Shared job utilities
│   │   │   │   ├── templates/      # Job templates
│   │   │   │   ├── types/          # Type definitions
│   │   │   │   └── view/           # Job viewing interface
│   │   │   │
│   │   │   ├── nautobot/          # Nautobot integration features
│   │   │   │   ├── add-device/    # Device addition
│   │   │   │   │   ├── components/ # Add device components
│   │   │   │   │   └── hooks/      # Add device hooks
│   │   │   │   ├── export/        # Export functionality
│   │   │   │   │   ├── dialogs/    # Export dialogs
│   │   │   │   │   └── tabs/       # Export tabs
│   │   │   │   ├── offboard/      # Device offboarding
│   │   │   │   ├── onboard/       # Device onboarding
│   │   │   │   │   ├── components/ # Onboard components
│   │   │   │   │   ├── hooks/      # Onboard hooks
│   │   │   │   │   └── utils/      # Onboard utilities
│   │   │   │   ├── sync-devices/  # Device sync
│   │   │   │   └── tools/         # Nautobot tools
│   │   │   │       ├── bulk-edit/ # Bulk editing tool
│   │   │   │       │   ├── components/
│   │   │   │       │   ├── dialogs/
│   │   │   │       │   ├── tabs/
│   │   │   │       │   └── utils/
│   │   │   │       └── check-ip/  # IP checking tool
│   │   │   │
│   │   │   ├── general/           # General features
│   │   │   │   └── inventory/     # Device inventory builder
│   │   │   │       ├── dialogs/
│   │   │   │       ├── hooks/
│   │   │   │       ├── tabs/
│   │   │   │       ├── types/
│   │   │   │       ├── utils/
│   │   │   │       └── inventory-page.tsx
│   │   │   │
│   │   │   ├── network/           # Network-related features
│   │   │   │   ├── automation/    # Network automation
│   │   │   │   │   ├── netmiko/   # Netmiko interface
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── dialogs/
│   │   │   │   │   │   ├── hooks/
│   │   │   │   │   │   ├── tabs/
│   │   │   │   │   │   ├── types/
│   │   │   │   │   │   ├── ui/
│   │   │   │   │   │   └── utils/
│   │   │   │   │   └── templates/ # Template management
│   │   │   │   ├── compliance/    # Network compliance
│   │   │   │   │   ├── hooks/
│   │   │   │   │   └── tabs/
│   │   │   │   ├── configs/       # Configuration management
│   │   │   │   │   ├── backup/    # Configuration backup
│   │   │   │   │   ├── compare/   # Configuration comparison
│   │   │   │   │   │   └── shared/ # Shared comparison utilities
│   │   │   │   │   └── view/      # Configuration viewing
│   │   │   │   └── tools/         # Network tools
│   │   │   │       └── ping/      # Network ping utility
│   │   │   │
│   │   │   ├── profile/           # User profile feature
│   │   │   │   └── profile-page.tsx
│   │   │   │
│   │   │   └── settings/          # Application settings features
│   │   │       ├── cache/         # Cache management
│   │   │       ├── celery/        # Celery task queue settings
│   │   │       ├── common/        # Common settings
│   │   │       ├── compliance/    # Compliance settings
│   │   │       ├── connections/   # Connection management
│   │   │       │   ├── checkmk/   # CheckMK connections
│   │   │       │   ├── grafana/   # Grafana connections
│   │   │       │   └── nautobot/  # Nautobot connections
│   │   │       ├── credentials/   # Credentials management
│   │   │       ├── git/           # Git repository settings
│   │   │       ├── permissions/   # Permissions management
│   │   │       │   └── permissions/ # Sub-permissions management
│   │   │       └── templates/     # Template management
│   │   │
│   │   ├── auth/                  # Authentication components
│   │   │   └── auth-hydration.tsx # Auth state hydration
│   │   │
│   │   ├── shared/                # Shared/reusable components
│   │   │   ├── device-selector.tsx # Multi-purpose device selection
│   │   │   ├── custom-fields-modal.tsx # Custom field management
│   │   │   ├── tags-modal.tsx     # Tag management
│   │   │   ├── searchable-dropdown.tsx # Reusable dropdown
│   │   │   └── device-selection-tab.tsx # Device selection tab
│   │   │
│   │   └── ui/                    # Shadcn UI primitives
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       └── ... (other UI components)
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── use-api.ts             # API calling hook
│   │   ├── queries/               # TanStack Query hooks
│   │   ├── use-mobile.ts          # Mobile detection hook
│   │   ├── use-session-manager.ts # Session management hook
│   │   ├── use-toast.ts           # Toast notifications hook
│   │   ├── checkmk/               # CheckMK-specific hooks
│   │   └── git/                   # Git-specific hooks
│   │
│   ├── services/                  # Service layer for API integration
│   │   └── nautobot-graphql.ts    # Nautobot GraphQL queries and types
│   │
│   ├── types/                     # TypeScript type definitions
│   │   ├── checkmk/
│   │   │   └── types.ts           # CheckMK-specific types
│   │   └── git.ts                 # Git-related types
│   │
│   ├── utils/                     # Utility functions
│   │   └── csv-parser.ts          # CSV parsing utility
│   │
│   └── lib/                       # Utility libraries
│       ├── utils.ts               # General utilities
│       ├── auth-store.ts          # Zustand auth store
│       ├── query-client.ts        # TanStack Query configuration
│       ├── query-keys.ts.         # Query key factory (hierarchical)
│       ├── security.ts            # Security utilities
│       ├── local-fonts.ts         # Local font configuration
│       ├── air-gap-config.ts      # Air-gapped environment config
│       ├── compare-utils.ts       # Comparison utilities
│       └── checkmk/
│           └── property-mapping-utils.ts # CheckMK property mapping
│
├── public/                        # Static assets
│   ├── avatars/                  # User avatar images
│   ├── fonts/                    # Local font files
│   │   ├── geist.css
│   │   └── geist-mono.css
│   └── airgap-fallback.css       # Fallback styles for air-gapped mode
│
├── components.json                # Shadcn UI configuration
├── next.config.ts                 # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                  # TypeScript configuration
├── package.json                   # Dependencies and scripts
└── postcss.config.mjs            # PostCSS configuration
```

### Backend (`/backend`)

```
backend/
├── main.py                          # FastAPI application entry point
├── config.py                        # Configuration settings
├── health.py                        # Health check endpoints
├── requirements.txt                 # Python dependencies
├── pyproject.toml                   # Project configuration
│
├── start.py                         # Production startup script
├── start_isolated.py               # Development startup script
├── start_celery.py                 # Celery worker startup
├── start_beat.py                   # Celery Beat scheduler startup
├── celery_app.py                   # Main Celery app instance
├── celery_worker.py                # Celery worker configuration
├── celery_beat.py                  # Celery Beat configuration
├── beat_schedule.py                # Beat schedule configuration
│
├── core/                            # Core utilities and configuration
│   ├── __init__.py
│   ├── auth.py                     # JWT authentication utilities
│   ├── config.py                   # Core configuration
│   ├── database.py                 # Database utilities (ORM helper)
│   ├── models.py                   # Core SQLAlchemy models
│   ├── schema_manager.py           # Database schema management
│   ├── error_handlers.py           # Global error handling
│   └── celery_error_handler.py     # Celery-specific error handling
│
├── models/                          # Pydantic models (request/response)
│   ├── __init__.py
│   ├── auth.py                     # Authentication models
│   ├── rbac.py                     # RBAC models
│   ├── backup_models.py            # Backup operation models
│   ├── credentials.py              # Credentials models
│   ├── files.py                    # File operation models
│   ├── git.py                      # Git operation models
│   ├── git_repositories.py         # Git repository models
│   ├── job_models.py               # Job execution models
│   ├── job_templates.py            # Job template models
│   ├── nautobot.py                 # Nautobot API models
│   ├── nb2cmk.py                   # Nautobot to CheckMK models
│   ├── checkmk.py                  # CheckMK models
│   ├── templates.py                # Template models
│   ├── inventory.py                # Device inventory models
│   └── settings.py                 # Settings models
│
├── routers/                         # API route handlers (feature-based organization)
│   ├── __init__.py
│   │
│   ├── auth/                       # Authentication & authorization domain
│   │   ├── __init__.py
│   │   ├── auth.py                 # /auth/* endpoints (login, logout, refresh)
│   │   ├── oidc.py                 # /oidc/* endpoints (OpenID Connect SSO)
│   │   └── profile.py              # /profile/* endpoints (user profile)
│   │
│   ├── nautobot/                   # Nautobot integration domain
│   │   ├── __init__.py
│   │   ├── main.py                 # Main Nautobot proxy endpoints
│   │   ├── devices.py              # Device CRUD endpoints
│   │   ├── interfaces.py           # DCIM interface endpoints
│   │   ├── ip_addresses.py         # IP address management
│   │   ├── prefixes.py             # IP prefix management
│   │   ├── ip_interface_mapping.py # IP-to-interface mapping
│   │   ├── metadata.py             # Metadata endpoints
│   │   ├── export.py               # Export functionality
│   │   ├── sync.py                 # Device synchronization
│   │   └── tools/                  # Nautobot tools
│   │       ├── __init__.py
│   │       ├── scan_and_add.py     # Network scanning and device addition
│   │       └── bulk_edit.py        # Bulk device editing
│   │
│   ├── checkmk/                    # CheckMK monitoring domain
│   │   ├── __init__.py
│   │   ├── main.py                 # CheckMK host management
│   │   ├── sync.py                 # Nautobot→CheckMK sync
│   │   └── inventory.py            # Hosts inventory endpoints
│   │
│   ├── network/                    # Network automation domain
│   │   ├── __init__.py
│   │   ├── configs/                # Configuration management
│   │   │   ├── __init__.py
│   │   │   ├── backup.py           # Configuration backup
│   │   │   ├── compare.py          # Configuration comparison
│   │   │   └── view.py             # Configuration viewing
│   │   ├── automation/             # Automation tools
│   │   │   ├── __init__.py
│   │   │   ├── netmiko.py          # Netmiko device connections
│   │   │   └── templates.py        # Configuration templates
│   │   ├── compliance/             # Compliance checking
│   │   │   ├── __init__.py
│   │   │   ├── rules.py            # Compliance rules management
│   │   │   └── checks.py           # Compliance check execution
│   │   └── tools/                  # Network utilities
│   │       ├── __init__.py
│   │       └── ping.py             # Network ping utility
│   │
│   ├── jobs/                       # Job scheduling & management domain
│   │   ├── __init__.py
│   │   ├── templates.py            # Job template management
│   │   ├── schedules.py            # Job scheduling
│   │   ├── runs.py                 # Job execution history
│   │   └── celery_api.py           # Celery task queue API
│   │
│   ├── settings/                   # Application settings domain
│   │   ├── __init__.py
│   │   ├── common.py               # General application settings
│   │   ├── cache.py                # Cache configuration
│   │   ├── celery.py               # Celery configuration (future)
│   │   ├── credentials.py          # Credentials management
│   │   ├── templates.py            # Template management
│   │   ├── rbac.py                 # Role-based access control
│   │   ├── compliance/             # Compliance settings
│   │   │   ├── __init__.py
│   │   │   ├── rules.py            # Compliance rule configuration
│   │   │   └── checks.py           # Compliance check settings
│   │   ├── connections/            # External system connections
│   │   │   ├── __init__.py
│   │   │   └── config.py           # YAML config file management
│   │   └── git/                    # Git repository management
│   │       ├── __init__.py
│   │       ├── main.py             # Main Git operations
│   │       ├── repositories.py     # Repository CRUD
│   │       ├── operations.py       # Git operations (commit, push, pull)
│   │       ├── compare.py          # Git diff/comparison
│   │       ├── files.py            # File operations in Git
│   │       ├── version_control.py  # Version control operations
│   │       └── debug.py            # Git debugging utilities
│   │
│   └── inventory/                  # Inventory management domain
│       ├── __init__.py
│       ├── main.py                 # Inventory CRUD operations
│       └── certificates.py         # SSL certificate management
│
├── services/                        # Business logic layer (feature-based organization)
│   ├── __init__.py
│   │
│   ├── auth/                       # Authentication services
│   │   ├── __init__.py
│   │   ├── user_management.py      # User management service
│   │   └── oidc.py                 # OIDC/SSO service
│   │
│   ├── nautobot/                   # Nautobot integration services
│   │   ├── __init__.py
│   │   ├── client.py               # Nautobot API client
│   │   ├── devices/                # Device operation services
│   │   │   ├── __init__.py
│   │   │   ├── creation.py         # Device creation/onboarding
│   │   │   ├── update.py           # Device update operations
│   │   │   ├── query.py            # Device querying/search
│   │   │   ├── import_service.py   # Device import operations (renamed to avoid keyword)
│   │   │   └── common.py           # Common device operations
│   │   ├── configs/                # Configuration services
│   │   │   ├── __init__.py
│   │   │   ├── backup.py           # Device backup operations
│   │   │   └── config.py           # Device configuration handling
│   │   ├── offboarding.py          # Device offboarding service
│   │   └── helpers/                # Nautobot helper utilities
│   │       └── (helper modules)
│   │
│   ├── checkmk/                    # CheckMK integration services
│   │   ├── __init__.py
│   │   ├── client.py               # CheckMK API client
│   │   ├── config.py               # CheckMK configuration service
│   │   ├── normalization.py        # Device normalization
│   │   ├── folder.py               # CheckMK folder management
│   │   └── sync/                   # Nautobot→CheckMK sync services
│   │       ├── __init__.py
│   │       ├── base.py             # Base sync service
│   │       ├── background.py       # Background sync operations
│   │       └── database.py         # Sync database operations
│   │
│   ├── inventory/                  # Device inventory services
│   │   ├── __init__.py
│   │   └── inventory.py            # Device inventory builder service
│   │
│   ├── network/                    # Network automation services
│   │   ├── __init__.py
│   │   ├── automation/             # Automation tool services
│   │   │   ├── __init__.py
│   │   │   ├── netmiko.py          # Netmiko device connections
│   │   │   └── render.py           # Jinja2 template rendering
│   │   ├── compliance/             # Compliance services
│   │   │   ├── __init__.py
│   │   │   └── check.py            # Compliance checking logic
│   │   └── scanning/               # Network scanning services
│   │       ├── __init__.py
│   │       ├── network_scan.py     # Network scanning service
│   │       └── scan.py             # Device scanning service
│   │
│   ├── settings/                   # Application settings services
│   │   ├── __init__.py
│   │   ├── cache.py                # Caching service
│   │   └── git/                    # Git repository services
│   │       ├── __init__.py
│   │       ├── service.py          # Main Git service
│   │       ├── auth.py             # Git authentication handling
│   │       ├── cache.py            # Git caching layer
│   │       ├── config.py           # Git configuration management
│   │       ├── connection.py       # Git connection pooling/management
│   │       ├── diff.py             # Git diff/comparison operations
│   │       ├── operations.py       # Git operations service
│   │       ├── env.py              # Git environment setup
│   │       ├── paths.py            # Git path utilities
│   │       └── shared_utils.py     # Shared Git utilities
│   │
│   └── background_jobs/            # Background job services
│       └── (Celery task services)
│
├── repositories/                    # Data access layer (Repository pattern, feature-based)
│   ├── __init__.py
│   ├── base.py                     # Base repository class (shared)
│   │
│   ├── auth/                       # Authentication data access
│   │   ├── __init__.py
│   │   ├── user_repository.py      # User data access
│   │   ├── rbac_repository.py      # RBAC data access
│   │   └── profile_repository.py   # Profile data access
│   │
│   ├── jobs/                       # Job data access
│   │   ├── __init__.py
│   │   ├── job_template_repository.py # Job template data access
│   │   ├── job_schedule_repository.py # Job schedule data access
│   │   └── job_run_repository.py   # Job run data access
│   │
│   ├── settings/                   # Settings data access
│   │   ├── __init__.py
│   │   ├── settings_repository.py  # Settings data access
│   │   ├── credentials_repository.py # Credentials data access
│   │   ├── git_repository_repository.py # Git repository data access
│   │   └── template_repository.py  # Template data access
│   │
│   ├── compliance/                 # Compliance data access
│   │   ├── __init__.py
│   │   └── compliance_repository.py # Compliance data access
│   │
│   ├── inventory/                  # Inventory data access
│   │   ├── __init__.py
│   │   └── inventory_repository.py # Inventory data access
│   │
│   └── checkmk/                    # CheckMK data access
│       ├── __init__.py
│       └── nb2cmk_repository.py    # NB2CMK sync data access
│
├── tasks/                           # Celery/Background task definitions
│   ├── __init__.py
│   ├── execution/                  # Task execution layer
│   ├── scheduling/                 # Scheduling logic
│   └── utils/                      # Task utilities
│
├── utils/                           # Utility functions
│   ├── cmk_folder_utils.py         # CheckMK folder utilities
│   ├── cmk_site_utils.py           # CheckMK site utilities
│   ├── nautobot_helpers.py         # Nautobot helper functions
│   ├── netmiko_platform_mapper.py  # Netmiko platform mapping
│   ├── path_template.py            # Path template utilities
│   └── task_progress.py            # Task progress tracking
│
├── migrations/                      # Database migration scripts
│   ├── migration_001_*.py
│   ├── migration_002_*.py
│   └── ... (17+ migration files)
│
├── tests/                           # Testing infrastructure
│   ├── __init__.py
│   ├── conftest.py                 # Pytest configuration
│   └── ... (unit tests)
│
├── archive/                         # Archived/legacy code
│   ├── legacy_tasks/               # Old task implementations
│   ├── migration_scripts/          # Old migration scripts
│   └── job_tasks_backup/           # Legacy job task backups
│
├── docs/                            # Documentation
│
├── data/                            # Data directories
│   └── exports/                    # Data export directory
│
├── user_db_manager.py              # User database operations (SQLAlchemy)
├── rbac_manager.py                 # RBAC database operations
├── profile_manager.py              # Profile operations
├── credentials_manager.py          # Encrypted credential storage
├── template_manager.py             # Template storage and management
├── git_repositories_manager.py     # Git repository configuration
├── settings_manager.py             # Application settings manager
├── compliance_manager.py           # Compliance data/database manager
├── inventory_manager.py            # Inventory data manager
├── job_template_manager.py         # Job template storage manager
├── jobs_manager.py                 # Job data manager
├── job_run_manager.py              # Job execution records manager
├── connection_tester.py            # Network connection testing
├── seed_rbac.py                    # RBAC initialization
├── set_admin_password.py           # Admin password reset utility
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
The frontend uses a **feature-based architecture** for better scalability and maintainability:

**Organizational Principles:**
- **Feature-based organization**: Components grouped by business domain under `/components/features/`
- **Self-contained features**: Each feature has its own components, hooks, dialogs, tabs, types, and utilities
- **Layout separation**: Layout components in dedicated `/components/layout/` directory
- **Shared utilities**: Reusable components in `/components/shared/`
- **UI primitives**: Shadcn UI components in `/components/ui/`

**Feature Domains:**
- `/features/jobs/` - Job scheduling and management system
- `/features/checkmk/` - CheckMK integration and monitoring
- `/features/nautobot/` - Nautobot device management and tools
- `/features/network/` - Network automation (Netmiko, Ansible, configs, compliance)
- `/features/settings/` - Application settings with sub-features (cache, celery, connections, credentials, git, permissions, templates)
- `/features/profile/` - User profile management

**Component Types:**
- **Server Components by default** (Next.js 15)
- **Client Components** marked with `'use client'` (minimal usage, only when needed for interactivity)
- **Route Groups**: Dashboard pages organized under `(dashboard)/` route group for shared layouts

### Backend Architecture Patterns

The backend follows a **layered architecture** with **feature-based organization** and clear separation of concerns:

**Feature-Based Organization:**
- Backend structure mirrors frontend feature organization
- Files grouped by domain: auth, nautobot, checkmk, network, jobs, settings, inventory
- Aligns with sidebar navigation for consistency
- Improves discoverability and maintainability
- **Status**: Migration in progress (see `/backend/docs/BACKEND_RESTRUCTURE_PLAN.md`)

**Repository Pattern:**
- Data access layer abstracted through repository classes in `/repositories/`
- Base repository provides common CRUD operations
- Feature-specific repositories organized by domain (auth, jobs, settings, etc.)
- Separates database operations from business logic
- Each feature domain has its own repository subdirectory

**Service Layer:**
- Business logic encapsulated in service classes in `/services/`
- Services orchestrate operations across multiple repositories
- Organized by feature domains matching routers and frontend
- Specialized services for domains:
  - **Auth**: User management, OIDC/SSO
  - **Nautobot**: Device operations (creation, update, query), configs (backup, config)
  - **CheckMK**: Client, normalization, folder management, sync operations
  - **Network**: Automation (Ansible, Netmiko, templates), compliance, scanning
  - **Settings**: Cache, Git operations (10+ services)

**Router Layer:**
- Thin HTTP layer in `/routers/` handles request/response
- Organized by feature domains with subdirectories
- Delegates to services for business logic
- Authentication and authorization at endpoint level
- Feature domains: auth, nautobot, checkmk, network, jobs, settings, inventory

**Task Management (Celery):**
- Background jobs managed by Celery with Beat scheduler
- Task definitions in `/tasks/` with execution and scheduling layers
- Periodic tasks configured in `beat_schedule.py`
- Replaces older APScheduler implementation

**Database Management:**
- Single PostgreSQL database with comprehensive schema
- Migration scripts in `/migrations/` for schema changes
- Schema management through `/core/schema_manager.py`
- Repository pattern for data access

### State Management
- Server-side: React Server Components (no state)
- Client-side: Zustand stores (auth-store.ts)
- TanStack Query: server state (data fetching, caching, mutations)
- Session management: use-session-manager hook
- Form state: React useState (local)

### Styling Approach
- Tailwind CSS utility-first approach
- Mobile-first responsive design
- Shadcn UI component variants
- CSS variables for theming (globals.css)
- Local fonts (no external CDN)

## UI/UX Implementation Guidelines

### UI Component Strategy

**CRITICAL**: All UI components MUST use Shadcn UI as the foundation. Do NOT create custom components from scratch when Shadcn provides an equivalent.

**Component Hierarchy:**
1. **Shadcn UI Primitives** (`/components/ui/`) - Foundation layer
2. **Shared Components** (`/components/shared/`) - Reusable business components
3. **Feature Components** (`/components/features/{domain}/components/`) - Feature-specific components
4. **Layout Components** (`/components/layout/`) - Page layout and structure

### Adding New UI Components

**Step 1: Check if Shadcn provides the component**

Before creating any UI component, check the [Shadcn UI documentation](https://ui.shadcn.com/docs/components):

```bash
# Install a Shadcn component
cd frontend
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add table
npx shadcn@latest add form
npx shadcn@latest add select
# etc.
```

**Available Shadcn Components** (use these instead of building custom):
- Buttons, Inputs, Textareas, Select, Checkbox, Radio, Switch
- Dialog, Alert Dialog, Sheet, Popover, Tooltip, Dropdown Menu
- Table, Data Table, Card, Tabs, Accordion
- Form, Label, Badge, Avatar, Separator
- Command, Context Menu, Navigation Menu, Menubar
- Alert, Toast, Progress, Skeleton, Scroll Area
- Calendar, Date Picker, Slider, Toggle, Toggle Group

**Step 2: If not available in Shadcn, create custom component**

Only create custom components when Shadcn doesn't provide an equivalent:

```typescript
// ✅ CORRECT: Using Shadcn as base
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function CustomFeatureDialog() {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom Feature</DialogTitle>
        </DialogHeader>
        {/* Your custom content using Shadcn primitives */}
      </DialogContent>
    </Dialog>
  )
}

// ❌ WRONG: Building dialog from scratch
export function CustomDialog() {
  return (
    <div className="fixed inset-0 bg-black/50">
      {/* Don't do this! Use Shadcn Dialog */}
    </div>
  )
}
```

### Tailwind CSS Conventions

**Layout & Spacing:**
```typescript
// Use consistent spacing scale
className="p-4"      // padding: 1rem
className="px-6"     // padding-left/right: 1.5rem
className="gap-4"    // gap: 1rem
className="space-y-4" // vertical spacing between children

// Responsive design (mobile-first)
className="w-full md:w-1/2 lg:w-1/3"
className="flex flex-col md:flex-row"
```

**Colors:**
```typescript
// Use semantic color tokens from globals.css
className="bg-background text-foreground"
className="bg-card text-card-foreground"
className="bg-primary text-primary-foreground"
className="bg-secondary text-secondary-foreground"
className="bg-muted text-muted-foreground"
className="bg-destructive text-destructive-foreground"
className="border border-border"

// ❌ WRONG: Don't use arbitrary colors
className="bg-blue-500 text-white" // Don't do this!
```

**Typography:**
```typescript
// Use consistent text sizes
className="text-sm"     // 14px
className="text-base"   // 16px
className="text-lg"     // 18px
className="text-xl"     // 20px
className="text-2xl"    // 24px

// Font weights
className="font-medium" // 500
className="font-semibold" // 600
className="font-bold"   // 700
```

### Form Implementation

**Always use Shadcn Form components with react-hook-form:**

```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const formSchema = z.object({
  username: z.string().min(2).max(50),
  email: z.string().email(),
})

export function UserForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Handle form submission
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Enter username" {...field} />
              </FormControl>
              <FormDescription>Your unique username</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
```

### Dialog/Modal Implementation

**Pattern for all dialogs:**

```typescript
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function FeatureDialog() {
  const [open, setOpen] = useState(false)

  const handleSubmit = async () => {
    // Handle submission
    setOpen(false) // Close dialog on success
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            Brief description of what this dialog does
          </DialogDescription>
        </DialogHeader>
        {/* Dialog content */}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Table Implementation

**For data tables, use Shadcn Data Table with TanStack Table:**

```typescript
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function DataTable({ data }: { data: any[] }) {
  return (
    <Table>
      <TableCaption>A list of items</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.status}</TableCell>
            <TableCell>
              <Button size="sm" variant="ghost">Edit</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

### Loading States

**Use Shadcn Skeleton for loading:**

```typescript
import { Skeleton } from "@/components/ui/skeleton"

export function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  )
}

// In your component
export function DataComponent() {
  const { data, loading } = useData()

  if (loading) return <LoadingState />

  return <div>{/* Render data */}</div>
}
```

### Toast Notifications

**Use Shadcn Toast for all notifications:**

```typescript
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"

export function Component() {
  const { toast } = useToast()

  const handleAction = async () => {
    try {
      // Perform action
      toast({
        title: "Success",
        description: "Action completed successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  return <Button onClick={handleAction}>Do Action</Button>
}
```

### Icons

**Use Lucide React for all icons:**

```typescript
import {
  Check,
  X,
  Loader2,
  AlertCircle,
  Settings,
  User,
  ChevronDown
} from "lucide-react"

// Icon sizes
<Check className="h-4 w-4" />    // Small
<Check className="h-5 w-5" />    // Medium (default)
<Check className="h-6 w-6" />    // Large

// Loading spinner
<Loader2 className="h-4 w-4 animate-spin" />

// With buttons
<Button>
  <Settings className="mr-2 h-4 w-4" />
  Settings
</Button>
```

### Responsive Design

**Mobile-first approach:**

```typescript
// Stack vertically on mobile, horizontal on desktop
<div className="flex flex-col md:flex-row gap-4">
  <div>Content 1</div>
  <div>Content 2</div>
</div>

// Hide on mobile, show on desktop
<div className="hidden md:block">Desktop only</div>

// Show on mobile, hide on desktop
<div className="block md:hidden">Mobile only</div>

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Grid items */}
</div>
```

### Dark Mode Support

All Shadcn components automatically support dark mode via CSS variables. No additional work needed.

### Accessibility Requirements

**All interactive elements MUST be accessible:**

```typescript
// ✅ CORRECT: Proper labels and ARIA
<Button aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>

// ✅ CORRECT: Form labels
<FormLabel htmlFor="email">Email</FormLabel>
<Input id="email" type="email" />

// ✅ CORRECT: Dialog descriptions
<DialogDescription>
  This action cannot be undone
</DialogDescription>

// ❌ WRONG: No label for icon button
<button><X /></button>
```

### Component Organization Pattern

**Feature component structure:**

```
/components/features/monitoring/
  ├── components/
  │   ├── MonitoringDashboard.tsx    # Main component
  │   ├── MonitoringCard.tsx         # Sub-component
  │   └── MonitoringChart.tsx        # Sub-component
  ├── dialogs/
  │   ├── CreateMonitorDialog.tsx    # Dialog components
  │   └── EditMonitorDialog.tsx
  ├── tabs/
  │   ├── OverviewTab.tsx            # Tab components
  │   └── HistoryTab.tsx
  └── hooks/
      └── use-monitoring-data.ts     # Custom hooks
```

### Common Patterns

**Button variants:**
```typescript
<Button variant="default">Primary Action</Button>
<Button variant="secondary">Secondary Action</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Subtle</Button>
<Button variant="link">Link Style</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Settings /></Button>
```

**Card layout:**
```typescript
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    {/* Footer actions */}
  </CardFooter>
</Card>
```

### DO's and DON'Ts

**DO:**
- ✅ Use Shadcn UI components for all UI primitives
- ✅ Use Tailwind CSS utility classes for styling
- ✅ Use semantic color tokens (bg-background, text-foreground, etc.)
- ✅ Implement proper loading states with Skeleton
- ✅ Use Toast for all notifications
- ✅ Use Lucide React for all icons
- ✅ Follow mobile-first responsive design
- ✅ Ensure proper accessibility (labels, ARIA attributes)
- ✅ Use react-hook-form with zod for form validation

**DON'T:**
- ❌ Build UI components from scratch when Shadcn provides them
- ❌ Use arbitrary color values (bg-blue-500, etc.)
- ❌ Use inline styles
- ❌ Mix UI libraries (don't add Material-UI, Ant Design, etc.)
- ❌ Use alert() or confirm() - use Dialog/AlertDialog
- ❌ Create custom modal/dialog implementations
- ❌ Ignore responsive design
- ❌ Skip accessibility attributes
- ❌ Use different icon libraries

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
- **Migration Guide**: `/frontend/TANSTACK_QUERY_MIGRATION.md`

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

**CRITICAL**: Follow the layered architecture pattern: Model → Repository → Service → Router

**Complete Implementation Steps**:

**Step 1: Define SQLAlchemy Model in `/backend/core/models.py`**
```python
class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    ip_address = Column(String(45))
    device_type = Column(String(100))
    status = Column(String(50), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_devices_status", "status"),
    )
```

**Step 2: Create Pydantic Models in `/backend/models/devices.py`**
```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DeviceCreate(BaseModel):
    name: str
    ip_address: Optional[str] = None
    device_type: Optional[str] = None
    status: str = "active"

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    device_type: Optional[str] = None
    status: Optional[str] = None

class DeviceResponse(BaseModel):
    id: int
    name: str
    ip_address: Optional[str]
    device_type: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

**Step 3: Create Repository in `/backend/repositories/device_repository.py`**
```python
from typing import List, Optional
from sqlalchemy.orm import Session
from core.models import Device
from repositories.base import BaseRepository

class DeviceRepository(BaseRepository[Device]):
    def __init__(self, db: Session):
        super().__init__(Device, db)

    def get_by_name(self, name: str) -> Optional[Device]:
        return self.db.query(Device).filter(Device.name == name).first()

    def get_by_status(self, status: str) -> List[Device]:
        return self.db.query(Device).filter(Device.status == status).all()

    def search(self, query: str) -> List[Device]:
        return self.db.query(Device).filter(
            Device.name.ilike(f"%{query}%")
        ).all()
```

**Step 4: Create Service in `/backend/services/device_service.py`**
```python
from typing import List
from sqlalchemy.orm import Session
from repositories.device_repository import DeviceRepository
from models.devices import DeviceCreate, DeviceUpdate
from core.models import Device

class DeviceService:
    def __init__(self, db: Session):
        self.device_repo = DeviceRepository(db)

    def create_device(self, device_data: DeviceCreate) -> Device:
        # Check if device already exists
        existing = self.device_repo.get_by_name(device_data.name)
        if existing:
            raise ValueError(f"Device with name {device_data.name} already exists")

        # Create device
        device = Device(**device_data.dict())
        return self.device_repo.create(device)

    def get_device(self, device_id: int) -> Device:
        device = self.device_repo.get_by_id(device_id)
        if not device:
            raise ValueError(f"Device {device_id} not found")
        return device

    def update_device(self, device_id: int, device_data: DeviceUpdate) -> Device:
        device = self.get_device(device_id)

        # Update only provided fields
        update_data = device_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(device, field, value)

        return self.device_repo.update(device)

    def delete_device(self, device_id: int) -> None:
        device = self.get_device(device_id)
        self.device_repo.delete(device)

    def list_devices(self, status: Optional[str] = None) -> List[Device]:
        if status:
            return self.device_repo.get_by_status(status)
        return self.device_repo.get_all()
```

**Step 5: Create Router in `/backend/routers/devices.py`**
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from core.database import get_db
from core.auth import require_permission
from services.device_service import DeviceService
from models.devices import DeviceCreate, DeviceUpdate, DeviceResponse

router = APIRouter(prefix="/devices", tags=["devices"])

def get_device_service(db: Session = Depends(get_db)) -> DeviceService:
    return DeviceService(db)

@router.post(
    "",
    response_model=DeviceResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_device(
    device: DeviceCreate,
    service: DeviceService = Depends(get_device_service),
    user: dict = Depends(require_permission("devices", "write"))
):
    """Create a new device"""
    try:
        return service.create_device(device)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("", response_model=List[DeviceResponse])
async def list_devices(
    status: Optional[str] = None,
    service: DeviceService = Depends(get_device_service),
    user: dict = Depends(require_permission("devices", "read"))
):
    """List all devices, optionally filtered by status"""
    return service.list_devices(status=status)

@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: int,
    service: DeviceService = Depends(get_device_service),
    user: dict = Depends(require_permission("devices", "read"))
):
    """Get a specific device by ID"""
    try:
        return service.get_device(device_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: int,
    device: DeviceUpdate,
    service: DeviceService = Depends(get_device_service),
    user: dict = Depends(require_permission("devices", "write"))
):
    """Update a device"""
    try:
        return service.update_device(device_id, device)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: int,
    service: DeviceService = Depends(get_device_service),
    user: dict = Depends(require_permission("devices", "delete"))
):
    """Delete a device"""
    try:
        service.delete_device(device_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
```

**Step 6: Register Router in `/backend/main.py`**
```python
from routers.devices import router as devices_router

app.include_router(devices_router)
```

**Step 7: Run Database Migration**
```bash
# The schema will be auto-created on next startup via init_db()
# Or manually trigger migration via schema_manager
```

**Key Points:**
- ✅ **SQLAlchemy Model**: Defines database table structure with indexes
- ✅ **Pydantic Models**: Separate models for Create, Update, Response
- ✅ **Repository**: Handles all database operations with type safety
- ✅ **Service**: Contains business logic, uses repository for data access
- ✅ **Router**: Thin HTTP layer, delegates to service, uses dependency injection
- ✅ **Permissions**: Each endpoint protected with appropriate permissions
- ✅ **Error Handling**: Proper HTTP status codes and error messages
- ✅ **Type Safety**: Full type hints throughout the stack

### 2. New Frontend Page

**Steps**:
1. Create page in `/frontend/src/app/{path}/page.tsx`
2. Create components in `/frontend/src/components/{feature}/`
3. Add API calls to `/api/proxy/{backend-endpoint}`
4. Add query keys to `/lib/query-keys.ts`
5. Create TanStack Query hooks in `/hooks/queries/use-{domain}-query.ts`
6. Update sidebar in `/frontend/src/components/app-sidebar.tsx`:
   ```typescript
   {
     title: "New Feature",
     url: "/new-feature",
     icon: IconName,
   }
   ```
7. Add route to layout if needed
8. Use query hooks in components (NOT manual `useState + useEffect`)

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
- ✅ Use TanStack Query for server state (data fetching, caching, mutations)

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

**When refactoring Code**
1. TanStack Query for ALL data fetching - No manual `useState + useEffect`
2. react-hook-form + Zod for validation - Type-safe form validation
3. Query key factory - Centralized in `/lib/query-keys.ts`
4. Mutation hooks - For all write operations
5. React Best Practices - Memoized returns, stable constants
6. Feature-based organization - `/hooks/queries/` for TanStack hooks

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
