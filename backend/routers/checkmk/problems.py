"""
CheckMK problems router — 6 endpoints.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_checkmk_problems_service
from models.checkmk import (
    CheckMKAcknowledgeHostRequest,
    CheckMKAcknowledgeServiceRequest,
    CheckMKDowntimeRequest,
    CheckMKCommentRequest,
    CheckMKOperationResponse,
)
from services.checkmk.exceptions import CheckMKClientError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["checkmk"])


@router.post("/acknowledge/host", response_model=CheckMKOperationResponse)
async def acknowledge_host_problem(
    request: CheckMKAcknowledgeHostRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_problems_service),
):
    """Acknowledge host problem."""
    try:
        result = await service.acknowledge_host_problem(request)
        return CheckMKOperationResponse(
            success=True,
            message=f"Acknowledged problem for host {request.host_name} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error acknowledging problem for host %s: %s", request.host_name, str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to acknowledge problem for host {request.host_name}: {str(e)}",
        )


@router.post("/acknowledge/service", response_model=CheckMKOperationResponse)
async def acknowledge_service_problem(
    request: CheckMKAcknowledgeServiceRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_problems_service),
):
    """Acknowledge service problem."""
    try:
        result = await service.acknowledge_service_problem(request)
        return CheckMKOperationResponse(
            success=True,
            message=f"Acknowledged problem for service {request.service_description} on host {request.host_name} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error acknowledging service problem: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to acknowledge service problem: {str(e)}",
        )


@router.delete("/acknowledge/{ack_id}", response_model=CheckMKOperationResponse)
async def delete_acknowledgment(
    ack_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "delete")),
    service=Depends(get_checkmk_problems_service),
):
    """Delete acknowledgment."""
    try:
        await service.delete_acknowledgment(ack_id)
        return CheckMKOperationResponse(
            success=True, message=f"Deleted acknowledgment {ack_id} successfully"
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting acknowledgment %s: %s", ack_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete acknowledgment {ack_id}: {str(e)}",
        )


@router.post("/downtime/host", response_model=CheckMKOperationResponse)
async def create_host_downtime(
    request: CheckMKDowntimeRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_problems_service),
):
    """Create downtime for host."""
    try:
        result = await service.create_host_downtime(request)
        return CheckMKOperationResponse(
            success=True,
            message=f"Created downtime for host {request.host_name} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error creating downtime for host %s: %s", request.host_name, str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create downtime for host {request.host_name}: {str(e)}",
        )


@router.post("/comments/host", response_model=CheckMKOperationResponse)
async def add_host_comment(
    request: CheckMKCommentRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_problems_service),
):
    """Add comment to host."""
    try:
        result = await service.add_host_comment(request)
        return CheckMKOperationResponse(
            success=True,
            message=f"Added comment to host {request.host_name} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error adding comment to host %s: %s", request.host_name, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add comment to host {request.host_name}: {str(e)}",
        )


@router.post("/comments/service", response_model=CheckMKOperationResponse)
async def add_service_comment(
    request: CheckMKCommentRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_problems_service),
):
    """Add comment to service."""
    try:
        result = await service.add_service_comment(request)
        return CheckMKOperationResponse(
            success=True,
            message=f"Added comment to service {request.service_description} on host {request.host_name} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error adding comment to service: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add comment to service: {str(e)}",
        )
