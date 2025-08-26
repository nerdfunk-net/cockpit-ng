# Air-Gap Deployment Guide for Cockpit-NG

This guide explains how to deploy Cockpit-NG in an air-gapped environment without internet access.

## 🚀 Quick Start: All-in-One Approach (Recommended)

For the simplest air-gap deployment, use the all-in-one approach:

**Online (Preparation):**
```bash
./docker/prepare-all-in-one.sh
# Transfer docker/airgap-artifacts/cockpit-ng-all-in-one.tar.gz
```

**Air-Gapped (Deployment):**
```bash
./docker/deploy-all-in-one.sh
```

📖 **[Complete All-in-One Guide →](README-ALL-IN-ONE.md)**

## 📋 Deployment Approaches

| Approach | Files to Transfer | Complexity | Use Case |
|----------|------------------|------------|----------|
| **All-in-One** | 1 image file (~800MB) | Simple | Most scenarios |
| **Modular** | Base image + app bundle | Complex | Custom base images |

---

## 🔧 Modular Approach (Advanced)

If you need more control over the base image or want to reuse components:

---

## 🔧 Modular Approach (Advanced)

If you need more control over the base image or want to reuse components:

### Phase 1: Preparation (Internet-Connected Machine)

### Prerequisites
- Docker installed
- Node.js and npm installed
- Python 3.12+ installed
- Git repository cloned

### Steps

1. **Run the preparation script:**
   ```bash
   cd /path/to/cockpit-ng
   ./docker/prepare-airgap.sh
   ```

   This script will:
   - Build a base Docker image with all system dependencies
   - Create a Python wheelhouse with all required packages
   - Build the frontend application
   - Package everything for transfer

2. **Artifacts created:**
   - `docker/airgap-artifacts/cockpit-base.tar` - Base Docker image (≈500MB)
   - `docker/airgap-artifacts/cockpit-ng-airgap.tar.gz` - Application package (≈200MB)

3. **Transfer artifacts to air-gapped environment:**
   - Copy both files to the air-gapped machine via USB, secure transfer, etc.

### Phase 2: Deployment (Air-Gapped Environment)

### Prerequisites
- Docker installed (no internet required)
- Transferred artifact files

### Steps

1. **Place artifacts in the correct location:**
   ```bash
   mkdir -p cockpit-ng/docker/airgap-artifacts
   # Copy the transferred files to this directory
   ```

2. **Run the deployment script:**
   ```bash
   cd cockpit-ng
   ./docker/deploy-airgap.sh
   ```

   This script will:
   - Load the base Docker image
   - Extract the application package
   - Build the final Cockpit-NG image

3. **Run the application:**
   ```bash
   docker run -d --name cockpit-ng \
     -p 3000:3000 \
     -p 8000:8000 \
     -v cockpit-data:/app/data \
     cockpit-ng:airgap
   ```

## Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

## File Structure

```
docker/
├── Dockerfile.base         # Base image with system dependencies
├── Dockerfile.airgap       # Air-gap deployment Dockerfile
├── prepare-airgap.sh       # Preparation script (run online)
├── deploy-airgap.sh        # Deployment script (run offline)
├── supervisord.conf        # Supervisor configuration
├── start.sh               # Container startup script
├── wheelhouse/            # Python packages (created by script)
├── frontend-build/        # Built frontend (created by script)
└── airgap-artifacts/      # Transfer files (created by script)
    ├── cockpit-base.tar
    └── cockpit-ng-airgap.tar.gz
```

## Key Features

- **No internet required** during deployment or runtime
- **All dependencies included** in the artifacts
- **Complete isolation** from external networks
- **Production-ready** with proper logging and process management
- **Persistent data** via Docker volumes

## Troubleshooting

### Common Issues

1. **Base image not found:**
   - Ensure `cockpit-base.tar` was loaded: `docker images | grep cockpit-base`

2. **Build fails with missing dependencies:**
   - Re-run preparation script to ensure all wheels are included

3. **Frontend not accessible:**
   - Check that port 3000 is not blocked by firewall
   - Verify container is running: `docker ps`

4. **Backend API errors:**
   - Check logs: `docker logs cockpit-ng`
   - Verify data volume is mounted correctly

### Manual Verification

```bash
# Check loaded images
docker images

# Check running containers
docker ps

# View logs
docker logs cockpit-ng

# Enter container for debugging
docker exec -it cockpit-ng /bin/bash
```

## Security Considerations

- All artifacts are self-contained and signed
- No external network requests during runtime
- Data persisted in isolated Docker volumes
- Process isolation via supervisor and containers

## Proxy / Corporate Network

If you build the all-in-one image from behind a corporate proxy you can pass your
shell's proxy variables into the build. The Dockerfile supports the build args:
`HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` and configures apt/npm/pip to use
them during the build stages. To avoid baking secrets into the final image prefer
to pass runtime proxy variables to `docker run` instead of setting them as
ENV in the final image.

Example build (on the machine with internet access):
```bash
export HTTP_PROXY="http://proxy.example.local:3128"
export HTTPS_PROXY="http://proxy.example.local:3128"
export NO_PROXY="localhost,127.0.0.1,.mydomain.local"

docker build \
   --build-arg HTTP_PROXY="$HTTP_PROXY" \
   --build-arg HTTPS_PROXY="$HTTPS_PROXY" \
   --build-arg NO_PROXY="$NO_PROXY" \
   -t cockpit-ng:all-in-one \
   -f docker/Dockerfile.all-in-one .
```

Example runtime (avoid embedding credentials into image):
```bash
docker run -d \
   -e HTTP_PROXY="$HTTP_PROXY" \
   -e HTTPS_PROXY="$HTTPS_PROXY" \
   -e NO_PROXY="$NO_PROXY" \
   -p 3000:3000 -p 8000:8000 \
   --name cockpit-ng cockpit-ng:all-in-one
```
