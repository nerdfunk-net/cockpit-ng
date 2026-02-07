"""
Agent deployment router for Telegraf/InfluxDB/Grafana agent operations.
"""

from __future__ import annotations
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.templates import (
    TemplateRenderAgentRequest,
    TemplateRenderAgentResponse,
)
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agents/deploy", tags=["agents"])


class DryRunRequest(BaseModel):
    """Request model for agent deployment dry run."""

    templateId: int = Field(..., alias="templateId", description="Template ID to render")
    deviceIds: List[str] = Field(..., alias="deviceIds", description="List of device UUIDs from inventory")
    variables: dict = Field(default_factory=dict, description="User-provided custom variables")
    passSnmpMapping: bool = Field(False, alias="passSnmpMapping", description="Whether to include SNMP mapping")
    agentId: str = Field(..., alias="agentId", description="Agent ID for deployment configuration")
    path: str | None = Field(None, description="Optional deployment path")

    class Config:
        populate_by_name = True


class DryRunResultItem(BaseModel):
    """Individual dry run result for a device."""

    deviceId: str
    deviceName: str
    renderedConfig: str
    success: bool
    error: str | None = None


class DryRunResponse(BaseModel):
    """Response model for dry run operation."""

    results: List[DryRunResultItem]


@router.post("/dry-run", response_model=DryRunResponse)
async def agent_deploy_dry_run(
    request: DryRunRequest,
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> DryRunResponse:
    """
    Perform a dry run of agent deployment by rendering the template.

    This endpoint renders the template with the full inventory context
    and returns a single rendered configuration that can be used for
    Telegraf/InfluxDB/Grafana agent deployment.
    """
    try:
        from services.nautobot import nautobot_service
        from services.checkmk.config import config_service
        from template_manager import template_manager
        from jinja2 import Template, TemplateError, UndefinedError
        import re

        # Fetch the template
        template = template_manager.get_template(request.templateId)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {request.templateId} not found",
            )

        template_content = template_manager.get_template_content(request.templateId)
        if not template_content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template content for ID {request.templateId} not found",
            )

        # Build devices list
        devices = []
        device_name_map = {}
        for device_id in request.deviceIds:
            devices.append({"id": device_id})

        # Fetch Nautobot data for each device
        device_details = {}
        warnings = []

        # GraphQL query for device details
        query = """
        query DeviceDetails($deviceId: ID!) {
            device(id: $deviceId) {
                id
                name
                hostname: name
                asset_tag
                serial
                position
                face
                config_context
                local_config_context_data
                _custom_field_data
                primary_ip4 {
                    id
                    address
                    description
                    ip_version
                    host
                    mask_length
                    dns_name
                    status {
                        id
                        name
                    }
                    parent {
                        id
                        prefix
                    }
                }
                role {
                    id
                    name
                }
                device_type {
                    id
                    model
                    manufacturer {
                        id
                        name
                    }
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
                location {
                    id
                    name
                    description
                    parent {
                        id
                        name
                    }
                }
                status {
                    id
                    name
                }
                interfaces {
                    id
                    name
                    type
                    enabled
                    mtu
                    mac_address
                    description
                    status {
                        id
                        name
                    }
                    ip_addresses {
                        id
                        address
                        ip_version
                        status {
                            id
                            name
                        }
                    }
                    connected_interface {
                        id
                        name
                        device {
                            id
                            name
                        }
                    }
                    cable {
                        id
                        status {
                            id
                            name
                        }
                    }
                    tagged_vlans {
                        id
                        name
                        vid
                    }
                    untagged_vlan {
                        id
                        name
                        vid
                    }
                }
                console_ports {
                    id
                    name
                    type
                    description
                }
                console_server_ports {
                    id
                    name
                    type
                    description
                }
                power_ports {
                    id
                    name
                    type
                    description
                }
                power_outlets {
                    id
                    name
                    type
                    description
                }
                secrets_group {
                    id
                    name
                }
                tags {
                    id
                    name
                    color
                }
            }
        }
        """

        for device_id in request.deviceIds:
            try:
                variables = {"deviceId": device_id}
                response = await nautobot_service.graphql_query(query, variables)

                if (
                    not response
                    or "data" not in response
                    or not response["data"].get("device")
                ):
                    warnings.append(f"Device {device_id} not found in Nautobot")
                    continue

                device_data = response["data"]["device"]
                device_details[device_id] = device_data
                device_name_map[device_id] = device_data.get("name", device_id)
            except Exception as e:
                error_msg = f"Failed to fetch Nautobot data for device {device_id}: {str(e)}"
                logger.error(error_msg)
                warnings.append(error_msg)

        # Load SNMP mapping if requested
        snmp_mapping = {}
        if request.passSnmpMapping:
            try:
                snmp_mapping = config_service.load_snmp_mapping()
                logger.info(f"Loaded SNMP mapping with {len(snmp_mapping)} entries")
            except Exception as e:
                error_msg = f"Failed to load SNMP mapping: {str(e)}"
                logger.error(error_msg)
                warnings.append(error_msg)

        # Build template context
        context = {
            "devices": devices,
            "device_details": device_details,
            "snmp_mapping": snmp_mapping,
            "agent_id": request.agentId,
            "path": request.path,
        }

        # Add user variables to context
        if request.variables:
            context.update(request.variables)

        # Render the template
        try:
            jinja_template = Template(template_content)
            rendered_content = jinja_template.render(**context)

            # Return a single result with the rendered content
            # Since this is for agent deployment, we return one configuration
            # that references all devices
            results = [
                DryRunResultItem(
                    deviceId="all",
                    deviceName=f"Agent Config ({len(request.deviceIds)} devices)",
                    renderedConfig=rendered_content,
                    success=True,
                    error=None,
                )
            ]

            return DryRunResponse(results=results)

        except UndefinedError as e:
            # Provide detailed error with available variables
            available_vars = list(context.keys())
            error_msg = f"Undefined variable in template: {str(e)}. Available variables: {', '.join(available_vars)}"
            return DryRunResponse(
                results=[
                    DryRunResultItem(
                        deviceId="all",
                        deviceName="Error",
                        renderedConfig="",
                        success=False,
                        error=error_msg,
                    )
                ]
            )
        except TemplateError as e:
            error_msg = f"Template syntax error: {str(e)}"
            return DryRunResponse(
                results=[
                    DryRunResultItem(
                        deviceId="all",
                        deviceName="Error",
                        renderedConfig="",
                        success=False,
                        error=error_msg,
                    )
                ]
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in agent deployment dry run: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform dry run: {str(e)}",
        )


@router.post("/to-git")
async def agent_deploy_to_git(
    request: DryRunRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
):
    """
    Deploy agent configuration to git repository.

    This endpoint renders the template and commits the result to the
    configured git repository.
    """
    # TODO: Implement git deployment logic
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Git deployment for agents is not yet implemented",
    )


@router.post("/activate")
async def agent_deploy_activate(
    request: DryRunRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
):
    """
    Deploy and activate agent configuration via Cockpit Agent.

    This endpoint renders the template and deploys it to devices
    using the Cockpit Agent.
    """
    # TODO: Implement activation logic via cockpit agent
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Agent activation is not yet implemented",
    )
