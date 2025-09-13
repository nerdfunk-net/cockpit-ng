"""
Main FastAPI application for Cockpit network device management dashboard.

This is the refactored main application file that uses modular routers
for better code organization and maintainability.
"""

from __future__ import annotations
import logging
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, Depends
import asyncio

# Import routers
from routers.auth import router as auth_router
from routers.nautobot import router as nautobot_router
from routers.checkmk import router as checkmk_router
from routers.nb2cmk import router as nb2cmk_router
from routers.git import router as git_router
from routers.file_compare import router as file_compare_router
from routers.config import router as config_router
from routers.settings import router as settings_router
from routers.templates import router as templates_router
from routers.credentials import router as credentials_router
from routers.ansible_inventory import router as ansible_inventory_router
from routers.scan_and_add import router as scan_and_add_router
from routers.cache import router as cache_router
from routers.profile import router as profile_router
from routers.user_management import router as user_management_router
from routers.git_repositories import router as git_repositories_router
from routers.jobs import router as jobs_router
from health import router as health_router

# APScheduler service (optional for testing)
from services.apscheduler_job_service import APSchedulerJobService

# Import auth dependency
from core.auth import verify_token

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Cockpit API",
    description="Network Device Management Dashboard API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    redirect_slashes=True,
)

# Global APScheduler service instance
apscheduler_service: Optional[APSchedulerJobService] = None

# Include routers
app.include_router(auth_router)
app.include_router(nautobot_router)
app.include_router(checkmk_router)
app.include_router(nb2cmk_router)
app.include_router(git_router)
app.include_router(file_compare_router)
app.include_router(config_router)
app.include_router(settings_router)
app.include_router(templates_router)
app.include_router(ansible_inventory_router)
app.include_router(credentials_router)
app.include_router(scan_and_add_router)
app.include_router(cache_router)
app.include_router(profile_router)
app.include_router(user_management_router)
app.include_router(git_repositories_router)
app.include_router(jobs_router)
app.include_router(health_router)


# Health check and basic endpoints
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


@app.get("/api/test")
async def test_endpoint():
    """Simple test endpoint."""
    return {"message": "Test endpoint working", "timestamp": datetime.now().isoformat()}


# Legacy compatibility endpoints that might still be used by frontend
@app.get("/api/stats")
async def get_statistics():
    """
    Get dashboard statistics - legacy endpoint.
    Redirects to Nautobot stats.
    """
    # Import here to avoid circular imports

    # This would need token verification in a real implementation
    # For now, just return basic stats
    return {
        "message": "Use /api/nautobot/stats for detailed statistics",
        "timestamp": datetime.now().isoformat(),
    }


# GraphQL endpoint compatibility
@app.post("/api/graphql")
async def graphql_endpoint(query_data: dict, current_user: str = Depends(verify_token)):
    """
    Legacy GraphQL endpoint - maintains backward compatibility.
    Forwards requests to the Nautobot GraphQL service.
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


# Startup prefetch for Git cache (commits, optionally refresh loop)
@app.on_event("startup") 
async def startup_services():
    """Initialize all services on startup."""
    logger.info("=== Application startup - initializing services ===")
    
    # Initialize APScheduler service first
    try:
        global apscheduler_service
        if apscheduler_service is None:
            logger.info("Initializing APScheduler service...")
            apscheduler_service = APSchedulerJobService(
                max_workers=10,
                max_parallel_jobs=5,
                data_dir="./data/jobs",
                cleanup_after_days=7
            )
            await apscheduler_service.start()
            logger.info("APScheduler service initialized and started successfully")
        else:
            logger.info("APScheduler service already initialized")
    except Exception as e:
        logger.error(f"Failed to initialize APScheduler service: {e}")
        logger.exception("Full APScheduler initialization error:")
        apscheduler_service = None

    # Initialize cache prefetch
    try:
        logger.debug("Startup cache: hook invoked")
        # Local imports to avoid circular dependencies at import time
        from settings_manager import settings_manager
        from services.git_shared_utils import get_git_repo_by_id
        from services.cache_service import cache_service

        cache_cfg = settings_manager.get_cache_settings()
        logger.debug(f"Startup cache: settings loaded: {cache_cfg}")
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
                    f"Startup cache: Prefetched {len(commits)} commits for branch '{branch_name}' (ttl={ttl}s)"
                )
            except Exception as e:
                logger.warning(f"Startup cache: commits prefetch failed: {e}")

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
                    f"Startup cache: Prefetched locations ({len(locations)} items) (ttl={ttl}s)"
                )
            except Exception as e:
                logger.warning(f"Startup cache: locations prefetch failed: {e}")

        async def prefetch_devices_once():
            """Prefetch all device properties from Nautobot using the background job system."""
            try:
                logger.debug("Startup cache: prefetch_devices_once() starting")
                from main import apscheduler_service
                
                if not apscheduler_service:
                    logger.warning("Startup cache: APScheduler service not available for device prefetch")
                    return
                
                # Start the device caching job
                result = await apscheduler_service.start_get_all_devices_job(username="system")
                
                if result.status == "pending":
                    logger.debug(f"Startup cache: Device prefetch job started with ID {result.job_id}")
                else:
                    logger.warning(f"Startup cache: Device prefetch failed to start: {result.message}")
                    
            except Exception as e:
                logger.warning(f"Startup cache: device prefetch failed: {e}")

        async def refresh_loop():
            # Periodically refresh cache if configured
            interval_min = int(cache_cfg.get("refresh_interval_minutes", 0))
            if interval_min <= 0:
                return
            # Small initial delay to let app finish bootstrapping
            await asyncio.sleep(2)
            while True:
                # Get current prefetch settings to determine what to refresh
                current_cfg = settings_manager.get_cache_settings()
                current_items = current_cfg.get("prefetch_items") or {
                    "git": True,
                    "locations": False,
                    "devices": False,
                }
                
                # Refresh enabled items
                if current_items.get("git", True):
                    await prefetch_commits_once()
                if current_items.get("devices", False):
                    await prefetch_devices_once()
                # Note: locations don't typically need frequent refresh
                
                await asyncio.sleep(interval_min * 60)

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
                        f"Startup cache: prefetch enabled for '{key}' — scheduling task"
                    )
                    asyncio.create_task(prefetch_map[key]())
                elif not enabled:
                    logger.debug(f"Startup cache: prefetch disabled for '{key}'")
                else:
                    logger.debug(f"Startup cache: no prefetch handler for '{key}'")
        # Start background refresh if requested (applies to git commits and devices)
        if int(cache_cfg.get("refresh_interval_minutes", 0)) > 0:
            # Start refresh loop if git or devices prefetch is enabled
            p_items = cache_cfg.get("prefetch_items") or {
                "git": True,
                "locations": False,
                "devices": False,
            }
            if p_items.get("git", True) or p_items.get("devices", False):
                logger.debug("Startup cache: starting refresh loop task")
                asyncio.create_task(refresh_loop())
            else:
                logger.debug(
                    "Startup cache: refresh loop disabled because both git and devices prefetch are off"
                )

    except Exception as e:
        logger.warning(f"Startup cache: Failed to initialize cache prefetch: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown."""
    try:
        global apscheduler_service
        if apscheduler_service:
            await apscheduler_service.shutdown()
            logger.info("APScheduler service shutdown completed")
    except Exception as e:
        logger.warning(f"Error during APScheduler shutdown: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
