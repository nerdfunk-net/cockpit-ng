"""
CheckMK host tag group management service.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from services.checkmk.base import CheckMKClientFactory

logger = logging.getLogger(__name__)


class CheckMKTagGroupService:
    """Service for CheckMK host tag group operations."""

    def __init__(self):
        pass

    async def get_all_host_tag_groups(self) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        result = await asyncio.to_thread(client.get_all_host_tag_groups)
        tag_groups = []
        for group_data in result.get("value", []):
            info = group_data.get("extensions", {})
            tag_groups.append(
                {
                    "id": group_data.get("id", ""),
                    "title": group_data.get("title", ""),
                    "topic": info.get("topic"),
                    "help": info.get("help"),
                    "tags": info.get("tags", []),
                }
            )
        return {"tag_groups": tag_groups, "total": len(tag_groups)}

    async def get_host_tag_group(self, name: str) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(lambda: client.get_host_tag_group(name))

    async def create_host_tag_group(self, request: Any) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        tags = [tag.dict() for tag in request.tags]
        return await asyncio.to_thread(
            lambda: client.create_host_tag_group(
                id=request.id,
                title=request.title,
                tags=tags,
                topic=request.topic,
                help=request.help,
            )
        )

    async def update_host_tag_group(self, name: str, request: Any) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        tags = [tag.dict() for tag in request.tags] if request.tags is not None else None
        return await asyncio.to_thread(
            lambda: client.update_host_tag_group(
                name=name,
                title=request.title,
                tags=tags,
                topic=request.topic,
                help=request.help,
                repair=request.repair,
            )
        )

    async def delete_host_tag_group(
        self, name: str, repair: bool = False, mode: Optional[str] = None
    ) -> None:
        client = CheckMKClientFactory.build_client_from_settings()
        await asyncio.to_thread(
            lambda: client.delete_host_tag_group(name, repair=repair, mode=mode)
        )
