"""
CheckMK host group management service.
"""

import asyncio
import logging
from typing import Any, Dict, List

from services.checkmk.base import CheckMKClientFactory

logger = logging.getLogger(__name__)


class CheckMKHostGroupService:
    """Service for CheckMK host group operations."""

    def __init__(self):
        pass

    async def get_host_groups(self) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(client.get_host_groups)

    async def get_host_group(self, group_name: str) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(lambda: client.get_host_group(group_name))

    async def create_host_group(self, name: str, alias: str) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(lambda: client.create_host_group(name, alias))

    async def update_host_group(self, name: str, alias: str) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.update_host_group(name, alias=alias)
        )

    async def delete_host_group(self, name: str) -> None:
        client = CheckMKClientFactory.build_client_from_settings()
        await asyncio.to_thread(lambda: client.delete_host_group(name))

    async def bulk_update_host_groups(self, entries: Any) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(lambda: client.bulk_update_host_groups(entries))

    async def bulk_delete_host_groups(self, entries: Any) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(lambda: client.bulk_delete_host_groups(entries))
