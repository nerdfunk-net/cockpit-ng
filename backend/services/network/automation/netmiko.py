"""
Netmiko service for executing commands on network devices.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

from services.network.automation.connection import connect_and_execute
from services.network.automation.session_registry import SessionRegistry

logger = logging.getLogger(__name__)


def _make_template_result(
    *,
    device_id: str,
    device_name: str,
    success: bool,
    rendered_content: Optional[str] = None,
    output: Optional[str] = None,
    error: Optional[str] = None,
):
    """Construct a TemplateExecutionResult dict; import kept local to avoid circular deps."""
    from models.netmiko import TemplateExecutionResult

    return TemplateExecutionResult(
        device_id=device_id,
        device_name=device_name,
        success=success,
        rendered_content=rendered_content,
        output=output,
        error=error,
    )


class NetmikoService:
    """Service for handling Netmiko command execution."""

    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=10)
        self._registry = SessionRegistry()

    # ------------------------------------------------------------------
    # Session management (delegate to SessionRegistry)
    # ------------------------------------------------------------------

    def register_session(self, session_id: str) -> None:
        self._registry.register(session_id)
        logger.info("Session %s registered", session_id)

    def unregister_session(self, session_id: str) -> None:
        self._registry.unregister(session_id)
        logger.info("Session %s unregistered", session_id)

    def is_session_cancelled(self, session_id: str) -> bool:
        return self._registry.is_cancelled(session_id)

    def cancel_session(self, session_id: str) -> None:
        self._registry.cancel(session_id)
        logger.info("Session %s marked for cancellation", session_id)

    # ------------------------------------------------------------------
    # Low-level connection (delegates to connection.connect_and_execute)
    # ------------------------------------------------------------------

    def _connect_and_execute(
        self,
        device_ip: str,
        device_type: str,
        username: str,
        password: str,
        commands: List[str],
        enable_mode: bool = False,
        write_config: bool = False,
        use_textfsm: bool = False,
        session_id: Optional[str] = None,
        privileged: bool = False,
    ) -> Dict[str, Any]:
        """Thin wrapper so existing callers (command_executor, config) stay unchanged."""
        return connect_and_execute(
            device_ip=device_ip,
            device_type=device_type,
            username=username,
            password=password,
            commands=commands,
            registry=self._registry,
            enable_mode=enable_mode,
            write_config=write_config,
            use_textfsm=use_textfsm,
            session_id=session_id,
            privileged=privileged,
        )

    # ------------------------------------------------------------------
    # High-level orchestration
    # ------------------------------------------------------------------

    async def execute_commands_on_device(
        self,
        device_ip: str,
        platform: str,
        username: str,
        password: str,
        commands: List[str],
        enable_mode: bool = False,
        write_config: bool = False,
        use_textfsm: bool = False,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute commands on a single device."""
        device_type = self._map_platform_to_device_type(platform)

        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            self.executor,
            self._connect_and_execute,
            device_ip,
            device_type,
            username,
            password,
            commands,
            enable_mode,
            write_config,
            use_textfsm,
            session_id,
        )

        return result

    async def execute_commands(
        self,
        devices: List[Dict[str, str]],
        commands: List[str],
        username: str,
        password: str,
        enable_mode: bool = False,
        write_config: bool = False,
        use_textfsm: bool = False,
        session_id: Optional[str] = None,
    ) -> tuple[str, List[Dict[str, Any]]]:
        """Execute commands on multiple devices concurrently."""
        if not session_id:
            session_id = str(uuid.uuid4())

        logger.info(
            "Starting command execution on %s devices (session: %s). Commands: %s, Enable mode: %s, Write config: %s, Use TextFSM: %s",
            len(devices),
            session_id,
            len(commands),
            enable_mode,
            write_config,
            use_textfsm,
        )

        tasks = []
        loop = asyncio.get_running_loop()

        for device in devices:
            device_ip = device.get("ip") or device.get("primary_ip4", "")
            device_type = self._map_platform_to_device_type(
                device.get("platform", "cisco_ios")
            )

            if not device_ip:
                logger.warning(
                    "Skipping device without IP: %s", device.get("name", "Unknown")
                )
                continue

            task = loop.run_in_executor(
                self.executor,
                self._connect_and_execute,
                device_ip,
                device_type,
                username,
                password,
                commands,
                enable_mode,
                write_config,
                use_textfsm,
                session_id,
            )
            tasks.append(task)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error("Task failed with exception: %s", result)
                processed_results.append(
                    {
                        "device": devices[i].get("ip")
                        or devices[i].get("primary_ip4", "Unknown"),
                        "success": False,
                        "output": "",
                        "error": str(result),
                    }
                )
            else:
                processed_results.append(result)

        success_count = sum(1 for r in processed_results if r["success"])
        cancelled_count = sum(1 for r in processed_results if r.get("cancelled", False))
        logger.info(
            "Command execution completed (session: %s). Successful: %s/%s, Cancelled: %s",
            session_id,
            success_count,
            len(processed_results),
            cancelled_count,
        )

        if self._registry.is_cancelled(session_id):
            self._registry.unregister(session_id)
            logger.info("Cleaned up cancelled session: %s", session_id)

        return session_id, processed_results

    def resolve_credentials(
        self,
        credential_id,
        current_username: str,
        manual_username,
        manual_password,
    ) -> tuple:
        """
        Resolve (username, password) from a stored credential or manual entry.

        Raises HTTPException on any resolution failure so the router
        can call this without try/except.
        """
        from fastapi import HTTPException, status

        if credential_id is None:
            if not manual_username or not manual_password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username and password are required when not using stored credentials",
                )
            return manual_username, manual_password

        import service_factory

        cred_mgr = service_factory.build_credentials_service()

        general_creds = cred_mgr.list_credentials(
            include_expired=False, source="general"
        )
        private_creds = cred_mgr.list_credentials(
            include_expired=False, source="private"
        )
        user_private = [c for c in private_creds if c.get("owner") == current_username]

        credential = next(
            (c for c in general_creds + user_private if c["id"] == credential_id), None
        )

        if not credential:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Credential with ID {credential_id} not found or not accessible",
            )
        if credential["type"] != "ssh":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Credential must be of type 'ssh', got '{credential['type']}'",
            )

        password = cred_mgr.get_decrypted_password(credential_id)
        if not password:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to decrypt credential password",
            )

        return credential["username"], password

    async def execute_template_on_devices(
        self,
        *,
        device_ids: List[str],
        template_content: str,
        session_id: str,
        username,
        password,
        dry_run: bool,
        enable_mode: bool,
        write_config: bool,
        use_nautobot_context: bool,
        user_variables,
        pre_run_command,
        template_credential_id,
        nautobot_service,
        device_query_service,
    ) -> tuple:
        """
        Execute a rendered Jinja2 template across a list of Nautobot device IDs.

        Returns (results, counters) where counters has keys:
            rendered_successfully, executed_successfully, failed, cancelled
        """
        from jinja2 import Template, TemplateError, UndefinedError

        _DEVICE_DETAILS_QUERY = """
        query DeviceDetails($deviceId: ID!) {
            device(id: $deviceId) {
                id
                name
                primary_ip4 {
                    address
                    host
                }
                platform {
                    name
                }
            }
        }
        """

        results = []
        rendered_count = 0
        executed_count = 0
        failed_count = 0
        cancelled_count = 0

        for device_id in device_ids:
            if self.is_session_cancelled(session_id):
                logger.info("Session %s cancelled, stopping execution", session_id)
                cancelled_count += 1
                results.append(
                    _make_template_result(
                        device_id=device_id,
                        device_name="Unknown",
                        success=False,
                        error="Execution cancelled by user",
                    )
                )
                continue

            try:
                nautobot_response = await nautobot_service.graphql_query(
                    _DEVICE_DETAILS_QUERY, {"deviceId": device_id}
                )

                if (
                    not nautobot_response
                    or "data" not in nautobot_response
                    or not nautobot_response["data"].get("device")
                ):
                    failed_count += 1
                    results.append(
                        _make_template_result(
                            device_id=device_id,
                            device_name="Unknown",
                            success=False,
                            error=f"Device {device_id} not found in Nautobot",
                        )
                    )
                    continue

                device = nautobot_response["data"]["device"]
                device_name = device.get("name", "Unknown")

                try:
                    context: Dict[str, Any] = {"pre_run": {"raw": "", "parsed": []}}
                    warnings: List[str] = []

                    if user_variables:
                        context.update(user_variables)

                    needs_device_data = use_nautobot_context or (
                        pre_run_command and pre_run_command.strip()
                    )

                    if needs_device_data:
                        try:
                            device_data = await device_query_service.get_device_details(
                                device_id=device_id, use_cache=True
                            )
                            context["device_details"] = device_data
                            context["devices"] = [
                                {
                                    "id": device_id,
                                    "name": device_data.get("name", ""),
                                    "primary_ip4": (
                                        device_data.get("primary_ip4", {}).get(
                                            "address", ""
                                        )
                                        if isinstance(
                                            device_data.get("primary_ip4"), dict
                                        )
                                        else device_data.get("primary_ip4", "")
                                    ),
                                    "primary_ip6": (
                                        device_data.get("primary_ip6", {}).get(
                                            "address", ""
                                        )
                                        if isinstance(
                                            device_data.get("primary_ip6"), dict
                                        )
                                        else device_data.get("primary_ip6", "")
                                    ),
                                }
                            ]
                        except Exception as e:
                            error_msg = (
                                f"Failed to fetch Nautobot device data: {str(e)}"
                            )
                            logger.error(error_msg)
                            if pre_run_command and pre_run_command.strip():
                                raise ValueError(error_msg)
                            warnings.append(error_msg)

                    if pre_run_command and pre_run_command.strip():
                        if not template_credential_id:
                            raise ValueError(
                                "Template has pre_run_command but no credential_id configured"
                            )
                        try:
                            from services.network.automation.render import (
                                render_service,
                            )

                            pre_run_result = (
                                await render_service._execute_pre_run_command(
                                    device_id=device_id,
                                    command=pre_run_command.strip(),
                                    credential_id=template_credential_id,
                                    nautobot_device=context.get("device_details"),
                                )
                            )
                            context["pre_run"] = {
                                "raw": pre_run_result.get("raw_output", ""),
                                "parsed": pre_run_result.get("parsed_output", []),
                            }
                            if pre_run_result.get("parse_error"):
                                warnings.append(
                                    f"TextFSM parsing not available: {pre_run_result['parse_error']}"
                                )
                        except Exception as e:
                            error_msg = f"Failed to execute pre-run command: {str(e)}"
                            logger.error(error_msg)
                            warnings.append(error_msg)

                    rendered = Template(template_content).render(**context)
                    rendered_count += 1

                    if warnings:
                        logger.warning(
                            "Template rendering warnings for %s: %s",
                            device_name,
                            warnings,
                        )

                except UndefinedError as e:
                    available_vars = list(context.keys())
                    error_msg = f"Undefined variable in template: {str(e)}. Available variables: {', '.join(available_vars)}"
                    logger.error(error_msg)
                    failed_count += 1
                    results.append(
                        _make_template_result(
                            device_id=device_id,
                            device_name=device_name,
                            success=False,
                            error=error_msg,
                        )
                    )
                    continue
                except TemplateError as e:
                    error_msg = f"Template syntax error: {str(e)}"
                    logger.error(error_msg)
                    failed_count += 1
                    results.append(
                        _make_template_result(
                            device_id=device_id,
                            device_name=device_name,
                            success=False,
                            error=error_msg,
                        )
                    )
                    continue
                except Exception as render_error:
                    failed_count += 1
                    results.append(
                        _make_template_result(
                            device_id=device_id,
                            device_name=device_name,
                            success=False,
                            error=f"Template rendering failed: {str(render_error)}",
                        )
                    )
                    continue

                if dry_run:
                    results.append(
                        _make_template_result(
                            device_id=device_id,
                            device_name=device_name,
                            success=True,
                            rendered_content=rendered,
                        )
                    )
                    continue

                try:
                    if self.is_session_cancelled(session_id):
                        cancelled_count += 1
                        results.append(
                            _make_template_result(
                                device_id=device_id,
                                device_name=device_name,
                                success=False,
                                rendered_content=rendered,
                                error="Execution cancelled by user",
                            )
                        )
                        continue

                    device_ip = device.get("primary_ip4", {}).get("host")
                    if not device_ip:
                        failed_count += 1
                        results.append(
                            _make_template_result(
                                device_id=device_id,
                                device_name=device_name,
                                success=False,
                                rendered_content=rendered,
                                error="Device has no primary IP address",
                            )
                        )
                        continue

                    platform = device.get("platform", {}).get("name", "cisco_ios")
                    commands = [
                        line.strip() for line in rendered.split("\n") if line.strip()
                    ]

                    execution_result = await self.execute_commands_on_device(
                        device_ip=device_ip,
                        platform=platform,
                        username=username,
                        password=password,
                        commands=commands,
                        enable_mode=enable_mode,
                        write_config=write_config,
                        session_id=session_id,
                    )

                    if execution_result["success"]:
                        executed_count += 1
                        results.append(
                            _make_template_result(
                                device_id=device_id,
                                device_name=device_name,
                                success=True,
                                rendered_content=rendered,
                                output=execution_result["output"],
                            )
                        )
                    else:
                        failed_count += 1
                        results.append(
                            _make_template_result(
                                device_id=device_id,
                                device_name=device_name,
                                success=False,
                                rendered_content=rendered,
                                error=execution_result.get("error", "Execution failed"),
                            )
                        )

                except Exception as exec_error:
                    failed_count += 1
                    results.append(
                        _make_template_result(
                            device_id=device_id,
                            device_name=device_name,
                            success=False,
                            rendered_content=rendered,
                            error=f"Execution failed: {str(exec_error)}",
                        )
                    )

            except Exception as e:
                failed_count += 1
                results.append(
                    _make_template_result(
                        device_id=device_id,
                        device_name="Unknown",
                        success=False,
                        error=f"Unexpected error: {str(e)}",
                    )
                )

        counters = {
            "rendered_successfully": rendered_count,
            "executed_successfully": executed_count,
            "failed": failed_count,
            "cancelled": cancelled_count,
        }
        return results, counters

    def _map_platform_to_device_type(self, platform: str) -> str:
        """Map Nautobot platform names to Netmiko device types."""
        platform_lower = platform.lower()

        mapping = {
            "ios": "cisco_ios",
            "cisco_ios": "cisco_ios",
            "nxos": "cisco_nxos",
            "cisco_nxos": "cisco_nxos",
            "asa": "cisco_asa",
            "cisco_asa": "cisco_asa",
            "xe": "cisco_xe",
            "cisco_xe": "cisco_xe",
            "xr": "cisco_xr",
            "cisco_xr": "cisco_xr",
            "junos": "juniper_junos",
            "juniper": "juniper_junos",
            "juniper_junos": "juniper_junos",
            "arista": "arista_eos",
            "eos": "arista_eos",
            "arista_eos": "arista_eos",
            "hp": "hp_comware",
            "comware": "hp_comware",
            "hp_comware": "hp_comware",
        }

        for key, value in mapping.items():
            if key in platform_lower:
                return value

        logger.warning(
            "Unknown platform '%s', defaulting to 'cisco_ios'. You may need to adjust this mapping.",
            platform,
        )
        return "cisco_ios"
