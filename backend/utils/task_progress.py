"""
Utility class for managing Celery task progress updates.

This module provides a helper class for consistent and structured
progress updates in Celery tasks.
"""

from typing import Any


class ProgressUpdater:
    """
    Helper class for consistent Celery task progress updates.

    This class standardizes the structure of progress updates and ensures
    all updates include the required fields.

    Example:
        >>> @shared_task(bind=True)
        >>> def my_task(self):
        >>>     updater = ProgressUpdater(self)
        >>>     updater.update("initialization", "Starting task...", 5)
        >>>     # Do work...
        >>>     updater.update("processing", "Processing data...", 50, items_processed=10)
        >>>     # More work...
        >>>     updater.update("complete", "Task finished!", 100)
    """

    def __init__(self, task_instance):
        """
        Initialize the progress updater.

        Args:
            task_instance: The Celery task instance (self in a bound task)
        """
        self.task = task_instance

    def update(
        self, stage: str, status: str, progress: int, **extra_fields: Any
    ) -> None:
        """
        Update task progress with consistent structure.

        Args:
            stage: The current stage of the task (e.g., "onboarding", "syncing", "complete")
            status: Human-readable status message
            progress: Progress percentage (0-100)
            **extra_fields: Additional fields to include in the meta dictionary
                           (e.g., job_id, device_count, errors)

        Example:
            >>> updater.update(
            >>>     "onboarding",
            >>>     "Waiting for job completion",
            >>>     30,
            >>>     job_id="12345",
            >>>     elapsed_time=45
            >>> )
        """
        meta = {
            "stage": stage,
            "status": status,
            "progress": min(max(progress, 0), 100),  # Clamp to 0-100
            **extra_fields,
        }
        self.task.update_state(state="PROGRESS", meta=meta)

    def error(self, message: str, **extra_fields: Any) -> None:
        """
        Update task with error state.

        Args:
            message: Error message
            **extra_fields: Additional error context

        Example:
            >>> updater.error("Connection timeout", device_ip="192.168.1.1")
        """
        meta = {"stage": "error", "status": message, "progress": 0, **extra_fields}
        self.task.update_state(state="FAILURE", meta=meta)

    def complete(
        self, message: str = "Task completed successfully", **extra_fields: Any
    ) -> None:
        """
        Mark task as complete.

        Args:
            message: Completion message
            **extra_fields: Additional completion details

        Example:
            >>> updater.complete("Device onboarded", device_id="abc-123")
        """
        meta = {"stage": "complete", "status": message, "progress": 100, **extra_fields}
        self.task.update_state(state="SUCCESS", meta=meta)
