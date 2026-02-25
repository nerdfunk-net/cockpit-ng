"""
Service for executing snapshots on devices.
"""

import logging
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from repositories.snapshots import SnapshotTemplateRepository, SnapshotRepository
from models.snapshots import SnapshotExecuteRequest, SnapshotResponse
from services.network.automation.netmiko import netmiko_service
from services.settings.git.service import git_service
from services.settings.git.paths import repo_path
from git_repositories_manager import GitRepositoryManager
import credentials_manager as cred_mgr

logger = logging.getLogger(__name__)


class SnapshotExecutionService:
    """Service for executing snapshots on network devices."""

    def __init__(self):
        self.template_repo = SnapshotTemplateRepository()
        self.snapshot_repo = SnapshotRepository()
        self.git_manager = GitRepositoryManager()

    def _render_path(
        self,
        path_template: str,
        device: Dict[str, Any],
        timestamp: str,
        template_name: Optional[str] = None,
    ) -> str:
        """
        Render path template with placeholders.

        Args:
            path_template: Template with {device_name}, {timestamp}, {template_name}, {custom_field.*}
            device: Device data
            timestamp: ISO timestamp string
            template_name: Optional template name for {template_name} placeholder

        Returns:
            Rendered path
        """
        # Start with device name and timestamp
        device_name = (
            device.get("name", "unknown") if isinstance(device, dict) else str(device)
        )
        rendered = path_template.replace("{device_name}", device_name)
        rendered = rendered.replace("{timestamp}", timestamp)

        # Replace template_name placeholder if provided
        if template_name:
            rendered = rendered.replace("{template_name}", template_name)

        # Handle custom fields
        if (
            isinstance(device, dict)
            and "custom_fields" in device
            and device["custom_fields"]
        ):
            for key, value in device["custom_fields"].items():
                placeholder = f"{{custom_field.{key}}}"
                if placeholder in rendered:
                    rendered = rendered.replace(placeholder, str(value))

        return rendered

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
            file_path: Path within repo (including filename)
            content: JSON content
            commit_message: Commit message

        Returns:
            Commit hash or None on error
        """
        try:
            # Get repository metadata
            repo_data = self.git_manager.get_repository(git_repo_id)
            if not repo_data:
                logger.error("Git repository %s not found", git_repo_id)
                return None

            # Open or clone the repository
            repo = git_service.open_or_clone(repo_data)

            # Get the repository path
            from services.settings.git.paths import repo_path

            local_repo_path = repo_path(repo_data)

            # Create full file path
            full_path = Path(local_repo_path) / file_path

            # Ensure directory exists
            full_path.parent.mkdir(parents=True, exist_ok=True)

            # Write content to file
            full_path.write_text(content, encoding="utf-8")
            logger.info("Wrote snapshot to %s", full_path)

            # Commit and push the file
            result = git_service.commit_and_push(
                repository=repo_data,
                message=commit_message,
                files=[file_path],  # Relative path for git
                repo=repo,
            )

            if result.success and result.commit_sha:
                logger.info("Committed snapshot to Git: %s", result.commit_sha)
                return result.commit_sha
            else:
                logger.warning("Git commit/push failed: %s", result.message)
                return None

        except Exception as e:
            logger.error("Failed to save to Git: %s", e, exc_info=True)
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
            ValueError: If repository not found or credentials invalid
        """
        # Validate git repository exists
        repo_data = self.git_manager.get_repository(request.git_repository_id)
        if not repo_data:
            raise ValueError(f"Git repository {request.git_repository_id} not found")

        # Validate credentials
        if not request.credential_id and (not request.username or not request.password):
            raise ValueError(
                "Either credential_id or both username and password must be provided"
            )

        # Get credentials
        if request.credential_id is not None:
            logger.info("Using stored credential ID: %s", request.credential_id)
            try:
                # Get credential details - include both general and private credentials
                general_creds = cred_mgr.list_credentials(
                    include_expired=False, source="general"
                )
                private_creds = cred_mgr.list_credentials(
                    include_expired=False, source="private"
                )
                user_private = [c for c in private_creds if c.get("owner") == username]
                credentials = general_creds + user_private

                credential = next(
                    (c for c in credentials if c["id"] == request.credential_id), None
                )

                if not credential:
                    raise ValueError(
                        f"Credential with ID {request.credential_id} not found or not accessible"
                    )

                if credential["type"] != "ssh":
                    raise ValueError(
                        f"Credential must be of type 'ssh', got '{credential['type']}'"
                    )

                # Get decrypted password
                cred_username = credential["username"]
                cred_password = cred_mgr.get_decrypted_password(request.credential_id)

                if not cred_password:
                    raise ValueError("Failed to decrypt credential password")

            except Exception as e:
                logger.error("Error loading stored credential: %s", e)
                raise ValueError(f"Failed to load stored credential: {str(e)}")
        else:
            # Use manual credentials
            cred_username = request.username
            cred_password = request.password

        # Get template name - prioritize request.template_name, then lookup from template_id
        template_name = request.template_name
        if not template_name and request.template_id:
            template = self.template_repo.get_by_id(request.template_id)
            if template:
                template_name = template.name

        # Create snapshot record
        snapshot = self.snapshot_repo.create_snapshot(
            name=request.name,
            description=request.description,
            template_id=request.template_id,
            template_name=template_name,
            git_repository_id=request.git_repository_id,
            snapshot_path=request.snapshot_path,
            executed_by=username,
            device_count=len(request.devices),
        )

        # Create result records for each device
        device_results = []
        for device in request.devices:
            device_name = (
                device.get("name", "unknown")
                if isinstance(device, dict)
                else str(device)
            )

            # Extract IP safely
            primary_ip4 = (
                device.get("primary_ip4") if isinstance(device, dict) else None
            )
            if isinstance(primary_ip4, dict):
                device_ip = primary_ip4.get("address", "").split("/")[0]
            elif isinstance(primary_ip4, str):
                device_ip = (
                    primary_ip4.split("/")[0] if "/" in primary_ip4 else primary_ip4
                )
            else:
                device_ip = ""

            result = self.snapshot_repo.create_result(
                snapshot_id=snapshot.id,
                device_name=device_name,
                device_ip=device_ip,
            )
            device_results.append(
                {
                    "result_id": result.id,
                    "device": device,
                    "device_name": device_name,
                    "device_ip": device_ip,
                }
            )

        # Update snapshot to running
        self.snapshot_repo.update_snapshot_status(
            snapshot_id=snapshot.id,
            status="running",
            started_at=datetime.utcnow(),
        )

        # Prepare timestamp for file paths
        timestamp = datetime.utcnow().isoformat().replace(":", "-").split(".")[0]

        # Prepare commands list (just the command strings for netmiko)
        command_list = [cmd.command for cmd in request.commands]

        # Check if any command has use_textfsm enabled
        use_textfsm = any(cmd.use_textfsm for cmd in request.commands)

        # Prepare devices list for netmiko service
        netmiko_devices = []
        for dev_result in device_results:
            device = dev_result["device"]

            # Extract platform
            platform_data = device.get("platform") if isinstance(device, dict) else None
            if isinstance(platform_data, dict):
                platform = platform_data.get("name", "cisco_ios")
            elif isinstance(platform_data, str):
                platform = platform_data
            else:
                platform = "cisco_ios"

            netmiko_devices.append(
                {
                    "ip": dev_result["device_ip"],
                    "platform": platform,
                    "name": dev_result["device_name"],
                }
            )

        # Execute commands on all devices using netmiko service
        logger.info(
            "Executing snapshot on %s devices with %s commands", len(netmiko_devices), len(command_list)
        )

        try:
            session_id, results = await netmiko_service.execute_commands(
                devices=netmiko_devices,
                commands=command_list,
                username=cred_username,
                password=cred_password,
                enable_mode=False,  # Snapshots use exec mode
                write_config=False,  # Never write config for snapshots
                use_textfsm=use_textfsm,
            )

            logger.info("Snapshot execution session %s completed", session_id)

            # Process results and save to Git
            for idx, result in enumerate(results):
                dev_result = device_results[idx]
                result_id = dev_result["result_id"]
                device = dev_result["device"]

                if result["success"]:
                    # Build JSON structure: command -> output mapping
                    snapshot_data = {}

                    # If command_outputs exists (from modified netmiko service), use it
                    if "command_outputs" in result and result["command_outputs"]:
                        snapshot_data = result["command_outputs"]
                    else:
                        # Fallback: create mapping from commands to combined output
                        # This is less ideal but maintains backward compatibility
                        for cmd in command_list:
                            snapshot_data[cmd] = result.get("output", "")

                    # Convert to JSON
                    json_content = json.dumps(snapshot_data, indent=2, default=str)

                    # Render file path
                    file_path = self._render_path(
                        request.snapshot_path, device, timestamp, template_name
                    )

                    # Save to Git
                    commit_hash = self._save_to_git(
                        git_repo_id=request.git_repository_id,
                        file_path=file_path,
                        content=json_content,
                        commit_message=f"Snapshot: {request.name} - {dev_result['device_name']} - {timestamp}",
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
                    error_msg = result.get("error", "Unknown error")
                    self.snapshot_repo.update_result(
                        result_id=result_id,
                        status="failed",
                        error_message=error_msg,
                        completed_at=datetime.utcnow(),
                    )
                    self.snapshot_repo.increment_failed_count(snapshot.id)

        except Exception as e:
            logger.error("Snapshot execution failed: %s", e, exc_info=True)
            # Mark all results as failed
            for dev_result in device_results:
                self.snapshot_repo.update_result(
                    result_id=dev_result["result_id"],
                    status="failed",
                    error_message=str(e),
                    completed_at=datetime.utcnow(),
                )
            self.snapshot_repo.increment_failed_count(snapshot.id, len(device_results))

            # Update snapshot to failed
            self.snapshot_repo.update_snapshot_status(
                snapshot_id=snapshot.id,
                status="failed",
                completed_at=datetime.utcnow(),
            )
            raise

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

    def delete_snapshot_db_only(self, snapshot_id: int) -> bool:
        """
        Delete snapshot from database only (files remain in Git).

        Args:
            snapshot_id: Snapshot ID to delete

        Returns:
            True if deleted successfully
        """
        return self.snapshot_repo.delete_snapshot(snapshot_id)

    def delete_snapshot_with_files(self, snapshot_id: int) -> bool:
        """
        Delete snapshot from database AND remove all files from Git repository.

        Args:
            snapshot_id: Snapshot ID to delete

        Returns:
            True if deleted successfully

        Raises:
            ValueError: If snapshot not found or missing required data
            Exception: If Git operations fail
        """
        # Get snapshot with results
        snapshot = self.snapshot_repo.get_by_id(snapshot_id)
        if not snapshot:
            raise ValueError(f"Snapshot {snapshot_id} not found")

        # Get all results with file paths
        results = snapshot.results
        if not results:
            logger.warning(
                "Snapshot %s has no results, deleting from DB only", snapshot_id
            )
            return self.snapshot_repo.delete_snapshot(snapshot_id)

        # Get git repository
        git_repo_id = snapshot.git_repository_id
        if not git_repo_id:
            raise ValueError(f"Snapshot {snapshot_id} has no git_repository_id")

        repo_data = self.git_manager.get_repository(git_repo_id)
        if not repo_data:
            raise ValueError(f"Git repository {git_repo_id} not found")

        # Open or clone repository
        repo = git_service.open_or_clone(repo_data)
        local_repo_path = Path(repo_path(repo_data))

        # Collect file paths to delete
        files_to_delete = []
        for result in results:
            if result.git_file_path:
                file_path = Path(result.git_file_path)
                full_path = local_repo_path / file_path
                if full_path.exists():
                    files_to_delete.append(str(file_path))
                    logger.info("Marking file for deletion: %s", file_path)

        # Delete files from Git repository
        if files_to_delete:
            try:
                # Remove files from filesystem and git index
                for file_path in files_to_delete:
                    full_path = local_repo_path / file_path
                    if full_path.exists():
                        full_path.unlink()
                        logger.info("Deleted file: %s", file_path)

                    # Stage the deletion in git
                    try:
                        repo.index.remove([str(file_path)])
                    except Exception as e:
                        logger.warning(
                            "Could not remove %s from git index: %s", file_path, e
                        )

                # Commit and push (use add_all to catch any remaining changes)
                commit_message = (
                    f"Delete snapshot: {snapshot.name} ({len(files_to_delete)} files)"
                )
                git_service.commit_and_push(
                    repository=repo_data,
                    message=commit_message,
                    files=None,  # Don't pass files since they're deleted
                    repo=repo,
                    add_all=True,  # Use add_all to stage deletions
                )
                logger.info("Committed deletion of %s files", len(files_to_delete))
            except Exception as e:
                logger.error("Failed to delete files from Git: %s", e, exc_info=True)
                raise Exception(f"Failed to delete files from Git repository: {str(e)}")
        else:
            logger.warning("No files found to delete for snapshot %s", snapshot_id)

        # Delete from database
        return self.snapshot_repo.delete_snapshot(snapshot_id)
