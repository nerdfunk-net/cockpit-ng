"""
Unit tests for DeviceBackupService.

Tests the high-level backup orchestration logic.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

from services.device_backup_service import DeviceBackupService
from models.backup_models import (
    DeviceBackupInfo,
    CredentialInfo,
    GitStatus,
    GitCommitStatus,
    TimestampUpdateStatus,
    BackupResult,
)


class TestDeviceBackupService:
    """Test suite for DeviceBackupService."""

    @pytest.fixture(autouse=True)
    def setup(self, mock_nautobot_service):
        """Set up test fixtures before each test."""
        self.mock_device_config_service = Mock()
        self.service = DeviceBackupService(
            device_config_service=self.mock_device_config_service,
            nautobot_service=mock_nautobot_service,
        )
        self.mock_nautobot = mock_nautobot_service

    def test_validate_backup_inputs_success(self, sample_credential, sample_repository):
        """Test successful validation of backup inputs."""
        # Act
        result = self.service.validate_backup_inputs(
            credential=sample_credential,
            repository=sample_repository,
        )

        # Assert
        assert result is not None
        assert isinstance(result, tuple)
        assert len(result) == 2
        credential_info, repo_info = result
        assert isinstance(credential_info, CredentialInfo)
        assert credential_info.credential_id == 1
        assert credential_info.credential_name == "default-creds"

    def test_validate_backup_inputs_missing_credential(self, sample_repository):
        """Test validation fails when credential is missing."""
        # Act
        result = self.service.validate_backup_inputs(
            credential=None,
            repository=sample_repository,
        )

        # Assert
        assert result is None

    def test_validate_backup_inputs_missing_repository(self, sample_credential):
        """Test validation fails when repository is missing."""
        # Act
        result = self.service.validate_backup_inputs(
            credential=sample_credential,
            repository=None,
        )

        # Assert
        assert result is None

    def test_backup_single_device_success(
        self, sample_device_backup_info, sample_credential, sample_backup_configs
    ):
        """Test successful single device backup."""
        # Arrange
        self.mock_device_config_service.retrieve_device_configs.return_value = sample_backup_configs
        self.mock_device_config_service.save_configs_to_disk.return_value = True

        # Act
        result = self.service.backup_single_device(
            device_info=sample_device_backup_info,
            credential=sample_credential,
            base_path="/tmp/configs",
            date_str="2024-01-01",
        )

        # Assert
        assert result is not None
        assert result["success"] is True
        assert result["device_id"] == "device-uuid-123"
        assert result["device_name"] == "switch01"
        assert "configs_retrieved" in result
        self.mock_device_config_service.retrieve_device_configs.assert_called_once()
        self.mock_device_config_service.save_configs_to_disk.assert_called_once()

    def test_backup_single_device_config_retrieval_fails(
        self, sample_device_backup_info, sample_credential
    ):
        """Test single device backup when config retrieval fails."""
        # Arrange
        self.mock_device_config_service.retrieve_device_configs.return_value = None

        # Act
        result = self.service.backup_single_device(
            device_info=sample_device_backup_info,
            credential=sample_credential,
            base_path="/tmp/configs",
            date_str="2024-01-01",
        )

        # Assert
        assert result is not None
        assert result["success"] is False
        assert "Failed to retrieve configs" in result["error"]

    def test_backup_single_device_save_fails(
        self, sample_device_backup_info, sample_credential, sample_backup_configs
    ):
        """Test single device backup when saving to disk fails."""
        # Arrange
        self.mock_device_config_service.retrieve_device_configs.return_value = sample_backup_configs
        self.mock_device_config_service.save_configs_to_disk.return_value = False

        # Act
        result = self.service.backup_single_device(
            device_info=sample_device_backup_info,
            credential=sample_credential,
            base_path="/tmp/configs",
            date_str="2024-01-01",
        )

        # Assert
        assert result is not None
        assert result["success"] is False
        assert "Failed to save configs" in result["error"]

    def test_update_nautobot_timestamps_enabled(self):
        """Test Nautobot timestamp update when enabled."""
        # Arrange
        backed_up_devices = [
            {"device_id": "dev1", "device_name": "switch01"},
            {"device_id": "dev2", "device_name": "switch02"},
        ]
        self.mock_nautobot._sync_rest_request.return_value = {"id": "dev1"}

        # Act
        result = self.service.update_nautobot_timestamps(
            backed_up_devices=backed_up_devices,
            write_timestamp_to_custom_field=True,
            timestamp_custom_field_name="last_backup",
        )

        # Assert
        assert isinstance(result, TimestampUpdateStatus)
        assert result.enabled is True
        assert result.custom_field_name == "last_backup"
        assert result.updated_count == 2
        assert result.failed_count == 0
        assert self.mock_nautobot._sync_rest_request.call_count == 2

    def test_update_nautobot_timestamps_disabled(self):
        """Test Nautobot timestamp update when disabled."""
        # Arrange
        backed_up_devices = [{"device_id": "dev1", "device_name": "switch01"}]

        # Act
        result = self.service.update_nautobot_timestamps(
            backed_up_devices=backed_up_devices,
            write_timestamp_to_custom_field=False,
            timestamp_custom_field_name="last_backup",
        )

        # Assert
        assert isinstance(result, TimestampUpdateStatus)
        assert result.enabled is False
        assert result.updated_count == 0
        self.mock_nautobot._sync_rest_request.assert_not_called()

    def test_update_nautobot_timestamps_partial_failure(self):
        """Test Nautobot timestamp update with partial failures."""
        # Arrange
        backed_up_devices = [
            {"device_id": "dev1", "device_name": "switch01"},
            {"device_id": "dev2", "device_name": "switch02"},
        ]
        # First call succeeds, second fails
        self.mock_nautobot._sync_rest_request.side_effect = [
            {"id": "dev1"},
            Exception("Network error"),
        ]

        # Act
        result = self.service.update_nautobot_timestamps(
            backed_up_devices=backed_up_devices,
            write_timestamp_to_custom_field=True,
            timestamp_custom_field_name="last_backup",
        )

        # Assert
        assert result.updated_count == 1
        assert result.failed_count == 1
        assert len(result.errors) == 1
        assert "switch02" in result.errors[0]

    def test_update_nautobot_timestamps_with_progress_callback(self):
        """Test timestamp update calls progress callback."""
        # Arrange
        backed_up_devices = [{"device_id": "dev1", "device_name": "switch01"}]
        self.mock_nautobot._sync_rest_request.return_value = {"id": "dev1"}
        progress_callback = Mock()

        # Act
        self.service.update_nautobot_timestamps(
            backed_up_devices=backed_up_devices,
            write_timestamp_to_custom_field=True,
            timestamp_custom_field_name="last_backup",
            progress_callback=progress_callback,
        )

        # Assert
        progress_callback.assert_called()

    def test_prepare_backup_result_success(self, sample_git_status):
        """Test preparation of successful backup result."""
        # Arrange
        backed_up_devices = [{"device_id": "dev1"}]
        failed_devices = []
        credential_info = CredentialInfo(
            credential_id=1,
            credential_name="default",
        )
        git_commit_status = GitCommitStatus(
            committed=True,
            pushed=True,
            commit_hash="abc123",
            files_changed=5,
        )
        timestamp_status = TimestampUpdateStatus(
            enabled=True,
            custom_field_name="last_backup",
            updated_count=1,
        )

        # Act
        result = self.service.prepare_backup_result(
            backed_up_devices=backed_up_devices,
            failed_devices=failed_devices,
            git_status=sample_git_status,
            git_commit_status=git_commit_status,
            credential_info=credential_info,
            timestamp_update_status=timestamp_status,
            repository_name="test-repo",
            commit_date="2024-01-01",
        )

        # Assert
        assert result["success"] is True
        assert result["backed_up_count"] == 1
        assert result["failed_count"] == 0
        assert result["repository"] == "test-repo"
        assert result["commit_date"] == "2024-01-01"

    def test_prepare_backup_result_with_failures(self, sample_git_status):
        """Test preparation of backup result with some failures."""
        # Arrange
        backed_up_devices = [{"device_id": "dev1"}]
        failed_devices = [{"device_id": "dev2", "error": "Connection timeout"}]
        credential_info = CredentialInfo(credential_id=1, credential_name="default")
        git_commit_status = GitCommitStatus()
        timestamp_status = TimestampUpdateStatus()

        # Act
        result = self.service.prepare_backup_result(
            backed_up_devices=backed_up_devices,
            failed_devices=failed_devices,
            git_status=sample_git_status,
            git_commit_status=git_commit_status,
            credential_info=credential_info,
            timestamp_update_status=timestamp_status,
            repository_name="test-repo",
            commit_date="2024-01-01",
        )

        # Assert
        assert result["success"] is True  # Still success if at least one device backed up
        assert result["backed_up_count"] == 1
        assert result["failed_count"] == 1

    def test_prepare_backup_result_model_serialization(self, sample_git_status):
        """Test that Pydantic models are properly serialized."""
        # Arrange
        credential_info = CredentialInfo(credential_id=1, credential_name="default")
        git_commit_status = GitCommitStatus()
        timestamp_status = TimestampUpdateStatus()

        # Act
        result = self.service.prepare_backup_result(
            backed_up_devices=[],
            failed_devices=[],
            git_status=sample_git_status,
            git_commit_status=git_commit_status,
            credential_info=credential_info,
            timestamp_update_status=timestamp_status,
            repository_name="test-repo",
            commit_date="2024-01-01",
        )

        # Assert
        assert isinstance(result["git_status"], dict)
        assert isinstance(result["git_commit_status"], dict)
        assert isinstance(result["credential_info"], dict)
        assert isinstance(result["timestamp_update_status"], dict)
