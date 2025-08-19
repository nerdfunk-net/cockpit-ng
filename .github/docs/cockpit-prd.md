# Product Requirements Document (PRD)

## 1. Overview

**Cockpit** is a network device management dashboard that provides configuration comparison, Git-based version control, and Nautobot integration for network engineers and NetDevOps teams.

**Core Purpose:**
- Compare device configurations across files, Git commits, and file history
- Manage Ansible inventories with Git versioning
- Integrate with Nautobot for authoritative device data
- Provide unified diff visualization and commit navigation
- Manage templates, credentials, and settings through web interface

**Target Users:**
- Network Engineers
- Site Reliability Engineers (SREs) 
- NetDevOps Teams
- Infrastructure Automation Engineers

## 2. Technology Stack

### Frontend Stack
- **Build Tool:** Vite 6.3.5+ with ES2022 target
- **UI Framework:** Bootstrap 5 with Gentelella template
- **Language:** JavaScript ES6+ (no TypeScript)
- **Styling:** SCSS with main entry at `src/main.scss`
- **Legacy Support:** jQuery for existing widgets and UI components

### Frontend Dependencies
```json
{
  "core": ["bootstrap", "@popperjs/core", "jquery"],
  "charts": ["chart.js", "echarts", "leaflet"],
  "forms": ["select2", "ion-rangeslider", "autosize", "switchery", "@eonasdan/tempus-dominus"],
  "ui": ["jquery-ui", "nprogress", "datatables.net", "datatables.net-bs5"],
  "utils": ["dayjs", "jquery-sparkline", "skycons"]
}
```

### Backend Stack
- **Framework:** FastAPI with async/await patterns
- **Server:** Uvicorn ASGI server
- **Language:** Python 3.11+
- **Database:** SQLite for settings and template metadata
- **Authentication:** JWT with bcrypt password hashing

### Backend Dependencies
```python
fastapi
uvicorn
pydantic[dotenv]
pydantic-settings
requests
pyjwt
passlib[bcrypt]
python-multipart
python-dotenv
gitpython
jinja2
cryptography>=42.0.0
textfsm
```

### Development Environment
- **Frontend Dev Server:** Vite on port 3000/3001 with proxy to backend
- **Backend Dev Server:** Uvicorn on port 8000 with auto-reload
- **Proxy Configuration:** `/api` and `/auth` routes proxied to backend
- **Hot Reload:** Frontend and backend support file watching

## 3. Architecture & Components

### Frontend Architecture
- **Entry Points:** Multiple HTML pages in `production/` directory
- **Module System:** ES6 modules with Vite bundling
- **API Communication:** Centralized through `CockpitConfig.api` with auto-detection
- **Authentication:** JWT tokens stored in localStorage with session management
- **URL Strategy:** Relative URLs in development (Vite proxy), absolute URLs in production

### Backend Architecture
- **Router Pattern:** Modular FastAPI routers in `backend/routers/`
- **Authentication:** JWT verification dependency for protected endpoints
- **Git Integration:** GitPython for repository operations and diff generation
- **Template System:** Jinja2 templates with SQLite metadata storage
- **Cache Service:** In-memory caching for performance optimization

### Key Backend Routers
```python
routers = [
    "auth",           # JWT authentication
    "nautobot",       # Nautobot API integration
    "git",            # Git repository operations
    "files",          # File comparison and operations
    "settings",       # Application settings management
    "templates",      # Template management
    "git_repositories", # Git repository configuration
    "credentials",    # Credential management
    "ansible_inventory", # Ansible inventory operations
    "scan_and_add",   # Device scanning and onboarding
    "cache"           # Cache inspection and management
]
```

## 4. Core Features & Implementation

### Configuration Comparison Engine
- **File Comparison:** Compare any two files with unified diff output
- **Git Commit Comparison:** Compare files across different Git commits
- **File History:** Show complete timeline of file changes with commit navigation
- **Search Functionality:** Regex-based file search across repository history
- **Export Capability:** Export diffs to downloadable files

### Git Integration Requirements
- **Repository Management:** Clone, sync, and manage Git repositories
- **Branch Operations:** List branches, switch between branches, view commits
- **Diff Generation:** Unified diff format with context lines
- **SSL Support:** Configurable SSL verification for self-hosted Git servers
- **Commit Navigation:** Timeline view with commit metadata and file changes

### Ansible Inventory Management
- **Inventory Parsing:** Parse YAML/INI inventory files from Git or filesystem
- **Hierarchy Visualization:** Display group/host relationships and variables
- **Version Control:** Track inventory changes through Git history
- **Variable Inspection:** View and search host/group variables

### Authentication System
- **JWT Implementation:** Token-based authentication with configurable expiry
- **Password Hashing:** bcrypt for secure password storage
- **Session Management:** Browser localStorage with cross-tab synchronization
- **Demo Credentials:** admin/admin and guest/guest for testing

### Template Management System
- **Template Storage:** File system storage with SQLite metadata
- **Jinja2 Rendering:** Template rendering with variable substitution
- **CRUD Operations:** Create, read, update, delete templates via API
- **Import/Export:** Bulk template operations
- **Version Control:** Track template changes and history

### Settings Management
- **SQLite Storage:** Persistent settings in `data/settings/cockpit_settings.db`
- **Runtime Updates:** Modify settings without application restart
- **Environment Override:** Environment variables take precedence
- **Categories:** Git, Nautobot, credentials, templates, cache settings

## 5. API Endpoints Structure

### Authentication Endpoints
```
POST /auth/login          # User login with credentials
GET  /auth/verify         # Token verification
```

### Git Operations
```
GET  /api/git/status      # Repository status
POST /api/git/sync        # Sync repository
GET  /api/git/branches    # List branches
GET  /api/git/commits     # List commits
POST /api/git/diff        # Generate diff between commits/files
GET  /api/git/file-complete-history/{file_path}  # File commit history
```

### File Operations
```
GET  /api/files/list      # List configuration files
POST /api/files/compare   # Compare files
POST /api/files/export-diff  # Export diff to file
```

### Settings Management
```
GET  /api/settings/{category}     # Get settings by category
PUT  /api/settings/{category}     # Update settings
GET  /api/settings/test/{service} # Test service connections
```

### Template Operations
```
GET    /api/templates         # List templates
POST   /api/templates         # Create template
GET    /api/templates/{id}    # Get template
PUT    /api/templates/{id}    # Update template
DELETE /api/templates/{id}    # Delete template
POST   /api/templates/render  # Render template with variables
```

## 6. Data Models & Storage

### Settings Storage (SQLite)
```sql
settings (
    id INTEGER PRIMARY KEY,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

### Template Storage (SQLite + Filesystem)
```sql
templates (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    source TEXT NOT NULL,  -- 'manual', 'nautobot', 'file'
    type TEXT NOT NULL,    -- 'jinja2', 'text'
    file_path TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

### Configuration Files
- **Application Config:** `backend/config.py` with Pydantic settings
- **Environment Variables:** `.env` file for sensitive configuration
- **Frontend Config:** `production/js/config.js` with API endpoint configuration

## 7. Development & Deployment

### Development Setup Requirements
```bash
# Frontend
npm install
npm run dev  # Vite dev server on port 3000

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python start.py  # FastAPI server on port 8000
```

### Production Build Process
```bash
npm run build    # Build frontend assets to dist/
# Backend runs with python start.py (production mode)
```

### Docker Configuration
- **Development:** Multi-stage with hot reload and volume mounts
- **Production:** Optimized build with pre-built assets
- **Ports:** Frontend 3000, Backend 8000
- **Volumes:** `./data` for persistent SQLite databases and Git repositories

### Environment Variables

#### Complete .env.example Template
```bash
# Cockpit Backend Configuration
# Copy this file to .env and modify the values as needed

# =============================================================================
# REQUIRED CONFIGURATION - YOU MUST CHANGE THESE VALUES
# =============================================================================

# Nautobot Configuration (REQUIRED)
NAUTOBOT_HOST=http://localhost:8080
NAUTOBOT_TOKEN=your-nautobot-token-here
NAUTOBOT_TIMEOUT=30

# Security Configuration (REQUIRED)
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# =============================================================================
# SERVER CONFIGURATION
# =============================================================================

# Server Configuration
SERVER_HOST=127.0.0.1
SERVER_PORT=8000
DEBUG=false

# Logging Configuration
LOG_LEVEL=INFO
LOG_FORMAT=%(asctime)s - %(name)s - %(levelname)s - %(message)s

# =============================================================================
# AUTHENTICATION & DEMO CREDENTIALS
# =============================================================================

# Demo credentials (change in production)
DEMO_USERNAME=admin
DEMO_PASSWORD=admin

# =============================================================================
# GIT & SSL CONFIGURATION
# =============================================================================

# Git SSL Configuration (for self-hosted Git servers with custom certificates)
GIT_SSL_VERIFY=true
# GIT_SSL_CA_INFO=/path/to/custom-ca-cert.pem
# GIT_SSL_CERT=/path/to/client-cert.pem

# =============================================================================
# FILE STORAGE CONFIGURATION
# =============================================================================

# Directory where configuration files are stored (relative to backend directory)
CONFIG_FILES_DIRECTORY=config_files

# Allowed file extensions for configuration files (comma-separated)
ALLOWED_FILE_EXTENSIONS=.txt,.conf,.cfg,.config,.ini,.yaml,.yml,.json

# Maximum file size in MB for file uploads and comparisons
MAX_FILE_SIZE_MB=10

# Data directory configuration - use project-relative path for Docker compatibility
DATA_DIRECTORY=../data

# =============================================================================
# OPTIONAL FUTURE CONFIGURATION
# =============================================================================

# Database Configuration (optional, for future use)
# DATABASE_URL=postgresql://user:password@localhost/cockpit
```

#### Docker Environment Configuration (.env.docker)
```bash
# Cockpit Docker Environment Configuration
# Copy this file to .env and modify the values for your environment

# =============================================================================
# REQUIRED CONFIGURATION - YOU MUST CHANGE THESE VALUES
# =============================================================================

# Nautobot Configuration
NAUTOBOT_HOST=https://your-nautobot-instance.com
NAUTOBOT_TOKEN=your-nautobot-api-token-here

# Security Configuration  
SECRET_KEY=your-super-secret-jwt-signing-key-change-this

# =============================================================================
# OPTIONAL CONFIGURATION - Modify as needed
# =============================================================================

# Server Configuration
DEBUG=false
LOG_LEVEL=INFO

# Authentication Configuration
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Network Configuration
NAUTOBOT_TIMEOUT=30

# Git SSL Configuration (for custom certificates)
GIT_SSL_VERIFY=true                          # Set to false to disable SSL verification (not recommended)
# GIT_SSL_CA_INFO=/path/to/ca-cert.pem      # Path to custom CA certificate
# GIT_SSL_CERT=/path/to/client-cert.pem     # Path to client certificate

# Frontend Configuration
NODE_ENV=development
VITE_HOST=0.0.0.0
VITE_PORT=3000
VITE_ALLOWED_HOSTS=auto                      # Comma-separated list of allowed hosts or 'auto'

# Backend Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
```

#### Development vs Production Differences

**Development Configuration:**
- `DEBUG=true` - Enables debug mode with auto-reload
- `LOG_LEVEL=DEBUG` - Verbose logging for troubleshooting
- `SERVER_HOST=127.0.0.1` - Local development binding
- `ACCESS_TOKEN_EXPIRE_MINUTES=30` - Shorter token expiry for security testing
- `GIT_SSL_VERIFY=false` - May be disabled for local Git servers

**Production Configuration:**
- `DEBUG=false` - Disables debug mode for security
- `LOG_LEVEL=INFO` or `WARNING` - Reduced logging for performance
- `SERVER_HOST=0.0.0.0` - Accept connections from any interface
- `ACCESS_TOKEN_EXPIRE_MINUTES=60` - Longer token expiry for user convenience
- `SECRET_KEY` - Must be cryptographically secure random string
- `GIT_SSL_VERIFY=true` - Always verify SSL certificates in production

#### Docker Compose Environment Variables
```yaml
environment:
  # Frontend Configuration
  - NODE_ENV=development
  - VITE_HOST=0.0.0.0
  - VITE_PORT=3000
  - VITE_ALLOWED_HOSTS=${VITE_ALLOWED_HOSTS:-auto}

  # Backend Server Configuration
  - SERVER_HOST=0.0.0.0
  - SERVER_PORT=8000
  - DEBUG=false

  # Nautobot Configuration (REQUIRED)
  - NAUTOBOT_HOST=${NAUTOBOT_HOST:-http://localhost:8080}
  - NAUTOBOT_TOKEN=${NAUTOBOT_TOKEN:-your-nautobot-token-here}
  - NAUTOBOT_TIMEOUT=${NAUTOBOT_TIMEOUT:-30}

  # Authentication Configuration
  - SECRET_KEY=${SECRET_KEY:-change-this-in-production}
  - ACCESS_TOKEN_EXPIRE_MINUTES=${ACCESS_TOKEN_EXPIRE_MINUTES:-60}

  # Git SSL Configuration
  - GIT_SSL_VERIFY=${GIT_SSL_VERIFY:-true}
```

#### SSL Certificate Configuration Examples

**Custom CA Certificate:**
```bash
# For self-signed certificates or custom CA
GIT_SSL_VERIFY=true
GIT_SSL_CA_INFO=/etc/ssl/certs/custom-ca.pem
```

**Client Certificate Authentication:**
```bash
# For Git servers requiring client certificates
GIT_SSL_VERIFY=true
GIT_SSL_CERT=/etc/ssl/private/client-cert.pem
```

**Disable SSL Verification (Development Only):**
```bash
# NOT RECOMMENDED FOR PRODUCTION
GIT_SSL_VERIFY=false
```

## 8. Security & Performance

### Security Requirements
- **JWT Token Security:** Configurable expiry, secure secret key
- **Password Hashing:** bcrypt with salt rounds
- **Input Validation:** Pydantic models for all API inputs
- **Git SSL:** Configurable SSL verification for repository operations
- **CORS:** Eliminated through Vite proxy configuration

### Performance Optimizations
- **Caching:** In-memory cache service for frequently accessed data
- **Bundle Splitting:** Vendor chunks separated in Vite build
- **Lazy Loading:** Dynamic imports for large components
- **Database Indexing:** SQLite indexes on frequently queried columns

## 9. External Integrations

### Nautobot Integration
- **GraphQL Queries:** Device, location, namespace data fetching
- **Authentication:** Token-based API access
- **Connection Testing:** Health check endpoints
- **Data Synchronization:** Configurable sync intervals

### Git Repository Integration
- **Protocols:** HTTPS and SSH support
- **Authentication:** SSH keys, HTTPS credentials
- **Operations:** Clone, pull, fetch, diff, log
- **SSL Configuration:** Custom CA certificates for self-hosted Git

## 10. File Structure Requirements

### Frontend Structure
```
production/           # Static HTML pages
├── index.html       # Main dashboard
├── compare.html     # Configuration comparison
├── ansible-inventory.html  # Inventory management
├── settings.html    # Settings management
├── js/              # JavaScript modules
├── css/             # Compiled CSS
└── static/          # Static assets

src/                 # Source files
├── main.js          # Main entry point
├── main.scss        # SCSS entry point
├── config.js        # Frontend configuration
└── modules/         # Reusable modules
```

### Backend Structure
```
backend/
├── main.py          # FastAPI application
├── config.py        # Configuration management
├── start.py         # Server startup
├── requirements.txt # Python dependencies
├── core/            # Core functionality
│   └── auth.py      # Authentication
├── routers/         # API routers
├── models/          # Pydantic models
├── services/        # Business logic
└── data/            # SQLite databases
```

## 11. Implementation Notes for AI Co-pilot

### Critical Implementation Details
1. **Vite Proxy Setup:** Essential for development - all API calls use relative URLs
2. **JWT Authentication:** Every protected endpoint requires `Depends(verify_token)`
3. **Git Repository Consistency:** All Git operations must use `get_git_repo()` helper
4. **Settings Persistence:** Use `settings_manager` for runtime configuration updates
5. **Error Handling:** FastAPI HTTPException with appropriate status codes

### Common Patterns
- **API Communication:** `window.authManager.apiRequest()` for authenticated requests
- **Router Organization:** One router per feature domain in `backend/routers/`
- **Model Validation:** Pydantic models for all request/response data
- **File Operations:** Use Path objects and proper error handling
- **Database Access:** SQLite with connection pooling for settings

### Testing Strategy
- **Backend:** FastAPI TestClient for API endpoint testing
- **Frontend:** Manual testing with browser developer tools
- **Integration:** Docker compose for full stack testing
- **Authentication:** Test with demo credentials (admin/admin)

## 12. User Interface & Application Structure

### Frontend Layout Architecture

Cockpit uses the **Gentelella Bootstrap 5** template with a consistent three-panel layout:

#### Left Sidebar Navigation (230px width)
- **Brand Header:** "Cockpit!" logo with paw icon
- **User Profile Section:** Welcome message with username display
- **Hierarchical Menu Structure:** Collapsible menu sections with FontAwesome icons
- **Menu Footer:** Quick action buttons (Settings, Visibility toggle, Logout)
- **Responsive Behavior:** Collapses to 70px on smaller screens with icon-only view

#### Top Navigation Bar
- **Hamburger Menu Toggle:** Controls sidebar collapse/expand
- **User Dropdown:** Profile access and logout option
- **Breadcrumb Context:** Page-specific information

#### Main Content Area (Right Panel)
- **Page Title Section:** Heading with optional action buttons
- **Content Panels:** Bootstrap card-based layout with collapsible sections
- **Footer:** Fixed positioning with proper margin spacing

### Navigation Menu Structure

```
General
├── 🏠 Home (index.html)
├── 🚀 Onboarding
│   ├── ➕ Onboard Device (onboard-device.html)
│   ├── 🔄 Sync Devices (sync_devices.html)
│   └── 🔍 Scan & Add (scan-and-add.html)
├── ⚙️ Configs
│   ├── 💾 Backup (backup.html)
│   └── 🔄 Compare (compare.html)
├── ⚙️ Ansible
│   └── 📋 Inventory (ansible-inventory.html)
└── 🔧 Settings
    ├── 🖥️ Nautobot (settings-nautobot.html)
    ├── 📄 Templates (settings-templates.html)
    ├── 🌿 Git Management (settings-git.html)
    ├── ⚡ Cache (settings-cache.html)
    └── 🔑 Credentials (settings-credentials.html)
```

### Application Pages & Features

#### 1. Dashboard (index.html)
**Purpose:** Main landing page and system overview
**Key Features:**
- System health indicators and status panels
- Quick access tiles to primary functions
- Recent activity summaries
- Git repository status widget
- Authentication status display

#### 2. Configuration Comparison (compare.html)
**Purpose:** Advanced file and Git commit comparison tool
**Key Features:**
- **Three Comparison Modes:**
  - **Files Mode:** Direct file-to-file comparison from filesystem
  - **Git Commits Mode:** Compare files across different Git commits with branch/commit selection
  - **File History Mode:** Timeline view of single file changes across commits
- **Interactive Diff Viewer:** Side-by-side comparison with syntax highlighting
- **Search & Navigation:** File search with regex support, diff navigation controls
- **Export Functionality:** Download comparison results as patch files
- **Git Integration:** Repository status panel with clone/sync capabilities

#### 3. Ansible Inventory Builder (ansible-inventory.html)
**Purpose:** Dynamic Ansible inventory generation from Nautobot data
**Key Features:**
- **Logical Operations Builder:** Drag-and-drop filter conditions (device name, location, role, tags, etc.)
- **Template-Based Generation:** Jinja2 template selection for custom inventory formats
- **Real-time Preview:** Live device count and preview before generation
- **Pagination & Search:** Handle large device datasets efficiently
- **Download & Copy:** Export inventory as YAML files or clipboard copy

#### 4. Device Onboarding (onboard-device.html)
**Purpose:** Single device registration to Nautobot
**Key Features:**
- **Device Search:** Search existing devices in Nautobot by name
- **Form-based Input:** IP address, hostname, platform, location, role configuration
- **Status Selection:** Device status, interface status, IP address status dropdowns
- **Validation:** Real-time form validation and duplicate checking
- **Job Tracking:** Monitor onboarding job progress and results

#### 5. Scan & Add Wizard (scan-and-add.html)
**Purpose:** Network discovery and bulk device onboarding
**Key Features:**
- **Three-Step Wizard:**
  - **Step 1:** Network scanning configuration (CIDR ranges, credentials, discovery mode)
  - **Step 2:** Scan results with device metrics and authentication status
  - **Step 3:** Bulk onboarding with device type classification (Cisco vs Linux)
- **Real-time Progress:** Live scan progress with metrics (alive, authenticated, failed)
- **Device Classification:** Automatic platform detection (iOS, NXOS, Linux, etc.)
- **Bulk Actions:** Select/deselect devices for onboarding with metadata configuration
- **Template Integration:** Linux device inventory generation with Git repository storage

#### 6. Device Synchronization (sync_devices.html)
**Purpose:** Synchronize device data between systems
**Key Features:**
- **Dual-pane Interface:** Source and target device lists with filtering
- **Advanced Filtering:** Name regex, location, IP prefix (CIDR) filters
- **Batch Operations:** Multi-select devices for bulk synchronization
- **Real-time Updates:** Dynamic device data fetching with instant feedback
- **Progress Tracking:** Sync operation status and completion indicators

#### 7. Settings Management Suite

##### Nautobot Settings (settings-nautobot.html)
- **Connection Configuration:** Host URL, API token, timeout settings
- **Test Connectivity:** Real-time connection testing with status indicators
- **SSL Verification:** Configure SSL certificate validation options

##### Template Management (settings-templates.html)
- **Multi-template System:** Create, edit, delete Jinja2 templates
- **Category Organization:** Templates organized by source (manual, nautobot, file) and type
- **Syntax Highlighting:** Code editor with Jinja2 syntax support
- **Preview & Testing:** Template rendering with variable substitution testing
- **Import/Export:** Bulk template operations and backup functionality

##### Git Management (settings-git.html)
- **Repository Configuration:** Git URL, credentials, branch selection
- **SSL Certificate Management:** Custom CA certificates for self-hosted Git servers
- **Sync Operations:** Manual sync, automatic sync scheduling
- **Status Monitoring:** Repository health, commit history, branch information

##### Credentials Management (settings-credentials.html)
- **Secure Storage:** Encrypted credential storage with type classification
- **Multiple Types:** Username/password, SSH keys, API tokens
- **Access Control:** Credential sharing and permission management
- **Testing Integration:** Validate credentials against target systems

##### Cache Management (settings-cache.html)
- **Performance Monitoring:** Cache hit ratios, memory usage statistics
- **Cache Control:** Clear cache, configure cache policies
- **Debug Information:** Cache key inspection and troubleshooting tools

### UI Components & Patterns

#### Form Elements
- **Bootstrap 5 Styling:** Consistent form controls with validation states
- **Select2 Integration:** Enhanced dropdowns with search and tagging
- **Input Groups:** Bundled inputs with icons and action buttons
- **Validation:** Real-time validation with error/success indicators

#### Tables & Data Display
- **DataTables Integration:** Sortable, searchable, paginated tables
- **Responsive Design:** Mobile-friendly table layouts with horizontal scrolling
- **Action Buttons:** Inline edit, delete, view actions with icon buttons
- **Status Badges:** Color-coded status indicators for various states

#### Progress & Status
- **Progress Bars:** Multi-step wizard progress, operation completion tracking
- **Status Panels:** Collapsible status sections with auto-refresh
- **Toast Notifications:** Success/error messages with auto-dismiss
- **Loading States:** Spinner overlays and skeleton screens during async operations

#### Navigation & Search
- **File Search Dropdowns:** Live search with autocomplete for Git files
- **Breadcrumb Navigation:** Context-aware page location indicators
- **Pagination Controls:** Consistent pagination with page size selection
- **Quick Actions:** Floating action buttons for primary operations

### Responsive Design
- **Mobile-First Approach:** Bootstrap 5 responsive grid system
- **Breakpoint Handling:** Sidebar collapse, table responsive behavior
- **Touch-Friendly:** Adequate touch targets for mobile devices
- **Accessibility:** ARIA labels, keyboard navigation support

### Visual Design Language
- **Color Scheme:** Professional blue/green palette with status color coding
- **Typography:** Roboto/Helvetica font stack with proper hierarchy
- **Iconography:** FontAwesome icons for consistent visual language
- **Spacing:** Bootstrap spacing utilities for consistent layout rhythm

This PRD provides comprehensive implementation guidance for rebuilding Cockpit while maintaining its core architecture and functionality.

## 13. Database Schemas & Initial Data

### SQLite Database Architecture

Cockpit uses SQLite for lightweight, file-based data persistence with three main database files:

#### 1. Settings Database (`data/settings/cockpit_settings.db`)

**Nautobot Settings Table:**
```sql
CREATE TABLE nautobot_settings (
    id INTEGER PRIMARY KEY,
    url TEXT NOT NULL,
    token TEXT NOT NULL,
    timeout INTEGER NOT NULL DEFAULT 30,
    verify_ssl BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Git Settings Table:**
```sql
CREATE TABLE git_settings (
    id INTEGER PRIMARY KEY,
    repo_url TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT 'main',
    username TEXT,
    token TEXT,
    config_path TEXT NOT NULL DEFAULT 'configs/',
    sync_interval INTEGER NOT NULL DEFAULT 15,
    verify_ssl BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Cache Settings Table:**
```sql
CREATE TABLE cache_settings (
    id INTEGER PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT 1,
    ttl_seconds INTEGER NOT NULL DEFAULT 600,
    prefetch_on_startup BOOLEAN NOT NULL DEFAULT 1,
    max_size INTEGER NOT NULL DEFAULT 1000,
    compression BOOLEAN NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Settings Metadata Table:**
```sql
CREATE TABLE settings_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. Git Repositories Database (`data/settings/cockpit_git_repositories.db`)

**Git Repositories Table:**
```sql
CREATE TABLE git_repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('configs', 'templates', 'onboarding')),
    url TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT 'main',
    username TEXT,
    token TEXT,
    credential_name TEXT,
    path TEXT,
    verify_ssl BOOLEAN NOT NULL DEFAULT 1,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_sync TIMESTAMP,
    sync_status TEXT
);
```

#### 3. Templates Database (`data/settings/cockpit_templates.db`)

**Templates Table:**
```sql
CREATE TABLE templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('git', 'file', 'webeditor')),
    template_type TEXT NOT NULL DEFAULT 'jinja2' CHECK(template_type IN ('jinja2', 'text', 'yaml', 'json', 'textfsm')),
    category TEXT,
    description TEXT,
    
    -- Git-specific fields
    git_repo_url TEXT,
    git_branch TEXT DEFAULT 'main',
    git_username TEXT,
    git_token TEXT,
    git_path TEXT,
    git_verify_ssl BOOLEAN DEFAULT 1,
    
    -- File/WebEditor-specific fields
    content TEXT,
    filename TEXT,
    content_hash TEXT,
    
    -- Metadata
    variables TEXT DEFAULT '{}',  -- JSON string
    tags TEXT DEFAULT '[]',       -- JSON string
    
    -- Status
    is_active BOOLEAN DEFAULT 1,
    last_sync TIMESTAMP,
    sync_status TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Template Versions Table:**
```sql
CREATE TABLE template_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    change_notes TEXT,
    FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE CASCADE
);
```

### Database Indexes and Performance

```sql
-- Settings database indexes
CREATE INDEX idx_settings_updated_at ON nautobot_settings(updated_at);
CREATE INDEX idx_git_settings_active ON git_settings(updated_at);

-- Templates database indexes
CREATE INDEX idx_templates_name ON templates(name);
CREATE INDEX idx_templates_source ON templates(source);
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_active ON templates(is_active);
CREATE INDEX idx_template_versions_template_id ON template_versions(template_id);
CREATE UNIQUE INDEX idx_templates_active_name ON templates(name) WHERE is_active = 1;
```

### Initial Data and Default Values

**Default Nautobot Settings:**
```python
default_nautobot = {
    'url': '',
    'token': '',
    'timeout': 30,
    'verify_ssl': True
}
```

**Default Git Settings:**
```python
default_git = {
    'repo_url': '',
    'branch': 'main',
    'username': '',
    'token': '',
    'config_path': 'configs/',
    'sync_interval': 15,
    'verify_ssl': True
}
```

**Default Cache Settings:**
```python
default_cache = {
    'enabled': True,
    'ttl_seconds': 600,
    'prefetch_on_startup': True,
    'max_size': 1000,
    'compression': False
}
```

### Database Migration System

The system includes automatic schema migrations:

```python
def _run_migrations(self, cursor):
    """Run database migrations for schema updates"""
    # Check for missing columns and add them
    cursor.execute("PRAGMA table_info(git_settings)")
    columns = [column[1] for column in cursor.fetchall()]
    
    if 'verify_ssl' not in columns:
        cursor.execute('ALTER TABLE git_settings ADD COLUMN verify_ssl BOOLEAN NOT NULL DEFAULT 1')
```

### Database Health Monitoring

```python
def health_check(self) -> Dict[str, Any]:
    """Check database health"""
    return {
        'status': 'healthy',
        'database_path': self.db_path,
        'nautobot_settings_count': nautobot_count,
        'git_settings_count': git_count,
        'database_size': os.path.getsize(self.db_path)
    }
```

## 14. Authentication & Security Details

### JWT-Based Authentication System

#### Token Management
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Secret Key**: Configurable via `SECRET_KEY` environment variable
- **Token Expiry**: 15 minutes default, configurable
- **Storage**: Browser localStorage with automatic cleanup

#### Password Security
```python
# Password hashing using bcrypt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
```

#### Authentication Flow

**1. Login Process:**
```python
@router.post("/auth/login", response_model=LoginResponse)
async def login(user_data: UserLogin):
    # Demo credentials: admin/admin, guest/guest
    if user_data.username == "admin" and user_data.password == "admin":
        access_token = create_access_token(
            data={"sub": user_data.username, "role": "admin"}
        )
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user={"username": "admin", "role": "admin"}
        )
```

**2. Token Validation:**
```python
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, 
                           algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return username
    except jwt.InvalidTokenError:
        raise credentials_exception
```

#### Frontend Authentication Manager

```javascript
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('auth_token');
        this.userInfo = this.getUserInfo();
        this.setupStorageListener();
    }
    
    async apiRequest(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };
        
        // Auto-detect development vs production URLs
        const baseUrl = this.getBaseUrl();
        const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
        
        const response = await fetch(url, { ...options, headers });
        
        if (response.status === 401) {
            this.logout();
            throw new Error('Authentication required');
        }
        
        return response.json();
    }
}
```

#### Security Headers and CORS

**Development Mode:**
- CORS disabled (uses Vite proxy)
- Relative URLs for API calls
- Automatic detection of dev ports (3000, 3001)

**Production Mode:**
- Explicit CORS configuration
- Absolute URLs with proper host detection
- SSL/TLS enforcement for production deployments

#### Session Management

**Cross-Tab Synchronization:**
```javascript
// Sync authentication state across browser tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'auth_token') {
        if (!e.newValue) {
            // Token removed in another tab
            window.location.href = '/production/login.html';
        }
    }
});
```

**Automatic Token Refresh:**
```javascript
// Token refresh mechanism
async refreshToken() {
    try {
        const response = await fetch('/auth/refresh', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const data = await response.json();
        this.setToken(data.access_token);
        return data.access_token;
    } catch (error) {
        this.logout();
        throw error;
    }
}
```

### Security Features

#### Git SSL Configuration
```python
# SSL certificate verification for Git operations
GIT_SSL_VERIFY = True  # Enable/disable SSL verification
GIT_SSL_CA_INFO = '/path/to/ca-cert.pem'  # Custom CA certificate
GIT_SSL_CERT = '/path/to/client-cert.pem'  # Client certificate
```

#### API Security Patterns
- All API endpoints require JWT authentication
- Route-level permission checks
- Input validation using Pydantic models
- SQL injection prevention through parameterized queries
- XSS protection via proper content escaping

#### Environment-Specific Security

**Development:**
```javascript
// Relaxed security for development
const isDevelopment = window.location.port === "3000" || window.location.port === "3001";
if (isDevelopment) {
    // Use relative URLs for Vite proxy
    // Allow self-signed certificates
}
```

**Production:**
```javascript
// Strict security for production
if (window.location.protocol === 'https:') {
    // Enforce HTTPS
    // Validate SSL certificates
    // Use secure cookie settings
}
```

## 15. API Specifications

### REST API Architecture

**Base URL Structure:**
- Development: `http://localhost:8000` (proxied via Vite)
- Production: `https://your-domain:8000`

#### Authentication Endpoints

```yaml
/auth/login:
  POST:
    summary: User authentication
    request_body:
      username: string
      password: string
    responses:
      200:
        access_token: string
        token_type: "bearer"
        user: object

/auth/refresh:
  POST:
    summary: Refresh JWT token
    headers:
      Authorization: "Bearer {token}"
    responses:
      200:
        access_token: string
```

#### Nautobot Integration Endpoints

```yaml
/api/nautobot/test:
  GET:
    summary: Test Nautobot connection
    responses:
      200:
        success: boolean
        message: string
        data: object

/api/nautobot/devices:
  GET:
    summary: Get devices from Nautobot
    parameters:
      limit: integer (optional)
      offset: integer (optional)
      filter_type: string (name|location|prefix)
      filter_value: string
    responses:
      200:
        devices: array
        pagination: object

/api/nautobot/devices/{device_id}:
  GET:
    summary: Get specific device details
    parameters:
      device_id: string
    responses:
      200:
        device: object

/api/nautobot/devices/onboard:
  POST:
    summary: Onboard new device to Nautobot
    request_body:
      ip_address: string
      location_id: string
      namespace_id: string
      role_id: string
      status_id: string
      platform_id: string
      secret_groups_id: string
      interface_status_id: string
      ip_address_status_id: string
      port: integer (default: 22)
      timeout: integer (default: 30)
    responses:
      200:
        success: boolean
        job_id: string
        message: string

/api/nautobot/check-ip:
  POST:
    summary: Check if IP address exists in Nautobot
    request_body:
      ip_address: string
    responses:
      200:
        exists: boolean
        is_available: boolean
        assigned_devices: array

/api/nautobot/locations:
  GET:
    summary: Get all locations with hierarchy
    responses:
      200:
        locations: array

/api/nautobot/namespaces:
  GET:
    summary: Get all namespaces
    responses:
      200:
        namespaces: array

/api/nautobot/platforms:
  GET:
    summary: Get all platforms
    responses:
      200:
        platforms: array

/api/nautobot/roles:
  GET:
    summary: Get all device roles
    responses:
      200:
        roles: array

/api/nautobot/statuses:
  GET:
    summary: Get all status types
    responses:
      200:
        statuses: object
```

#### Git Repository Management

```yaml
/api/git/status:
  GET:
    summary: Get Git repository status
    responses:
      200:
        status: string
        branch: string
        commits_ahead: integer
        commits_behind: integer

/api/git/branches:
  GET:
    summary: Get available Git branches
    responses:
      200:
        branches: array

/api/git/commits/{branch}:
  GET:
    summary: Get commits for specified branch
    parameters:
      branch: string
    responses:
      200:
        commits: array

/api/git/files/{commit_hash}:
  GET:
    summary: Get files in specific commit
    parameters:
      commit_hash: string
    responses:
      200:
        files: array

/api/git/diff:
  POST:
    summary: Compare files between Git commits
    request_body:
      commit1: string
      commit2: string
      file_path: string
    responses:
      200:
        left_file: string
        right_file: string
        left_lines: array
        right_lines: array
        stats: object

/api/git/file-complete-history/{file_path}:
  GET:
    summary: Get complete history of a file
    parameters:
      file_path: string
    responses:
      200:
        commits: array
        file_path: string
```

#### File Comparison Endpoints

```yaml
/api/files/list:
  GET:
    summary: List all configuration files
    responses:
      200:
        files: array

/api/files/compare:
  POST:
    summary: Compare two files
    request_body:
      left_file: string
      right_file: string
    responses:
      200:
        success: boolean
        file1_content: string
        file2_content: string
        diff: string

/api/files/export-diff:
  POST:
    summary: Export file comparison as downloadable file
    request_body:
      left_file: string
      right_file: string
      format: string (unified|side-by-side)
    responses:
      200:
        content-type: application/octet-stream
```

#### Settings Management

```yaml
/api/settings/nautobot:
  GET:
    summary: Get Nautobot settings
    responses:
      200:
        url: string
        timeout: integer
        verify_ssl: boolean
  POST:
    summary: Update Nautobot settings
    request_body:
      url: string
      token: string
      timeout: integer
      verify_ssl: boolean

/api/settings/git:
  GET:
    summary: Get Git settings
  POST:
    summary: Update Git settings

/api/settings/cache:
  GET:
    summary: Get cache settings
  POST:
    summary: Update cache settings
```

#### Network Device Discovery

```yaml
/api/scan-and-add/start:
  POST:
    summary: Start network device scan
    request_body:
      networks: array
      credentials: array
      discovery_mode: string (napalm|ssh-login)
      parser_templates: array
    responses:
      200:
        job_id: string
        total_targets: integer
        state: string

/api/scan-and-add/{job_id}/status:
  GET:
    summary: Get scan job status
    parameters:
      job_id: string
    responses:
      200:
        job_id: string
        state: string
        progress: object
        results: array

/api/scan-and-add/{job_id}/onboard:
  POST:
    summary: Onboard discovered devices
    parameters:
      job_id: string
    request_body:
      devices: array
      git_repository_id: integer (optional)
      inventory_template_id: integer (optional)
      filename: string (optional)
      auto_commit: boolean (optional)
    responses:
      200:
        accepted: integer
        cisco_queued: integer
        linux_added: integer
        job_ids: array
```

#### Template Management

```yaml
/api/templates:
  GET:
    summary: List all templates
    parameters:
      category: string (optional)
      source: string (optional)
      active_only: boolean (default: true)
    responses:
      200:
        templates: array

  POST:
    summary: Create new template
    request_body:
      name: string
      source: string (git|file|webeditor)
      template_type: string (jinja2|text|yaml|json|textfsm)
      content: string (optional)
      git_repo_url: string (optional)
      git_path: string (optional)
    responses:
      201:
        template_id: integer
        message: string

/api/templates/{template_id}:
  GET:
    summary: Get template by ID
    parameters:
      template_id: integer
    responses:
      200:
        template: object

  PUT:
    summary: Update template
    parameters:
      template_id: integer
    request_body:
      name: string (optional)
      content: string (optional)
      description: string (optional)
    responses:
      200:
        message: string

  DELETE:
    summary: Delete template
    parameters:
      template_id: integer
    responses:
      200:
        message: string
```

### GraphQL Integration

**Nautobot GraphQL Queries:**

```graphql
# Device queries with filters
query GetDevices($limit: Int, $offset: Int) {
  devices(limit: $limit, offset: $offset) {
    id
    name
    role { name }
    location { name }
    primary_ip4 { address }
    status { name }
    device_type { model }
    platform { name }
    cf_last_backup
  }
}

# Location hierarchy
query GetLocations {
  locations {
    id
    name
    description
    parent { id name description }
    children { id name description }
  }
}

# Device by name filter
query DevicesByName($name_filter: [String]) {
  devices(name__ire: $name_filter) {
    id
    name
    primary_ip4 { address }
    location { name }
    role { name }
    status { name }
    device_type { model }
    platform { name }
  }
}

# Device by location filter
query DevicesByLocation($location_filter: [String]) {
  locations(name__ire: $location_filter) {
    name
    devices {
      id
      name
      primary_ip4 { address }
      role { name }
      status { name }
      device_type { model }
      platform { name }
    }
  }
}

# IP address availability check
query CheckIPAddress($ip_address: [String]) {
  ip_addresses(address: $ip_address) {
    primary_ip4_for {
      name
    }
  }
}
```

### Error Handling Patterns

```python
# Standardized error responses
class APIException(HTTPException):
    def __init__(self, status_code: int, detail: str, error_code: str = None):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code

# Common error patterns
raise HTTPException(status_code=404, detail="Repository not found")
raise HTTPException(status_code=400, detail="Invalid Git repository configuration")
raise HTTPException(status_code=500, detail="Failed to connect to Nautobot")
raise HTTPException(status_code=401, detail="Authentication required")
```

## 16. Frontend Build Configuration

### Vite Build System

**Configuration File (`vite.config.js`):**

```javascript
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "production",
  
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    target: "es2022",
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-core": ["jquery", "bootstrap", "@popperjs/core"],
          "vendor-charts": ["chart.js", "echarts", "leaflet"],
          "vendor-forms": ["select2", "ion-rangeslider", "autosize", "switchery"],
          "vendor-ui": ["jquery-ui", "nprogress", "datatables.net"],
          "vendor-utils": ["dayjs", "jquery-sparkline", "skycons"]
        },
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split('.').pop();
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
            return `images/[name]-[hash][extname]`;
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name)) {
            return `fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: "js/[name]-[hash].js",
        entryFileNames: "js/[name]-[hash].js",
      },
      input: {
        // Multi-page application entries
        main: "production/index.html",
        compare: "production/compare.html",
        onboard: "production/onboard-device.html",
        scan: "production/scan-and-add.html",
        ansible: "production/ansible-inventory.html",
        settings: "production/settings.html",
        "settings-nautobot": "production/settings-nautobot.html",
        "settings-git": "production/settings-git.html",
        "settings-templates": "production/settings-templates.html",
        "settings-cache": "production/settings-cache.html",
        "settings-credentials": "production/settings-credentials.html",
        login: "production/login.html",
        profile: "production/profile.html"
      }
    }
  },
  
  server: {
    open: "/",
    port: 3000,
    host: process.env.VITE_HOST || "localhost",
    allowedHosts: process.env.VITE_ALLOWED_HOSTS?.split(",") || "auto",
    watch: {
      ignored: [
        "**/data/**",
        "**/backend/**", 
        "**/node_modules/**",
        "**/dist/**",
        "**/docs/**",
        "**/.git/**",
        "**/.venv/**",
        "**/.*"
      ]
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
      "/auth": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  
  optimizeDeps: {
    include: ["jquery", "bootstrap", "@popperjs/core", "dayjs", "nprogress"],
    force: true,
  },
  
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: [
          "color-functions",
          "global-builtin",
          "import", 
          "mixed-decls",
          "color-module-compat",
        ],
      },
    },
  },
  
  esbuild: {
    target: "es2022",
  },
  
  resolve: {
    alias: {
      jquery: "jquery",
    },
  },
  
  define: {
    global: "globalThis",
    "process.env": {},
    "process.env.NODE_ENV": '"production"',
  },
});
```

### Build Scripts and Package Management

**Package.json Scripts:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build", 
    "preview": "vite preview",
    "format": "prettier --write '**/*.{html,js,jsx,ts,tsx,css,scss,json,md,yml,yaml}'",
    "format:check": "prettier --check '**/*.{html,js,jsx,ts,tsx,css,scss,json,md,yml,yaml}'",
    "format:scan": "prettier --write production/scan-and-add.html"
  }
}
```

### Frontend Dependencies

**Core Framework Dependencies:**
```json
{
  "dependencies": {
    "bootstrap": "^5.3.6",
    "jquery": "^3.6.1", 
    "@popperjs/core": "^2.11.8"
  },
  "devDependencies": {
    "vite": "^6.3.5",
    "sass": "^1.89.2",
    "prettier": "^3.3.3"
  }
}
```

**UI Component Libraries:**
```json
{
  "dependencies": {
    "select2": "^4.0.13",
    "datatables.net": "^2.3.2",
    "datatables.net-bs5": "^2.3.2",
    "datatables.net-buttons": "^3.2.3",
    "datatables.net-buttons-bs5": "^3.2.3",
    "datatables.net-responsive": "^3.0.4",
    "datatables.net-responsive-bs5": "^3.0.4",
    "switchery": "^0.0.2",
    "ion-rangeslider": "^2.3.1",
    "@eonasdan/tempus-dominus": "^6.10.4",
    "jquery-ui": "^1.14.1",
    "autosize": "^6.0.1"
  }
}
```

**Charting and Visualization:**
```json
{
  "dependencies": {
    "chart.js": "^4.4.2",
    "echarts": "^5.6.0", 
    "leaflet": "^1.9.4"
  }
}
```

**Utility Libraries:**
```json
{
  "dependencies": {
    "dayjs": "^1.11.13",
    "nprogress": "^0.2.0",
    "cropperjs": "^2.0.0",
    "@simonwep/pickr": "^1.9.1",
    "inputmask": "^5.0.9",
    "jquery-sparkline": "^2.4.0",
    "jquery-knob": "^1.2.11",
    "skycons": "^1.0.0"
  }
}
```

**FontAwesome and Icons:**
```json
{
  "dependencies": {
    "@fortawesome/fontawesome-free": "^6.6.0"
  }
}
```

### SCSS Build Configuration

**Main SCSS Entry Point (`src/main.scss`):**
```scss
// Import Bootstrap and customizations
@import "scss/bootstrap-custom";

// Import component styles
@import "scss/components";
@import "scss/forms";
@import "scss/charts";

// Import vendor styles  
@import "scss/vendor-overrides";
```

**SCSS Processing Options:**
```javascript
css: {
  preprocessorOptions: {
    scss: {
      quietDeps: true,  // Suppress Bootstrap deprecation warnings
      silenceDeprecations: [
        "color-functions",
        "global-builtin",
        "import",
        "mixed-decls", 
        "color-module-compat"
      ]
    }
  }
}
```

### Development vs Production Configuration

**Development Mode Detection:**
```javascript
// Frontend configuration automatically detects environment
const isDevelopment = window.location.port === "3000" || window.location.port === "3001";

if (isDevelopment) {
  // Use relative URLs for Vite proxy
  // Enable debug logging
  // Hot module replacement
} else {
  // Use absolute URLs
  // Minimize logging
  // Production optimizations
}
```

**Environment-Specific Settings:**
```javascript
// Auto-detection of backend URL
const baseUrl = (() => {
  const currentPort = window.location.port;
  const isDevelopment = currentPort === "3000" || currentPort === "3001";
  
  if (isDevelopment) {
    return ""; // Use relative URLs for Vite proxy
  }
  
  // Check for Vite environment indicators
  const hasViteElements = !!(
    document.querySelector('script[type="module"]') ||
    document.querySelector('script[src*="/src/"]')
  );
  
  if (hasViteElements) {
    return ""; // Still in Vite environment
  }
  
  // Production mode
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:8000`;
})();
```

### Asset Management

**Static Asset Handling:**
- Images: `production/images/` → `dist/images/[name]-[hash][ext]`
- Fonts: `production/fonts/` → `dist/fonts/[name]-[hash][ext]`  
- Icons: FontAwesome and custom icons bundled
- Favicons: Multi-resolution favicon support

**Code Splitting Strategy:**
```javascript
manualChunks: {
  "vendor-core": ["jquery", "bootstrap", "@popperjs/core"],
  "vendor-charts": ["chart.js", "echarts", "leaflet"],
  "vendor-forms": ["select2", "ion-rangeslider", "autosize", "switchery"],
  "vendor-ui": ["jquery-ui", "nprogress", "datatables.net"],
  "vendor-utils": ["dayjs", "jquery-sparkline", "skycons"]
}
```

### Multi-Page Application Structure

**Page Entry Points:**
- `index.html` - Main dashboard
- `compare.html` - Configuration comparison
- `onboard-device.html` - Device onboarding
- `scan-and-add.html` - Network discovery
- `ansible-inventory.html` - Ansible inventory management
- `settings*.html` - Settings pages
- `login.html` - Authentication page

**Module Loading Pattern:**
```html
<!-- Each page loads a Vite entry point -->
<script type="module" src="/src/main-minimal.js"></script>

<!-- Configuration loaded per page -->
<script src="js/config.js"></script>

<!-- Container config for production deployments -->
<script>
  // Load container config if in container environment
  const currentPort = window.location.port;
  const isDevelopment = currentPort === "3000" || currentPort === "3001";
  const isNonLocalhost = window.location.hostname !== "localhost" && 
                         window.location.hostname !== "127.0.0.1";
  
  if (isNonLocalhost && !isDevelopment) {
    const script = document.createElement("script");
    script.src = "js/config-container.js";
    document.head.appendChild(script);
  }
</script>
```

### Build Optimization

**Terser Configuration:**
```javascript
terserOptions: {
  compress: {
    drop_console: true,    // Remove console.log in production
    drop_debugger: true,   // Remove debugger statements
  },
}
```

**Chunk Size Management:**
```javascript
chunkSizeWarningLimit: 1000,  // Warn for chunks > 1MB
```

**Tree Shaking:**
- Automatic dead code elimination
- ES module imports for optimal bundling
- Selective Bootstrap component imports

**Development Server Configuration:**
```javascript
server: {
  open: "/",
  port: 3000,
  host: process.env.VITE_HOST || "localhost",
  allowedHosts: process.env.VITE_ALLOWED_HOSTS?.split(",") || "auto",
  watch: {
    ignored: [
      "**/data/**",      // Ignore database files
      "**/backend/**",   // Ignore Python backend
      "**/node_modules/**",
      "**/dist/**",
      "**/docs/**", 
      "**/.git/**",
      "**/.venv/**",
      "**/.*"
    ]
  }
}
```

## 17. Git Integration Specifics

### 17.1 Git Repository Management Architecture

Cockpit implements a sophisticated Git integration system supporting multiple repositories with different purposes and configurations.

#### Repository Categories and Types
```python
class GitCategory(str, Enum):
    """Git repository categories for organizational purposes"""
    CONFIGS = "configs"      # Network device configurations
    TEMPLATES = "templates"  # Jinja2 and configuration templates  
    NETWORK = "network"      # Network topology and documentation
    SECURITY = "security"    # Security policies and configurations
    BACKUPS = "backups"      # Configuration backups and snapshots
    SCRIPTS = "scripts"      # Automation and utility scripts
    DOCUMENTATION = "documentation"  # Project documentation
    OTHER = "other"          # Miscellaneous repositories
```

#### Multi-Repository Database Schema
```sql
CREATE TABLE git_repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,              -- Human-readable repository name
    category TEXT NOT NULL,                 -- Repository category (configs, templates, etc.)
    url TEXT NOT NULL,                      -- Git repository URL (HTTPS/SSH)
    branch TEXT NOT NULL DEFAULT 'main',    -- Default branch to use
    username TEXT,                          -- Git username (legacy)
    token TEXT,                             -- Git token/password (legacy)
    credential_name TEXT,                   -- Reference to stored credential
    path TEXT,                              -- Subdirectory within repository
    verify_ssl BOOLEAN NOT NULL DEFAULT 1,  -- SSL certificate verification
    description TEXT,                       -- Repository description
    is_active BOOLEAN NOT NULL DEFAULT 1,   -- Active/inactive status
    
    -- Timestamps and sync status
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_sync TIMESTAMP,                    -- Last successful sync time
    sync_status TEXT                        -- Current sync status
);
```

### 17.2 Git Operations and API Endpoints

#### Repository Management API
```yaml
# Repository CRUD Operations
GET    /api/git-repositories              # List all repositories with filtering
POST   /api/git-repositories              # Create new repository configuration
GET    /api/git-repositories/{id}         # Get repository details
PUT    /api/git-repositories/{id}         # Update repository configuration  
DELETE /api/git-repositories/{id}         # Delete repository (with cleanup)

# Repository Operations
GET    /api/git-repositories/{id}/status  # Get detailed repository status
POST   /api/git-repositories/{id}/sync    # Sync repository (clone/pull)
GET    /api/git-repositories/{id}/files/search  # Search files in repository
POST   /api/git-repositories/test         # Test repository connection
POST   /api/git-repositories/sync         # Bulk sync multiple repositories

# Repository Health and Monitoring
GET    /api/git-repositories/health       # Health check for Git system
```

#### Repository Status Information
```python
# Comprehensive repository status response
{
    "repository_name": "network-configs",
    "repository_url": "https://github.com/org/network-configs.git",
    "repository_branch": "main", 
    "sync_status": "synced",
    "exists": True,
    "is_git_repo": True,
    "is_synced": True,
    "behind_count": 0,
    "ahead_count": 0,
    "current_commit": "a1b2c3d4",
    "current_branch": "main",
    "last_commit_message": "Update switch configurations",
    "last_commit_date": "2024-01-15T10:30:00Z",
    "last_commit_author": "Network Engineer",
    "last_commit_author_email": "engineer@company.com",
    "branches": ["main", "feature/vlan-updates", "develop"],
    "commits": [
        {
            "hash": "a1b2c3d4e5f6",
            "short_hash": "a1b2c3d4",
            "message": "Update switch configurations",
            "author": "Network Engineer", 
            "date": "2024-01-15T10:30:00Z"
        }
    ],
    "config_files": ["switches/switch01.conf", "routers/router01.conf"],
    "has_configs": True
}
```

### 17.3 Git Synchronization and Clone Operations

#### Intelligent Repository Sync Logic
```python
async def sync_repository(repo_id: int):
    """
    Comprehensive repository synchronization with multiple strategies:
    1. Clone if repository doesn't exist
    2. Pull if repository exists and is valid Git repo
    3. Backup and re-clone if directory exists but isn't Git repo
    4. Handle authentication and SSL configuration
    """
    
    # 1. Validate repository configuration
    repository = git_repo_manager.get_repository(repo_id)
    repo_path = str(git_repo_path(repository))
    
    # 2. Determine operation needed
    repo_dir_exists = os.path.exists(repo_path)
    is_git_repo = os.path.isdir(os.path.join(repo_path, ".git"))
    needs_clone = not is_git_repo
    
    # 3. Handle credentials (legacy vs credential manager)
    resolved_username, resolved_token = resolve_credentials(repository)
    
    # 4. Execute operation with SSL environment
    if needs_clone:
        await clone_repository(repository, repo_path, resolved_username, resolved_token)
    else:
        await pull_repository(repository, repo_path, resolved_username, resolved_token)
```

#### SSL Configuration and Environment Management
```python
@contextmanager
def set_ssl_env(repository: Dict):
    """
    Manage SSL environment variables for Git operations.
    Supports:
    - SSL verification disable for self-signed certificates
    - Custom CA certificate paths
    - Client certificate authentication
    """
    original = {
        "GIT_SSL_NO_VERIFY": os.environ.get("GIT_SSL_NO_VERIFY"),
        "GIT_SSL_CA_INFO": os.environ.get("GIT_SSL_CA_INFO"),
        "GIT_SSL_CERT": os.environ.get("GIT_SSL_CERT"),
    }
    
    try:
        # Apply repository-specific SSL settings
        if not repository.get("verify_ssl", True):
            os.environ["GIT_SSL_NO_VERIFY"] = "1"
            logger.warning("Git SSL verification disabled - not recommended for production")
            
        if repository.get("ssl_ca_info"):
            os.environ["GIT_SSL_CA_INFO"] = str(repository["ssl_ca_info"])
            
        if repository.get("ssl_cert"):
            os.environ["GIT_SSL_CERT"] = str(repository["ssl_cert"])
            
        yield
    finally:
        # Restore original environment
        for key, val in original.items():
            if val is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = val
```

### 17.4 Credential Management Integration

#### Credential Resolution System
```python
def resolve_credentials(repository: Dict) -> Tuple[Optional[str], Optional[str]]:
    """
    Resolve Git credentials from multiple sources:
    1. Credential manager (preferred)
    2. Legacy repository fields
    3. Environment variables
    """
    resolved_username = repository.get("username")
    resolved_token = repository.get("token")
    
    # Use credential manager if configured
    if repository.get("credential_name"):
        try:
            creds = cred_mgr.list_credentials(include_expired=False)
            match = next(
                (c for c in creds if c["name"] == repository["credential_name"] 
                 and c["type"] == "token"), None
            )
            if match:
                resolved_username = match.get("username")
                resolved_token = cred_mgr.get_decrypted_password(match["id"])
        except Exception as e:
            logger.error(f"Credential lookup error: {e}")
    
    return resolved_username, resolved_token
```

#### URL Authentication Injection
```python
def add_auth_to_url(url: str, username: Optional[str], token: Optional[str]) -> str:
    """
    Inject HTTP(S) basic auth credentials into Git URL.
    Only applies to HTTP/HTTPS URLs; SSH URLs remain untouched.
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return url  # SSH or other protocols
            
        if not token:
            return url
            
        # URL-encode credentials for safety
        user_enc = urlquote(str(username or "git"), safe="")
        token_enc = urlquote(str(token), safe="")
        
        # Strip existing userinfo and add ours
        netloc = parsed.netloc
        if "@" in netloc:
            netloc = netloc.split("@", 1)[-1]
            
        netloc = f"{user_enc}:{token_enc}@{netloc}"
        
        return urlunparse((
            parsed.scheme, netloc, parsed.path, 
            parsed.params, parsed.query, parsed.fragment
        ))
    except Exception:
        return url  # Conservative fallback
```

### 17.5 Frontend Git Management Interface

#### Repository Selector and Status Management
```javascript
class GitRepositoryManager {
    constructor() {
        this.repositories = [];
        this.selectedRepository = null;
        this.statusCheckInterval = null;
    }
    
    async loadRepositories() {
        """Load all active repositories and populate selector"""
        try {
            const response = await window.authManager.apiRequest("/api/git-repositories");
            this.repositories = response.repositories || [];
            this.updateRepositorySelector();
        } catch (error) {
            console.error("Failed to load repositories:", error);
        }
    }
    
    async checkRepositoryStatus(repoId) {
        """Get real-time repository status with sync information"""
        try {
            const response = await window.authManager.apiRequest(
                `/api/git-repositories/${repoId}/status`
            );
            return response.data;
        } catch (error) {
            console.error("Failed to get repository status:", error);
            return null;
        }
    }
    
    async syncRepository(repoId) {
        """Trigger repository synchronization with progress feedback"""
        try {
            this.updateSyncStatus("syncing", "Synchronizing repository...");
            
            const response = await window.authManager.apiRequest(
                `/api/git-repositories/${repoId}/sync`,
                { method: "POST" }
            );
            
            if (response.success) {
                this.updateSyncStatus("success", response.message);
                await this.refreshRepositoryStatus();
            } else {
                this.updateSyncStatus("error", response.message);
            }
        } catch (error) {
            this.updateSyncStatus("error", `Sync failed: ${error.message}`);
        }
    }
}
```

#### Auto-Collapsing Status Panel
```javascript
// GitManager automatically manages status panel visibility
async initializeGitStatus() {
    """Initialize Git status checking with auto-collapse behavior"""
    
    const status = await this.checkRepositoryStatus();
    
    if (status && status.repositoryState === "ready") {
        // Repository is configured and synced - auto-collapse status panel
        this.collapseStatusPanel();
        this.focusOnMainFunctionality();
    } else {
        // Repository needs attention - keep status panel visible
        this.expandStatusPanel();
        this.highlateRepositoryIssues(status);
    }
}
```

### 17.6 Git Utilities and Helper Functions

#### Repository Path Management
```python
def git_repo_path(repository: Dict) -> Path:
    """
    Generate consistent repository filesystem path.
    Uses configured 'path' field or falls back to repository name.
    """
    from backend.git_repositories_manager import GitRepositoryManager
    
    git_mgr = GitRepositoryManager()
    base_path = Path(git_mgr.get_base_path())
    
    # Use explicit path if configured, otherwise use repository name
    repo_subpath = repository.get("path") or repository["name"]
    
    return base_path / repo_subpath
```

#### URL Normalization and Validation
```python
def normalize_git_url(url: str) -> str:
    """
    Normalize Git URLs for consistent comparison.
    Handles HTTPS/SSH format differences and trailing slashes.
    """
    if not url:
        return ""
        
    # Remove .git suffix for comparison
    normalized = url.rstrip("/")
    if normalized.endswith(".git"):
        normalized = normalized[:-4]
        
    # Normalize HTTPS vs SSH formats
    if normalized.startswith("git@"):
        # Convert SSH format to HTTPS for comparison
        # git@github.com:user/repo -> https://github.com/user/repo
        ssh_match = re.match(r"git@([^:]+):(.+)", normalized)
        if ssh_match:
            host, path = ssh_match.groups()
            normalized = f"https://{host}/{path}"
            
    return normalized.lower()
```

#### Repository Validation and Health Checks
```python
def validate_repository_remote(repository: Dict) -> Tuple[bool, str]:
    """
    Validate repository remote URL matches configuration.
    Prevents configuration drift and ensures repository consistency.
    """
    try:
        repo_path = git_repo_path(repository)
        if not repo_path.exists():
            return False, "Repository path does not exist"
            
        repo = Repo(repo_path)
        if not repo.remotes:
            return False, "No remote configured"
            
        current_remote = repo.remotes.origin.url
        expected_url = normalize_git_url(repository["url"])
        current_url = normalize_git_url(current_remote)
        
        if current_url != expected_url:
            return False, f"Remote URL mismatch: expected {expected_url}, got {current_url}"
            
        return True, "Repository configuration valid"
        
    except Exception as e:
        return False, f"Validation error: {str(e)}"
```

### 17.7 Error Handling and Recovery

#### Backup and Recovery Mechanisms
```python
def backup_conflicting_directory(repo_path: str) -> str:
    """
    Backup existing directory that conflicts with Git repository.
    Creates timestamped backup before repository operations.
    """
    if not os.path.exists(repo_path):
        return ""
        
    parent_dir = os.path.dirname(repo_path.rstrip(os.sep)) or os.path.dirname(repo_path)
    base_name = os.path.basename(os.path.normpath(repo_path))
    backup_path = os.path.join(parent_dir, f"{base_name}_backup_{int(time.time())}")
    
    try:
        shutil.move(repo_path, backup_path)
        logger.info(f"Backed up existing directory to {backup_path}")
        return backup_path
    except Exception as e:
        logger.error(f"Failed to backup directory: {e}")
        return ""
```

#### Connection Testing and Validation
```python
async def test_git_connection(test_request: GitConnectionTestRequest) -> GitConnectionTestResponse:
    """
    Test Git repository connectivity without full clone.
    Uses shallow clone for fast validation.
    """
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            test_path = Path(temp_dir) / "test_repo"
            
            # Prepare environment with SSL settings
            env = os.environ.copy()
            if not test_request.verify_ssl:
                env["GIT_SSL_NO_VERIFY"] = "1"
                
            # Shallow clone for speed
            cmd = [
                "git", "clone", "--depth", "1", "--branch", test_request.branch,
                clone_url, str(test_path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, 
                                  env=env, timeout=30)
            
            if result.returncode == 0:
                return GitConnectionTestResponse(
                    success=True,
                    message="Git connection successful",
                    details={"branch": test_request.branch, "url": test_request.url}
                )
            else:
                return GitConnectionTestResponse(
                    success=False,
                    message=f"Connection failed: {result.stderr}",
                    details={"error": result.stderr}
                )
                
    except Exception as e:
        return GitConnectionTestResponse(
            success=False,
            message=f"Test failed: {str(e)}"
        )
```

## 18. Template System Specifications

### 18.1 Template Management Architecture

Cockpit implements a comprehensive template management system supporting multiple template sources, types, and rendering engines with full version control.

#### Template Source Types and Storage Strategy
```python
class TemplateSource(str, Enum):
    """Template sources with different storage and sync mechanisms"""
    GIT = "git"              # Templates stored in Git repositories
    FILE = "file"            # Templates uploaded through web interface
    WEBEDITOR = "webeditor"  # Templates created in browser editor

class TemplateType(str, Enum):
    """Supported template types with different rendering engines"""
    JINJA2 = "jinja2"        # Jinja2 templates with full templating features
    TEXT = "text"            # Plain text with simple variable substitution
    YAML = "yaml"            # YAML-formatted configuration templates
    JSON = "json"            # JSON-formatted data templates
    TEXTFSM = "textfsm"      # TextFSM parsing templates for network output
```

#### Complete Template Database Schema
```sql
CREATE TABLE templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                     -- Template name (unique when active)
    source TEXT NOT NULL CHECK(source IN ('git', 'file', 'webeditor')),
    template_type TEXT NOT NULL DEFAULT 'jinja2' CHECK(template_type IN ('jinja2', 'text', 'yaml', 'json', 'textfsm')),
    category TEXT,                          -- Logical grouping (Network, Security, etc.)
    description TEXT,                       -- Template description and usage notes
    
    -- Git-specific fields for Git-sourced templates
    git_repo_url TEXT,                      -- Git repository URL
    git_branch TEXT DEFAULT 'main',         -- Git branch to use
    git_username TEXT,                      -- Git authentication username
    git_token TEXT,                         -- Git authentication token
    git_path TEXT,                          -- Path within repository
    git_verify_ssl BOOLEAN DEFAULT 1,       -- SSL verification for Git operations
    
    -- File/WebEditor-specific fields
    content TEXT,                           -- Template content (for file/webeditor)
    filename TEXT,                          -- Original filename
    content_hash TEXT,                      -- SHA256 hash for change detection
    
    -- Template metadata and variables
    variables TEXT DEFAULT '{}',            -- JSON string of template variables
    tags TEXT DEFAULT '[]',                 -- JSON array of tags
    
    -- Status and synchronization
    is_active BOOLEAN DEFAULT 1,            -- Active/inactive status
    last_sync TIMESTAMP,                    -- Last sync time (for Git templates)
    sync_status TEXT,                       -- Sync status (synced, error, pending)
    
    -- Audit timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Template version history for complete audit trail
CREATE TABLE template_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,                        -- User who made the change
    change_notes TEXT,                      -- Description of changes
    FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE CASCADE
);
```

### 18.2 Template API Endpoints and Operations

#### Comprehensive Template Management API
```yaml
# Template CRUD Operations
GET    /api/templates                      # List templates with filtering
POST   /api/templates                      # Create new template
GET    /api/templates/{id}                 # Get template details
PUT    /api/templates/{id}                 # Update template
DELETE /api/templates/{id}                 # Delete template (soft/hard delete)
GET    /api/templates/name/{name}          # Get template by name

# Template Content Operations  
GET    /api/templates/{id}/content         # Get template content
POST   /api/templates/{id}/render          # Render template with variables
GET    /api/templates/{id}/versions        # Get template version history

# Template Management Operations
POST   /api/templates/upload               # Upload template file
POST   /api/templates/sync                 # Sync Git templates
POST   /api/templates/import               # Bulk import templates
POST   /api/templates/git/test             # Test Git template connection

# Template Search and Discovery
GET    /api/templates/search               # Search templates by content/metadata
GET    /api/templates/categories           # Get available categories
GET    /api/templates/variables/{id}       # Get template variable definitions
```

#### Template Creation and Management
```python
class TemplateManager:
    """Comprehensive template management with multi-source support"""
    
    def create_template(self, template_data: Dict[str, Any]) -> Optional[int]:
        """
        Create new template with source-specific handling:
        1. Validate template data and check for duplicates
        2. Process content based on source type
        3. Create version history entry
        4. Save to filesystem if needed
        """
        
        # Validate required fields
        if not template_data.get('name'):
            raise ValueError("Template name is required")
            
        # Check for duplicate active templates
        existing = self.get_template_by_name(template_data['name'])
        if existing:
            raise ValueError(f"Template '{template_data['name']}' already exists")
            
        # Process content and create hash
        content = template_data.get('content', '')
        content_hash = hashlib.sha256(content.encode()).hexdigest() if content else None
        
        # Insert template with full metadata
        template_id = self._insert_template_record(template_data, content_hash)
        
        # Create initial version entry
        if content and template_id:
            self._create_template_version(template_id, content, content_hash, "Initial version")
            
        # Save to filesystem for file/webeditor templates
        if template_data.get('source') in ['file', 'webeditor'] and content:
            self._save_template_to_file(template_id, template_data['name'], content)
            
        return template_id
```

### 18.3 Template Rendering Engine with Jinja2

#### Advanced Template Rendering System
```python
def render_template(self, template_name: str, category: str, data: Dict[str, Any]) -> str:
    """
    Render template using Jinja2 with comprehensive error handling.
    Supports complex templating with filters, macros, and inheritance.
    """
    try:
        from jinja2 import Template, Environment, BaseLoader, select_autoescape
        
        # Find template by name and category
        template = self.get_template_by_name(template_name)
        if not template:
            # Search by category if name not found
            templates = self.list_templates(category=category if category else None)
            matching_templates = [t for t in templates if t['name'] == template_name]
            if not matching_templates:
                raise ValueError(f"Template '{template_name}' not found in category '{category}'")
            template = matching_templates[0]
            
        # Get template content
        content = self.get_template_content(template['id'])
        if not content:
            raise ValueError(f"Template content not found for '{template_name}'")
            
        # Create Jinja2 environment with security features
        env = Environment(
            loader=BaseLoader(),
            autoescape=select_autoescape(['html', 'xml']),
            trim_blocks=True,
            lstrip_blocks=True
        )
        
        # Add custom filters for network automation
        env.filters.update({
            'ipv4': self._filter_ipv4,
            'subnet': self._filter_subnet, 
            'vlan_range': self._filter_vlan_range,
            'interface_short': self._filter_interface_short
        })
        
        # Render template with provided data
        jinja_template = env.from_string(content)
        rendered = jinja_template.render(**data)
        
        logger.info(f"Successfully rendered template '{template_name}' from category '{category}'")
        return rendered
        
    except Exception as e:
        logger.error(f"Error rendering template '{template_name}': {e}")
        raise e
```

#### Template Variable Management
```python
def get_template_variables(self, template_id: int) -> Dict[str, Any]:
    """
    Extract and analyze template variables from Jinja2 template.
    Returns variable definitions with types and default values.
    """
    try:
        from jinja2 import Environment, meta
        
        content = self.get_template_content(template_id)
        if not content:
            return {}
            
        # Parse template to extract variables
        env = Environment()
        ast = env.parse(content)
        variables = meta.find_undeclared_variables(ast)
        
        # Get stored variable definitions
        template = self.get_template(template_id)
        stored_vars = template.get('variables', {}) if template else {}
        
        # Combine discovered and stored variables
        result = {}
        for var in variables:
            result[var] = stored_vars.get(var, {
                'type': 'string',
                'required': True,
                'description': f'Variable {var}',
                'default': None
            })
            
        return result
        
    except Exception as e:
        logger.error(f"Error analyzing template variables: {e}")
        return {}
```

### 18.4 File System Storage and Content Management

#### Organized Template File Storage
```python
def _save_template_to_file(self, template_id: int, name: str, content: str, filename: str = None) -> None:
    """
    Save template content to organized filesystem storage.
    Supports multiple file extensions and organized directory structure.
    """
    try:
        # Create safe filename
        safe_name = name.replace(' ', '_').replace('/', '_')
        
        # Determine file extension based on template type and filename
        if filename and '.' in filename:
            ext = os.path.splitext(filename)[1]
        else:
            ext = '.j2'  # Default to Jinja2 extension
            
        # Create full filename with template ID prefix
        full_filename = f"{template_id}_{safe_name}{ext}"
        filepath = os.path.join(self.storage_path, full_filename)
        
        # Ensure storage directory exists
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Write content to file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
        logger.debug(f"Template content saved to: {filepath}")
        
    except Exception as e:
        logger.error(f"Error saving template to file: {e}")
        raise
```

#### Content Loading with Fallback Strategy
```python
def get_template_content(self, template_id: int) -> Optional[str]:
    """
    Get template content with intelligent fallback strategy:
    1. Try database content (for webeditor/file templates)
    2. Try filesystem content (for file templates)
    3. Try Git content (for Git templates)
    """
    try:
        template = self.get_template(template_id)
        if not template:
            return None
            
        # For Git templates, implement Git content fetching
        if template['source'] == 'git':
            return self._fetch_git_template_content(template)
            
        # For file/webeditor templates, try database first
        content = template.get('content')
        if content:
            return content
            
        # Fallback to filesystem
        if template['source'] in ['file', 'webeditor']:
            return self._load_template_from_file(
                template_id, template['name'], template.get('filename')
            )
            
        return None
        
    except Exception as e:
        logger.error(f"Error getting template content for {template_id}: {e}")
        return None
```

### 18.5 Template Search and Filtering System

#### Advanced Template Search
```python
def search_templates(self, query: str, search_content: bool = False) -> List[Dict[str, Any]]:
    """
    Advanced template search with content indexing.
    Supports name, description, category, and full-text content search.
    """
    try:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            search_pattern = f"%{query}%"
            
            if search_content:
                # Include content search (slower but comprehensive)
                cursor.execute('''
                    SELECT * FROM templates 
                    WHERE is_active = 1 AND (
                        name LIKE ? OR 
                        description LIKE ? OR 
                        category LIKE ? OR
                        content LIKE ?
                    )
                    ORDER BY 
                        CASE 
                            WHEN name LIKE ? THEN 1
                            WHEN description LIKE ? THEN 2  
                            WHEN category LIKE ? THEN 3
                            ELSE 4 
                        END,
                        name
                ''', (search_pattern, search_pattern, search_pattern, search_pattern,
                     search_pattern, search_pattern, search_pattern))
            else:
                # Metadata-only search (faster)
                cursor.execute('''
                    SELECT * FROM templates 
                    WHERE is_active = 1 AND (
                        name LIKE ? OR 
                        description LIKE ? OR 
                        category LIKE ?
                    )
                    ORDER BY name
                ''', (search_pattern, search_pattern, search_pattern))
                
            rows = cursor.fetchall()
            return [self._row_to_dict(row) for row in rows]
            
    except Exception as e:
        logger.error(f"Error searching templates: {e}")
        return []
```

#### Template Categories and Organization
```python
def get_template_categories(self) -> List[Dict[str, Any]]:
    """
    Get all template categories with counts and descriptions.
    Supports dynamic category management.
    """
    try:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT 
                    category,
                    COUNT(*) as template_count,
                    GROUP_CONCAT(DISTINCT source) as sources,
                    MAX(updated_at) as last_updated
                FROM templates 
                WHERE is_active = 1 AND category IS NOT NULL
                GROUP BY category
                ORDER BY category
            ''')
            
            categories = []
            for row in cursor.fetchall():
                categories.append({
                    'name': row[0],
                    'template_count': row[1],
                    'sources': row[2].split(',') if row[2] else [],
                    'last_updated': row[3]
                })
                
            return categories
            
    except Exception as e:
        logger.error(f"Error getting template categories: {e}")
        return []
```

### 18.6 Template Version Control and History

#### Complete Version Tracking
```python
def _create_template_version(self, template_id: int, content: str, content_hash: str, notes: str = "") -> None:
    """
    Create comprehensive version entry with change tracking.
    Maintains complete audit trail of template modifications.
    """
    try:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Get next version number
            cursor.execute(
                'SELECT COALESCE(MAX(version_number), 0) + 1 FROM template_versions WHERE template_id = ?', 
                (template_id,)
            )
            version_number = cursor.fetchone()[0]
            
            # Insert version record
            cursor.execute('''
                INSERT INTO template_versions 
                (template_id, version_number, content, content_hash, created_by, change_notes)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (template_id, version_number, content, content_hash, "system", notes))
            
            conn.commit()
            logger.debug(f"Created version {version_number} for template {template_id}")
            
    except Exception as e:
        logger.error(f"Error creating template version: {e}")
        raise
```

#### Version History and Rollback
```python
def get_template_versions(self, template_id: int) -> List[Dict[str, Any]]:
    """
    Get complete version history for a template.
    Includes metadata and change tracking.
    """
    try:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT 
                    tv.*,
                    t.name as template_name
                FROM template_versions tv
                JOIN templates t ON tv.template_id = t.id
                WHERE tv.template_id = ?
                ORDER BY tv.version_number DESC
            ''', (template_id,))
            
            versions = []
            for row in cursor.fetchall():
                version = dict(row)
                # Add content size and change statistics
                version['content_size'] = len(version['content']) if version['content'] else 0
                versions.append(version)
                
            return versions
            
    except Exception as e:
        logger.error(f"Error getting template versions: {e}")
        return []
```

### 18.7 Template Integration Points

#### Ansible Inventory Generation
```python
async def generate_inventory_from_template(
    devices: List[Device], 
    template_id: int, 
    output_format: str = "yaml"
) -> str:
    """
    Generate Ansible inventory using template with device data.
    Supports multiple output formats and complex device hierarchies.
    """
    try:
        # Prepare device data for template rendering
        device_data = {
            'all_devices': [device.to_dict() for device in devices],
            'devices_by_location': self._group_devices_by_location(devices),
            'devices_by_role': self._group_devices_by_role(devices),
            'total_devices': len(devices),
            'generated_at': datetime.now().isoformat()
        }
        
        # Render template with device data
        template_content = template_manager.get_template_content(template_id)
        if not template_content:
            raise ValueError(f"Template {template_id} content not found")
            
        env = Environment(loader=BaseLoader())
        template = env.from_string(template_content)
        rendered_inventory = template.render(**device_data)
        
        # Post-process based on output format
        if output_format == "yaml":
            # Validate YAML syntax
            import yaml
            yaml.safe_load(rendered_inventory)
        elif output_format == "ini":
            # Validate INI format
            import configparser
            config = configparser.ConfigParser()
            config.read_string(rendered_inventory)
            
        return rendered_inventory
        
    except Exception as e:
        logger.error(f"Error generating inventory from template: {e}")
        raise
```

#### Device Configuration Generation
```python
def generate_device_config(self, device: Device, template_id: int) -> str:
    """
    Generate device-specific configuration using template.
    Includes device variables, interface data, and network context.
    """
    try:
        # Gather device context data
        device_context = {
            'device': device.to_dict(),
            'interfaces': [iface.to_dict() for iface in device.interfaces],
            'ip_addresses': [ip.to_dict() for ip in device.ip_addresses],
            'location': device.location.to_dict() if device.location else {},
            'role': device.role.to_dict() if device.role else {},
            'platform': device.platform.to_dict() if device.platform else {},
            'config_context': device.get_config_context(),
            'custom_fields': device.custom_fields
        }
        
        # Render configuration template
        return template_manager.render_template_by_id(template_id, device_context)
        
    except Exception as e:
        logger.error(f"Error generating device config: {e}")
        raise
```

### 18.8 Template Performance and Optimization

#### Content Caching and Performance
```python
class TemplateContentCache:
    """In-memory cache for frequently accessed template content"""
    
    def __init__(self, max_size: int = 100, ttl_seconds: int = 300):
        self.cache = {}
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        
    def get(self, template_id: int) -> Optional[str]:
        """Get cached template content if available and fresh"""
        if template_id in self.cache:
            content, timestamp = self.cache[template_id]
            if time.time() - timestamp < self.ttl_seconds:
                return content
            else:
                del self.cache[template_id]
        return None
        
    def set(self, template_id: int, content: str) -> None:
        """Cache template content with LRU eviction"""
        if len(self.cache) >= self.max_size:
            # Remove oldest entry
            oldest_key = min(self.cache.keys(), 
                           key=lambda k: self.cache[k][1])
            del self.cache[oldest_key]
            
        self.cache[template_id] = (content, time.time())
```

#### Batch Template Operations
```python
def bulk_import_templates(self, template_files: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Bulk import multiple templates with transaction safety.
    Supports rollback on partial failures.
    """
    try:
        imported = []
        failed = []
        
        with sqlite3.connect(self.db_path) as conn:
            for template_file in template_files:
                try:
                    template_id = self.create_template(template_file)
                    imported.append({
                        'name': template_file['name'],
                        'id': template_id,
                        'status': 'success'
                    })
                except Exception as e:
                    failed.append({
                        'name': template_file.get('name', 'unknown'),
                        'error': str(e),
                        'status': 'failed'
                    })
                    
        return {
            'imported_count': len(imported),
            'failed_count': len(failed),
            'imported': imported,
            'failed': failed
        }
        
    except Exception as e:
        logger.error(f"Error during bulk template import: {e}")
        raise

## 19. Device Discovery & Onboarding Rules

### 19.1 Network Discovery Architecture

Cockpit implements a comprehensive network discovery and onboarding system with two primary modes and sophisticated device detection capabilities.

#### Discovery Modes and Detection Strategy
```python
class DiscoveryMode(str, Enum):
    """Discovery modes with different authentication and detection strategies"""
    NAPALM = "napalm"        # Full device detection using NAPALM drivers + Paramiko
    SSH_LOGIN = "ssh-login"  # Command-based detection using SSH with 'show version' and 'uname -a'

class DeviceType(str, Enum):
    """Supported device types with specific detection logic"""
    CISCO = "cisco"          # Cisco network devices (IOS, NXOS, IOSXR)
    LINUX = "linux"          # Linux servers and systems
    UNKNOWN = "unknown"      # Devices that don't match detection criteria
```

#### Network Scanning Configuration
```python
# Network Discovery Specifications
JOB_TTL_SECONDS = 24 * 3600          # 24-hour job retention
PING_TIMEOUT_SECONDS = 1.5           # 1500ms ping timeout per spec
SSH_LOGIN_TIMEOUT = 5                # 5-second SSH timeout
MAX_CONCURRENCY = 10                 # Maximum concurrent device scans
RETRY_ATTEMPTS = 3                   # 3 retry attempts per device
MINIMUM_CIDR_PREFIX = 22             # Minimum /22 (max ~1024 hosts) for safety
```

### 19.2 Device Discovery Workflow and Validation

#### Network Scanning Request Validation
```python
class ScanStartRequest(BaseModel):
    """Network discovery request with comprehensive validation"""
    cidrs: List[str] = Field(..., max_items=10, description="List of CIDR networks to scan")
    credential_ids: List[int] = Field(..., description="List of credential IDs to try")
    discovery_mode: str = Field(default="napalm", description="Discovery mode: napalm or ssh-login")
    parser_template_ids: Optional[List[int]] = Field(default=None, description="Template IDs for TextFSM parsing")

    @validator("discovery_mode")
    def validate_discovery_mode(cls, v: str):
        """Ensure valid discovery mode"""
        if v not in ["napalm", "ssh-login"]:
            raise ValueError("discovery_mode must be 'napalm' or 'ssh-login'")
        return v

    @validator("cidrs")
    def validate_cidrs(cls, v: List[str]):
        """Validate CIDR networks with safety constraints"""
        if not v:
            raise ValueError("At least one CIDR required")

        cleaned = []
        seen = set()

        for cidr in v:
            try:
                network = ipaddress.ip_network(cidr, strict=False)
            except Exception:
                raise ValueError(f"Invalid CIDR format: {cidr}")

            # Enforce /22 minimum (max ~1024 hosts per spec)
            if network.prefixlen < 22:
                raise ValueError(f"CIDR too large (minimum /22): {cidr}")

            # Deduplicate networks
            if cidr not in seen:
                seen.add(cidr)
                cleaned.append(cidr)

        return cleaned
```

#### Discovery Job Management
```python
@dataclass
class ScanJob:
    """Complete scan job state tracking"""
    job_id: str
    created: float
    cidrs: List[str]
    credential_ids: List[int]
    discovery_mode: str
    total_targets: int
    
    # Progress counters
    scanned: int = 0
    alive: int = 0                    # Devices responding to ping
    authenticated: int = 0            # Successful authentication
    unreachable: int = 0             # Failed ping or connection
    auth_failed: int = 0             # Authentication failures
    driver_not_supported: int = 0    # Platform detection failures
    
    state: str = "running"           # running|finished
    results: List[ScanResult] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
```

### 19.3 Platform Detection and Device Classification

#### Cisco Device Detection (NAPALM Mode)
```python
async def _try_cisco_devices(self, ip: str, username: str, password: str) -> Optional[Dict[str, str]]:
    """
    Try Cisco device detection using NAPALM drivers in priority order.
    Driver precedence: ios -> nxos_ssh -> iosxr
    """
    drivers = ["ios", "nxos_ssh", "iosxr"]

    for driver_name in drivers:
        try:
            result = await asyncio.to_thread(
                self._napalm_connect_get_facts, driver_name, ip, username, password
            )
            if result:
                return {
                    "device_type": "cisco",
                    "hostname": result.get("hostname"),
                    "platform": result.get("platform")
                }
        except Exception as e:
            logger.debug(f"NAPALM {driver_name} failed for {ip}: {e}")
            continue

    return None

def _napalm_connect_get_facts(self, driver_name: str, ip: str, username: str, password: str) -> Optional[Dict[str, str]]:
    """Connect to device using NAPALM driver and retrieve device facts"""
    try:
        driver_class = get_network_driver(driver_name)
        device = driver_class(
            hostname=ip,
            username=username,
            password=password,
            optional_args={"timeout": SSH_LOGIN_TIMEOUT}
        )

        device.open()
        try:
            facts = device.get_facts()
            return {
                "hostname": facts.get("hostname", ip),
                "platform": driver_name
            }
        finally:
            device.close()

    except Exception as e:
        logger.debug(f"NAPALM {driver_name} connection failed for {ip}: {e}")
        return None
```

#### SSH-Based Device Detection
```python
async def _try_basic_ssh_login(self, ip: str, username: str, password: str, parser_templates: List[Tuple[int, str]]) -> Optional[Dict[str, str]]:
    """
    Basic SSH login test with command-based device detection.
    
    Detection Strategy:
    1. Try 'show version' command → Cisco device detection
    2. Try 'hostname' + 'uname -a' → Linux server detection
    3. Use TextFSM templates for enhanced parsing if available
    """
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        await asyncio.to_thread(
            client.connect,
            hostname=ip,
            username=username,
            password=password,
            timeout=SSH_LOGIN_TIMEOUT,
            banner_timeout=SSH_LOGIN_TIMEOUT,
            auth_timeout=SSH_LOGIN_TIMEOUT,
            look_for_keys=False,
            allow_agent=False
        )

        # Step 1: Try 'show version' command for Cisco detection
        try:
            logger.info(f"Trying 'show version' command on {ip}")
            stdin, stdout, stderr = client.exec_command("show version", timeout=10)
            stdout_data = stdout.read().decode().strip()
            stderr_data = stderr.read().decode().strip()

            # Cisco device detection criteria
            if stdout_data and len(stdout_data) > 50 and not stderr_data:
                logger.info(f"'show version' succeeded on {ip}, detected as Cisco device")
                
                hostname = None
                platform = "cisco-unknown"
                
                # Enhanced parsing with TextFSM templates
                if parser_templates and textfsm is not None:
                    hostname, platform = self._parse_with_textfsm(stdout_data, parser_templates)
                
                # Fallback hostname extraction
                if not hostname:
                    hostname = self._extract_hostname_from_show_version(stdout_data)

                client.close()
                return {
                    "device_type": "cisco",
                    "hostname": hostname,
                    "platform": platform
                }

        except Exception as e:
            logger.info(f"'show version' failed on {ip}: {e}")

        # Step 2: Try Linux commands ('hostname' and 'uname -a')
        hostname = None
        platform = None
        
        try:
            # Try hostname command
            logger.info(f"Executing 'hostname' command on {ip}")
            stdin, stdout, stderr = client.exec_command("hostname", timeout=5)
            exit_status = stdout.channel.recv_exit_status()
            hostname_output = stdout.read().decode('utf-8', errors='ignore').strip()
            
            if hostname_output and exit_status == 0:
                hostname = hostname_output
                logger.info(f"Hostname command succeeded on {ip}: {hostname}")
                
        except Exception as e:
            logger.info(f"Hostname command exception on {ip}: {e}")

        try:
            # Try uname -a command
            logger.info(f"Executing 'uname -a' command on {ip}")
            stdin, stdout, stderr = client.exec_command("uname -a", timeout=5)
            exit_status = stdout.channel.recv_exit_status()
            uname_output = stdout.read().decode('utf-8', errors='ignore').strip()
            
            if uname_output and exit_status == 0:
                platform = uname_output
                logger.info(f"uname -a command succeeded on {ip}: {platform}")
                
        except Exception as e:
            logger.info(f"uname -a command exception on {ip}: {e}")

        # Linux device detection
        if hostname:
            logger.info(f"Detected Linux device on {ip} - hostname: {hostname}, platform: {platform or 'unknown'}")
            client.close()
            return {
                "device_type": "linux",
                "hostname": hostname,
                "platform": platform or "linux-unknown"
            }

        client.close()
        return None

    except Exception as e:
        logger.error(f"SSH connection failed for {ip}: {e}")
        return None
```

#### TextFSM Template Integration
```python
def _parse_with_textfsm(self, output: str, parser_templates: List[Tuple[int, str]]) -> Tuple[Optional[str], str]:
    """
    Parse device output using TextFSM templates for enhanced data extraction.
    Returns (hostname, platform) tuple.
    """
    hostname = None
    platform = "cisco-unknown"
    
    for template_id, template_content in parser_templates:
        try:
            fsm = textfsm.TextFSM(io.StringIO(template_content))
            rows = fsm.ParseText(output)
            
            # Build records from headers
            for row in rows:
                record = {header.lower(): row[i] for i, header in enumerate(fsm.header)}
                
                # Extract hostname from various fields
                hostname_candidates = record.get('hostname') or record.get('host') or record.get('device')
                if hostname_candidates and len(hostname_candidates.strip()) > 0:
                    hostname = hostname_candidates.strip()
                    
                # Extract platform information
                platform_info = record.get('platform') or record.get('version') or record.get('os')
                if platform_info and len(platform_info.strip()) > 0:
                    platform = platform_info.strip()
                    
                if hostname:
                    break
                    
            if hostname:
                break
                
        except Exception as e:
            logger.debug(f"TextFSM parse failed for template {template_id}: {e}")
            
    return hostname, platform
```

### 19.4 Device Onboarding Validation Rules

#### Single Device Onboarding (onboard-device.html)
```python
class DeviceOnboardRequest(BaseModel):
    """Single device onboarding with comprehensive validation"""
    ip_address: str                    # Primary IP address (supports comma-separated list)
    location_id: str                   # Required: Location UUID from Nautobot
    namespace_id: str                  # Required: Namespace UUID
    role_id: str                       # Required: Device role UUID
    status_id: str                     # Required: Device status UUID
    platform_id: str                  # Platform UUID or "detect" for auto-detection
    secret_groups_id: str              # Required: Secret group UUID for credentials
    interface_status_id: str           # Required: Default interface status
    ip_address_status_id: str          # Required: Default IP address status
    port: int = 22                     # SSH management port
    timeout: int = 30                  # Connection timeout in seconds
```

#### IP Address Validation and Duplication Check
```javascript
class OnboardDevice {
    async checkIPInNautobot() {
        """
        Validate IP address availability in Nautobot before onboarding.
        Prevents duplicate IP assignments and validates device existence.
        """
        
        if (!this.validateIPAddress()) {
            this.showError("Please enter valid IP address(es) first.");
            return;
        }

        const ipInput = document.getElementById("ip_address").value.trim();
        const ipAddresses = ipInput.split(",").map(ip => ip.trim()).filter(ip => ip.length > 0);
        const firstIP = ipAddresses[0];

        try {
            const requestBody = { ip_address: firstIP };
            const data = await window.authManager.apiRequest("/api/nautobot/check-ip", {
                method: "POST",
                body: JSON.stringify(requestBody),
            });

            if (data.exists) {
                if (data.is_assigned_to_device && data.assigned_devices?.length > 0) {
                    const deviceNames = data.assigned_devices.map(device => device.name).join(", ");
                    this.showSuccess(
                        `✅ IP address '${firstIP}' found in Nautobot and assigned to device(s): ${deviceNames}`
                    );
                } else {
                    this.showWarning(
                        `⚠️ IP address '${firstIP}' found in Nautobot but not assigned to any device.`
                    );
                }
            } else {
                this.showInfo(
                    `ℹ️ IP address '${firstIP}' not found in Nautobot. Ready for onboarding.`
                );
            }
        } catch (error) {
            this.showError(`❌ Network error checking IP address: ${error.message}`);
        }
    }

    validateIPAddress() {
        """
        Client-side IP address validation supporting comma-separated lists.
        Validates IPv4 format and provides real-time feedback.
        """
        const ipInput = document.getElementById("ip_address");
        const ipValue = ipInput.value.trim();
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

        if (!ipValue) {
            ipInput.classList.remove("is-valid", "is-invalid");
            return false;
        }

        // Support comma-separated IP addresses
        const ipAddresses = ipValue.split(",").map(ip => ip.trim()).filter(ip => ip.length > 0);
        
        if (ipAddresses.length === 0) {
            ipInput.classList.add("is-invalid");
            return false;
        }

        // Validate each IP address
        const allValid = ipAddresses.every(ip => ipRegex.test(ip));
        
        if (allValid) {
            ipInput.classList.remove("is-invalid");
            ipInput.classList.add("is-valid");
            return true;
        } else {
            ipInput.classList.add("is-invalid");
            return false;
        }
    }
}
```

#### Device Search and Conflict Prevention
```javascript
async searchDeviceInNautobot() {
    """
    Search for existing devices by name to prevent naming conflicts.
    Provides comprehensive device information for decision making.
    """
    const deviceName = searchInput.value.trim();
    
    if (!deviceName) {
        this.showError("Please enter a device name to search.");
        return;
    }

    try {
        const requestUrl = `/api/nautobot/devices?filter_type=name&filter_value=${deviceName}&limit=10`;
        const data = await window.authManager.apiRequest(requestUrl);

        if (data.devices && data.devices.length > 0) {
            // Found existing devices - display comprehensive information
            const deviceList = data.devices.map(device => {
                const location = device.location ? ` (${device.location.name})` : "";
                const role = device.role ? ` [${device.role.name}]` : "";
                const ip = device.primary_ip4 ? ` - ${device.primary_ip4.address}` : "";
                const status = device.status ? ` (${device.status.name})` : "";
                return `<strong>${device.name}</strong>${role}${location}${ip}${status}`;
            });

            if (data.devices.length === 1) {
                this.showSuccess(`✅ Device found in Nautobot: ${deviceList[0]}`);
            } else {
                const deviceListHtml = deviceList.map(device => 
                    `<li style="margin-bottom: 8px;">${device}</li>`
                ).join("");
                this.showSuccess(
                    `✅ Found ${data.devices.length} device(s) matching "${deviceName}":<ul style="margin: 10px 0; padding-left: 20px; list-style-type: disc;">${deviceListHtml}</ul>`
                );
            }
        } else {
            this.showInfo(
                `ℹ️ No devices found in Nautobot with name containing "${deviceName}". This name is available for onboarding.`
            );
        }
    } catch (error) {
        this.showError(`❌ Error searching for device: ${error.message}`);
    }
}
```

### 19.5 Bulk Device Onboarding (Scan & Add)

#### Device Classification and Onboarding Strategy
```python
async def onboard_devices(job_id: str, request: OnboardRequest):
    """
    Bulk device onboarding with device-type-specific strategies.
    
    Onboarding Rules:
    1. Cisco devices → Individual Nautobot API calls via onboarding job
    2. Linux devices → Ansible inventory generation with Git integration
    3. Validation against scan results for security
    """
    
    # Verify job exists and validate devices against scan results
    job = await scan_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Scan job not found")

    result_ips = {result.ip for result in job.results}
    valid_devices = [device for device in request.devices if device.ip in result_ips]

    if not valid_devices:
        raise HTTPException(status_code=400, detail="No valid devices selected for onboarding")

    # Separate devices by type for different onboarding strategies
    cisco_devices = [d for d in valid_devices if d.device_type == "cisco"]
    linux_devices = [d for d in valid_devices if d.device_type == "linux"]

    cisco_queued = 0
    linux_added = 0
    inventory_path = None
    job_ids = []

    # Handle Cisco device onboarding via Nautobot
    if cisco_devices:
        try:
            cisco_queued, cisco_job_ids = await _onboard_cisco_devices(cisco_devices)
            job_ids.extend(cisco_job_ids)
        except Exception as e:
            logger.error(f"Cisco onboarding failed: {e}")

    # Handle Linux device inventory creation
    if linux_devices:
        try:
            linux_added, inventory_path = await _create_linux_inventory(
                linux_devices,
                job_id,
                git_repository_id=request.git_repository_id,
                inventory_template_id=request.inventory_template_id,
                filename=request.filename,
                auto_commit=request.auto_commit,
                auto_push=request.auto_push,
                commit_message=request.commit_message
            )
        except Exception as e:
            logger.error(f"Linux inventory creation failed: {e}")

    return OnboardResponse(
        accepted=len(valid_devices),
        cisco_queued=cisco_queued,
        linux_added=linux_added,
        inventory_path=inventory_path,
        job_ids=job_ids
    )
```

#### Cisco Device Onboarding Rules
```python
async def _onboard_cisco_devices(cisco_devices: List[OnboardDevice]) -> tuple[int, List[str]]:
    """
    Onboard Cisco devices via Nautobot onboarding API.
    Each device gets individual onboarding job for proper tracking.
    """
    job_ids = []
    queued_count = 0

    for device in cisco_devices:
        try:
            # Prepare device data with comprehensive metadata
            device_data = {
                "ip_address": device.ip,
                "hostname": device.hostname or device.ip,  # Fallback to IP if no hostname
                "platform": device.platform or "cisco_ios",  # Default platform
                "location": device.location,
                "namespace": device.namespace or "Global",
                "role": device.role or "network",
                "status": device.status or "Active",
                "interface_status": device.interface_status or "Active",
                "ip_status": device.ip_status or "Active"
            }

            # Call Nautobot onboarding API
            response = await nautobot_service.onboard_device(device_data)

            if response.get("job_id"):
                job_ids.append(response["job_id"])
                queued_count += 1
                logger.info(f"Cisco device {device.ip} queued for onboarding with job {response['job_id']}")
            else:
                logger.warning(f"Cisco device {device.ip} onboarding returned no job ID")

        except Exception as e:
            logger.error(f"Failed to onboard Cisco device {device.ip}: {e}")
            continue

    return queued_count, job_ids
```

#### Linux Device Inventory Generation
```python
async def _create_linux_inventory(
    linux_devices: List[OnboardDevice],
    job_id: str,
    *,
    git_repository_id: Optional[int] = None,
    inventory_template_id: Optional[int] = None,
    filename: Optional[str] = None,
    auto_commit: bool = False,
    auto_push: bool = False,
    commit_message: Optional[str] = None,
) -> tuple[int, str]:
    """
    Create Ansible inventory for Linux devices using templates and Git integration.
    
    Features:
    1. Template-based inventory generation using Jinja2
    2. Git repository integration for version control
    3. Automatic commit and push capabilities
    4. Structured device data for complex inventories
    """
    
    # Build devices data for template rendering
    devices_list = []
    for device in linux_devices:
        # Normalize platform (avoid passing 'detect' to templates)
        platform_val = device.platform or "linux"
        if isinstance(platform_val, str) and platform_val.lower() in ("detect", "auto", "auto-detect"):
            platform_val = "linux"

        device_data = {
            "primary_ip4": device.ip,
            "name": device.hostname or device.ip,
            "credential_id": device.credential_id,
            "platform": platform_val,
            "location": device.location,
            "role": device.role or "server",
            "status": device.status or "Active",
        }
        devices_list.append(device_data)

    # Template rendering context
    template_context = {
        "all_devices": devices_list,
        "devices_by_location": self._group_by_field(devices_list, "location"),
        "devices_by_role": self._group_by_field(devices_list, "role"),
        "total_devices": len(devices_list),
        "job_id": job_id,
        "generated_at": datetime.now().isoformat(),
        "generated_by": "Cockpit Scan & Add"
    }

    # Render inventory using template
    if inventory_template_id:
        rendered_content = template_manager.render_template_by_id(
            inventory_template_id, template_context
        )
    else:
        # Use default template
        rendered_content = self._render_default_inventory_template(template_context)

    # Generate filename with timestamp if not provided
    if not filename:
        timestamp = datetime.now().strftime("%Y-%m-%d-%H.%M.%S")
        filename = f"inventory.pending.{timestamp}"

    # Save to Git repository if specified
    if git_repository_id:
        written_path = await self._save_to_git_repository(
            git_repository_id, filename, rendered_content,
            auto_commit, auto_push, commit_message or f"Add Linux inventory from scan job {job_id}"
        )
    else:
        # Save to local storage
        written_path = await self._save_to_local_storage(filename, rendered_content)

    logger.info(f"Created Linux inventory with {len(devices_list)} devices at {written_path}")
    return len(devices_list), written_path
```

### 19.6 Platform Detection and Auto-Detection Rules

#### Platform Detection Logic
```python
def handle_platform_detection(platform_id: str) -> Optional[str]:
    """
    Handle platform detection with special 'detect' keyword.
    
    Rules:
    1. platform_id="detect" → Convert to null for Nautobot auto-detection
    2. Regular platform UUIDs → Pass through unchanged
    3. Invalid platforms → Raise validation error
    """
    
    if platform_id == "detect":
        # Special case: let Nautobot auto-detect platform
        logger.info("Platform auto-detection requested - passing null to Nautobot")
        return None
    elif platform_id and len(platform_id.strip()) > 0:
        # Regular platform ID - pass through
        return platform_id
    else:
        # Empty or invalid platform
        raise ValueError("Platform ID is required or use 'detect' for auto-detection")
```

#### Frontend Platform Selection Rules
```javascript
// Force auto-detect platform for scan-and-add onboarding
const platform_id = "detect";  // Always use auto-detection for scanned devices

// Single device onboarding supports manual platform selection
const platform_id = document.getElementById("platform").value;  // User choice or "detect"
```

### 19.7 Onboarding Progress Tracking and Job Management

#### Job Status Tracking
```python
class OnboardResponse(BaseModel):
    """Comprehensive onboarding response with tracking information"""
    accepted: int                           # Total devices accepted for onboarding
    cisco_queued: int                       # Cisco devices queued in Nautobot jobs
    linux_added: int                        # Linux devices added to inventory
    inventory_path: Optional[str] = None    # Path to generated inventory file
    job_ids: List[str] = Field(default_factory=list)  # Nautobot job IDs for tracking
```

#### Frontend Onboarding Feedback
```javascript
async function onboardSelectedDevices() {
    """
    Handle bulk device onboarding with comprehensive progress feedback.
    Separates Cisco and Linux devices for different onboarding strategies.
    """
    
    // Separate devices by type
    const ciscoIps = selectedIps.filter(ip => {
        const metadata = deviceMetadata[ip];
        return metadata?.device_type?.toLowerCase() === "cisco";
    });
    const otherIps = selectedIps.filter(ip => !ciscoIps.includes(ip));

    let summaryMessages = [];

    // Handle Cisco devices individually
    if (ciscoIps.length > 0) {
        let ciscoSuccess = 0;
        let ciscoFailed = 0;
        
        for (const ip of ciscoIps) {
            try {
                const payload = this.buildCiscoOnboardPayload(ip);
                await window.authManager.apiRequest("/api/nautobot/devices/onboard", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                ciscoSuccess++;
            } catch (error) {
                console.error("Cisco onboard failed for", ip, error);
                ciscoFailed++;
            }
        }
        summaryMessages.push(`Cisco onboarded: ${ciscoSuccess}, failed: ${ciscoFailed}`);
    }

    // Handle Linux devices via batch onboarding
    if (otherIps.length > 0) {
        try {
            const batchPayload = this.buildLinuxBatchPayload(otherIps);
            const response = await window.authManager.apiRequest(
                `/api/scan/${scanJob.job_id}/onboard`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(batchPayload),
                }
            );
            
            summaryMessages.push(
                `Linux/Other: ${response.linux_added} added to inventory` +
                (response.inventory_path ? ` (${response.inventory_path})` : "")
            );
        } catch (error) {
            summaryMessages.push(`Linux/Other batch failed: ${error.message}`);
        }
    }

    // Display comprehensive summary
    this.showSuccess("Onboarding completed: " + summaryMessages.join("; "));
}
```

### 19.8 Error Handling and Validation Rules

#### Network Discovery Error Classifications
```python
class ScanProgress(BaseModel):
    """Detailed scan progress with error classification"""
    total: int                      # Total target devices
    scanned: int                    # Devices attempted
    alive: int                      # Devices responding to ping
    authenticated: int              # Successful authentication
    unreachable: int               # Network unreachable or timeout
    auth_failed: int               # Authentication failures
    driver_not_supported: int      # Platform detection failures
```

#### Validation Error Handling
```python
def validate_onboard_request(request: DeviceOnboardRequest) -> None:
    """
    Comprehensive validation for device onboarding requests.
    
    Validation Rules:
    1. All UUIDs must be valid format
    2. IP addresses must be valid IPv4
    3. Port numbers must be in valid range (1-65535)
    4. Timeout values must be reasonable (1-300 seconds)
    """
    
    # IP address validation
    try:
        ipaddress.IPv4Address(request.ip_address.split(',')[0].strip())
    except ipaddress.AddressValueError:
        raise ValueError(f"Invalid IP address format: {request.ip_address}")
    
    # Port validation
    if not (1 <= request.port <= 65535):
        raise ValueError(f"Port must be between 1 and 65535, got: {request.port}")
    
    # Timeout validation
    if not (1 <= request.timeout <= 300):
        raise ValueError(f"Timeout must be between 1 and 300 seconds, got: {request.timeout}")
    
    # UUID format validation for required fields
    required_uuid_fields = [
        'location_id', 'namespace_id', 'role_id', 'status_id',
        'secret_groups_id', 'interface_status_id', 'ip_address_status_id'
    ]
    
    for field_name in required_uuid_fields:
        field_value = getattr(request, field_name)
        if field_value and field_value != "detect":
            try:
                uuid.UUID(field_value)
            except ValueError:
                raise ValueError(f"Invalid UUID format for {field_name}: {field_value}")
```

### 19.9 Security and Access Control Rules

#### Credential Validation and Security
```python
def validate_scan_credentials(credential_ids: List[int]) -> List[int]:
    """
    Validate and filter credentials for network scanning.
    
    Security Rules:
    1. Only active, non-expired credentials allowed
    2. User must have access to specified credentials
    3. At least one valid credential required
    """
    
    if not credential_ids:
        raise ValueError("At least one credential required for network scanning")
    
    valid_credentials = []
    available_creds = list_credentials(include_expired=False)
    available_ids = {cred['id'] for cred in available_creds}
    
    for cred_id in credential_ids:
        if cred_id in available_ids:
            valid_credentials.append(cred_id)
        else:
            logger.warning(f"Credential ID {cred_id} not found or expired")
    
    if not valid_credentials:
        raise ValueError("No valid credentials available for scanning")
    
    return valid_credentials
```

#### Network Scanning Safety Rules
```python
def enforce_network_safety_limits(cidrs: List[str]) -> None:
    """
    Enforce safety limits to prevent network overload.
    
    Safety Rules:
    1. Maximum 10 CIDR networks per scan
    2. Minimum /22 prefix (max ~1024 hosts per network)
    3. Total target limit enforcement
    4. Private network scanning preference
    """
    
    if len(cidrs) > 10:
        raise ValueError("Maximum 10 CIDR networks allowed per scan")
    
    total_targets = 0
    for cidr in cidrs:
        network = ipaddress.ip_network(cidr, strict=False)
        
        if network.prefixlen < 22:
            raise ValueError(f"Network too large (minimum /22): {cidr}")
        
        total_targets += network.num_hosts
        
        # Warn about public IP scanning
        if not network.is_private:
            logger.warning(f"Scanning public network: {cidr}")
    
    if total_targets > 10000:
        raise ValueError(f"Total target count too high: {total_targets} (max 10,000)")
```
  }
}
```

## 20. Comparison Engine Details

The comparison engine is the core functionality of Cockpit, providing sophisticated configuration comparison across three distinct modes: Files, Git Commits, and File History. This system implements advanced diff algorithms, side-by-side visualization, and comprehensive navigation capabilities.

### 20.1 Multi-Modal Comparison Architecture

**Three Comparison Modes:**
```javascript
// Mode switching implementation
const comparisonModes = {
  files: {
    name: 'File Comparison',
    endpoint: '/api/files/compare',
    supports: ['side-by-side', 'unified', 'export'],
    features: ['file_search', 'regex_filtering', 'history_tracking']
  },
  git: {
    name: 'Git Commits',
    endpoint: '/api/git/diff',
    supports: ['commit_selection', 'branch_switching', 'file_filtering'],
    features: ['commit_navigation', 'timeline_view', 'branch_comparison']
  },
  history: {
    name: 'File History',
    endpoint: '/api/git/file-complete-history',
    supports: ['chronological_comparison', 'commit_selection', 'timeline_view'],
    features: ['multi_commit_selection', 'history_timeline', 'change_tracking']
  }
};
```

**Mode Architecture:**
- **File Mode:** Direct filesystem comparison with real-time search
- **Git Mode:** Commit-to-commit comparison with branch support
- **History Mode:** Chronological file evolution with timeline visualization

### 20.2 Diff Algorithm Implementation

**Backend Diff Processing (difflib integration):**
```python
# Core diff algorithm using Python difflib
import difflib

def compare_files_detailed(file1_content, file2_content):
    """Generate line-by-line comparison using SequenceMatcher."""
    left_lines = []
    right_lines = []
    
    file1_lines = file1_content.splitlines() if file1_content else []
    file2_lines = file2_content.splitlines() if file2_content else []
    
    matcher = difflib.SequenceMatcher(None, file1_lines, file2_lines)
    left_line_num = 1
    right_line_num = 1
    
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            # Identical lines
            for i in range(i1, i2):
                left_lines.append({
                    "line_number": left_line_num,
                    "content": file1_lines[i],
                    "type": "equal"
                })
                right_lines.append({
                    "line_number": right_line_num,
                    "content": file2_lines[j1 + (i - i1)],
                    "type": "equal"
                })
                left_line_num += 1
                right_line_num += 1
                
        elif tag == 'delete':
            # Lines only in left file (deleted)
            for i in range(i1, i2):
                left_lines.append({
                    "line_number": left_line_num,
                    "content": file1_lines[i],
                    "type": "delete"
                })
                right_lines.append({
                    "line_number": None,
                    "content": "",
                    "type": "empty"
                })
                left_line_num += 1
                
        elif tag == 'insert':
            # Lines only in right file (added)
            for j in range(j1, j2):
                left_lines.append({
                    "line_number": None,
                    "content": "",
                    "type": "empty"
                })
                right_lines.append({
                    "line_number": right_line_num,
                    "content": file2_lines[j],
                    "type": "insert"
                })
                right_line_num += 1
                
        elif tag == 'replace':
            # Lines are different (modified)
            max_lines = max(i2 - i1, j2 - j1)
            for k in range(max_lines):
                if k < (i2 - i1):
                    left_lines.append({
                        "line_number": left_line_num,
                        "content": file1_lines[i1 + k],
                        "type": "delete" if k >= (j2 - j1) else "replace"
                    })
                    left_line_num += 1
                else:
                    left_lines.append({
                        "line_number": None,
                        "content": "",
                        "type": "empty"
                    })
                    
                if k < (j2 - j1):
                    right_lines.append({
                        "line_number": right_line_num,
                        "content": file2_lines[j1 + k],
                        "type": "insert" if k >= (i2 - i1) else "replace"
                    })
                    right_line_num += 1
                else:
                    right_lines.append({
                        "line_number": None,
                        "content": "",
                        "type": "empty"
                    })
    
    return {
        "left_lines": left_lines,
        "right_lines": right_lines,
        "diff_stats": calculate_diff_stats(left_lines, right_lines)
    }
```

**Unified Diff Generation:**
```python
def generate_unified_diff(file1_content, file2_content, fromfile, tofile):
    """Generate unified diff format for export."""
    diff = difflib.unified_diff(
        file1_content.splitlines(keepends=True),
        file2_content.splitlines(keepends=True),
        fromfile=fromfile,
        tofile=tofile
    )
    return "".join(diff)
```

### 20.3 Frontend Diff Rendering Engine

**Side-by-Side Rendering (compare.html):**
```javascript
class ConfigCompare {
  renderDiff(diffData) {
    const container = document.getElementById("diffContent");
    container.innerHTML = "";
    this.currentDiffs = [];
    
    const maxLines = Math.max(
      diffData.left_lines.length,
      diffData.right_lines.length
    );
    
    for (let i = 0; i < maxLines; i++) {
      const leftLine = diffData.left_lines[i] || {
        line_number: null,
        content: "",
        type: "empty"
      };
      const rightLine = diffData.right_lines[i] || {
        line_number: null,
        content: "",
        type: "empty"
      };
      
      const row = document.createElement("div");
      row.className = "diff-row";
      
      // Left side
      const leftDiv = document.createElement("div");
      leftDiv.className = `diff-line ${this.getDiffClass(leftLine.type)}`;
      leftDiv.innerHTML = this.formatLine(
        leftLine.line_number,
        leftLine.content,
        leftLine.type,
        "left"
      );
      
      // Right side
      const rightDiv = document.createElement("div");
      rightDiv.className = `diff-line ${this.getDiffClass(rightLine.type)}`;
      rightDiv.innerHTML = this.formatLine(
        rightLine.line_number,
        rightLine.content,
        rightLine.type,
        "right"
      );
      
      row.appendChild(leftDiv);
      row.appendChild(rightDiv);
      container.appendChild(row);
      
      // Track for navigation and export
      const diffType = this.getDiffType(leftLine.type, rightLine.type);
      this.currentDiffs.push({
        element: row,
        type: diffType,
        left: leftLine.content || "",
        right: rightLine.content || "",
        leftLineNumber: leftLine.line_number,
        rightLineNumber: rightLine.line_number,
        index: this.currentDiffs.length
      });
    }
    
    this.setupSyncScrolling();
    this.updateNavigationButtons();
  }
  
  getDiffClass(type) {
    switch (type) {
      case "insert": return "diff-added";
      case "delete": return "diff-removed"; 
      case "replace": return "diff-modified";
      case "equal": return "diff-unchanged";
      default: return "diff-unchanged";
    }
  }
  
  formatLine(lineNumber, content, type, side) {
    const lineNumSpan = `<span class="diff-line-number">${lineNumber || ""}</span>`;
    const contentSpan = `<span class="diff-line-content">${this.escapeHtml(content || "")}</span>`;
    return lineNumSpan + contentSpan;
  }
}
```

**Diff Visualization CSS:**
```css
.diff-container {
  border: 1px solid #e6e9ed;
  border-radius: 5px;
  overflow: hidden;
  height: calc(100vh - 80px);
}

.diff-header {
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid #e6e9ed;
}

.diff-column {
  flex: 1;
  padding: 4px 10px;
  border-right: 1px solid #e6e9ed;
}

.diff-content {
  height: calc(100vh - 120px);
  overflow-y: auto;
  position: relative;
}

.diff-row {
  display: flex;
  font-family: "Courier New", monospace;
  font-size: var(--diff-font-size, 12px);
  line-height: var(--diff-line-height, 1.1);
  border-bottom: 1px solid #f1f3f4;
}

.diff-line {
  flex: 1;
  padding: 1px 6px;
  white-space: pre;
  border-right: 1px solid #f1f3f4;
  position: relative;
}

/* Diff Colors */
.diff-added {
  background-color: #d4edda;
  border-left: 3px solid #28a745;
}

.diff-removed {
  background-color: #f8d7da;
  border-left: 3px solid #dc3545;
}

.diff-modified {
  background-color: #e2e3e5;
  border-left: 3px solid #6c757d;
}

.diff-unchanged {
  background-color: #ffffff;
}

.diff-line-number {
  display: inline-block;
  width: 40px;
  color: #6c757d;
  text-align: right;
  margin-right: 6px;
  user-select: none;
  font-size: calc(var(--diff-font-size, 12px) - 1px);
}
```

### 20.4 Advanced Navigation System

**Diff Navigation Implementation:**
```javascript
class DiffNavigator {
  navigateDiff(direction) {
    const changedDiffs = this.currentDiffs.filter(
      diff => diff.type !== "unchanged"
    );
    
    if (changedDiffs.length === 0) return;
    
    this.currentDiffIndex += direction;
    
    if (this.currentDiffIndex < 0) {
      this.currentDiffIndex = changedDiffs.length - 1;
    } else if (this.currentDiffIndex >= changedDiffs.length) {
      this.currentDiffIndex = 0;
    }
    
    // Scroll to current diff
    const diff = changedDiffs[this.currentDiffIndex];
    diff.element.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    
    // Highlight current diff temporarily
    diff.element.style.outline = "2px solid #007bff";
    setTimeout(() => {
      diff.element.style.outline = "";
    }, 2000);
    
    this.updateNavigationButtons();
  }
  
  updateNavigationButtons() {
    const prevBtn = document.getElementById("prevDiffBtn");
    const nextBtn = document.getElementById("nextDiffBtn");
    const changedDiffs = this.currentDiffs.filter(
      diff => diff.type !== "unchanged"
    );
    
    if (changedDiffs.length === 0) {
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }
    
    prevBtn.disabled = false;
    nextBtn.disabled = false;
    
    // Update button text with current position
    const currentPos = this.currentDiffIndex + 1;
    const totalChanges = changedDiffs.length;
    prevBtn.innerHTML = `<i class="fas fa-chevron-up"></i> Previous (${currentPos}/${totalChanges})`;
    nextBtn.innerHTML = `<i class="fas fa-chevron-down"></i> Next (${currentPos}/${totalChanges})`;
  }
  
  toggleUnchanged() {
    this.hideUnchanged = !this.hideUnchanged;
    const toggleBtn = document.getElementById("toggleUnchangedBtn");
    const unchangedLines = document.querySelectorAll(".diff-unchanged");
    
    if (this.hideUnchanged) {
      unchangedLines.forEach(line => 
        line.parentElement.classList.add("diff-hidden")
      );
      toggleBtn.innerHTML = '<i class="fas fa-eye"></i> Show Unchanged';
    } else {
      unchangedLines.forEach(line => 
        line.parentElement.classList.remove("diff-hidden")
      );
      toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Unchanged';
    }
  }
}
```

### 20.5 File Search and Selection System

**Multi-Modal File Search:**
```javascript
class FileSearchManager {
  // File mode search
  async searchFiles(query, side) {
    try {
      const result = await window.authManager.apiRequest(
        `/api/files/search?query=${encodeURIComponent(query)}`
      );
      
      if (result.success && result.data) {
        const formattedFiles = result.data.map(fileInfo => ({
          path: fileInfo.path,
          name: fileInfo.name,
          directory: fileInfo.directory || "",
          size: fileInfo.size || 0
        }));
        this.displaySearchResults(formattedFiles, query, side);
      }
    } catch (error) {
      this.showSearchError(`Error searching files: ${error.message}`, side);
    }
  }
  
  // Git file search
  async searchGitFiles(query) {
    try {
      if (!this.selectedRepository) {
        this.showGitSearchError("Please select a repository first.");
        return;
      }
      
      const result = await window.authManager.apiRequest(
        `/api/git-repositories/${this.selectedRepository.id}/files/search?query=${encodeURIComponent(query)}`
      );
      
      if (result.success && result.data && result.data.files) {
        const formattedFiles = result.data.files
          .filter(fileInfo => !fileInfo.path.startsWith("repo_"))
          .map(fileInfo => ({
            path: fileInfo.path,
            name: fileInfo.name,
            directory: fileInfo.directory || ""
          }));
        this.displayGitSearchResults(formattedFiles, query);
      }
    } catch (error) {
      this.showGitSearchError(`Error searching Git files: ${error.message}`);
    }
  }
  
  // History file search  
  async searchHistoryFiles(query) {
    try {
      if (!this.selectedRepository) {
        this.showHistorySearchError("Please select a repository first.");
        return;
      }
      
      const result = await window.authManager.apiRequest(
        `/api/git-repositories/${this.selectedRepository.id}/files/search?query=${encodeURIComponent(query)}`
      );
      
      if (result.success && result.data && result.data.files) {
        const formattedFiles = result.data.files
          .filter(fileInfo => !fileInfo.path.startsWith("repo_"))
          .map(fileInfo => ({
            path: fileInfo.path,
            name: fileInfo.name,
            directory: fileInfo.directory || ""
          }));
        this.displayHistorySearchResults(formattedFiles, query);
      }
    } catch (error) {
      this.showHistorySearchError(`Error searching history files: ${error.message}`);
    }
  }
  
  // Unified search result display with highlighting
  displaySearchResults(files, query, side) {
    const resultsDiv = document.getElementById(`${side}FileResults`);
    const listGroup = resultsDiv.querySelector(".list-group");
    
    if (files.length === 0) {
      listGroup.innerHTML = `
        <div class="list-group-item text-muted">
          <i class="fas fa-search"></i> No files found matching "${query}"
        </div>
      `;
    } else {
      listGroup.innerHTML = "";
      files.forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "list-group-item list-group-item-action";
        item.dataset.index = index;
        item.dataset.filePath = file.path;
        
        item.innerHTML = `
          <div class="file-item-name">${this.highlightMatch(file.name, query)}</div>
          <div class="file-item-path">
            ${file.directory ? `<span class="file-item-directory">${file.directory}/</span>` : ""}
            ${this.highlightMatch(file.path, query)}
          </div>
        `;
        
        item.addEventListener("click", () => {
          this.selectFile(side, file);
        });
        
        listGroup.appendChild(item);
      });
    }
    
    resultsDiv.style.display = "block";
  }
  
  highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    return text.replace(regex, "<mark>$1</mark>");
  }
  
  // Keyboard navigation for search results
  handleKeyboardNavigation(side, e) {
    const resultsDiv = document.getElementById(`${side}FileResults`);
    const items = resultsDiv.querySelectorAll(".list-group-item-action");
    
    if (items.length === 0) return;
    
    let currentIndex = -1;
    const activeItem = resultsDiv.querySelector(".list-group-item.active");
    if (activeItem) {
      currentIndex = parseInt(activeItem.dataset.index);
    }
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        currentIndex = Math.min(currentIndex + 1, items.length - 1);
        this.highlightResultItem(resultsDiv, currentIndex);
        break;
        
      case "ArrowUp":
        e.preventDefault();
        currentIndex = Math.max(currentIndex - 1, 0);
        this.highlightResultItem(resultsDiv, currentIndex);
        break;
        
      case "Enter":
        e.preventDefault();
        if (currentIndex >= 0 && items[currentIndex]) {
          items[currentIndex].click();
        }
        break;
        
      case "Escape":
        this.hideSearchResults(side);
        break;
    }
  }
}
```

### 20.6 Export and Unified Diff Generation

**Frontend Unified Diff Generation:**
```javascript
class DiffExporter {
  generateUnifiedDiff(leftFileName, rightFileName) {
    if (!this.currentDiffs || this.currentDiffs.length === 0) {
      return "";
    }
    
    const timestamp = new Date().toISOString();
    let unifiedDiff = `--- ${leftFileName}\t${timestamp}\n`;
    unifiedDiff += `+++ ${rightFileName}\t${timestamp}\n`;
    
    let leftLineNum = 1;
    let rightLineNum = 1;
    let hunkStart = null;
    let hunkLines = [];
    
    for (let i = 0; i < this.currentDiffs.length; i++) {
      const diff = this.currentDiffs[i];
      
      if (diff.type === "unchanged") {
        // If we have a hunk in progress, output it
        if (hunkStart !== null) {
          unifiedDiff += this.formatHunk(
            hunkStart,
            hunkLines,
            leftLineNum,
            rightLineNum
          );
          hunkStart = null;
          hunkLines = [];
        }
        leftLineNum++;
        rightLineNum++;
      } else {
        // Start a new hunk if needed
        if (hunkStart === null) {
          hunkStart = { left: leftLineNum, right: rightLineNum };
          
          // Add context lines before the change
          const contextBefore = Math.max(0, i - 3);
          for (let j = contextBefore; j < i; j++) {
            if (this.currentDiffs[j] && this.currentDiffs[j].type === "unchanged") {
              hunkLines.push(` ${this.currentDiffs[j].left || this.currentDiffs[j].right || ""}`);
            }
          }
        }
        
        // Add the changed line
        if (diff.type === "removed") {
          hunkLines.push(`-${diff.left || ""}`);
          leftLineNum++;
        } else if (diff.type === "added") {
          hunkLines.push(`+${diff.right || ""}`);
          rightLineNum++;
        } else if (diff.type === "modified") {
          hunkLines.push(`-${diff.left || ""}`);
          hunkLines.push(`+${diff.right || ""}`);
          leftLineNum++;
          rightLineNum++;
        }
      }
    }
    
    // Output any remaining hunk
    if (hunkStart !== null) {
      unifiedDiff += this.formatHunk(
        hunkStart,
        hunkLines,
        leftLineNum,
        rightLineNum
      );
    }
    
    return unifiedDiff;
  }
  
  formatHunk(hunkStart, hunkLines, endLeftLine, endRightLine) {
    const leftCount = endLeftLine - hunkStart.left;
    const rightCount = endRightLine - hunkStart.right;
    
    let hunk = `@@ -${hunkStart.left},${leftCount} +${hunkStart.right},${rightCount} @@\n`;
    hunk += hunkLines.join("\n") + "\n";
    
    return hunk;
  }
  
  async exportDiff() {
    try {
      const leftFileName = document.getElementById("leftFileName").textContent;
      const rightFileName = document.getElementById("rightFileName").textContent;
      
      const mode = document.querySelector('input[name="comparisonMode"]:checked').value;
      
      if (mode === "files") {
        // Use backend export for file mode
        const response = await window.authManager.apiRequest("/api/files/export-diff", {
          method: "POST",
          body: JSON.stringify({
            left_file: this.selectedLeftFile?.path,
            right_file: this.selectedRightFile?.path,
            format: "unified"
          })
        });
        
        this.downloadDiff(response, `diff_${leftFileName}_${rightFileName}.txt`);
      } else {
        // Use frontend generation for Git modes
        const unifiedDiff = this.generateUnifiedDiff(leftFileName, rightFileName);
        
        if (unifiedDiff) {
          const blob = new Blob([unifiedDiff], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `diff_${leftFileName}_${rightFileName}.txt`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      this.showError("Export failed: " + error.message);
    }
  }
}
```

### 20.7 Git History Timeline Integration

**File History Timeline Display:**
```javascript
class HistoryTimelineManager {
  async showFileHistory() {
    const selectedCommit = document.getElementById("historyCommitSelect").value;
    const selectedFile = this.selectedHistoryFile;
    
    if (!selectedCommit || !selectedFile) {
      this.showError("Please select both a commit and a file to view history");
      return;
    }
    
    try {
      const historyData = await window.authManager.apiRequest(
        `/api/git/file-complete-history/${encodeURIComponent(selectedFile.path)}?from_commit=${selectedCommit}`
      );
      
      this.displayHistoryTimeline(historyData, selectedFile.path);
    } catch (error) {
      this.showError("Error loading file history: " + error.message);
    }
  }
  
  displayHistoryTimeline(historyData, fileName) {
    const historyContent = document.getElementById("historyContent");
    
    if (!historyData.commits || historyData.commits.length === 0) {
      historyContent.innerHTML = `
        <div class="text-center text-muted">
          <i class="fas fa-history fa-3x mb-3"></i>
          <h5>No History Found</h5>
          <p>No commit history found for this file.</p>
        </div>
      `;
      return;
    }
    
    // Display file name
    document.getElementById("historyFileName").textContent = fileName;
    
    let timelineHtml = '<div class="timeline">';
    
    historyData.commits.forEach((commit, index) => {
      const commitDate = new Date(commit.date);
      const timeAgo = this.getTimeAgo(commitDate);
      const isSelected = commit.is_selected_commit;
      
      let changeColor = "secondary";
      let changeIcon = "fas fa-edit";
      
      switch (commit.change_type) {
        case "A":
          changeColor = "success";
          changeIcon = "fas fa-plus";
          break;
        case "M":
          changeColor = "warning";
          changeIcon = "fas fa-edit";
          break;
        case "D":
          changeColor = "danger";
          changeIcon = "fas fa-trash";
          break;
        case "N":
          changeColor = "info";
          changeIcon = "fas fa-info-circle";
          break;
      }
      
      timelineHtml += `
        <div class="timeline-item ${isSelected ? "timeline-selected" : ""}" 
             data-commit-hash="${commit.hash}" 
             data-commit-short="${commit.short_hash}"
             onclick="configCompare.toggleHistoryRowSelection('${commit.hash}', event)">
          <div class="timeline-marker bg-${changeColor}">
            <i class="${changeIcon}"></i>
          </div>
          <div class="timeline-content">
            <div class="timeline-main-content">
              <div class="timeline-commit-info">
                <code>${commit.short_hash}</code>
                ${isSelected ? '<br><span class="badge bg-info" style="font-size: 0.6rem;">Selected</span>' : ""}
              </div>
              <div class="timeline-author-info">
                <strong>${typeof commit.author === "object" ? commit.author.name : commit.author}</strong>
              </div>
              <div class="timeline-message-info" title="${commit.message}">
                ${commit.message}
                ${commit.change_type === "N" ? '<div class="mt-1"><small class="text-muted"><i class="fas fa-info-circle"></i> No changes to this file</small></div>' : ""}
              </div>
              <div class="timeline-time-info">
                <small class="text-muted">
                  <i class="fas fa-clock"></i> ${timeAgo}
                </small>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    timelineHtml += '</div>';
    historyContent.innerHTML = timelineHtml;
    
    // Update display
    document.getElementById("fileHistoryDisplay").style.display = "block";
    this.updateHistoryCompareButtons();
  }
  
  toggleHistoryRowSelection(commitHash, event) {
    event.stopPropagation();
    
    const element = event.currentTarget;
    const shortHash = element.dataset.commitShort;
    
    // Check if already selected
    const existingIndex = this.selectedHistoryRows.findIndex(
      row => row.hash === commitHash
    );
    
    if (existingIndex !== -1) {
      // Deselect
      this.selectedHistoryRows.splice(existingIndex, 1);
      element.classList.remove("timeline-selected");
    } else {
      // Select (max 2)
      if (this.selectedHistoryRows.length >= 2) {
        // Remove oldest selection
        const oldest = this.selectedHistoryRows.shift();
        const oldestElement = document.querySelector(
          `[data-commit-hash="${oldest.hash}"]`
        );
        if (oldestElement) {
          oldestElement.classList.remove("timeline-selected");
        }
      }
      
      this.selectedHistoryRows.push({
        hash: commitHash,
        shortHash: shortHash,
        element: element
      });
      element.classList.add("timeline-selected");
    }
    
    this.updateHistoryCompareButtons();
  }
  
  async compareSelectedHistoryRows() {
    if (this.selectedHistoryRows.length !== 2) {
      this.showError("Please select exactly two commits to compare");
      return;
    }
    
    const fileName = document.getElementById("historyFileName").textContent;
    if (!fileName) {
      this.showError("No file selected for comparison");
      return;
    }
    
    // Sort by chronological order (older first, newer second)
    const sortedRows = this.selectedHistoryRows.sort((a, b) => {
      const aElement = a.element;
      const bElement = b.element;
      const aIndex = Array.from(aElement.parentNode.children).indexOf(aElement);
      const bIndex = Array.from(bElement.parentNode.children).indexOf(bElement);
      return bIndex - aIndex; // Reverse order for chronological
    });
    
    const olderCommit = sortedRows[0];
    const newerCommit = sortedRows[1];
    
    this.showLoading();
    
    try {
      const diffData = await window.authManager.apiRequest("/api/git/diff", {
        method: "POST",
        body: JSON.stringify({
          commit1: olderCommit.hash,
          commit2: newerCommit.hash,
          file_path: fileName
        })
      });
      
      const formattedDiff = this.formatGitDiff(
        diffData,
        fileName,
        olderCommit.shortHash,
        newerCommit.shortHash
      );
      
      this.displayComparison(
        formattedDiff,
        `${fileName}: ${olderCommit.shortHash} → ${newerCommit.shortHash}`
      );
      
      // Scroll to comparison section
      document.getElementById("comparisonSection").scrollIntoView({
        behavior: "smooth"
      });
    } catch (error) {
      this.showError("Error comparing commits: " + error.message);
    }
  }
}
```

### 20.8 Performance Optimizations

**Frontend Performance Features:**
```javascript
class PerformanceOptimizer {
  // Virtual scrolling for large diffs
  enableVirtualScrolling(container, itemHeight = 20) {
    const viewport = container;
    const content = viewport.querySelector('.diff-content');
    const items = content.children;
    
    let startIndex = 0;
    let endIndex = Math.min(items.length, Math.ceil(viewport.clientHeight / itemHeight) + 5);
    
    viewport.addEventListener('scroll', () => {
      const scrollTop = viewport.scrollTop;
      startIndex = Math.floor(scrollTop / itemHeight);
      endIndex = Math.min(items.length, startIndex + Math.ceil(viewport.clientHeight / itemHeight) + 5);
      
      this.updateVisibleItems(items, startIndex, endIndex);
    });
  }
  
  // Debounced search to reduce API calls
  debounceSearch(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // Chunked rendering for large files
  renderDiffChunked(diffData, chunkSize = 100) {
    return new Promise((resolve) => {
      const container = document.getElementById("diffContent");
      let currentIndex = 0;
      
      const renderChunk = () => {
        const endIndex = Math.min(currentIndex + chunkSize, diffData.left_lines.length);
        
        for (let i = currentIndex; i < endIndex; i++) {
          this.renderDiffLine(diffData.left_lines[i], diffData.right_lines[i], container);
        }
        
        currentIndex = endIndex;
        
        if (currentIndex < diffData.left_lines.length) {
          // Use requestAnimationFrame for smooth rendering
          requestAnimationFrame(renderChunk);
        } else {
          resolve();
        }
      };
      
      renderChunk();
    });
  }
}
```

**Backend Caching Strategy:**
```python
# Cache configuration for comparison results
COMPARISON_CACHE_CONFIG = {
    "file_comparisons": {
        "ttl": 300,  # 5 minutes
        "max_size": 100,
        "key_pattern": "compare:files:{left_hash}:{right_hash}"
    },
    "git_diffs": {
        "ttl": 600,  # 10 minutes  
        "max_size": 200,
        "key_pattern": "compare:git:{commit1}:{commit2}:{file_path}"
    },
    "file_history": {
        "ttl": 900,  # 15 minutes
        "max_size": 50,
        "key_pattern": "history:{repo_id}:{file_path}:{from_commit}"
    }
}
```

### 20.9 Error Handling and Edge Cases

**Comprehensive Error Handling:**
```javascript
class ComparisonErrorHandler {
  handleComparisonError(error, context) {
    console.error(`Comparison error in ${context}:`, error);
    
    let userMessage = "An error occurred during comparison.";
    let showDetails = false;
    
    if (error.response) {
      switch (error.response.status) {
        case 404:
          userMessage = "One or more files not found.";
          break;
        case 403:
          userMessage = "Access denied. Check permissions.";
          break;
        case 413:
          userMessage = "File too large for comparison.";
          break;
        case 500:
          userMessage = "Server error during comparison.";
          showDetails = true;
          break;
        default:
          userMessage = `Comparison failed (${error.response.status}).`;
          showDetails = true;
      }
    } else if (error.message.includes("timeout")) {
      userMessage = "Comparison timed out. Try with smaller files.";
    } else if (error.message.includes("network")) {
      userMessage = "Network error. Check connection.";
    }
    
    this.showError(userMessage, showDetails ? error.message : null);
  }
  
  validateComparisonInputs(mode, inputs) {
    const errors = [];
    
    switch (mode) {
      case 'files':
        if (!inputs.leftFile) errors.push("Please select a source file");
        if (!inputs.rightFile) errors.push("Please select a target file");
        if (inputs.leftFile === inputs.rightFile) {
          errors.push("Cannot compare file with itself");
        }
        break;
        
      case 'git':
        if (!inputs.leftCommit) errors.push("Please select a source commit");
        if (!inputs.rightCommit) errors.push("Please select a target commit");
        if (!inputs.filePath) errors.push("Please select a file to compare");
        if (inputs.leftCommit === inputs.rightCommit) {
          errors.push("Cannot compare commit with itself");
        }
        break;
        
      case 'history':
        if (!inputs.selectedRows || inputs.selectedRows.length !== 2) {
          errors.push("Please select exactly two commits from history");
        }
        if (!inputs.fileName) errors.push("No file selected for history comparison");
        break;
    }
    
    return errors;
  }
}
```

This comprehensive comparison engine implementation provides robust, performant, and user-friendly configuration comparison capabilities across all three modes with advanced features like syntax highlighting, navigation, export, and error handling.

## 21. Nautobot API Details

Cockpit's integration with Nautobot serves as the network source of truth, providing authoritative device data, inventory management, and configuration context. The integration supports both GraphQL and REST API patterns with comprehensive caching and error handling.

### 21.1 API Architecture and Configuration

**Nautobot Service Configuration:**
```python
# Backend service configuration
class NautobotService:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.config = None
        
    def _get_config(self) -> Dict[str, Any]:
        """Get Nautobot configuration with database fallback to environment."""
        # Database settings take priority
        try:
            from settings_manager import settings_manager
            db_settings = settings_manager.get_nautobot_settings()
            if db_settings and db_settings.get('url') and db_settings.get('token'):
                return {
                    'url': db_settings['url'],
                    'token': db_settings['token'],
                    'timeout': db_settings.get('timeout', 30),
                    'verify_ssl': db_settings.get('verify_ssl', True),
                    '_source': 'database'
                }
        except Exception as e:
            logger.warning(f"Database settings unavailable, using environment: {e}")
        
        # Environment fallback
        from config import settings
        return {
            'url': settings.nautobot_url,
            'token': settings.nautobot_token,
            'timeout': settings.nautobot_timeout,
            'verify_ssl': True,
            '_source': 'environment'
        }
```

**Frontend Configuration:**
```javascript
// Frontend Nautobot endpoints
const NAUTOBOT_ENDPOINTS = {
  locations: "/api/nautobot/locations",
  namespaces: "/api/nautobot/namespaces", 
  roles: "/api/nautobot/roles",
  deviceRoles: "/api/nautobot/roles/devices",
  platforms: "/api/nautobot/platforms",
  statuses: "/api/nautobot/statuses",
  deviceStatuses: "/api/nautobot/statuses/device",
  interfaceStatuses: "/api/nautobot/statuses/interface",
  ipAddressStatuses: "/api/nautobot/statuses/ipaddress",
  combinedStatuses: "/api/nautobot/statuses/combined",
  secretGroups: "/api/nautobot/secret-groups",
  stats: "/api/nautobot/stats",
  checkIp: "/api/nautobot/check-ip",
  onboardDevice: "/api/nautobot/devices/onboard"
};
```

### 21.2 GraphQL Integration Implementation

**Core GraphQL Query Architecture:**
```python
# Synchronous GraphQL execution
def _sync_graphql_query(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Execute GraphQL query against Nautobot."""
    config = self._get_config()
    
    if not config['url'] or not config['token']:
        raise Exception("Nautobot URL and token must be configured")
    
    graphql_url = f"{config['url'].rstrip('/')}/api/graphql/"
    
    headers = {
        "Authorization": f"Token {config['token']}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "query": query,
        "variables": variables or {}
    }
    
    try:
        response = requests.post(
            graphql_url,
            json=payload,
            headers=headers,
            timeout=config['timeout'],
            verify=config['verify_ssl']
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"GraphQL request failed with status {response.status_code}: {response.text}")
    except requests.exceptions.Timeout:
        raise Exception(f"GraphQL request timed out after {config['timeout']} seconds")
    except Exception as e:
        logger.error(f"GraphQL query failed: {str(e)}")
        raise

# Async wrapper for GraphQL queries
async def graphql_query(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Execute GraphQL query against Nautobot asynchronously."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(self.executor, self._sync_graphql_query, query, variables)
```

**Device Query Patterns:**
```python
# Device retrieval with filtering
DEVICE_QUERY_TEMPLATES = {
    "by_name": """
    query devices_by_name($name_filter: [String], $limit: Int, $offset: Int) {
        devices(name__ire: $name_filter, limit: $limit, offset: $offset) {
            id
            name
            role { name }
            location { name }
            primary_ip4 { address }
            status { name }
            device_type { model }
            cf_last_backup
        }
    }
    """,
    
    "by_location": """
    query devices_by_location($location_filter: [String], $limit: Int, $offset: Int) {
        locations(name__ire: $location_filter) {
            name
            devices(limit: $limit, offset: $offset) {
                id
                name
                role { name }
                location { name }
                primary_ip4 { address }
                status { name }
                device_type { model }
                cf_last_backup
            }
        }
    }
    """,
    
    "by_prefix": """
    query devices_by_prefix($prefix_filter: [String], $limit: Int, $offset: Int) {
        prefixes(prefix: $prefix_filter) {
            prefix
            ip_addresses(limit: $limit, offset: $offset) {
                address
                primary_ip4_for {
                    id
                    name
                    role { name }
                    location { name }
                }
                primary_ip4 { address }
                status { name }
                device_type { model }
                cf_last_backup
            }
        }
    }
    """
}
```

**Advanced GraphQL Queries:**
```python
# Complex nested queries for inventory management
INVENTORY_QUERIES = {
    "devices_by_manufacturer": """
    query devices_by_manufacturer($manufacturer_filter: [String]) {
        devices(manufacturer: $manufacturer_filter) {
            id
            name
            primary_ip4 { address }
            status { name }
            device_type { model }
            role { name }
            location { name }
            tags { name }
            platform { name }
        }
    }
    """,
    
    "devices_by_platform": """
    query devices_by_platform($platform_filter: [String]) {
        devices(platform: $platform_filter) {
            id
            name
            primary_ip4 { address }
            status { name }
            device_type { model }
            role { name }
            location { name }
            tags { name }
            platform { name }
        }
    }
    """,
    
    "locations_with_hierarchy": """
    query locations {
        locations {
            id
            name
            description
            parent {
                id
                name
                description
            }
            children {
                id
                name
                description
            }
        }
    }
    """,
    
    "ip_address_availability": """
    query device($ip_address: [String]) {
        ip_addresses(address: $ip_address) {
            primary_ip4_for {
                name
            }
        }
    }
    """
}
```

### 21.3 REST API Integration

**REST Request Implementation:**
```python
def _sync_rest_request(self, endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Execute REST API request against Nautobot."""
    config = self._get_config()
    
    if not config['url'] or not config['token']:
        raise Exception("Nautobot URL and token must be configured")
    
    api_url = f"{config['url'].rstrip('/')}/api/{endpoint.lstrip('/')}"
    
    headers = {
        "Authorization": f"Token {config['token']}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.request(
            method,
            api_url,
            json=data,
            headers=headers,
            timeout=config['timeout'],
            verify=config['verify_ssl']
        )
        
        if response.status_code in [200, 201]:
            return response.json()
        else:
            raise Exception(f"REST request failed with status {response.status_code}: {response.text}")
    except Exception as e:
        logger.error(f"REST API request failed: {str(e)}")
        raise

# Async wrapper for REST requests
async def rest_request(self, endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Execute REST API request asynchronously."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(self.executor, self._sync_rest_request, endpoint, method, data)
```

**REST Endpoint Mapping:**
```python
REST_ENDPOINTS = {
    "device_types": "dcim/device-types/",
    "manufacturers": "dcim/manufacturers/",
    "platforms": "dcim/platforms/",
    "roles": "extras/roles/",
    "statuses": "extras/statuses/",
    "locations": "dcim/locations/",
    "devices": "dcim/devices/",
    "interfaces": "dcim/interfaces/",
    "ip_addresses": "ipam/ip-addresses/",
    "prefixes": "ipam/prefixes/",
    "secret_groups": "extras/secret-groups/"
}
```

### 21.4 Connection Testing and Validation

**Connection Test Implementation:**
```python
def _sync_test_connection(self, url: str, token: str, timeout: int = 30, verify_ssl: bool = True) -> tuple[bool, str]:
    """Test Nautobot connection with minimal GraphQL query."""
    try:
        test_query = """
        query {
            devices(limit: 1) {
                id
                name
            }
        }
        """
        
        graphql_url = f"{url.rstrip('/')}/api/graphql/"
        
        headers = {
            "Authorization": f"Token {token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "query": test_query,
            "variables": {}
        }
        
        response = requests.post(
            graphql_url,
            json=payload,
            headers=headers,
            timeout=timeout,
            verify=verify_ssl
        )
        
        if response.status_code == 200:
            result = response.json()
            if "errors" not in result:
                return True, "Connection successful"
            else:
                return False, f"GraphQL errors: {result['errors']}"
        else:
            return False, f"HTTP {response.status_code}: {response.text}"
            
    except requests.exceptions.Timeout:
        return False, f"Connection timed out after {timeout} seconds"
    except requests.exceptions.ConnectionError:
        return False, "Unable to connect to Nautobot server"
    except Exception as e:
        return False, f"Connection test failed: {str(e)}"

# Async connection test
async def test_connection(self, url: str, token: str, timeout: int = 30, verify_ssl: bool = True) -> tuple[bool, str]:
    """Test Nautobot connection asynchronously."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(self.executor, self._sync_test_connection, url, token, timeout, verify_ssl)
```

### 21.5 Caching Strategy for API Responses

**Cache Configuration:**
```python
NAUTOBOT_CACHE_CONFIG = {
    "locations": {
        "ttl": 600,  # 10 minutes
        "key": "nautobot:locations:list"
    },
    "device_stats": {
        "ttl": 300,  # 5 minutes  
        "key": "nautobot:stats:devices"
    },
    "device_roles": {
        "ttl": 900,  # 15 minutes
        "key": "nautobot:roles:devices"
    },
    "platforms": {
        "ttl": 1800,  # 30 minutes
        "key": "nautobot:platforms:list"
    }
}
```

### 21.6 Error Handling and Retry Logic

**Comprehensive Error Handling:**
```python
class NautobotAPIError(Exception):
    """Custom exception for Nautobot API errors."""
    def __init__(self, message: str, status_code: int = None, response_text: str = None):
        self.message = message
        self.status_code = status_code
        self.response_text = response_text
        super().__init__(self.message)

def handle_nautobot_errors(func):
    """Decorator for consistent Nautobot error handling."""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except requests.exceptions.Timeout:
            raise NautobotAPIError("Request timed out", 408)
        except requests.exceptions.ConnectionError:
            raise NautobotAPIError("Unable to connect to Nautobot", 503)
        except requests.exceptions.HTTPError as e:
            raise NautobotAPIError(f"HTTP error: {e}", e.response.status_code)
        except Exception as e:
            raise NautobotAPIError(f"Unexpected error: {str(e)}")
    return wrapper
```

### 21.7 API Endpoint Documentation

**Device Management Endpoints:**
- `GET /api/nautobot/devices` - List devices with filtering and pagination
- `GET /api/nautobot/devices/{device_id}` - Get specific device details
- `POST /api/nautobot/devices/search` - Advanced device search with filters
- `POST /api/nautobot/devices/onboard` - Onboard new device to Nautobot

**Infrastructure Data Endpoints:**
- `GET /api/nautobot/locations` - Get location hierarchy
- `GET /api/nautobot/namespaces` - Get IP namespaces
- `GET /api/nautobot/roles` - Get device roles
- `GET /api/nautobot/platforms` - Get device platforms
- `GET /api/nautobot/statuses` - Get status definitions

**IP Management Endpoints:**
- `POST /api/nautobot/check-ip` - Check IP address availability
- `GET /api/nautobot/stats` - Get Nautobot statistics

**Legacy Compatibility:**
- `POST /api/nautobot/graphql` - Direct GraphQL endpoint
- `POST /api/graphql` - Legacy GraphQL compatibility

## 22. External Dependencies

Cockpit relies on a comprehensive set of external dependencies for both frontend and backend functionality. These dependencies are carefully managed to ensure security, performance, and maintainability.

### 22.1 Backend Python Dependencies

**Core Framework Dependencies:**
```python
# requirements.txt - Core backend dependencies
fastapi              # Modern async web framework
uvicorn              # ASGI server for FastAPI
pydantic[dotenv]     # Data validation with environment support
pydantic-settings    # Settings management with Pydantic
```

**HTTP and API Integration:**
```python
requests             # HTTP client for Nautobot API
python-multipart     # Form data parsing support
```

**Authentication and Security:**
```python
pyjwt               # JSON Web Token implementation
passlib[bcrypt]     # Password hashing with bcrypt support
cryptography>=42.0.0 # Cryptographic operations
```

**Configuration and Environment:**
```python
python-dotenv       # Environment variable management
```

**Git and Version Control:**
```python
gitpython          # Git repository operations
```

**Template Processing:**
```python
jinja2             # Template engine for configuration rendering
```

**Text Processing:**
```python
textfsm            # TextFSM parsing for network device output
```

**System Dependencies (Docker):**
```dockerfile
# Backend Dockerfile system packages
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git \           # Required for GitPython operations
    curl \          # Health checks and testing
    && rm -rf /var/lib/apt/lists/*
```

### 22.2 Frontend Node.js Dependencies

**Core Development Tools:**
```json
{
  "devDependencies": {
    "prettier": "^3.3.3",      // Code formatting
    "glob": "^11.0.2",         // File pattern matching
    "sass": "^1.89.2",         // SCSS compilation
    "vite": "^6.3.5"           // Build tool and dev server
  }
}
```

**UI Framework and Core Libraries:**
```json
{
  "dependencies": {
    "bootstrap": "^5.3.6",           // CSS framework
    "@popperjs/core": "^2.11.8",     // Tooltip/popover positioning
    "jquery": "^3.6.1",             // DOM manipulation and legacy support
    "jquery-ui": "^1.14.1"          // Enhanced UI components
  }
}
```

**Form and Input Enhancement:**
```json
{
  "dependencies": {
    "@eonasdan/tempus-dominus": "^6.10.4",  // Modern date/time picker
    "inputmask": "^5.0.9",                  // Input formatting and masking
    "select2": "^4.0.13",                   // Enhanced select boxes
    "switchery": "^0.0.2",                  // iOS-style toggle switches
    "ion-rangeslider": "^2.3.1",            // Range slider controls
    "autosize": "^6.0.1"                    // Auto-resizing textareas
  }
}
```

**Data Visualization:**
```json
{
  "dependencies": {
    "chart.js": "^4.4.2",        // Modern charting library
    "echarts": "^5.6.0",         // Apache ECharts visualization
    "jquery-sparkline": "^2.4.0", // Inline sparkline charts
    "leaflet": "^1.9.4"          // Interactive maps
  }
}
```

**Table and Data Management:**
```json
{
  "dependencies": {
    "datatables.net": "^2.3.2",              // Advanced table functionality
    "datatables.net-bs5": "^2.3.2",          // Bootstrap 5 integration
    "datatables.net-buttons": "^3.2.3",       // Export/print buttons
    "datatables.net-buttons-bs5": "^3.2.3",   // Bootstrap 5 button styling
    "datatables.net-fixedheader": "^4.0.3",   // Fixed header support
    "datatables.net-keytable": "^2.12.1",     // Keyboard navigation
    "datatables.net-responsive": "^3.0.4",    // Responsive design
    "datatables.net-responsive-bs5": "^3.0.4", // Bootstrap 5 responsive
    "datatables.net-scroller": "^2.4.3"       // Virtual scrolling
  }
}
```

**Rich Text and File Handling:**
```json
{
  "dependencies": {
    "bootstrap-wysiwyg": "^2.0.1",   // WYSIWYG editor
    "cropperjs": "^2.0.0",          // Image cropping
    "dropzone": "^5.9.3",           // File upload handling
    "@simonwep/pickr": "^1.9.1",    // Modern color picker
    "jquery-knob": "^1.2.11"        // Circular input controls
  }
}
```

**Calendar and Time Management:**
```json
{
  "dependencies": {
    "@fullcalendar/core": "^6.1.17",        // Core calendar functionality
    "@fullcalendar/daygrid": "^6.1.17",     // Day grid view
    "@fullcalendar/interaction": "^6.1.17",  // User interaction
    "@fullcalendar/timegrid": "^6.1.17",    // Time grid view
    "dayjs": "^1.11.13"                     // Modern date manipulation
  }
}
```

**Utility Libraries:**
```json
{
  "dependencies": {
    "nprogress": "^0.2.0",         // Loading progress indicators
    "skycons": "^1.0.0",           // Animated weather icons
    "flot": "^4.2.6",              // Legacy charting support
    "jszip": "^3.10.1",            // ZIP file handling
    "pdfmake": "^0.2.20"           // PDF generation
  }
}
```

**Icon Libraries:**
```json
{
  "dependencies": {
    "@fortawesome/fontawesome-free": "^6.6.0"  // FontAwesome icons
  }
}
```

### 22.3 Docker Dependencies

**Frontend + Backend Combined Container:**
```dockerfile
# Primary Dockerfile
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    build-base \     # Compilation tools for Python packages
    git \            # Git operations
    curl \           # Health checks
    && ln -sf python3 /usr/bin/python
```

**Backend Only Container:**
```dockerfile
# Backend Dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \            # Required for GitPython
    curl \           # Health checks and API testing
    && rm -rf /var/lib/apt/lists/*
```

### 22.4 Development and Build Tools

**Vite Configuration Dependencies:**
```javascript
// vite.config.js key configurations
export default defineConfig({
  server: {
    port: 3000,
    host: process.env.VITE_HOST || "localhost",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false
      },
      "/auth": {
        target: "http://127.0.0.1:8000", 
        changeOrigin: true,
        secure: false
      }
    }
  },
  optimizeDeps: {
    include: ["jquery", "bootstrap", "@popperjs/core", "dayjs", "nprogress"],
    force: true
  }
});
```

**Code Quality Tools:**
```json
{
  "scripts": {
    "format": "prettier --write '**/*.{html,js,jsx,ts,tsx,css,scss,json,md,yml,yaml}'",
    "format:check": "prettier --check '**/*.{html,js,jsx,ts,tsx,css,scss,json,md,yml,yaml}'"
  }
}
```

### 22.5 Runtime Environment Requirements

**Minimum System Requirements:**
```yaml
Development Environment:
  Node.js: ">=16.0.0"
  Python: ">=3.8.0"
  Git: ">=2.20.0"
  
Production Environment:
  Docker: ">=20.10.0"
  Docker Compose: ">=2.0.0"
  
Browser Support:
  Chrome: ">=90"
  Firefox: ">=88"
  Safari: ">=14"
  Edge: ">=90"
```

**Network Requirements:**
```yaml
External Services:
  Nautobot API: "HTTPS/HTTP access required"
  
Ports:
  Frontend Development: 3000
  Frontend Fallback: 3001
  Backend API: 8000
  
Docker Ports:
  Frontend Container: 3000
  Backend Container: 8000
```

### 22.6 External Service Dependencies

**Nautobot Integration Requirements:**
```yaml
Nautobot Version: ">=1.4.0"
API Access: "GraphQL and REST endpoints"
Authentication: "Token-based authentication"
Permissions: "Minimum read access to DCIM models"

Required Nautobot Features:
  - GraphQL API endpoint (/api/graphql/)
  - REST API endpoints (/api/dcim/, /api/ipam/, /api/extras/)
  - Token authentication
  - Device, Location, Role, Platform models
  - Custom fields support (cf_last_backup)
```

**Git Integration Requirements:**
```yaml
Git Operations:
  - Repository cloning and syncing
  - Branch switching and management
  - Commit history and diff generation
  - File content retrieval

SSL Support:
  - Configurable SSL verification
  - Custom CA certificate support
  - Client certificate authentication
```

### 22.7 Dependency Security and Updates

**Security Considerations:**
```yaml
Critical Security Dependencies:
  - cryptography: ">=42.0.0" (CVE mitigation)
  - fastapi: Latest stable (security updates)
  - requests: Latest stable (SSL/TLS security)
  - pyjwt: Latest stable (token security)

Regular Update Schedule:
  - Monthly: Minor version updates
  - Quarterly: Major version evaluations
  - Immediate: Critical security patches
```

**Dependency Validation:**
```bash
# Frontend dependency audit
npm audit --audit-level moderate

# Backend dependency security check
pip-audit --requirement requirements.txt

# Container security scanning
docker scout cves
```

This comprehensive dependency management ensures Cockpit maintains security, performance, and compatibility across all deployment scenarios while providing rich functionality through carefully selected external libraries.

## 23. Implementation Scope and Known Limitations

### 23.1 Hobby Project Context

**Project Classification:** Cockpit is designed as a **hobby/personal project** for network engineers and small teams. The implementation scope reflects this focus on core functionality rather than enterprise-grade operational requirements.

### 23.2 Intentionally Out of Scope

The following implementation areas are **intentionally excluded** from this PRD as they exceed the requirements of a hobby project:

#### Production Infrastructure (Not Implemented)
- **Reverse Proxy Configuration** (Nginx/Apache setup)
- **SSL Certificate Management** (Let's Encrypt automation, certificate rotation)
- **Load Balancing** and high-availability deployment
- **Container Orchestration** (Kubernetes, Docker Swarm)

#### Enterprise Testing Framework (Not Implemented)
- **Comprehensive Unit Test Suite** with high coverage requirements
- **Integration Test Framework** (Playwright/Cypress end-to-end testing)
- **Performance Testing** and load testing suites
- **CI/CD Pipeline Configuration** (GitHub Actions, Jenkins)

#### Advanced Security Features (Not Implemented)
- **Rate Limiting Middleware** for API endpoints
- **CSRF Protection** mechanisms
- **Input Sanitization Framework** beyond basic validation
- **Security Audit Logging** and intrusion detection

#### Enterprise Monitoring (Not Implemented)
- **Application Performance Monitoring** (APM solutions)
- **Metrics Collection** (Prometheus, Grafana)
- **Centralized Logging** (ELK stack, Splunk)
- **Alerting and Notification Systems**

#### Advanced Database Features (Not Implemented)
- **Database Clustering** and replication
- **Advanced Migration Framework** with rollback capabilities
- **Automated Backup Systems** with retention policies
- **Database Performance Tuning** and indexing optimization

#### Operational Tooling (Not Implemented)
- **Health Check Endpoints** beyond basic connectivity
- **Background Job Processing** (Celery, Redis queues)
- **API Versioning Strategy** for backwards compatibility
- **Webhook Support** for external integrations

### 23.3 What IS Implemented

The PRD provides **complete implementation guidance** for:

✅ **Core Application Architecture**
- Full-stack application structure (FastAPI + Vite)
- Database schemas and relationships
- Authentication and session management

✅ **Business Logic Implementation**
- Configuration comparison engine
- Git integration and repository management
- Nautobot API integration
- Device discovery and onboarding
- Template management system

✅ **Development Experience**
- Docker containerization for easy setup
- Development server configuration
- Hot reload and proxy setup
- Environment variable management

✅ **Basic Deployment**
- Docker Compose configuration
- Environment-specific settings
- Container health checks
- Basic security (JWT, bcrypt)

### 23.4 Migration Path for Production Use

Should Cockpit evolve beyond hobby project scope, the following migration path is recommended:

**Phase 1: Basic Production Hardening**
1. Implement reverse proxy (Nginx) with SSL termination
2. Add basic monitoring and health checks
3. Implement rate limiting and input validation
4. Set up automated backups

**Phase 2: Operational Excellence**
5. Add comprehensive testing framework
6. Implement CI/CD pipeline
7. Add centralized logging and monitoring
8. Implement disaster recovery procedures

**Phase 3: Enterprise Features**
9. Add high availability and load balancing
10. Implement advanced security features
11. Add performance monitoring and optimization
12. Implement API versioning and webhooks

### 23.5 Conclusion

This PRD intentionally focuses on **developer productivity** and **core functionality** rather than enterprise operational requirements. The implementation provides a **solid foundation** that can be extended as needs evolve, while maintaining simplicity for hobby and small-team usage.

The documented architecture and implementation details enable **rapid development** and **easy maintenance** without the overhead of enterprise-grade infrastructure that would be overkill for the intended use case.

This comprehensive PRD provides detailed implementation guidance for rebuilding Cockpit while maintaining its architecture, functionality, and developer experience.
