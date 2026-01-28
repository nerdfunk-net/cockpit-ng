# Celery Queue Architecture

## Overview

Cockpit-NG uses a multi-queue Celery architecture to enable task isolation, resource management, and specialized worker deployment. This allows running specific types of tasks on dedicated nodes or containers.

## Queue Structure

### 1. **default** Queue
- **Purpose**: General-purpose tasks that don't fit into specialized categories
- **Tasks**:
  - Single device operations
  - Job scheduling and dispatching
  - Periodic maintenance tasks
  - Test tasks
- **Worker**: General worker (`cockpit-worker`)

### 2. **backup** Queue
- **Purpose**: Device configuration backup tasks
- **Tasks**:
  - `tasks.backup_single_device_task`
  - `tasks.finalize_backup_task`
  - `tasks.backup_devices`
- **Worker**: Specialized backup worker (`cockpit-worker-backup`)
- **Characteristics**:
  - SSH/Telnet network operations
  - Git operations
  - Can be resource-intensive with many devices
  - Benefits from dedicated node with network access to devices

### 3. **network** Queue
- **Purpose**: Network scanning and connectivity tasks
- **Tasks**:
  - `tasks.ping_network_task`
  - `tasks.scan_prefixes_task`
  - `tasks.check_ip_task`
- **Worker**: General worker (`cockpit-worker`)
- **Characteristics**:
  - Quick network operations
  - ICMP, TCP/UDP probes
  - Low memory footprint

### 4. **heavy** Queue
- **Purpose**: Bulk operations and data processing
- **Tasks**:
  - `tasks.bulk_onboard_devices_task`
  - `tasks.update_devices_from_csv_task`
  - `tasks.update_ip_prefixes_from_csv_task`
  - `tasks.export_devices_task`
- **Worker**: General worker (`cockpit-worker`)
- **Characteristics**:
  - High memory usage
  - CPU-intensive operations
  - Long-running tasks

## Worker Configuration

All workers use the same startup script (`start_celery.py`) with queue configuration via environment variable.

### General Worker
**Command**: `python start_celery.py`

**Environment**: `CELERY_WORKER_QUEUE` not set (uses default)

**Queues**: `default`, `network`, `heavy`

**Docker Service**: `cockpit-worker`

Handles all tasks except those in the `backup` queue.

### Backup Worker (Specialized)
**Command**: `python start_celery.py`

**Environment**: `CELERY_WORKER_QUEUE=backup`

**Queues**: `backup` (only)

**Docker Service**: `cockpit-worker-backup`

Dedicated to backup operations, can be deployed on a separate node.

## Deployment Scenarios

### 1. All-in-One Deployment (Default)
All workers run on the same host via Docker Compose:
```bash
docker compose up -d
```

Services:
- `cockpit-web`: Frontend + Backend API
- `cockpit-worker`: General tasks (default, network, heavy)
- `cockpit-worker-backup`: Backup tasks only
- `cockpit-beat`: Periodic scheduler
- `postgres`: Database
- `redis`: Message broker

### 2. Dedicated Backup Node
Run the backup worker on a separate host with network access to devices:

**On Backup Node**:
```bash
# Export environment variables
export NAUTOBOT_URL=https://nautobot.example.com
export NAUTOBOT_TOKEN=your_token
export SECRET_KEY=your_secret
export COCKPIT_DATABASE_HOST=main-host
export COCKPIT_REDIS_HOST=main-host
export CELERY_BROKER_URL=redis://:password@main-host:6379/0
export CELERY_RESULT_BACKEND=redis://:password@main-host:6379/0
export CELERY_WORKER_QUEUE=backup

# Run backup worker
cd backend
python start_celery.py
```

**On Main Host**:
- Run all other services
- Optionally disable `cockpit-worker-backup` in docker-compose.yml

### 3. Scaled Deployment
Run multiple instances of specialized workers:

```bash
# Scale backup workers to 3 instances
docker compose up -d --scale cockpit-worker-backup=3

# Scale general workers to 2 instances
docker compose up -d --scale cockpit-worker=2
```

Each worker instance gets a unique hostname (e.g., `backup-worker@host1`, `backup-worker@host2`).

## Configuration

### Task Routing
Defined in `backend/celery_app.py`:

```python
celery_app.conf.update(
    task_routes={
        'tasks.backup_single_device_task': {'queue': 'backup'},
        'tasks.ping_network_task': {'queue': 'network'},
        # ...
    }
)
```

### Adding New Queues

1. **Define queue in `celery_app.py`**:
```python
task_queues={
    'myqueue': {
        'exchange': 'myqueue',
        'routing_key': 'myqueue',
    },
}
```

2. **Route tasks to the queue**:
```python
task_routes={
    'tasks.my_task': {'queue': 'myqueue'},
}
```

3. **Start worker with environment variable**:
```bash
export CELERY_WORKER_QUEUE=myqueue
python start_celery.py
```

Or for multiple queues:
```bash
export CELERY_WORKER_QUEUE=myqueue,anotherqueue
python start_celery.py
```

4. **Add to Docker Compose** (similar to `cockpit-worker-backup`):
```yaml
cockpit-worker-myqueue:
  build:
    context: .
    dockerfile: docker/Dockerfile.worker
  environment:
    - CELERY_WORKER_QUEUE=myqueue
  # ... other config
```

5. **Update general worker** to exclude the new queue if needed (modify default queues in `start_celery.py`).

## Monitoring

### Check Worker Status
```bash
# List active workers
docker exec cockpit-worker celery -A celery_app inspect active_queues

# Check stats
docker exec cockpit-worker celery -A celery_app inspect stats
```

### View Queue Lengths
```bash
# Connect to Redis
docker exec -it cockpit-redis redis-cli -a changeme

# Check queue lengths
> LLEN backup
> LLEN default
> LLEN network
> LLEN heavy
```

### Logs
```bash
# General worker logs
docker logs cockpit-worker -f

# Backup worker logs
docker logs cockpit-worker-backup -f
```

## Benefits of Queue Architecture

1. **Resource Isolation**: Backup tasks don't block quick network scans
2. **Priority Control**: Critical tasks can have dedicated workers
3. **Horizontal Scaling**: Scale specific workers based on workload
4. **Failure Isolation**: If backup worker crashes, other tasks continue
5. **Network Segmentation**: Backup worker can run in restricted network zone
6. **Geographic Distribution**: Run workers close to target devices

## Task Assignment Examples

### Backup Queue (Isolated)
```python
# tasks/backup_tasks.py
@shared_task(name="tasks.backup_single_device_task", queue='backup')
def backup_single_device_task(...):
    # SSH to device, retrieve config, write to Git
    pass
```

### Network Queue (Fast)
```python
# tasks/ping_network_task.py
@shared_task(name="tasks.ping_network_task", queue='network')
def ping_network_task(...):
    # Quick ICMP ping
    pass
```

### Heavy Queue (Resource-Intensive)
```python
# tasks/bulk_onboard_task.py
@shared_task(name="tasks.bulk_onboard_devices_task", queue='heavy')
def bulk_onboard_devices_task(...):
    # Process 1000+ devices, heavy API calls
    pass
```

## Troubleshooting

### Tasks Not Being Processed
1. Check if worker is running: `docker ps | grep worker`
2. Verify worker is consuming from the correct queue: `docker logs cockpit-worker-backup`
3. Check Redis connection: `docker logs cockpit-redis`

### Tasks Going to Wrong Queue
1. Verify task routing in `celery_app.py`
2. Check task name matches exactly
3. Restart workers after config changes

### Worker Hostname Conflicts
Each worker needs a unique hostname. Use `--hostname` parameter:
```bash
--hostname=backup-worker@node1
--hostname=backup-worker@node2
```

## Future Enhancements

Potential additional queues:
- **priority**: High-priority tasks with dedicated fast workers
- **scheduled**: Time-sensitive scheduled tasks
- **compliance**: Compliance checks and reporting
- **sync**: Nautobot-CheckMK synchronization
- **git**: Git operations (clone, pull, push)

Each can be deployed independently based on workload requirements.
