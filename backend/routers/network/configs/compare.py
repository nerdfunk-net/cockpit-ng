"""
File comparison router for configuration file operations.
Minimal implementation supporting only the compare endpoint used by Config View.
"""

from __future__ import annotations
import difflib
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.files import FileCompareRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/file-compare", tags=["file-compare"])


@router.post("/compare")
async def compare_files(
    file_comparison: FileCompareRequest,
    current_user: dict = Depends(require_permission("configs.compare", "execute")),
):
    """Compare two files from a Git repository."""
    try:
        if not file_comparison.repo_id:
            raise HTTPException(
                status_code=400, detail="Repository ID is required for file comparison"
            )

        from services.settings.git.shared_utils import get_git_repo_by_id

        # Get the Git repository
        try:
            repo = get_git_repo_by_id(file_comparison.repo_id)
        except Exception as e:
            raise HTTPException(
                status_code=404, detail=f"Git repository not found: {e}"
            )

        # Initialize result with proper structure for frontend
        file1_content = ""
        file2_content = ""

        # Get file content from left file
        try:
            file1_path = Path(repo.working_dir) / file_comparison.left_file
            if file1_path.exists():
                file1_content = file1_path.read_text()
        except Exception as e:
            logger.error("Error reading left file: %s", e)

        # Get file content from right file
        try:
            file2_path = Path(repo.working_dir) / file_comparison.right_file
            if file2_path.exists():
                file2_content = file2_path.read_text()
        except Exception as e:
            logger.error("Error reading right file: %s", e)

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
            if tag == "equal":
                # Lines are the same
                for i in range(i1, i2):
                    left_lines.append(
                        {
                            "line_number": left_line_num,
                            "content": file1_lines[i],
                            "type": "equal",
                        }
                    )
                    right_lines.append(
                        {
                            "line_number": right_line_num,
                            "content": file2_lines[j1 + (i - i1)],
                            "type": "equal",
                        }
                    )
                    left_line_num += 1
                    right_line_num += 1

            elif tag == "delete":
                # Lines only in left file (deleted)
                for i in range(i1, i2):
                    left_lines.append(
                        {
                            "line_number": left_line_num,
                            "content": file1_lines[i],
                            "type": "delete",
                        }
                    )
                    right_lines.append(
                        {"line_number": None, "content": "", "type": "empty"}
                    )
                    left_line_num += 1

            elif tag == "insert":
                # Lines only in right file (added)
                for j in range(j1, j2):
                    left_lines.append(
                        {"line_number": None, "content": "", "type": "empty"}
                    )
                    right_lines.append(
                        {
                            "line_number": right_line_num,
                            "content": file2_lines[j],
                            "type": "insert",
                        }
                    )
                    right_line_num += 1

            elif tag == "replace":
                # Lines are different
                max_lines = max(i2 - i1, j2 - j1)
                for k in range(max_lines):
                    if k < (i2 - i1):
                        left_lines.append(
                            {
                                "line_number": left_line_num,
                                "content": file1_lines[i1 + k],
                                "type": "delete" if k >= (j2 - j1) else "replace",
                            }
                        )
                        left_line_num += 1
                    else:
                        left_lines.append(
                            {"line_number": None, "content": "", "type": "empty"}
                        )

                    if k < (j2 - j1):
                        right_lines.append(
                            {
                                "line_number": right_line_num,
                                "content": file2_lines[j1 + k],
                                "type": "insert" if k >= (i2 - i1) else "replace",
                            }
                        )
                        right_line_num += 1
                    else:
                        right_lines.append(
                            {"line_number": None, "content": "", "type": "empty"}
                        )

        # Generate diff
        diff_content = ""
        if file1_content and file2_content:
            diff = difflib.unified_diff(
                file1_content.splitlines(keepends=True),
                file2_content.splitlines(keepends=True),
                fromfile=file_comparison.left_file,
                tofile=file_comparison.right_file,
            )
            diff_content = "".join(diff)

        result = {
            "success": True,
            "left_lines": left_lines,
            "right_lines": right_lines,
            "diff": diff_content,
            "left_file": file_comparison.left_file,
            "right_file": file_comparison.right_file,
        }

        return result

    except Exception as e:
        logger.error("Error comparing files: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare files: {str(e)}",
        )
