"""
Configuration file management router for editing YAML config files.
"""

from __future__ import annotations
import logging
import os
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.auth import get_current_username

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/config", tags=["config"])

# Base path for config files
CONFIG_BASE_PATH = Path(__file__).parent.parent.parent / "config"

class ConfigFileContent(BaseModel):
    content: str

@router.get("/{filename}")
async def read_config_file(
    filename: str,
    current_user: str = Depends(get_current_username),
):
    """Read a configuration file."""
    try:
        # Validate filename to prevent path traversal
        if not filename.endswith('.yaml') or '/' in filename or '\\' in filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid filename. Only .yaml files in config directory are allowed."
            )
        
        config_file = CONFIG_BASE_PATH / filename
        
        # Check if file exists
        if not config_file.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration file {filename} not found"
            )
        
        # Read file content
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            logger.info(f"Successfully read config file: {filename} by user: {current_user}")
            return {
                "success": True,
                "data": content,
                "message": f"Successfully read {filename}"
            }
            
        except Exception as e:
            logger.error(f"Error reading config file {filename}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error reading configuration file: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error reading config file {filename}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )

@router.post("/{filename}")
async def write_config_file(
    filename: str,
    file_content: ConfigFileContent,
    current_user: str = Depends(get_current_username),
):
    """Write a configuration file."""
    try:
        # Validate filename to prevent path traversal
        if not filename.endswith('.yaml') or '/' in filename or '\\' in filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid filename. Only .yaml files in config directory are allowed."
            )
        
        config_file = CONFIG_BASE_PATH / filename
        
        # Ensure config directory exists
        CONFIG_BASE_PATH.mkdir(parents=True, exist_ok=True)
        
        # Write file content
        try:
            with open(config_file, 'w', encoding='utf-8') as f:
                f.write(file_content.content)
            
            logger.info(f"Successfully wrote config file: {filename} by user: {current_user}")
            return {
                "success": True,
                "message": f"Successfully saved {filename}"
            }
            
        except Exception as e:
            logger.error(f"Error writing config file {filename}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error writing configuration file: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error writing config file {filename}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )

@router.get("/")
async def list_config_files(
    current_user: str = Depends(get_current_username),
):
    """List available configuration files."""
    try:
        # Check if config directory exists
        if not CONFIG_BASE_PATH.exists():
            return {
                "success": True,
                "data": [],
                "message": "No configuration files found"
            }
        
        # List only .yaml files
        yaml_files = []
        for file_path in CONFIG_BASE_PATH.glob("*.yaml"):
            if file_path.is_file():
                yaml_files.append({
                    "name": file_path.name,
                    "size": file_path.stat().st_size,
                    "modified": file_path.stat().st_mtime
                })
        
        logger.info(f"Successfully listed {len(yaml_files)} config files for user: {current_user}")
        return {
            "success": True,
            "data": yaml_files,
            "message": f"Found {len(yaml_files)} configuration files"
        }
        
    except Exception as e:
        logger.error(f"Error listing config files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing configuration files: {str(e)}"
        )