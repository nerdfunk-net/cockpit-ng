"""
Backup configurations job executor.
Backs up device configurations to repository.

Moved from job_tasks.py to improve code organization.
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
        logger.info(f"Schedule ID: {schedule_id}")
        logger.info(f"Credential ID: {credential_id}")
        logger.info(f"Target devices: {len(target_devices) if target_devices else 0}")
        logger.info(f"Job parameters: {job_parameters}")

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing backup..."},
        )

        # Import services
        from services.settings.git.shared_utils import git_repo_manager
        from services.settings.git.service import git_service
        from services.settings.git.auth import git_auth_service
        from services.nautobot import NautobotService
        from services.network.automation.netmiko import NetmikoService
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
                f"Config repository ID from job_parameters: {config_repository_id}"
            )

        # If not in job_parameters, try to get from template via schedule
        if not config_repository_id and schedule_id:
            logger.info(f"Fetching template from schedule {schedule_id}...")
            schedule = jobs_manager.get_job_schedule(schedule_id)
            if schedule:
                template_id = schedule.get("job_template_id")
                logger.info(f"Schedule has template ID: {template_id}")

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
                            f"Config repository ID from template: {config_repository_id}"
                        )
                        logger.info(
                            f"Running config path template: {backup_running_config_path}"
                        )
                        logger.info(
                            f"Startup config path template: {backup_startup_config_path}"
                        )
                        logger.info(
                            f"Write timestamp to custom field: {write_timestamp_to_custom_field}"
                        )
                        logger.info(
                            f"Timestamp custom field name: {timestamp_custom_field_name}"
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
            from services.nautobot.devices.query import device_query_service

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                devices_result = loop.run_until_complete(
                    device_query_service.get_devices()
                )
                if devices_result and devices_result.get("devices"):
                    device_ids = [
                        device.get("id") for device in devices_result["devices"]
                    ]
                    logger.info(f"Fetched {len(device_ids)} devices from Nautobot")
                else:
                    logger.warning("No devices found in Nautobot")
                    device_ids = []
            finally:
                loop.close()

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
        logger.info(f"Fetching repository {config_repository_id} from database...")
        repository = git_repo_manager.get_repository(config_repository_id)
        if not repository:
            logger.error(
                f"ERROR: Repository {config_repository_id} not found in database"
            )
            return {
                "success": False,
                "error": f"Repository {config_repository_id} not found",
                "git_status": git_status,
                "credential_info": credential_info,
            }

        logger.info(f"✓ Repository found: {repository.get('name')}")
        logger.info(f"  - URL: {repository.get('url')}")
        logger.info(f"  - Branch: {repository.get('branch') or 'main'}")

        git_status["repository_url"] = repository.get("url")
        git_status["branch"] = repository.get("branch") or "main"

        # Get credentials
        logger.info(f"Fetching credential {credential_id} from database...")
        credential = credentials_manager.get_credential_by_id(credential_id)
        if not credential:
            logger.error(f"ERROR: Credential {credential_id} not found in database")
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
            logger.error(f"ERROR: Failed to decrypt password: {e}")
            return {
                "success": False,
                "error": f"Failed to decrypt credential password: {str(e)}",
                "git_status": git_status,
                "credential_info": credential_info,
            }

        logger.info(f"✓ Credential found: {credential_name}")
        logger.info(f"  - Username: {username}")
        logger.info(f"  - Password: {'*' * len(password) if password else 'NOT SET'}")

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
        logger.info(f"  - Auth type: {repository.get('auth_type', 'token')}")

        # Use central git_service for repository operations (supports SSH keys and tokens)
        try:
            git_repo = git_service.open_or_clone(dict(repository))

            git_status["repository_existed"] = repo_dir.exists()
            git_status["operation"] = (
                "opened" if git_status["repository_existed"] else "cloned"
            )

            logger.info(f"✓ Repository ready at {repo_dir}")
            logger.info(f"  - Current branch: {git_repo.active_branch}")
            logger.info(f"  - Latest commit: {git_repo.head.commit.hexsha[:8]}")

            # Pull latest changes using git_service
            logger.info(f"Pulling latest changes from {repository.get('url')}...")
            pull_result = git_service.pull(dict(repository), repo=git_repo)

            if pull_result.success:
                logger.info(f"✓ {pull_result.message}")
                git_status["operation"] = "pulled"
            else:
                logger.warning(f"⚠ Pull warning: {pull_result.message}")

        except GitCommandError as e:
            logger.error(f"ERROR: Failed to prepare repository: {e}")
            return {
                "success": False,
                "error": f"Failed to prepare repository: {str(e)}",
                "git_status": git_status,
                "credential_info": credential_info,
            }
        except Exception as e:
            logger.error(f"ERROR: Unexpected error preparing repository: {e}")
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
        logger.info(f"STEP 3: BACKING UP {len(device_ids)} DEVICES")
        logger.info(f"Parallel tasks: {parallel_tasks}")
        logger.info("-" * 80)

        backed_up_devices = []
        failed_devices = []
        current_date = datetime.now().strftime("%Y%m%d_%H%M%S")

        total_devices = len(device_ids)

        # Use chord pattern for parallel execution
        if parallel_tasks > 1:
            logger.info(
                f"Using parallel execution with {parallel_tasks} workers (chord pattern)"
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
            logger.info(f"Chord created for {total_devices} devices")
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
        nautobot_service = NautobotService()
        netmiko_service = NetmikoService()

        for idx, device_id in enumerate(device_ids, 1):
            device_backup_info = {
                "device_id": device_id,
                "device_name": None,
                "device_ip": None,
                "platform": None,
                "nautobot_fetch_success": False,
                "ssh_connection_success": False,
                "running_config_success": False,
                "startup_config_success": False,
                "running_config_bytes": 0,
                "startup_config_bytes": 0,
                "error": None,
            }

            try:
                logger.info(f"\n{'=' * 60}")
                logger.info(f"Device {idx}/{total_devices}: {device_id}")
                logger.info(f"{'=' * 60}")

                progress = 20 + int((idx / total_devices) * 70)
                task_context.update_state(
                    state="PROGRESS",
                    meta={
                        "current": progress,
                        "total": 100,
                        "status": f"Backing up device {idx}/{total_devices} ({device_id[:8]})...",
                    },
                )

                # Get device details from Nautobot (including location and custom field data for path templating)
                logger.info(f"[{idx}] Fetching device details from Nautobot...")
                query = """
                query getDevice($deviceId: ID!) {
                  device(id: $deviceId) {
                    id
                        name
                        hostname: name
                        asset_tag
                        serial
                        _custom_field_data
                        custom_field_data: _custom_field_data
                        primary_ip4 {
                          id
                          address
                          host
                          mask_length
                        }
                        platform {
                          id
                          name
                          network_driver
                          manufacturer {
                            id
                            name
                          }
                        }
                        device_type {
                          id
                          model
                          manufacturer {
                            id
                            name
                          }
                        }
                        role {
                          id
                          name
                        }
                        location {
                          id
                          name
                          description
                          location_type {
                            id
                            name
                          }
                          parent {
                            id
                            name
                            description
                            location_type {
                              id
                              name
                            }
                            parent {
                              id
                              name
                              description
                            }
                          }
                        }
                        tenant {
                          id
                          name
                          tenant_group {
                            id
                            name
                          }
                        }
                        rack {
                          id
                          name
                          rack_group {
                            id
                            name
                          }
                        }
                        status {
                          id
                          name
                        }
                        tags {
                          id
                          name
                        }
                  }
                }
                """
                variables = {"deviceId": device_id}
                device_data = nautobot_service._sync_graphql_query(query, variables)

                if (
                    not device_data
                    or "data" not in device_data
                    or not device_data["data"].get("device")
                ):
                    logger.error(f"[{idx}] ✗ Failed to get device data from Nautobot")
                    device_backup_info["error"] = (
                        "Failed to fetch device data from Nautobot"
                    )
                    failed_devices.append(device_backup_info)
                    continue

                device = device_data["data"]["device"]
                device_name = device.get("name", device_id)
                primary_ip = (
                    device.get("primary_ip4", {}).get("address", "").split("/")[0]
                )

                # Get platform information from Nautobot
                platform_obj = device.get("platform", {})
                network_driver = (
                    platform_obj.get("network_driver") if platform_obj else None
                )
                platform_name = (
                    platform_obj.get("name", "unknown") if platform_obj else "unknown"
                )

                # Determine device type for Netmiko
                if network_driver:
                    # Use authoritative network_driver from Nautobot (already correct Netmiko format)
                    device_type = network_driver
                    platform = network_driver
                    logger.info(
                        f"[{idx}] Using network_driver from Nautobot: {network_driver}"
                    )
                else:
                    # Fallback: map platform name to Netmiko device type (best guess)
                    platform = platform_name
                    from utils.netmiko_platform_mapper import map_platform_to_netmiko

                    device_type = map_platform_to_netmiko(platform)
                    logger.info(
                        f"[{idx}] No network_driver, mapped platform '{platform}' to: {device_type}"
                    )

                device_backup_info["device_name"] = device_name
                device_backup_info["device_ip"] = primary_ip
                device_backup_info["platform"] = platform
                device_backup_info["nautobot_fetch_success"] = True

                logger.info(f"[{idx}] ✓ Device data fetched")
                logger.info(f"[{idx}]   - Name: {device_name}")
                logger.info(f"[{idx}]   - IP: {primary_ip or 'NOT SET'}")
                logger.info(f"[{idx}]   - Platform: {platform}")
                logger.info(f"[{idx}]   - Netmiko device type: {device_type}")
                logger.info(
                    f"[{idx}]   - Custom field data: {device.get('custom_field_data')}"
                )

                if not primary_ip:
                    logger.error(f"[{idx}] ✗ No primary IP")
                    device_backup_info["error"] = "No primary IP address"
                    failed_devices.append(device_backup_info)
                    continue

                logger.info(f"[{idx}] Connecting via SSH...")
                commands = ["show running-config", "show startup-config"]
                result = netmiko_service._connect_and_execute(
                    device_ip=primary_ip,
                    device_type=device_type,
                    username=username,
                    password=password,
                    commands=commands,
                    enable_mode=False,
                )

                if not result["success"]:
                    logger.error(f"[{idx}] ✗ SSH failed: {result.get('error')}")
                    device_backup_info["error"] = result.get(
                        "error", "SSH connection failed"
                    )
                    failed_devices.append(device_backup_info)
                    continue

                device_backup_info["ssh_connection_success"] = True
                logger.info(f"[{idx}] ✓ SSH successful")

                output = result["output"]
                logger.info(f"[{idx}] Output: {len(output)} bytes")

                # Parse output - using structured outcomes from NetmikoService
                command_outputs = result.get("command_outputs", {})
                logger.info(f"[{idx}] Parsing configuration output...")
                logger.debug(
                    f"[{idx}] Available command outputs keys: {list(command_outputs.keys())}"
                )

                running_config = command_outputs.get("show running-config", "").strip()
                startup_config = command_outputs.get("show startup-config", "").strip()

                logger.debug(
                    f"[{idx}] Raw startup config from command_outputs: '{command_outputs.get('show startup-config')}'"
                )
                logger.debug(f"[{idx}] Cleaned startup config: '{startup_config}'")

                logger.debug(f"[{idx}] Running config length: {len(running_config)}")
                logger.debug(f"[{idx}] Startup config length: {len(startup_config)}")
                if not startup_config:
                    logger.debug(
                        f"[{idx}] Startup config content (first 100 chars): '{command_outputs.get('show startup-config', '')[:100]}'"
                    )

                # Fallback to general output if structured data is missing (backward compatibility)
                if not running_config and not startup_config:
                    if "show startup-config" in output:
                        parts = output.split("show startup-config")
                        running_config = parts[0].strip()
                        if len(parts) > 1:
                            startup_config = parts[1].strip()
                    else:
                        running_config = output.strip()

                # Validate we got configs
                if running_config:
                    device_backup_info["running_config_success"] = True
                    device_backup_info["running_config_bytes"] = len(running_config)
                    logger.info(
                        f"[{idx}] ✓ Running config: {len(running_config)} bytes"
                    )
                else:
                    logger.warning(f"[{idx}] ⚠ Running config is empty!")

                if startup_config:
                    device_backup_info["startup_config_success"] = True
                    device_backup_info["startup_config_bytes"] = len(startup_config)
                    logger.info(
                        f"[{idx}] ✓ Startup config: {len(startup_config)} bytes"
                    )
                else:
                    # Not all devices support startup-config, or it might be empty
                    logger.info(f"[{idx}] Startup config is empty or not retrieved")

                # Generate file paths using templates or defaults
                from utils.path_template import replace_template_variables

                if backup_running_config_path:
                    running_path = replace_template_variables(
                        backup_running_config_path, device
                    )
                    # Strip leading slash to ensure path is relative to repo_dir
                    running_path = running_path.lstrip("/")
                    logger.info(
                        f"[{idx}] Using templated running config path: {running_path}"
                    )
                else:
                    running_path = (
                        f"backups/{device_name}.{current_date}.running-config"
                    )
                    logger.info(
                        f"[{idx}] Using default running config path: {running_path}"
                    )

                if backup_startup_config_path:
                    startup_path = replace_template_variables(
                        backup_startup_config_path, device
                    )
                    # Strip leading slash to ensure path is relative to repo_dir
                    startup_path = startup_path.lstrip("/")
                    logger.info(
                        f"[{idx}] Using templated startup config path: {startup_path}"
                    )
                else:
                    startup_path = (
                        f"backups/{device_name}.{current_date}.startup-config"
                    )
                    logger.info(
                        f"[{idx}] Using default startup config path: {startup_path}"
                    )

                # Create full paths (relative to repository directory)
                running_file = repo_dir / running_path
                startup_file = repo_dir / startup_path

                # Ensure parent directories exist
                running_file.parent.mkdir(parents=True, exist_ok=True)
                startup_file.parent.mkdir(parents=True, exist_ok=True)

                # Write configs
                running_file.write_text(running_config)
                logger.info(f"[{idx}] Wrote: {running_file.relative_to(repo_dir)}")

                if startup_config:
                    startup_file.write_text(startup_config)
                    logger.info(f"[{idx}] Wrote: {startup_file.relative_to(repo_dir)}")

                logger.info(f"[{idx}] ✓ Backup complete")

                backed_up_devices.append(
                    {
                        "device_id": device_id,
                        "device_name": device_name,
                        "device_ip": primary_ip,
                        "platform": platform,
                        "running_config_file": str(running_file.relative_to(repo_dir)),
                        "startup_config_file": str(startup_file.relative_to(repo_dir))
                        if startup_config
                        else None,
                        "running_config_bytes": len(running_config),
                        "startup_config_bytes": len(startup_config)
                        if startup_config
                        else 0,
                        "ssh_connection_success": True,
                        "running_config_success": True,
                        "startup_config_success": bool(startup_config),
                    }
                )

            except Exception as e:
                logger.error(f"[{idx}] ✗ Exception: {e}", exc_info=True)
                device_backup_info["error"] = str(e)
                failed_devices.append(device_backup_info)

        logger.info("\n" + "=" * 80)
        logger.info("BACKUP SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Successful: {len(backed_up_devices)}")
        logger.info(f"Failed: {len(failed_devices)}")

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
                logger.info(f"Committing and pushing with message: '{commit_message}'")
                logger.info(f"  - Auth type: {repository.get('auth_type', 'token')}")

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
                    logger.info(f"✓ {result.message}")
                    if result.commit_sha:
                        logger.info(f"  - Commit: {result.commit_sha[:8]}")
                    logger.info(f"  - Files changed: {result.files_changed}")
                    logger.info(f"  - Pushed: {result.pushed}")
                else:
                    logger.error(f"✗ {result.message}")
                    raise GitCommandError("commit_and_push", 1, result.message.encode())
            else:
                logger.warning("⚠ No devices backed up - skipping commit")

        except GitCommandError as e:
            logger.error(f"✗ Git operation failed: {e}")
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
            logger.info(f"Custom field: {timestamp_custom_field_name}")

            task_context.update_state(
                state="PROGRESS",
                meta={
                    "current": 95,
                    "total": 100,
                    "status": f"Updating custom field '{timestamp_custom_field_name}' in Nautobot...",
                },
            )

            # Format timestamp as YYYY-MM-DD
            backup_date = datetime.now().strftime("%Y-%m-%d")
            logger.info(f"Backup timestamp: {backup_date}")

            for device_info in backed_up_devices:
                device_id = device_info.get("device_id")
                device_name = device_info.get("device_name", device_id)

                try:
                    logger.info(
                        f"Updating custom field for device: {device_name} ({device_id})"
                    )

                    # Update the device's custom field via Nautobot REST API
                    update_data = {
                        "custom_fields": {timestamp_custom_field_name: backup_date}
                    }

                    result = nautobot_service._sync_rest_request(
                        endpoint=f"dcim/devices/{device_id}/",
                        method="PATCH",
                        data=update_data,
                    )

                    logger.info(f"✓ Updated custom field for {device_name}")
                    timestamp_update_status["updated_count"] += 1

                except Exception as e:
                    error_msg = (
                        f"Failed to update custom field for {device_name}: {str(e)}"
                    )
                    logger.error(f"✗ {error_msg}")
                    timestamp_update_status["failed_count"] += 1
                    timestamp_update_status["errors"].append(error_msg)

            logger.info(
                f"Custom field updates: {timestamp_update_status['updated_count']} successful, {timestamp_update_status['failed_count']} failed"
            )

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
        logger.error(f"Exception: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "git_status": git_status,
            "credential_info": credential_info,
        }
