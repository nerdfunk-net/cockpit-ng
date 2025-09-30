"""
Settings router for application configuration management.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import verify_admin_token
from models.settings import (
    NautobotSettingsRequest,
    GitSettingsRequest,
    CheckMKSettingsRequest,
    AllSettingsRequest,
    ConnectionTestRequest,
    CheckMKTestRequest,
    GitTestRequest,
    CacheSettingsRequest,
    NautobotDefaultsRequest,
    DeviceOffboardingRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
async def get_all_settings(current_user: dict = Depends(verify_admin_token)):
    """Get all application settings."""
    try:
        from settings_manager import settings_manager

        settings_data = settings_manager.get_all_settings()

        # Check if database was recovered from corruption
        metadata = settings_data.get("metadata", {})
        if metadata.get("status") == "recovered":
            return {
                "settings": settings_data,
                "warning": metadata.get(
                    "message", "Database was recovered from corruption"
                ),
                "recovery_performed": True,
            }

        return {"settings": settings_data}

    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve settings: {str(e)}",
        )


@router.get("/nautobot")
async def get_nautobot_settings(current_user: dict = Depends(verify_admin_token)):
    """Get Nautobot settings."""
    try:
        from settings_manager import settings_manager

        nautobot_settings = settings_manager.get_nautobot_settings()
        return {"success": True, "data": nautobot_settings}

    except Exception as e:
        logger.error(f"Error getting Nautobot settings: {e}")
        return {
            "success": False,
            "message": f"Failed to retrieve Nautobot settings: {str(e)}",
        }


@router.get("/git")
async def get_git_settings(current_user: dict = Depends(verify_admin_token)):
    """Get Git settings."""
    try:
        from settings_manager import settings_manager

        git_settings = settings_manager.get_git_settings()
        return {"success": True, "data": git_settings}

    except Exception as e:
        logger.error(f"Error getting Git settings: {e}")
        return {
            "success": False,
            "message": f"Failed to retrieve Git settings: {str(e)}",
        }


@router.get("/cache")
async def get_cache_settings(current_user: dict = Depends(verify_admin_token)):
    """Get Cache settings."""
    try:
        from settings_manager import settings_manager

        cache_settings = settings_manager.get_cache_settings()
        return {"success": True, "data": cache_settings}
    except Exception as e:
        logger.error(f"Error getting Cache settings: {e}")
        return {
            "success": False,
            "message": f"Failed to retrieve Cache settings: {str(e)}",
        }


@router.put("/cache")
async def update_cache_settings(
    cache_request: CacheSettingsRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Update Cache settings."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_cache_settings(cache_request.dict())
        if success:
            updated = settings_manager.get_cache_settings()
            return {
                "success": True,
                "message": "Cache settings updated successfully",
                "data": updated,
                "cache": updated,  # backward compatibility
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update Cache settings",
            )
    except Exception as e:
        logger.error(f"Error updating Cache settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update Cache settings: {str(e)}",
        )


@router.post("/cache")
async def create_cache_settings(
    cache_request: CacheSettingsRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Create/Update Cache settings via POST."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_cache_settings(cache_request.dict())
        if success:
            updated = settings_manager.get_cache_settings()
            return {
                "success": True,
                "message": "Cache settings updated successfully",
                "data": updated,
                "cache": updated,  # backward compatibility
            }
        else:
            return {"success": False, "message": "Failed to update Cache settings"}
    except Exception as e:
        logger.error(f"Error updating Cache settings: {e}")
        return {
            "success": False,
            "message": f"Failed to update Cache settings: {str(e)}",
        }


@router.put("")
async def update_all_settings(
    settings_request: AllSettingsRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Update all application settings."""
    try:
        from settings_manager import settings_manager

        settings_dict = {
            "nautobot": settings_request.nautobot.dict(),
            "git": settings_request.git.dict(),
        }
        if settings_request.cache is not None:
            settings_dict["cache"] = settings_request.cache.dict()

        success = settings_manager.update_all_settings(settings_dict)

        if success:
            return {
                "message": "Settings updated successfully",
                "settings": settings_manager.get_all_settings(),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update settings",
            )

    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update settings: {str(e)}",
        )


@router.put("/nautobot")
async def update_nautobot_settings(
    nautobot_request: NautobotSettingsRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Update Nautobot settings."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_nautobot_settings(nautobot_request.dict())

        if success:
            return {
                "message": "Nautobot settings updated successfully",
                "nautobot": settings_manager.get_nautobot_settings(),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update Nautobot settings",
            )

    except Exception as e:
        logger.error(f"Error updating Nautobot settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update Nautobot settings: {str(e)}",
        )


@router.put("/git")
async def update_git_settings(
    git_request: GitSettingsRequest, current_user: dict = Depends(verify_admin_token)
):
    """Update Git settings."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_git_settings(git_request.dict())

        if success:
            return {
                "message": "Git settings updated successfully",
                "git": settings_manager.get_git_settings(),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update Git settings",
            )

    except Exception as e:
        logger.error(f"Error updating Git settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update Git settings: {str(e)}",
        )


# POST endpoints for settings (to match frontend expectations)
@router.post("/nautobot")
async def create_nautobot_settings(
    nautobot_request: NautobotSettingsRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Create/Update Nautobot settings via POST."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_nautobot_settings(nautobot_request.dict())

        if success:
            return {
                "success": True,
                "message": "Nautobot settings updated successfully",
                "data": settings_manager.get_nautobot_settings(),
            }
        else:
            return {"success": False, "message": "Failed to update Nautobot settings"}

    except Exception as e:
        logger.error(f"Error updating Nautobot settings: {e}")
        return {
            "success": False,
            "message": f"Failed to update Nautobot settings: {str(e)}",
        }


@router.post("/git")
async def create_git_settings(
    git_request: GitSettingsRequest, current_user: dict = Depends(verify_admin_token)
):
    """Create/Update Git settings via POST."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_git_settings(git_request.dict())

        if success:
            return {
                "success": True,
                "message": "Git settings updated successfully",
                "data": settings_manager.get_git_settings(),
            }
        else:
            return {"success": False, "message": "Failed to update Git settings"}

    except Exception as e:
        logger.error(f"Error updating Git settings: {e}")
        return {"success": False, "message": f"Failed to update Git settings: {str(e)}"}


@router.post("/test/nautobot")
async def test_nautobot_connection(
    test_request: ConnectionTestRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Test Nautobot connection with provided settings."""
    try:
        from connection_tester import connection_tester

        success, message = await connection_tester.test_nautobot_connection(
            test_request.dict()
        )

        return {
            "success": success,
            "message": message,
            "tested_url": test_request.url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Error testing Nautobot connection: {e}")
        return {
            "success": False,
            "message": f"Test failed: {str(e)}",
            "tested_url": test_request.url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@router.get("/checkmk")
async def get_checkmk_settings(current_user: dict = Depends(verify_admin_token)):
    """Get CheckMK settings."""
    try:
        from settings_manager import settings_manager

        settings_data = settings_manager.get_checkmk_settings()
        return {"success": True, "data": settings_data}

    except Exception as e:
        logger.error(f"Error getting CheckMK settings: {e}")
        return {
            "success": False,
            "message": f"Failed to get CheckMK settings: {str(e)}",
        }


@router.post("/checkmk")
async def create_checkmk_settings(
    checkmk_request: CheckMKSettingsRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Create/Update CheckMK settings via POST."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_checkmk_settings(checkmk_request.dict())

        if success:
            return {
                "success": True,
                "message": "CheckMK settings updated successfully",
                "data": settings_manager.get_checkmk_settings(),
            }
        else:
            return {"success": False, "message": "Failed to update CheckMK settings"}

    except Exception as e:
        logger.error(f"Error updating CheckMK settings: {e}")
        return {
            "success": False,
            "message": f"Failed to update CheckMK settings: {str(e)}",
        }


@router.post("/test/checkmk")
async def test_checkmk_connection(
    test_request: CheckMKTestRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Test CheckMK connection with provided settings."""
    try:
        from services.checkmk import checkmk_service

        success, message = await checkmk_service.test_connection(
            test_request.url,
            test_request.site,
            test_request.username,
            test_request.password,
            test_request.verify_ssl,
        )

        return {
            "success": success,
            "message": message,
            "tested_url": test_request.url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Error testing CheckMK connection: {e}")
        return {
            "success": False,
            "message": f"Test failed: {str(e)}",
            "tested_url": test_request.url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@router.post("/test/git")
async def test_git_connection(
    test_request: GitTestRequest, current_user: dict = Depends(verify_admin_token)
):
    """Test Git connection with provided settings."""
    try:
        from connection_tester import connection_tester

        success, message = await connection_tester.test_git_connection(
            test_request.dict()
        )

        return {
            "success": success,
            "message": message,
            "tested_repo": test_request.repo_url,
            "tested_branch": test_request.branch,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Error testing Git connection: {e}")
        return {
            "success": False,
            "message": f"Test failed: {str(e)}",
            "tested_repo": test_request.repo_url,
            "tested_branch": test_request.branch,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@router.post("/reset")
async def reset_settings_to_defaults(current_user: dict = Depends(verify_admin_token)):
    """Reset all settings to default values."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.reset_to_defaults()

        if success:
            return {
                "message": "Settings reset to defaults successfully",
                "settings": settings_manager.get_all_settings(),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reset settings to defaults",
            )

    except Exception as e:
        logger.error(f"Error resetting settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset settings: {str(e)}",
        )


@router.get("/health")
async def check_settings_health(current_user: dict = Depends(verify_admin_token)):
    """Check settings database health."""
    try:
        from settings_manager import settings_manager

        health_info = settings_manager.health_check()

        if health_info["status"] == "healthy":
            return health_info
        else:
            # Database is unhealthy, try to recover
            recovery_result = settings_manager._handle_database_corruption()
            return {
                **health_info,
                "recovery_attempted": True,
                "recovery_result": recovery_result,
            }

    except Exception as e:
        logger.error(f"Settings health check failed: {e}")
        return {
            "status": "error",
            "message": f"Health check failed: {str(e)}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# Legacy template settings endpoints for backward compatibility
@router.get("/templates")
async def get_template_settings(current_user: dict = Depends(verify_admin_token)):
    """Get template settings (legacy endpoint - redirects to new template management)."""
    return {
        "message": "Template settings have been moved to /api/templates",
        "redirect_url": "/api/templates",
        "legacy": True,
    }


@router.post("/templates")
async def update_template_settings(
    template_data: dict, current_user: dict = Depends(verify_admin_token)
):
    """Update template settings (legacy endpoint - redirects to new template management)."""
    return {
        "message": "Template settings have been moved to /api/templates",
        "redirect_url": "/api/templates",
        "legacy": True,
        "note": "Please use the new template management interface",
    }


@router.get("/nautobot/defaults")
async def get_nautobot_defaults(current_user: dict = Depends(verify_admin_token)):
    """Get Nautobot default settings."""
    try:
        from settings_manager import settings_manager

        defaults = settings_manager.get_nautobot_defaults()
        return {"success": True, "data": defaults}

    except Exception as e:
        logger.error(f"Error getting Nautobot defaults: {e}")
        return {
            "success": False,
            "message": f"Failed to retrieve Nautobot defaults: {str(e)}",
        }


@router.post("/nautobot/defaults")
async def update_nautobot_defaults(
    defaults_request: NautobotDefaultsRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Update Nautobot default settings."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_nautobot_defaults(defaults_request.dict())

        if success:
            return {
                "success": True,
                "message": "Nautobot defaults updated successfully",
                "data": settings_manager.get_nautobot_defaults(),
            }
        else:
            return {"success": False, "message": "Failed to update Nautobot defaults"}

    except Exception as e:
        logger.error(f"Error updating Nautobot defaults: {e}")
        return {
            "success": False,
            "message": f"Failed to update Nautobot defaults: {str(e)}",
        }


@router.get("/offboarding")
async def get_device_offboarding_settings(
    current_user: dict = Depends(verify_admin_token),
):
    """Get device offboarding settings."""
    try:
        from settings_manager import settings_manager

        offboarding_settings = settings_manager.get_device_offboarding_settings()
        return {"success": True, "data": offboarding_settings}

    except Exception as e:
        logger.error(f"Error getting device offboarding settings: {e}")
        return {
            "success": False,
            "message": f"Failed to retrieve device offboarding settings: {str(e)}",
        }


@router.post("/offboarding")
async def update_device_offboarding_settings(
    offboarding_request: DeviceOffboardingRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Update device offboarding settings."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_device_offboarding_settings(
            offboarding_request.dict()
        )

        if success:
            return {
                "success": True,
                "message": "Device offboarding settings updated successfully",
                "data": settings_manager.get_device_offboarding_settings(),
            }
        else:
            return {
                "success": False,
                "message": "Failed to update device offboarding settings",
            }

    except Exception as e:
        logger.error(f"Error updating device offboarding settings: {e}")
        return {
            "success": False,
            "message": f"Failed to update device offboarding settings: {str(e)}",
        }
