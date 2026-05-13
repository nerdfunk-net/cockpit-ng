"""Celery task for device onboarding — thin entry point."""

from typing import Dict, List, Optional

from celery import shared_task

from services.nautobot.onboarding.onboarding_service import DeviceOnboardingService

_onboarding_service = DeviceOnboardingService()


@shared_task(bind=True, name="tasks.onboard_device_task")
def onboard_device_task(
    self,
    ip_address: str,
    location_id: str,
    role_id: str,
    namespace_id: str,
    status_id: str,
    interface_status_id: str,
    ip_address_status_id: str,
    prefix_status_id: str,
    secret_groups_id: str,
    platform_id: str,
    port: int,
    timeout: int,
    onboarding_timeout: int = 120,
    sync_options: Optional[List[str]] = None,
    tags: Optional[List[str]] = None,
    custom_fields: Optional[Dict[str, str]] = None,
    username: Optional[str] = None,
    user_id: Optional[int] = None,
) -> dict:
    """Celery task wrapper — delegates to DeviceOnboardingService."""
    return _onboarding_service.onboard(
        task_instance=self,
        ip_address=ip_address,
        location_id=location_id,
        role_id=role_id,
        namespace_id=namespace_id,
        status_id=status_id,
        interface_status_id=interface_status_id,
        ip_address_status_id=ip_address_status_id,
        prefix_status_id=prefix_status_id,
        secret_groups_id=secret_groups_id,
        platform_id=platform_id,
        port=port,
        timeout=timeout,
        onboarding_timeout=onboarding_timeout,
        sync_options=sync_options,
        tags=tags,
        custom_fields=custom_fields,
        username=username,
        user_id=user_id,
    )
