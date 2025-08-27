"""
HTTP client wrapper for communicating with Cockpit API.
"""

import httpx
import logging
from typing import Dict, Any, Optional
from config import settings

logger = logging.getLogger(__name__)


class CockpitAPIClient:
    """HTTP client for Cockpit backend API."""
    
    def __init__(self):
        self.base_url = settings.cockpit_api_url.rstrip("/")
        self.timeout = settings.cockpit_api_timeout
        self._client: Optional[httpx.AsyncClient] = None
    
    async def __aenter__(self):
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers={"Content-Type": "application/json"}
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._client:
            await self._client.aclose()
    
    async def get(
        self, 
        path: str, 
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make GET request to Cockpit API."""
        return await self._request("GET", path, params=params, headers=headers)
    
    async def post(
        self, 
        path: str, 
        json_data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make POST request to Cockpit API."""
        return await self._request("POST", path, json=json_data, params=params, headers=headers)
    
    async def put(
        self, 
        path: str, 
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make PUT request to Cockpit API."""
        return await self._request("PUT", path, json=json_data, headers=headers)
    
    async def delete(
        self, 
        path: str,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make DELETE request to Cockpit API."""
        return await self._request("DELETE", path, headers=headers)
    
    async def _request(
        self, 
        method: str, 
        path: str, 
        **kwargs
    ) -> Dict[str, Any]:
        """Make HTTP request with error handling."""
        if not self._client:
            raise RuntimeError("Client not initialized. Use async context manager.")
        
        url = path if path.startswith("http") else f"{self.base_url}{path}"
        
        try:
            logger.debug(f"Making {method} request to {url}")
            response = await self._client.request(method, url, **kwargs)
            response.raise_for_status()
            
            # Handle empty responses
            if response.status_code == 204 or not response.content:
                return {"success": True}
            
            return response.json()
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error {e.response.status_code} for {method} {url}")
            try:
                error_detail = e.response.json()
            except:
                error_detail = {"detail": e.response.text}
            raise HTTPError(e.response.status_code, error_detail)
            
        except httpx.RequestError as e:
            logger.error(f"Request error for {method} {url}: {e}")
            raise ConnectionError(f"Failed to connect to Cockpit API: {e}")


class HTTPError(Exception):
    """HTTP error with status code and details."""
    
    def __init__(self, status_code: int, detail: Dict[str, Any]):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"HTTP {status_code}: {detail}")


# Convenience functions for common API calls
async def get_devices() -> Dict[str, Any]:
    """Get device inventory from Nautobot via Cockpit API."""
    async with CockpitAPIClient() as client:
        return await client.get("/api/nautobot/devices")


async def scan_network(network_range: str) -> Dict[str, Any]:
    """Trigger network scan via Cockpit API."""
    async with CockpitAPIClient() as client:
        return await client.post("/api/scan/start", json_data={"network_range": network_range})


async def backup_device_config(device_id: str) -> Dict[str, Any]:
    """Backup device configuration via Cockpit API."""
    async with CockpitAPIClient() as client:
        return await client.post(f"/devices/{device_id}/backup")


async def sync_devices() -> Dict[str, Any]:
    """Sync device inventory via Cockpit API."""
    async with CockpitAPIClient() as client:
        return await client.post("/api/nautobot/sync-network-data")


async def compare_configs(device_id: str, config1: str, config2: str) -> Dict[str, Any]:
    """Compare device configurations via Cockpit API."""
    async with CockpitAPIClient() as client:
        return await client.post("/files/compare", json_data={
            "file1_content": config1,
            "file2_content": config2,
            "device_id": device_id
        })