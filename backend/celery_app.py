"""
Celery application configuration.
"""

from celery import Celery
from config import settings

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

# Celery configuration
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
    # Celery Beat settings
    beat_scheduler="redbeat.RedBeatScheduler",  # Use Redis-based scheduler
    redbeat_redis_url=settings.redis_url,  # Redis URL for beat schedule
    redbeat_key_prefix="cockpit-ng:beat:",  # Prefix for beat keys in Redis
    # Queue Configuration - Define specialized queues for task routing
    task_queues={
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
    },
    # Task routing rules - route specific tasks to dedicated queues
    task_routes={
        # Backup tasks go to 'backup' queue
        "tasks.backup_single_device_task": {"queue": "backup"},
        "tasks.finalize_backup_task": {"queue": "backup"},
        "tasks.backup_devices": {"queue": "backup"},
        # Network scanning tasks go to 'network' queue
        "tasks.ping_network_task": {"queue": "network"},
        "tasks.scan_prefixes_task": {"queue": "network"},
        "tasks.check_ip_task": {"queue": "network"},
        # Heavy/bulk tasks go to 'heavy' queue
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
