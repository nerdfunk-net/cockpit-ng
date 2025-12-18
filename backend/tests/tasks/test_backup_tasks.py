"""
Integration tests for backup Celery tasks.

Tests the end-to-end backup workflow with mocked external dependencies.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from celery import Celery

from tasks.backup_tasks import (
    backup_single_device_task,
    backup_devices_task,
    finalize_backup_task,
)
from models.backup_models import DeviceBackupInfo, GitStatus


class TestBackupSingleDeviceTask:
    """Integration tests for backup_single_device_task."""

    @patch("tasks.backup_tasks.DeviceBackupService")
    def test_backup_single_device_task_success(self, mock_service_class, sample_credential, sample_repository):
        """Test successful single device backup task."""
        # Arrange
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        
        device_info_dict = {
            "device_id": "dev1",
            "device_name": "switch01",
            "device_ip": "192.168.1.1",
            "platform": "cisco_ios",
            "location_hierarchy": ["Region1", "DC1"],
            "device_role": "Access Switch",
        }
        
        mock_service.backup_single_device.return_value = {
            "success": True,
            "device_id": "dev1",
            "device_name": "switch01",
            "configs_retrieved": ["running-config"],
        }

        # Act
        result = backup_single_device_task(
            device_info=device_info_dict,
            credential=sample_credential,
            base_path="/tmp/configs",
            date_str="2024-01-01",
        )

        # Assert
        assert result["success"] is True
        assert result["device_name"] == "switch01"
        mock_service.backup_single_device.assert_called_once()

    @patch("tasks.backup_tasks.DeviceBackupService")
    def test_backup_single_device_task_failure(self, mock_service_class, sample_credential):
        """Test single device backup task failure."""
        # Arrange
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        
        device_info_dict = {
            "device_id": "dev1",
            "device_name": "switch01",
            "device_ip": "192.168.1.1",
            "platform": "cisco_ios",
            "location_hierarchy": ["Region1", "DC1"],
            "device_role": "Access Switch",
        }
        
        mock_service.backup_single_device.return_value = {
            "success": False,
            "device_id": "dev1",
            "device_name": "switch01",
            "error": "Connection timeout",
        }

        # Act
        result = backup_single_device_task(
            device_info=device_info_dict,
            credential=sample_credential,
            base_path="/tmp/configs",
            date_str="2024-01-01",
        )

        # Assert
        assert result["success"] is False
        assert "error" in result


class TestBackupDevicesTask:
    """Integration tests for backup_devices_task."""

    @patch("tasks.backup_tasks.git_service")
    @patch("tasks.backup_tasks.DeviceBackupService")
    def test_backup_devices_task_parallel_success(
        self, mock_service_class, mock_git_service, sample_credential, sample_repository
    ):
        """Test successful parallel backup of multiple devices."""
        # Arrange
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        
        # Mock validation
        from models.backup_models import CredentialInfo
        mock_service.validate_backup_inputs.return_value = (
            CredentialInfo(credential_id=1, credential_name="default"),
            sample_repository,
        )
        
        # Mock Git setup
        mock_git_repo = Mock()
        mock_git_service.setup_repository.return_value = (mock_git_repo, None)
        
        device_ids = ["dev1", "dev2"]

        # Act
        with patch("tasks.backup_tasks.backup_single_device_task") as mock_subtask:
            # Mock chord execution - simulate parallel task completion
            mock_subtask.s.return_value.return_value = {
                "success": True,
                "device_id": "dev1",
            }
            
            result = backup_devices_task(
                device_ids=device_ids,
                credential_id=1,
                repo_id=1,
                execution_mode="parallel",
                job_run_id=1,
            )

        # Assert - Verifies task setup and orchestration
        assert mock_service.validate_backup_inputs.called
        assert mock_git_service.setup_repository.called

    @patch("tasks.backup_tasks.DeviceBackupService")
    def test_backup_devices_task_sequential_success(
        self, mock_service_class, sample_credential, sample_repository
    ):
        """Test successful sequential backup of multiple devices."""
        # Arrange
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        
        # Mock validation
        from models.backup_models import CredentialInfo, DeviceBackupInfo
        mock_service.validate_backup_inputs.return_value = (
            CredentialInfo(credential_id=1, credential_name="default"),
            sample_repository,
        )
        
        # Mock device fetching
        device_info = DeviceBackupInfo(
            device_id="dev1",
            device_name="switch01",
            device_ip="192.168.1.1",
            platform="cisco_ios",
            location_hierarchy=["Region1", "DC1"],
            device_role="Access Switch",
        )
        
        with patch("tasks.backup_tasks.git_service") as mock_git_service:
            mock_git_repo = Mock()
            mock_git_service.setup_repository.return_value = (mock_git_repo, None)
            
            # Mock backup results
            mock_service.backup_single_device.return_value = {
                "success": True,
                "device_id": "dev1",
                "device_name": "switch01",
            }
            
            # Mock device config service
            with patch("tasks.backup_tasks.DeviceConfigService") as mock_config_service_class:
                mock_config_service = Mock()
                mock_config_service_class.return_value = mock_config_service
                mock_config_service.fetch_device_from_nautobot.return_value = device_info

                # Act
                result = backup_devices_task(
                    device_ids=["dev1"],
                    credential_id=1,
                    repo_id=1,
                    execution_mode="sequential",
                    job_run_id=1,
                )

        # Assert
        # Since this tests orchestration logic, we mainly verify no exceptions
        assert result is not None

    @patch("tasks.backup_tasks.DeviceBackupService")
    def test_backup_devices_task_validation_failure(self, mock_service_class):
        """Test backup task fails validation."""
        # Arrange
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.validate_backup_inputs.return_value = None

        # Act
        result = backup_devices_task(
            device_ids=["dev1"],
            credential_id=999,  # Invalid credential
            repo_id=1,
            execution_mode="sequential",
        )

        # Assert
        assert result["success"] is False
        assert "error" in result


class TestFinalizeBackupTask:
    """Integration tests for finalize_backup_task."""

    @patch("tasks.backup_tasks.job_run_manager")
    def test_finalize_backup_task_success(self, mock_job_run_manager):
        """Test successful backup finalization."""
        # Arrange
        device_results = [
            {"success": True, "device_id": "dev1", "device_name": "switch01"},
            {"success": True, "device_id": "dev2", "device_name": "switch02"},
        ]
        
        repo_config = {
            "job_run_id": 1,
            "repository": {"name": "test-repo"},
            "credential": {"name": "default"},
        }

        # Act
        result = finalize_backup_task(device_results, repo_config)

        # Assert
        assert result["success"] is True
        assert result["backed_up_count"] == 2
        assert result["failed_count"] == 0

    @patch("tasks.backup_tasks.job_run_manager")
    def test_finalize_backup_task_with_failures(self, mock_job_run_manager):
        """Test finalization with some device failures."""
        # Arrange
        device_results = [
            {"success": True, "device_id": "dev1", "device_name": "switch01"},
            {"success": False, "device_id": "dev2", "device_name": "switch02", "error": "Timeout"},
        ]
        
        repo_config = {
            "job_run_id": 1,
            "repository": {"name": "test-repo"},
            "credential": {"name": "default"},
        }

        # Act
        result = finalize_backup_task(device_results, repo_config)

        # Assert
        assert result["backed_up_count"] == 1
        assert result["failed_count"] == 1

    @patch("tasks.backup_tasks.job_run_manager")
    def test_finalize_backup_task_all_failures(self, mock_job_run_manager):
        """Test finalization when all devices fail."""
        # Arrange
        device_results = [
            {"success": False, "device_id": "dev1", "error": "Connection failed"},
            {"success": False, "device_id": "dev2", "error": "Authentication failed"},
        ]
        
        repo_config = {
            "job_run_id": 1,
            "repository": {"name": "test-repo"},
            "credential": {"name": "default"},
        }

        # Act
        result = finalize_backup_task(device_results, repo_config)

        # Assert
        assert result["backed_up_count"] == 0
        assert result["failed_count"] == 2
