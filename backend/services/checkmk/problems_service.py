"""
CheckMK problems service — acknowledgements, downtimes, and comments.
"""

import asyncio
import logging
from typing import Any, Dict

from services.checkmk.base import CheckMKClientFactory

logger = logging.getLogger(__name__)


class CheckMKProblemsService:
    """Service for CheckMK problem management operations."""

    def __init__(self):
        pass

    async def acknowledge_host_problem(self, request: Any) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.acknowledge_host_problem(
                hostname=request.host_name,
                comment=request.comment,
                sticky=request.sticky,
                persistent=request.persistent,
                notify=request.notify,
            )
        )

    async def acknowledge_service_problem(self, request: Any) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.acknowledge_service_problem(
                hostname=request.host_name,
                service_description=request.service_description,
                comment=request.comment,
                sticky=request.sticky,
                persistent=request.persistent,
                notify=request.notify,
            )
        )

    async def delete_acknowledgment(self, ack_id: str) -> None:
        client = CheckMKClientFactory.build_client_from_settings()
        await asyncio.to_thread(lambda: client.delete_acknowledgment(ack_id))

    async def create_host_downtime(self, request: Any) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.create_host_downtime(
                hostname=request.host_name,
                start_time=request.start_time,
                end_time=request.end_time,
                comment=request.comment,
                downtime_type=request.downtime_type,
            )
        )

    async def add_host_comment(self, request: Any) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.add_host_comment(
                hostname=request.host_name,
                comment=request.comment,
                persistent=request.persistent,
            )
        )

    async def add_service_comment(self, request: Any) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.add_service_comment(
                hostname=request.host_name,
                service_description=request.service_description,
                comment=request.comment,
                persistent=request.persistent,
            )
        )
