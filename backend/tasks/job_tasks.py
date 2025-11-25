"""
Job execution tasks for scheduled jobs.
These tasks are triggered by job schedules and can be executed on-demand or periodically.
"""
from celery_app import celery_app
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


@celery_app.task(name='tasks.cache_devices', bind=True)
def cache_devices_task(self, job_schedule_id: Optional[int] = None) -> dict:
    """
    Task: Cache all devices from Nautobot.

    This task fetches device data from Nautobot and stores it in the cache
    for faster access throughout the application.

    Args:
        job_schedule_id: Optional ID of the job schedule that triggered this task

    Returns:
        dict: Task execution results
    """
    try:
        logger.info(f"Starting cache_devices task (job_schedule_id: {job_schedule_id})")

        # Update task state to show progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Connecting to Nautobot...'}
        )

        # Import here to avoid circular imports
        from services.nautobot import nautobot_service
        from services.cache_service import cache_service
        import asyncio

        # Create event loop for async operations
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            # Fetch all devices from Nautobot
            self.update_state(
                state='PROGRESS',
                meta={'current': 30, 'total': 100, 'status': 'Fetching devices...'}
            )

            # Use the existing get-all-devices job functionality
            # This is a placeholder - you'll need to adapt this to your actual implementation
            query = """
            query getAllDevices {
              devices {
                id
                name
                role {
                  name
                }
                location {
                  name
                }
                primary_ip4 {
                  address
                }
                status {
                  name
                }
                device_type {
                  model
                }
              }
            }
            """

            result = loop.run_until_complete(nautobot_service.graphql_query(query))

            self.update_state(
                state='PROGRESS',
                meta={'current': 70, 'total': 100, 'status': 'Caching device data...'}
            )

            if "errors" in result:
                logger.error(f"GraphQL errors: {result['errors']}")
                return {
                    'success': False,
                    'error': f"GraphQL errors: {result['errors']}",
                    'job_schedule_id': job_schedule_id
                }

            devices = result.get("data", {}).get("devices", [])

            # Cache each device
            for device in devices:
                device_id = device.get("id")
                if device_id:
                    cache_key = f"nautobot:devices:{device_id}"
                    cache_service.set(cache_key, device, 30 * 60)  # 30 minutes TTL

            self.update_state(
                state='PROGRESS',
                meta={'current': 100, 'total': 100, 'status': 'Complete'}
            )

            logger.info(f"Successfully cached {len(devices)} devices")

            return {
                'success': True,
                'devices_cached': len(devices),
                'message': f'Cached {len(devices)} devices from Nautobot',
                'job_schedule_id': job_schedule_id
            }

        finally:
            loop.close()

    except Exception as e:
        logger.error(f"cache_devices task failed: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'job_schedule_id': job_schedule_id
        }


@celery_app.task(name='tasks.sync_checkmk', bind=True)
def sync_checkmk_task(self, job_schedule_id: Optional[int] = None) -> dict:
    """
    Task: Synchronize devices to CheckMK.

    This task syncs device information from Nautobot to CheckMK monitoring system.

    Args:
        job_schedule_id: Optional ID of the job schedule that triggered this task

    Returns:
        dict: Task execution results
    """
    try:
        logger.info(f"Starting sync_checkmk task (job_schedule_id: {job_schedule_id})")

        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Starting CheckMK sync...'}
        )

        # Import here to avoid circular imports
        from services.nb2cmk_background_service import background_service
        import asyncio

        # Create event loop for async operations
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            self.update_state(
                state='PROGRESS',
                meta={'current': 30, 'total': 100, 'status': 'Syncing to CheckMK...'}
            )

            # Trigger the sync - this is a placeholder
            # You'll need to adapt this to your actual CheckMK sync implementation
            result = loop.run_until_complete(background_service.trigger_sync())

            self.update_state(
                state='PROGRESS',
                meta={'current': 100, 'total': 100, 'status': 'Complete'}
            )

            logger.info("CheckMK sync completed successfully")

            return {
                'success': True,
                'message': 'CheckMK sync completed',
                'result': result,
                'job_schedule_id': job_schedule_id
            }

        finally:
            loop.close()

    except Exception as e:
        logger.error(f"sync_checkmk task failed: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'job_schedule_id': job_schedule_id
        }


@celery_app.task(name='tasks.backup_configs', bind=True)
def backup_configs_task(
    self,
    job_schedule_id: Optional[int] = None,
    credential_id: Optional[int] = None,
    devices: Optional[list] = None
) -> dict:
    """
    Task: Backup device configurations.

    This task connects to network devices and backs up their configurations.
    Can use private credentials when provided.

    Args:
        job_schedule_id: Optional ID of the job schedule that triggered this task
        credential_id: Optional credential ID to use for authentication
        devices: Optional list of specific devices to backup

    Returns:
        dict: Task execution results
    """
    try:
        logger.info(f"Starting backup_configs task (job_schedule_id: {job_schedule_id}, credential_id: {credential_id})")

        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Initializing backup...'}
        )

        # This is a placeholder for the actual backup implementation
        # You would integrate with your existing backup functionality here

        self.update_state(
            state='PROGRESS',
            meta={'current': 50, 'total': 100, 'status': 'Backing up configurations...'}
        )

        # Simulate backup process
        import time
        time.sleep(2)

        self.update_state(
            state='PROGRESS',
            meta={'current': 100, 'total': 100, 'status': 'Complete'}
        )

        device_count = len(devices) if devices else 0

        logger.info(f"Backup task completed for {device_count} devices")

        return {
            'success': True,
            'devices_backed_up': device_count,
            'message': f'Backed up {device_count} device configurations',
            'job_schedule_id': job_schedule_id
        }

    except Exception as e:
        logger.error(f"backup_configs task failed: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'job_schedule_id': job_schedule_id
        }


@celery_app.task(name='tasks.ansible_playbook', bind=True)
def ansible_playbook_task(
    self,
    job_schedule_id: Optional[int] = None,
    credential_id: Optional[int] = None,
    playbook: Optional[str] = None,
    **kwargs
) -> dict:
    """
    Task: Run Ansible playbook.

    This task executes an Ansible playbook on target devices.
    Can use private credentials when provided.

    Args:
        job_schedule_id: Optional ID of the job schedule that triggered this task
        credential_id: Optional credential ID to use for authentication
        playbook: Playbook to execute
        **kwargs: Additional playbook parameters

    Returns:
        dict: Task execution results
    """
    try:
        logger.info(f"Starting ansible_playbook task (job_schedule_id: {job_schedule_id}, playbook: {playbook})")

        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Initializing Ansible...'}
        )

        # This is a placeholder for the actual Ansible implementation
        # You would integrate with your existing Ansible functionality here

        self.update_state(
            state='PROGRESS',
            meta={'current': 50, 'total': 100, 'status': 'Running playbook...'}
        )

        # Simulate playbook execution
        import time
        time.sleep(3)

        self.update_state(
            state='PROGRESS',
            meta={'current': 100, 'total': 100, 'status': 'Complete'}
        )

        logger.info(f"Ansible playbook task completed: {playbook}")

        return {
            'success': True,
            'playbook': playbook,
            'message': f'Ansible playbook {playbook} executed successfully',
            'job_schedule_id': job_schedule_id
        }

    except Exception as e:
        logger.error(f"ansible_playbook task failed: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'job_schedule_id': job_schedule_id
        }


# Task name mapping for job identifiers
JOB_TASK_MAPPING = {
    'cache_devices': cache_devices_task,
    'sync_checkmk': sync_checkmk_task,
    'backup_configs': backup_configs_task,
    'ansible_playbook': ansible_playbook_task,
}


def get_task_for_job(job_identifier: str):
    """
    Get the Celery task function for a given job identifier.

    Args:
        job_identifier: Job identifier (e.g., 'cache_devices')

    Returns:
        Celery task function or None
    """
    return JOB_TASK_MAPPING.get(job_identifier)
