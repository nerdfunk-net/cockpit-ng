"""
Run commands job executor.
Executes commands on network devices using templates.

Moved from job_tasks.py to improve code organization.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def execute_run_commands(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute run_commands job.

    Runs commands on network devices using a command template.
    The template is rendered for each device with Nautobot context,
    then executed via Netmiko.

    Args:
        schedule_id: Job schedule ID
        credential_id: ID of credential for device authentication
        job_parameters: Additional job parameters (contains command_template_name)
        target_devices: List of device UUIDs to run commands on
        task_context: Celery task context for progress updates
        template: Job template configuration

    Returns:
        dict: Command execution results with detailed per-device output
    """
    from services.network.automation.netmiko import NetmikoService
    from services.network.automation.render import RenderService
    import credentials_manager
    from template_manager import template_manager

    # Track credential usage
    credential_info = {
        "credential_id": credential_id,
        "credential_name": None,
        "username": None,
    }

    try:
        logger.info("=" * 80)
        logger.info("RUN COMMANDS EXECUTOR STARTED")
        logger.info("=" * 80)
        logger.info("Schedule ID: %s", schedule_id)
        logger.info("Credential ID: %s", credential_id)
        logger.info("Target devices: %s", len(target_devices) if target_devices else 0)
        logger.info("Job parameters: %s", job_parameters)
        logger.info("Template: %s", template)

        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": 0,
                "total": 100,
                "status": "Initializing command execution...",
            },
        )

        # Get command template name from job_parameters or template
        command_template_name = None
        if job_parameters:
            command_template_name = job_parameters.get("command_template_name")
        if not command_template_name and template:
            command_template_name = template.get("command_template_name")

        if not command_template_name:
            logger.error("ERROR: No command template specified")
            return {
                "success": False,
                "error": "No command template specified. Please configure a command template in the job template.",
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
                device_ids = [
                    device.get("id") for device in devices_result["devices"]
                ]
                logger.info("Fetched %s devices from Nautobot", len(device_ids))
            else:
                logger.warning("No devices found in Nautobot")
                device_ids = []

        if not device_ids:
            logger.error("ERROR: No devices found to run commands on")
            return {
                "success": False,
                "error": "No devices to run commands on",
                "credential_info": credential_info,
            }

        if not credential_id:
            logger.error("ERROR: No credential_id specified")
            return {
                "success": False,
                "error": "No credentials specified. Please select credentials in the job schedule.",
                "credential_info": credential_info,
            }

        logger.info("-" * 80)
        logger.info("STEP 1: VALIDATING INPUTS")
        logger.info("-" * 80)

        # Get credentials
        logger.info("Fetching credential %s from database...", credential_id)
        credential = credentials_manager.get_credential_by_id(credential_id)
        if not credential:
            logger.error("ERROR: Credential %s not found in database", credential_id)
            return {
                "success": False,
                "error": f"Credential {credential_id} not found",
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
                "credential_info": credential_info,
            }

        # Get command template content
        logger.info("Fetching command template: %s...", command_template_name)
        command_template_obj = template_manager.get_template_by_name(
            command_template_name
        )
        if not command_template_obj:
            logger.error(
                "ERROR: Command template '%s' not found", command_template_name
            )
            return {
                "success": False,
                "error": f"Command template '{command_template_name}' not found",
                "credential_info": credential_info,
            }

        template_content = template_manager.get_template_content(
            command_template_obj["id"]
        )
        if not template_content:
            logger.error(
                "ERROR: Command template content not found for '%s'",
                command_template_name,
            )
            return {
                "success": False,
                "error": f"Command template content not found for '{command_template_name}'",
                "credential_info": credential_info,
            }

        logger.info("✓ Command template found: %s", command_template_name)
        logger.info("  - Template ID: %s", command_template_obj["id"])
        logger.info("  - Content length: %s chars", len(template_content))

        logger.info("✓ All inputs validated successfully")

        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": 10,
                "total": 100,
                "status": f"Running commands on {len(device_ids)} devices...",
            },
        )

        # STEP 2: Execute commands on each device
        logger.info("-" * 80)
        logger.info("STEP 2: EXECUTING COMMANDS ON %s DEVICES", len(device_ids))
        logger.info("-" * 80)

        nautobot_service = service_factory.build_nautobot_service()
        netmiko_service = NetmikoService()
        render_service = RenderService()

        successful_devices = []
        failed_devices = []
        total_devices = len(device_ids)

        for idx, device_id in enumerate(device_ids, 1):
                device_result = {
                    "device_id": device_id,
                    "device_name": None,
                    "device_ip": None,
                    "platform": None,
                    "success": False,
                    "rendered_commands": None,
                    "output": None,
                    "error": None,
                }

                try:
                    logger.info("\n%s", "=" * 60)
                    logger.info("Device %s/%s: %s", idx, total_devices, device_id)
                    logger.info("%s", "=" * 60)

                    progress = 10 + int((idx / total_devices) * 80)
                    task_context.update_state(
                        state="PROGRESS",
                        meta={
                            "current": progress,
                            "total": 100,
                            "status": f"Executing on device {idx}/{total_devices}...",
                        },
                    )

                    # Get device details from Nautobot
                    logger.info("[%s] Fetching device details from Nautobot...", idx)
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
                          }
                        }
                        tenant {
                          id
                          name
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
                    device_data = asyncio.run(
                        nautobot_service.graphql_query(query, variables)
                    )

                    if (
                        not device_data
                        or "data" not in device_data
                        or not device_data["data"].get("device")
                    ):
                        logger.error(
                            "[%s] ✗ Failed to get device data from Nautobot", idx
                        )
                        device_result["error"] = (
                            "Failed to fetch device data from Nautobot"
                        )
                        failed_devices.append(device_result)
                        continue

                    device = device_data["data"]["device"]
                    device_name = device.get("name", device_id)
                    primary_ip = (
                        device.get("primary_ip4", {}).get("address", "").split("/")[0]
                        if device.get("primary_ip4")
                        else None
                    )

                    # Get platform information from Nautobot
                    platform_obj = device.get("platform", {})
                    network_driver = (
                        platform_obj.get("network_driver") if platform_obj else None
                    )
                    platform_name = (
                        platform_obj.get("name", "unknown")
                        if platform_obj
                        else "unknown"
                    )

                    # Determine device type for Netmiko
                    if network_driver:
                        # Use authoritative network_driver from Nautobot (already correct Netmiko format)
                        device_type = network_driver
                        platform = network_driver
                        logger.info(
                            "[%s] Using network_driver from Nautobot: %s",
                            idx,
                            network_driver,
                        )
                    else:
                        # Fallback: map platform name to Netmiko device type (best guess)
                        platform = platform_name
                        from utils.netmiko_platform_mapper import (
                            map_platform_to_netmiko,
                        )

                        device_type = map_platform_to_netmiko(platform)
                        logger.info(
                            "[%s] No network_driver, mapped platform '%s' to: %s",
                            idx,
                            platform,
                            device_type,
                        )

                    device_result["device_name"] = device_name
                    device_result["device_ip"] = primary_ip
                    device_result["platform"] = platform

                    logger.info("[%s] ✓ Device data fetched", idx)
                    logger.info("[%s]   - Name: %s", idx, device_name)
                    logger.info("[%s]   - IP: %s", idx, primary_ip or "NOT SET")
                    logger.info("[%s]   - Platform: %s", idx, platform)
                    logger.info("[%s]   - Netmiko device type: %s", idx, device_type)

                    if not primary_ip:
                        logger.error("[%s] ✗ No primary IP", idx)
                        device_result["error"] = "No primary IP address"
                        failed_devices.append(device_result)
                        continue

                    # Render template for this device
                    logger.info("[%s] Rendering template...", idx)
                    try:
                        render_result = asyncio.run(
                            render_service.render_template(
                                template_content=template_content,
                                category="netmiko",
                                device_id=device_id,
                                user_variables={},
                                use_nautobot_context=True,
                            )
                        )
                        rendered_content = render_result["rendered_content"]
                        device_result["rendered_commands"] = rendered_content
                        logger.info("[%s] ✓ Template rendered successfully", idx)
                    except Exception as render_error:
                        logger.error(
                            "[%s] ✗ Template rendering failed: %s", idx, render_error
                        )
                        device_result["error"] = (
                            f"Template rendering failed: {str(render_error)}"
                        )
                        failed_devices.append(device_result)
                        continue

                    # Convert rendered content to command list
                    commands = [
                        line.strip()
                        for line in rendered_content.split("\n")
                        if line.strip()
                    ]

                    if not commands:
                        logger.error(
                            "[%s] ✗ No commands to execute after template rendering",
                            idx,
                        )
                        device_result["error"] = (
                            "No commands to execute after template rendering"
                        )
                        failed_devices.append(device_result)
                        continue

                    logger.info("[%s] Commands to execute: %s", idx, len(commands))

                    # Map platform to Netmiko device type
                    from utils.netmiko_platform_mapper import map_platform_to_netmiko

                    device_type = map_platform_to_netmiko(platform)
                    logger.info("[%s] Netmiko device type: %s", idx, device_type)

                    # Execute commands using Netmiko
                    logger.info(
                        "[%s] Connecting via SSH and executing commands...", idx
                    )
                    result = netmiko_service._connect_and_execute(
                        device_ip=primary_ip,
                        device_type=device_type,
                        username=username,
                        password=password,
                        commands=commands,
                        enable_mode=False,
                    )

                    if result["success"]:
                        device_result["success"] = True
                        device_result["output"] = result["output"]
                        logger.info("[%s] ✓ Commands executed successfully", idx)
                        logger.info(
                            "[%s]   - Output length: %s chars",
                            idx,
                            len(result["output"]),
                        )
                        successful_devices.append(device_result)
                    else:
                        device_result["error"] = result.get(
                            "error", "Command execution failed"
                        )
                        logger.error(
                            "[%s] ✗ Command execution failed: %s",
                            idx,
                            result.get("error"),
                        )
                        failed_devices.append(device_result)

                except Exception as e:
                    logger.error("[%s] ✗ Exception: %s", idx, e, exc_info=True)
                    device_result["error"] = str(e)
                    failed_devices.append(device_result)

        logger.info("\n" + "=" * 80)
        logger.info("COMMAND EXECUTION SUMMARY")
        logger.info("=" * 80)
        logger.info("Successful: %s", len(successful_devices))
        logger.info("Failed: %s", len(failed_devices))

        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": 100,
                "total": 100,
                "status": "Command execution completed",
            },
        )

        logger.info("=" * 80)
        logger.info("RUN COMMANDS COMPLETED")
        logger.info("=" * 80)

        return {
            "success": len(failed_devices) == 0,
            "message": f"Executed commands on {len(successful_devices)} of {total_devices} devices",
            "command_template": command_template_name,
            "total": total_devices,
            "success_count": len(successful_devices),
            "failed_count": len(failed_devices),
            "successful_devices": successful_devices,
            "failed_devices": failed_devices,
            "credential_info": credential_info,
        }

    except Exception as e:
        logger.error("=" * 80)
        logger.error("RUN COMMANDS EXECUTOR FAILED")
        logger.error("=" * 80)
        logger.error("Exception: %s", e, exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "credential_info": credential_info,
        }
