"""
CheckMK activation service — pending changes and activation lifecycle.
"""

import asyncio
import logging
from typing import Any, Dict

from services.checkmk.base import CheckMKClientFactory

logger = logging.getLogger(__name__)


class CheckMKActivationService:
    """Service for CheckMK configuration activation operations."""

    def __init__(self):
        pass

    async def get_pending_changes(self) -> Dict[str, Any]:
        """Fetch pending changes including the ETag required for targeted activation."""
        client = CheckMKClientFactory.build_client_from_settings()

        def _fetch() -> Dict[str, Any]:
            response = client._make_request(
                "GET", "domain-types/activation_run/collections/pending_changes"
            )
            etag = "*"
            if response.status_code == 200:
                etag = response.headers.get("ETag", "*")
            result = client._handle_response(response)
            result["etag"] = etag.strip('"')
            return result

        logger.debug("Getting pending changes from CheckMK")
        return await asyncio.to_thread(_fetch)

    async def activate_changes(self, request: Any, etag: str = "*") -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.activate_changes(
                sites=request.sites,
                force_foreign_changes=request.force_foreign_changes,
                redirect=request.redirect,
                etag=etag,
            )
        )

    async def activate_changes_with_etag(
        self, etag: str, request: Any
    ) -> Dict[str, Any]:
        return await self.activate_changes(request, etag=etag)

    async def get_activation_status(self, activation_id: str) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.get_activation_status(activation_id)
        )

    async def wait_for_activation_completion(
        self, activation_id: str
    ) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(
            lambda: client.wait_for_activation_completion(activation_id)
        )

    async def get_running_activations(self) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(client.get_running_activations)
