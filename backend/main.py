"""
Main FastAPI application for Cockpit network device management dashboard.

This is the refactored main application file that uses modular routers
for better code organization and maintainability.
"""

from __future__ import annotations
import logging
import os
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from core.limiter import limiter

# Import routers
# Auth routers now use feature-based structure (Phase 3.5 migration)
from routers.auth import auth_router, oidc_router, profile_router

# CheckMK routers now use feature-based structure (Phase 3.6 migration)
from routers.checkmk import checkmk_router, nb2cmk_router

# Nautobot routers now use feature-based structure (Phase 3.8 migration)
from routers.nautobot import (
    nautobot_router,
    scan_and_add_router,
)

# Settings routers now use feature-based structure (Phase 3.1-3.3 migration)
from routers.settings import (
    git_router,
    common_router as settings_router,
    cache_router,
    credentials_router,
    templates_router,
    rbac_router,
    compliance_router,
    config_router,
)

# Network routers now use feature-based structure (Phase 3.4 migration - partial)
from routers.network import (
    file_compare_router,  # Minimal - only compare endpoint for Config View
    backup_router,  # Configuration backup management
    netmiko_router,
    compliance_check_router,
)

# Snapshot routers (Network / Automation / Snapshots)
from routers.network.snapshots import (
    templates_router as snapshot_templates_router,
    snapshots_router,
)

# Tools router kept in old location (depends on nautobot_service, now fixed)
from routers.tools import router as tools_router

# Inventory routers now use feature-based structure (Phase 3.7 migration)
from routers.inventory import (
    general_inventory_router,
    inventory_router,
    certificates_router,
)

# git_repositories_router is included via git_router - no need to import separately
# Job routers now use feature-based structure (Phase 3.2 migration)
from routers.jobs import (
    templates_router as job_templates_router,
    schedules_router as job_schedules_router,
    runs_router as job_runs_router,
    celery_admin_router,
    device_tasks_router,
    sync_tasks_router,
    network_tasks_router,
)

# certificates_router now imported from inventory package above
from health import router as health_router

# Cockpit Agent router
from routers.cockpit_agent import router as cockpit_agent_router

# Agents routers
from routers.agents import deploy_router as agents_deploy_router

# Import auth dependency

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan – replaces deprecated @app.on_event handlers."""
    await _startup_services()
    yield
    _shutdown_event()


# Initialize FastAPI app
app = FastAPI(
    title="Cockpit API",
    description="Network Device Management Dashboard API",
    version="2.0.0",
    docs_url=None,  # Disable default docs to use custom ones
    redoc_url=None,  # Disable default redoc to use custom one
    redirect_slashes=True,
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def security_headers(request: Request, call_next) -> Response:
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# Mount swagger-ui static files for air-gapped environments
# This serves Swagger UI assets locally instead of from CDN
# Mounted under /api/ prefix so it works through the Next.js proxy
try:
    static_dir = os.path.join(os.path.dirname(__file__), "static", "swagger-ui")
    if os.path.exists(static_dir):
        app.mount(
            "/api/static/swagger-ui",
            StaticFiles(directory=static_dir),
            name="swagger-ui",
        )
        logger.info("Swagger UI static files mounted from: %s", static_dir)
    else:
        logger.warning("Swagger UI static directory not found: %s", static_dir)
except Exception as e:
    logger.error("Failed to mount Swagger UI static files: %s", e)

# Include routers
app.include_router(auth_router)
app.include_router(oidc_router)
app.include_router(nautobot_router)
app.include_router(checkmk_router)
app.include_router(nb2cmk_router)
app.include_router(git_router)  # This includes git_repositories_router internally
app.include_router(file_compare_router)  # Minimal - only compare endpoint
app.include_router(backup_router)  # Configuration backup management
app.include_router(config_router)
app.include_router(settings_router)
app.include_router(templates_router)
app.include_router(general_inventory_router)
app.include_router(inventory_router)
app.include_router(credentials_router)
app.include_router(scan_and_add_router)
app.include_router(cache_router)
app.include_router(profile_router)
app.include_router(celery_admin_router)
app.include_router(device_tasks_router)
app.include_router(sync_tasks_router)
app.include_router(network_tasks_router)
# git_repositories_router removed - already included via git_router
app.include_router(job_schedules_router)
app.include_router(job_templates_router)
app.include_router(job_runs_router)
app.include_router(netmiko_router)
app.include_router(snapshot_templates_router)
app.include_router(snapshots_router)
app.include_router(rbac_router)
app.include_router(compliance_router)
app.include_router(compliance_check_router)
app.include_router(certificates_router)
app.include_router(tools_router)
app.include_router(cockpit_agent_router)
app.include_router(agents_deploy_router)
app.include_router(health_router)


# Health check and basic endpoints
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    """Custom Swagger UI endpoint using local static files."""
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title=app.title + " - Swagger UI",
        swagger_js_url="/api/static/swagger-ui/swagger-ui-bundle.js",
        swagger_css_url="/api/static/swagger-ui/swagger-ui.css",
        swagger_favicon_url="/api/static/swagger-ui/favicon-32x32.png",
    )


@app.get("/redoc", include_in_schema=False)
async def redoc_html():
    """Custom ReDoc endpoint using local static files."""
    return get_redoc_html(
        openapi_url="/openapi.json",
        title=app.title + " - ReDoc",
        redoc_js_url="/api/static/swagger-ui/redoc.standalone.js",
    )


@app.get("/")
async def root():
    """Root endpoint with basic API information."""
    return {
        "message": "Cockpit API v2.0 - Network Device Management Dashboard",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
    }


@app.post("/api/nautobot/graphql")
async def nautobot_graphql_endpoint(query_data: dict):
    """
    Execute GraphQL query against Nautobot - compatibility endpoint.

    This endpoint maintains backward compatibility with existing frontend code.
    """
    from services.nautobot import nautobot_service
    from fastapi import HTTPException, status

    try:
        query = query_data.get("query")
        variables = query_data.get("variables", {})

        if not query:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GraphQL query is required",
            )

        result = await nautobot_service.graphql_query(query, variables)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GraphQL query failed: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn
    from config import settings

    uvicorn.run(app, host="0.0.0.0", port=settings.port)


# ---------------------------------------------------------------------------
# Startup / shutdown logic (called by the lifespan context manager above)
# ---------------------------------------------------------------------------


async def _startup_services():
    """Initialize all services on startup."""
    logger.info("=== Application startup - initializing services ===")

    # ------------------------------------------------------------------
    # Security pre-flight checks
    # ------------------------------------------------------------------
    from config import settings as _settings

    _DEFAULT_SECRET = "your-secret-key-change-in-production"
    if _settings.secret_key == _DEFAULT_SECRET:
        raise RuntimeError(
            "FATAL: SECRET_KEY is set to the insecure default value. "
            "Set the SECRET_KEY environment variable to a strong random string "
            "(e.g. `openssl rand -hex 32`) before starting the application."
        )

    if _settings.initial_password == "admin":
        logger.warning(
            "SECURITY WARNING: Default admin password 'admin' is in use. "
            "Change INITIAL_PASSWORD or update the admin account password immediately."
        )

    # Initialize database tables first
    try:
        from core.database import init_db

        init_db()
        logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.error("Failed to initialize database tables: %s", e)
        raise

    # Ensure built-in Celery queues exist
    try:
        from settings_manager import settings_manager

        settings_manager.ensure_builtin_queues()
        logger.info("Built-in Celery queues verified")
    except Exception as e:
        logger.error("Failed to ensure built-in queues: %s", e)
        # Don't raise - this is not critical for startup

    # Export SSH keys to filesystem
    try:
        import credentials_manager

        exported_keys = credentials_manager.export_ssh_keys_to_filesystem()
        if exported_keys:
            logger.info("Exported %s SSH keys to ./data/ssh_keys/", len(exported_keys))
        else:
            logger.debug("No SSH keys to export")
    except Exception as e:
        logger.error("Failed to export SSH keys: %s", e)

    # Ensure admin user has RBAC role assigned (must happen before other services)
    try:
        import user_db_manager

        user_db_manager.ensure_admin_has_rbac_role()
        logger.info("Admin RBAC role assignment completed")
    except Exception as e:
        logger.error("Failed to ensure admin RBAC role: %s", e)

    # Initialize next_run for job schedules that don't have one
    try:
        import jobs_manager

        result = jobs_manager.initialize_schedule_next_runs()
        if result["initialized_count"] > 0:
            logger.info(
                "Initialized next_run for %s job schedules", result['initialized_count']
            )
    except Exception as e:
        logger.error("Failed to initialize job schedule next_runs: %s", e)

    # Initialize cache prefetch
    try:
        logger.debug("Startup cache: hook invoked")
        # Local imports to avoid circular dependencies at import time
        from settings_manager import settings_manager
        from services.settings.git.shared_utils import get_git_repo_by_id
        from services.settings.cache import cache_service

        cache_cfg = settings_manager.get_cache_settings()
        logger.debug("Startup cache: settings loaded: %s", cache_cfg)
        if not cache_cfg.get("enabled", True):
            logger.debug("Startup cache: disabled; skipping startup prefetch")
            return

        async def prefetch_commits_once():
            try:
                logger.debug("Startup cache: prefetch_commits_once() starting")
                selected_id = settings_manager.get_selected_git_repository()
                if not selected_id:
                    logger.warning(
                        "Startup cache: No repository selected; skipping commits prefetch"
                    )
                    return

                repo = get_git_repo_by_id(selected_id)
                # Determine branch; handle empty repos safely
                try:
                    branch_name = repo.active_branch.name
                except Exception:
                    logger.warning(
                        "Startup cache: No active branch detected; skipping commits prefetch"
                    )
                    return

                # Skip if repo has no valid HEAD
                try:
                    if not repo.head.is_valid():
                        logger.debug(
                            "Startup cache: Repository has no commits yet; nothing to prefetch"
                        )
                        return
                except Exception:
                    logger.debug(
                        "Startup cache: Unable to validate HEAD; skipping prefetch"
                    )
                    return

                # Build commits payload similar to /api/git/commits
                limit = int(cache_cfg.get("max_commits", 500))
                commits = []
                for commit in repo.iter_commits(branch_name, max_count=limit):
                    commits.append(
                        {
                            "hash": commit.hexsha,
                            "short_hash": commit.hexsha[:8],
                            "message": commit.message.strip(),
                            "author": {
                                "name": commit.author.name,
                                "email": commit.author.email,
                            },
                            "date": commit.committed_datetime.isoformat(),
                            "files_changed": len(commit.stats.files),
                        }
                    )

                ttl = int(cache_cfg.get("ttl_seconds", 600))
                repo_scope = f"repo:{selected_id}" if selected_id else "repo:default"
                cache_key = f"{repo_scope}:commits:{branch_name}"
                cache_service.set(cache_key, commits, ttl)
                logger.debug(
                    "Startup cache: Prefetched %s commits for branch '%s' (ttl=%ss)", len(commits), branch_name, ttl
                )
            except Exception as e:
                logger.warning("Startup cache: commits prefetch failed: %s", e)

        async def prefetch_locations_once():
            """Prefetch Nautobot locations list (GraphQL) and store in cache with endpoint-compatible shape."""
            try:
                logger.debug("Startup cache: prefetch_locations_once() starting")
                from services.nautobot import nautobot_service

                # Use the same GraphQL query shape as /api/nautobot/locations endpoint
                query = """
                query locations {
                  locations {
                    id
                    name
                    description
                    parent {
                      id
                      name
                      description
                    }
                    children {
                      id
                      name
                      description
                    }
                  }
                }
                """
                result = await nautobot_service.graphql_query(query)
                if "errors" in result:
                    raise Exception(f"GraphQL errors: {result['errors']}")
                locations = result["data"]["locations"]
                ttl = int(cache_cfg.get("ttl_seconds", 600))
                cache_service.set("nautobot:locations:list", locations, ttl)
                logger.debug(
                    "Startup cache: Prefetched locations (%s items) (ttl=%ss)", len(locations), ttl
                )
            except Exception as e:
                logger.warning("Startup cache: locations prefetch failed: %s", e)

        async def prefetch_devices_once():
            """Prefetch all device properties from Nautobot using Celery background task."""
            try:
                logger.debug("Startup cache: prefetch_devices_once() starting")
                from services.background_jobs import cache_all_devices_task

                # Trigger device caching via Celery
                task = cache_all_devices_task.delay()

                logger.debug(
                    "Startup cache: Device prefetch job started with task ID %s", task.id
                )

            except Exception as e:
                logger.warning("Startup cache: device prefetch failed: %s", e)

        # Kick off a one-time prefetch without blocking startup (if enabled)
        if cache_cfg.get("prefetch_on_startup", True):
            prefetch_items = cache_cfg.get("prefetch_items") or {
                "git": True,
                "locations": False,
                "devices": False,
            }
            # Map item keys to their prefetch coroutine
            prefetch_map = {
                "git": prefetch_commits_once,
                "locations": prefetch_locations_once,
                "devices": prefetch_devices_once,
            }
            # Launch tasks for all enabled items that we know how to prefetch
            for key, enabled in prefetch_items.items():
                if enabled and key in prefetch_map:
                    logger.debug(
                        "Startup cache: prefetch enabled for '%s' — scheduling task", key
                    )
                    asyncio.create_task(prefetch_map[key]())
                elif not enabled:
                    logger.debug("Startup cache: prefetch disabled for '%s'", key)
                else:
                    logger.debug("Startup cache: no prefetch handler for '%s'", key)

        # Note: Periodic cache refresh is now handled by Celery Beat (tasks/periodic_tasks.py)
        # Configure intervals in Settings → Cache:
        # - devices_cache_interval_minutes
        # - locations_cache_interval_minutes
        # - git_commits_cache_interval_minutes

    except Exception as e:
        logger.warning("Startup cache: Failed to initialize cache prefetch: %s", e)


def _shutdown_event():
    """Cleanup on application shutdown."""
    # Note: Celery workers are managed separately and do not need shutdown here
    logger.info("Application shutdown completed")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
