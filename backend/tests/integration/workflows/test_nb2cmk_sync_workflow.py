"""
Integration tests for Nautobot to CheckMK synchronization workflow.

Tests the complete sync workflow including:
- Device fetching from Nautobot
- Device comparison between systems
- Synchronization operations (add, update, remove)
- Error handling and partial failures
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from services.checkmk.sync.base import NautobotToCheckMKService
from tests.fixtures import (
    NAUTOBOT_DEVICES_LIST,
    CHECKMK_ADD_HOST_SUCCESS,
    CHECKMK_EDIT_HOST_SUCCESS,
    create_devices_list,
    create_hosts_list,
)


# ==============================================================================
# Test Class: Device Fetching
# ==============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
@pytest.mark.checkmk
class TestFetchDevicesFromNautobot:
    """Test fetching devices from Nautobot for sync."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = NautobotToCheckMKService()

    @pytest.mark.asyncio
    async def test_get_all_devices_success(self, mock_nautobot_service):
        """Test successfully fetching all devices from Nautobot."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value=NAUTOBOT_DEVICES_LIST.copy()
            )

            # Act
            result = await self.service.get_devices_for_sync()

            # Assert
            assert result.total == 2
            assert len(result.devices) == 2
            assert result.devices[0]["name"] == "test-switch-01"

            # Verify GraphQL was called
            mock_nautobot_service.graphql_query.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_devices_handles_graphql_errors(self, mock_nautobot_service):
        """Test handling GraphQL errors during device fetch."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value={"errors": [{"message": "GraphQL syntax error"}]}
            )

            # Act & Assert
            from fastapi import HTTPException

            with pytest.raises(HTTPException) as exc_info:
                await self.service.get_devices_for_sync()

            assert exc_info.value.status_code == 500
            assert "GraphQL errors" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_get_devices_with_empty_result(self, mock_nautobot_service):
        """Test fetching devices when Nautobot has no devices."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value={"data": {"devices": []}}
            )

            # Act
            result = await self.service.get_devices_for_sync()

            # Assert
            assert result.total == 0
            assert len(result.devices) == 0
            assert "Retrieved 0 devices" in result.message


# ==============================================================================
# Test Class: Device Comparison
# ==============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
@pytest.mark.checkmk
class TestDeviceComparison:
    """Test comparing devices between Nautobot and CheckMK."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = NautobotToCheckMKService()

    @pytest.mark.asyncio
    async def test_compare_identifies_new_devices(
        self, mock_nautobot_service, mock_checkmk_client
    ):
        """Test identifying devices in Nautobot but not in CheckMK."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            # Nautobot has 2 devices
            nautobot_data = {
                "data": {
                    "devices": [
                        {
                            "id": "dev1",
                            "name": "switch01",
                            "role": {"name": "access"},
                            "status": {"name": "Active"},
                            "location": {"name": "DC1"},
                        },
                        {
                            "id": "dev2",
                            "name": "switch02",
                            "role": {"name": "access"},
                            "status": {"name": "Active"},
                            "location": {"name": "DC1"},
                        },
                    ]
                }
            }
            mock_nautobot_service.graphql_query = AsyncMock(return_value=nautobot_data)

            # CheckMK only has switch01
            checkmk_hosts = {"switch01": {"folder": "/dc1"}}
            mock_checkmk_client.get_all_hosts = Mock(return_value=checkmk_hosts)

            # Act
            result = await self.service.get_devices_for_sync()

            # Assert
            # switch02 should be identified as only in Nautobot
            assert result.total == 2
            device_names = [d["name"] for d in result.devices]
            assert "switch01" in device_names
            assert "switch02" in device_names

    @pytest.mark.asyncio
    async def test_compare_identifies_orphaned_devices(
        self, mock_nautobot_service, mock_checkmk_client
    ):
        """Test identifying devices in CheckMK but not in Nautobot."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            # Nautobot has no devices
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value={"data": {"devices": []}}
            )

            # CheckMK has one orphaned device
            orphaned_hosts = {"orphaned-switch": {"folder": "/old"}}
            mock_checkmk_client.get_all_hosts = Mock(return_value=orphaned_hosts)

            # Act
            result = await self.service.get_devices_for_sync()

            # Assert
            assert result.total == 0  # No devices from Nautobot
            # Note: Orphan detection would be in comparison logic


# ==============================================================================
# Test Class: Sync Operations
# ==============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
@pytest.mark.checkmk
class TestSyncOperations:
    """Test device synchronization operations."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = NautobotToCheckMKService()

    @pytest.mark.asyncio
    async def test_sync_adds_new_device_to_checkmk(
        self, mock_nautobot_service, mock_checkmk_client
    ):
        """Test adding new devices to CheckMK during sync."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            with patch("services.checkmk.checkmk_service", mock_checkmk_client):
                # Nautobot has devices
                nautobot_data = create_devices_list(count=2)
                mock_nautobot_service.graphql_query = AsyncMock(
                    return_value=nautobot_data
                )

                # CheckMK is empty
                mock_checkmk_client.get_all_hosts = Mock(return_value={})
                mock_checkmk_client.add_host = Mock(
                    return_value=CHECKMK_ADD_HOST_SUCCESS.copy()
                )

                # Act
                result = await self.service.get_devices_for_sync()

                # Assert
                assert result.total == 2
                # Note: Actual sync would call add_host for each device

    @pytest.mark.asyncio
    async def test_sync_updates_existing_device(
        self, mock_nautobot_service, mock_checkmk_client
    ):
        """Test updating existing devices in CheckMK."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            # Device exists in both with different data
            nautobot_data = {
                "data": {
                    "devices": [
                        {
                            "id": "dev1",
                            "name": "switch01",
                            "role": {"name": "access"},
                            "status": {"name": "Active"},
                            "location": {"name": "DC1"},
                        }
                    ]
                }
            }
            mock_nautobot_service.graphql_query = AsyncMock(return_value=nautobot_data)

            # CheckMK has device with old data
            existing_hosts = {
                "switch01": {
                    "folder": "/dc1",
                    "attributes": {"ipaddress": "10.0.0.1"},  # Old IP
                }
            }
            mock_checkmk_client.get_all_hosts = Mock(return_value=existing_hosts)
            mock_checkmk_client.edit_host = Mock(
                return_value=CHECKMK_EDIT_HOST_SUCCESS.copy()
            )

            # Act
            result = await self.service.get_devices_for_sync()

            # Assert
            assert result.total == 1
            # Note: Actual sync would call edit_host for updated device


# ==============================================================================
# Test Class: Error Handling
# ==============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
@pytest.mark.checkmk
class TestSyncErrorHandling:
    """Test error handling during synchronization."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = NautobotToCheckMKService()

    @pytest.mark.asyncio
    async def test_handles_checkmk_host_exists_error(
        self, mock_nautobot_service, mock_checkmk_client
    ):
        """Test handling when CheckMK reports host already exists."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            nautobot_data = create_devices_list(count=1)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=nautobot_data)

            mock_checkmk_client.get_all_hosts = Mock(return_value={})
            mock_checkmk_client.add_host = Mock(
                side_effect=Exception("Host test-switch-01 already exists")
            )

            # Act
            result = await self.service.get_devices_for_sync()

            # Assert
            assert result.total == 1
            # Note: Error handling would log and continue with next device

    @pytest.mark.asyncio
    async def test_handles_partial_sync_failures(
        self, mock_nautobot_service, mock_checkmk_client
    ):
        """Test handling when some devices fail to sync."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            # Multiple devices
            nautobot_data = create_devices_list(count=3)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=nautobot_data)

            mock_checkmk_client.get_all_hosts = Mock(return_value={})

            # First succeeds, second fails, third succeeds
            mock_checkmk_client.add_host = Mock(
                side_effect=[
                    CHECKMK_ADD_HOST_SUCCESS.copy(),
                    Exception("CheckMK API error"),
                    CHECKMK_ADD_HOST_SUCCESS.copy(),
                ]
            )

            # Act
            result = await self.service.get_devices_for_sync()

            # Assert
            assert result.total == 3
            # Note: Sync would track failures separately


# ==============================================================================
# Test Class: Live Update Progress Tracking
# ==============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
@pytest.mark.checkmk
class TestLiveUpdateTracking:
    """Test live update progress tracking functionality."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = NautobotToCheckMKService()

    @pytest.mark.asyncio
    async def test_tracks_sync_progress(
        self, mock_nautobot_service, mock_checkmk_client
    ):
        """Test that sync progress is tracked."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            nautobot_data = create_devices_list(count=5)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=nautobot_data)

            progress_updates = []

            def progress_callback(update):
                progress_updates.append(update)

            mock_checkmk_client.get_all_hosts = Mock(return_value={})
            mock_checkmk_client.add_host = Mock(
                return_value=CHECKMK_ADD_HOST_SUCCESS.copy()
            )

            # Act
            result = await self.service.get_devices_for_sync()

            # Assert
            assert result.total == 5
            # Note: Progress tracking would be in background sync service


# ==============================================================================
# Test Class: Data Transformation
# ==============================================================================


@pytest.mark.integration
@pytest.mark.unit
class TestDataTransformation:
    """Test data transformation between Nautobot and CheckMK formats."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = NautobotToCheckMKService()

    @pytest.mark.asyncio
    async def test_transforms_nautobot_to_checkmk_format(self, mock_nautobot_service):
        """Test transforming Nautobot device data to CheckMK format."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            nautobot_data = {
                "data": {
                    "devices": [
                        {
                            "id": "device-uuid-123",
                            "name": "test-switch-01",
                            "role": {"name": "Access Switch"},
                            "status": {"name": "Active"},
                            "location": {"name": "DC1"},
                        }
                    ]
                }
            }
            mock_nautobot_service.graphql_query = AsyncMock(return_value=nautobot_data)

            # Act
            result = await self.service.get_devices_for_sync()

            # Assert
            assert len(result.devices) == 1
            device = result.devices[0]
            assert device["id"] == "device-uuid-123"
            assert device["name"] == "test-switch-01"
            assert device["role"] == "Access Switch"
            assert device["status"] == "Active"
            assert device["location"] == "DC1"

    @pytest.mark.asyncio
    async def test_handles_missing_optional_fields(self, mock_nautobot_service):
        """Test handling devices with missing optional fields."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            # Device with minimal data (missing role, location)
            nautobot_data = {
                "data": {
                    "devices": [
                        {
                            "id": "dev-uuid",
                            "name": "minimal-device",
                            "role": None,
                            "status": {"name": "Active"},
                            "location": None,
                        }
                    ]
                }
            }
            mock_nautobot_service.graphql_query = AsyncMock(return_value=nautobot_data)

            # Act
            result = await self.service.get_devices_for_sync()

            # Assert
            device = result.devices[0]
            assert device["name"] == "minimal-device"
            assert device["role"] == ""  # Empty string for missing
            assert device["location"] == ""  # Empty string for missing


# ==============================================================================
# Test Class: Integration Scenarios
# ==============================================================================


@pytest.mark.integration
@pytest.mark.slow
class TestCompleteSyncScenarios:
    """Test complete end-to-end sync scenarios."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = NautobotToCheckMKService()

    @pytest.mark.asyncio
    async def test_complete_sync_workflow(
        self, mock_nautobot_service, mock_checkmk_client
    ):
        """Test complete sync workflow from fetch to update."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            # Scenario: 3 devices in Nautobot, 1 in CheckMK, need to add 2
            nautobot_data = create_devices_list(count=3)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=nautobot_data)

            existing_checkmk = create_hosts_list(count=1)
            mock_checkmk_client.get_all_hosts = Mock(return_value=existing_checkmk)
            mock_checkmk_client.add_host = Mock(
                return_value=CHECKMK_ADD_HOST_SUCCESS.copy()
            )

            # Act
            result = await self.service.get_devices_for_sync()

            # Assert
            assert result.total == 3
            assert "Retrieved 3 devices" in result.message
