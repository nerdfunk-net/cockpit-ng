"""
Agent deployment router for Telegraf/InfluxDB/Grafana agent operations.
"""

from __future__ import annotations
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agents/deploy", tags=["agents"])


class DryRunRequest(BaseModel):
    """Request model for agent deployment dry run."""

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
        None, alias="inventoryId", description="Inventory ID selected by user (overrides template's inventory_id)"
    )

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
        from template_manager import template_manager
        from services.agents.template_render_service import agent_template_render_service

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
        logger.error(f"Error in agent deployment dry run: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform dry run: {str(e)}",
        )


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
) -> DeployToGitResponse:
    """
    Deploy agent configuration to git repository.

    This endpoint:
    1. Renders the template using the advanced rendering logic
    2. Writes the rendered content to the git repository
    3. Commits with message: agent name + template name + date
    4. Pushes to remote git repository
    5. Returns success message with commit SHA
    """
    try:
        from template_manager import template_manager
        from services.agents.template_render_service import agent_template_render_service
        from services.settings.git.service import git_service
        from repositories.settings.git_repository_repository import GitRepositoryRepository
        from datetime import datetime
        import os

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

        # Fetch agent settings and find the specific agent
        from repositories.settings.settings_repository import AgentsSettingRepository

        agents_repo = AgentsSettingRepository()
        agents_settings = agents_repo.get_settings()

        if not agents_settings or not agents_settings.agents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No agents configured. Please configure agents in agent settings.",
            )

        # Find the specific agent by ID
        agent = None
        for a in agents_settings.agents:
            if a.get("id") == request.agentId:
                agent = a
                break

        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent with ID {request.agentId} not found in agent settings.",
            )

        # Get the git repository ID from the agent configuration
        agent_git_repo_id = agent.get("git_repository_id")
        if not agent_git_repo_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No git repository configured for agent '{agent.get('name', request.agentId)}'. Please configure a git repository for this agent.",
            )

        # Fetch the git repository configuration
        git_repo_repo = GitRepositoryRepository()
        git_repository = git_repo_repo.get_by_id(agent_git_repo_id)

        if not git_repository:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Git repository with ID {agent_git_repo_id} not found",
            )

        # Convert SQLAlchemy model to dict for git_service
        repo_dict = {
            "id": git_repository.id,
            "name": git_repository.name,
            "url": git_repository.url,
            "branch": git_repository.branch,
            "auth_type": git_repository.auth_type,
            "credential_name": git_repository.credential_name,
            "path": git_repository.path,
            "verify_ssl": git_repository.verify_ssl,
            "git_author_name": git_repository.git_author_name,
            "git_author_email": git_repository.git_author_email,
        }

        # Use user-selected inventory if provided, otherwise fall back to template's inventory
        inventory_id = request.inventoryId or template.get("inventory_id")

        # Render the template with stored variables and username
        render_result = await agent_template_render_service.render_agent_template(
            template_content=template_content,
            inventory_id=inventory_id,
            pass_snmp_mapping=template.get("pass_snmp_mapping", False),
            user_variables=request.variables,
            path=request.path,
            stored_variables=template.get("variables"),
            username=current_user.get("username"),
        )

        # Determine file path
        file_path = request.path or template.get("file_path")
        if not file_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file path provided. Please specify a deployment path or configure file_path in the template.",
            )

        # Open or clone the repository
        repo = git_service.open_or_clone(repo_dict)
        repo_path = git_service.get_repo_path(repo_dict)

        # Write the rendered content to the file
        full_file_path = os.path.join(repo_path, file_path.lstrip("/"))
        os.makedirs(os.path.dirname(full_file_path), exist_ok=True)

        with open(full_file_path, "w", encoding="utf-8") as f:
            f.write(render_result.rendered_content)

        logger.info(f"Wrote rendered template to {full_file_path}")

        # Get agent name (agent was already found earlier)
        agent_name = agent.get("name", request.agentId)

        # Prepare commit message
        current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        commit_message = f"Deploy {agent_name} - {template['name']} - {current_date}"

        # Commit and push
        result = git_service.commit_and_push(
            repository=repo_dict,
            message=commit_message,
            files=[file_path.lstrip("/")],
            repo=repo,
        )

        if result.success:
            return DeployToGitResponse(
                success=True,
                message=f"Successfully deployed configuration to git repository '{git_repository.name}'",
                commit_sha=result.commit_sha,
                file_path=file_path,
            )
        else:
            return DeployToGitResponse(
                success=False,
                message=f"Failed to commit/push to git: {result.message}",
                commit_sha=None,
                file_path=file_path,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in agent git deployment: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deploy to git: {str(e)}",
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
