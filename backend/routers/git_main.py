"""
Consolidated Git router that combines all Git-related functionality.
This is the main entry point that includes all Git sub-routers for a unified API.
"""

from fastapi import APIRouter

# Import all Git sub-routers
from routers.git_repositories import router as repositories_router
from routers.git_operations import router as operations_router
from routers.git_version_control import router as version_control_router
from routers.git_files import router as files_router

# Create main router that will include all sub-routers
router = APIRouter()

# Include all Git sub-routers
router.include_router(repositories_router)
router.include_router(operations_router)
router.include_router(version_control_router)
router.include_router(files_router)
