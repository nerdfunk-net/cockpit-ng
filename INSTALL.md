# Cockpit-NG Installation Guide

This guide covers how to install and deploy Cockpit-NG using Docker.

---

## 📋 Prerequisites

### Required Software
- **Docker** (version 20.10 or later)
- **Docker Compose** (version 2.0 or later)
- **Git**

### Hardware Requirements
- **Minimum**: 2 CPU cores, 4 GB RAM, 20 GB disk space
- **Recommended**: 4 CPU cores, 8 GB RAM, 50 GB disk space

### Network Requirements
- Access to Nautobot instance (API)
- Access to CheckMK instance (API) - optional
- Outbound internet access for Docker image pulls (or pre-pulled images for air-gapped environments)

---

## 🏗️ Architecture Overview

Cockpit-NG runs as a multi-container Docker environment:

| Container | Service | Purpose |
|-----------|---------|---------|
| `cockpit-web` | Frontend + Backend API | Web interface (Next.js) and REST API (FastAPI) |
| `cockpit-worker` | Celery Worker | Background task execution |
| `cockpit-beat` | Celery Beat | Periodic task scheduler |
| `postgres` | PostgreSQL | Database for persistent storage |
| `redis` | Redis | Message broker and caching |

```
                    ┌─────────────────┐
                    │   Web Browser   │
                    └────────┬────────┘
                             │ :3000
                    ┌────────▼────────┐
                    │   cockpit-web   │
                    │  (Frontend +    │
                    │   Backend API)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────────┐  ┌──▼───┐  ┌───────▼───────┐
     │ cockpit-worker  │  │redis │  │   postgres    │
     │ (Celery Worker) │  └──────┘  │  (Database)   │
     └────────┬────────┘            └───────────────┘
              │
     ┌────────▼────────┐
     │  cockpit-beat   │
     │ (Task Scheduler)│
     └─────────────────┘
```

---

## 🚀 Installation Steps

### Step 1: Clone the Repository

```bash
git clone https://github.com/nerdfunk-net/cockpit-ng.git
cd cockpit-ng
```

### Step 2: Configure Environment Variables

Copy the example environment file and edit it:

```bash
cp docker/.env.example docker/.env
```

Edit `docker/.env` with your settings:

```bash
# ============================================
# Cockpit-NG Docker Environment Configuration
# ============================================

# Database Configuration
POSTGRES_DB=cockpit
POSTGRES_USER=cockpit
POSTGRES_PASSWORD=your_secure_password_here

# Redis Configuration
COCKPIT_REDIS_PASSWORD=your_redis_password_here

# Application Security
SECRET_KEY=your-secret-key-change-this-in-production

# Nautobot Integration
NAUTOBOT_URL=https://nautobot.example.com
NAUTOBOT_TOKEN=your_nautobot_api_token
NAUTOBOT_TIMEOUT=30

# Frontend Configuration
FRONTEND_PORT=3000

# Logging
LOG_LEVEL=INFO
```

> ⚠️ **Important**: Change all default passwords and the `SECRET_KEY` for production deployments!

### Step 3: Configure External Services

#### Nautobot Configuration

The Nautobot URL and token are configured in the `.env` file (see above).

#### CheckMK Configuration (Optional)

Create or edit `config/checkmk.yaml`:

```yaml
checkmk:
  url: https://checkmk.example.com/mysite
  username: automation
  password: your_automation_secret
  verify_ssl: true
```

#### OIDC/SSO Configuration (Optional)

Create or edit `config/oidc_providers.yaml`:

```yaml
providers:
  keycloak:
    enabled: true
    display_name: "Company SSO"
    issuer: "https://keycloak.example.com/realms/myrealm"
    client_id: "cockpit-ng"
    client_secret: "your-client-secret"
```

See [OIDC_SETUP.md](OIDC_SETUP.md) for detailed OIDC configuration.

### Step 4: Start the Application

Navigate to the docker directory and start all containers:

```bash
cd docker
docker compose up -d
```

This will:
1. Pull all required Docker images
2. Create the Docker network
3. Start PostgreSQL and Redis
4. Start the web application (frontend + backend)
5. Start the Celery worker and beat scheduler

### Step 5: Verify the Installation

Check that all containers are running:

```bash
docker compose ps
```

Expected output:
```
NAME               STATUS         PORTS
cockpit-beat       Up             
cockpit-postgres   Up (healthy)   5432/tcp
cockpit-redis      Up (healthy)   6379/tcp
cockpit-web        Up (healthy)   0.0.0.0:3000->3000/tcp, 0.0.0.0:8000->8000/tcp
cockpit-worker     Up             
```

### Step 6: Access the Application

Open your web browser and navigate to:

- **Web Interface**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs

### Step 7: Initial Login

Use the default credentials to log in:

- **Username**: `admin`
- **Password**: `admin`

> ⚠️ **Important**: Change the default password immediately after first login!

---

## 🔧 Post-Installation Configuration

### Change Admin Password

1. Log in with the default credentials
2. Navigate to **Settings** → **User Management**
3. Click on the admin user
4. Change the password

### Configure SSL/TLS Certificates

If your Nautobot or CheckMK instances use self-signed certificates:

1. Navigate to **Tools** → **Add Certificate**
2. Upload your CA certificate (`.crt` file)
3. Click "Add to System" to install the certificate

For Docker environments, certificates uploaded via the web interface are automatically installed in the Celery worker containers on restart.

### Set Up RBAC Permissions

1. Navigate to **Settings** → **Permissions**
2. Create roles with appropriate permissions
3. Assign roles to users

See [PERMISSIONS.md](PERMISSIONS.md) for detailed RBAC documentation.

---

## 📁 Directory Structure

After installation, the directory structure looks like this:

```
cockpit-ng/
├── docker/
│   ├── docker-compose.yml    # Main Docker Compose file
│   ├── .env                  # Environment configuration (create this)
│   └── .env.example          # Example environment file
├── config/
│   ├── checkmk.yaml          # CheckMK configuration
│   ├── oidc_providers.yaml   # OIDC/SSO configuration
│   ├── snmp_mapping.yaml     # SNMP community mappings
│   └── certs/                # SSL certificates
├── data/                     # Persistent data (auto-created)
│   ├── git/                  # Git repository clones
│   └── ssh_keys/             # SSH keys for device access
├── backend/                  # Backend source code
└── frontend/                 # Frontend source code
```

---

## 🔄 Updating Cockpit-NG

To update to a newer version:

```bash
# Navigate to the project directory
cd cockpit-ng

# Pull the latest changes
git pull

# Rebuild and restart containers
cd docker
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 🛠️ Troubleshooting

### View Container Logs

```bash
# All containers
docker compose logs

# Specific container
docker compose logs cockpit-web
docker compose logs cockpit-worker

# Follow logs in real-time
docker compose logs -f cockpit-web
```

### Restart Services

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart cockpit-worker
```

### Reset the Database

> ⚠️ **Warning**: This will delete all data!

```bash
docker compose down -v
docker compose up -d
```

### Check Service Health

```bash
# Health endpoint
curl http://localhost:8000/health

# Container status
docker compose ps
```

### Common Issues

#### Container fails to start
- Check logs: `docker compose logs <container-name>`
- Verify `.env` file exists and has correct values
- Ensure ports 3000 and 8000 are not in use

#### Cannot connect to Nautobot
- Verify `NAUTOBOT_URL` and `NAUTOBOT_TOKEN` in `.env`
- Check network connectivity from Docker container
- If using self-signed certificates, upload the CA certificate

#### Celery tasks not running
- Check worker logs: `docker compose logs cockpit-worker`
- Verify Redis is running: `docker compose ps redis`
- Restart the worker: `docker compose restart cockpit-worker`

---

## 🌐 Air-Gapped Installation

For environments without internet access, see [docker/README-ALL-IN-ONE.md](docker/README-ALL-IN-ONE.md) for air-gapped deployment instructions.

---

## 📚 Additional Resources

- [README.md](README.md) - Overview and features
- [OIDC_SETUP.md](OIDC_SETUP.md) - OIDC/SSO configuration
- [PERMISSIONS.md](PERMISSIONS.md) - RBAC and permissions
- [docker/README.md](docker/README.md) - Docker deployment options
