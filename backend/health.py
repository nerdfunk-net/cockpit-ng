"""
Health check endpoint for monitoring container health.
"""

import os
from datetime import datetime

from fastapi import APIRouter

router = APIRouter()


@router.get("/api/health")
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "service": "cockpit-ng-backend",
        "version": "1.0.0",
        "environment": os.getenv("ENV", "development"),
    }
