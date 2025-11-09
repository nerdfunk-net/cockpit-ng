"""
Netmiko router for executing commands on network devices.
"""

from __future__ import annotations
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.auth import get_current_username
from services.netmiko_service import netmiko_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/netmiko", tags=["netmiko"])


class DeviceCommand(BaseModel):
    """Model for device command execution request."""

    devices: List[Dict[str, str]] = Field(
        ...,
        description="List of devices with 'ip' or 'primary_ip4' and 'platform' fields"
    )
    commands: List[str] = Field(
        ...,
        description="List of commands to execute",
        min_items=1
    )
    credential_id: int | None = Field(
        default=None,
        description="ID of stored credential to use (optional)"
    )
    username: str | None = Field(
        default=None,
        description="SSH username (required if credential_id not provided)"
    )
    password: str | None = Field(
        default=None,
        description="SSH password (required if credential_id not provided)"
    )
    enable_mode: bool = Field(
        default=False,
        description="Whether to enter config mode after login"
    )
    write_config: bool = Field(
        default=False,
        description="Whether to save config to startup after successful execution"
    )
    session_id: str | None = Field(
        default=None,
        description="Optional session ID for cancellation support"
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


@router.post("/execute-commands", response_model=CommandExecutionResponse)
async def execute_commands(
    request: DeviceCommand,
    current_user: str = Depends(get_current_username)
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
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No devices provided"
            )

        if not request.commands:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No commands provided"
            )

        # Get credentials - either from stored credential or manual entry
        username = request.username
        password = request.password

        if request.credential_id is not None:
            # Use stored credential
            logger.info(f"Using stored credential ID: {request.credential_id}")
            import credentials_manager as cred_mgr

            try:
                # Get credential details
                credentials = cred_mgr.list_credentials(include_expired=False, source="general")
                credential = next((c for c in credentials if c["id"] == request.credential_id), None)

                if not credential:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Credential with ID {request.credential_id} not found"
                    )

                if credential["type"] != "ssh":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Credential must be of type 'ssh', got '{credential['type']}'"
                    )

                # Get decrypted password
                username = credential["username"]
                password = cred_mgr.get_decrypted_password(request.credential_id)

                if not password:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to decrypt credential password"
                    )

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error loading stored credential: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to load stored credential: {str(e)}"
                )
        else:
            # Use manual credentials
            if not username or not password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username and password are required when not using stored credentials"
                )

        # Execute commands on all devices
        session_id, results = await netmiko_service.execute_commands(
            devices=request.devices,
            commands=request.commands,
            username=username,
            password=password,
            enable_mode=request.enable_mode,
            write_config=request.write_config,
            session_id=request.session_id
        )

        # Convert results to response model
        command_results = [
            CommandResult(
                device=r["device"],
                success=r["success"],
                output=r["output"],
                error=r.get("error")
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
            cancelled=cancelled
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing commands: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute commands: {str(e)}"
        )


@router.get("/supported-platforms")
async def get_supported_platforms(
    current_user: str = Depends(get_current_username)
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

        return {
            "platforms": platforms,
            "total": len(platforms)
        }

    except Exception as e:
        logger.error(f"Error getting supported platforms: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get supported platforms: {str(e)}"
        )


@router.post("/cancel/{session_id}")
async def cancel_execution(
    session_id: str,
    current_user: str = Depends(get_current_username)
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
            "session_id": session_id
        }
    except Exception as e:
        logger.error(f"Error cancelling session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel session: {str(e)}"
        )


@router.get("/health")
async def health_check(current_user: str = Depends(get_current_username)) -> Dict[str, str]:
    """
    Health check endpoint for Netmiko service.

    Args:
        current_user: Current authenticated user

    Returns:
        Health status
    """
    return {
        "status": "healthy",
        "service": "netmiko"
    }
