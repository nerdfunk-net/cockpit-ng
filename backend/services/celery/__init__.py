"""
Celery service layer – business logic extracted from the router layer.
"""

from .admin_service import (
    get_beat_status,
    get_cleanup_stats,
    get_queue_metrics,
    is_redis_connected,
    purge_all_queues,
    purge_queue,
)

__all__ = [
    "get_queue_metrics",
    "purge_queue",
    "purge_all_queues",
    "get_beat_status",
    "is_redis_connected",
    "get_cleanup_stats",
]
