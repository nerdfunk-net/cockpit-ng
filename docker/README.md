# Cockpit-NG Docker Deployment Guide

This directory contains all Docker-related files for building and deploying Cockpit-NG. We support two deployment approaches: **Basic** (with internet access) and **All-in-One** (for air-gapped environments).

## 📁 Essential Files

### Main Docker Files
- **`Dockerfile.basic`** - Development build (requires internet)
- **`Dockerfile.all-in-one`** - Production air-gap build (self-contained)
- **`docker-compose.yml`** - Development environment setup

### Core Scripts
- **`prepare-all-in-one.sh`** - Build air-gap production image
- **`validate-all-in-one.sh`** - Test air-gap deployment
- **`test-docker-deployment.sh`** - General deployment health check

### Documentation
- **`README-ALL-IN-ONE.md`** - Complete air-gap deployment guide
- **`DOCKER.md`** - General Docker troubleshooting

## 🚀 Quick Start

### Development Environment
```bash
# From project root
./docker-run.sh up

# Or from docker directory
cd docker
docker compose up -d
```

### Air-Gap Production Deployment
```bash
# From project root
./docker-run.sh all-in-one

# Or from docker directory
cd docker
./prepare-all-in-one.sh
```

## 🎯 Deployment Approaches

### 1. **Basic Development** (Internet Required)
- **Use Case**: Local development and testing with internet access
- **File**: `Dockerfile.basic` 
- **Config**: `docker-compose.yml`
- **Command**: `docker compose up -d` or `./docker-run.sh up`
- **Features**: Fast builds, development tools, hot reload, requires internet

### 2. **All-in-One Air-Gap** (Production Ready)
- **Use Case**: Air-gapped production environments without internet access
- **File**: `Dockerfile.all-in-one`
- **Script**: `prepare-all-in-one.sh`
- **Command**: `./prepare-all-in-one.sh` or `./docker-run.sh all-in-one`
- **Features**: Complete self-contained image, proxy support, minimal transfer, no internet required

## 🌐 Proxy Support

All build scripts automatically detect and use proxy environment variables:
```bash
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
export NO_PROXY=localhost,127.0.0.1,.local

./prepare-all-in-one.sh  # Automatically uses proxy settings
```

## 🔍 Validation and Testing

```bash
# Test air-gap deployment after build
./validate-all-in-one.sh

# General deployment health check  
./test-docker-deployment.sh

# Development environment logs
docker compose logs
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the docker directory to customize your deployment:

```bash
cd docker
cp .env.example .env
nano .env  # Edit as needed
```

**Key Configuration Options:**

- **`FRONTEND_PORT`** - Frontend web server port (default: `3000`)
- **`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`** - Database credentials
- **`COCKPIT_REDIS_PASSWORD`** - Redis authentication
- **`SECRET_KEY`** - JWT signing key (⚠️ **Change in production!**)
- **`NAUTOBOT_URL`, `NAUTOBOT_TOKEN`** - Nautobot integration
- **`LOG_LEVEL`** - Logging verbosity (DEBUG, INFO, WARNING, ERROR)

**Port Configuration:**

The frontend port is fully configurable:
```env
FRONTEND_PORT=3000  # Change to any available port (e.g., 8080, 5000)
```

The backend port is fixed at `8000` inside the container. To change the host port mapping, edit `docker-compose.yml`:
```yaml
ports:
  - "8080:8000"  # Map host port 8080 to container port 8000
```

**Without .env File:**

The docker-compose configuration will work without a `.env` file using default values. However, ⚠️ **you should change the `SECRET_KEY` in production!**

### OIDC/SSO Authentication
Cockpit-NG supports OpenID Connect (OIDC) for Single Sign-On. The configuration is managed through YAML files:

1. **Setup OIDC Configuration**:
   ```bash
   # Create or edit the OIDC providers config
   cd docker
   mkdir -p config
   cp ../config/oidc_providers.yaml.example config/oidc_providers.yaml
   # Edit config/oidc_providers.yaml with your provider details
   ```

2. **Volume Mounting**: The `docker-compose.yml` automatically mounts `./docker/config/` to `/app/config/` inside the container, allowing you to:
   - Edit `oidc_providers.yaml` on the host
   - Changes take effect after container restart
   - No need to rebuild the image

3. **Configuration Files**:
   - `oidc_providers.yaml` - OIDC/SSO provider configuration
   - `checkmk.yaml` - Check_MK integration settings
   - `snmp_mapping.yaml` - SNMP mapping configuration

4. **Apply Changes**:
   ```bash
   docker compose restart
   ```

For detailed OIDC setup instructions, see `../OIDC_SETUP.md` in the project root.

## 📋 Troubleshooting

1. **Build Issues**: Check `DOCKER.md` for common problems
2. **Air-Gap Issues**: See `README-ALL-IN-ONE.md` troubleshooting section
3. **Development Issues**: Use `docker compose logs` for debugging

## 🆘 Quick Reference

```bash
# Development (requires internet)
./docker-run.sh up

# Production air-gap build
./docker-run.sh all-in-one

# Stop containers
./docker-run.sh down

# View logs
./docker-run.sh logs
```

For detailed instructions, see the specific README files for your deployment method.