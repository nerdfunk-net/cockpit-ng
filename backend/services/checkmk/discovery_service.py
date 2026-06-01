"""
CheckMK service discovery service.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from services.checkmk.base import CheckMKClientFactory

logger = logging.getLogger(__name__)


class CheckMKDiscoveryService:
    """Service for CheckMK service discovery operations."""

    def __init__(self):
        pass

    async def get_service_discovery(self, hostname: str) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(lambda: client.get_service_discovery(hostname))

    async def start_service_discovery(self, hostname: str, mode: str) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.start_service_discovery(hostname, mode)
        )

    async def wait_for_service_discovery(self, hostname: str) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.wait_for_service_discovery(hostname)
        )

    async def update_discovery_phase(
        self,
        hostname: str,
        phase: str,
        services: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        kwargs: Dict[str, Any] = {"phase": phase}
        if services:
            kwargs["services"] = services
        return await asyncio.to_thread(
            lambda: client.update_discovery_phase(hostname, **kwargs)
        )

    async def start_bulk_discovery(self, request: Any) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.start_bulk_discovery(
                hostnames=request.hostnames,
                options={
                    "monitor_undecided_services": request.options.monitor_undecided_services,
                    "remove_vanished_services": request.options.remove_vanished_services,
                    "update_service_labels": request.options.update_service_labels,
                    "update_service_parameters": request.options.update_service_parameters,
                    "update_host_labels": request.options.update_host_labels,
                },
                do_full_scan=request.do_full_scan,
                bulk_size=request.bulk_size,
                ignore_errors=request.ignore_errors,
            )
        )
