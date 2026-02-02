# Celery Queue Configuration

## Overview

Cockpit-NG uses **dynamic queue configuration** that reads queue definitions from the database, allowing administrators to configure queues through the UI without modifying code.

## How It Works

### 1. Database-Driven Configuration

Queue definitions are stored in the `celery_settings` table:

```json
{
  "queues": [
    {"name": "default", "description": "Default queue for general tasks"},
    {"name": "backup", "description": "Queue for device backup operations"},
    {"name": "network", "description": "Queue for network scanning and discovery tasks"},
    {"name": "heavy", "description": "Queue for bulk operations and heavy processing tasks"}
  ]
}
```

### 2. Dynamic Loading on Celery Startup

When Celery workers or Beat start, `celery_app.py` automatically:
1. Reads queue configuration from the database
2. Builds the `task_queues` configuration dynamically
3. Applies the configuration to Celery

```python
# In celery_app.py
def load_queue_configuration():
    """Load queue configuration from database settings."""
    celery_settings = settings_manager.get_celery_settings()
    configured_queues = celery_settings.get('queues', [])

    task_queues = {}
    for queue in configured_queues:
        task_queues[queue['name']] = {
            "exchange": queue['name'],
            "routing_key": queue['name'],
        }

    return task_queues
```

### 3. Task Routing

Tasks are routed to queues using the `task_routes` configuration:

```python
task_routes={
    # Backup tasks → backup queue
    "tasks.backup_single_device_task": {"queue": "backup"},
    "tasks.backup_devices": {"queue": "backup"},

    # Network tasks → network queue
    "tasks.ping_network_task": {"queue": "network"},
    "tasks.scan_prefixes_task": {"queue": "network"},

    # Heavy tasks → heavy queue
    "tasks.bulk_onboard_devices_task": {"queue": "heavy"},
    "tasks.export_devices_task": {"queue": "heavy"},

    # Everything else → default queue
    "*": {"queue": "default"},
}
```

## Default Queues

The system comes pre-configured with four queues:

| Queue | Purpose | Task Examples |
|-------|---------|---------------|
| **default** | General tasks | Device onboarding, compliance checks, misc tasks |
| **backup** | Device backups | Configuration backups, backup finalization |
| **network** | Network operations | Network scanning, ping sweeps, IP discovery |
| **heavy** | Bulk operations | Bulk imports, CSV processing, mass exports |

## Managing Queues

### Via Web UI

1. Navigate to **Settings → Celery → Settings**
2. Scroll to **Queue Configuration** section
3. Click **Add Queue** to create a new queue
4. Edit or delete existing queues (except protected queues)

**Note**: Changes require restarting Celery workers to take effect.

### Via Database

Queues are stored in the `celery_settings.queues` column as JSON:

```sql
-- View current queues
SELECT queues FROM celery_settings;

-- Update queues (example)
UPDATE celery_settings
SET queues = '[
  {"name": "default", "description": "Default queue"},
  {"name": "custom", "description": "Custom processing queue"}
]'::jsonb;
```

## Worker Configuration

### Start Worker Listening to ALL Queues

```bash
# Worker will consume from all configured queues
celery -A celery_worker worker --loglevel=info
```

### Start Worker for Specific Queue

```bash
# Worker only consumes from backup queue
CELERY_WORKER_QUEUE=backup celery -A celery_worker worker --loglevel=info

# Worker only consumes from network queue
CELERY_WORKER_QUEUE=network celery -A celery_worker worker --loglevel=info
```

### Docker/Docker Compose Example

```yaml
services:
  # General worker (all queues)
  worker-general:
    image: cockpit-ng
    command: celery -A celery_worker worker --loglevel=info

  # Backup-specific worker
  worker-backup:
    image: cockpit-ng
    environment:
      - CELERY_WORKER_QUEUE=backup
    command: celery -A celery_worker worker --loglevel=info

  # Network-specific worker
  worker-network:
    image: cockpit-ng
    environment:
      - CELERY_WORKER_QUEUE=network
    command: celery -A celery_worker worker --loglevel=info
```

## Adding Custom Queues

### Step 1: Add Queue via UI
1. Go to **Settings → Celery → Settings**
2. Click **Add Queue**
3. Enter queue name (e.g., `monitoring`)
4. Enter description (e.g., `Queue for monitoring tasks`)
5. Click **Save Settings**

### Step 2: Add Task Routing (Optional)

If you want specific tasks to automatically route to your new queue, edit `celery_app.py`:

```python
task_routes={
    # ... existing routes ...

    # Your custom routes
    "tasks.my_monitoring_task": {"queue": "monitoring"},
}
```

### Step 3: Restart Workers

```bash
# Restart to pick up new queue configuration
docker-compose restart worker
# or
systemctl restart cockpit-celery-worker
```

### Step 4: Start Dedicated Worker (Optional)

```bash
# Start worker for your new queue
CELERY_WORKER_QUEUE=monitoring celery -A celery_worker worker --loglevel=info
```

## Task Assignment Patterns

### Pattern 1: Automatic Routing (Recommended)
Define routing rules in `celery_app.py`:
```python
task_routes={
    "tasks.my_backup_task": {"queue": "backup"},
}
```
Tasks automatically go to the correct queue.

### Pattern 2: Explicit Queue at Task Definition
```python
@celery_app.task(queue='backup')
def my_backup_task():
    pass
```

### Pattern 3: Explicit Queue at Task Call
```python
my_task.apply_async(args=[...], queue='backup')
```

## Monitoring Queues

### View Queue Status

Navigate to **Settings → Celery → Queues** tab to see:
- Pending tasks per queue
- Active tasks per queue
- Workers consuming from each queue
- Task routing configuration

### CLI Inspection

```bash
# View active queues
celery -A celery_worker inspect active_queues

# View stats
celery -A celery_worker inspect stats
```

## Fallback Behavior

If the database is unavailable during Celery startup:
1. System logs a warning
2. Falls back to minimal configuration (default queue only)
3. All tasks route to default queue
4. Workers can still process tasks

```python
# Fallback configuration
{
    "default": {
        "exchange": "default",
        "routing_key": "default",
    }
}
```

## Best Practices

### ✅ DO:
- Use the pre-configured queues (default, backup, network, heavy) for standard tasks
- Create custom queues for specialized workloads
- Restart workers after changing queue configuration
- Use descriptive queue names and descriptions
- Monitor queue depths to identify bottlenecks

### ❌ DON'T:
- Delete the `default` queue (required for unrouted tasks)
- Use special characters in queue names (alphanumeric, dash, underscore only)
- Create too many queues (4-8 queues is usually sufficient)
- Change queue names without updating task routes

## Troubleshooting

### Queue Not Appearing in Celery

**Problem**: Added queue via UI but tasks don't route to it.

**Solution**:
1. Check database: `SELECT queues FROM celery_settings;`
2. Restart Celery workers: `docker-compose restart worker`
3. Check logs for "Loaded queue from database" messages

### Worker Not Consuming from Queue

**Problem**: Worker started with `CELERY_WORKER_QUEUE=backup` but not processing tasks.

**Solution**:
1. Verify queue exists: Check UI or database
2. Restart worker after adding queue
3. Check queue spelling/case sensitivity
4. Verify tasks are actually being routed to that queue

### Tasks Going to Wrong Queue

**Problem**: Tasks end up in default queue instead of intended queue.

**Solution**:
1. Check `task_routes` in `celery_app.py`
2. Verify task name matches routing rule exactly
3. Add explicit routing rule for your task
4. Restart workers to pick up routing changes

## Security Considerations

- Queue configuration requires `settings.celery:write` permission
- Only administrators should modify queue configuration
- Queue names are validated (alphanumeric + dash/underscore only)
- Malicious queue names cannot inject code (names are used as simple strings)

## Migration Notes

When upgrading from hardcoded to dynamic queues:
1. Migration `003_add_celery_queues` adds the `queues` column
2. Existing `celery_settings` records are initialized with default queues
3. No manual intervention required
4. Existing workers will pick up queues on next restart
