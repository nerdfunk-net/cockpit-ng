"""
Consolidated Git router for repository management and version control operations.
This router combines all Git-related functionality with clean API structure:

- /api/git-repositories/    - Repository management (CRUD operations)
- /api/git/{repo_id}/       - Single repository operations (sync, branches, commits, files)
- /api/git-compare/         - Cross-repository comparisons
- /api/git-repositories/{repo_id}/debug/ - Debug and diagnostic operations

Refactored from a monolithic 1,790-line file into 6 focused modules:
- git_repositories.py: Repository CRUD operations (1,086 → 328 lines, -53%)
- git_operations.py: Repository sync and status operations
- git_version_control.py: Git VCS operations (branches, commits, diffs)
- git_files.py: File operations within repositories
- git_compare.py: Cross-repository comparison operations
- git_debug.py: Debug and diagnostic endpoints (NEW)
"""

from fastapi import APIRouter

# Import all Git sub-routers
from routers.git_repositories import router as repositories_router
from routers.git_operations import router as operations_router
from routers.git_version_control import router as version_control_router
from routers.git_files import router as files_router
from routers.git_compare import router as compare_router
from routers.git_debug import router as debug_router

# Create main router that will include all sub-routers
router = APIRouter()

# Include all Git sub-routers with clean API structure
router.include_router(repositories_router)  # /api/git-repositories/
router.include_router(operations_router)  # /api/git/{repo_id}/
router.include_router(version_control_router)  # /api/git/{repo_id}/
router.include_router(files_router)  # /api/git/{repo_id}/
router.include_router(compare_router)  # /api/git-compare/
router.include_router(debug_router)  # /api/git-repositories/{repo_id}/debug/
