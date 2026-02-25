"""
Configuration file management router for editing YAML config files.
"""

from __future__ import annotations
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import yaml

from core.auth import require_permission
from services.checkmk.config import config_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/config", tags=["config"])

# Base path for config files
# Updated path: routers/settings/connections/config.py -> backend/ -> project_root/config/
CONFIG_BASE_PATH = Path(__file__).parent.parent.parent.parent.parent / "config"


class ConfigFileContent(BaseModel):
    content: str


@router.post("/validate")
async def validate_yaml_content(
    file_content: ConfigFileContent,
    current_user: dict = Depends(require_permission("settings.common", "read")),
):
    """Validate YAML content syntax.

    Args:
        file_content: ConfigFileContent with YAML content to validate
        current_user: Current authenticated user

    Returns:
        Dict with validation result
    """
    try:
        # Try to parse the YAML content
        yaml.safe_load(file_content.content)

        logger.info("YAML validation successful for user: %s", current_user)
        return {
            "success": True,
            "valid": True,
            "message": "YAML syntax is valid",
        }

    except yaml.YAMLError as e:
        # Get detailed error information
        error_message = str(e)
        error_line = None
        error_column = None

        if hasattr(e, "problem_mark"):
            mark = e.problem_mark
            error_line = mark.line + 1  # +1 because line numbers are 0-based
            error_column = mark.column + 1  # +1 because columns are 0-based

        logger.info(
            "YAML validation failed for user: %s - %s", current_user, error_message
        )
        return {
            "success": True,
            "valid": False,
            "message": "YAML syntax error detected",
            "error": error_message,
            "line": error_line,
            "column": error_column,
        }

    except Exception as e:
        logger.error("Unexpected error during YAML validation: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validating YAML content: {str(e)}",
        )


@router.get("/{filename}")
async def read_config_file(
    filename: str,
    current_user: dict = Depends(require_permission("settings.common", "read")),
):
    """Read a configuration file."""
    try:
        # Validate filename to prevent path traversal
        if not filename.endswith(".yaml") or "/" in filename or "\\" in filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid filename. Only .yaml files in config directory are allowed.",
            )

        config_file = CONFIG_BASE_PATH / filename

        # Check if file exists
        if not config_file.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration file {filename} not found",
            )

        # Read file content
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                content = f.read()

            logger.info(
                "Successfully read config file: %s by user: %s", filename, current_user
            )
            return {
                "success": True,
                "data": content,
                "message": f"Successfully read {filename}",
            }

        except Exception as e:
            logger.error("Error reading config file %s: %s", filename, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error reading configuration file: {str(e)}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unexpected error reading config file %s: %s", filename, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}",
        )


@router.post("/{filename}")
async def write_config_file(
    filename: str,
    file_content: ConfigFileContent,
    current_user: dict = Depends(require_permission("settings.common", "write")),
):
    """Write a configuration file."""
    try:
        # Validate filename to prevent path traversal
        if not filename.endswith(".yaml") or "/" in filename or "\\" in filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid filename. Only .yaml files in config directory are allowed.",
            )

        config_file = CONFIG_BASE_PATH / filename

        # Ensure config directory exists
        CONFIG_BASE_PATH.mkdir(parents=True, exist_ok=True)

        # Write file content
        try:
            with open(config_file, "w", encoding="utf-8") as f:
                f.write(file_content.content)

            # Reload config cache to ensure changes are picked up by services
            config_service.reload_config()
            logger.info(
                "Successfully wrote config file: %s by user: %s", filename, current_user
            )
            return {"success": True, "message": f"Successfully saved {filename}"}

        except Exception as e:
            logger.error("Error writing config file %s: %s", filename, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error writing configuration file: {str(e)}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unexpected error writing config file %s: %s", filename, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}",
        )


@router.get("/")
async def list_config_files(
    current_user: dict = Depends(require_permission("configs.backup", "execute")),
):
    """List available configuration files."""
    try:
        # Check if config directory exists
        if not CONFIG_BASE_PATH.exists():
            return {
                "success": True,
                "data": [],
                "message": "No configuration files found",
            }

        # List only .yaml files
        yaml_files = []
        for file_path in CONFIG_BASE_PATH.glob("*.yaml"):
            if file_path.is_file():
                yaml_files.append(
                    {
                        "name": file_path.name,
                        "size": file_path.stat().st_size,
                        "modified": file_path.stat().st_mtime,
                    }
                )

        logger.info(
            "Successfully listed %s config files for user: %s", len(yaml_files), current_user
        )
        return {
            "success": True,
            "data": yaml_files,
            "message": f"Found {len(yaml_files)} configuration files",
        }

    except Exception as e:
        logger.error("Error listing config files: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing configuration files: {str(e)}",
        )
