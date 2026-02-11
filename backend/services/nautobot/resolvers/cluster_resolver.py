"""
Cluster resolver for Nautobot virtualization cluster operations.

This resolver handles read-only operations for virtualization clusters.
"""

import logging
from typing import Optional, Dict, Any, List
from ..common.exceptions import NautobotAPIError
from .base_resolver import BaseResolver

logger = logging.getLogger(__name__)


class ClusterResolver(BaseResolver):
    """Resolver for virtualization cluster operations."""

    async def get_all_clusters(self) -> List[Dict[str, Any]]:
        """
        Get all clusters from Nautobot.

        Returns:
            List of cluster dictionaries with virtual machines and device assignments

        Raises:
            Exception: If GraphQL query fails
        """
        query = """
        {
          clusters {
            id
            name
            virtual_machines {
              id
              name
            }
            device_assignments {
              id
              device {
                id
                name
              }
            }
          }
        }
        """
        try:
            result = await self.nautobot.graphql_query(query)

            if "errors" in result:
                logger.error(f"GraphQL errors fetching clusters: {result['errors']}")
                raise NautobotAPIError(f"GraphQL errors: {result['errors']}")

            clusters = result.get("data", {}).get("clusters", [])
            logger.info(f"Retrieved {len(clusters)} clusters from Nautobot")
            return clusters

        except Exception as e:
            logger.error(f"Failed to fetch clusters: {e}", exc_info=True)
            raise

    async def get_cluster_by_id(self, cluster_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific cluster by ID from Nautobot.

        Args:
            cluster_id: UUID of the cluster

        Returns:
            Cluster dictionary with virtual machines and device assignments, or None if not found

        Raises:
            Exception: If GraphQL query fails
        """
        query = """
        query getCluster($id: ID!) {
          clusters(id: $id) {
            id
            name
            virtual_machines {
              id
              name
            }
            device_assignments {
              id
              device {
                id
                name
              }
            }
          }
        }
        """
        try:
            result = await self.nautobot.graphql_query(query, {"id": cluster_id})

            if "errors" in result:
                logger.error(
                    f"GraphQL errors fetching cluster {cluster_id}: {result['errors']}"
                )
                raise NautobotAPIError(f"GraphQL errors: {result['errors']}")

            clusters = result.get("data", {}).get("clusters", [])
            if clusters:
                logger.info(f"Retrieved cluster {cluster_id} from Nautobot")
                return clusters[0]
            else:
                logger.warning(f"Cluster {cluster_id} not found in Nautobot")
                return None

        except Exception as e:
            logger.error(f"Failed to fetch cluster {cluster_id}: {e}", exc_info=True)
            raise
