"""
Netmiko router for executing commands on network devices.
"""

from __future__ import annotations
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.auth import require_permission
from services.network.automation.netmiko import netmiko_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/netmiko", tags=["netmiko"])


class DeviceCommand(BaseModel):
    """Model for device command execution request."""

    devices: List[Dict[str, str]] = Field(
        ...,
        description="List of devices with 'ip' or 'primary_ip4' and 'platform' fields",
    )
    commands: List[str] = Field(
        ..., description="List of commands to execute", min_items=1
    )
    credential_id: int | None = Field(
        default=None, description="ID of stored credential to use (optional)"
    )
    username: str | None = Field(
        default=None,
        description="SSH username (required if credential_id not provided)",
    )
    password: str | None = Field(
        default=None,
        description="SSH password (required if credential_id not provided)",
    )
    enable_mode: bool = Field(
        default=False, description="Whether to enter config mode after login"
    )
    write_config: bool = Field(
        default=False,
        description="Whether to save config to startup after successful execution",
    )
    session_id: str | None = Field(
        default=None, description="Optional session ID for cancellation support"
    )


class CommandResult(BaseModel):
    """Model for command execution result."""

    device: str
    success: bool
    output: str
    error: str | None = None


class CommandExecutionResponse(BaseModel):
    """Model for command execution response."""

    session_id: str
    results: List[CommandResult]
    total_devices: int
    successful: int
    failed: int
    cancelled: int


class TemplateExecutionRequest(BaseModel):
    """Model for template execution request."""

    device_ids: List[str] = Field(
        ..., description="List of device UUIDs from Nautobot", min_items=1
    )
    template_id: int | None = Field(
        default=None,
        description="ID of saved template (either this or template_content required)",
    )
    template_content: str | None = Field(
        default=None,
        description="Ad-hoc template content (either this or template_id required)",
    )
    user_variables: Dict[str, Any] = Field(
        default_factory=dict,
        description="User-defined variables for template rendering",
    )
    use_nautobot_context: bool = Field(
        default=True,
        description="Whether to include Nautobot device data in template context",
    )
    dry_run: bool = Field(
        default=False, description="If true, only render templates without executing"
    )
    credential_id: int | None = Field(
        default=None, description="ID of stored credential to use (optional)"
    )
    username: str | None = Field(
        default=None,
        description="SSH username (required if credential_id not provided and not dry_run)",
    )
    password: str | None = Field(
        default=None,
        description="SSH password (required if credential_id not provided and not dry_run)",
    )
    enable_mode: bool = Field(
        default=False, description="Whether to enter enable mode after login"
    )
    write_config: bool = Field(
        default=False,
        description="Whether to save config to startup after successful execution",
    )
    session_id: str | None = Field(
        default=None, description="Optional session ID for cancellation support"
    )


class TemplateExecutionResult(BaseModel):
    """Model for template execution result."""

    device_id: str
    device_name: str
    success: bool
    rendered_content: str | None = None
    output: str | None = None
    error: str | None = None


class TemplateExecutionResponse(BaseModel):
    """Model for template execution response."""

    session_id: str
    results: List[TemplateExecutionResult]
    summary: Dict[str, int] = Field(
        description="Summary statistics (total, rendered_successfully, executed_successfully, failed, cancelled)"
    )


@router.post("/execute-commands", response_model=CommandExecutionResponse)
async def execute_commands(
    request: DeviceCommand,
    current_user: dict = Depends(require_permission("network.netmiko", "execute")),
) -> CommandExecutionResponse:
    """
    Execute commands on multiple network devices using Netmiko.

    This endpoint accepts a list of devices and commands, connects to each device
    concurrently, and executes the specified commands. It supports both exec mode
    and config mode execution.

    Args:
        request: Command execution request with devices, commands, and credentials
        current_user: Current authenticated user

    Returns:
        Command execution results for all devices

    Raises:
        HTTPException: If validation fails or execution errors occur
    """
    try:
        logger.info(
            f"Execute commands request from user: {current_user}, "
            f"devices: {len(request.devices)}, commands: {len(request.commands)}"
        )

        # Validate inputs
        if not request.devices:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="No devices provided"
            )

        if not request.commands:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="No commands provided"
            )

        # Get credentials - either from stored credential or manual entry
        username = request.username
        password = request.password

        if request.credential_id is not None:
            # Use stored credential
            logger.info(f"Using stored credential ID: {request.credential_id}")
            import credentials_manager as cred_mgr

            try:
                # Get credential details - include both general and user's private credentials
                general_creds = cred_mgr.list_credentials(
                    include_expired=False, source="general"
                )
                private_creds = cred_mgr.list_credentials(
                    include_expired=False, source="private"
                )
                user_private = [
                    c
                    for c in private_creds
                    if c.get("owner") == current_user["username"]
                ]
                credentials = general_creds + user_private

                credential = next(
                    (c for c in credentials if c["id"] == request.credential_id), None
                )

                if not credential:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Credential with ID {request.credential_id} not found or not accessible",
                    )

                if credential["type"] != "ssh":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Credential must be of type 'ssh', got '{credential['type']}'",
                    )

                # Get decrypted password
                username = credential["username"]
                password = cred_mgr.get_decrypted_password(request.credential_id)

                if not password:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to decrypt credential password",
                    )

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error loading stored credential: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to load stored credential: {str(e)}",
                )
        else:
            # Use manual credentials
            if not username or not password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username and password are required when not using stored credentials",
                )

        # Execute commands on all devices
        session_id, results = await netmiko_service.execute_commands(
            devices=request.devices,
            commands=request.commands,
            username=username,
            password=password,
            enable_mode=request.enable_mode,
            write_config=request.write_config,
            session_id=request.session_id,
        )

        # Convert results to response model
        command_results = [
            CommandResult(
                device=r["device"],
                success=r["success"],
                output=r["output"],
                error=r.get("error"),
            )
            for r in results
        ]

        # Calculate statistics
        successful = sum(1 for r in results if r["success"])
        cancelled = sum(1 for r in results if r.get("cancelled", False))
        failed = len(results) - successful - cancelled

        logger.info(
            f"Command execution completed for user {current_user}. "
            f"Total: {len(results)}, Successful: {successful}, Failed: {failed}, Cancelled: {cancelled}"
        )

        return CommandExecutionResponse(
            session_id=session_id,
            results=command_results,
            total_devices=len(results),
            successful=successful,
            failed=failed,
            cancelled=cancelled,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing commands: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute commands: {str(e)}",
        )


@router.get("/supported-platforms")
async def get_supported_platforms(
    current_user: dict = Depends(require_permission("network.netmiko", "execute")),
) -> Dict[str, List[str]]:
    """
    Get list of supported network device platforms.

    Returns a list of common platform names that are supported by Netmiko.
    These platforms will be automatically mapped to the appropriate Netmiko
    device types.

    Args:
        current_user: Current authenticated user

    Returns:
        Dictionary with supported platforms
    """
    try:
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

    except Exception as e:
        logger.error(f"Error getting supported platforms: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get supported platforms: {str(e)}",
        )


@router.post("/cancel/{session_id}")
async def cancel_execution(
    session_id: str,
    current_user: dict = Depends(require_permission("network.netmiko", "execute")),
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
        logger.info(f"Cancel request from user {current_user} for session {session_id}")
        netmiko_service.cancel_session(session_id)
        return {
            "success": True,
            "message": f"Session {session_id} marked for cancellation",
            "session_id": session_id,
        }
    except Exception as e:
        logger.error(f"Error cancelling session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel session: {str(e)}",
        )


@router.post("/execute-template", response_model=TemplateExecutionResponse)
async def execute_template(
    request: TemplateExecutionRequest,
    current_user: dict = Depends(require_permission("network.netmiko", "execute")),
) -> TemplateExecutionResponse:
    """
    Execute a template on multiple network devices.

    This endpoint renders a Jinja2 template with device-specific Nautobot data and
    user variables, then optionally executes the rendered commands on each device.

    Args:
        request: Template execution request with devices, template, and options
        current_user: Current authenticated user

    Returns:
        Template execution results for all devices

    Raises:
        HTTPException: If validation fails or execution errors occur
    """
    import uuid
    from services.nautobot import nautobot_service
    from services.network.automation.render import render_service
    from template_manager import template_manager

    try:
        logger.info(
            f"Execute template request from user: {current_user}, "
            f"devices: {len(request.device_ids)}, dry_run: {request.dry_run}"
        )

        # Validate inputs
        if not request.device_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="No devices provided"
            )

        if not request.template_id and not request.template_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either template_id or template_content must be provided",
            )

        # Get template content
        if request.template_id:
            template = template_manager.get_template(request.template_id)
            if not template:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Template with ID {request.template_id} not found",
                )
            template_content = template_manager.get_template_content(
                request.template_id
            )
            if not template_content:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Template content for ID {request.template_id} not found",
                )
        else:
            template_content = request.template_content

        # Get credentials if not dry run
        username = None
        password = None

        if not request.dry_run:
            username = request.username
            password = request.password

            if request.credential_id is not None:
                logger.info(f"Using stored credential ID: {request.credential_id}")
                import credentials_manager as cred_mgr

                try:
                    # Get credential details - include both general and user's private credentials
                    general_creds = cred_mgr.list_credentials(
                        include_expired=False, source="general"
                    )
                    private_creds = cred_mgr.list_credentials(
                        include_expired=False, source="private"
                    )
                    user_private = [
                        c
                        for c in private_creds
                        if c.get("owner") == current_user["username"]
                    ]
                    credentials = general_creds + user_private

                    credential = next(
                        (c for c in credentials if c["id"] == request.credential_id),
                        None,
                    )

                    if not credential:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Credential with ID {request.credential_id} not found or not accessible",
                        )

                    if credential["type"] != "ssh":
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Credential must be of type 'ssh', got '{credential['type']}'",
                        )

                    username = credential["username"]
                    password = cred_mgr.get_decrypted_password(request.credential_id)

                    if not password:
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Failed to decrypt credential password",
                        )

                except HTTPException:
                    raise
                except Exception as e:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Error retrieving credential: {str(e)}",
                    )
            elif not username or not password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Either credential_id or both username and password must be provided for non-dry-run execution",
                )

        # Generate session ID
        session_id = request.session_id or str(uuid.uuid4())

        # Register session for cancellation support
        netmiko_service.register_session(session_id)

        results = []
        rendered_count = 0
        executed_count = 0
        failed_count = 0
        cancelled_count = 0

        # Process each device
        for device_id in request.device_ids:
            # Check for cancellation
            if netmiko_service.is_session_cancelled(session_id):
                logger.info(f"Session {session_id} cancelled, stopping execution")
                cancelled_count += 1
                results.append(
                    TemplateExecutionResult(
                        device_id=device_id,
                        device_name="Unknown",
                        success=False,
                        error="Execution cancelled by user",
                    )
                )
                continue

            try:
                # Get device details from Nautobot
                query = """
                query DeviceDetails($deviceId: ID!) {
                    device(id: $deviceId) {
                        id
                        name
                        primary_ip4 {
                            address
                            host
                        }
                        platform {
                            name
                        }
                    }
                }
                """
                variables = {"deviceId": device_id}
                nautobot_response = await nautobot_service.graphql_query(
                    query, variables
                )

                if (
                    not nautobot_response
                    or "data" not in nautobot_response
                    or not nautobot_response["data"].get("device")
                ):
                    failed_count += 1
                    results.append(
                        TemplateExecutionResult(
                            device_id=device_id,
                            device_name="Unknown",
                            success=False,
                            error=f"Device {device_id} not found in Nautobot",
                        )
                    )
                    continue

                device = nautobot_response["data"]["device"]
                device_name = device.get("name", "Unknown")

                # Render template
                try:
                    render_result = await render_service.render_template(
                        template_content=template_content,
                        category="netmiko",
                        device_id=device_id,
                        user_variables=request.user_variables,
                        use_nautobot_context=request.use_nautobot_context,
                    )
                    rendered_content = render_result["rendered_content"]
                    rendered_count += 1
                except Exception as render_error:
                    failed_count += 1
                    results.append(
                        TemplateExecutionResult(
                            device_id=device_id,
                            device_name=device_name,
                            success=False,
                            error=f"Template rendering failed: {str(render_error)}",
                        )
                    )
                    continue

                # If dry run, just return rendered content
                if request.dry_run:
                    results.append(
                        TemplateExecutionResult(
                            device_id=device_id,
                            device_name=device_name,
                            success=True,
                            rendered_content=rendered_content,
                        )
                    )
                    continue

                # Execute rendered commands on device
                try:
                    # Check for cancellation before execution
                    if netmiko_service.is_session_cancelled(session_id):
                        logger.info(
                            f"Session {session_id} cancelled before executing on {device_name}"
                        )
                        cancelled_count += 1
                        results.append(
                            TemplateExecutionResult(
                                device_id=device_id,
                                device_name=device_name,
                                success=False,
                                rendered_content=rendered_content,
                                error="Execution cancelled by user",
                            )
                        )
                        continue

                    # Get device connection details
                    device_ip = device.get("primary_ip4", {}).get("host")
                    if not device_ip:
                        failed_count += 1
                        results.append(
                            TemplateExecutionResult(
                                device_id=device_id,
                                device_name=device_name,
                                success=False,
                                rendered_content=rendered_content,
                                error="Device has no primary IP address",
                            )
                        )
                        continue

                    platform = device.get("platform", {}).get("name", "cisco_ios")

                    # Convert rendered content to command list
                    commands = [
                        line.strip()
                        for line in rendered_content.split("\n")
                        if line.strip()
                    ]

                    # Execute commands
                    execution_result = await netmiko_service.execute_commands_on_device(
                        device_ip=device_ip,
                        platform=platform,
                        username=username,
                        password=password,
                        commands=commands,
                        enable_mode=request.enable_mode,
                        write_config=request.write_config,
                        session_id=session_id,
                    )

                    if execution_result["success"]:
                        executed_count += 1
                        results.append(
                            TemplateExecutionResult(
                                device_id=device_id,
                                device_name=device_name,
                                success=True,
                                rendered_content=rendered_content,
                                output=execution_result["output"],
                            )
                        )
                    else:
                        failed_count += 1
                        results.append(
                            TemplateExecutionResult(
                                device_id=device_id,
                                device_name=device_name,
                                success=False,
                                rendered_content=rendered_content,
                                error=execution_result.get("error", "Execution failed"),
                            )
                        )

                except Exception as exec_error:
                    failed_count += 1
                    results.append(
                        TemplateExecutionResult(
                            device_id=device_id,
                            device_name=device_name,
                            success=False,
                            rendered_content=rendered_content,
                            error=f"Execution failed: {str(exec_error)}",
                        )
                    )

            except Exception as e:
                failed_count += 1
                results.append(
                    TemplateExecutionResult(
                        device_id=device_id,
                        device_name="Unknown",
                        success=False,
                        error=f"Unexpected error: {str(e)}",
                    )
                )

        # Unregister session
        netmiko_service.unregister_session(session_id)

        # Build summary
        summary = {
            "total": len(request.device_ids),
            "rendered_successfully": rendered_count,
            "failed": failed_count,
            "cancelled": cancelled_count,
        }

        if not request.dry_run:
            summary["executed_successfully"] = executed_count

        return TemplateExecutionResponse(
            session_id=session_id, results=results, summary=summary
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Template execution failed: {str(e)}",
        )


@router.get("/health")
async def health_check(
    current_user: dict = Depends(require_permission("network.netmiko", "execute")),
) -> Dict[str, str]:
    """
    Health check endpoint for Netmiko service.

    Args:
        current_user: Current authenticated user

    Returns:
        Health status
    """
    return {"status": "healthy", "service": "netmiko"}
