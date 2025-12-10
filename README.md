# Cockpit-NG

> **Modern Network Management Dashboard for NetDevOps Teams**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)

Cockpit-NG is a comprehensive network management platform designed for network engineers and NetDevOps teams. It provides a modern web interface for managing network devices, automating configurations, and orchestrating workflows with seamless integration to **Nautobot** (Network Source of Truth) and **CheckMK** (Monitoring).

---

## ✨ Features

### 🔗 Nautobot Integration
- **Source of Truth**: Use Nautobot as your central device inventory
- **Device Synchronization**: Sync devices from Nautobot to Cockpit-NG
- **Inventory Management**: Access device information, locations, and metadata
- **Dynamic Filtering**: Filter devices by site, role, platform, or custom fields

### 📊 CheckMK Integration
- **Device Synchronization**: Sync devices from Nautobot to CheckMK monitoring
- **Automatic Folder Organization**: Create folder structures based on location or custom logic
- **SNMP Configuration**: Automated SNMP community and credential setup
- **Tag Mapping**: Map Nautobot custom fields to CheckMK host tags
- **Bulk Operations**: Add, update, or remove multiple devices at once
- **Background Sync Jobs**: Non-blocking sync operations with progress tracking

### 🖥️ Netmiko Script Execution
- **Direct Device Access**: Execute commands on network devices via SSH
- **Multi-Device Operations**: Run scripts across multiple devices simultaneously
- **Template-Based Commands**: Use Jinja2 templates for dynamic command generation
- **Output Collection**: Capture and store command outputs for analysis
- **Credential Management**: Secure encrypted credential storage

### ⚙️ Background Jobs
- **Configuration Backup**: Scheduled automatic device configuration backups
- **Nautobot-CheckMK Comparison**: Compare device states between systems
- **Template Execution**: Run configuration templates as background tasks
- **Job Monitoring**: Track job progress, view results, and access logs
- **Celery-Based**: Reliable task execution with Redis message broker

### 🔐 Authentication & Authorization
- **Role-Based Access Control (RBAC)**: Fine-grained permission management
- **JWT Authentication**: Secure token-based authentication
- **OIDC/SSO Support**: Integration with identity providers (Keycloak, Azure AD, Okta)
- **User Management**: Create, manage, and assign roles to users
- **Permission System**: Control access to features based on user roles

### 📋 Configuration Management
- **Template System**: Jinja2-based configuration templates
- **Git Integration**: Version control for configurations and templates
- **Configuration Comparison**: Side-by-side diff views
- **File History**: Track changes over time with Git history

---

## 🏗️ Architecture

Cockpit-NG uses a modern microservices architecture with the following components:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Environment                        │
├─────────────────┬─────────────────┬─────────────────────────────┤
│                 │                 │                             │
│  ┌───────────┐  │  ┌───────────┐  │  ┌───────────┐             │
│  │  Next.js  │  │  │  FastAPI  │  │  │  Celery   │             │
│  │ Frontend  │◄─┼─►│  Backend  │◄─┼─►│  Worker   │             │
│  │  :3000    │  │  │   :8000   │  │  │           │             │
│  └───────────┘  │  └─────┬─────┘  │  └─────┬─────┘             │
│                 │        │        │        │                    │
│                 │        ▼        │        ▼                    │
│                 │  ┌───────────┐  │  ┌───────────┐             │
│                 │  │PostgreSQL │  │  │   Redis   │             │
│                 │  │  Database │  │  │  Broker   │             │
│                 │  └───────────┘  │  └───────────┘             │
│                 │                 │        ▲                    │
│                 │                 │        │                    │
│                 │                 │  ┌─────┴─────┐             │
│                 │                 │  │  Celery   │             │
│                 │                 │  │   Beat    │             │
│                 │                 │  │(Scheduler)│             │
│                 │                 │  └───────────┘             │
└─────────────────┴─────────────────┴─────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │    External Services    │
              ├─────────────────────────┤
              │  • Nautobot (DCIM/IPAM) │
              │  • CheckMK (Monitoring) │
              │  • Network Devices (SSH)│
              │  • Git Repositories     │
              │  • OIDC Providers       │
              └─────────────────────────┘
```

### Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Next.js 15, React 19, TypeScript | Modern web UI with Tailwind CSS |
| **Backend** | FastAPI, Python 3.11+ | REST API, authentication, business logic |
| **Worker** | Celery | Background task execution |
| **Scheduler** | Celery Beat | Periodic task scheduling |
| **Database** | PostgreSQL | Persistent data storage |
| **Message Broker** | Redis | Task queue and caching |

---

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/nerdfunk-net/cockpit-ng.git
cd cockpit-ng

# Copy and configure environment
cp docker/.env.example docker/.env
# Edit docker/.env with your settings

# Start the application
cd docker
docker compose up -d
```

### Access the Application

- **Web Interface**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs

### Default Credentials

- **Username**: `admin`
- **Password**: `admin`

> ⚠️ **Important**: Change the default password immediately after first login!

For detailed installation instructions, see [INSTALL.md](INSTALL.md).

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [INSTALL.md](INSTALL.md) | Detailed installation guide |
| [OIDC_SETUP.md](OIDC_SETUP.md) | OIDC/SSO configuration |
| [PERMISSIONS.md](PERMISSIONS.md) | RBAC and permission system |
| [docker/README.md](docker/README.md) | Docker deployment options |

---

## 🔧 Configuration

### Nautobot Connection

Configure your Nautobot instance in `docker/.env`:

```bash
NAUTOBOT_URL=https://nautobot.example.com
NAUTOBOT_TOKEN=your_nautobot_api_token
```

### CheckMK Connection

Configure CheckMK in `config/checkmk.yaml`:

```yaml
checkmk:
  url: https://checkmk.example.com/mysite
  username: automation
  password: your_automation_secret
```

### OIDC/SSO

Configure identity providers in `config/oidc_providers.yaml`. See [OIDC_SETUP.md](OIDC_SETUP.md) for details.

---

## 🛠️ Development

### Local Development Setup

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python start.py

# Frontend (new terminal)
cd frontend
npm install
npm run dev

# Celery Worker (new terminal)
cd backend
python start_celery.py

# Celery Beat (new terminal)
cd backend
python start_beat.py
```

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend linting
cd frontend
npm run lint
```

---

## 📝 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/nerdfunk-net/cockpit-ng/issues)
- **Documentation**: See the `doc/` directory for additional documentation
