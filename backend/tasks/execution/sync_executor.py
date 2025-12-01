"""
Sync devices to CheckMK job executor.
Syncs devices from Nautobot to CheckMK monitoring system.

Moved from job_tasks.py to improve code organization.
"""
import logging
import asyncio
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


def execute_sync_devices(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context
) -> Dict[str, Any]:
    """
    Execute sync_devices job (Nautobot to CheckMK).

    Syncs devices from Nautobot to CheckMK. If target_devices is provided (from inventory),
    only those devices are synced. Otherwise, all devices are synced.

    Args:
        schedule_id: Job schedule ID
        credential_id: Optional credential ID (not used for sync)
        job_parameters: Additional job parameters
        target_devices: List of device UUIDs to sync, or None for all devices
        task_context: Celery task context for progress updates

    Returns:
        dict: Sync results with counts and per-device details
    """
    try:
        task_context.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': 100, 'status': 'Initializing CheckMK sync...'}
        )

        from services.nb2cmk_base_service import nb2cmk_service

        # If no target devices provided, fetch all from Nautobot
        device_ids = target_devices
        if not device_ids:
            logger.info("No target devices specified, fetching all devices from Nautobot")
            task_context.update_state(
                state='PROGRESS',
                meta={'current': 5, 'total': 100, 'status': 'Fetching devices from Nautobot...'}
            )

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                devices_result = loop.run_until_complete(nb2cmk_service.get_devices_for_sync())
                if devices_result and hasattr(devices_result, "devices"):
                    device_ids = [device.get("id") for device in devices_result.devices]
                    logger.info(f"Fetched {len(device_ids)} devices from Nautobot")
                else:
                    logger.warning("No devices found in Nautobot")
                    device_ids = []
            finally:
                loop.close()

        if not device_ids:
            return {
                'success': True,
                'message': 'No devices to sync',
                'total': 0,
                'success_count': 0,
                'failed_count': 0
            }

        total_devices = len(device_ids)
        success_count = 0
        failed_count = 0
        results = []

        logger.info(f"Starting sync of {total_devices} devices to CheckMK")

        # Process each device
        for i, device_id in enumerate(device_ids):
            try:
                # Update progress
                progress = int(10 + (i / total_devices) * 85)
                task_context.update_state(
                    state='PROGRESS',
                    meta={
                        'current': progress,
                        'total': 100,
                        'status': f'Syncing device {i + 1}/{total_devices}',
                        'success': success_count,
                        'failed': failed_count
                    }
                )

                # Sync device - try update first, then add if not found
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    try:
                        result = loop.run_until_complete(
                            nb2cmk_service.update_device_in_checkmk(device_id)
                        )
                        success_count += 1
                        results.append({
                            'device_id': device_id,
                            'hostname': result.hostname if hasattr(result, 'hostname') else device_id,
                            'operation': 'update',
                            'success': True,
                            'message': result.message if hasattr(result, 'message') else 'Updated'
                        })
                    except Exception as update_error:
                        # If device not found in CheckMK, try to add it
                        if "404" in str(update_error) or "not found" in str(update_error).lower():
                            logger.info(f"Device {device_id} not in CheckMK, attempting to add...")
                            result = loop.run_until_complete(
                                nb2cmk_service.add_device_to_checkmk(device_id)
                            )
                            success_count += 1
                            results.append({
                                'device_id': device_id,
                                'hostname': result.hostname if hasattr(result, 'hostname') else device_id,
                                'operation': 'add',
                                'success': True,
                                'message': result.message if hasattr(result, 'message') else 'Added'
                            })
                        else:
                            raise
                finally:
                    loop.close()

            except Exception as e:
                failed_count += 1
                error_msg = str(e)
                logger.error(f"Error syncing device {device_id}: {error_msg}")
                results.append({
                    'device_id': device_id,
                    'operation': 'sync',
                    'success': False,
                    'error': error_msg
                })

        # Update final progress
        task_context.update_state(
            state='PROGRESS',
            meta={'current': 100, 'total': 100, 'status': 'Sync complete'}
        )

        logger.info(
            f"Sync completed: {success_count}/{total_devices} devices synced, "
            f"{failed_count} failed"
        )

        return {
            'success': True,
            'message': f'Synced {success_count}/{total_devices} devices',
            'total': total_devices,
            'success_count': success_count,
            'failed_count': failed_count,
            'results': results
        }

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Sync devices job failed: {error_msg}", exc_info=True)
        return {
            'success': False,
            'error': error_msg
        }
