"""
Agent deployment tasks for deploying agent configurations to Git repository.

This module provides Celery tasks for deploying Telegraf/InfluxDB/Grafana agent
configurations by rendering templates and committing to Git repositories.
"""

from celery import shared_task
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


@shared_task(name="tasks.deploy_agent_task", bind=True)
def deploy_agent_task(
    self,
    template_id: int,
    custom_variables: Optional[Dict[str, Any]] = None,
    agent_id: Optional[str] = None,
    path: Optional[str] = None,
    inventory_id: Optional[int] = None,
    activate_after_deploy: bool = True,
) -> Dict[str, Any]:
    """
    Deploy agent configuration to Git repository.

    This Celery task orchestrates the agent deployment workflow:
    1. Load template and agent configuration
    2. Render template with variables and inventory context
    3. Clone/open Git repository
    4. Write rendered configuration to file
    5. Commit and push changes to Git
    6. Optionally activate agent (git pull + docker restart)

    Args:
        self: Task instance (for updating state)
        template_id: ID of template to render
        custom_variables: User-provided custom variables (optional)
        agent_id: Agent ID for deployment configuration
        path: Deployment file path (optional, uses template default if not provided)
        inventory_id: Inventory ID for template rendering (optional, uses template default)
        activate_after_deploy: Whether to activate agent after deployment (default: True)

    Returns:
        dict: Deployment results with success status, message, commit info
    """
    from services.agents.deployment_service import AgentDeploymentService

    logger.info("=" * 80)
    logger.info("AGENT DEPLOYMENT TASK STARTED")
    logger.info("=" * 80)

    # Delegate to shared service
    deployment_service = AgentDeploymentService()
    return deployment_service.deploy(
        template_id=template_id,
        agent_id=agent_id,
        custom_variables=custom_variables,
        path=path,
        inventory_id=inventory_id,
        activate_after_deploy=activate_after_deploy,
        task_context=self,
        username="celery_task",
    )
