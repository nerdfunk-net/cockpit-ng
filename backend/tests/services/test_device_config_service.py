"""
Unit tests for DeviceConfigService.

Tests the device configuration retrieval and storage logic.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock, call
from pathlib import Path
import tempfile
import shutil

from services.device_config_service import DeviceConfigService
from models.backup_models import DeviceBackupInfo


class TestDeviceConfigService:
    """Test suite for DeviceConfigService."""

    @pytest.fixture(autouse=True)
    def setup(self, mock_nautobot_service, mock_netmiko_service):
        """Set up test fixtures before each test."""
        self.service = DeviceConfigService(
            nautobot_service=mock_nautobot_service,
            netmiko_service=mock_netmiko_service,
        )
        self.mock_nautobot = mock_nautobot_service
        self.mock_netmiko = mock_netmiko_service

    def test_fetch_device_from_nautobot_success(self, sample_device_data):
        """Test successful device fetch from Nautobot."""
        # Arrange
        device_id = "device-uuid-123"
        self.mock_nautobot.execute_graphql_query.return_value = sample_device_data

        # Act
        result = self.service.fetch_device_from_nautobot(device_id)

        # Assert
        assert result is not None
        assert result.device_id == device_id
        assert result.device_name == "switch01"
        assert result.device_ip == "192.168.1.1"
        assert result.platform == "cisco_ios"
        assert result.location_hierarchy == ["Region1", "DC1"]
        assert result.device_role == "Access Switch"
        self.mock_nautobot.execute_graphql_query.assert_called_once()

    def test_fetch_device_from_nautobot_no_primary_ip(self):
        """Test device fetch when device has no primary IP."""
        # Arrange
        device_data = {
            "data": {
                "device": {
                    "id": "device-uuid-123",
                    "name": "switch01",
                    "primary_ip4": None,
                    "platform": {"name": "Cisco IOS"},
                    "location": {"name": "DC1", "parent": {"name": "Region1"}},
                    "device_role": {"name": "Access Switch"},
                    "custom_fields": {},
                }
            }
        }
        self.mock_nautobot.execute_graphql_query.return_value = device_data

        # Act
        result = self.service.fetch_device_from_nautobot("device-uuid-123")

        # Assert
        assert result is None

    def test_fetch_device_from_nautobot_graphql_error(self):
        """Test device fetch when GraphQL query fails."""
        # Arrange
        self.mock_nautobot.execute_graphql_query.side_effect = Exception("GraphQL error")

        # Act
        result = self.service.fetch_device_from_nautobot("device-uuid-123")

        # Assert
        assert result is None

    def test_retrieve_device_configs_success(self, sample_device_backup_info, sample_netmiko_connection):
        """Test successful config retrieval via Netmiko."""
        # Arrange
        credential = {"username": "admin", "password": "password123"}
        self.mock_netmiko.connect_to_device.return_value = sample_netmiko_connection

        # Act
        result = self.service.retrieve_device_configs(sample_device_backup_info, credential)

        # Assert
        assert result is not None
        assert "running-config" in result
        assert "hostname switch01" in result["running-config"]
        self.mock_netmiko.connect_to_device.assert_called_once()

    def test_retrieve_device_configs_connection_failure(self, sample_device_backup_info):
        """Test config retrieval when Netmiko connection fails."""
        # Arrange
        credential = {"username": "admin", "password": "wrong"}
        self.mock_netmiko.connect_to_device.side_effect = Exception("Authentication failed")

        # Act
        result = self.service.retrieve_device_configs(sample_device_backup_info, credential)

        # Assert
        assert result is None

    def test_parse_config_output_with_config_markers(self):
        """Test parsing config output with 'Building configuration' markers."""
        # Arrange
        raw_output = """
Building configuration...

Current configuration : 1234 bytes
!
hostname switch01
!
interface GigabitEthernet0/1
 description Test
!
end
"""

        # Act
        result = self.service.parse_config_output(raw_output)

        # Assert
        assert "Building configuration" not in result
        assert "Current configuration" not in result
        assert "hostname switch01" in result
        assert result.startswith("hostname switch01") or result.startswith("!")

    def test_parse_config_output_already_clean(self):
        """Test parsing already clean config output."""
        # Arrange
        raw_output = "hostname switch01\n!\ninterface GigabitEthernet0/1\n!"

        # Act
        result = self.service.parse_config_output(raw_output)

        # Assert
        assert result == raw_output

    def test_save_configs_to_disk_success(self, sample_device_backup_info, sample_backup_configs, tmp_path):
        """Test saving configs to disk successfully."""
        # Arrange
        base_path = tmp_path / "configs"
        date_str = "2024-01-01"

        # Act
        result = self.service.save_configs_to_disk(
            device_info=sample_device_backup_info,
            configs=sample_backup_configs,
            base_path=str(base_path),
            date_str=date_str,
        )

        # Assert
        assert result is True
        
        # Check files were created
        expected_path = base_path / "Region1" / "DC1" / "switch01"
        assert expected_path.exists()
        
        running_config_file = expected_path / f"switch01_running-config_{date_str}.txt"
        assert running_config_file.exists()
        assert "hostname switch01" in running_config_file.read_text()

    def test_save_configs_to_disk_creates_directories(self, sample_device_backup_info, sample_backup_configs, tmp_path):
        """Test that save_configs_to_disk creates nested directory structure."""
        # Arrange
        base_path = tmp_path / "new_configs"
        date_str = "2024-01-01"

        # Act
        result = self.service.save_configs_to_disk(
            device_info=sample_device_backup_info,
            configs=sample_backup_configs,
            base_path=str(base_path),
            date_str=date_str,
        )

        # Assert
        assert result is True
        expected_path = base_path / "Region1" / "DC1" / "switch01"
        assert expected_path.exists()
        assert expected_path.is_dir()

    def test_save_configs_to_disk_io_error(self, sample_device_backup_info, sample_backup_configs):
        """Test save_configs_to_disk handles IO errors gracefully."""
        # Arrange
        base_path = "/invalid/path/that/cannot/be/created"
        date_str = "2024-01-01"

        # Act
        result = self.service.save_configs_to_disk(
            device_info=sample_device_backup_info,
            configs=sample_backup_configs,
            base_path=base_path,
            date_str=date_str,
        )

        # Assert
        assert result is False

    def test_generate_device_path(self, sample_device_backup_info):
        """Test device path generation."""
        # Act
        result = self.service._generate_device_path(sample_device_backup_info)

        # Assert
        assert result == Path("Region1") / "DC1" / "switch01"

    def test_generate_device_path_no_hierarchy(self):
        """Test device path generation when location hierarchy is empty."""
        # Arrange
        device_info = DeviceBackupInfo(
            device_id="test-id",
            device_name="test-device",
            device_ip="10.0.0.1",
            platform="cisco_ios",
            location_hierarchy=[],
            device_role="Router",
        )

        # Act
        result = self.service._generate_device_path(device_info)

        # Assert
        assert result == Path("test-device")

    @patch("services.device_config_service.map_platform_to_netmiko")
    def test_retrieve_device_configs_uses_platform_mapper(
        self, mock_mapper, sample_device_backup_info, sample_netmiko_connection
    ):
        """Test that retrieve_device_configs uses platform mapper."""
        # Arrange
        mock_mapper.return_value = "cisco_ios"
        credential = {"username": "admin", "password": "password123"}
        self.mock_netmiko.connect_to_device.return_value = sample_netmiko_connection

        # Act
        self.service.retrieve_device_configs(sample_device_backup_info, credential)

        # Assert
        mock_mapper.assert_called_once_with("cisco_ios")
