"""
Template router — composed from focused sub-modules.

Route registration order matters: specific paths (e.g. /categories, /health,
/scan-import) must be registered before the wildcard /{template_id} routes
to prevent FastAPI from matching them as integer path parameters.
"""

from fastapi import APIRouter

from .content import router as content_router
from .crud import router as crud_router
from .git import router as git_router
from .health import router as health_router
from .import_ import router as import_router
from .render import router as render_router

router = APIRouter(prefix="/api/templates", tags=["templates"])

# Non-parameterised routes first
router.include_router(health_router)
router.include_router(git_router)
router.include_router(import_router)
router.include_router(render_router)

# CRUD last (contains /{template_id} catch-all routes and /categories, /name/{name})
router.include_router(crud_router)

# Content routes attach to the same /{template_id} namespace
router.include_router(content_router)

__all__ = ["router"]
