"""
Agents settings router.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.settings import AgentsSettingsRequest, AgentsTestRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/agents")
async def get_agents_settings(
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Get Agents settings."""
    try:
        from settings_manager import settings_manager

        settings = settings_manager.get_agents_settings()

        return {"success": True, "data": settings}

    except Exception as e:
        logger.error("Error getting Agents settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Agents settings: {str(e)}",
        )


@router.post("/agents")
async def create_agents_settings(
    agents_request: AgentsSettingsRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Create/Update Agents settings via POST."""
    try:
        from settings_manager import settings_manager

        settings_dict = agents_request.dict()
        success = settings_manager.update_agents_settings(settings_dict)

        if success:
            return {
                "success": True,
                "message": "Agents settings updated successfully",
                "data": settings_manager.get_agents_settings(),
            }
        else:
            return {
                "success": False,
                "message": "Failed to update Agents settings",
            }

    except Exception as e:
        logger.error("Error creating/updating Agents settings: %s", e)
        return {
            "success": False,
            "message": f"Failed to update Agents settings: {str(e)}",
        }


@router.post("/test/agents")
async def test_agents_connection(
    test_request: AgentsTestRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Test Agents connection with provided settings."""
    try:
        import os
        import paramiko
        from pathlib import Path

        deployment_method = test_request.deployment_method

        if deployment_method == "local":
            if not test_request.local_root_path:
                return {
                    "success": False,
                    "message": "Local root path is required",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

            path = Path(test_request.local_root_path)
            if not path.exists():
                return {
                    "success": False,
                    "message": f"Path does not exist: {test_request.local_root_path}",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

            if not path.is_dir():
                return {
                    "success": False,
                    "message": f"Path is not a directory: {test_request.local_root_path}",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

            if not os.access(test_request.local_root_path, os.W_OK):
                return {
                    "success": False,
                    "message": f"No write permission: {test_request.local_root_path}",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

            return {
                "success": True,
                "message": f"Local path is accessible: {test_request.local_root_path}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        elif deployment_method == "sftp":
            if not test_request.sftp_hostname:
                return {
                    "success": False,
                    "message": "SFTP hostname is required",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

            try:
                ssh = paramiko.SSHClient()
                ssh.load_system_host_keys()
                ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
                ssh.connect(
                    hostname=test_request.sftp_hostname,
                    port=test_request.sftp_port or 22,
                    username=test_request.sftp_username,
                    password=test_request.sftp_password,
                    timeout=10,
                )

                sftp = ssh.open_sftp()
                if test_request.sftp_path:
                    sftp.chdir(test_request.sftp_path)

                sftp.close()
                ssh.close()

                return {
                    "success": True,
                    "message": f"SFTP connection successful to {test_request.sftp_hostname}",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

            except Exception as sftp_error:
                return {
                    "success": False,
                    "message": f"SFTP connection failed: {str(sftp_error)}",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

        elif deployment_method == "git":
            if not test_request.git_repository_id:
                return {
                    "success": False,
                    "message": "Git repository ID is required",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

            # TODO: Implement git repository validation using git_repository_id
            return {
                "success": True,
                "message": f"Git repository ID {test_request.git_repository_id} configured",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        else:
            return {
                "success": False,
                "message": f"Unknown deployment method: {deployment_method}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

    except Exception as e:
        logger.error("Error testing Agents connection: %s", e)
        return {
            "success": False,
            "message": f"Test failed: {str(e)}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@router.get("/agents/telegraf/config")
async def get_telegraf_config(
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Get Telegraf configuration file content."""
    try:
        from pathlib import Path

        config_path = (
            Path(__file__).parent.parent.parent
            / "config"
            / "tig"
            / "telegraf"
            / "telegraf.conf"
        )

        if not config_path.exists():
            return {
                "success": False,
                "message": f"Telegraf config file not found at {config_path}",
                "data": "",
            }

        with open(config_path, "r", encoding="utf-8") as f:
            content = f.read()

        logger.info(
            "Successfully read Telegraf config for user: %s",
            current_user.get("username"),
        )
        return {
            "success": True,
            "data": content,
            "message": "Successfully loaded Telegraf configuration",
        }

    except Exception as e:
        logger.error("Error reading Telegraf config: %s", e)
        return {
            "success": False,
            "message": f"Failed to read Telegraf config: {str(e)}",
            "data": "",
        }


@router.post("/agents/telegraf/save-config")
async def save_telegraf_config(
    file_content: dict,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Save Telegraf configuration file content."""
    try:
        from pathlib import Path

        content = file_content.get("content", "")

        config_path = (
            Path(__file__).parent.parent.parent
            / "config"
            / "tig"
            / "telegraf"
            / "telegraf.conf"
        )

        config_path.parent.mkdir(parents=True, exist_ok=True)

        with open(config_path, "w", encoding="utf-8") as f:
            f.write(content)

        logger.info(
            "Successfully saved Telegraf config by user: %s",
            current_user.get("username"),
        )
        return {"success": True, "message": "Telegraf configuration saved successfully"}

    except Exception as e:
        logger.error("Error saving Telegraf config: %s", e)
        return {
            "success": False,
            "message": f"Failed to save Telegraf config: {str(e)}",
        }
