"""
Service for managing CheckMK folder operations.
"""

from __future__ import annotations
import logging
from typing import Dict, Any

from utils.cmk_folder_utils import split_checkmk_folder_path

logger = logging.getLogger(__name__)


class CheckMKFolderService:
    """Service for managing CheckMK folder operations."""

    async def create_path(
        self, folder_path: str, site_name: str, current_user: Dict[str, Any]
    ) -> bool:
        """Create a complete folder path in CheckMK by creating folders incrementally.

        Args:
            folder_path: CheckMK folder path like "~subfolder1~subfolder2~subfolder3"
            site_name: CheckMK site name to use
            current_user: User context for authentication

        Returns:
            True if path creation was successful, False otherwise
        """
        try:
            # Handle root path case
            if not folder_path or folder_path == "/" or folder_path == "~":
                return True

            path_parts = split_checkmk_folder_path(folder_path)

            if not path_parts:
                return True

            # Use site-aware CheckMK client
            from services.checkmk.client_factory import get_checkmk_client
            from checkmk.client import CheckMKAPIError

            client = get_checkmk_client()
            logger.info(
                "Creating folder path '%s' in site '%s'", folder_path, site_name
            )
            logger.info("Path parts to create: %s", path_parts)

            # Build and create each path incrementally
            for i in range(len(path_parts)):
                # Determine parent folder
                if i == 0:
                    parent_folder = "/"  # First folder goes under root
                else:
                    parent_folder = "~" + "~".join(path_parts[:i])

                folder_name = path_parts[i]

                try:
                    # Log folder creation attempt
                    logger.info(
                        "Attempting to create folder '%s' in parent '%s'",
                        folder_name,
                        parent_folder,
                    )

                    # Try to create the folder using direct client call
                    # Convert folder path format: CheckMK uses ~ instead of /
                    # First normalize double slashes, then convert / to ~
                    normalized_parent_folder = (
                        parent_folder.replace("//", "/") if parent_folder else "/"
                    )
                    checkmk_parent_folder = (
                        normalized_parent_folder.replace("/", "~")
                        if normalized_parent_folder
                        else "~"
                    )
                    client.create_folder(
                        name=folder_name,
                        title=folder_name,  # Use same as name for title
                        parent=checkmk_parent_folder,
                        attributes={},
                    )
                    logger.info(
                        "Successfully created folder '%s' in parent '%s'",
                        folder_name,
                        parent_folder,
                    )

                except CheckMKAPIError as e:
                    # Check if this is a "folder already exists" error
                    if "already exists" in str(e).lower() or "400" in str(e):
                        logger.info(
                            "Folder '%s' already exists in parent '%s' - continuing",
                            folder_name,
                            parent_folder,
                        )
                        continue
                    else:
                        logger.error(
                            "CheckMK API error creating folder '%s': %s",
                            folder_name,
                            e,
                        )
                        return False
                except Exception as e:
                    logger.error(
                        "General error creating folder '%s': %s", folder_name, e
                    )
                    return False

            return True

        except Exception as e:
            logger.error("Error creating CheckMK path '%s': %s", folder_path, e)
            return False


# Global instance for dependency injection
checkmk_folder_service = CheckMKFolderService()
