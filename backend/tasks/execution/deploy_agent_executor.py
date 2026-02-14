"""
Deploy agent configurations executor.
Renders an agent template and commits the result to a Git repository.

Reuses the same logic as deploy_agent_task but adapted for the
job template scheduler execution pattern.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional

from git.exc import GitCommandError

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

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing agent deployment..."},
        )

        # Import required services
        from template_manager import template_manager
        from services.agents.template_render_service import agent_template_render_service
        from services.settings.git.service import git_service
        from repositories.settings.git_repository_repository import GitRepositoryRepository
        from repositories.settings.settings_repository import AgentsSettingRepository
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

        # Step 1: Load the agent template
        logger.info("-" * 80)
        logger.info("STEP 1: LOADING AGENT TEMPLATE")
        logger.info("-" * 80)

        agent_template = template_manager.get_template(deploy_template_id)
        if not agent_template:
            return {
                "success": False,
                "error": "Template with ID %d not found" % deploy_template_id,
                "template_id": deploy_template_id,
                "agent_id": deploy_agent_id,
            }

        template_content = template_manager.get_template_content(deploy_template_id)
        if not template_content:
            return {
                "success": False,
                "error": "Template content for ID %d not found" % deploy_template_id,
                "template_id": deploy_template_id,
                "agent_id": deploy_agent_id,
            }

        logger.info("Template loaded: %s", agent_template["name"])

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 20, "total": 100, "status": "Loading agent configuration..."},
        )

        # Step 2: Load agent configuration
        logger.info("-" * 80)
        logger.info("STEP 2: LOADING AGENT CONFIGURATION")
        logger.info("-" * 80)

        agents_repo = AgentsSettingRepository()
        agents_settings = agents_repo.get_settings()

        if not agents_settings or not agents_settings.agents:
            return {
                "success": False,
                "error": "No agents configured in agent settings",
                "template_id": deploy_template_id,
                "agent_id": deploy_agent_id,
            }

        agent = None
        for a in agents_settings.agents:
            if a.get("id") == deploy_agent_id:
                agent = a
                break

        if not agent:
            return {
                "success": False,
                "error": "Agent with ID %s not found" % deploy_agent_id,
                "template_id": deploy_template_id,
                "agent_id": deploy_agent_id,
            }

        agent_name = agent.get("name", deploy_agent_id)
        logger.info("Agent found: %s", agent_name)

        agent_git_repo_id = agent.get("git_repository_id")
        if not agent_git_repo_id:
            return {
                "success": False,
                "error": "No git repository configured for agent '%s'" % agent_name,
                "template_id": deploy_template_id,
                "agent_id": deploy_agent_id,
            }

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 30, "total": 100, "status": "Loading Git repository..."},
        )

        # Step 3: Load Git repository
        logger.info("-" * 80)
        logger.info("STEP 3: LOADING GIT REPOSITORY")
        logger.info("-" * 80)

        git_repo_repo = GitRepositoryRepository()
        git_repository = git_repo_repo.get_by_id(agent_git_repo_id)

        if not git_repository:
            return {
                "success": False,
                "error": "Git repository with ID %s not found" % agent_git_repo_id,
                "template_id": deploy_template_id,
                "agent_id": deploy_agent_id,
            }

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

        logger.info("Git repository: %s", git_repository.name)

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 40, "total": 100, "status": "Rendering template..."},
        )

        # Step 4: Resolve inventory and render template
        logger.info("-" * 80)
        logger.info("STEP 4: RENDERING TEMPLATE")
        logger.info("-" * 80)

        # Resolve inventory_id from the job template's inventory_name
        effective_inventory_id = None
        inventory_name = template.get("inventory_name")
        if inventory_name and template.get("inventory_source") == "inventory":
            import inventory_manager as inv_mgr

            inv = inv_mgr.inventory_manager.get_inventory_by_name(
                inventory_name, "celery_scheduler"
            )
            if inv:
                effective_inventory_id = inv.get("id")
                logger.info("Resolved inventory '%s' to ID %s", inventory_name, effective_inventory_id)

        # Fall back to template's own inventory_id if available
        if not effective_inventory_id:
            effective_inventory_id = agent_template.get("inventory_id")

        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            render_result = loop.run_until_complete(
                agent_template_render_service.render_agent_template(
                    template_content=template_content,
                    inventory_id=effective_inventory_id,
                    pass_snmp_mapping=agent_template.get("pass_snmp_mapping", False),
                    user_variables=deploy_custom_variables or {},
                    path=deploy_path,
                    stored_variables=agent_template.get("variables"),
                    username="celery_scheduler",
                )
            )
            loop.close()
            logger.info("Template rendered successfully (%d characters)", len(render_result.rendered_content))
        except Exception as e:
            return {
                "success": False,
                "error": "Failed to render template: %s" % str(e),
                "template_id": deploy_template_id,
                "agent_id": deploy_agent_id,
            }

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 60, "total": 100, "status": "Preparing Git repository..."},
        )

        # Step 5: Prepare Git repository
        logger.info("-" * 80)
        logger.info("STEP 5: PREPARING GIT REPOSITORY")
        logger.info("-" * 80)

        try:
            repo = git_service.open_or_clone(repo_dict)
            repo_path = git_service.get_repo_path(repo_dict)
            logger.info("Repository ready at %s", repo_path)

            pull_result = git_service.pull(repo_dict, repo=repo)
            if pull_result.success:
                logger.info("Pull: %s", pull_result.message)
            else:
                logger.warning("Pull warning: %s", pull_result.message)

        except GitCommandError as e:
            return {
                "success": False,
                "error": "Failed to prepare repository: %s" % str(e),
                "template_id": deploy_template_id,
                "agent_id": deploy_agent_id,
            }

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 75, "total": 100, "status": "Writing configuration file..."},
        )

        # Step 6: Write configuration file
        logger.info("-" * 80)
        logger.info("STEP 6: WRITING CONFIGURATION FILE")
        logger.info("-" * 80)

        file_path = deploy_path or agent_template.get("file_path")
        if not file_path:
            return {
                "success": False,
                "error": "No file path provided and no file_path in template",
                "template_id": deploy_template_id,
                "agent_id": deploy_agent_id,
            }

        full_file_path = os.path.join(str(repo_path), file_path.lstrip("/"))
        os.makedirs(os.path.dirname(full_file_path), exist_ok=True)

        with open(full_file_path, "w", encoding="utf-8") as f:
            f.write(render_result.rendered_content)

        logger.info("Configuration written to %s", full_file_path)

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 85, "total": 100, "status": "Committing and pushing changes..."},
        )

        # Step 7: Commit and push
        logger.info("-" * 80)
        logger.info("STEP 7: COMMITTING AND PUSHING TO GIT")
        logger.info("-" * 80)

        current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        commit_message = "Deploy %s - %s - %s" % (agent_name, agent_template["name"], current_date)

        result = git_service.commit_and_push(
            repository=repo_dict,
            message=commit_message,
            files=[file_path.lstrip("/")],
            repo=repo,
        )

        if result.success:
            logger.info("=" * 80)
            logger.info("DEPLOY AGENT EXECUTOR COMPLETED SUCCESSFULLY")
            logger.info("=" * 80)

            # TODO: Implement activate_after_deploy functionality
            # When activate_after_deploy is True:
            # 1. SSH into the agent
            # 2. Pull latest changes from git repository
            # 3. Restart the agent service
            if activate_after_deploy:
                logger.info("Activate after deploy is enabled (not yet implemented)")

            return {
                "success": True,
                "message": "Successfully deployed configuration to git repository '%s'" % git_repository.name,
                "template_id": deploy_template_id,
                "template_name": agent_template["name"],
                "agent_id": deploy_agent_id,
                "agent_name": agent_name,
                "commit_sha": result.commit_sha,
                "commit_sha_short": result.commit_sha[:8] if result.commit_sha else None,
                "file_path": file_path,
                "repository_name": git_repository.name,
                "repository_url": git_repository.url,
                "branch": git_repository.branch or "main",
                "files_changed": result.files_changed,
                "pushed": result.pushed,
                "timestamp": current_date,
            }
        else:
            return {
                "success": False,
                "error": "Failed to commit/push to git: %s" % result.message,
                "template_id": deploy_template_id,
                "agent_id": deploy_agent_id,
                "file_path": file_path,
            }

    except Exception as e:
        logger.error("=" * 80)
        logger.error("DEPLOY AGENT EXECUTOR FAILED WITH EXCEPTION")
        logger.error("=" * 80)
        logger.error("Exception: %s", e, exc_info=True)
        return {
            "success": False,
            "error": str(e),
        }
