"""
Celery application configuration.
"""

from celery import Celery
from config import settings
import logging

logger = logging.getLogger(__name__)

# Debug: Print Redis configuration
print(f"Celery Redis URL: {settings.redis_url}")
print(f"Celery Broker URL: {settings.celery_broker_url}")
print(f"Celery Result Backend: {settings.celery_result_backend}")

# Create Celery application
celery_app = Celery(
    "cockpit_ng",
    broker=settings.celery_broker_url,  # Redis as message broker
    backend=settings.celery_result_backend,  # Redis as result backend
    include=["tasks"],  # Auto-discover tasks
)


def load_queue_configuration():
    """
    Load queue configuration from database settings.

    IMPORTANT: This function is NOT called at module import time to avoid
    database connections before worker processes fork (which causes SIGSEGV on macOS).

    Instead, we use a static default configuration that matches the database defaults.
    Queue configuration changes require a worker restart.

    Returns a dict of queue configurations based on what's stored in the database.
    If database is not available or no queues configured, returns default queue only.
    """
    try:
        from settings_manager import settings_manager

        celery_settings = settings_manager.get_celery_settings()
        configured_queues = celery_settings.get("queues", [])

        if not configured_queues:
            logger.warning("No queues configured in database, using default queue only")
            configured_queues = [{"name": "default", "description": "Default queue"}]

        # Build task_queues dict from database configuration
        task_queues = {}
        for queue in configured_queues:
            queue_name = queue.get("name", "default")
            task_queues[queue_name] = {
                "exchange": queue_name,
                "routing_key": queue_name,
            }
            logger.info(
                f"Loaded queue from database: {queue_name} - {queue.get('description', '')}"
            )

        logger.info(f"Loaded {len(task_queues)} queue(s) from database configuration")
        return task_queues

    except Exception as e:
        logger.error(f"Failed to load queues from database: {e}")
        logger.warning("Falling back to default queue configuration")
        return get_default_queue_configuration()


def get_default_queue_configuration():
    """
    Return default queue configuration without database access.

    These are the built-in queues with automatic task routing.
    Used at module import time to avoid database connections before forking.

    CUSTOM QUEUES:
    --------------
    Super users can add custom queues without modifying this code:
    1. Add queue in Settings UI (for documentation)
    2. Configure CELERY_WORKER_QUEUE env var in docker-compose.yml
    3. Celery will auto-create the queue in Redis
    4. Manually route tasks to the queue (use .apply_async(queue='custom'))

    Example docker-compose.yml:
        environment:
          - CELERY_WORKER_QUEUE=monitoring

    The Settings UI queue configuration is mainly for documentation and
    for start_celery.py to know which queues to listen to when
    CELERY_WORKER_QUEUE is not set.
    """
    return {
        "default": {
            "exchange": "default",
            "routing_key": "default",
        },
        "backup": {
            "exchange": "backup",
            "routing_key": "backup",
        },
        "network": {
            "exchange": "network",
            "routing_key": "network",
        },
        "heavy": {
            "exchange": "heavy",
            "routing_key": "heavy",
        },
    }


# Use static default configuration to avoid database access before forking
# NOTE: Previously this called load_queue_configuration() which accessed the database
# at import time, causing SIGSEGV on macOS when workers forked
#
# Custom queues can be added by super users via:
# 1. Settings UI (for documentation)
# 2. CELERY_WORKER_QUEUE env var (tells worker which queue to listen to)
# 3. Celery auto-creates queues in Redis as needed
task_queues_from_db = get_default_queue_configuration()
logger.info(f"Using default queue configuration ({len(task_queues_from_db)} queues)")

# Celery configuration
# NOTE: These settings work with platform-aware pool selection in start_celery.py:
#       - macOS: solo pool (no fork, safe for all settings)
#       - Linux: prefork pool (optimal performance with all features)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max per task
    result_expires=86400,  # Results expire after 24 hours
    worker_prefetch_multiplier=1,  # One task at a time per worker
    worker_max_tasks_per_child=100,  # Restart worker after 100 tasks
    # Monitoring settings - Enable Flower and task event tracking
    worker_send_task_events=True,  # Send task events for Flower monitoring
    task_send_sent_event=True,  # Track when tasks are sent to workers
    # Connection reliability - Auto-reconnect on connection loss
    broker_connection_retry_on_startup=True,  # Retry broker connection on startup
    broker_connection_retry=True,  # Retry on connection loss during runtime
    broker_connection_max_retries=10,  # Max retry attempts before giving up
    # Task reliability - Ensure tasks survive worker crashes
    task_acks_late=True,  # Acknowledge tasks after completion (not before)
    task_reject_on_worker_lost=True,  # Requeue tasks if worker crashes
    # Result backend optimization - Connection pooling and keepalive
    result_backend_transport_options={
        "master_name": None,  # Not using Redis Sentinel
        "retry_on_timeout": True,  # Retry on Redis timeout
        "socket_keepalive": True,  # Enable TCP keepalive for long connections
        # NOTE: socket_keepalive_options removed - platform-specific TCP constants
        # cause issues. Basic socket_keepalive=True is sufficient.
    },
    # Celery Beat settings
    beat_scheduler="redbeat.RedBeatScheduler",  # Use Redis-based scheduler
    redbeat_redis_url=settings.redis_url,  # Redis URL for beat schedule
    redbeat_key_prefix="cockpit-ng:beat:",  # Prefix for beat keys in Redis
    # Queue Configuration - Loaded dynamically from database
    task_queues=task_queues_from_db,
    # Task routing rules - route specific tasks to dedicated queues
    # Note: These routes reference queue names that should be configured in the UI
    task_routes={
        # Backup tasks go to 'backup' queue (if configured in UI)
        "tasks.backup_single_device_task": {"queue": "backup"},
        "tasks.finalize_backup_task": {"queue": "backup"},
        "tasks.backup_devices": {"queue": "backup"},
        # Network scanning tasks go to 'network' queue (if configured in UI)
        "tasks.ping_network_task": {"queue": "network"},
        "tasks.scan_prefixes_task": {"queue": "network"},
        "tasks.check_ip_task": {"queue": "network"},
        # Heavy/bulk tasks go to 'heavy' queue (if configured in UI)
        "tasks.bulk_onboard_devices_task": {"queue": "heavy"},
        "tasks.update_devices_from_csv_task": {"queue": "heavy"},
        "tasks.update_ip_prefixes_from_csv_task": {"queue": "heavy"},
        "tasks.export_devices_task": {"queue": "heavy"},
        # All other tasks go to default queue
        "*": {"queue": "default"},
    },
    # Default queue for tasks without explicit routing
    task_default_queue="default",
    task_default_exchange="default",
    task_default_routing_key="default",
)

# Import beat schedule (periodic tasks)
try:
    from beat_schedule import CELERY_BEAT_SCHEDULE

    celery_app.conf.beat_schedule = CELERY_BEAT_SCHEDULE
except ImportError:
    # beat_schedule.py not yet created, will be added later
    celery_app.conf.beat_schedule = {}
