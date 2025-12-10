"""
Backup tasks for backing up device configurations to Git repository.
"""

from celery import shared_task
import logging
from datetime import datetime
from typing import List, Optional
import shutil
from git import Repo
from git.exc import InvalidGitRepositoryError, GitCommandError

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
        from services.git_utils import (
            repo_path,
            add_auth_to_url,
            set_ssl_env,
            resolve_git_credentials,
        )
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
            # Try to open existing repository
            git_repo = Repo(str(repo_dir))
            git_status["repository_existed"] = True
            logger.info("✓ Repository exists locally")

            # Verify it's the correct repository
            from services.git_utils import normalize_git_url

            existing_url = normalize_git_url(
                git_repo.remotes.origin.url if git_repo.remotes else ""
            )
            expected_url = normalize_git_url(repository.url)

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
            # Clone repository
            logger.info(f"CLONING repository from {repository.url} to {repo_dir}")
            logger.info(f"  - Branch: {repository.branch or 'main'}")

            git_status["operation"] = "cloned"
            clone_url = add_auth_to_url(repository.url, git_username, git_token)

            with set_ssl_env(dict(repository)):
                try:
                    git_repo = Repo.clone_from(
                        clone_url, str(repo_dir), branch=repository.branch or "main"
                    )
                    logger.info(f"✓ Successfully cloned repository to {repo_dir}")
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
            # Pull latest changes
            logger.info(f"PULLING latest changes from {repository.url}")
            git_status["operation"] = "pulled"

            with set_ssl_env(dict(repository)):
                try:
                    origin = git_repo.remotes.origin
                    pull_url = add_auth_to_url(repository.url, git_username, git_token)

                    # Update remote URL with credentials
                    with git_repo.config_writer() as config:
                        config.set_value('remote "origin"', "url", pull_url)

                    logger.info(f"  - Pulling branch: {repository.branch or 'main'}")
                    origin.pull(repository.branch or "main")
                    logger.info("✓ Successfully pulled latest changes")
                    logger.info(f"  - Latest commit: {git_repo.head.commit.hexsha[:8]}")
                except GitCommandError as e:
                    logger.warning(f"⚠ Pull failed: {e}. Will remove and reclone...")
                    git_status["operation"] = "recloned"
                    git_repo.close()
                    shutil.rmtree(repo_dir)

                    # Reclone
                    logger.info(f"RECLONING repository from {repository.url}")
                    git_repo = Repo.clone_from(
                        add_auth_to_url(repository.url, git_username, git_token),
                        str(repo_dir),
                        branch=repository.branch or "main",
                    )
                    logger.info("✓ Successfully recloned repository")

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

                # Parse output - Netmiko concatenates all outputs
                output = result["output"]
                logger.info(f"[{idx}] Total output received: {len(output)} bytes")
                logger.info(f"[{idx}] Parsing configuration output...")

                # Split outputs (simple approach - looking for config markers)
                running_config = ""
                startup_config = ""

                # Try to split by looking for the second command in output
                if "show startup-config" in output:
                    parts = output.split("show startup-config")
                    running_config = parts[0].strip()
                    if len(parts) > 1:
                        startup_config = parts[1].strip()
                    logger.info(f"[{idx}] Split output by 'show startup-config' marker")
                elif (
                    "Building configuration" in output
                    or "Current configuration" in output
                ):
                    # Fallback: try to find configuration markers
                    running_config = output.strip()
                    logger.info(
                        f"[{idx}] Using entire output as running config (no split marker found)"
                    )
                else:
                    # Last resort: use entire output
                    running_config = output.strip()
                    logger.info(
                        f"[{idx}] Using entire output as running config (no markers found)"
                    )

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
                    logger.warning(
                        f"[{idx}] ⚠ Startup config is empty or not retrieved"
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

        # Step 4: Commit and push changes
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
                logger.info("Adding files to Git staging area...")
                git_repo.git.add(".")

                # Check what files are staged
                changed_files = git_repo.git.diff("--cached", "--name-only").split("\n")
                changed_files = [f for f in changed_files if f.strip()]
                git_commit_status["files_changed"] = len(changed_files)

                logger.info(f"Files to commit: {len(changed_files)}")
                for f in changed_files[:10]:  # Show first 10
                    logger.info(f"  - {f}")
                if len(changed_files) > 10:
                    logger.info(f"  ... and {len(changed_files) - 10} more")

                commit_message = f"Backup config {current_date}"
                logger.info(f"Creating commit: '{commit_message}'")
                commit = git_repo.index.commit(commit_message)
                git_commit_status["committed"] = True
                git_commit_status["commit_hash"] = commit.hexsha[:8]
                logger.info(f"✓ Commit created: {commit.hexsha[:8]}")

                logger.info("Pushing to remote repository...")
                with set_ssl_env(dict(repository)):
                    origin = git_repo.remotes.origin
                    push_url = add_auth_to_url(repository.url, git_username, git_token)

                    with git_repo.config_writer() as config:
                        config.set_value('remote "origin"', "url", push_url)

                    push_info = origin.push(repository.branch or "main")
                    git_commit_status["pushed"] = True
                    logger.info(
                        f"✓ Successfully pushed to {repository.branch or 'main'}"
                    )
                    logger.info(f"  - Push info: {push_info}")
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
