"""
CheckMK router for settings and API interactions.
"""

from __future__ import annotations
import logging
import json
import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import verify_admin_token
from models.checkmk import CheckMKTestConnectionRequest, CheckMKTestConnectionResponse
from services.checkmk import checkmk_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/checkmk", tags=["checkmk"])


@router.post("/test", response_model=CheckMKTestConnectionResponse)
async def test_checkmk_connection(
    request: CheckMKTestConnectionRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Test CheckMK connection with provided settings."""
    try:
        success, message = await checkmk_service.test_connection(
            request.url,
            request.site,
            request.username,
            request.password,
            request.verify_ssl,
        )

        return CheckMKTestConnectionResponse(
            success=success,
            message=message,
            checkmk_url=request.url,
            connection_source="manual_test"
        )
    except Exception as e:
        logger.error(f"Error testing CheckMK connection: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test CheckMK connection: {str(e)}",
        )


@router.get("/test")
async def test_current_checkmk_connection(
    current_user: dict = Depends(verify_admin_token),
):
    """Test current CheckMK connection using saved settings."""
    try:
        # Get checkmk config from database
        from settings_manager import settings_manager

        db_settings = settings_manager.get_checkmk_settings()
        if not db_settings or not db_settings.get("url") or not db_settings.get("site") or not db_settings.get("username"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CheckMK settings not configured. Please configure CheckMK settings first."
            )

        success, message = await checkmk_service.test_connection(
            db_settings["url"],
            db_settings["site"],
            db_settings["username"],
            db_settings["password"],
            db_settings.get("verify_ssl", True),
        )

        return {
            "success": success,
            "message": message,
            "checkmk_url": db_settings["url"],
            "connection_source": "database",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing CheckMK connection: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test CheckMK connection: {str(e)}",
        )

@router.get("/stats")
async def get_checkmk_stats(current_user: dict = Depends(verify_admin_token)):
    """Get CheckMK statistics with 10-minute caching."""
    # Cache configuration
    cache_duration = timedelta(minutes=10)
    cache_dir = "data/cache"
    cache_file = os.path.join(cache_dir, "checkmk_stats.json")

    # Ensure cache directory exists
    os.makedirs(cache_dir, exist_ok=True)

    # Check if cache exists and is still valid
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r") as f:
                cache_data = json.load(f)

            cache_timestamp = datetime.fromisoformat(
                cache_data.get("cache_timestamp", "")
            )
            if datetime.now(timezone.utc) - cache_timestamp < cache_duration:
                logger.info("Returning cached CheckMK stats")
                # Remove cache metadata before returning
                stats = cache_data.copy()
                del stats["cache_timestamp"]
                return stats
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(f"Invalid CheckMK cache file, will refresh: {e}")

    logger.info("CheckMK cache expired or missing, fetching fresh stats")

    try:
        # Get CheckMK settings from database
        from settings_manager import settings_manager
        
        db_settings = settings_manager.get_checkmk_settings()
        if not db_settings or not db_settings.get("url") or not db_settings.get("site") or not db_settings.get("username"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CheckMK settings not configured. Please configure CheckMK settings first."
            )

        # Import CheckMK client
        from checkmk.client import CheckMKClient, CheckMKAPIError
        from urllib.parse import urlparse

        # Parse URL
        url = db_settings["url"].rstrip('/')
        if url.startswith(('http://', 'https://')):
            parsed_url = urlparse(url)
            protocol = parsed_url.scheme
            host = parsed_url.netloc
        else:
            protocol = 'https'
            host = url

        # Create CheckMK client
        client = CheckMKClient(
            host=host,
            site_name=db_settings["site"],
            username=db_settings["username"],
            password=db_settings["password"],
            protocol=protocol,
            verify_ssl=db_settings.get("verify_ssl", True),
            timeout=30
        )

        # Get all hosts and count them
        hosts_data = client.get_all_hosts()
        host_count = len(hosts_data.get("value", []))
        
        logger.info(f"Retrieved {host_count} hosts from CheckMK")

        stats = {
            "total_hosts": host_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Save to cache with timestamp
        cache_data = stats.copy()
        cache_data["cache_timestamp"] = datetime.now(timezone.utc).isoformat()

        try:
            with open(cache_file, "w") as f:
                json.dump(cache_data, f)
            logger.info("CheckMK stats cached successfully")
        except Exception as cache_error:
            logger.warning(f"Failed to cache CheckMK stats: {cache_error}")

        return stats
        
    except CheckMKAPIError as e:
        logger.error(f"CheckMK API error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"CheckMK API error: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching CheckMK stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch CheckMK statistics: {str(e)}",
        )

