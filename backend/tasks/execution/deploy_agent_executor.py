"""
Deploy agent configurations executor.
Renders an agent template and commits the result to a Git repository.

Delegates to AgentDeploymentService - the shared deployment logic for both
direct API calls and scheduled job executions.
"""

import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def execute_deploy_agent(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute deploy_agent job from a scheduled job template.

    Loads the agent template, renders it with variables, and commits
    the rendered configuration to the agent's Git repository.

    Args:
        schedule_id: Job schedule ID
        credential_id: Not used for deploy_agent (no device credentials needed)
        job_parameters: Additional job parameters
        target_devices: Not used for deploy_agent
        task_context: Celery task context for progress updates
        template: Job template configuration dict with deploy_agent fields
        job_run_id: Job run ID for result tracking

    Returns:
        dict: Deployment results with success status, commit info, etc.
    """
    try:
        logger.info("=" * 80)
        logger.info("DEPLOY AGENT EXECUTOR STARTED")
        logger.info("=" * 80)
        logger.info("Schedule ID: %s", schedule_id)
        logger.info("Job run ID: %s", job_run_id)

        # Import required managers
        import job_template_manager
        import jobs_manager

        # Resolve template if not provided directly
        if not template and schedule_id:
            schedule = jobs_manager.get_job_schedule(schedule_id)
            if schedule:
                template_id = schedule.get("job_template_id")
                if template_id:
                    template = job_template_manager.get_job_template(template_id)

        if not template:
            return {"success": False, "error": "No job template found for deploy_agent execution"}

        # Extract deploy_agent fields from the job template
        deploy_template_id = template.get("deploy_template_id")
        deploy_agent_id = template.get("deploy_agent_id")
        deploy_path = template.get("deploy_path")
        deploy_custom_variables = template.get("deploy_custom_variables")
        activate_after_deploy = template.get("activate_after_deploy", False)

        # Handle deploy_custom_variables stored as JSON string
        if isinstance(deploy_custom_variables, str):
            try:
                deploy_custom_variables = json.loads(deploy_custom_variables)
            except (json.JSONDecodeError, TypeError):
                deploy_custom_variables = None

        logger.info("Deploy template ID: %s", deploy_template_id)
        logger.info("Deploy agent ID: %s", deploy_agent_id)
        logger.info("Deploy path: %s", deploy_path)
        logger.info("Activate after deploy: %s", activate_after_deploy)
        logger.info(
            "Deploy custom variables: %s",
            list(deploy_custom_variables.keys()) if deploy_custom_variables else "none",
        )

        if not deploy_template_id:
            return {"success": False, "error": "No deploy_template_id configured in job template"}
        if not deploy_agent_id:
            return {"success": False, "error": "No deploy_agent_id configured in job template"}

        # Resolve inventory_id from the job template's inventory_name
        inventory_id = None
        inventory_name = template.get("inventory_name")
        if inventory_name and template.get("inventory_source") == "inventory":
            import inventory_manager as inv_mgr

            inv = inv_mgr.inventory_manager.get_inventory_by_name(
                inventory_name, "celery_scheduler"
            )
            if inv:
                inventory_id = inv.get("id")
                logger.info("Resolved inventory '%s' to ID %s", inventory_name, inventory_id)

        # Delegate to shared deployment service
        from services.agents.deployment_service import AgentDeploymentService

        deployment_service = AgentDeploymentService()
        return deployment_service.deploy(
            template_id=deploy_template_id,
            agent_id=deploy_agent_id,
            custom_variables=deploy_custom_variables,
            path=deploy_path,
            inventory_id=inventory_id,
            activate_after_deploy=activate_after_deploy,
            task_context=task_context,
            username="celery_scheduler",
        )

    except Exception as e:
        logger.error("=" * 80)
        logger.error("DEPLOY AGENT EXECUTOR FAILED WITH EXCEPTION")
        logger.error("=" * 80)
        logger.error("Exception: %s", e, exc_info=True)
        return {
            "success": False,
            "error": str(e),
        }

