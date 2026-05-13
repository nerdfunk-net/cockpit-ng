"""Scan Prefixes Task for Celery (thin entry point)."""

from typing import Any, Dict, List, Optional

from celery import shared_task

from services.network.scanning.prefix_scan_service import PrefixScanService

_scan_service = PrefixScanService()


@shared_task(bind=True, name="tasks.scan_prefixes_task")
def scan_prefixes_task(
    self,
    custom_field_name: str,
    custom_field_value: str,
    response_custom_field_name: Optional[str] = None,
    set_reachable_ip_active: bool = True,
    resolve_dns: bool = False,
    ping_count: int = 3,
    timeout_ms: int = 500,
    retries: int = 3,
    interval_ms: int = 10,
    executed_by: str = "unknown",
    scan_max_ips: Optional[int] = None,
    explicit_prefixes: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Celery task wrapper — delegates to PrefixScanService."""
    return _scan_service.execute(
        custom_field_name=custom_field_name,
        custom_field_value=custom_field_value,
        response_custom_field_name=response_custom_field_name,
        set_reachable_ip_active=set_reachable_ip_active,
        resolve_dns=resolve_dns,
        ping_count=ping_count,
        timeout_ms=timeout_ms,
        retries=retries,
        interval_ms=interval_ms,
        executed_by=executed_by,
        task_context=self,
        job_run_id=None,
        scan_max_ips=scan_max_ips,
        explicit_prefixes=explicit_prefixes,
    )
