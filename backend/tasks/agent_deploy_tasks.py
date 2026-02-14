"""
Agent deployment tasks for deploying agent configurations to Git repository.

This module provides Celery tasks for deploying Telegraf/InfluxDB/Grafana agent
configurations by rendering templates and committing to Git repositories.
"""

from celery import shared_task
import logging
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
from git.exc import GitCommandError
import os

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
    try:
        logger.info("=" * 80)
        logger.info("AGENT DEPLOYMENT TASK STARTED")
        logger.info("=" * 80)
        logger.info(f"Template ID: {template_id}")
        logger.info(f"Agent ID: {agent_id}")
        logger.info(f"Path: {path}")
        logger.info(f"Inventory ID: {inventory_id}")
        logger.info(f"Activate after deploy: {activate_after_deploy}")
        logger.info(f"Custom variables: {list(custom_variables.keys()) if custom_variables else 'none'}")

        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing agent deployment..."},
        )

        # Import required services
        from template_manager import template_manager
        from services.agents.template_render_service import agent_template_render_service
        from services.settings.git.service import git_service
        from repositories.settings.git_repository_repository import GitRepositoryRepository
        from repositories.settings.settings_repository import AgentsSettingRepository

        # Step 1: Load template
        logger.info("-" * 80)
        logger.info("STEP 1: LOADING TEMPLATE")
        logger.info("-" * 80)

        template = template_manager.get_template(template_id)
        if not template:
            error_msg = f"Template with ID {template_id} not found"
            logger.error(f"ERROR: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "template_id": template_id,
                "agent_id": agent_id,
            }

        template_content = template_manager.get_template_content(template_id)
        if not template_content:
            error_msg = f"Template content for ID {template_id} not found"
            logger.error(f"ERROR: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "template_id": template_id,
                "agent_id": agent_id,
            }

        logger.info(f"✓ Template loaded: {template['name']}")
        logger.info(f"  - Category: {template.get('category', 'unknown')}")

        self.update_state(
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
            error_msg = "No agents configured. Please configure agents in agent settings."
            logger.error(f"ERROR: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "template_id": template_id,
                "agent_id": agent_id,
            }

        # Find the specific agent by ID
        agent = None
        for a in agents_settings.agents:
            if a.get("id") == agent_id:
                agent = a
                break

        if not agent:
            error_msg = f"Agent with ID {agent_id} not found in agent settings"
            logger.error(f"ERROR: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "template_id": template_id,
                "agent_id": agent_id,
            }

        agent_name = agent.get("name", agent_id)
        logger.info(f"✓ Agent found: {agent_name}")

        # Extract the cockpit agent_id for activation (different from UUID)
        cockpit_agent_id = agent.get("agent_id")
        if cockpit_agent_id:
            logger.info(f"  - Cockpit Agent ID: {cockpit_agent_id}")
        else:
            logger.warning(f"  ⚠ No agent_id configured for agent '{agent_name}' - activation will fail if requested")

        # Get the git repository ID from the agent configuration
        agent_git_repo_id = agent.get("git_repository_id")
        if not agent_git_repo_id:
            error_msg = f"No git repository configured for agent '{agent_name}'"
            logger.error(f"ERROR: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "template_id": template_id,
                "agent_id": agent_id,
            }

        self.update_state(
            state="PROGRESS",
            meta={"current": 30, "total": 100, "status": "Loading Git repository..."},
        )

        # Step 3: Load Git repository configuration
        logger.info("-" * 80)
        logger.info("STEP 3: LOADING GIT REPOSITORY")
        logger.info("-" * 80)

        git_repo_repo = GitRepositoryRepository()
        git_repository = git_repo_repo.get_by_id(agent_git_repo_id)

        if not git_repository:
            error_msg = f"Git repository with ID {agent_git_repo_id} not found"
            logger.error(f"ERROR: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "template_id": template_id,
                "agent_id": agent_id,
            }

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

        logger.info(f"✓ Git repository: {git_repository.name}")
        logger.info(f"  - URL: {git_repository.url}")
        logger.info(f"  - Branch: {git_repository.branch or 'main'}")

        self.update_state(
            state="PROGRESS",
            meta={"current": 40, "total": 100, "status": "Rendering template..."},
        )

        # Step 4: Render template
        logger.info("-" * 80)
        logger.info("STEP 4: RENDERING TEMPLATE")
        logger.info("-" * 80)

        # Use user-selected inventory if provided, otherwise fall back to template's inventory
        effective_inventory_id = inventory_id or template.get("inventory_id")
        logger.info(f"Using inventory ID: {effective_inventory_id}")

        # Render the template with stored variables
        try:
            # Handle async call in sync Celery task
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            render_result = loop.run_until_complete(
                agent_template_render_service.render_agent_template(
                    template_content=template_content,
                    inventory_id=effective_inventory_id,
                    pass_snmp_mapping=template.get("pass_snmp_mapping", False),
                    user_variables=custom_variables or {},
                    path=path,
                    stored_variables=template.get("variables"),
                    username="celery_task",  # Task context, not user-initiated
                )
            )
            loop.close()

            logger.info("✓ Template rendered successfully")
            logger.info(f"  - Rendered size: {len(render_result.rendered_content)} characters")
        except Exception as e:
            error_msg = f"Failed to render template: {str(e)}"
            logger.error(f"ERROR: {error_msg}", exc_info=True)
            return {
                "success": False,
                "error": error_msg,
                "template_id": template_id,
                "agent_id": agent_id,
            }

        self.update_state(
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
            logger.info(f"✓ Repository ready at {repo_path}")

            # Pull latest changes
            logger.info(f"Pulling latest changes from {git_repository.url}...")
            pull_result = git_service.pull(repo_dict, repo=repo)
            if pull_result.success:
                logger.info(f"✓ {pull_result.message}")
            else:
                logger.warning(f"⚠ Pull warning: {pull_result.message}")

        except GitCommandError as e:
            error_msg = f"Failed to prepare repository: {str(e)}"
            logger.error(f"ERROR: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "template_id": template_id,
                "agent_id": agent_id,
            }

        self.update_state(
            state="PROGRESS",
            meta={"current": 75, "total": 100, "status": "Writing configuration file..."},
        )

        # Step 6: Write configuration file
        logger.info("-" * 80)
        logger.info("STEP 6: WRITING CONFIGURATION FILE")
        logger.info("-" * 80)

        # Determine file path
        file_path = path or template.get("file_path")
        if not file_path:
            error_msg = "No file path provided. Please specify a deployment path or configure file_path in the template."
            logger.error(f"ERROR: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "template_id": template_id,
                "agent_id": agent_id,
            }

        full_file_path = os.path.join(repo_path, file_path.lstrip("/"))
        os.makedirs(os.path.dirname(full_file_path), exist_ok=True)

        with open(full_file_path, "w", encoding="utf-8") as f:
            f.write(render_result.rendered_content)

        logger.info(f"✓ Configuration written to {full_file_path}")

        self.update_state(
            state="PROGRESS",
            meta={"current": 85, "total": 100, "status": "Committing and pushing changes..."},
        )

        # Step 7: Commit and push
        logger.info("-" * 80)
        logger.info("STEP 7: COMMITTING AND PUSHING TO GIT")
        logger.info("-" * 80)

        current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        commit_message = f"Deploy {agent_name} - {template['name']} - {current_date}"
        logger.info(f"Commit message: '{commit_message}'")

        result = git_service.commit_and_push(
            repository=repo_dict,
            message=commit_message,
            files=[file_path.lstrip("/")],
            repo=repo,
        )

        if result.success:
            logger.info("=" * 80)
            logger.info("GIT DEPLOYMENT COMPLETED SUCCESSFULLY")
            logger.info("=" * 80)
            logger.info(f"✓ Commit SHA: {result.commit_sha[:8] if result.commit_sha else 'none'}")
            logger.info(f"✓ Files changed: {result.files_changed}")
            logger.info(f"✓ Pushed: {result.pushed}")

            deployment_result = {
                "success": True,
                "message": f"Successfully deployed configuration to git repository '{git_repository.name}'",
                "template_id": template_id,
                "template_name": template['name'],
                "agent_id": agent_id,
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
                "activated": False,
            }

            # Step 8: Activate agent (if requested)
            if activate_after_deploy:
                logger.info("-" * 80)
                logger.info("STEP 8: ACTIVATING AGENT")
                logger.info("-" * 80)

                # Check if agent has cockpit agent_id configured
                if not cockpit_agent_id:
                    logger.warning("⚠ Cannot activate agent - no agent_id configured in agent settings")
                    deployment_result["activation_warning"] = "Agent has no agent_id configured for remote activation"
                    deployment_result["message"] += " (activation skipped: no agent_id configured)"
                else:
                    self.update_state(
                        state="PROGRESS",
                        meta={"current": 95, "total": 100, "status": "Activating agent..."},
                    )

                    try:
                        # Import service and get DB session
                        from core.database import SessionLocal
                        from services.cockpit_agent_service import CockpitAgentService

                        db = SessionLocal()
                        try:
                            cockpit_service = CockpitAgentService(db)

                            logger.info(f"Sending docker restart command to cockpit agent '{cockpit_agent_id}'...")

                            # Send docker restart command (60s timeout)
                            # Use cockpit_agent_id (e.g., "grafana-01") NOT the UUID!
                            activation_result = cockpit_service.send_docker_restart(
                                agent_id=cockpit_agent_id,
                                sent_by="celery_task",
                                timeout=60,
                            )

                            if activation_result.get("status") == "success":
                                logger.info("✓ Agent activated successfully")
                                logger.info(f"  Output: {activation_result.get('output', 'none')}")
                                deployment_result["activated"] = True
                                deployment_result["activation_output"] = activation_result.get("output")
                                deployment_result["message"] += " and agent activated successfully"
                            elif activation_result.get("status") == "timeout":
                                logger.warning("⚠ Agent activation timed out")
                                deployment_result["activation_warning"] = "Agent activation timed out after 60s"
                                deployment_result["message"] += " (activation timed out)"
                            else:
                                logger.warning(f"⚠ Agent activation failed: {activation_result.get('error')}")
                                deployment_result["activation_warning"] = activation_result.get("error")
                                deployment_result["message"] += f" (activation failed: {activation_result.get('error')})"

                        finally:
                            db.close()

                    except Exception as e:
                        logger.error(f"⚠ Agent activation failed with exception: {e}", exc_info=True)
                        deployment_result["activation_warning"] = str(e)
                        deployment_result["message"] += f" (activation failed: {str(e)})"

            logger.info("=" * 80)
            logger.info("AGENT DEPLOYMENT TASK COMPLETED")
            logger.info("=" * 80)

            return deployment_result
        else:
            error_msg = f"Failed to commit/push to git: {result.message}"
            logger.error(f"ERROR: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "template_id": template_id,
                "agent_id": agent_id,
                "file_path": file_path,
            }

    except Exception as e:
        logger.error("=" * 80)
        logger.error("AGENT DEPLOYMENT TASK FAILED WITH EXCEPTION")
        logger.error("=" * 80)
        logger.error(f"Exception: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "template_id": template_id,
            "agent_id": agent_id,
        }
