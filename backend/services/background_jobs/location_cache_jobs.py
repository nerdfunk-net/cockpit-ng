"""
Location caching Celery tasks.
Background jobs for caching location data from Nautobot into Redis.
"""

import asyncio
import logging
from typing import Dict, Any
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="cache_all_locations")
def cache_all_locations_task(self, job_run_id: int = None) -> Dict[str, Any]:
    """
    Celery task to fetch all locations from Nautobot and cache them in Redis.

    This task:
    1. Fetches all locations from Nautobot via GraphQL
    2. Caches the location list with key: nautobot:locations:list
    3. Reports progress via Celery task state updates

    Returns:
        Dictionary with task results (status, cached count)
    """
    try:
        logger.info("Starting cache_all_locations task: %s", self.request.id)

        # Import here to avoid circular dependencies
        import service_factory

        nautobot_service = service_factory.build_nautobot_service()
        cache_service = service_factory.build_cache_service()
        from services.background_jobs.base import safe_graphql_query

        # Update task state
        self.update_state(
            state="PROGRESS", meta={"status": "Fetching locations from Nautobot..."}
        )

        # GraphQL query for all locations with hierarchy
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

        # Execute GraphQL query
        result = asyncio.run(nautobot_service.graphql_query(query, {}))

        # Validate GraphQL result
        success, error_msg, data = safe_graphql_query(result)
        if not success:
            logger.error("Task %s: %s", self.request.id, error_msg)
            return {
                "status": "failed",
                "error": error_msg,
                "cached": 0,
            }

        locations = data.get("locations", [])
        total_locations = len(locations)

        if total_locations == 0:
            logger.warning("Task %s: No locations found in Nautobot", self.request.id)
            result = {
                "status": "completed",
                "message": "No locations found to cache",
                "cached": 0,
            }
            if job_run_id:
                import job_run_manager

                job_run_manager.mark_completed(job_run_id, result=result)
            return result

        logger.info(
            "Task %s: Processing %s locations", self.request.id, total_locations
        )

        # Cache configuration - locations change less frequently, use 10 min TTL
        LOCATION_TTL = 600  # 10 minutes

        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={
                "current": total_locations,
                "total": total_locations,
                "status": f"Caching {total_locations} locations...",
            },
        )

        # Cache the locations list
        cache_key = "nautobot:locations:list"
        cache_service.set(cache_key, locations, LOCATION_TTL)

        logger.info(
            "Task %s: Successfully cached %s locations",
            self.request.id,
            total_locations,
        )

        result = {
            "status": "completed",
            "message": "Successfully cached %d locations" % total_locations,
            "cached": total_locations,
            "total": total_locations,
        }
        if job_run_id:
            import job_run_manager

            job_run_manager.mark_completed(job_run_id, result=result)
        return result

    except Exception as e:
        error_msg = str(e)
        logger.error(
            "Task %s failed with exception: %s",
            self.request.id,
            error_msg,
            exc_info=True,
        )
        result = {
            "status": "failed",
            "error": error_msg,
            "cached": 0,
        }
        if job_run_id:
            import job_run_manager

            job_run_manager.mark_failed(job_run_id, error_msg)
        return result
