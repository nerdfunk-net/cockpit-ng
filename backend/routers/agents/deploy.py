"""
Agent deployment router for Telegraf/InfluxDB/Grafana agent operations.
"""

from __future__ import annotations
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import (
    get_agent_deployment_service,
    get_agent_template_render_service,
)
from pydantic import BaseModel, ConfigDict, Field

from core.safe_http_errors import raise_internal_server_error

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agents/deploy", tags=["agents"])


class DryRunRequest(BaseModel):
    """Request model for agent deployment dry run."""

    model_config = ConfigDict(populate_by_name=True)

    templateId: int = Field(
        ..., alias="templateId", description="Template ID to render"
    )
    deviceIds: List[str] = Field(
        ..., alias="deviceIds", description="List of device UUIDs from inventory"
    )
    variables: dict = Field(
        default_factory=dict, description="User-provided custom variables"
    )
    agentId: str = Field(
        ..., alias="agentId", description="Agent ID for deployment configuration"
    )
    path: str | None = Field(None, description="Optional deployment path")
    template_content: str | None = Field(
        None, description="Optional edited template content (overrides stored content)"
    )
    inventoryId: int | None = Field(
        None,
        alias="inventoryId",
        description="Inventory ID selected by user (overrides template's inventory_id)",
    )


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
    agent_template_render_service=Depends(get_agent_template_render_service),
) -> DryRunResponse:
    """
    Perform a dry run of agent deployment by rendering the template.

    This endpoint renders the template with the full inventory context
    and returns a single rendered configuration that can be used for
    Telegraf/InfluxDB/Grafana agent deployment.
    """
    try:
        import service_factory

        template_manager = service_factory.build_template_service()

        # Fetch the template
        template = template_manager.get_template(request.templateId)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {request.templateId} not found",
            )

        # Use edited content from request if provided, otherwise load from DB
        if request.template_content:
            template_content = request.template_content
        else:
            template_content = template_manager.get_template_content(request.templateId)
            if not template_content:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Template content for ID {request.templateId} not found",
                )

        # Use user-selected inventory if provided, otherwise fall back to template's inventory
        inventory_id = request.inventoryId or template.get("inventory_id")

        # Use the rendering service with stored variables and username
        render_result = await agent_template_render_service.render_agent_template(
            template_content=template_content,
            inventory_id=inventory_id,
            pass_snmp_mapping=template.get("pass_snmp_mapping", False),
            user_variables=request.variables,
            path=request.path,
            stored_variables=template.get("variables"),
            username=current_user.get("username"),
        )

        # Return a single result with the rendered content
        results = [
            DryRunResultItem(
                deviceId="all",
                deviceName="Agent Config",
                renderedConfig=render_result.rendered_content,
                success=True,
                error=None,
            )
        ]

        return DryRunResponse(results=results)

    except ValueError as e:
        # Rendering errors (undefined variables, syntax errors)
        return DryRunResponse(
            results=[
                DryRunResultItem(
                    deviceId="all",
                    deviceName="Error",
                    renderedConfig="",
                    success=False,
                    error=str(e),
                )
            ]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to perform dry run: ", e)


class DeployToGitResponse(BaseModel):
    """Response model for deploy to git operation."""

    success: bool
    message: str
    commit_sha: str | None = None
    file_path: str | None = None


@router.post("/to-git", response_model=DeployToGitResponse)
async def agent_deploy_to_git(
    request: DryRunRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
    deployment_service=Depends(get_agent_deployment_service),
) -> DeployToGitResponse:
    """
    Deploy agent configuration to git repository.

    This endpoint:
    1. Renders the template using the advanced rendering logic
    2. Writes the rendered content to the git repository
    3. Commits with message: agent name + template name + date
    4. Pushes to remote git repository
    5. Returns success message with commit SHA

    HTTP activation (git pull / docker restart on the agent) is not run here;
    use the Celery deployment task if activation is required.
    """
    try:
        result = await deployment_service.deploy(
            template_id=request.templateId,
            agent_id=request.agentId,
            custom_variables=request.variables,
            path=request.path,
            inventory_id=request.inventoryId,
            activate_after_deploy=False,
            username=current_user.get("username") or "system",
        )

        if result.get("success"):
            return DeployToGitResponse(
                success=True,
                message=result.get(
                    "message",
                    "Successfully deployed configuration to git repository",
                ),
                commit_sha=result.get("commit_sha"),
                file_path=result.get("file_path"),
            )

        err = result.get("error") or "Deployment failed"
        el = err.lower()
        if "not found" in el:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err)
        if (
            "no agents configured" in el
            or "agent_id" in el
            or "no git repository configured" in el
            or "no file path" in el
        ):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

        return DeployToGitResponse(
            success=False,
            message=err,
            commit_sha=None,
            file_path=result.get("file_path"),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to deploy to git", e)


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
