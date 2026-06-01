"""
Netmiko router for executing commands on network devices.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_device_query_service, get_nautobot_service, get_netmiko_service
from models.netmiko import (
    CommandExecutionResponse,
    CommandResult,
    DeviceCommand,
    TemplateExecutionRequest,
    TemplateExecutionResponse,
)
from services.nautobot.client import NautobotService
from services.nautobot.devices.query import DeviceQueryService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/netmiko", tags=["netmiko"])


def _load_template(template_manager, request: TemplateExecutionRequest) -> Tuple[str, Optional[str], Optional[int]]:
    """
    Load template content from DB or use inline content from request.

    Returns (template_content, pre_run_command, template_credential_id).
    Raises HTTPException if template_id is given but not found.
    """
    if request.template_id:
        template = template_manager.get_template(request.template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {request.template_id} not found",
            )
        template_content = template_manager.get_template_content(request.template_id)
        if not template_content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template content for ID {request.template_id} not found",
            )
        return (
            template_content,
            template.get("pre_run_command"),
            template.get("credential_id"),
        )

    return request.template_content, None, None


@router.post("/execute-commands", response_model=CommandExecutionResponse)
async def execute_commands(
    request: DeviceCommand,
    current_user: dict = Depends(require_permission("network.netmiko", "execute")),
    netmiko_service=Depends(get_netmiko_service),
) -> CommandExecutionResponse:
    """Execute commands on multiple network devices using Netmiko."""
    if not request.devices:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No devices provided")
    if not request.commands:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No commands provided")

    if request.use_textfsm and request.enable_mode:
        logger.warning(
            "use_textfsm=True is ignored when enable_mode=True (config mode). "
            "TextFSM parsing only applies to exec mode commands."
        )

    username, password = netmiko_service.resolve_credentials(
        request.credential_id,
        current_user["username"],
        request.username,
        request.password,
    )

    session_id, results = await netmiko_service.execute_commands(
        devices=request.devices,
        commands=request.commands,
        username=username,
        password=password,
        enable_mode=request.enable_mode,
        write_config=request.write_config,
        use_textfsm=request.use_textfsm,
        session_id=request.session_id,
    )

    command_results = [
        CommandResult(
            device=r["device"],
            success=r["success"],
            output=r["output"],
            error=r.get("error"),
            command_outputs=r.get("command_outputs"),
        )
        for r in results
    ]

    successful = sum(1 for r in results if r["success"])
    cancelled = sum(1 for r in results if r.get("cancelled", False))

    return CommandExecutionResponse(
        session_id=session_id,
        results=command_results,
        total_devices=len(results),
        successful=successful,
        failed=len(results) - successful - cancelled,
        cancelled=cancelled,
    )


@router.get("/supported-platforms")
async def get_supported_platforms(
    current_user: dict = Depends(require_permission("network.netmiko", "execute")),
    netmiko_service=Depends(get_netmiko_service),
) -> Dict[str, List[str]]:
    """Get list of supported network device platforms."""
    platforms = [
        "Cisco IOS",
        "Cisco IOS-XE",
        "Cisco IOS-XR",
        "Cisco NX-OS",
        "Cisco ASA",
        "Juniper Junos",
        "Arista EOS",
        "HP Comware",
    ]
    return {"platforms": platforms, "total": len(platforms)}


@router.post("/cancel/{session_id}")
async def cancel_execution(
    session_id: str,
    current_user: dict = Depends(require_permission("network.netmiko", "execute")),
    netmiko_service=Depends(get_netmiko_service),
) -> Dict[str, Any]:
    """
    Cancel an ongoing command execution session.

    Devices that haven't started execution yet will be marked as cancelled.
    Devices that are already executing will complete their current operation.

    Args:
        session_id: The session ID to cancel
        current_user: Current authenticated user

    Returns:
        Cancellation confirmation
    """
    try:
        logger.info("Cancel request from user %s for session %s", current_user, session_id)
        netmiko_service.cancel_session(session_id)
        return {
            "success": True,
            "message": f"Session {session_id} marked for cancellation",
            "session_id": session_id,
        }
    except Exception as e:
        raise_internal_server_error(logger, "Failed to cancel session: ", e)


@router.post("/execute-template", response_model=TemplateExecutionResponse)
async def execute_template(
    request: TemplateExecutionRequest,
    current_user: dict = Depends(require_permission("network.netmiko", "execute")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    netmiko_service=Depends(get_netmiko_service),
    device_query_service: DeviceQueryService = Depends(get_device_query_service),
) -> TemplateExecutionResponse:
    """Execute a Jinja2 template on multiple network devices."""
    import service_factory

    template_manager = service_factory.build_template_service()

    if not request.device_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No devices provided")
    if not request.template_id and not request.template_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either template_id or template_content must be provided",
        )

    template_content, pre_run_command, template_credential_id = _load_template(template_manager, request)

    username, password = None, None
    if not request.dry_run:
        username, password = netmiko_service.resolve_credentials(
            request.credential_id,
            current_user["username"],
            request.username,
            request.password,
        )

    session_id = request.session_id or str(uuid.uuid4())
    netmiko_service.register_session(session_id)

    results, counters = await netmiko_service.execute_template_on_devices(
        device_ids=request.device_ids,
        template_content=template_content,
        session_id=session_id,
        username=username,
        password=password,
        dry_run=request.dry_run,
        enable_mode=request.enable_mode,
        write_config=request.write_config,
        use_nautobot_context=request.use_nautobot_context,
        user_variables=request.user_variables,
        pre_run_command=pre_run_command,
        template_credential_id=template_credential_id,
        nautobot_service=nautobot_service,
        device_query_service=device_query_service,
    )

    netmiko_service.unregister_session(session_id)

    summary = {**counters, "total": len(request.device_ids)}
    return TemplateExecutionResponse(session_id=session_id, results=results, summary=summary)


@router.get("/health")
async def health_check(
    current_user: dict = Depends(require_permission("network.netmiko", "execute")),
) -> Dict[str, str]:
    """Health check endpoint for Netmiko service."""
    return {"status": "healthy", "service": "netmiko"}
