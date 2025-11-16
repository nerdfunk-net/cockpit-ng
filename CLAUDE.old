# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (Next.js)
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Start development server (with Turbopack)
npm run build                  # Build for production
npm run lint                   # Run ESLint
```

### Backend (FastAPI)
```bash
cd backend
python -m venv .venv           # Create virtual environment
source .venv/bin/activate      # Activate venv (Linux/Mac)
pip install -r requirements.txt # Install dependencies
python start.py                # Start development server
python -m uvicorn main:app --reload  # Alternative start command
```

### Docker Deployment
```bash
docker-compose up -d           # Start in detached mode
./test-docker-deployment.sh    # Verify deployment health
docker-compose logs            # View logs
```

### Testing
```bash
# Backend has individual test scripts
cd backend
python test_config.py          # Test configuration
python test_imports.py         # Test module imports
python test_credentials.py     # Test credential management
python test_uvicorn_load.py    # Test server loading
```

## Architecture Overview

### High-Level Structure
- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI with modular routers, SQLite for settings/cache, async Python
- **Integration**: Nautobot API integration, Git repository management
- **Deployment**: Docker container with both frontend/backend, air-gap support

### Key Directories
```
cockpit-ng/
├── frontend/src/app/          # Next.js App Router pages
├── frontend/src/components/   # React components organized by feature
├── backend/routers/           # FastAPI route handlers (modular architecture)
├── backend/models/            # Pydantic data models
├── backend/services/          # Business logic layer
├── backend/core/              # Auth and core utilities
├── data/                      # Persistent data (git repos, settings, cache)
└── docker/                    # Docker deployment configurations
```

### Authentication Flow
- JWT-based authentication with configurable expiry (default 10 minutes)
- Authentication uses stored credentials from credential manager
- Session management with automatic renewal
- Protected API endpoints use `verify_token` dependency

### Data Storage
- **Settings**: SQLite databases in `data/settings/` (cockpit_settings.db, etc.)
- **Git Repositories**: Managed in `data/git/` with GitPython integration
- **Templates**: Jinja2 templates stored in database and `data/templates/`
- **Cache**: In-memory cache service with configurable TTL and prefetch

### API Architecture
- **Frontend Proxy**: All backend calls go through `/api/proxy/[...path]` route
- **Modular Routers**: Each feature has its own router (auth, nautobot, git, etc.)
- **GraphQL Support**: Legacy GraphQL endpoints for Nautobot integration
- **Health Checks**: `/api/health` (frontend) and `/health` (backend)

### Configuration Management
- Environment variables loaded via `backend/config.py`
- Settings persisted in SQLite via `settings_manager.py`
- Git SSL verification configurable for corporate environments
- Air-gap deployment support with local fonts and assets

### Key Components

#### Frontend Components
- **Dashboard Layout**: Sidebar navigation with feature-based organization
- **Settings Management**: Modular settings pages (nautobot, git, credentials)
- **Device Management**: Onboarding, scanning, configuration backup
- **Compare Tools**: Side-by-side file and configuration comparison

#### Backend Services
- **Nautobot Service**: GraphQL and REST API integration with caching
- **Git Manager**: Repository cloning, syncing, commit history with caching
- **Cache Service**: Intelligent caching with startup prefetch and refresh loops
- **Template Manager**: Jinja2 template processing for configuration generation

### Development Notes
- Uses local fonts for air-gap environments (Geist Sans/Mono)
- Enhanced error reporting in development mode for React key warnings
- Background cache warming on startup with configurable prefetch items
- Modular router architecture allows easy feature extension
- Settings management separates environment config from persistent database settings

### Integration Points
- **Nautobot**: Device inventory, location management, GraphQL queries
- **Git**: Configuration versioning, template storage, multi-repo support  
- **Ansible**: Dynamic inventory generation from Nautobot data
- **SSH**: Device configuration backup and management (via NAPALM)

## Code Style Guidelines

### Frontend (TypeScript/React/Next.js)

#### Component Structure
- Use functional components with TypeScript interfaces
- Prefer Server Components by default, mark client components with 'use client'
- Structure files: exported component, subcomponents, helpers, static content, types
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError)
- Extract reusable logic into custom hooks
- Add unique IDs for each item in lists

#### TypeScript Best Practices
- Prefer interfaces over types for object definitions
- Use strict TypeScript configuration
- Avoid `any`, prefer `unknown` for unknown types
- Use PascalCase for interfaces, camelCase for variables
- Prefix component props interfaces with 'Props' (e.g., ButtonProps)
- Use explicit return types for public functions

#### Next.js Conventions
- Use App Router directory structure
- Place shared components in `components/` directory
- Use lowercase with dashes for directories (e.g., `components/auth-wizard`)
- Minimize 'use client', 'useEffect', and 'setState'
- Wrap client components in Suspense with fallback
- Use dynamic loading for non-critical components

#### Styling with Tailwind
- Use utility classes over custom CSS
- Implement mobile-first responsive design
- Use shadcn/ui components when available
- Use semantic color naming and proper contrast
- Group related utilities with @apply when needed

#### Performance & State
- Favor React Server Components (RSC) where possible
- Use proper memoization (useMemo, useCallback)
- Keep state as close to where it's used as possible
- Use 'nuqs' for URL search parameter state management
- Implement proper loading and error states

### Backend (Python/FastAPI)

#### Project Organization
- Keep routes organized by domain in `routers/` directory
- Use Pydantic v2 models for all input/output validation
- Structure router files: exported router, sub-routes, utilities, static content, types
- Use proper dependency injection patterns
- Keep models organized in `models/` directory

#### Code Style
- Use type hints for all function signatures
- Prefer Pydantic models over raw dictionaries for validation
- Avoid unnecessary curly braces in conditionals
- Use concise, one-line syntax for simple statements
- Implement proper async/await patterns

#### API Design
- Use proper HTTP methods and status codes
- Implement comprehensive input validation
- Document APIs with OpenAPI/FastAPI automatic docs
- Use proper error handling with custom error types
- Implement JWT authentication with proper session management

#### Security & Performance
- Implement proper CORS and rate limiting
- Use proper password hashing and security headers
- Implement proper caching strategies
- Use async operations and background tasks appropriately
- Handle database transactions properly

### General Development Practices

#### Architecture Separation
- **Important**: Frontend MUST NOT use backend directly
- All backend communication goes through Next.js proxy (`/api/proxy/[...path]`)
- Run backend and frontend in separate terminals
- All backend endpoints require authentication

#### Error Handling
- Implement proper Error Boundaries in React
- Handle async errors with try-catch blocks
- Show user-friendly error messages
- Log errors appropriately without exposing secrets
- Handle edge cases gracefully

#### Testing & Quality
- Write unit tests for components and API logic
- Use React Testing Library for frontend testing
- Implement proper integration tests
- Use ESLint and Prettier with consistent configuration
- Test error scenarios and user interactions

#### Security
- Never set innerHTML with untrusted strings
- Avoid leaking secrets into client-side logs
- Implement proper input validation on both frontend and backend
- Use proper authentication flows and session management