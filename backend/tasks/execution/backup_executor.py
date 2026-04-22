"""
Backup configurations job executor.
Backs up device configurations to repository.

Invoked by tasks/scheduling/job_dispatcher.py → execute_job_type() for
job-template-triggered runs (Path B).  Standalone / API-triggered backups use
backup_devices_task in tasks/backup_tasks.py (Path A) directly.

Both execution paths delegate to DeviceBackupService.backup_single_device():
- Parallel path (parallel_tasks > 1): via Celery chord using backup_single_device_task
- Sequential path (parallel_tasks == 1): direct call to DeviceBackupService
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime
from git.exc import GitCommandError

logger = logging.getLogger(__name__)


def execute_backup(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute backup job.

    Backs up device configurations to Git repository using Netmiko.

    Args:
        schedule_id: Job schedule ID
        credential_id: ID of credential for device authentication
        job_parameters: Additional job parameters (contains config_repository_id)
        target_devices: List of device UUIDs to backup
        task_context: Celery task context for progress updates
        job_run_id: Job run ID for result tracking

    Returns:
        dict: Backup results with detailed information
    """

    # Track Git operations for detailed reporting
    git_status = {
        "repository_existed": False,
        "operation": None,  # 'cloned', 'pulled', 'recloned'
        "repository_path": None,
        "repository_url": None,
        "branch": None,
    }

    # Track credential usage
    credential_info = {
        "credential_id": credential_id,
        "credential_name": None,
        "username": None,
    }

    try:
        logger.info("=" * 80)
        logger.info("BACKUP EXECUTOR STARTED")
        logger.info("=" * 80)
        logger.info("Schedule ID: %s", schedule_id)
        logger.info("Credential ID: %s", credential_id)
        logger.info("Target devices: %s", len(target_devices) if target_devices else 0)
        logger.info("Job parameters: %s", job_parameters)

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing backup..."},
        )

        # Import services
        from services.settings.git.shared_utils import git_repo_manager
        import service_factory

        git_service = service_factory.build_git_service()
        git_auth_service = service_factory.build_git_auth_service()
        import credentials_manager
        import jobs_manager
        import job_template_manager

        # Get config_repository_id and backup paths from job_parameters or template
        config_repository_id = None
        backup_running_config_path = None
        backup_startup_config_path = None
        write_timestamp_to_custom_field = False
        timestamp_custom_field_name = None
        parallel_tasks = 1  # Default to sequential execution

        if job_parameters:
            config_repository_id = job_parameters.get("config_repository_id")
            logger.info(
                "Config repository ID from job_parameters: %s", config_repository_id
            )

        # If not in job_parameters, try to get from template via schedule
        if not config_repository_id and schedule_id:
            logger.info("Fetching template from schedule %s...", schedule_id)
            schedule = jobs_manager.get_job_schedule(schedule_id)
            if schedule:
                template_id = schedule.get("job_template_id")
                logger.info("Schedule has template ID: %s", template_id)

                if template_id:
                    template = job_template_manager.get_job_template(template_id)
                    if template:
                        config_repository_id = template.get("config_repository_id")
                        backup_running_config_path = template.get(
                            "backup_running_config_path"
                        )
                        backup_startup_config_path = template.get(
                            "backup_startup_config_path"
                        )
                        write_timestamp_to_custom_field = template.get(
                            "write_timestamp_to_custom_field", False
                        )
                        timestamp_custom_field_name = template.get(
                            "timestamp_custom_field_name"
                        )
                        parallel_tasks = template.get("parallel_tasks", 1)
                        logger.info(
                            "Config repository ID from template: %s",
                            config_repository_id,
                        )
                        logger.info(
                            "Running config path template: %s",
                            backup_running_config_path,
                        )
                        logger.info(
                            "Startup config path template: %s",
                            backup_startup_config_path,
                        )
                        logger.info(
                            "Write timestamp to custom field: %s",
                            write_timestamp_to_custom_field,
                        )
                        logger.info(
                            "Timestamp custom field name: %s",
                            timestamp_custom_field_name,
                        )

        if not config_repository_id:
            logger.error("ERROR: No config_repository_id found")
            return {
                "success": False,
                "error": "No config repository specified. Please configure a config repository in the job template.",
                "git_status": git_status,
                "credential_info": credential_info,
            }

        # If no target devices provided, fetch all from Nautobot
        device_ids = target_devices
        if not device_ids:
            logger.info(
                "No target devices specified, fetching all devices from Nautobot"
            )
            task_context.update_state(
                state="PROGRESS",
                meta={
                    "current": 5,
                    "total": 100,
                    "status": "Fetching devices from Nautobot...",
                },
            )

            import asyncio
            import service_factory

            device_query_service = service_factory.build_device_query_service()

            devices_result = asyncio.run(device_query_service.get_devices())
            if devices_result and devices_result.get("devices"):
                device_ids = [device.get("id") for device in devices_result["devices"]]
                logger.info("Fetched %s devices from Nautobot", len(device_ids))
            else:
                logger.warning("No devices found in Nautobot")
                device_ids = []

        if not device_ids:
            logger.error("ERROR: No devices found to backup")
            return {
                "success": False,
                "error": "No devices to backup",
                "git_status": git_status,
                "credential_info": credential_info,
            }

        if not credential_id:
            logger.error("ERROR: No credential_id specified")
            return {
                "success": False,
                "error": "No credentials specified. Please select credentials in the job schedule.",
                "git_status": git_status,
                "credential_info": credential_info,
            }

        logger.info("-" * 80)
        logger.info("STEP 1: VALIDATING INPUTS")
        logger.info("-" * 80)

        # Get repository details
        logger.info("Fetching repository %s from database...", config_repository_id)
        repository = git_repo_manager.get_repository(config_repository_id)
        if not repository:
            logger.error(
                "ERROR: Repository %s not found in database", config_repository_id
            )
            return {
                "success": False,
                "error": f"Repository {config_repository_id} not found",
                "git_status": git_status,
                "credential_info": credential_info,
            }

        logger.info("✓ Repository found: %s", repository.get("name"))
        logger.info("  - URL: %s", repository.get("url"))
        logger.info("  - Branch: %s", repository.get("branch") or "main")

        git_status["repository_url"] = repository.get("url")
        git_status["branch"] = repository.get("branch") or "main"

        # Get credentials
        logger.info("Fetching credential %s from database...", credential_id)
        credential = credentials_manager.get_credential_by_id(credential_id)
        if not credential:
            logger.error("ERROR: Credential %s not found in database", credential_id)
            return {
                "success": False,
                "error": f"Credential {credential_id} not found",
                "git_status": git_status,
                "credential_info": credential_info,
            }

        username = credential.get("username")
        credential_name = credential.get("name")

        # Get decrypted password
        try:
            password = credentials_manager.get_decrypted_password(credential_id)
        except Exception as e:
            logger.error("ERROR: Failed to decrypt password: %s", e)
            return {
                "success": False,
                "error": f"Failed to decrypt credential password: {str(e)}",
                "git_status": git_status,
                "credential_info": credential_info,
            }

        logger.info("✓ Credential found: %s", credential_name)
        logger.info("  - Username: %s", username)
        logger.info("  - Password: %s", "*" * len(password) if password else "NOT SET")

        credential_info["credential_name"] = credential_name
        credential_info["username"] = username

        if not username or not password:
            logger.error("ERROR: Credential does not contain username or password")
            return {
                "success": False,
                "error": "Credential does not contain username or password",
                "git_status": git_status,
                "credential_info": credential_info,
            }

        logger.info("✓ All inputs validated successfully")

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 10, "total": 100, "status": "Preparing Git repository..."},
        )

        # STEP 2: Setup Git repository
        logger.info("-" * 80)
        logger.info("STEP 2: SETTING UP GIT REPOSITORY")
        logger.info("-" * 80)

        repo_dir = git_service.get_repo_path(dict(repository))
        git_status["repository_path"] = str(repo_dir)
        logger.info("Repository local path: %s", repo_dir)

        repo_dir.parent.mkdir(parents=True, exist_ok=True)
        logger.info("✓ Parent directory created/exists: %s", repo_dir.parent)

        # Get Git credentials for repository (for logging purposes)
        logger.info("Resolving Git repository credentials...")
        git_username, git_token, git_ssh_key_path = (
            git_auth_service.resolve_credentials(dict(repository))
        )
        logger.info("  - Git username: %s", git_username or "none")
        logger.info("  - Git token: %s", "*" * 10 if git_token else "none")
        logger.info("  - SSH key: %s", "configured" if git_ssh_key_path else "none")
        logger.info("  - Auth type: %s", repository.get("auth_type", "token"))

        # Use central git_service for repository operations (supports SSH keys and tokens)
        try:
            git_repo = git_service.open_or_clone(dict(repository))

            git_status["repository_existed"] = repo_dir.exists()
            git_status["operation"] = (
                "opened" if git_status["repository_existed"] else "cloned"
            )

            logger.info("✓ Repository ready at %s", repo_dir)
            logger.info("  - Current branch: %s", git_repo.active_branch)
            logger.info("  - Latest commit: %s", git_repo.head.commit.hexsha[:8])

            # Pull latest changes using git_service
            logger.info("Pulling latest changes from %s...", repository.get("url"))
            pull_result = git_service.pull(dict(repository), repo=git_repo)

            if pull_result.success:
                logger.info("✓ %s", pull_result.message)
                git_status["operation"] = "pulled"
            else:
                logger.warning("⚠ Pull warning: %s", pull_result.message)

        except GitCommandError as e:
            logger.error("ERROR: Failed to prepare repository: %s", e)
            return {
                "success": False,
                "error": f"Failed to prepare repository: {str(e)}",
                "git_status": git_status,
                "credential_info": credential_info,
            }
        except Exception as e:
            logger.error("ERROR: Unexpected error preparing repository: %s", e)
            return {
                "success": False,
                "error": f"Failed to prepare repository: {str(e)}",
                "git_status": git_status,
                "credential_info": credential_info,
            }

        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": 20,
                "total": 100,
                "status": f"Backing up {len(device_ids)} devices...",
            },
        )

        # STEP 3: Backup each device
        logger.info("-" * 80)
        logger.info("STEP 3: BACKING UP %s DEVICES", len(device_ids))
        logger.info("Parallel tasks: %s", parallel_tasks)
        logger.info("-" * 80)

        backed_up_devices = []
        failed_devices = []
        current_date = datetime.now().strftime("%Y%m%d_%H%M%S")

        total_devices = len(device_ids)

        # Use chord pattern for parallel execution
        if parallel_tasks > 1:
            logger.info(
                "Using parallel execution with %s workers (chord pattern)",
                parallel_tasks,
            )

            from tasks.backup_tasks import (
                backup_single_device_task,
                finalize_backup_task,
            )
            from celery import chord

            # Create chord: group of parallel tasks + callback
            backup_chord = chord(
                backup_single_device_task.s(
                    device_id=device_id,
                    device_index=idx,
                    total_devices=total_devices,
                    repo_dir=str(repo_dir),
                    username=username,
                    password=password,
                    current_date=current_date,
                    backup_running_config_path=backup_running_config_path,
                    backup_startup_config_path=backup_startup_config_path,
                    job_run_id=job_run_id,  # Pass for progress tracking
                )
                for idx, device_id in enumerate(device_ids, 1)
            )(
                # Callback with repo config and job_run_id
                finalize_backup_task.s(
                    {
                        "repo_dir": str(repo_dir),
                        "repository": dict(repository),
                        "current_date": current_date,
                        "write_timestamp_to_custom_field": write_timestamp_to_custom_field,
                        "timestamp_custom_field_name": timestamp_custom_field_name,
                        "job_run_id": job_run_id,  # Pass job_run_id for result storage
                        "total_devices": total_devices,  # For progress tracking
                    }
                )
            )

            # Return immediately - chord callback will handle finalization
            logger.info("Chord created for %s devices", total_devices)
            logger.info(
                "Parallel backup tasks launched - finalization will happen in callback"
            )

            return {
                "success": True,
                "status": "running",
                "message": f"Parallel backup of {total_devices} devices started using chord pattern",
                "backed_up_count": 0,
                "failed_count": 0,
                "chord_id": backup_chord.id,
            }

        # Sequential execution (fallback for parallel_tasks = 1)
        logger.info("Using sequential execution")

        from services.nautobot.configs.backup import DeviceBackupService

        backup_service = DeviceBackupService()

        for idx, device_id in enumerate(device_ids, 1):
            progress = 20 + int((idx / total_devices) * 70)
            task_context.update_state(
                state="PROGRESS",
                meta={
                    "current": progress,
                    "total": 100,
                    "status": f"Backing up device {idx}/{total_devices} ({device_id[:8]})...",
                },
            )

            device_backup_info = backup_service.backup_single_device(
                device_id=device_id,
                device_index=idx,
                total_devices=total_devices,
                repo_dir=repo_dir,
                username=username,
                password=password,
                current_date=current_date,
                backup_running_config_path=backup_running_config_path,
                backup_startup_config_path=backup_startup_config_path,
                job_run_id=job_run_id,
            )

            info_dict = device_backup_info.to_dict()
            if device_backup_info.is_successful():
                backed_up_devices.append(info_dict)
            else:
                failed_devices.append(info_dict)

        logger.info("\n" + "=" * 80)
        logger.info("BACKUP SUMMARY")
        logger.info("=" * 80)
        logger.info("Successful: %s", len(backed_up_devices))
        logger.info("Failed: %s", len(failed_devices))

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 90, "total": 100, "status": "Committing to Git..."},
        )

        # STEP 4: Commit and push using git_service
        logger.info("-" * 80)
        logger.info("STEP 4: GIT COMMIT AND PUSH")
        logger.info("-" * 80)

        git_commit_status = {
            "committed": False,
            "pushed": False,
            "commit_hash": None,
            "files_changed": 0,
        }

        try:
            if backed_up_devices:
                commit_message = f"Backup config {current_date}"
                logger.info("Committing and pushing with message: '%s'", commit_message)
                logger.info("  - Auth type: %s", repository.get("auth_type", "token"))

                # Use git_service for commit and push (supports SSH keys and tokens)
                result = git_service.commit_and_push(
                    repository=dict(repository),
                    message=commit_message,
                    repo=git_repo,
                    add_all=True,
                    branch=repository.get("branch") or "main",
                )

                git_commit_status["files_changed"] = result.files_changed
                git_commit_status["commit_hash"] = (
                    result.commit_sha[:8] if result.commit_sha else None
                )
                git_commit_status["committed"] = result.commit_sha is not None
                git_commit_status["pushed"] = result.pushed

                if result.success:
                    logger.info("✓ %s", result.message)
                    if result.commit_sha:
                        logger.info("  - Commit: %s", result.commit_sha[:8])
                    logger.info("  - Files changed: %s", result.files_changed)
                    logger.info("  - Pushed: %s", result.pushed)
                else:
                    logger.error("✗ %s", result.message)
                    raise GitCommandError("commit_and_push", 1, result.message.encode())
            else:
                logger.warning("⚠ No devices backed up - skipping commit")

        except GitCommandError as e:
            logger.error("✗ Git operation failed: %s", e)
            return {
                "success": False,
                "backed_up_count": len(backed_up_devices),
                "failed_count": len(failed_devices),
                "backed_up_devices": backed_up_devices,
                "failed_devices": failed_devices,
                "git_status": git_status,
                "git_commit_status": git_commit_status,
                "credential_info": credential_info,
                "error": f"Failed to push to Git: {str(e)}",
            }

        # STEP 5: Update Nautobot custom fields with backup timestamp (if enabled)
        timestamp_update_status = {
            "enabled": write_timestamp_to_custom_field,
            "custom_field_name": timestamp_custom_field_name,
            "updated_count": 0,
            "failed_count": 0,
            "errors": [],
        }

        if (
            write_timestamp_to_custom_field
            and timestamp_custom_field_name
            and backed_up_devices
        ):
            logger.info("-" * 80)
            logger.info("STEP 5: UPDATING NAUTOBOT CUSTOM FIELDS WITH BACKUP TIMESTAMP")
            logger.info("-" * 80)

            task_context.update_state(
                state="PROGRESS",
                meta={
                    "current": 95,
                    "total": 100,
                    "status": f"Updating custom field '{timestamp_custom_field_name}' in Nautobot...",
                },
            )

            status = backup_service.update_nautobot_timestamps(
                devices=backed_up_devices,
                custom_field_name=timestamp_custom_field_name,
            )
            timestamp_update_status = status.model_dump()

        logger.info("=" * 80)
        logger.info("BACKUP COMPLETED")
        logger.info("=" * 80)

        return {
            "success": True,
            "devices_backed_up": len(backed_up_devices),
            "devices_failed": len(failed_devices),
            "message": f"Backed up {len(backed_up_devices)} device configurations",
            "backed_up_devices": backed_up_devices,
            "failed_devices": failed_devices,
            "git_status": git_status,
            "git_commit_status": git_commit_status,
            "credential_info": credential_info,
            "timestamp_update_status": timestamp_update_status,
            "repository": repository.get("name"),
            "commit_date": current_date,
        }

    except Exception as e:
        logger.error("=" * 80)
        logger.error("BACKUP EXECUTOR FAILED")
        logger.error("=" * 80)
        logger.error("Exception: %s", e, exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "git_status": git_status,
            "credential_info": credential_info,
        }
