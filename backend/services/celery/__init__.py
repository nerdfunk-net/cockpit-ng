"""
Celery service layer – business logic extracted from the router layer.
"""

from .admin_service import (
    get_queue_metrics,
    purge_queue,
    purge_all_queues,
    get_beat_status,
    is_redis_connected,
    get_cleanup_stats,
)

__all__ = [
    "get_queue_metrics",
    "purge_queue",
    "purge_all_queues",
    "get_beat_status",
    "is_redis_connected",
    "get_cleanup_stats",
]
