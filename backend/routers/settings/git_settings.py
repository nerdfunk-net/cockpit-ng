"""
Git connection settings router.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from repositories.audit_log_repository import audit_log_repo
from models.settings import GitSettingsRequest, GitTestRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/git")
async def get_git_settings(
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Get Git settings."""
    try:
        from settings_manager import settings_manager

        git_settings = settings_manager.get_git_settings()
        return {"success": True, "data": git_settings}

    except Exception as e:
        logger.error("Error getting Git settings: %s", e)
        return {
            "success": False,
            "message": f"Failed to retrieve Git settings: {str(e)}",
        }


@router.put("/git")
async def update_git_settings(
    git_request: GitSettingsRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Update Git settings."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_git_settings(git_request.dict())

        if success:
            audit_log_repo.create_log(
                username=current_user.get("sub"),
                user_id=current_user.get("user_id"),
                event_type="settings-git-updated",
                message="Git connection settings updated",
                resource_type="settings",
                resource_name="git",
                severity="info",
            )
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
        logger.error("Error updating Git settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update Git settings: {str(e)}",
        )


@router.post("/git")
async def create_git_settings(
    git_request: GitSettingsRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Create/Update Git settings via POST."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_git_settings(git_request.dict())

        if success:
            audit_log_repo.create_log(
                username=current_user.get("sub"),
                user_id=current_user.get("user_id"),
                event_type="settings-git-updated",
                message="Git connection settings updated",
                resource_type="settings",
                resource_name="git",
                severity="info",
            )
            return {
                "success": True,
                "message": "Git settings updated successfully",
                "data": settings_manager.get_git_settings(),
            }
        else:
            return {"success": False, "message": "Failed to update Git settings"}

    except Exception as e:
        logger.error("Error updating Git settings: %s", e)
        return {"success": False, "message": f"Failed to update Git settings: {str(e)}"}


@router.post("/test/git")
async def test_git_connection(
    test_request: GitTestRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
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
        logger.error("Error testing Git connection: %s", e)
        return {
            "success": False,
            "message": f"Test failed: {str(e)}",
            "tested_repo": test_request.repo_url,
            "tested_branch": test_request.branch,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
