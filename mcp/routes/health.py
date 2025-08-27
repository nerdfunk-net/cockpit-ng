"""
Health check endpoint for MCP server.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from services.client import CockpitAPIClient
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    timestamp: str
    uptime: str
    version: str = "1.0.0"
    checks: dict


# Track server start time
server_start_time = datetime.utcnow()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    current_time = datetime.utcnow()
    uptime = str(current_time - server_start_time)
    
    checks = {
        "server": "ok",
        "cockpit_api": "unknown",
        "config": "ok"
    }
    
    overall_status = "ok"
    
    # Check Cockpit API connectivity
    try:
        async with CockpitAPIClient() as client:
            # Try to hit the health endpoint of the main backend
            await client.get("/health")
        checks["cockpit_api"] = "ok"
    except httpx.ConnectError:
        checks["cockpit_api"] = "connection_error"
        overall_status = "degraded"
        logger.warning("Cannot connect to Cockpit API")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            # Health endpoint might not exist, but connection works
            checks["cockpit_api"] = "ok"
        else:
            checks["cockpit_api"] = f"http_error_{e.response.status_code}"
            overall_status = "degraded"
            logger.warning(f"Cockpit API health check failed: {e}")
    except Exception as e:
        checks["cockpit_api"] = "error"
        overall_status = "degraded"
        logger.error(f"Cockpit API health check error: {e}")
    
    # Return appropriate status code
    status_code = status.HTTP_200_OK
    if overall_status == "error":
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    elif overall_status == "degraded":
        status_code = status.HTTP_200_OK  # Still operational but with warnings
    
    return HealthResponse(
        status=overall_status,
        timestamp=current_time.isoformat(),
        uptime=uptime,
        checks=checks
    )


@router.get("/readyz")
async def readiness_check():
    """Readiness check endpoint."""
    # For now, just return the same as health check
    # In production, this could have stricter requirements
    health_result = await health_check()
    
    if health_result.status == "error":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not ready"
        )
    
    return health_result