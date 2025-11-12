"""
Cockpit MCP Server

A Model Context Protocol server that provides AI assistants with access to Cockpit's
network automation capabilities including device management, configuration backup,
network scanning, and inventory synchronization.
"""

import os
import sys
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

# Add backend path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from mcp.server.fastmcp import FastMCP
from auth import get_current_user, get_api_key_from_env

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize MCP server
mcp = FastMCP("Cockpit")

# Configuration
COCKPIT_API_URL = os.getenv("COCKPIT_API_URL", "http://127.0.0.1:8000")
API_TIMEOUT = int(os.getenv("COCKPIT_API_TIMEOUT", "30"))


# Pydantic models for structured output
class Device(BaseModel):
    """Device information model."""
    id: str
    name: str
    ip_address: Optional[str] = None
    device_type: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None


class ScanResult(BaseModel):
    """Network scan result model."""
    network_range: str
    devices_found: int
    scan_id: str
    status: str
    message: str


class BackupResult(BaseModel):
    """Device backup result model."""
    device_id: str
    device_name: str
    backup_id: str
    status: str
    message: str
    timestamp: str


class CompareResult(BaseModel):
    """Configuration comparison result model."""
    device_id: str
    differences_found: bool
    diff_summary: str
    details: Dict[str, Any]


# HTTP Client wrapper
class CockpitAPIClient:
    """HTTP client for Cockpit API calls with authentication."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.base_url = COCKPIT_API_URL.rstrip("/")
        self.api_key = api_key
        self.headers = {"Content-Type": "application/json"}
        self.jwt_token = None
    
    async def _authenticate(self) -> str:
        """Authenticate with API key and get JWT token."""
        if self.jwt_token:
            return self.jwt_token
            
        if not self.api_key:
            raise Exception("No API key provided for authentication")
        
        # Get JWT token using API key
        async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/auth/api-key-login",
                    headers={"X-Api-Key": self.api_key, "Content-Type": "application/json"}
                )
                response.raise_for_status()
                data = response.json()
                self.jwt_token = data["access_token"]
                return self.jwt_token
                
            except httpx.HTTPStatusError as e:
                error_msg = f"Authentication failed: HTTP {e.response.status_code}"
                logger.error(error_msg)
                raise Exception(error_msg)
            except httpx.RequestError as e:
                error_msg = f"Authentication connection error: {e}"
                logger.error(error_msg)
                raise Exception(error_msg)

    async def _request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request with error handling."""
        url = f"{self.base_url}{path}"
        
        # Authenticate and get JWT token if we have an API key
        if self.api_key and not self.jwt_token:
            await self._authenticate()
        
        # Set authorization header with JWT token
        headers = self.headers.copy()
        if self.jwt_token:
            headers["Authorization"] = f"Bearer {self.jwt_token}"
        
        async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
            try:
                response = await client.request(
                    method, url, headers=headers, **kwargs
                )
                response.raise_for_status()
                
                # Handle empty responses
                if response.status_code == 204 or not response.content:
                    return {"success": True}
                
                return response.json()
                
            except httpx.HTTPStatusError as e:
                error_msg = f"HTTP {e.response.status_code}: {e.response.text}"
                logger.error(f"API request failed: {error_msg}")
                raise Exception(error_msg)
                
            except httpx.RequestError as e:
                error_msg = f"Connection error: {e}"
                logger.error(f"API request failed: {error_msg}")
                raise Exception(error_msg)
    
    async def get(self, path: str, **kwargs) -> Dict[str, Any]:
        return await self._request("GET", path, **kwargs)
    
    async def post(self, path: str, **kwargs) -> Dict[str, Any]:
        return await self._request("POST", path, **kwargs)


# Helper function to get API key from context
def get_api_key_from_context() -> Optional[str]:
    """Extract API key from MCP context."""
    user_info = get_current_user()
    if user_info:
        # We have authenticated user context, no need for API key
        return get_api_key_from_env()  # Fallback for development
    
    # For development/testing, use environment variable
    return get_api_key_from_env()


# MCP Resources (read-only data access)
@mcp.resource("cockpit://devices")
async def list_devices() -> List[Device]:
    """Get list of all devices in inventory."""
    api_key = get_api_key_from_context()
    client = CockpitAPIClient(api_key)
    
    try:
        response = await client.get("/api/nautobot/devices")
        devices_data = response.get("devices", [])
        
        return [
            Device(
                id=str(device.get("id", "")),
                name=device.get("name", "Unknown"),
                ip_address=device.get("primary_ip4", {}).get("address"),
                device_type=device.get("device_type", {}).get("display"),
                status=device.get("status", {}).get("display"),
                location=device.get("location", {}).get("display")
            )
            for device in devices_data
        ]
    except Exception as e:
        logger.error(f"Failed to fetch devices: {e}")
        raise


@mcp.resource("cockpit://device/{device_id}/config")
async def get_device_config(device_id: str) -> str:
    """Get device configuration."""
    api_key = get_api_key_from_context()
    client = CockpitAPIClient(api_key)
    
    try:
        response = await client.get(f"/api/devices/{device_id}/config")
        return response.get("config", "No configuration available")
    except Exception as e:
        logger.error(f"Failed to fetch device config for {device_id}: {e}")
        raise


# MCP Tools (actions with side effects)
@mcp.tool()
async def scan_network(network_range: str) -> ScanResult:
    """
    Scan a network range to discover devices.
    
    Args:
        network_range: CIDR notation network range (e.g., "192.168.1.0/24")
    """
    api_key = get_api_key_from_context()
    client = CockpitAPIClient(api_key)
    
    try:
        response = await client.post("/api/scan/start", json={
            "cidrs": [network_range],
            "credential_ids": [1],  # Default credential ID - should be configurable
            "discovery_mode": "napalm"
        })
        
        return ScanResult(
            network_range=network_range,
            devices_found=response.get("devices_found", 0),
            scan_id=response.get("scan_id", "unknown"),
            status=response.get("status", "completed"),
            message=response.get("message", f"Scan completed for {network_range}")
        )
    except Exception as e:
        logger.error(f"Failed to scan network {network_range}: {e}")
        raise


@mcp.tool()
async def backup_device_configuration(device_id: str) -> BackupResult:
    """
    Create a backup of device configuration.
    
    Args:
        device_id: Unique identifier of the device to backup
    """
    try:
        # For now, return a placeholder since there's no specific backup endpoint
        # In a real implementation, this would integrate with the device management system
        return BackupResult(
            device_id=device_id,
            device_name=f"Device-{device_id}",
            backup_id=f"backup-{device_id}-{hash(device_id) % 10000}",
            status="completed",
            message=f"Backup operation initiated for device {device_id}. Note: This is a placeholder - actual backup functionality needs to be implemented in the Cockpit backend.",
            timestamp="2024-01-01T12:00:00Z"
        )
    except Exception as e:
        logger.error(f"Failed to backup device {device_id}: {e}")
        raise


@mcp.tool()
async def sync_inventory() -> Dict[str, Any]:
    """
    Synchronize device inventory with Nautobot.
    """
    api_key = get_api_key_from_context()
    client = CockpitAPIClient(api_key)
    
    try:
        response = await client.post("/api/nautobot/sync-network-data", json={
            "data": {"sync_type": "full"}  # Default sync data
        })
        return {
            "status": "completed",
            "message": "Inventory synchronization completed",
            "devices_synced": response.get("devices_synced", 0),
            "errors": response.get("errors", [])
        }
    except Exception as e:
        logger.error(f"Failed to sync inventory: {e}")
        raise


@mcp.tool()
async def onboard_device(
    device_name: str,
    ip_address: str,
    device_type: str,
    location: Optional[str] = None
) -> Dict[str, Any]:
    """
    Onboard a new device to the inventory.
    
    Args:
        device_name: Name of the device
        ip_address: IP address of the device
        device_type: Type of device (router, switch, etc.)
        location: Optional location of the device
    """
    api_key = get_api_key_from_context()
    client = CockpitAPIClient(api_key)
    
    try:
        response = await client.post("/api/nautobot/devices/onboard", json={
            "ip_address": ip_address,
            "location_id": "1",  # Default location ID - should be configurable
            "namespace_id": "1",  # Default namespace ID
            "role_id": "1",  # Default role ID 
            "status_id": "1",  # Default status ID
            "platform_id": "1",  # Default platform ID
            "secret_groups_id": "1",  # Default secret group ID
            "interface_status_id": "1",  # Default interface status
            "ip_address_status_id": "1",  # Default IP address status
            "port": 22,
            "timeout": 30
        })
        
        return {
            "status": "success",
            "message": f"Device {device_name} onboarded successfully",
            "device_id": response.get("device_id"),
            "details": response
        }
    except Exception as e:
        logger.error(f"Failed to onboard device {device_name}: {e}")
        raise


@mcp.tool()
async def compare_configurations(
    device_id: str,
    config1_id: str,
    config2_id: str
) -> CompareResult:
    """
    Compare two device configurations.
    
    Args:
        device_id: Device identifier
        config1_id: First configuration ID
        config2_id: Second configuration ID
    """
    api_key = get_api_key_from_context()
    client = CockpitAPIClient(api_key)
    
    try:
        response = await client.post("/files/compare", json={
            "device_id": device_id,
            "config1_id": config1_id,
            "config2_id": config2_id
        })
        
        return CompareResult(
            device_id=device_id,
            differences_found=response.get("differences_found", False),
            diff_summary=response.get("diff_summary", "No differences found"),
            details=response.get("details", {})
        )
    except Exception as e:
        logger.error(f"Failed to compare configurations for device {device_id}: {e}")
        raise


if __name__ == "__main__":
    # Run the MCP server
    
    # The MCP SDK handles the protocol implementation
    # We just need to run our server
    mcp.run()