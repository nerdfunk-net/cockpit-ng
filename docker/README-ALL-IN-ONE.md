# Cockpit-NG All-in-One Air-Gap Deployment

This guide explains how to deploy Cockpit-NG in an air-gapped environment using a single, completely self-contained Docker image.

## 🌟 Overview

The all-in-one approach creates a single Docker image that contains:
- ✅ Complete React/TypeScript frontend (built and optimized)
- ✅ FastAPI backend with all Python dependencies
- ✅ All system dependencies (Node.js, npm, git, supervisor, etc.)
- ✅ No external network dependencies during runtime
- ✅ Production-ready configuration with health checks

## 📋 Prerequisites

### Online Environment (Preparation)
- Docker installed
- Internet access
- Git repository cloned

### Air-Gapped Environment (Deployment)
- Docker installed
- No internet access required

## 🚀 Phase 1: Preparation (Internet-Connected Machine)

### Build the All-in-One Image

```bash
cd /path/to/cockpit-ng
./docker/prepare-all-in-one.sh
```

This script will:
1. 🏗️ Build a multi-stage Docker image
2. 📦 Include all dependencies (Python wheels, Node modules, system packages)
3. 🗜️ Compress the image for transfer
4. 📊 Show image size and details

### Output Files

The script creates:
- `docker/airgap-artifacts/cockpit-ng-all-in-one.tar.gz` (compressed image, ~800MB)
- `docker/airgap-artifacts/cockpit-ng-all-in-one.tar` (uncompressed, after gunzip)

## 🔒 Phase 2: Air-Gap Deployment

### Transfer and Deploy

1. **Transfer the image file** to your air-gapped environment:
   ```bash
   # Copy cockpit-ng-all-in-one.tar.gz to air-gapped machine
   ```

2. **Deploy the application**:
   ```bash
   ./docker/deploy-all-in-one.sh
   ```

3. **Validate the deployment**:
   ```bash
   ./docker/validate-all-in-one.sh
   ```

### Manual Deployment Commands

If you prefer manual deployment:

```bash
# Load the image
gunzip docker/airgap-artifacts/cockpit-ng-all-in-one.tar.gz
docker load -i docker/airgap-artifacts/cockpit-ng-all-in-one.tar

# Run the container
docker run -d \
  --name cockpit-ng \
  --restart unless-stopped \
  -p 3000:3000 \
  -p 8000:8000 \
  -v cockpit-data:/app/data \
  cockpit-ng:all-in-one
```

## 🌐 Access the Application

After deployment:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Health Check**: http://localhost:8000/health

## 📁 File Structure

```
docker/
├── Dockerfile.all-in-one          # Complete self-contained image
├── prepare-all-in-one.sh          # Build script (run online)
├── deploy-all-in-one.sh           # Deploy script (run offline)
├── validate-all-in-one.sh         # Validation script
├── supervisord.conf               # Process management
├── start.sh                       # Container startup
└── airgap-artifacts/
    └── cockpit-ng-all-in-one.tar.gz   # Transfer file
```

## 🔧 Container Management

### Common Commands

```bash
# View container status
docker ps

# View logs
docker logs cockpit-ng
docker logs -f cockpit-ng  # Follow logs

# Enter container shell
docker exec -it cockpit-ng /bin/bash

# Restart services
docker restart cockpit-ng

# Stop/start container
docker stop cockpit-ng
docker start cockpit-ng

# Remove container (data preserved in volume)
docker rm cockpit-ng
```

### Data Management

```bash
# Backup data volume
docker run --rm \
  -v cockpit-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/cockpit-backup.tar.gz /data

# Restore data volume
docker run --rm \
  -v cockpit-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/cockpit-backup.tar.gz -C /

# View data volume contents
docker run --rm \
  -v cockpit-data:/data \
  alpine ls -la /data
```

## 🏥 Health Checks and Monitoring

### Built-in Health Check

The container includes automatic health checks:
- ✅ Frontend accessibility (port 3000)
- ✅ Backend API health endpoint (port 8000)
- ✅ 30-second intervals with 60-second startup grace period

### Manual Health Verification

```bash
# Check health endpoint
curl http://localhost:8000/health

# Check frontend
curl http://localhost:3000

# View health status
docker inspect cockpit-ng | grep -A 5 "Health"
```

## 🔍 Troubleshooting

### Container Won't Start

```bash
# Check container logs
docker logs cockpit-ng

# Check if ports are in use
netstat -tulpn | grep -E ':(3000|8000)'

# Check available disk space
df -h

# Check image exists
docker images | grep cockpit-ng
```

### Services Not Responding

```bash
# Check internal connectivity
docker exec cockpit-ng curl localhost:3000
docker exec cockpit-ng curl localhost:8000/health

# Check supervisor status
docker exec cockpit-ng supervisorctl status

# Restart services within container
docker exec cockpit-ng supervisorctl restart all
```

### Performance Issues

```bash
# Check resource usage
docker stats cockpit-ng

# Check container processes
docker exec cockpit-ng ps aux

# Check disk usage
docker exec cockpit-ng df -h
```

## 🔐 Security Features

- 🛡️ **Complete isolation**: No network dependencies during runtime
- 🔒 **Minimal attack surface**: Only required ports exposed
- 📝 **Audit trail**: All components built from source
- 🏠 **Local data**: All data stored in isolated Docker volume
- 🚫 **No external calls**: No internet requests after deployment

## 📈 Performance Characteristics

- **Image size**: ~800MB compressed, ~2GB uncompressed
- **Memory usage**: ~300-500MB at runtime
- **CPU usage**: Low during normal operation
- **Startup time**: 30-60 seconds for full initialization
- **Port requirements**: 3000 (frontend), 8000 (backend)

## 🆚 Comparison with Other Approaches

| Feature | All-in-One | Separate Components |
|---------|-------------|-------------------|
| Transfer files | 1 file | Multiple files |
| Deployment complexity | Simple | Complex |
| Update flexibility | Replace entire image | Update components |
| Storage efficiency | Good | Better |
| Deployment speed | Fast | Slower |

## 📚 Advanced Configuration

### Custom Environment Variables

```bash
docker run -d \
  --name cockpit-ng \
  -p 3000:3000 -p 8000:8000 \
  -v cockpit-data:/app/data \
  -e CUSTOM_VAR=value \
  cockpit-ng:all-in-one
```

### Custom Volumes

```bash
# Mount specific directories
docker run -d \
  --name cockpit-ng \
  -p 3000:3000 -p 8000:8000 \
  -v /host/data:/app/data \
  -v /host/logs:/var/log/supervisor \
  cockpit-ng:all-in-one
```

### Network Configuration

```bash
# Use custom network
docker network create cockpit-net
docker run -d \
  --name cockpit-ng \
  --network cockpit-net \
  -p 3000:3000 -p 8000:8000 \
  -v cockpit-data:/app/data \
  cockpit-ng:all-in-one
```

## ✅ Validation Checklist

After deployment, verify:
- [ ] Container is running: `docker ps | grep cockpit-ng`
- [ ] Frontend accessible: `curl http://localhost:3000`
- [ ] Backend healthy: `curl http://localhost:8000/health`
- [ ] Data volume created: `docker volume ls | grep cockpit-data`
- [ ] Logs available: `docker logs cockpit-ng`
- [ ] Health check passing: `docker inspect cockpit-ng | grep Health`

## 🎯 Success Criteria

Your deployment is successful when:
1. ✅ Container starts and stays running
2. ✅ Frontend loads in browser at http://localhost:3000
3. ✅ Backend API responds at http://localhost:8000
4. ✅ Health checks are passing
5. ✅ No error messages in logs
6. ✅ Data persists across container restarts

---

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Run the validation script: `./docker/validate-all-in-one.sh`
3. Review container logs: `docker logs cockpit-ng`
4. Check the main project documentation
