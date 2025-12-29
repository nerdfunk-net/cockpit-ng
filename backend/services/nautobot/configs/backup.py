"""
Device Backup Service

Orchestrates device backup operations including validation,
execution, and result aggregation.
"""

import logging
from typing import Optional, List
from pathlib import Path
from datetime import datetime

from models.backup_models import (
    DeviceBackupInfo,
    GitStatus,
    CredentialInfo,
    GitCommitStatus,
    TimestampUpdateStatus,
    BackupResult,
)
from services.nautobot.configs.config import DeviceConfigService
from services.nautobot import NautobotService
from utils.netmiko_platform_mapper import NetmikoPlatformMapper

logger = logging.getLogger(__name__)


class DeviceBackupService:
    """
    Service for orchestrating device backup operations.

    Provides high-level methods for:
    - Validating backup inputs
    - Backing up single devices
    - Updating Nautobot custom fields
    - Preparing final results
    """

    def __init__(self):
        """Initialize service with dependencies."""
        self.config_service = DeviceConfigService()
        self.nautobot_service = NautobotService()
        self.platform_mapper = NetmikoPlatformMapper()

    def validate_backup_inputs(
        self,
        inventory: Optional[List[str]],
        config_repository_id: Optional[int],
        credential_id: Optional[int],
    ) -> tuple:
        """
        Validate backup task inputs and fetch required resources.

        Args:
            inventory: List of device IDs
            config_repository_id: Git repository ID
            credential_id: Credential ID for device authentication

        Returns:
            tuple: (repository, credential) objects

        Raises:
            ValueError: If validation fails
        """
        from services.settings.git.shared_utils import git_repo_manager
        import credentials_manager

        logger.info("-" * 80)
        logger.info("VALIDATING BACKUP INPUTS")
        logger.info("-" * 80)

        # Validate inventory
        if not inventory:
            raise ValueError("No devices specified in inventory")

        logger.info(f"✓ Inventory: {len(inventory)} devices")

        # Validate repository
        if not config_repository_id:
            raise ValueError("No configuration repository specified")

        repository = git_repo_manager.get_repository(config_repository_id)
        if not repository:
            raise ValueError(f"Repository {config_repository_id} not found in database")

        logger.info(f"✓ Repository: {repository.name}")
        logger.info(f"  - URL: {repository.url}")
        logger.info(f"  - Branch: {repository.branch or 'main'}")

        # Validate credentials
        if not credential_id:
            raise ValueError("No credential specified for device authentication")

        credential = credentials_manager.get_credential_by_id(credential_id)
        if not credential:
            raise ValueError(f"Credential {credential_id} not found in database")

        username = credential.get("username")
        password = credential.get("password")

        if not username or not password:
            raise ValueError("Credential does not contain username or password")

        logger.info(f"✓ Credential: {credential.get('name')}")
        logger.info(f"  - Username: {username}")

        logger.info("✓ All inputs validated successfully")

        return repository, credential

    def backup_single_device(
        self,
        device_id: str,
        device_index: int,
        total_devices: int,
        repo_dir: Path,
        username: str,
        password: str,
        current_date: str,
        backup_running_config_path: Optional[str] = None,
        backup_startup_config_path: Optional[str] = None,
        job_run_id: Optional[int] = None,
    ) -> DeviceBackupInfo:
        """
        Backup a single device configuration.

        Args:
            device_id: Device UUID
            device_index: Index of this device (for logging)
            total_devices: Total number of devices being backed up
            repo_dir: Path to Git repository directory
            username: Device SSH username
            password: Device SSH password
            current_date: Timestamp string for file naming
            backup_running_config_path: Optional template path for running config
            backup_startup_config_path: Optional template path for startup config
            job_run_id: Optional job run ID for progress tracking

        Returns:
            DeviceBackupInfo: Device backup information
        """
        logger.info(f"\n{'=' * 60}")
        logger.info(f"Device {device_index}/{total_devices}: {device_id}")
        logger.info(f"{'=' * 60}")

        device_backup_info = DeviceBackupInfo(device_id=device_id)

        try:
            # Step 1: Fetch device from Nautobot
            device = self.config_service.fetch_device_from_nautobot(
                device_id=device_id, full_details=True, device_index=device_index
            )

            device_name = device.get("name", device_id)
            primary_ip = (
                device.get("primary_ip4", {}).get("address", "").split("/")[0]
                if device.get("primary_ip4")
                else None
            )
            platform = (
                device.get("platform", {}).get("name", "unknown")
                if device.get("platform")
                else "unknown"
            )

            device_backup_info.device_name = device_name
            device_backup_info.device_ip = primary_ip
            device_backup_info.platform = platform
            device_backup_info.nautobot_fetch_success = True

            # Step 2: Determine Netmiko device type
            device_type = self.platform_mapper.map_to_netmiko(platform)
            logger.info(f"[{device_index}] Netmiko device type: {device_type}")

            # Step 3: Retrieve configurations via SSH
            result = self.config_service.retrieve_device_configs(
                device_ip=primary_ip,
                device_type=device_type,
                username=username,
                password=password,
                device_index=device_index,
                device_name=device_name,
            )

            device_backup_info.ssh_connection_success = True

            # Step 4: Parse configuration output
            command_outputs = result.get("command_outputs", {})
            fallback_output = result.get("output", "")

            running_config, startup_config = self.config_service.parse_config_output(
                command_outputs=command_outputs,
                fallback_output=fallback_output,
                device_index=device_index,
            )

            # Update success flags
            if running_config:
                device_backup_info.running_config_success = True
                device_backup_info.running_config_bytes = len(running_config)

            if startup_config:
                device_backup_info.startup_config_success = True
                device_backup_info.startup_config_bytes = len(startup_config)

            # Step 5: Save configs to disk
            save_result = self.config_service.save_configs_to_disk(
                running_config=running_config,
                startup_config=startup_config,
                device=device,
                repo_path=repo_dir,
                current_date=current_date,
                running_template=backup_running_config_path,
                startup_template=backup_startup_config_path,
                device_index=device_index,
            )

            device_backup_info.running_config_file = save_result["running_file"]
            device_backup_info.startup_config_file = save_result["startup_file"]

            logger.info(f"[{device_index}] ✓ Backup completed for {device_name}")

        except Exception as e:
            logger.error(
                f"[{device_index}] ✗ Exception during backup: {e}", exc_info=True
            )
            device_backup_info.error = str(e)

        return device_backup_info

    def update_nautobot_timestamps(
        self,
        devices: List[dict],
        custom_field_name: str,
        backup_date: Optional[str] = None,
    ) -> TimestampUpdateStatus:
        """
        Update Nautobot custom fields with backup timestamps.

        Args:
            devices: List of backed up device info dictionaries
            custom_field_name: Name of custom field to update
            backup_date: Backup date string (defaults to today)

        Returns:
            TimestampUpdateStatus: Update status information
        """
        logger.info("-" * 80)
        logger.info("UPDATING NAUTOBOT CUSTOM FIELDS")
        logger.info("-" * 80)

        if backup_date is None:
            backup_date = datetime.now().strftime("%Y-%m-%d")

        logger.info(f"Custom field: {custom_field_name}")
        logger.info(f"Backup date: {backup_date}")

        status = TimestampUpdateStatus(
            enabled=True,
            custom_field_name=custom_field_name,
        )

        for device_info in devices:
            device_id = device_info.get("device_id")
            device_name = device_info.get("device_name", device_id)

            try:
                logger.info(
                    f"Updating custom field for device: {device_name} ({device_id})"
                )

                update_data = {"custom_fields": {custom_field_name: backup_date}}

                self.nautobot_service._sync_rest_request(
                    endpoint=f"dcim/devices/{device_id}/",
                    method="PATCH",
                    data=update_data,
                )

                logger.info(f"✓ Updated custom field for {device_name}")
                status.updated_count += 1

            except Exception as e:
                error_msg = f"Failed to update custom field for {device_name}: {str(e)}"
                logger.error(f"✗ {error_msg}")
                status.failed_count += 1
                status.errors.append(error_msg)

        logger.info(
            f"Custom field updates: {status.updated_count} successful, "
            f"{status.failed_count} failed"
        )

        return status

    def prepare_backup_result(
        self,
        backed_up_devices: List[dict],
        failed_devices: List[dict],
        git_status: GitStatus,
        git_commit_status: GitCommitStatus,
        credential_info: CredentialInfo,
        timestamp_update_status: TimestampUpdateStatus,
        repository_name: str,
        commit_date: str,
    ) -> dict:
        """
        Prepare final backup result dictionary.

        Args:
            backed_up_devices: List of successfully backed up devices
            failed_devices: List of failed device backups
            git_status: Git repository status
            git_commit_status: Git commit/push status
            credential_info: Credential information
            timestamp_update_status: Timestamp update status
            repository_name: Repository name
            commit_date: Commit timestamp

        Returns:
            dict: Complete backup result
        """
        result = BackupResult(
            success=len(failed_devices) == 0,
            backed_up_count=len(backed_up_devices),
            failed_count=len(failed_devices),
            backed_up_devices=backed_up_devices,
            failed_devices=failed_devices,
            git_status=git_status,
            git_commit_status=git_commit_status,
            credential_info=credential_info,
            timestamp_update_status=timestamp_update_status,
            repository=repository_name,
            commit_date=commit_date,
        )

        return result.model_dump()
