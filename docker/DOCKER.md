# Cockpit-NG Docker Setup

This repository provides a complete Docker setup for running Cockpit-NG, including both the backend (FastAPI) and frontend (Next.js) in a single container.

## ✅ Deployment Status

**TESTED AND VERIFIED**: The Docker deployment has been successfully tested and validated with:
- ✅ Container builds successfully  
- ✅ Both frontend (port 3000) and backend (port 8000) services start correctly
- ✅ Health check endpoints functioning
- ✅ Frontend-to-backend communication working via proxy  
- ✅ Docker health checks passing
- ✅ Volume persistence for data storage
- ✅ API documentation accessible

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd cockpit-ng
   ```

2. **Create environment configuration:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual configuration values
   ```

3. **Start the application:**
   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API (via proxy): http://localhost:3000/api/proxy/docs  
   - Direct Backend API: http://localhost:8000 (internal container access)
   - API Documentation: http://localhost:3000/api/proxy/docs

5. **Verify deployment:**
   ```bash
   ./test-docker-deployment.sh
   ```

## Health Monitoring

The application includes comprehensive health check endpoints:

- Frontend health: `http://localhost:3000/api/health`
- Backend health (via proxy): `http://localhost:3000/api/proxy/health`
- Docker health check: Automatically monitors both services

## Configuration

### Environment Variables

Edit the `.env` file with your configuration:

```bash
# Nautobot Configuration
NAUTOBOT_URL=http://your-nautobot-instance:8080
NAUTOBOT_TOKEN=your_nautobot_api_token_here
NAUTOBOT_TIMEOUT=30

# Security
SECRET_KEY=your-super-secret-key-change-this-in-production

# Logging
LOG_LEVEL=INFO
```

### Persistent Data

The application data is stored in a Docker volume `cockpit_data` which includes:
- Database files (SQLite)
- Git repositories
- Cache files
- Uploaded templates

## Development

### Building the Image

```bash
# Build the image
docker-compose build

# Force rebuild without cache
docker-compose build --no-cache
```

### Viewing Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f cockpit-ng

# View backend logs only
docker-compose exec cockpit-ng tail -f /var/log/supervisor/backend.out.log

# View frontend logs only
docker-compose exec cockpit-ng tail -f /var/log/supervisor/frontend.out.log
```

### Debugging

```bash
# Access the container shell
docker-compose exec cockpit-ng bash

# Check service status
docker-compose exec cockpit-ng supervisorctl status

# Restart individual services
docker-compose exec cockpit-ng supervisorctl restart backend
docker-compose exec cockpit-ng supervisorctl restart frontend
```

## Architecture

The Docker setup uses:

1. **Multi-stage build:** Frontend is built in a Node.js container, then copied to the final Python container
2. **Supervisor:** Manages both backend and frontend processes in the same container
3. **Health checks:** Both services expose health endpoints for monitoring
4. **Volume persistence:** Data is persisted across container restarts

### Container Structure

```
/app/
├── backend/           # FastAPI backend application
├── frontend/          # Next.js frontend application (built)
├── data/              # Persistent data (mounted volume)
│   ├── settings/      # Database files
│   ├── git/           # Git repositories
│   └── cache/         # Cache files
└── docker/            # Container configuration
    ├── supervisord.conf
    └── start.sh
```

## Production Deployment

### Security Considerations

1. **Change default secrets:**
   ```bash
   # Generate a secure secret key
   SECRET_KEY=$(openssl rand -hex 32)
   ```

2. **Use environment-specific configuration:**
   ```bash
   # Use production environment file
   cp .env.production .env
   ```

3. **Configure reverse proxy (recommended):**
   ```nginx
   # Nginx configuration example
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
       
       location /api/ {
           proxy_pass http://localhost:8000/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### Monitoring

Health check endpoints:
- Frontend: `GET http://localhost:3000/api/health`
- Backend: `GET http://localhost:8000/health`

### Backup

```bash
# Backup persistent data
docker run --rm -v cockpit_data:/data -v $(pwd):/backup ubuntu tar czf /backup/cockpit-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore from backup
docker run --rm -v cockpit_data:/data -v $(pwd):/backup ubuntu tar xzf /backup/cockpit-backup-YYYYMMDD.tar.gz -C /data
```

## Troubleshooting

### Common Issues

1. **Port conflicts:**
   ```bash
   # Check what's using the ports
   lsof -i :3000
   lsof -i :8000
   
   # Modify docker-compose.yml to use different ports
   ports:
     - "3001:3000"  # Use port 3001 instead
     - "8001:8000"  # Use port 8001 instead
   ```

2. **Permission issues:**
   ```bash
   # Fix data directory permissions
   docker-compose exec cockpit-ng chown -R root:root /app/data
   ```

3. **Service not starting:**
   ```bash
   # Check supervisor status
   docker-compose exec cockpit-ng supervisorctl status
   
   # Check individual service logs
   docker-compose exec cockpit-ng cat /var/log/supervisor/backend.err.log
   docker-compose exec cockpit-ng cat /var/log/supervisor/frontend.err.log
   ```

### Getting Help

1. Check the logs for error messages
2. Verify your environment configuration
3. Ensure all required external services (Nautobot) are accessible
4. Check the health endpoints for service status

## Docker Commands Reference

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View status
docker-compose ps

# Update and restart
docker-compose pull && docker-compose up -d

# Remove everything (including volumes)
docker-compose down -v --rmi all
```
