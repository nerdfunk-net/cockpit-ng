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
│ • Auth System   │    │ • Auth Service  │    │ • Git Repos     │
│ • Settings UI   │    │ • Git Manager   │    │ • LDAP/AD       │
│ • Device Mgmt   │    │ • Cache Layer   │    │ • SSH Devices   │
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

### **Settings & Configuration**
- Nautobot integration settings
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
GET /api/git-repositories
Authorization: Bearer <token>

# Sync repository
POST /api/git-repositories/{id}/sync
Authorization: Bearer <token>
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Session Management**: Automatic session renewal with activity tracking
- **Credential Protection**: Encrypted credential storage
- **SSL/TLS Support**: HTTPS endpoints for secure communication
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

### **Ansible Integration**
- Dynamic inventory generation
- Playbook execution
- Variable management
- Task automation

## 📚 Documentation

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

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🌟 Contributing

Cockpit-NG is a hobby project focused on modern web development practices and Apple-inspired design. Contributions are welcome!

---

**Built with ❤️ for the network engineering community**
