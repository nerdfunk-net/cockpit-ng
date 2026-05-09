"""
Agent Deployment Service.

Centralized service for deploying agent configurations to Git repositories.
Used by both direct API calls (deploy_agent_task) and scheduled jobs (deploy_agent_executor).
"""

import logging
import os
from datetime import datetime
from typing import Optional, Dict, Any, List
from git.exc import GitCommandError

logger = logging.getLogger(__name__)


class AgentDeploymentService:
    """Service for deploying agent configurations to Git repositories."""

    def __init__(self):
        """Initialize the deployment service."""
        # Import required services at class level to avoid circular imports
        import service_factory as _sf

        git_service = _sf.build_git_service()
        from repositories.settings.git_repository_repository import (
            GitRepositoryRepository,
        )
        from repositories.settings.settings_repository import AgentsSettingRepository

        self.template_manager = _sf.build_template_manager()
        self.agent_template_render_service = _sf.build_agent_template_render_service()
        self.git_service = git_service
        self.git_repo_repository = GitRepositoryRepository()
        self.agents_repository = AgentsSettingRepository()

    def _load_agent_config(self, agent_id: str) -> Dict[str, Any]:
        """Load and validate agent settings; raise ValueError if not found."""
        agents_settings = self.agents_repository.get_settings()
        if not agents_settings or not agents_settings.agents:
            raise ValueError(
                "No agents configured. Please configure agents in agent settings."
            )
        for a in agents_settings.agents:
            if a.get("agent_id") == agent_id:
                return a
        raise ValueError(
            f"Agent with agent_id '{agent_id}' not found in agent settings. "
            "Please configure the agent_id field for this agent in Settings → Connections → Agents."
        )

    def _load_git_repository(self, agent: Dict[str, Any]) -> Dict[str, Any]:
        """Load Git repository record for the agent; raise ValueError if missing."""
        agent_git_repo_id = agent.get("git_repository_id")
        if not agent_git_repo_id:
            raise ValueError(
                f"No git repository configured for agent '{agent.get('name')}'"
            )
        git_repository = self.git_repo_repository.get_by_id(agent_git_repo_id)
        if not git_repository:
            raise ValueError(f"Git repository with ID {agent_git_repo_id} not found")
        return git_repository

    @staticmethod
    def _repo_to_dict(git_repository) -> Dict[str, Any]:
        """Convert SQLAlchemy GitRepository model to a dict for git_service."""
        return {
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

    def _open_or_clone_repo(self, repo_dict: Dict[str, Any]):
        """Clone or open the git repository working directory; return (repo, repo_path)."""
        repo = self.git_service.open_or_clone(repo_dict)
        repo_path = self.git_service.get_repo_path(repo_dict)

        pull_result = self.git_service.pull(repo_dict, repo=repo)
        if pull_result.success:
            logger.info("Pull: %s", pull_result.message)
        else:
            logger.warning("Pull warning: %s", pull_result.message)

        return repo, repo_path

    def _write_file(
        self,
        repo_path: str,
        file_path: str,
        content: str,
    ) -> None:
        """Write content to file_path within the repository working tree."""
        full_file_path = os.path.join(repo_path, file_path.lstrip("/"))
        os.makedirs(os.path.dirname(full_file_path), exist_ok=True)
        with open(full_file_path, "w", encoding="utf-8") as f:
            f.write(content)

    def _commit_and_push(
        self,
        repo_dict: Dict[str, Any],
        repo,
        files: List[str],
        commit_message: str,
    ) -> Any:
        """Stage all changes, commit, and push; return git service result object."""
        return self.git_service.commit_and_push(
            repository=repo_dict,
            message=commit_message,
            files=files,
            repo=repo,
        )

    async def _render_template(
        self,
        template_id: int,
        path: Optional[str],
        inventory_id: Optional[int],
        custom_variables: Optional[Dict[str, Any]],
        username: str,
    ) -> tuple:
        """Load template, render it; return (template_name, rendered_content, file_path).

        Raises ValueError if template/content missing or no file path resolved.
        Raises Exception if rendering fails.
        """
        template = self.template_manager.get_template(template_id)
        if not template:
            raise ValueError(f"Template with ID {template_id} not found")

        template_content = self.template_manager.get_template_content(template_id)
        if not template_content:
            raise ValueError(f"Template content for ID {template_id} not found")

        effective_inventory_id = inventory_id or template.get("inventory_id")
        render_result = await self.agent_template_render_service.render_agent_template(
            template_content=template_content,
            inventory_id=effective_inventory_id,
            pass_snmp_mapping=template.get("pass_snmp_mapping", False),
            user_variables=custom_variables or {},
            path=path,
            stored_variables=template.get("variables"),
            username=username,
        )

        file_path = path or template.get("file_path")
        if not file_path:
            raise ValueError(
                "No file path provided. Please specify a deployment path or configure file_path in the template."
            )

        return template["name"], render_result.rendered_content, file_path

    async def deploy(
        self,
        template_id: int,
        agent_id: str,
        custom_variables: Optional[Dict[str, Any]] = None,
        path: Optional[str] = None,
        inventory_id: Optional[int] = None,
        activate_after_deploy: bool = True,
        task_context=None,
        username: str = "system",
    ) -> Dict[str, Any]:
        """
        Deploy agent configuration to Git repository.

        Orchestrates: load agent config → load repo → render template →
        clone/open repo → write file → commit/push → activate.
        """
        try:
            logger.info("=" * 80)
            logger.info("AGENT DEPLOYMENT STARTED")
            logger.info("=" * 80)
            logger.info("Template ID: %s", template_id)
            logger.info("Agent ID: %s", agent_id)
            logger.info("Path: %s", path)
            logger.info("Inventory ID: %s", inventory_id)
            logger.info("Activate after deploy: %s", activate_after_deploy)
            logger.info(
                "Custom variables: %s",
                list(custom_variables.keys()) if custom_variables else "none",
            )

            self._update_progress(task_context, 0, "Initializing agent deployment...")

            # Step 1: Load agent configuration
            logger.info("-" * 80)
            logger.info("STEP 1: LOADING AGENT CONFIGURATION")
            logger.info("-" * 80)

            try:
                agent = self._load_agent_config(agent_id)
            except ValueError as e:
                logger.error("ERROR: %s", e)
                return {
                    "success": False,
                    "error": str(e),
                    "template_id": template_id,
                    "agent_id": agent_id,
                }

            agent_name = agent.get("name", agent_id)
            logger.info(
                "✓ Agent found: %s (Cockpit Agent ID: %s)", agent_name, agent_id
            )

            self._update_progress(task_context, 15, "Loading Git repository...")

            # Step 2: Load Git repository configuration
            logger.info("-" * 80)
            logger.info("STEP 2: LOADING GIT REPOSITORY")
            logger.info("-" * 80)

            try:
                git_repository = self._load_git_repository(agent)
            except ValueError as e:
                logger.error("ERROR: %s", e)
                return {
                    "success": False,
                    "error": str(e),
                    "template_id": template_id,
                    "agent_id": agent_id,
                }

            repo_dict = self._repo_to_dict(git_repository)
            logger.info(
                "✓ Git repository: %s (%s)", git_repository.name, git_repository.url
            )

            self._update_progress(task_context, 30, "Rendering template...")

            # Step 3: Load and render template
            logger.info("-" * 80)
            logger.info("STEP 3: LOADING AND RENDERING TEMPLATE")
            logger.info("-" * 80)

            try:
                (
                    template_name,
                    rendered_content,
                    file_path,
                ) = await self._render_template(
                    template_id, path, inventory_id, custom_variables, username
                )
                logger.info(
                    "✓ Template rendered: %s (%s chars) → %s",
                    template_name,
                    len(rendered_content),
                    file_path,
                )
            except ValueError as e:
                logger.error("ERROR: %s", e)
                return {
                    "success": False,
                    "error": str(e),
                    "template_id": template_id,
                    "agent_id": agent_id,
                }
            except Exception as e:
                error_msg = f"Failed to render template: {str(e)}"
                logger.error("ERROR: %s", error_msg, exc_info=True)
                return {
                    "success": False,
                    "error": error_msg,
                    "template_id": template_id,
                    "agent_id": agent_id,
                }

            self._update_progress(task_context, 55, "Preparing Git repository...")

            # Step 4: Prepare Git repository
            logger.info("-" * 80)
            logger.info("STEP 4: PREPARING GIT REPOSITORY")
            logger.info("-" * 80)

            try:
                repo, repo_path = self._open_or_clone_repo(repo_dict)
                logger.info("✓ Repository ready at %s", repo_path)
            except GitCommandError as e:
                error_msg = f"Failed to prepare repository: {str(e)}"
                logger.error("ERROR: %s", error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "template_id": template_id,
                    "agent_id": agent_id,
                }

            self._update_progress(task_context, 70, "Writing configuration file...")

            # Step 5: Write configuration file
            logger.info("-" * 80)
            logger.info("STEP 5: WRITING CONFIGURATION FILE")
            logger.info("-" * 80)

            self._write_file(repo_path, file_path, rendered_content)
            logger.info("✓ Configuration written to %s", file_path)

            self._update_progress(task_context, 82, "Committing and pushing changes...")

            # Step 6: Commit and push
            logger.info("-" * 80)
            logger.info("STEP 6: COMMITTING AND PUSHING TO GIT")
            logger.info("-" * 80)

            current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            commit_message = f"Deploy {agent_name} - {template_name} - {current_date}"
            logger.info("Commit message: '%s'", commit_message)

            result = self._commit_and_push(
                repo_dict, repo, [file_path.lstrip("/")], commit_message
            )

            if result.success:
                logger.info("=" * 80)
                logger.info("GIT DEPLOYMENT COMPLETED SUCCESSFULLY")
                logger.info("=" * 80)
                logger.info(
                    "✓ Commit SHA: %s",
                    result.commit_sha[:8] if result.commit_sha else "none",
                )
                logger.info("✓ Files changed: %s", result.files_changed)

                deployment_result = {
                    "success": True,
                    "message": f"Successfully deployed configuration to git repository '{git_repository.name}'",
                    "template_id": template_id,
                    "template_name": template_name,
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "commit_sha": result.commit_sha,
                    "commit_sha_short": result.commit_sha[:8]
                    if result.commit_sha
                    else None,
                    "file_path": file_path,
                    "repository_name": git_repository.name,
                    "repository_url": git_repository.url,
                    "branch": git_repository.branch or "main",
                    "files_changed": result.files_changed,
                    "pushed": result.pushed,
                    "timestamp": current_date,
                    "activated": False,
                }

                if activate_after_deploy:
                    activation_result = self._activate_agent(
                        cockpit_agent_id=agent_id,
                        agent_name=agent_name,
                        username=username,
                        task_context=task_context,
                    )
                    deployment_result.update(activation_result)

                logger.info("=" * 80)
                logger.info("AGENT DEPLOYMENT COMPLETED")
                logger.info("=" * 80)

                return deployment_result
            else:
                error_msg = f"Failed to commit/push to git: {result.message}"
                logger.error("ERROR: %s", error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "template_id": template_id,
                    "agent_id": agent_id,
                    "file_path": file_path,
                }

        except Exception as e:
            logger.error("=" * 80)
            logger.error("AGENT DEPLOYMENT FAILED WITH EXCEPTION")
            logger.error("=" * 80)
            logger.error("Exception: %s", e, exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "template_id": template_id,
                "agent_id": agent_id,
            }

    async def deploy_multi(
        self,
        template_entries: List[Dict[str, Any]],
        agent_id: str,
        activate_after_deploy: bool = True,
        task_context=None,
        username: str = "system",
    ) -> Dict[str, Any]:
        """
        Deploy multiple templates to a single agent's Git repository.

        Renders each template entry, writes all files, then makes a single
        git commit/push and optional activation.
        """
        try:
            logger.info("=" * 80)
            logger.info("MULTI-TEMPLATE AGENT DEPLOYMENT STARTED")
            logger.info("=" * 80)
            logger.info("Agent ID: %s", agent_id)
            logger.info("Template entries: %s", len(template_entries))
            logger.info("Activate after deploy: %s", activate_after_deploy)

            self._update_progress(
                task_context, 0, "Initializing multi-template deployment..."
            )

            # Step 1: Load agent configuration
            logger.info("-" * 80)
            logger.info("STEP 1: LOADING AGENT CONFIGURATION")
            logger.info("-" * 80)

            try:
                agent = self._load_agent_config(agent_id)
            except ValueError as e:
                return {"success": False, "error": str(e), "agent_id": agent_id}

            agent_name = agent.get("name", agent_id)
            logger.info("Agent found: %s", agent_name)

            self._update_progress(task_context, 10, "Loading Git repository...")

            # Step 2: Load Git repository
            logger.info("-" * 80)
            logger.info("STEP 2: LOADING GIT REPOSITORY")
            logger.info("-" * 80)

            try:
                git_repository = self._load_git_repository(agent)
            except ValueError as e:
                return {"success": False, "error": str(e), "agent_id": agent_id}

            repo_dict = self._repo_to_dict(git_repository)
            logger.info("Git repository: %s", git_repository.name)

            self._update_progress(task_context, 20, "Preparing Git repository...")

            # Step 3: Prepare Git repository
            logger.info("-" * 80)
            logger.info("STEP 3: PREPARING GIT REPOSITORY")
            logger.info("-" * 80)

            try:
                repo, repo_path = self._open_or_clone_repo(repo_dict)
                logger.info("Repository ready at %s", repo_path)
            except GitCommandError as e:
                return {
                    "success": False,
                    "error": f"Failed to prepare repository: {str(e)}",
                    "agent_id": agent_id,
                }

            # Step 4: Render templates and write files
            logger.info("-" * 80)
            logger.info("STEP 4: RENDERING TEMPLATES AND WRITING FILES")
            logger.info("-" * 80)

            template_results = []
            all_file_paths = []
            success_count = 0
            fail_count = 0

            total_entries = len(template_entries)
            for idx, entry in enumerate(template_entries):
                entry_template_id = entry.get("template_id")
                entry_inventory_id = entry.get("inventory_id")
                entry_path = entry.get("path")
                entry_custom_variables = entry.get("custom_variables") or {}

                progress = 30 + int((idx / total_entries) * 40)
                self._update_progress(
                    task_context,
                    progress,
                    f"Rendering template {idx + 1}/{total_entries}...",
                )

                logger.info("--- Template entry %s/%s ---", idx + 1, total_entries)
                logger.info("  Template ID: %s", entry_template_id)

                try:
                    (
                        template_name,
                        rendered_content,
                        file_path,
                    ) = await self._render_template(
                        entry_template_id,
                        entry_path,
                        entry_inventory_id,
                        entry_custom_variables,
                        username,
                    )
                    logger.info(
                        "  Rendered: %s (%s chars) → %s",
                        template_name,
                        len(rendered_content),
                        file_path,
                    )
                except ValueError as e:
                    logger.error("  Error: %s", e)
                    template_results.append(
                        {
                            "template_id": entry_template_id,
                            "template_name": None,
                            "file_path": entry_path,
                            "inventory_id": entry_inventory_id,
                            "success": False,
                            "error": str(e),
                            "rendered_size": 0,
                        }
                    )
                    fail_count += 1
                    continue
                except Exception as e:
                    logger.error("  Render failed: %s", e, exc_info=True)
                    template_results.append(
                        {
                            "template_id": entry_template_id,
                            "template_name": None,
                            "file_path": entry_path,
                            "inventory_id": entry_inventory_id,
                            "success": False,
                            "error": f"Failed to render template: {str(e)}",
                            "rendered_size": 0,
                        }
                    )
                    fail_count += 1
                    continue

                self._write_file(repo_path, file_path, rendered_content)
                logger.info("  Written to: %s", file_path)

                all_file_paths.append(file_path.lstrip("/"))
                template_results.append(
                    {
                        "template_id": entry_template_id,
                        "template_name": template_name,
                        "file_path": file_path,
                        "inventory_id": entry_inventory_id,
                        "success": True,
                        "rendered_size": len(rendered_content),
                    }
                )
                success_count += 1

            if success_count == 0:
                return {
                    "success": False,
                    "error": "All template renders failed",
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "template_results": template_results,
                }

            self._update_progress(task_context, 75, "Committing and pushing changes...")

            # Step 5: Single commit and push with all files
            logger.info("-" * 80)
            logger.info("STEP 5: COMMITTING AND PUSHING TO GIT")
            logger.info("-" * 80)

            current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            commit_message = (
                f"Deploy {agent_name} - {success_count} templates - {current_date}"
            )
            logger.info("Commit message: '%s'", commit_message)

            result = self._commit_and_push(
                repo_dict, repo, all_file_paths, commit_message
            )

            if result.success:
                logger.info("=" * 80)
                logger.info("GIT DEPLOYMENT COMPLETED SUCCESSFULLY")
                logger.info("=" * 80)
                logger.info(
                    "Commit SHA: %s",
                    result.commit_sha[:8] if result.commit_sha else "none",
                )
                logger.info("Files changed: %s", result.files_changed)

                deployment_result = {
                    "success": True,
                    "message": f"Successfully deployed {success_count} templates to git repository '{git_repository.name}'",
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "commit_sha": result.commit_sha,
                    "commit_sha_short": result.commit_sha[:8]
                    if result.commit_sha
                    else None,
                    "repository_name": git_repository.name,
                    "repository_url": git_repository.url,
                    "branch": git_repository.branch or "main",
                    "files_changed": result.files_changed,
                    "pushed": result.pushed,
                    "timestamp": current_date,
                    "activated": False,
                    "template_results": template_results,
                }

                if activate_after_deploy:
                    activation_result = self._activate_agent(
                        cockpit_agent_id=agent_id,
                        agent_name=agent_name,
                        username=username,
                        task_context=task_context,
                    )
                    deployment_result.update(activation_result)

                logger.info("=" * 80)
                logger.info("MULTI-TEMPLATE AGENT DEPLOYMENT COMPLETED")
                logger.info("=" * 80)

                return deployment_result
            else:
                return {
                    "success": False,
                    "error": f"Failed to commit/push to git: {result.message}",
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "template_results": template_results,
                }

        except Exception as e:
            logger.error("=" * 80)
            logger.error("MULTI-TEMPLATE AGENT DEPLOYMENT FAILED WITH EXCEPTION")
            logger.error("=" * 80)
            logger.error("Exception: %s", e, exc_info=True)
            return {"success": False, "error": str(e), "agent_id": agent_id}

    def _activate_agent(
        self,
        cockpit_agent_id: Optional[str],
        agent_name: str,
        username: str,
        task_context=None,
    ) -> Dict[str, Any]:
        """
        Activate agent via cockpit agent service.

        Performs two-step activation:
        1. Git pull - pulls latest configuration from repository
        2. Docker restart - restarts the agent container with new config

        If git pull fails, the activation is aborted and Docker restart is not performed.

        Args:
            cockpit_agent_id: Cockpit agent ID string (e.g., "grafana-01")
            agent_name: Human-readable agent name
            username: Username for audit trail
            task_context: Celery task context for progress updates (optional)

        Returns:
            dict: Activation results (activated, activation_output, activation_warning, message)
        """
        logger.info("-" * 80)
        logger.info("STEP 8: ACTIVATING AGENT")
        logger.info("-" * 80)

        result = {}

        # Check if agent has cockpit agent_id configured
        if not cockpit_agent_id:
            logger.warning(
                "⚠ Cannot activate agent - no agent_id configured in agent settings"
            )
            result["activation_warning"] = (
                "Agent has no agent_id configured for remote activation"
            )
            result["message"] = " (activation skipped: no agent_id configured)"
            return result

        self._update_progress(
            task_context, 90, "Pulling latest configuration from git..."
        )

        try:
            # Import service and get DB session
            from core.database import SessionLocal
            from services.cockpit_agent_service import CockpitAgentService

            db = SessionLocal()
            try:
                cockpit_service = CockpitAgentService(db)

                # Step 8.1: Git pull to fetch latest configuration
                logger.info(
                    "Step 8.1: Sending git pull command to cockpit agent '%s'...",
                    cockpit_agent_id,
                )

                git_pull_result = cockpit_service.send_git_pull(
                    agent_id=cockpit_agent_id,
                    repository_path="",  # Agent uses .env configured path
                    branch="",  # Agent uses .env configured branch
                    sent_by=username,
                    timeout=30,
                )

                # Check git pull status
                if git_pull_result.get("status") == "success":
                    logger.info("✓ Git pull successful")
                    logger.info("  Output: %s", git_pull_result.get("output", "none"))
                elif git_pull_result.get("status") == "timeout":
                    error_msg = "Git pull timed out after 30s"
                    logger.error("✗ %s", error_msg)
                    result["activated"] = False
                    result["activation_warning"] = error_msg
                    result["message"] = f" (activation failed: {error_msg})"
                    return result
                else:
                    error_msg = f"Git pull failed: {git_pull_result.get('error', 'unknown error')}"
                    logger.error("✗ %s", error_msg)
                    result["activated"] = False
                    result["activation_warning"] = error_msg
                    result["message"] = f" (activation failed: {error_msg})"
                    return result

                # Step 8.2: Docker restart to apply new configuration
                self._update_progress(task_context, 95, "Restarting agent container...")
                logger.info(
                    "Step 8.2: Sending docker restart command to cockpit agent '%s'...",
                    cockpit_agent_id,
                )

                restart_result = cockpit_service.send_docker_restart(
                    agent_id=cockpit_agent_id,
                    sent_by=username,
                    timeout=60,
                )

                if restart_result.get("status") == "success":
                    logger.info("✓ Agent activated successfully")
                    logger.info("  Output: %s", restart_result.get("output", "none"))
                    result["activated"] = True
                    result["activation_output"] = (
                        f"Git pull: {git_pull_result.get('output', 'success')}\nDocker restart: {restart_result.get('output', 'success')}"
                    )
                    result["message"] = (
                        " and agent activated successfully (git pull + docker restart)"
                    )
                elif restart_result.get("status") == "timeout":
                    logger.warning(
                        "⚠ Docker restart timed out (config was pulled successfully)"
                    )
                    result["activated"] = False
                    result["activation_warning"] = (
                        "Docker restart timed out after 60s (git pull succeeded)"
                    )
                    result["message"] = (
                        " (docker restart timed out, but git pull succeeded)"
                    )
                else:
                    logger.warning(
                        "⚠ Docker restart failed: %s (config was pulled successfully)",
                        restart_result.get("error"),
                    )
                    result["activated"] = False
                    result["activation_warning"] = (
                        f"Docker restart failed: {restart_result.get('error')} (git pull succeeded)"
                    )
                    result["message"] = (
                        f" (docker restart failed: {restart_result.get('error')}, but git pull succeeded)"
                    )

            finally:
                db.close()

        except Exception as e:
            logger.error(
                "⚠ Agent activation failed with exception: %s", e, exc_info=True
            )
            result["activated"] = False
            result["activation_warning"] = str(e)
            result["message"] = f" (activation failed: {str(e)})"

        return result

    @staticmethod
    def _update_progress(task_context, current: int, status: str):
        """Update task progress if context is available."""
        if task_context and hasattr(task_context, "update_state"):
            task_context.update_state(
                state="PROGRESS",
                meta={"current": current, "total": 100, "status": status},
            )
