# Cockpit-NG

> **Modern Network Management Dashboard**  
> A comprehensive network device management platform built with Next.js, TypeScript, and FastAPI.

![Version](https://img.shields.io/badge/version-0.9.0-blue.svg)
![License](https://img.shields.io/badge/license-Apache-green.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

Cockpit-NG is a next-generation network management dashboard designed for network engineers and NetDevOps teams. It provides a modern, Apple-inspired interface for managing network devices, configurations, and automation workflows with seamless integration to Nautobot.

## ✨ Key Features

### 🎯 **Device Management**
- **Device Onboarding**: Streamlined device discovery and registration
- **Bulk Discovery**: Network scanning and automated device addition
- **Real-time Monitoring**: Live device status and health monitoring
- **Configuration Backup**: Automated configuration collection and versioning

### 🔧 **Configuration Management**
- **Template System**: Jinja2-based configuration templates
- **Version Control**: Git integration for configuration tracking
- **Comparison Tools**: Side-by-side configuration comparison
- **Rollback Support**: Easy configuration restoration

### 🤖 **Automation Integration**
- **Ansible Inventory**: Dynamic inventory generation from Nautobot
- **Template Deployment**: Automated configuration deployment
- **Workflow Orchestration**: Multi-device operation support
- **API-First Design**: RESTful API for external integration

### 🔐 **Authentication & Security**
- **JWT Authentication**: Secure token-based authentication with session management
- **OIDC/SSO Support**: Multi-provider OpenID Connect authentication
  - Multiple identity provider support (Keycloak, Azure AD, Okta, etc.)
  - Custom CA certificate support for air-gapped/corporate environments
  - Per-provider configuration and claim mapping
  - Auto-provisioning with role assignment
  - Traditional login fallback option
- **Credential Management**: Encrypted credential storage
- **SSL/TLS Support**: Custom CA certificates for self-signed certificates

### 📊 **CheckMK Integration**
- **Device Synchronization**: Bidirectional sync between Nautobot and CheckMK
- **Site Management**: Automatic site assignment based on location, IP, or name
- **Folder Organization**: Dynamic folder creation and device placement
- **Tag Mapping**: Custom field and tag mapping to CheckMK host tag groups
- **SNMP Configuration**: Automated SNMP community and credential setup
- **Bulk Operations**: Mass device addition and updates to CheckMK

### 📊 **Analytics Dashboard**
- **Real-time Statistics**: Network infrastructure metrics
- **Activity Monitoring**: Recent operations and status updates
- **Performance Tracking**: System health and performance metrics
- **Cached Analytics**: Optimized data loading with intelligent caching

## 🏗️ Architecture

Cockpit-NG follows a modern microservices architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   External      │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│   Services      │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • REST API      │    │ • Nautobot      │
│ • Auth System   │    │ • Auth Service  │    │ • CheckMK       │
│ • Settings UI   │    │ • Git Manager   │    │ • Git Repos     │
│ • Device Mgmt   │    │ • Cache Layer   │    │ • LDAP/AD       │
│ • CheckMK Sync  │    │ • CheckMK API   │    │ • SSH Devices   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Frontend (Next.js 14)**
- Apple-inspired design system with Tailwind CSS
- TypeScript for type safety
- Shadcn/ui components
- JWT authentication with persistent sessions
- Real-time data with intelligent caching

### **Backend (FastAPI)**
- Modern Python async framework
- SQLite database for settings and cache
- Git integration for configuration management
- Nautobot API integration
- Comprehensive REST API

## 🚀 Quick Start

### **Docker Deployment (Recommended)**

1. **Clone the repository**:
   ```bash
   git clone https://github.com/nerdfunk-net/cockpit-ng.git
   cd cockpit-ng
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Nautobot URL and API token
   ```

3. **Start the application**:
   ```bash
   docker-compose up -d
   ```

4. **Access the dashboard**:
   - Frontend: http://localhost:3000
   - API Documentation: http://localhost:3000/api/proxy/docs

5. **Verify deployment**:
   ```bash
   ./test-docker-deployment.sh
   ```

### **Development Setup**

**Backend**:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python start.py
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

## 📱 User Interface

### **Dashboard Overview**
- Real-time network statistics
- Recent activity feed
- Quick action buttons
- System health indicators

### **Device Management**
- Interactive device onboarding wizard
- Bulk device discovery and scanning
- Device status monitoring
- Configuration management

### **CheckMK Synchronization**
- Device comparison between Nautobot and CheckMK
- Real-time sync status monitoring
- Bulk device operations (add, update, delete)
- Site and folder management interface
- Configuration validation and error handling

### **Settings & Configuration**
- Nautobot integration settings
- CheckMK connection and site configuration
- Git repository management
- Template configuration
- Credential management
- Cache optimization

## 🔧 Configuration

### **Environment Variables**

```bash
# Nautobot Integration
NAUTOBOT_URL=http://your-nautobot-instance:8080
NAUTOBOT_TOKEN=your_api_token_here
NAUTOBOT_TIMEOUT=30

# CheckMK Integration
CHECKMK_URL=http://your-checkmk-instance:5000
CHECKMK_USERNAME=automation
CHECKMK_PASSWORD=your_password
CHECKMK_SITE=cmk
CHECKMK_VERIFY_SSL=true

# Security
SECRET_KEY=your-secret-key-change-in-production
JWT_EXPIRY_MINUTES=10

# Application Settings
DATA_DIR=/app/data
LOG_LEVEL=INFO
```

### **Nautobot Requirements**

Cockpit-NG requires a Nautobot instance with:
- REST API access
- Valid API token
- Device and location data
- Platform definitions

### **CheckMK Requirements**

CheckMK integration requires:
- CheckMK Raw or Enterprise edition
- REST API access (enabled by default)
- Automation user credentials
- Site configuration access
- Host management permissions

## 📋 API Reference

### **Authentication**
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

### **Device Operations**
```http
# Onboard device
POST /api/nautobot/onboard
Authorization: Bearer <token>

# Get device statistics
GET /api/nautobot/stats
Authorization: Bearer <token>
```

### **Git Management**
```http
# List repositories
GET /api/git-repositories/
Authorization: Bearer <token>

# Create repository
POST /api/git-repositories/
Authorization: Bearer <token>

# Update repository
PUT /api/git-repositories/{id}
Authorization: Bearer <token>

# Test repository connection
POST /api/git-repositories/test-connection
Authorization: Bearer <token>

# Sync repository
POST /api/git/{id}/sync
Authorization: Bearer <token>
```

### **File Operations**
```http
# List files in repository
GET /api/file-compare/list?repo_id={id}
Authorization: Bearer <token>

# Compare files
POST /api/file-compare/compare
Authorization: Bearer <token>

# Export file comparison
POST /api/file-compare/export
Authorization: Bearer <token>
```

### **CheckMK Operations**
```http
# Get device comparison
GET /api/nb2cmk/devices
Authorization: Bearer <token>

# Add device to CheckMK
POST /api/nb2cmk/device/{device_id}/add
Authorization: Bearer <token>

# Update device in CheckMK
POST /api/nb2cmk/device/{device_id}/update
Authorization: Bearer <token>

# Get normalized device data
GET /api/nb2cmk/device/{device_id}/normalized
Authorization: Bearer <token>

# Get default site configuration
GET /api/nb2cmk/get_default_site
Authorization: Bearer <token>
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **OIDC/SSO Authentication**: Multi-provider Single Sign-On support
  - Supports self-signed certificates with custom CA configuration
  - Per-provider SSL/TLS configuration
  - Air-gapped environment support
- **Session Management**: Automatic session renewal with activity tracking
- **Credential Protection**: Encrypted credential storage
- **SSL/TLS Support**: HTTPS endpoints and custom CA certificates
- **Input Validation**: Comprehensive request validation

## 📈 Performance & Monitoring

### **Caching System**
- Redis-compatible cache layer
- Intelligent cache invalidation
- Performance metrics tracking
- Memory usage optimization

### **Health Monitoring**
- Frontend health: `/api/health`
- Backend health: `/health`
- Docker health checks
- Performance metrics

## 🛠️ Development

### **Development Setup**

**Prerequisites**:
- Node.js 18+ and npm
- Python 3.9+
- Git

**Backend Setup**:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python start.py
```

**Frontend Setup**:
```bash
cd frontend
npm install
npm run dev
```

### **Development Workflow & Best Practices**

#### **Code Quality Enforcement**

This project uses multiple layers of automated code quality checks:

1. **ESLint** - Catches errors during development
   ```bash
   npm run lint        # Check for errors
   npm run lint:fix    # Auto-fix errors
   ```

2. **TypeScript** - Strict type checking
   ```bash
   npm run type-check  # Verify type safety
   ```

3. **Prettier** - Code formatting
   ```bash
   npm run format       # Format all files
   npm run format:check # Check formatting
   ```

4. **Pre-commit Hooks** - Automatically run before each commit
   - ESLint with auto-fix
   - Prettier formatting
   - Type checking
   - Blocks commits with errors

5. **Complete Check**
   ```bash
   npm run check       # Run all checks
   npm run check:fix   # Run all checks with auto-fix
   ```

#### **React Best Practices**

To prevent infinite re-render loops and performance issues, follow these rules:

**✅ DO:**
```typescript
// Use constants for empty default parameters
const EMPTY_ARRAY: string[] = []
const EMPTY_OBJECT = {}

function MyComponent({ items = EMPTY_ARRAY }) {
  // items reference stays stable
}

// Memoize custom hook return values
export function useMyHook() {
  const [state, setState] = useState()
  return useMemo(() => ({
    state,
    setState
  }), [state])
}

// Stable useEffect dependencies
useEffect(() => {
  loadData()
}, [stableValue]) // Only stable references
```

**❌ DON'T:**
```typescript
// Inline default parameters create new references every render
function MyComponent({ items = [] }) { // ❌ New array each render!
  // Causes infinite loops in child useEffect
}

// Non-memoized hook returns
export function useMyHook() {
  const [state, setState] = useState()
  return { state, setState } // ❌ New object each render!
}

// Unstable useEffect dependencies
const config = { key: 'value' } // ❌ New object each render!
useEffect(() => {
  doSomething(config)
}, [config]) // ❌ Runs every render!
```

**Key Rules:**
- ✅ Use `const` declarations for empty arrays/objects
- ✅ Wrap custom hook returns in `useMemo()`
- ✅ Ensure useEffect dependencies are stable references
- ✅ Move object/array creation outside render body or use useMemo
- ✅ Use exhaustive dependencies in useEffect/useMemo/useCallback
- ✅ Prefer Server Components (default in Next.js 15)
- ✅ Use `'use client'` only when needed (state, effects, events)

#### **Backend Best Practices**

- ✅ Always use JWT authentication for protected routes
- ✅ Check permissions with `require_permission()` decorator
- ✅ Validate inputs with Pydantic models
- ✅ Put business logic in services layer, not routers
- ✅ Database operations in manager files
- ✅ Use HTTPException for errors with appropriate status codes
- ✅ Log errors with proper severity levels

#### **Git Workflow**

1. Create feature branch from `main`
2. Make changes following best practices
3. Pre-commit hooks run automatically on commit
4. Push and create Pull Request
5. Ensure all CI/CD checks pass
6. Get code review approval
7. Merge to main

**Pre-commit Hook Features:**
- Automatically runs ESLint with `--fix`
- Formats code with Prettier
- Only processes staged files (fast!)
- Blocks commit if errors remain

### **Project Structure**
```
cockpit-ng/
├── backend/              # FastAPI backend
│   ├── routers/         # API route handlers
│   ├── models/          # Pydantic data models
│   ├── core/            # Core utilities
│   └── services/        # Business logic
├── frontend/            # Next.js frontend
│   ├── src/app/         # App router pages
│   ├── src/components/  # React components
│   └── src/hooks/       # Custom hooks
├── data/                # Persistent data
└── docker/              # Docker deployment files
    ├── docker-compose.yml   # Development (requires internet)
    ├── Dockerfile.basic     # Basic multi-stage build
    ├── Dockerfile.all-in-one # Air-gap production build
    ├── prepare-all-in-one.sh # Build air-gap image
    └── README-*.md          # Docker documentation
```

### **Technology Stack**

**Frontend**:
- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- Shadcn/ui components
- Zustand state management

**Backend**:
- FastAPI (Python 3.12+)
- SQLite database
- Pydantic data validation
- Asyncio for concurrency

## 🤝 Integration

### **Nautobot Integration**
- Device synchronization
- Location management
- IP address management
- Platform definitions

### **Git Integration**
- Configuration versioning
- Template management
- Change tracking
- Multi-repository support

### **CheckMK Integration**
- Bidirectional device synchronization
- Site-aware device management
- Folder organization and hierarchy
- Tag and custom field mapping
- SNMP credential management
- Bulk operations and batch processing

### **Ansible Integration**
- Dynamic inventory generation
- Playbook execution
- Variable management
- Task automation

## 📚 Documentation

- [OIDC/SSO Setup Guide](OIDC_SETUP.md) - Configure Single Sign-On with Keycloak, Azure AD, etc.
- [OIDC Implementation Guide](OIDC_IMPLEMENTATION_GUIDE.md) - Technical implementation details
- [Docker Deployment Guide](DOCKER.md)
- [Frontend Documentation](frontend/README.md)
- [API Documentation](http://localhost:3000/api/proxy/docs) (when running)

## 🐛 Troubleshooting

### **Common Issues**

1. **Connection to Nautobot fails**:
   - Verify `NAUTOBOT_URL` and `NAUTOBOT_TOKEN`
   - Check network connectivity
   - Validate SSL certificates

2. **Docker deployment issues**:
   - Run `./test-docker-deployment.sh`
   - Check container logs: `docker-compose logs`
   - Verify port availability

3. **Authentication problems**:
   - Clear browser cache and localStorage
   - Check JWT token expiry
   - Verify SECRET_KEY configuration

4. **CheckMK sync issues**:
   - Verify CheckMK URL and credentials
   - Check site configuration in `config/checkmk.yaml`
   - Validate SNMP mapping files
   - Review device attributes and tags
   - Check network connectivity to CheckMK instance

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🌟 Contributing

Cockpit-NG is a hobby project focused on modern web development practices and Apple-inspired design. Contributions are welcome!

---

**Built with ❤️ for the network engineering community**
