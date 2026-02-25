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
def cache_all_locations_task(self) -> Dict[str, Any]:
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
        logger.info(f"Starting cache_all_locations task: {self.request.id}")

        # Import here to avoid circular dependencies
        from services.nautobot import nautobot_service
        from services.settings.cache import cache_service
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

        # Execute GraphQL query (need to run in event loop)
        try:
            result = asyncio.run(nautobot_service.graphql_query(query, {}))
        except RuntimeError:
            # If we're already in an event loop, create a new one
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(
                    nautobot_service.graphql_query(query, {})
                )
            finally:
                loop.close()

        # Validate GraphQL result
        success, error_msg, data = safe_graphql_query(result)
        if not success:
            logger.error(f"Task {self.request.id}: {error_msg}")
            return {
                "status": "failed",
                "error": error_msg,
                "cached": 0,
            }

        locations = data.get("locations", [])
        total_locations = len(locations)

        if total_locations == 0:
            logger.warning(f"Task {self.request.id}: No locations found in Nautobot")
            return {
                "status": "completed",
                "message": "No locations found to cache",
                "cached": 0,
            }

        logger.info(f"Task {self.request.id}: Processing {total_locations} locations")

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
            f"Task {self.request.id}: Successfully cached {total_locations} locations"
        )

        return {
            "status": "completed",
            "message": f"Successfully cached {total_locations} locations",
            "cached": total_locations,
            "total": total_locations,
        }

    except Exception as e:
        logger.error(
            f"Task {self.request.id} failed with exception: {e}", exc_info=True
        )
        return {
            "status": "failed",
            "error": str(e),
            "cached": 0,
        }
