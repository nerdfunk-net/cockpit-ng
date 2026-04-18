"""
CheckMK monitoring router — 4 endpoints.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_checkmk_monitoring_service
from models.checkmk import CheckMKServiceQueryRequest, CheckMKOperationResponse
from services.checkmk.exceptions import CheckMKClientError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["checkmk"])


@router.get("/monitoring/hosts", response_model=CheckMKOperationResponse)
async def get_all_monitored_hosts(
    request: CheckMKServiceQueryRequest = None,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_monitoring_service),
):
    """Get all monitored hosts with status information."""
    try:
        columns = request.columns if request else None
        query = request.query if request else None
        result = await service.get_all_monitored_hosts(columns=columns, query=query)
        return CheckMKOperationResponse(
            success=True, message="Retrieved monitored hosts successfully", data=result
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting monitored hosts: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get monitored hosts: {str(e)}",
        )


@router.get("/monitoring/hosts/{hostname}", response_model=CheckMKOperationResponse)
async def get_monitored_host(
    hostname: str,
    request: CheckMKServiceQueryRequest = None,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_monitoring_service),
):
    """Get monitored host with status information."""
    try:
        columns = request.columns if request else None
        result = await service.get_monitored_host(hostname, columns=columns)
        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved monitoring data for host {hostname} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting monitored host %s: %s", hostname, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get monitored host {hostname}: {str(e)}",
        )


@router.get("/hosts/{hostname}/services", response_model=CheckMKOperationResponse)
async def get_host_services(
    hostname: str,
    request: CheckMKServiceQueryRequest = None,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_monitoring_service),
):
    """Get services for a specific host."""
    try:
        columns = request.columns if request else None
        query = request.query if request else None
        result = await service.get_host_services(hostname, columns=columns, query=query)
        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved services for host {hostname} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting services for host %s: %s", hostname, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get services for host {hostname}: {str(e)}",
        )


@router.post(
    "/hosts/{hostname}/services/{service}/show",
    response_model=CheckMKOperationResponse,
)
async def show_service(
    hostname: str,
    service: str,
    request: CheckMKServiceQueryRequest = None,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    monitoring_service=Depends(get_checkmk_monitoring_service),
):
    """Show specific service details."""
    try:
        columns = request.columns if request else None
        result = await monitoring_service.show_service(hostname, service, columns=columns)
        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved service {service} details for host {hostname} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error showing service %s for host %s: %s", service, hostname, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to show service {service} for host {hostname}: {str(e)}",
        )
