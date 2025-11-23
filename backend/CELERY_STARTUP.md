# Celery Startup Scripts

This directory contains convenient startup scripts for running Celery worker and Beat scheduler.

## Quick Start

### Start Celery Worker

```bash
cd backend
python start_celery.py
```

This is equivalent to:
```bash
celery -A celery_worker worker --loglevel=info --concurrency=4
```

### Start Celery Beat Scheduler

```bash
cd backend
python start_beat.py
```

This is equivalent to:
```bash
celery -A celery_beat beat --loglevel=info
```

## Prerequisites

1. **Redis must be running**:
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:latest

   # Or using system Redis
   redis-server
   ```

2. **Install dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Configure environment** (optional):
   ```bash
   # Create .env file in backend directory
   REDIS_URL=redis://localhost:6379/0
   CELERY_MAX_WORKERS=4
   ```

## Running All Services

For development, you need 4 terminal windows:

### Terminal 1: Redis
```bash
redis-server
```

### Terminal 2: Celery Worker
```bash
cd backend
python start_celery.py
```

### Terminal 3: Celery Beat
```bash
cd backend
python start_beat.py
```

### Terminal 4: FastAPI Application
```bash
cd backend
python start.py
```

### Terminal 5: Flower (Optional - Monitoring UI)
```bash
cd backend
celery -A celery_worker flower --port=5555
# Access at http://localhost:5555
```

## Using Docker Compose

Alternatively, use Docker Compose to run all services:

```bash
# From project root
docker-compose up -d

# View logs
docker-compose logs -f celery-worker
docker-compose logs -f celery-beat

# Stop all services
docker-compose down
```

## Script Features

### start_celery.py
- Automatically sets Python path
- Imports all tasks from tasks/ directory
- Configures worker concurrency from settings
- Shows startup configuration
- Handles graceful shutdown (Ctrl+C)

### start_beat.py
- Automatically sets Python path
- Loads beat schedule from beat_schedule.py
- Uses RedBeat (Redis-based scheduler)
- Shows number of scheduled tasks
- Warns about running only ONE Beat instance
- Handles graceful shutdown (Ctrl+C)

## Configuration

Settings are loaded from:
1. Environment variables (.env file in backend/)
2. Default values in config.py

Key settings:
- `REDIS_URL` - Redis connection URL (default: redis://localhost:6379/0)
- `CELERY_BROKER_URL` - Celery broker (default: same as REDIS_URL)
- `CELERY_RESULT_BACKEND` - Result backend (default: same as REDIS_URL)
- `CELERY_MAX_WORKERS` - Worker concurrency (default: 4)

## Monitoring

### Using Flower Web UI
```bash
celery -A celery_worker flower --port=5555
```
Access at: http://localhost:5555

### Using API
```bash
# Check Celery status
curl http://localhost:8000/api/celery/status

# List workers
curl http://localhost:8000/api/celery/workers

# List schedules
curl http://localhost:8000/api/celery/schedules

# Check Beat status
curl http://localhost:8000/api/celery/beat/status
```

### Using Frontend
Navigate to: http://localhost:3000/settings/celery

## Troubleshooting

### Worker not starting
- Check Redis is running: `redis-cli ping`
- Check dependencies: `pip install -r requirements.txt`
- Check Python path includes backend directory

### Beat scheduler not starting
- Ensure only ONE Beat instance is running
- Check Redis connection
- Verify beat_schedule.py is present

### Tasks not executing
- Ensure worker is running
- Check worker logs for errors
- Verify task is registered: `celery -A celery_worker inspect registered`

### Redis connection errors
- Verify Redis is running: `redis-cli ping`
- Check REDIS_URL in .env matches Redis location
- For Docker: use `redis://redis:6379/0` (service name)
- For local: use `redis://localhost:6379/0`

## Production Deployment

For production, use systemd services instead of these scripts.
See `/doc/CELERY_ARCHITECTURE.md` for systemd service configurations.

## See Also

- [CELERY_ARCHITECTURE.md](../doc/CELERY_ARCHITECTURE.md) - Complete architecture documentation
- [beat_schedule.py](beat_schedule.py) - Periodic task schedule configuration
- [tasks/](tasks/) - Task definitions
