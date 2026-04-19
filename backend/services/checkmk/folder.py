"""
CheckMK folder management service.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

from services.checkmk.base import CheckMKClientFactory, slash_to_tilde
from services.checkmk.exceptions import CheckMKAPIError
from utils.cmk_folder_utils import split_checkmk_folder_path

logger = logging.getLogger(__name__)


class CheckMKFolderService:
    """Service for managing CheckMK folder operations."""

    # ------------------------------------------------------------------
    # Existing: create a full folder path incrementally
    # ------------------------------------------------------------------

    async def create_path(
        self, folder_path: str, site_name: str, current_user: Dict[str, Any]
    ) -> bool:
        """Create a complete folder path in CheckMK by creating folders incrementally."""
        try:
            if not folder_path or folder_path in ("/", "~"):
                return True

            path_parts = split_checkmk_folder_path(folder_path)
            if not path_parts:
                return True

            client = CheckMKClientFactory.build_client_from_settings()
            logger.info(
                "Creating folder path '%s' in site '%s'", folder_path, site_name
            )

            for i in range(len(path_parts)):
                parent_folder = "/" if i == 0 else "~" + "~".join(path_parts[:i])
                folder_name = path_parts[i]
                checkmk_parent = slash_to_tilde(parent_folder)

                try:
                    logger.info(
                        "Attempting to create folder '%s' in parent '%s'",
                        folder_name,
                        parent_folder,
                    )
                    await asyncio.to_thread(
                        lambda: client.create_folder(
                            name=folder_name,
                            title=folder_name,
                            parent=checkmk_parent,
                            attributes={},
                        )
                    )
                    logger.info(
                        "Successfully created folder '%s' in parent '%s'",
                        folder_name,
                        parent_folder,
                    )
                except CheckMKAPIError as e:
                    if "already exists" in str(e).lower() or "400" in str(e):
                        logger.info(
                            "Folder '%s' already exists in parent '%s' - continuing",
                            folder_name,
                            parent_folder,
                        )
                        continue
                    logger.error(
                        "CheckMK API error creating folder '%s': %s", folder_name, e
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

    # ------------------------------------------------------------------
    # GET /folders
    # ------------------------------------------------------------------

    async def get_all_folders(
        self,
        parent: Optional[str] = None,
        recursive: bool = False,
        show_hosts: bool = False,
    ) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        result = await asyncio.to_thread(
            lambda: client.get_all_folders(
                parent=parent, recursive=recursive, show_hosts=show_hosts
            )
        )
        folders = []
        for folder_data in result.get("value", []):
            info = folder_data.get("extensions", {})
            folders.append(
                {
                    "name": folder_data.get("id", ""),
                    "title": folder_data.get("title", ""),
                    "parent": info.get("parent", "/"),
                    "path": info.get("path", "/"),
                    "attributes": info.get("attributes", {}),
                    "hosts": info.get("hosts", []) if show_hosts else None,
                }
            )
        return {"folders": folders, "total": len(folders)}

    # ------------------------------------------------------------------
    # GET /folders/{folder_path}
    # ------------------------------------------------------------------

    async def get_folder(
        self, folder_path: str, show_hosts: bool = False
    ) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.get_folder(
                slash_to_tilde(folder_path), show_hosts=show_hosts
            )
        )

    # ------------------------------------------------------------------
    # POST /folders
    # ------------------------------------------------------------------

    async def create_folder(self, request: Any) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.create_folder(
                name=request.name,
                title=request.title,
                parent=slash_to_tilde(request.parent),
                attributes=request.attributes,
            )
        )

    # ------------------------------------------------------------------
    # PUT /folders/{folder_path}
    # ------------------------------------------------------------------

    async def update_folder(self, folder_path: str, request: Any) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.update_folder(
                folder_path=slash_to_tilde(folder_path),
                title=request.title,
                attributes=request.attributes,
                remove_attributes=request.remove_attributes,
            )
        )

    # ------------------------------------------------------------------
    # DELETE /folders/{folder_path}
    # ------------------------------------------------------------------

    async def delete_folder(
        self, folder_path: str, delete_mode: str = "recursive"
    ) -> None:
        client = CheckMKClientFactory.build_client_from_settings()
        await asyncio.to_thread(
            lambda: client.delete_folder(
                slash_to_tilde(folder_path), delete_mode=delete_mode
            )
        )

    # ------------------------------------------------------------------
    # POST /folders/{folder_path}/move
    # ------------------------------------------------------------------

    async def move_folder(self, folder_path: str, destination: str) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.move_folder(
                slash_to_tilde(folder_path), slash_to_tilde(destination)
            )
        )

    # ------------------------------------------------------------------
    # PUT /folders/bulk-update
    # ------------------------------------------------------------------

    async def bulk_update_folders(self, entries: Any) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(lambda: client.bulk_update_folders(entries))

    # ------------------------------------------------------------------
    # GET /folders/{folder_path}/hosts
    # ------------------------------------------------------------------

    async def get_hosts_in_folder(
        self, folder_path: str, effective_attributes: bool = False
    ) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.get_hosts_in_folder(
                slash_to_tilde(folder_path), effective_attributes=effective_attributes
            )
        )
