"""
Agent deployment tasks for deploying agent configurations to Git repository.

This module provides Celery tasks for deploying Telegraf/InfluxDB/Grafana agent
configurations by rendering templates and committing to Git repositories.

Supports both single-template (legacy) and multi-template deployments.
"""

from celery import shared_task
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


@shared_task(name="tasks.deploy_agent_task", bind=True)
def deploy_agent_task(
    self,
    template_id: Optional[int] = None,
    custom_variables: Optional[Dict[str, Any]] = None,
    agent_id: Optional[str] = None,
    path: Optional[str] = None,
    inventory_id: Optional[int] = None,
    activate_after_deploy: bool = True,
    template_entries: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Deploy agent configuration to Git repository.

    Supports two modes:
    - Single-template (legacy): Uses template_id, custom_variables, path, inventory_id
    - Multi-template: Uses template_entries list, each with template_id, inventory_id, path, custom_variables

    Args:
        self: Task instance (for updating state)
        template_id: ID of template to render (legacy single-template mode)
        custom_variables: User-provided custom variables (legacy)
        agent_id: Agent ID for deployment configuration
        path: Deployment file path (legacy)
        inventory_id: Inventory ID for template rendering (legacy)
        activate_after_deploy: Whether to activate agent after deployment
        template_entries: List of template entry dicts for multi-template deployment

    Returns:
        dict: Deployment results with success status, message, commit info
    """
    from services.agents.deployment_service import AgentDeploymentService

    logger.info("=" * 80)
    logger.info("AGENT DEPLOYMENT TASK STARTED")
    logger.info("=" * 80)

    deployment_service = AgentDeploymentService()

    # Route to multi-template or single-template deployment
    if template_entries:
        logger.info("Multi-template deployment: %s entries", len(template_entries))
        return deployment_service.deploy_multi(
            template_entries=template_entries,
            agent_id=agent_id,
            activate_after_deploy=activate_after_deploy,
            task_context=self,
            username="celery_task",
        )
    else:
        logger.info("Single-template deployment: template_id=%s", template_id)
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
