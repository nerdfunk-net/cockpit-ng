"""
File management router for configuration comparison and file operations.
"""

from __future__ import annotations
import difflib
import logging
import os
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from core.auth import verify_token
from models.files import FileCompareRequest, FileExportRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/list")
async def list_files(current_user: str = Depends(verify_token)):
    """List all configuration files."""
    try:
        # Use the selected Git repository from the new system
        from routers.git import get_git_repo

        try:
            repo = get_git_repo()
            config_dir = Path(repo.working_dir)
        except Exception as e:
            # If no repository is selected or available, return empty list
            logger.warning(f"Could not get Git repository for file listing: {e}")
            return {"files": []}

        # Check if directory exists
        if not config_dir.exists():
            return {"files": []}

        files = []
        # Use common config file extensions
        allowed_extensions = ['.txt', '.conf', '.cfg', '.config', '.ini', '.yml', '.yaml', '.json']

        for file_path in config_dir.rglob('*'):
            if file_path.is_file() and any(file_path.name.endswith(ext) for ext in allowed_extensions):
                # Skip .git directory
                if '.git' in file_path.parts:
                    continue

                # Get relative path from config directory
                relative_path = file_path.relative_to(config_dir)

                files.append({
                    "name": file_path.name,
                    "path": str(relative_path),
                    "size": file_path.stat().st_size,
                    "modified": file_path.stat().st_mtime,
                    "type": "file"
                })

        # Sort files by name
        files.sort(key=lambda x: x["name"].lower())

        return {"files": files}

    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list files: {str(e)}"
        )


@router.post("/compare")
async def compare_files(
    file_comparison: FileCompareRequest,
    current_user: str = Depends(verify_token)
):
    """Compare two files from Git commits."""
    try:
        from routers.git import get_git_repo

        # Get the Git repository
        try:
            repo = get_git_repo()
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Git repository not found: {e}")

        # Initialize result with proper structure for frontend
        file1_content = ""
        file2_content = ""

        # Get file content from left file
        try:
            file1_path = Path(repo.working_dir) / file_comparison.left_file
            if file1_path.exists():
                file1_content = file1_path.read_text()
        except Exception as e:
            logger.error(f"Error reading left file: {e}")

        # Get file content from right file
        try:
            file2_path = Path(repo.working_dir) / file_comparison.right_file
            if file2_path.exists():
                file2_content = file2_path.read_text()
        except Exception as e:
            logger.error(f"Error reading right file: {e}")

        # Create a proper side-by-side diff with line-by-line comparison
        left_lines = []
        right_lines = []

        # Split content into lines
        file1_lines = file1_content.splitlines() if file1_content else []
        file2_lines = file2_content.splitlines() if file2_content else []

        # Use difflib to get the differences
        matcher = difflib.SequenceMatcher(None, file1_lines, file2_lines)

        left_line_num = 1
        right_line_num = 1

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                # Lines are the same
                for i in range(i1, i2):
                    left_lines.append({
                        "line_number": left_line_num,
                        "content": file1_lines[i],
                        "type": "equal"
                    })
                    right_lines.append({
                        "line_number": right_line_num,
                        "content": file2_lines[j1 + (i - i1)],
                        "type": "equal"
                    })
                    left_line_num += 1
                    right_line_num += 1

            elif tag == 'delete':
                # Lines only in left file (deleted)
                for i in range(i1, i2):
                    left_lines.append({
                        "line_number": left_line_num,
                        "content": file1_lines[i],
                        "type": "delete"
                    })
                    right_lines.append({
                        "line_number": None,
                        "content": "",
                        "type": "empty"
                    })
                    left_line_num += 1

            elif tag == 'insert':
                # Lines only in right file (added)
                for j in range(j1, j2):
                    left_lines.append({
                        "line_number": None,
                        "content": "",
                        "type": "empty"
                    })
                    right_lines.append({
                        "line_number": right_line_num,
                        "content": file2_lines[j],
                        "type": "insert"
                    })
                    right_line_num += 1

            elif tag == 'replace':
                # Lines are different
                max_lines = max(i2 - i1, j2 - j1)
                for k in range(max_lines):
                    if k < (i2 - i1):
                        left_lines.append({
                            "line_number": left_line_num,
                            "content": file1_lines[i1 + k],
                            "type": "delete" if k >= (j2 - j1) else "replace"
                        })
                        left_line_num += 1
                    else:
                        left_lines.append({
                            "line_number": None,
                            "content": "",
                            "type": "empty"
                        })

                    if k < (j2 - j1):
                        right_lines.append({
                            "line_number": right_line_num,
                            "content": file2_lines[j1 + k],
                            "type": "insert" if k >= (i2 - i1) else "replace"
                        })
                        right_line_num += 1
                    else:
                        right_lines.append({
                            "line_number": None,
                            "content": "",
                            "type": "empty"
                        })

        # Generate diff
        diff_content = ""
        if file1_content and file2_content:
            diff = difflib.unified_diff(
                file1_content.splitlines(keepends=True),
                file2_content.splitlines(keepends=True),
                fromfile=file_comparison.left_file,
                tofile=file_comparison.right_file
            )
            diff_content = "".join(diff)

        result = {
            "success": True,
            "left_lines": left_lines,
            "right_lines": right_lines,
            "diff": diff_content,
            "left_file": file_comparison.left_file,
            "right_file": file_comparison.right_file
        }

        return result

    except Exception as e:
        logger.error(f"Error comparing files: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare files: {str(e)}"
        )


@router.post("/export-diff")
async def export_diff(
    file_comparison: FileExportRequest,
    current_user: str = Depends(verify_token)
):
    """Export comparison diff to a file."""
    try:
        from routers.git import get_git_repo

        # Get the Git repository
        try:
            repo = get_git_repo()
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Git repository not found: {e}")

        # Get file contents for both files
        file1_content = ""
        file2_content = ""

        try:
            file1_path = Path(repo.working_dir) / file_comparison.left_file
            if file1_path.exists():
                file1_content = file1_path.read_text()
        except Exception as e:
            logger.error(f"Error reading left file: {e}")

        try:
            file2_path = Path(repo.working_dir) / file_comparison.right_file
            if file2_path.exists():
                file2_content = file2_path.read_text()
        except Exception as e:
            logger.error(f"Error reading right file: {e}")

        # Generate diff based on format
        if file_comparison.format == "unified":
            diff_lines = difflib.unified_diff(
                file1_content.splitlines(keepends=True),
                file2_content.splitlines(keepends=True),
                fromfile=file_comparison.left_file,
                tofile=file_comparison.right_file
            )
        else:
            diff_lines = difflib.context_diff(
                file1_content.splitlines(keepends=True),
                file2_content.splitlines(keepends=True),
                fromfile=file_comparison.left_file,
                tofile=file_comparison.right_file
            )

        diff_content = "".join(diff_lines)

        # Return as downloadable file
        return Response(
            content=diff_content,
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename=diff_{file_comparison.left_file}_{file_comparison.right_file}.txt"
            }
        )

    except Exception as e:
        logger.error(f"Error exporting diff: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export diff: {str(e)}"
        )


@router.get("/config")
async def get_file_config(current_user: str = Depends(verify_token)):
    """Get file storage configuration information."""
    try:
        # Use the selected Git repository from the new system
        from routers.git import get_git_repo

        try:
            repo = get_git_repo()
            config_dir = Path(repo.working_dir)
        except Exception as e:
            logger.warning(f"Could not get Git repository for file config: {e}")
            # Return default config if no repository is available
            return {
                "directory": "",
                "directory_exists": False,
                "allowed_extensions": ['.txt', '.conf', '.cfg', '.config', '.ini', '.yml', '.yaml', '.json'],
                "max_file_size_mb": 10,
                "directory_writable": False
            }

        return {
            "directory": str(config_dir.absolute()),
            "directory_exists": config_dir.exists(),
            "allowed_extensions": ['.txt', '.conf', '.cfg', '.config', '.ini', '.yml', '.yaml', '.json'],
            "max_file_size_mb": 10,
            "directory_writable": config_dir.exists() and os.access(config_dir, os.W_OK)
        }
    except Exception as e:
        logger.error(f"Error getting file config: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get file configuration: {str(e)}"
        )
