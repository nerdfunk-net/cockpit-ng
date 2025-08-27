"""
Tests for MCP server using official SDK.
"""

import pytest
import os
import sys
import asyncio
from unittest.mock import patch, AsyncMock, MagicMock

# Add paths for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

# Import our server components
from server import (
    mcp, list_devices, get_device_config, scan_network, 
    backup_device_configuration, sync_inventory, onboard_device, 
    compare_configurations, CockpitAPIClient
)
from auth import validate_api_key, authenticated_context


class TestAuthentication:
    """Test authentication functionality."""
    
    @patch('auth.sqlite3.connect')
    def test_validate_api_key_valid(self, mock_connect):
        """Test API key validation with valid key."""
        # Mock database response
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.execute.return_value.fetchone.return_value = {
            "username": "testuser"
        }
        
        # Mock user management service
        with patch('auth.get_user_by_username') as mock_get_user:
            mock_get_user.return_value = {
                "username": "testuser",
                "id": 1,
                "status": "active",
                "permissions": 1,
                "realname": "Test User"
            }
            
            api_key = "a" * 42  # Valid length API key
            result = validate_api_key(api_key)
            
            assert result is not None
            assert result["username"] == "testuser"
            assert result["user_id"] == 1
    
    def test_validate_api_key_invalid_length(self):
        """Test API key validation with invalid length."""
        result = validate_api_key("short_key")
        assert result is None
    
    @patch('auth.sqlite3.connect')
    def test_validate_api_key_not_found(self, mock_connect):
        """Test API key validation with non-existent key."""
        # Mock database response with no results
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.execute.return_value.fetchone.return_value = None
        
        api_key = "b" * 42
        result = validate_api_key(api_key)
        assert result is None
    
    def test_authenticated_context_valid(self):
        """Test authenticated context with valid API key."""
        with patch('auth.validate_api_key') as mock_validate:
            mock_validate.return_value = {"username": "testuser", "user_id": 1}
            
            with authenticated_context("valid_key") as user_info:
                assert user_info["username"] == "testuser"
    
    def test_authenticated_context_invalid(self):
        """Test authenticated context with invalid API key."""
        with patch('auth.validate_api_key') as mock_validate:
            mock_validate.return_value = None
            
            with pytest.raises(Exception, match="Invalid or missing API key"):
                with authenticated_context("invalid_key"):
                    pass


class TestCockpitAPIClient:
    """Test HTTP client functionality."""
    
    @pytest.mark.asyncio
    async def test_get_request_success(self):
        """Test successful GET request."""
        client = CockpitAPIClient("test_api_key")
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"devices": []}
            mock_response.raise_for_status.return_value = None
            mock_client.request.return_value = mock_response
            
            result = await client.get("/test")
            assert result == {"devices": []}
    
    @pytest.mark.asyncio
    async def test_post_request_success(self):
        """Test successful POST request."""
        client = CockpitAPIClient("test_api_key")
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"success": True}
            mock_response.raise_for_status.return_value = None
            mock_client.request.return_value = mock_response
            
            result = await client.post("/test", json={"data": "test"})
            assert result == {"success": True}


class TestMCPResources:
    """Test MCP resource endpoints."""
    
    @pytest.mark.asyncio
    async def test_list_devices(self):
        """Test device listing resource."""
        mock_devices_data = [
            {
                "id": "1",
                "name": "Router 1",
                "primary_ip4": {"address": "192.168.1.1"},
                "device_type": {"display": "Router"},
                "status": {"display": "Active"},
                "location": {"display": "DC1"}
            }
        ]
        
        with patch('server.CockpitAPIClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.get.return_value = {"devices": mock_devices_data}
            
            with patch('server.get_api_key_from_context', return_value="test_key"):
                devices = await list_devices()
                
                assert len(devices) == 1
                assert devices[0].id == "1"
                assert devices[0].name == "Router 1"
                assert devices[0].ip_address == "192.168.1.1"
    
    @pytest.mark.asyncio
    async def test_get_device_config(self):
        """Test device configuration resource."""
        mock_config = "hostname router1\n!\ninterface GigabitEthernet0/1"
        
        with patch('server.CockpitAPIClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.get.return_value = {"config": mock_config}
            
            with patch('server.get_api_key_from_context', return_value="test_key"):
                config = await get_device_config("device-1")
                
                assert config == mock_config


class TestMCPTools:
    """Test MCP tool endpoints."""
    
    @pytest.mark.asyncio
    async def test_scan_network(self):
        """Test network scanning tool."""
        mock_response = {
            "devices_found": 5,
            "scan_id": "scan-123",
            "status": "completed",
            "message": "Scan completed successfully"
        }
        
        with patch('server.CockpitAPIClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.post.return_value = mock_response
            
            with patch('server.get_api_key_from_context', return_value="test_key"):
                result = await scan_network("192.168.1.0/24")
                
                assert result.network_range == "192.168.1.0/24"
                assert result.devices_found == 5
                assert result.scan_id == "scan-123"
                assert result.status == "completed"
    
    @pytest.mark.asyncio
    async def test_backup_device_configuration(self):
        """Test device backup tool."""
        mock_response = {
            "device_name": "Router 1",
            "backup_id": "backup-123",
            "status": "completed",
            "message": "Backup successful",
            "timestamp": "2024-01-01T12:00:00Z"
        }
        
        with patch('server.CockpitAPIClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.post.return_value = mock_response
            
            with patch('server.get_api_key_from_context', return_value="test_key"):
                result = await backup_device_configuration("device-1")
                
                assert result.device_id == "device-1"
                assert result.device_name == "Router 1"
                assert result.backup_id == "backup-123"
                assert result.status == "completed"
    
    @pytest.mark.asyncio
    async def test_sync_inventory(self):
        """Test inventory sync tool."""
        mock_response = {
            "devices_synced": 10,
            "errors": []
        }
        
        with patch('server.CockpitAPIClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.post.return_value = mock_response
            
            with patch('server.get_api_key_from_context', return_value="test_key"):
                result = await sync_inventory()
                
                assert result["status"] == "completed"
                assert result["devices_synced"] == 10
                assert result["errors"] == []
    
    @pytest.mark.asyncio
    async def test_onboard_device(self):
        """Test device onboarding tool."""
        mock_response = {
            "device_id": "device-new-1"
        }
        
        with patch('server.CockpitAPIClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.post.return_value = mock_response
            
            with patch('server.get_api_key_from_context', return_value="test_key"):
                result = await onboard_device(
                    device_name="New Router",
                    ip_address="192.168.1.10",
                    device_type="router",
                    location="DC2"
                )
                
                assert result["status"] == "success"
                assert result["device_id"] == "device-new-1"
    
    @pytest.mark.asyncio
    async def test_compare_configurations(self):
        """Test configuration comparison tool."""
        mock_response = {
            "differences_found": True,
            "diff_summary": "2 differences found",
            "details": {"added_lines": 5, "removed_lines": 2}
        }
        
        with patch('server.CockpitAPIClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.post.return_value = mock_response
            
            with patch('server.get_api_key_from_context', return_value="test_key"):
                result = await compare_configurations("device-1", "config-1", "config-2")
                
                assert result.device_id == "device-1"
                assert result.differences_found is True
                assert result.diff_summary == "2 differences found"


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])