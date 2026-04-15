"""
Get Client Data Celery task.

Collects ARP table, MAC address table, and DNS hostnames from network devices
and stores the results in the client_ip_addresses, client_mac_addresses, and
client_hostnames database tables.

This is a thin Celery task wrapper around execute_get_client_data().
"""

import logging
from typing import Any, Dict, Optional

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="tasks.get_client_data_task")
def get_client_data_task(
    self,
    schedule_id: Optional[int] = None,
    credential_id: Optional[int] = None,
    job_parameters: Optional[Dict[str, Any]] = None,
    target_devices: Optional[list] = None,
    template: Optional[Dict[str, Any]] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Celery task: collect client data from network devices.

    Args:
        schedule_id: Job schedule ID (None for manual runs)
        credential_id: SSH credential ID for device authentication
        job_parameters: Dict with collect_ip_address, collect_mac_address,
                        collect_hostname flags
        target_devices: List of Nautobot device UUIDs (None/empty = all devices)
        template: Job template dict (fallback source for collect_* flags)
        job_run_id: Job run DB record ID for progress tracking

    Returns:
        dict: Summary with session_id and row counts per table
    """
    from tasks.execution.client_data_executor import execute_get_client_data

    logger.info(
        "get_client_data_task started — schedule=%s credential=%s devices=%s",
        schedule_id,
        credential_id,
        len(target_devices) if target_devices else "all",
    )

    return execute_get_client_data(
        schedule_id=schedule_id,
        credential_id=credential_id,
        job_parameters=job_parameters,
        target_devices=target_devices,
        task_context=self,
        template=template,
        job_run_id=job_run_id,
    )
