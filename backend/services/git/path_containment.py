"""Path-boundary containment check for repository file access."""

from __future__ import annotations

import os

from fastapi import HTTPException


def resolve_within_repo(repo_path: str, rel_path: str) -> str:
    """Resolve ``rel_path`` against ``repo_path`` and enforce containment.

    Uses a path-boundary check (not a bare string prefix) so that sibling
    directories such as ``/repos/myrepo-secret`` cannot pass a
    ``/repos/myrepo`` containment test.

    Returns the resolved absolute path. Raises HTTP 403 if the resolved path
    escapes the repository root.
    """
    repo_root = os.path.realpath(repo_path)
    candidate = os.path.realpath(os.path.join(repo_path, rel_path))

    # Equal to root, or strictly under root (commonpath guards the boundary).
    if (
        candidate != repo_root
        and os.path.commonpath([repo_root, candidate]) != repo_root
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied: file path is outside repository",
        )
    return candidate
