"""
Backup tasks for backing up device configurations to Git repository.

Refactored to use service layer for better separation of concerns.
"""

from celery import shared_task, group
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from git.exc import GitCommandError
from pathlib import Path

from models.backup_models import (
    GitStatus,
    CredentialInfo,
    GitCommitStatus,
    TimestampUpdateStatus,
)
from services.nautobot.configs.backup import DeviceBackupService

logger = logging.getLogger(__name__)


@shared_task(name="tasks.finalize_backup_task")
def finalize_backup_task(
    device_results: List[Dict[str, Any]],
    repo_config: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Finalize backup after all devices are backed up (chord callback).

    This is a thin Celery task wrapper that handles finalization steps.

    This task:
    1. Collects results from all parallel backup tasks
    2. Commits and pushes changes to Git
    3. Updates Nautobot custom fields if enabled
    4. Updates job_run with detailed results

    Args:
        device_results: List of backup results from all device tasks
        repo_config: Repository and configuration info (includes job_run_id)

    Returns:
        dict: Final backup status
    """
    from services.settings.git.service import git_service
    import job_run_manager

    logger.info("=" * 80)
    logger.info("FINALIZE BACKUP (CHORD CALLBACK)")
    logger.info("=" * 80)

    # Separate successful and failed backups
    backed_up_devices = [r for r in device_results if not r.get("error")]
    failed_devices = [r for r in device_results if r.get("error")]

    logger.info(f"Total devices processed: {len(device_results)}")
    logger.info(f"Successful backups: {len(backed_up_devices)}")
    logger.info(f"Failed backups: {len(failed_devices)}")

    # Initialize status objects
    git_commit_status = GitCommitStatus()

    # Commit and push to Git
    if backed_up_devices:
        try:
            logger.info("-" * 80)
            logger.info("COMMITTING AND PUSHING TO GIT")
            logger.info("-" * 80)

            repo_dir = Path(repo_config["repo_dir"])
            repository = repo_config["repository"]
            current_date = repo_config["current_date"]

            from git import Repo

            git_repo = Repo(repo_dir)

            commit_message = f"Backup config {current_date}"
            logger.info(f"Committing with message: '{commit_message}'")

            result = git_service.commit_and_push(
                repository=dict(repository),
                message=commit_message,
                repo=git_repo,
                add_all=True,
                branch=repository.get("branch") or "main",
            )

            git_commit_status.files_changed = result.files_changed
            git_commit_status.commit_hash = (
                result.commit_sha[:8] if result.commit_sha else None
            )
            git_commit_status.committed = result.commit_sha is not None
            git_commit_status.pushed = result.pushed

            if result.success:
                logger.info(f"✓ {result.message}")
                if result.commit_sha:
                    logger.info(f"  - Commit: {result.commit_sha[:8]}")
                logger.info(f"  - Files changed: {result.files_changed}")
                logger.info(f"  - Pushed: {result.pushed}")
            else:
                logger.error(f"✗ {result.message}")
        except Exception as e:
            logger.error(f"✗ Git operation failed: {e}", exc_info=True)
    else:
        logger.warning("⚠ No devices backed up - skipping commit")

    # Update Nautobot custom fields (delegated to service)
    timestamp_update_status = TimestampUpdateStatus(
        enabled=repo_config.get("write_timestamp_to_custom_field", False),
        custom_field_name=repo_config.get("timestamp_custom_field_name"),
    )

    if (
        repo_config.get("write_timestamp_to_custom_field")
        and repo_config.get("timestamp_custom_field_name")
        and backed_up_devices
    ):
        from services.nautobot import nautobot_service
        backup_service = DeviceBackupService(nautobot_service)
        custom_field_name = repo_config["timestamp_custom_field_name"]

        timestamp_update_status = backup_service.update_nautobot_timestamps(
            devices=backed_up_devices,
            custom_field_name=custom_field_name,
        )

    logger.info("=" * 80)
    logger.info("BACKUP FINALIZED")
    logger.info("=" * 80)

    # Prepare final result
    final_result = {
        "success": len(failed_devices) == 0,
        "backed_up_count": len(backed_up_devices),
        "failed_count": len(failed_devices),
        "backed_up_devices": backed_up_devices,
        "failed_devices": failed_devices,
        "git_commit_status": git_commit_status.model_dump(),
        "timestamp_update_status": timestamp_update_status.model_dump(),
        "devices_backed_up": len(backed_up_devices),  # For UI compatibility
        "devices_failed": len(failed_devices),  # For UI compatibility
    }

    # Update job_run with detailed results if job_run_id provided
    job_run_id = repo_config.get("job_run_id")
    if job_run_id:
        try:
            job_run_manager.mark_completed(job_run_id, result=final_result)
            logger.info(f"✓ Updated job_run {job_run_id} with detailed results")
        except Exception as e:
            logger.error(f"Failed to update job_run {job_run_id}: {e}", exc_info=True)

    return final_result


@shared_task(name="tasks.backup_single_device_task", bind=True)
def backup_single_device_task(
    self,
    device_id: str,
    device_index: int,
    total_devices: int,
    repo_dir: str,
    username: str,
    password: str,
    current_date: str,
    backup_running_config_path: Optional[str] = None,
    backup_startup_config_path: Optional[str] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Backup a single device configuration.

    This is a thin Celery task wrapper that delegates to DeviceBackupService.
    Designed to be run in parallel with other device backups.

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
        dict: Device backup information with success status and details
    """
    # Update progress if job_run_id provided (Celery-specific functionality)
    if job_run_id:
        try:
            from celery_app import celery_app

            redis_client = celery_app.backend.client
            progress_key = f"cockpit-ng:job-progress:{job_run_id}"
            completed = redis_client.incr(progress_key)
            redis_client.expire(progress_key, 3600)  # Expire after 1 hour

            progress_pct = int((completed / total_devices) * 100)
            logger.info(
                f"Progress: {completed}/{total_devices} devices backed up ({progress_pct}%)"
            )
        except Exception as e:
            logger.warning(f"Failed to update progress counter: {e}")

    # Delegate to service layer
    from services.nautobot import nautobot_service
    backup_service = DeviceBackupService(nautobot_service)
    result = backup_service.backup_single_device(
        device_id=device_id,
        device_index=device_index,
        total_devices=total_devices,
        repo_dir=Path(repo_dir),
        username=username,
        password=password,
        current_date=current_date,
        backup_running_config_path=backup_running_config_path,
        backup_startup_config_path=backup_startup_config_path,
        job_run_id=job_run_id,
    )

    return result.to_dict()


@shared_task(bind=True, name="tasks.backup_devices")
def backup_devices_task(
    self,
    inventory: Optional[List[str]] = None,
    config_repository_id: Optional[int] = None,
    credential_id: Optional[int] = None,
    write_timestamp_to_custom_field: Optional[bool] = False,
    timestamp_custom_field_name: Optional[str] = None,
    parallel_tasks: int = 1,
) -> dict:
    """
    Backup device configurations to Git repository.

    This is a Celery task that orchestrates the backup workflow using service layer.

    Workflow:
    1. Validate inputs (delegated to service)
    2. Setup Git repository
    3. Execute device backups (parallel or sequential)
    4. Commit and push changes to Git
    5. Optionally update Nautobot custom fields

    Args:
        self: Task instance (for updating state)
        inventory: List of device IDs to backup
        config_repository_id: ID of Git repository for configs
        credential_id: ID of credential for device authentication
        write_timestamp_to_custom_field: Whether to write timestamp to Nautobot custom field
        timestamp_custom_field_name: Name of the custom field to write timestamp to
        parallel_tasks: Number of parallel worker tasks (1=sequential, 2-50=parallel)

    Returns:
        dict: Backup results with detailed information
    """
    # Initialize tracking objects
    git_status = GitStatus(repository_url=None, branch=None)
    credential_info = CredentialInfo(credential_id=credential_id)

    try:
        logger.info("=" * 80)
        logger.info("BACKUP TASK STARTED")
        logger.info("=" * 80)
        logger.info(f"Inventory devices: {len(inventory) if inventory else 0}")
        logger.info(f"Config repository ID: {config_repository_id}")
        logger.info(f"Credential ID: {credential_id}")

        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing backup..."},
        )

        # Import services
        from services.settings.git.service import git_service
        from services.settings.git.auth import git_auth_service
        from services.nautobot import nautobot_service

        # Step 1: Validate inputs (delegated to service)
        backup_service = DeviceBackupService(nautobot_service)

        try:
            repository, credential = backup_service.validate_backup_inputs(
                inventory=inventory,
                config_repository_id=config_repository_id,
                credential_id=credential_id,
            )
        except ValueError as e:
            logger.error(f"ERROR: {e}")
            return {
                "success": False,
                "error": str(e),
                "git_status": git_status.model_dump(),
                "credential_info": credential_info.model_dump(),
            }

        # Extract credentials
        username = credential.get("username")
        password = credential.get("password")
        credential_name = credential.get("name")

        # Update tracking objects
        git_status.repository_url = repository.url
        git_status.branch = repository.branch or "main"
        credential_info.credential_name = credential_name
        credential_info.username = username

        self.update_state(
            state="PROGRESS",
            meta={"current": 10, "total": 100, "status": "Preparing Git repository..."},
        )

        # Step 2: Setup Git repository
        logger.info("-" * 80)
        logger.info("STEP 2: SETTING UP GIT REPOSITORY")
        logger.info("-" * 80)

        repo_dir = git_service.get_repo_path(dict(repository))
        git_status.repository_path = str(repo_dir)
        logger.info(f"Repository local path: {repo_dir}")

        repo_dir.parent.mkdir(parents=True, exist_ok=True)
        logger.info(f"✓ Parent directory created/exists: {repo_dir.parent}")

        # Get Git credentials for repository (for logging purposes)
        logger.info("Resolving Git repository credentials...")
        git_username, git_token, git_ssh_key_path = (
            git_auth_service.resolve_credentials(dict(repository))
        )
        logger.info(f"  - Git username: {git_username or 'none'}")
        logger.info(f"  - Git token: {'*' * 10 if git_token else 'none'}")
        logger.info(f"  - SSH key: {'configured' if git_ssh_key_path else 'none'}")

        # Use central git_service for repository operations
        logger.info("Opening or cloning repository using git_service...")
        logger.info(f"  - Auth type: {repository.auth_type or 'token'}")

        try:
            git_repo = git_service.open_or_clone(dict(repository))

            git_status.repository_existed = repo_dir.exists()
            git_status.operation = (
                "opened" if git_status.repository_existed else "cloned"
            )

            logger.info(f"✓ Repository ready at {repo_dir}")
            logger.info(f"  - Current branch: {git_repo.active_branch}")
            logger.info(f"  - Latest commit: {git_repo.head.commit.hexsha[:8]}")

            # Pull latest changes
            logger.info(f"Pulling latest changes from {repository.url}...")
            pull_result = git_service.pull(dict(repository), repo=git_repo)

            if pull_result.success:
                logger.info(f"✓ {pull_result.message}")
                git_status.operation = "pulled"
            else:
                logger.warning(f"⚠ Pull warning: {pull_result.message}")

        except GitCommandError as e:
            logger.error(f"ERROR: Failed to prepare repository: {e}")
            return {
                "success": False,
                "error": f"Failed to prepare repository: {str(e)}",
                "git_status": git_status.model_dump(),
                "credential_info": credential_info.model_dump(),
            }
        except Exception as e:
            logger.error(f"ERROR: Unexpected error preparing repository: {e}")
            return {
                "success": False,
                "error": f"Failed to prepare repository: {str(e)}",
                "git_status": git_status.model_dump(),
                "credential_info": credential_info.model_dump(),
            }

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 20,
                "total": 100,
                "status": f"Backing up {len(inventory)} devices...",
            },
        )

        # Step 3: Backup each device
        logger.info("-" * 80)
        logger.info(f"STEP 3: BACKING UP {len(inventory)} DEVICES")
        logger.info(f"Parallel tasks: {parallel_tasks}")
        logger.info("-" * 80)

        backed_up_devices = []
        failed_devices = []
        current_date = datetime.now().strftime("%Y%m%d_%H%M%S")

        total_devices = len(inventory)

        # Execute backups in parallel if parallel_tasks > 1
        if parallel_tasks > 1:
            logger.info(f"Using parallel execution with {parallel_tasks} workers")

            # Create a group of subtasks for parallel execution
            # Split into batches if we have more devices than parallel_tasks allows
            job = group(
                backup_single_device_task.s(
                    device_id=device_id,
                    device_index=idx,
                    total_devices=total_devices,
                    repo_dir=str(repo_dir),
                    username=username,
                    password=password,
                    current_date=current_date,
                )
                for idx, device_id in enumerate(inventory, 1)
            )

            # Execute in parallel and wait for all results
            result_group = job.apply_async()
            results = result_group.get()  # Blocks until all tasks complete

            # Process results
            for result in results:
                if result.get("error"):
                    failed_devices.append(result)
                else:
                    backed_up_devices.append(result)

            logger.info(
                f"Parallel backup completed: {len(backed_up_devices)} succeeded, {len(failed_devices)} failed"
            )

        else:
            # Sequential execution - use service for each device
            logger.info("Using sequential execution (parallel_tasks=1)")
            for idx, device_id in enumerate(inventory, 1):
                progress = 20 + int((idx / total_devices) * 70)
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": progress,
                        "total": 100,
                        "status": f"Backing up device {idx}/{total_devices} ({device_id})...",
                    },
                )

                # Delegate to service
                result = backup_service.backup_single_device(
                    device_id=device_id,
                    device_index=idx,
                    total_devices=total_devices,
                    repo_dir=repo_dir,
                    username=username,
                    password=password,
                    current_date=current_date,
                    backup_running_config_path=None,
                    backup_startup_config_path=None,
                    job_run_id=None,
                )

                if result.error:
                    failed_devices.append(result.to_dict())
                else:
                    backed_up_devices.append(result.to_dict())

        # Summary after all devices
        logger.info("\n" + "=" * 80)
        logger.info("BACKUP SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total devices: {total_devices}")
        logger.info(f"Successful backups: {len(backed_up_devices)}")
        logger.info(f"Failed backups: {len(failed_devices)}")

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 90,
                "total": 100,
                "status": "Committing changes to Git...",
            },
        )

        # Step 4: Commit and push changes using git_service
        logger.info("-" * 80)
        logger.info("STEP 4: COMMITTING AND PUSHING TO GIT")
        logger.info("-" * 80)

        git_commit_status = GitCommitStatus()

        try:
            if backed_up_devices:
                commit_message = f"Backup config {current_date}"
                logger.info(f"Committing and pushing with message: '{commit_message}'")
                logger.info(f"  - Auth type: {repository.auth_type or 'token'}")

                result = git_service.commit_and_push(
                    repository=dict(repository),
                    message=commit_message,
                    repo=git_repo,
                    add_all=True,
                    branch=repository.branch or "main",
                )

                git_commit_status.files_changed = result.files_changed
                git_commit_status.commit_hash = (
                    result.commit_sha[:8] if result.commit_sha else None
                )
                git_commit_status.committed = result.commit_sha is not None
                git_commit_status.pushed = result.pushed

                if result.success:
                    logger.info(f"✓ {result.message}")
                    if result.commit_sha:
                        logger.info(f"  - Commit: {result.commit_sha[:8]}")
                    logger.info(f"  - Files changed: {result.files_changed}")
                    logger.info(f"  - Pushed: {result.pushed}")
                else:
                    logger.error(f"✗ {result.message}")
                    raise GitCommandError("commit_and_push", 1, result.message.encode())
            else:
                logger.warning(
                    "⚠ No devices backed up successfully - skipping Git commit"
                )

        except GitCommandError as e:
            logger.error(f"✗ Failed to commit/push: {e}")
            git_status.commit_error = str(e)
            return {
                "success": False,
                "backed_up_count": len(backed_up_devices),
                "failed_count": len(failed_devices),
                "backed_up_devices": backed_up_devices,
                "failed_devices": failed_devices,
                "git_status": git_status.model_dump(),
                "git_commit_status": git_commit_status.model_dump(),
                "credential_info": credential_info.model_dump(),
                "error": f"Backup completed but failed to push to Git: {str(e)}",
            }

        # Step 5: Update Nautobot custom fields with backup timestamp (if enabled)
        timestamp_update_status = backup_service.update_nautobot_timestamps(
            backed_up_devices=backed_up_devices,
            write_timestamp_to_custom_field=write_timestamp_to_custom_field,
            timestamp_custom_field_name=timestamp_custom_field_name,
            progress_callback=lambda msg: self.update_state(
                state="PROGRESS",
                meta={
                    "current": 95,
                    "total": 100,
                    "status": msg,
                },
            ),
        )

        # Prepare final result
        result = backup_service.prepare_backup_result(
            backed_up_devices=backed_up_devices,
            failed_devices=failed_devices,
            git_status=git_status,
            git_commit_status=git_commit_status,
            credential_info=credential_info,
            timestamp_update_status=timestamp_update_status,
            repository_name=repository.name,
            commit_date=current_date,
        )

        logger.info("=" * 80)
        logger.info("BACKUP TASK COMPLETED SUCCESSFULLY")
        logger.info("=" * 80)

        return result

    except Exception as e:
        logger.error("=" * 80)
        logger.error("BACKUP TASK FAILED WITH EXCEPTION")
        logger.error("=" * 80)
        logger.error(f"Exception: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "git_status": git_status.model_dump()
            if isinstance(git_status, GitStatus)
            else git_status,
            "credential_info": credential_info.model_dump()
            if isinstance(credential_info, CredentialInfo)
            else credential_info,
        }
