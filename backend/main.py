"""
Main FastAPI application for Cockpit network device management dashboard.

This is the refactored main application file that uses modular routers
for better code organization and maintainability.
"""

from __future__ import annotations
import logging
from datetime import datetime
from fastapi import FastAPI, Depends
import asyncio

# Import routers
from routers.auth import router as auth_router
from routers.nautobot import router as nautobot_router
from routers.git import router as git_router
from routers.files import router as files_router
from routers.settings import router as settings_router
from routers.templates import router as templates_router
from routers.git_repositories import router as git_repositories_router
from routers.credentials import router as credentials_router
from routers.ansible_inventory import router as ansible_inventory_router
from routers.scan_and_add import router as scan_and_add_router
from routers.cache import router as cache_router

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
    redirect_slashes=False
)

# Include routers
app.include_router(auth_router)
app.include_router(nautobot_router)
app.include_router(git_router)
app.include_router(files_router)
app.include_router(settings_router)
app.include_router(templates_router)
app.include_router(git_repositories_router)
app.include_router(ansible_inventory_router)
app.include_router(credentials_router)
app.include_router(scan_and_add_router)
app.include_router(cache_router)

# Health check and basic endpoints
@app.get("/")
async def root():
    """Root endpoint with basic API information."""
    return {
        "message": "Cockpit API v2.0 - Network Device Management Dashboard",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
        "docs_url": "/docs",
        "redoc_url": "/redoc"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0"
    }


@app.get("/api/test")
async def test_endpoint():
    """Simple test endpoint."""
    return {
        "message": "Test endpoint working", 
        "timestamp": datetime.now().isoformat()
    }


# Legacy compatibility endpoints that might still be used by frontend
@app.get("/api/stats")
async def get_statistics():
    """
    Get dashboard statistics - legacy endpoint.
    Redirects to Nautobot stats.
    """
    # Import here to avoid circular imports
    from routers.nautobot import get_nautobot_stats
    from core.auth import verify_token
    from fastapi import Depends

    # This would need token verification in a real implementation
    # For now, just return basic stats
    return {
        "message": "Use /api/nautobot/stats for detailed statistics",
        "timestamp": datetime.now().isoformat()
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
                detail="GraphQL query is required"
            )

        result = await nautobot_service.graphql_query(query, variables)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GraphQL query failed: {str(e)}"
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
                detail="GraphQL query is required"
            )

        result = await nautobot_service.graphql_query(query, variables)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GraphQL query failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    from config import settings

    uvicorn.run(app, host="0.0.0.0", port=settings.port)

# Startup prefetch for Git cache (commits, optionally refresh loop)
@app.on_event("startup")
async def startup_prefetch_cache():
    """Warm up in-memory cache for selected items on startup, and optionally refresh.

    Items are controlled by cache settings 'prefetch_items' map, e.g.:
    {"git": true, "locations": false}
    """
    try:
        logger.info("Startup cache: hook invoked")
        # Local imports to avoid circular dependencies at import time
        from settings_manager import settings_manager
        from routers.git import get_git_repo
        from services.cache_service import cache_service

        cache_cfg = settings_manager.get_cache_settings()
        logger.info(f"Startup cache: settings loaded: {cache_cfg}")
        if not cache_cfg.get("enabled", True):
            logger.info("Startup cache: disabled; skipping startup prefetch")
            return

        async def prefetch_commits_once():
            try:
                logger.info("Startup cache: prefetch_commits_once() starting")
                repo = get_git_repo()
                selected_id = settings_manager.get_selected_git_repository()
                # Determine branch; handle empty repos safely
                try:
                    branch_name = repo.active_branch.name
                except Exception:
                    logger.warning("Startup cache: No active branch detected; skipping commits prefetch")
                    return

                # Skip if repo has no valid HEAD
                try:
                    if not repo.head.is_valid():
                        logger.info("Startup cache: Repository has no commits yet; nothing to prefetch")
                        return
                except Exception:
                    logger.info("Startup cache: Unable to validate HEAD; skipping prefetch")
                    return

                # Build commits payload similar to /api/git/commits
                limit = int(cache_cfg.get("max_commits", 500))
                commits = []
                for commit in repo.iter_commits(branch_name, max_count=limit):
                    commits.append({
                        "hash": commit.hexsha,
                        "short_hash": commit.hexsha[:8],
                        "message": commit.message.strip(),
                        "author": {
                            "name": commit.author.name,
                            "email": commit.author.email,
                        },
                        "date": commit.committed_datetime.isoformat(),
                        "files_changed": len(commit.stats.files),
                    })

                ttl = int(cache_cfg.get("ttl_seconds", 600))
                repo_scope = f"repo:{selected_id}" if selected_id else "repo:default"
                cache_key = f"{repo_scope}:commits:{branch_name}"
                cache_service.set(cache_key, commits, ttl)
                logger.info(f"Startup cache: Prefetched {len(commits)} commits for branch '{branch_name}' (ttl={ttl}s)")
            except Exception as e:
                logger.warning(f"Startup cache: commits prefetch failed: {e}")

        async def prefetch_locations_once():
            """Prefetch Nautobot locations list (GraphQL) and store in cache with endpoint-compatible shape."""
            try:
                logger.info("Startup cache: prefetch_locations_once() starting")
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
                logger.info(f"Startup cache: Prefetched locations ({len(locations)} items) (ttl={ttl}s)")
            except Exception as e:
                logger.warning(f"Startup cache: locations prefetch failed: {e}")

        async def refresh_loop():
            # Periodically refresh cache if configured
            interval_min = int(cache_cfg.get("refresh_interval_minutes", 0))
            if interval_min <= 0:
                return
            # Small initial delay to let app finish bootstrapping
            await asyncio.sleep(2)
            while True:
                await prefetch_commits_once()
                await asyncio.sleep(interval_min * 60)

        # Kick off a one-time prefetch without blocking startup (if enabled)
        if cache_cfg.get("prefetch_on_startup", True):
            prefetch_items = cache_cfg.get("prefetch_items") or {"git": True, "locations": False}
            # Map item keys to their prefetch coroutine
            prefetch_map = {
                "git": prefetch_commits_once,
                "locations": prefetch_locations_once,
            }
            # Launch tasks for all enabled items that we know how to prefetch
            for key, enabled in prefetch_items.items():
                if enabled and key in prefetch_map:
                    logger.info(f"Startup cache: prefetch enabled for '{key}' — scheduling task")
                    asyncio.create_task(prefetch_map[key]())
                elif not enabled:
                    logger.info(f"Startup cache: prefetch disabled for '{key}'")
                else:
                    logger.info(f"Startup cache: no prefetch handler for '{key}'")
        # Start background refresh if requested (applies to git commits only)
        if int(cache_cfg.get("refresh_interval_minutes", 0)) > 0:
            # Only refresh commits if git prefetch is enabled
            p_items = cache_cfg.get("prefetch_items") or {"git": True, "locations": False}
            if p_items.get("git", True):
                logger.info("Startup cache: starting commits refresh loop task")
                asyncio.create_task(refresh_loop())
            else:
                logger.info("Startup cache: refresh loop disabled because git prefetch is off")
    except Exception as e:
        logger.warning(f"Startup cache: Failed to initialize cache prefetch: {e}")
