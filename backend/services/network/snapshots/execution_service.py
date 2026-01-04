"""
Service for executing snapshots on devices.
"""

import logging
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from netmiko import ConnectHandler
from netmiko.exceptions import NetmikoTimeoutException, NetmikoAuthenticationException
from concurrent.futures import ThreadPoolExecutor
import asyncio

from repositories.snapshots import SnapshotTemplateRepository, SnapshotRepository
from models.snapshots import SnapshotExecuteRequest, SnapshotResponse
from utils.netmiko_platform_mapper import map_platform_to_netmiko
from git_repositories_manager import GitRepositoryManager

logger = logging.getLogger(__name__)


class SnapshotExecutionService:
    """Service for executing snapshots on network devices."""

    def __init__(self):
        self.template_repo = SnapshotTemplateRepository()
        self.snapshot_repo = SnapshotRepository()
        self.git_manager = GitRepositoryManager()
        self.executor = ThreadPoolExecutor(max_workers=10)

    def _render_path(
        self, path_template: str, device: Dict[str, Any], timestamp: str
    ) -> str:
        """
        Render path template with placeholders.

        Args:
            path_template: Template with {device}, {timestamp}, {custom_field.*}
            device: Device data
            timestamp: ISO timestamp string

        Returns:
            Rendered path
        """
        # Start with device name and timestamp
        rendered = path_template.replace("{device}", device.get("name", "unknown"))
        rendered = rendered.replace("{timestamp}", timestamp)

        # Handle custom fields
        if "custom_fields" in device and device["custom_fields"]:
            for key, value in device["custom_fields"].items():
                placeholder = f"{{custom_field.{key}}}"
                if placeholder in rendered:
                    rendered = rendered.replace(placeholder, str(value))

        return rendered

    def _execute_snapshot_on_device(
        self,
        device: Dict[str, Any],
        commands: List[Dict[str, Any]],
        credentials: Dict[str, str],
        result_id: int,
    ) -> Dict[str, Any]:
        """
        Execute snapshot commands on a single device.

        Args:
            device: Device information
            commands: List of command dicts with 'command' and 'use_textfsm'
            credentials: SSH credentials (username, password)
            result_id: Result ID for database updates

        Returns:
            Dictionary with parsed results
        """
        # Handle device data safely
        device_name = device.get("name", "unknown") if isinstance(device, dict) else str(device)

        # Extract IP address
        primary_ip4 = device.get("primary_ip4") if isinstance(device, dict) else None
        if isinstance(primary_ip4, dict):
            device_ip = primary_ip4.get("address", "").split("/")[0]
        elif isinstance(primary_ip4, str):
            device_ip = primary_ip4.split("/")[0]
        else:
            device_ip = ""

        # Extract platform
        platform_data = device.get("platform") if isinstance(device, dict) else None
        if isinstance(platform_data, dict):
            platform = platform_data.get("name", "cisco_ios")
        elif isinstance(platform_data, str):
            platform = platform_data
        else:
            platform = "cisco_ios"

        logger.info(f"Starting snapshot on device {device_name} ({device_ip})")

        # Update result to running
        self.snapshot_repo.update_result(
            result_id=result_id,
            status="running",
            started_at=datetime.utcnow(),
        )

        result = {
            "device": device_name,
            "device_ip": device_ip,
            "success": False,
            "parsed_data": {},
            "error": None,
        }

        try:
            # Map platform to Netmiko device type
            device_type = map_platform_to_netmiko(platform)

            # Device connection parameters
            device_params = {
                "device_type": device_type,
                "host": device_ip,
                "username": credentials["username"],
                "password": credentials["password"],
                "timeout": 30,
                "session_timeout": 60,
            }

            # Connect to device
            with ConnectHandler(**device_params) as connection:
                logger.info(f"Connected to {device_name}")

                # Execute each command
                for cmd_data in commands:
                    command = cmd_data["command"]
                    use_textfsm = cmd_data.get("use_textfsm", True)

                    logger.info(f"Executing command on {device_name}: {command}")

                    # Send command with optional TextFSM parsing
                    output = connection.send_command(
                        command,
                        use_textfsm=use_textfsm,
                        read_timeout=30,
                    )

                    # Store output (can be string or list of dicts if parsed)
                    result["parsed_data"][command] = output

                result["success"] = True
                logger.info(f"Snapshot successful on {device_name}")

        except NetmikoTimeoutException as e:
            result["error"] = f"Connection timeout: {str(e)}"
            logger.error(f"Timeout on {device_name}: {e}")
        except NetmikoAuthenticationException as e:
            result["error"] = f"Authentication failed: {str(e)}"
            logger.error(f"Auth failed on {device_name}: {e}")
        except Exception as e:
            result["error"] = f"Unexpected error: {str(e)}"
            logger.error(f"Error on {device_name}: {e}", exc_info=True)

        return result

    def _save_to_git(
        self,
        git_repo_id: int,
        file_path: str,
        content: str,
        commit_message: str,
    ) -> Optional[str]:
        """
        Save snapshot data to Git repository.

        Args:
            git_repo_id: Git repository ID
            file_path: Path within repo
            content: JSON content
            commit_message: Commit message

        Returns:
            Commit hash or None on error
        """
        try:
            # Get repository
            repo_data = self.git_manager.get_repository(git_repo_id)
            if not repo_data:
                logger.error(f"Git repository {git_repo_id} not found")
                return None

            # TODO: Implement Git file writing and commit
            # This should use the existing Git service
            # For now, return a placeholder
            logger.warning("Git integration not yet implemented in snapshot service")
            return "pending_git_integration"

        except Exception as e:
            logger.error(f"Failed to save to Git: {e}", exc_info=True)
            return None

    async def execute_snapshot(
        self, request: SnapshotExecuteRequest, username: str
    ) -> SnapshotResponse:
        """
        Execute a snapshot on multiple devices.

        Args:
            request: Snapshot execution request
            username: Username executing snapshot

        Returns:
            Snapshot execution record

        Raises:
            ValueError: If template or repository not found
        """
        # Get template
        template = self.template_repo.get_by_id(request.template_id)
        if not template:
            raise ValueError(f"Template {request.template_id} not found")

        # Validate git repository exists
        repo_data = self.git_manager.get_repository(request.git_repository_id)
        if not repo_data:
            raise ValueError(f"Git repository {request.git_repository_id} not found")

        # Create snapshot record
        snapshot = self.snapshot_repo.create_snapshot(
            name=request.name,
            description=request.description,
            template_id=template.id,
            template_name=template.name,
            git_repository_id=request.git_repository_id,
            snapshot_path=request.snapshot_path,
            executed_by=username,
            device_count=len(request.devices),
        )

        # Create result records for each device
        result_ids = []
        for device in request.devices:
            device_name = device.get("name", "unknown") if isinstance(device, dict) else str(device)

            # Extract IP safely
            primary_ip4 = device.get("primary_ip4") if isinstance(device, dict) else None
            if isinstance(primary_ip4, dict):
                device_ip = primary_ip4.get("address", "")
            elif isinstance(primary_ip4, str):
                device_ip = primary_ip4
            else:
                device_ip = ""

            if "/" in device_ip:
                device_ip = device_ip.split("/")[0]

            result = self.snapshot_repo.create_result(
                snapshot_id=snapshot.id,
                device_name=device_name,
                device_ip=device_ip,
            )
            result_ids.append((result.id, device))

        # Update snapshot to running
        self.snapshot_repo.update_snapshot_status(
            snapshot_id=snapshot.id,
            status="running",
            started_at=datetime.utcnow(),
        )

        # Execute on devices asynchronously
        # Note: credentials should be fetched from settings/credentials manager
        # For now, using placeholder
        credentials = {
            "username": "admin",  # TODO: Get from credentials manager
            "password": "admin",  # TODO: Get from credentials manager
        }

        # Prepare commands list
        commands = [
            {"command": cmd.command, "use_textfsm": cmd.use_textfsm}
            for cmd in template.commands
        ]

        # Execute on all devices in parallel
        timestamp = datetime.utcnow().isoformat().replace(":", "-").split(".")[0]

        async def execute_device(result_id: int, device: Dict[str, Any]):
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self._execute_snapshot_on_device,
                device,
                commands,
                credentials,
                result_id,
            )

            # Save to Git
            if result["success"]:
                file_path = self._render_path(
                    request.snapshot_path, device, timestamp
                )
                json_content = json.dumps(result["parsed_data"], indent=2)

                commit_hash = self._save_to_git(
                    git_repo_id=request.git_repository_id,
                    file_path=file_path,
                    content=json_content,
                    commit_message=f"Snapshot: {request.name} - {device.get('name')}",
                )

                # Update result
                self.snapshot_repo.update_result(
                    result_id=result_id,
                    status="success",
                    git_file_path=file_path,
                    git_commit_hash=commit_hash,
                    parsed_data=json_content,
                    completed_at=datetime.utcnow(),
                )
                self.snapshot_repo.increment_success_count(snapshot.id)
            else:
                # Update result with error
                self.snapshot_repo.update_result(
                    result_id=result_id,
                    status="failed",
                    error_message=result["error"],
                    completed_at=datetime.utcnow(),
                )
                self.snapshot_repo.increment_failed_count(snapshot.id)

        # Execute all devices
        await asyncio.gather(
            *[execute_device(result_id, device) for result_id, device in result_ids]
        )

        # Update snapshot to completed
        self.snapshot_repo.update_snapshot_status(
            snapshot_id=snapshot.id,
            status="completed",
            completed_at=datetime.utcnow(),
        )

        # Return final snapshot
        final_snapshot = self.snapshot_repo.get_by_id(snapshot.id)
        return SnapshotResponse.from_orm(final_snapshot)

    def get_snapshot(self, snapshot_id: int) -> Optional[SnapshotResponse]:
        """Get snapshot by ID with results."""
        snapshot = self.snapshot_repo.get_by_id(snapshot_id)
        if snapshot:
            return SnapshotResponse.from_orm(snapshot)
        return None

    def list_snapshots(
        self, username: Optional[str] = None, limit: int = 100
    ) -> List[SnapshotResponse]:
        """List snapshots with optional filtering."""
        snapshots = self.snapshot_repo.get_all(executed_by=username, limit=limit)
        # Use ListResponse to avoid loading all results
        from models.snapshots import SnapshotListResponse

        return [SnapshotListResponse.from_orm(s) for s in snapshots]
