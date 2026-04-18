"""
CheckMK monitoring service — live host/service status queries.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from services.checkmk.base import CheckMKClientFactory

logger = logging.getLogger(__name__)


class CheckMKMonitoringService:
    """Service for CheckMK live monitoring queries."""

    def __init__(self):
        pass

    async def get_all_monitored_hosts(
        self,
        columns: Optional[List[str]] = None,
        query: Optional[str] = None,
    ) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.get_all_monitored_hosts(columns=columns, query=query)
        )

    async def get_monitored_host(
        self, hostname: str, columns: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.get_monitored_host(hostname, columns=columns)
        )

    async def get_host_services(
        self,
        hostname: str,
        columns: Optional[List[str]] = None,
        query: Optional[str] = None,
    ) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.get_host_services(hostname, columns=columns, query=query)
        )

    async def show_service(
        self,
        hostname: str,
        service: str,
        columns: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.show_service(hostname, service, columns=columns)
        )
