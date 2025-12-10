"""
Backup configurations job executor.
Backs up device configurations to repository.

Moved from job_tasks.py to improve code organization.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime
import shutil
from git import Repo
from git.exc import InvalidGitRepositoryError, GitCommandError
from services.git_config_service import set_git_author

logger = logging.getLogger(__name__)


def execute_backup(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
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
        from services.git_shared_utils import git_repo_manager
        from services.git_utils import (
            repo_path,
            add_auth_to_url,
            set_ssl_env,
            resolve_git_credentials,
        )
        from services.nautobot import NautobotService
        from services.netmiko_service import NetmikoService
        import credentials_manager
        import jobs_manager
        import job_template_manager

        # Get config_repository_id and backup paths from job_parameters or template
        config_repository_id = None
        backup_running_config_path = None
        backup_startup_config_path = None
        write_timestamp_to_custom_field = False
        timestamp_custom_field_name = None

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

        if not target_devices:
            logger.error("ERROR: No target devices specified")
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

        repo_dir = repo_path(dict(repository))
        git_status["repository_path"] = str(repo_dir)
        logger.info(f"Repository local path: {repo_dir}")

        repo_dir.parent.mkdir(parents=True, exist_ok=True)
        logger.info(f"✓ Parent directory created/exists: {repo_dir.parent}")

        # Get Git credentials for repository
        logger.info("Resolving Git repository credentials...")
        git_username, git_token, git_ssh_key_path = resolve_git_credentials(
            dict(repository)
        )
        logger.info(f"  - Git username: {git_username or 'none'}")
        logger.info(f"  - Git token: {'*' * 10 if git_token else 'none'}")
        logger.info(f"  - SSH key: {'configured' if git_ssh_key_path else 'none'}")

        # Check if repository exists
        git_repo = None

        logger.info(f"Checking if repository exists at {repo_dir}...")
        try:
            git_repo = Repo(str(repo_dir))
            git_status["repository_existed"] = True
            logger.info("✓ Repository exists locally")

            from services.git_utils import normalize_git_url

            existing_url = normalize_git_url(
                git_repo.remotes.origin.url if git_repo.remotes else ""
            )
            expected_url = normalize_git_url(repository.get("url"))

            logger.info("Verifying repository URL...")
            logger.info(f"  - Expected: {expected_url}")
            logger.info(f"  - Actual:   {existing_url}")

            if existing_url != expected_url:
                logger.warning("⚠ Repository URL mismatch! Will remove and reclone.")
                git_repo.close()
                shutil.rmtree(repo_dir)
                git_repo = None
            else:
                logger.info("✓ Repository URL matches")

        except (InvalidGitRepositoryError, Exception) as e:
            logger.info(f"Repository doesn't exist or is invalid: {e}")
            git_repo = None

        # Clone or pull repository
        if git_repo is None:
            logger.info(
                f"CLONING repository from {repository.get('url')} to {repo_dir}"
            )
            git_status["operation"] = "cloned"
            clone_url = add_auth_to_url(repository.get("url"), git_username, git_token)

            with set_ssl_env(dict(repository)):
                try:
                    git_repo = Repo.clone_from(
                        clone_url,
                        str(repo_dir),
                        branch=repository.get("branch") or "main",
                    )
                    logger.info("✓ Successfully cloned repository")
                    logger.info(f"  - Current branch: {git_repo.active_branch}")
                    logger.info(f"  - Latest commit: {git_repo.head.commit.hexsha[:8]}")
                except GitCommandError as e:
                    logger.error(f"ERROR: Failed to clone repository: {e}")
                    return {
                        "success": False,
                        "error": f"Failed to clone repository: {str(e)}",
                        "git_status": git_status,
                        "credential_info": credential_info,
                    }
        else:
            logger.info(f"PULLING latest changes from {repository.get('url')}")
            git_status["operation"] = "pulled"

            with set_ssl_env(dict(repository)):
                try:
                    origin = git_repo.remotes.origin
                    pull_url = add_auth_to_url(
                        repository.get("url"), git_username, git_token
                    )

                    with git_repo.config_writer() as config:
                        config.set_value('remote "origin"', "url", pull_url)

                    origin.pull(repository.get("branch") or "main")
                    logger.info("✓ Successfully pulled latest changes")
                except GitCommandError as e:
                    logger.warning(f"⚠ Pull failed: {e}. Will remove and reclone...")
                    git_status["operation"] = "recloned"
                    git_repo.close()
                    shutil.rmtree(repo_dir)

                    git_repo = Repo.clone_from(
                        add_auth_to_url(repository.get("url"), git_username, git_token),
                        str(repo_dir),
                        branch=repository.get("branch") or "main",
                    )
                    logger.info("✓ Successfully recloned repository")

        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": 20,
                "total": 100,
                "status": f"Backing up {len(target_devices)} devices...",
            },
        )

        # STEP 3: Backup each device
        logger.info("-" * 80)
        logger.info(f"STEP 3: BACKING UP {len(target_devices)} DEVICES")
        logger.info("-" * 80)

        nautobot_service = NautobotService()
        netmiko_service = NetmikoService()

        backed_up_devices = []
        failed_devices = []
        current_date = datetime.now().strftime("%Y%m%d_%H%M%S")

        total_devices = len(target_devices)
        for idx, device_id in enumerate(target_devices, 1):
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
                platform = (
                    device.get("platform", {}).get("name", "unknown")
                    if device.get("platform")
                    else "unknown"
                )

                device_backup_info["device_name"] = device_name
                device_backup_info["device_ip"] = primary_ip
                device_backup_info["platform"] = platform
                device_backup_info["nautobot_fetch_success"] = True

                logger.info(f"[{idx}] ✓ Device data fetched")
                logger.info(f"[{idx}]   - Name: {device_name}")
                logger.info(f"[{idx}]   - IP: {primary_ip or 'NOT SET'}")
                logger.info(f"[{idx}]   - Platform: {platform}")
                logger.info(
                    f"[{idx}]   - Custom field data: {device.get('custom_field_data')}"
                )

                if not primary_ip:
                    logger.error(f"[{idx}] ✗ No primary IP")
                    device_backup_info["error"] = "No primary IP address"
                    failed_devices.append(device_backup_info)
                    continue

                # Map platform to Netmiko device type
                from tasks.backup_tasks import map_platform_to_netmiko

                device_type = map_platform_to_netmiko(platform)
                logger.info(f"[{idx}] Netmiko device type: {device_type}")

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

                # Parse configs
                running_config = ""
                startup_config = ""

                if "show startup-config" in output:
                    parts = output.split("show startup-config")
                    running_config = parts[0].strip()
                    if len(parts) > 1:
                        startup_config = parts[1].strip()
                else:
                    running_config = output.strip()

                if running_config:
                    device_backup_info["running_config_success"] = True
                    device_backup_info["running_config_bytes"] = len(running_config)
                    logger.info(
                        f"[{idx}] ✓ Running config: {len(running_config)} bytes"
                    )

                if startup_config:
                    device_backup_info["startup_config_success"] = True
                    device_backup_info["startup_config_bytes"] = len(startup_config)
                    logger.info(
                        f"[{idx}] ✓ Startup config: {len(startup_config)} bytes"
                    )

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

        # STEP 4: Commit and push
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
                git_repo.git.add(".")

                changed_files = git_repo.git.diff("--cached", "--name-only").split("\n")
                changed_files = [f for f in changed_files if f.strip()]
                git_commit_status["files_changed"] = len(changed_files)

                logger.info(f"Files to commit: {len(changed_files)}")
                for f in changed_files[:10]:
                    logger.info(f"  - {f}")

                commit_message = f"Backup config {current_date}"
                # Set git author configuration for this commit
                with set_git_author(dict(repository), git_repo):
                    commit = git_repo.index.commit(commit_message)
                git_commit_status["committed"] = True
                git_commit_status["commit_hash"] = commit.hexsha[:8]
                logger.info(f"✓ Committed: {commit.hexsha[:8]}")

                with set_ssl_env(dict(repository)):
                    origin = git_repo.remotes.origin
                    push_url = add_auth_to_url(
                        repository.get("url"), git_username, git_token
                    )

                    with git_repo.config_writer() as config:
                        config.set_value('remote "origin"', "url", push_url)

                    origin.push(repository.get("branch") or "main")
                    git_commit_status["pushed"] = True
                    logger.info("✓ Pushed to remote")
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
