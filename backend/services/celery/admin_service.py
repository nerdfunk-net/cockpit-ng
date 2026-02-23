"""
Celery admin service – pure business logic for Celery infrastructure management.

Handles Redis-backed operations that were previously embedded directly in router
endpoint functions. All functions here are stateless and only accept/return plain
Python values so they remain easy to test without mocking FastAPI internals.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import redis
from kombu import Queue

from celery_app import celery_app
from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Redis helpers
# ---------------------------------------------------------------------------

BEAT_LOCK_KEY = "cockpit-ng:beat::lock"
BEAT_SCHEDULE_KEY = "cockpit-ng:beat::schedule"


def _redis_client(*, decode_responses: bool = False) -> redis.Redis:
    """Return a connected Redis client using the application settings."""
    return redis.Redis.from_url(settings.redis_url, decode_responses=decode_responses)


# ---------------------------------------------------------------------------
# Beat status
# ---------------------------------------------------------------------------


def get_beat_status() -> dict[str, Any]:
    """
    Check whether Celery Beat is running.

    RedBeat writes a lock key while the scheduler is active, so its presence
    is the most reliable indicator that Beat is running.
    """
    try:
        r = _redis_client()
        lock_exists = r.exists(BEAT_LOCK_KEY)
        schedule_exists = r.exists(BEAT_SCHEDULE_KEY)
        beat_running = bool(lock_exists or schedule_exists)
    except Exception as exc:
        logger.warning("Failed to check beat status: %s", exc)
        beat_running = False

    return {
        "beat_running": beat_running,
        "message": "Beat is running" if beat_running else "Beat not detected",
    }


# ---------------------------------------------------------------------------
# Redis connectivity
# ---------------------------------------------------------------------------


def is_redis_connected() -> bool:
    """Return True if a ping to Redis succeeds."""
    try:
        r = _redis_client()
        r.ping()
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Queue metrics
# ---------------------------------------------------------------------------


def get_queue_metrics() -> dict[str, Any]:
    """
    Return per-queue metrics by combining Celery inspect data with Redis queue
    lengths and task routing configuration.
    """
    inspect = celery_app.control.inspect()
    active_queues = inspect.active_queues() or {}
    active_tasks = inspect.active() or {}

    task_queues: dict = celery_app.conf.task_queues or {}
    task_routes: dict = celery_app.conf.task_routes or {}

    try:
        redis_client = _redis_client()

        queues = []
        for queue_name in task_queues:
            pending_count = redis_client.llen(queue_name)

            workers_consuming: list[str] = []
            for worker_name, worker_queues in active_queues.items():
                for queue_info in worker_queues:
                    if queue_info.get("name") == queue_name:
                        workers_consuming.append(worker_name)

            active_count = sum(
                len(tasks)
                for worker_name, tasks in active_tasks.items()
                if worker_name in workers_consuming
            )

            routed_tasks = [
                pattern
                for pattern, route_config in task_routes.items()
                if route_config.get("queue") == queue_name
            ]

            queues.append(
                {
                    "name": queue_name,
                    "pending_tasks": pending_count,
                    "active_tasks": active_count,
                    "workers_consuming": workers_consuming,
                    "worker_count": len(workers_consuming),
                    "routed_tasks": routed_tasks,
                    "exchange": task_queues[queue_name].get("exchange"),
                    "routing_key": task_queues[queue_name].get("routing_key"),
                }
            )

        redis_client.close()
        return {"success": True, "queues": queues, "total_queues": len(queues)}

    except Exception as exc:
        logger.error("Error fetching queue metrics: %s", exc)
        return {"success": False, "error": str(exc), "queues": [], "total_queues": 0}


# ---------------------------------------------------------------------------
# Queue purge operations
# ---------------------------------------------------------------------------


def purge_queue(queue_name: str, *, username: str = "unknown") -> dict[str, Any]:
    """
    Purge all pending tasks from *queue_name*.

    Returns a result dict.  Raises ``KeyError`` when the queue does not exist
    and ``RuntimeError`` for underlying broker/connection failures so the caller
    (router layer) can translate them to appropriate HTTP responses.
    """
    task_queues: dict = celery_app.conf.task_queues or {}

    if queue_name not in task_queues:
        raise KeyError(f"Queue '{queue_name}' not found")

    try:
        with celery_app.connection_or_acquire() as conn:
            queue_config = task_queues[queue_name]
            queue_obj = Queue(
                name=queue_name,
                exchange=queue_config.get("exchange", queue_name),
                routing_key=queue_config.get("routing_key", queue_name),
            )
            purged_count = queue_obj(conn.channel()).purge()

        logger.info(
            "Purged %s task(s) from queue '%s' by user %s",
            purged_count,
            queue_name,
            username,
        )

        return {
            "success": True,
            "queue": queue_name,
            "purged_tasks": purged_count or 0,
            "message": f"Purged {purged_count or 0} pending task(s) from queue '{queue_name}'",
        }

    except Exception as exc:
        logger.error("Error purging queue %s: %s", queue_name, exc)
        raise RuntimeError(f"Failed to purge queue: {exc}") from exc


def purge_all_queues(*, username: str = "unknown") -> dict[str, Any]:
    """Purge all pending tasks from every configured queue."""
    task_queues: dict = celery_app.conf.task_queues or {}
    purged_queues: list[dict] = []
    total_purged = 0

    try:
        with celery_app.connection_or_acquire() as conn:
            for queue_name in task_queues:
                try:
                    queue_config = task_queues[queue_name]
                    queue_obj = Queue(
                        name=queue_name,
                        exchange=queue_config.get("exchange", queue_name),
                        routing_key=queue_config.get("routing_key", queue_name),
                    )
                    purged_count = queue_obj(conn.channel()).purge()
                    purged_queues.append(
                        {"queue": queue_name, "purged_tasks": purged_count or 0}
                    )
                    total_purged += purged_count or 0
                    logger.info(
                        "Purged %s task(s) from queue '%s'", purged_count, queue_name
                    )
                except Exception as exc:
                    logger.error("Error purging queue %s: %s", queue_name, exc)
                    purged_queues.append(
                        {"queue": queue_name, "purged_tasks": 0, "error": str(exc)}
                    )

        logger.info(
            "Purged total of %s task(s) from all queues by user %s",
            total_purged,
            username,
        )

        return {
            "success": True,
            "total_purged": total_purged,
            "queues": purged_queues,
            "message": f"Purged {total_purged} pending task(s) from {len(purged_queues)} queue(s)",
        }

    except Exception as exc:
        logger.error("Error purging all queues: %s", exc)
        raise RuntimeError(f"Failed to purge all queues: {exc}") from exc


# ---------------------------------------------------------------------------
# Cleanup stats
# ---------------------------------------------------------------------------


def get_cleanup_stats() -> dict[str, Any]:
    """
    Return statistics about Celery task results stored in Redis that could be
    removed by the cleanup task.
    """
    from settings_manager import settings_manager

    celery_settings = settings_manager.get_celery_settings()
    cleanup_age_hours: int = celery_settings.get("cleanup_age_hours", 24)
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=cleanup_age_hours)

    r = _redis_client()
    result_keys = list(r.scan_iter("celery-task-meta-*"))

    return {
        "cleanup_age_hours": cleanup_age_hours,
        "cutoff_time": cutoff_time.isoformat(),
        "total_result_keys": len(result_keys),
        "message": f"Cleanup will remove task results older than {cleanup_age_hours} hours",
    }
