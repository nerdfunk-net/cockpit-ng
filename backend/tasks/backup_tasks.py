"""
Backup tasks for backing up device configurations to Git repository.
"""

from celery import shared_task
import logging
from datetime import datetime
from typing import List, Optional
from git.exc import GitCommandError

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="tasks.backup_devices")
def backup_devices_task(
    self,
    inventory: Optional[List[str]] = None,
    config_repository_id: Optional[int] = None,
    credential_id: Optional[int] = None,
    write_timestamp_to_custom_field: Optional[bool] = False,
    timestamp_custom_field_name: Optional[str] = None,
) -> dict:
    """
    Backup device configurations to Git repository.

    Workflow:
    1. Convert inventory to list of device IDs
    2. Check/clone/pull Git repository
    3. For each device:
       - Get device details from Nautobot
       - Connect via Netmiko
       - Execute 'show running-config' and 'show startup-config'
       - Save to files in Git repo
    4. Commit and push changes
    5. Optionally update custom field with backup timestamp

    Args:
        self: Task instance (for updating state)
        inventory: List of device IDs to backup
        config_repository_id: ID of Git repository for configs
        credential_id: ID of credential for device authentication
        write_timestamp_to_custom_field: Whether to write timestamp to Nautobot custom field
        timestamp_custom_field_name: Name of the custom field to write timestamp to

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
        logger.info("BACKUP TASK STARTED")
        logger.info("=" * 80)
        logger.info(f"Inventory devices: {len(inventory) if inventory else 0}")
        logger.info(f"Config repository ID: {config_repository_id}")
        logger.info(f"Credential ID: {credential_id}")

        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing backup..."},
        )

        # Import services here to avoid circular imports
        from services.git_shared_utils import git_repo_manager
        from services.git_service import git_service
        from services.git_auth_service import git_auth_service
        from services.nautobot import NautobotService
        from services.netmiko_service import NetmikoService
        import credentials_manager

        # Step 1: Validate inputs
        logger.info("-" * 80)
        logger.info("STEP 1: VALIDATING INPUTS")
        logger.info("-" * 80)

        if not inventory:
            logger.error("ERROR: No devices specified in inventory")
            return {
                "success": False,
                "error": "No devices specified in inventory",
                "git_status": git_status,
                "credential_info": credential_info,
            }

        if not config_repository_id:
            logger.error("ERROR: No configuration repository specified")
            return {
                "success": False,
                "error": "No configuration repository specified",
                "git_status": git_status,
                "credential_info": credential_info,
            }

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

        logger.info(f"✓ Repository found: {repository.name}")
        logger.info(f"  - URL: {repository.url}")
        logger.info(f"  - Branch: {repository.branch or 'main'}")
        logger.info(f"  - Category: {repository.category}")

        git_status["repository_url"] = repository.url
        git_status["branch"] = repository.branch or "main"

        # Get credentials - required for backup
        logger.info(f"Fetching credential {credential_id} from database...")
        if not credential_id:
            logger.error("ERROR: No credential specified for device authentication")
            return {
                "success": False,
                "error": "No credential specified for device authentication",
                "git_status": git_status,
                "credential_info": credential_info,
            }

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
        password = credential.get("password")
        credential_name = credential.get("name")

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

        self.update_state(
            state="PROGRESS",
            meta={"current": 10, "total": 100, "status": "Preparing Git repository..."},
        )

        # Step 2: Setup Git repository
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

        # Use central git_service for repository operations (supports SSH keys and tokens)
        logger.info("Opening or cloning repository using git_service...")
        logger.info(f"  - Auth type: {repository.auth_type or 'token'}")

        try:
            # Use git_service which handles both SSH key and token authentication
            git_repo = git_service.open_or_clone(dict(repository))

            # Determine if this was a clone or existing repo
            git_status["repository_existed"] = repo_dir.exists()
            git_status["operation"] = (
                "opened" if git_status["repository_existed"] else "cloned"
            )

            logger.info(f"✓ Repository ready at {repo_dir}")
            logger.info(f"  - Current branch: {git_repo.active_branch}")
            logger.info(f"  - Latest commit: {git_repo.head.commit.hexsha[:8]}")

            # Pull latest changes using git_service
            logger.info(f"Pulling latest changes from {repository.url}...")
            pull_result = git_service.pull(dict(repository), repo=git_repo)

            if pull_result.success:
                logger.info(f"✓ {pull_result.message}")
                git_status["operation"] = "pulled"
            else:
                logger.warning(f"⚠ Pull warning: {pull_result.message}")
                # Continue anyway - we have a valid local repo

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
        logger.info("-" * 80)

        nautobot_service = NautobotService()
        netmiko_service = NetmikoService()

        backed_up_devices = []
        failed_devices = []
        current_date = datetime.now().strftime("%Y%m%d_%H%M%S")

        total_devices = len(inventory)
        for idx, device_id in enumerate(inventory, 1):
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
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": progress,
                        "total": 100,
                        "status": f"Backing up device {idx}/{total_devices} ({device_id})...",
                    },
                )

                # Get device details from Nautobot using GraphQL
                logger.info(f"[{idx}] Fetching device details from Nautobot...")
                query = """
                query getDevice($deviceId: ID!) {
                  device(id: $deviceId) {
                    id
                    name
                    primary_ip4 {
                      address
                    }
                    platform {
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
                    logger.error(f"[{idx}] Response: {device_data}")
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

                logger.info(f"[{idx}] ✓ Device data fetched from Nautobot")
                logger.info(f"[{idx}]   - Name: {device_name}")
                logger.info(f"[{idx}]   - Primary IP: {primary_ip or 'NOT SET'}")
                logger.info(f"[{idx}]   - Platform: {platform}")

                if not primary_ip:
                    logger.error(
                        f"[{idx}] ✗ Device has no primary IP address - cannot connect"
                    )
                    device_backup_info["error"] = "No primary IP address"
                    failed_devices.append(device_backup_info)
                    continue

                # Determine device type for Netmiko
                device_type = map_platform_to_netmiko(platform)
                logger.info(f"[{idx}] Netmiko device type: {device_type}")

                logger.info(
                    f"[{idx}] Connecting to {device_name} ({primary_ip}) via SSH..."
                )
                logger.info(f"[{idx}]   - Username: {username}")
                logger.info(f"[{idx}]   - Device type: {device_type}")

                # Connect and execute backup commands
                commands = ["show running-config", "show startup-config"]
                result = netmiko_service._connect_and_execute(
                    device_ip=primary_ip,
                    device_type=device_type,
                    username=username,
                    password=password,
                    commands=commands,
                    enable_mode=False,
                    privileged=True,
                )

                if not result["success"]:
                    logger.error(
                        f"[{idx}] ✗ SSH connection or command execution failed"
                    )
                    logger.error(f"[{idx}] Error: {result.get('error')}")
                    device_backup_info["error"] = result.get(
                        "error", "SSH connection failed"
                    )
                    failed_devices.append(device_backup_info)
                    continue

                device_backup_info["ssh_connection_success"] = True
                logger.info(f"[{idx}] ✓ SSH connection successful")

                # Parse output - using structured outcomes from NetmikoService
                command_outputs = result.get("command_outputs", {})
                logger.info(f"[{idx}] Parsing configuration output...")
                logger.debug(f"[{idx}] Available command outputs keys: {list(command_outputs.keys())}")

                running_config = command_outputs.get("show running-config", "").strip()
                startup_config = command_outputs.get("show startup-config", "").strip()

                logger.debug(f"[{idx}] Raw startup config from command_outputs: '{command_outputs.get('show startup-config')}'")
                logger.debug(f"[{idx}] Cleaned startup config: '{startup_config}'")
                
                logger.debug(f"[{idx}] Running config length: {len(running_config)}")
                logger.debug(f"[{idx}] Startup config length: {len(startup_config)}")
                if not startup_config:
                    logger.debug(f"[{idx}] Startup config content (first 100 chars): '{command_outputs.get('show startup-config', '')[:100]}'")

                # Fallback to general output if structured data is missing (backward compatibility)
                if not running_config and not startup_config:
                    output = result["output"]
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
                    logger.info(
                        f"[{idx}] Startup config is empty or not retrieved"
                    )

                # Save configs to files
                config_dir = repo_dir / "backups"
                config_dir.mkdir(exist_ok=True)
                logger.info(f"[{idx}] Config directory: {config_dir}")

                running_file = (
                    config_dir / f"{device_name}.{current_date}.running-config"
                )
                startup_file = (
                    config_dir / f"{device_name}.{current_date}.startup-config"
                )

                logger.info(f"[{idx}] Writing configs to disk...")
                running_file.write_text(running_config)
                logger.info(f"[{idx}]   - Running config → {running_file.name}")

                if startup_config:
                    startup_file.write_text(startup_config)
                    logger.info(f"[{idx}]   - Startup config → {startup_file.name}")

                logger.info(f"[{idx}] ✓ Backup completed for {device_name}")

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
                logger.error(f"[{idx}] ✗ Exception during backup: {e}", exc_info=True)
                device_backup_info["error"] = str(e)
                failed_devices.append(device_backup_info)

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
                logger.info(f"  - Auth type: {repository.auth_type or 'token'}")

                # Use git_service for commit and push (supports SSH keys and tokens)
                result = git_service.commit_and_push(
                    repository=dict(repository),
                    message=commit_message,
                    repo=git_repo,
                    add_all=True,
                    branch=repository.branch or "main",
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
                logger.warning(
                    "⚠ No devices backed up successfully - skipping Git commit"
                )

        except GitCommandError as e:
            logger.error(f"✗ Failed to commit/push: {e}")
            git_status["commit_error"] = str(e)
            return {
                "success": False,
                "backed_up_count": len(backed_up_devices),
                "failed_count": len(failed_devices),
                "backed_up_devices": backed_up_devices,
                "failed_devices": failed_devices,
                "git_status": git_status,
                "git_commit_status": git_commit_status,
                "credential_info": credential_info,
                "error": f"Backup completed but failed to push to Git: {str(e)}",
            }

        # Step 5: Update Nautobot custom fields with backup timestamp (if enabled)
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

            self.update_state(
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
        logger.info("BACKUP TASK COMPLETED SUCCESSFULLY")
        logger.info("=" * 80)

        return {
            "success": True,
            "backed_up_count": len(backed_up_devices),
            "failed_count": len(failed_devices),
            "backed_up_devices": backed_up_devices,
            "failed_devices": failed_devices,
            "git_status": git_status,
            "git_commit_status": git_commit_status,
            "credential_info": credential_info,
            "timestamp_update_status": timestamp_update_status,
            "repository": repository.name,
            "commit_date": current_date,
        }

    except Exception as e:
        logger.error("=" * 80)
        logger.error("BACKUP TASK FAILED WITH EXCEPTION")
        logger.error("=" * 80)
        logger.error(f"Exception: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "git_status": git_status,
            "credential_info": credential_info,
        }


def map_platform_to_netmiko(platform: str) -> str:
    """Map Nautobot platform to Netmiko device type."""
    if not platform:
        logger.warning("Platform is None or empty, defaulting to cisco_ios")
        return "cisco_ios"

    platform_map = {
        "ios": "cisco_ios",
        "cisco ios": "cisco_ios",
        "nxos": "cisco_nxos",
        "cisco nxos": "cisco_nxos",
        "asa": "cisco_asa",
        "cisco asa": "cisco_asa",
        "junos": "juniper_junos",
        "juniper": "juniper_junos",
        "arista": "arista_eos",
        "eos": "arista_eos",
    }

    platform_lower = platform.lower()
    for key, value in platform_map.items():
        if key in platform_lower:
            logger.debug(f"Mapped platform '{platform}' to Netmiko type '{value}'")
            return value

    # Default to cisco_ios if unknown
    logger.warning(f"Unknown platform '{platform}', defaulting to cisco_ios")
    return "cisco_ios"
