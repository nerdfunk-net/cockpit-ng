"""
Command executor for Cockpit Agent
Handles execution of git, docker, and other commands
"""
import asyncio
import logging
import os
import subprocess
import time
from typing import Callable, Dict, Any

from config import config

logger = logging.getLogger(__name__)


class CommandExecutor:
    """Pluggable command executor with handler registry"""

    def __init__(self):
        self.handlers: Dict[str, Callable] = {}
        self._register_builtin_commands()

    def _register_builtin_commands(self):
        """Register default command handlers"""
        self.register("echo", self._execute_echo)
        self.register("git_pull", self._execute_git_pull)
        self.register("docker_restart", self._execute_docker_restart)

    def register(self, command_name: str, handler: Callable):
        """Register a new command handler"""
        self.handlers[command_name] = handler
        logger.info(f"Registered command handler: {command_name}")

    async def execute(self, command: str, params: dict) -> dict:
        """
        Execute a command by name
        Returns: dict with status, output, error, execution_time_ms
        """
        start_time = time.time()

        if command not in self.handlers:
            return {
                "status": "error",
                "error": f"Unknown command: {command}",
                "output": None,
                "execution_time_ms": 0,
            }

        try:
            handler = self.handlers[command]
            result = await handler(params)

            # Add execution time
            execution_time_ms = int((time.time() - start_time) * 1000)
            result["execution_time_ms"] = execution_time_ms

            return result

        except Exception as e:
            logger.error(f"Command execution failed: {command}", exc_info=True)
            execution_time_ms = int((time.time() - start_time) * 1000)
            return {
                "status": "error",
                "error": str(e),
                "output": None,
                "execution_time_ms": execution_time_ms,
            }

    async def _execute_echo(self, params: dict) -> dict:
        """Echo command for health checks"""
        message = params.get("message", "pong")
        logger.info(f"Echo command: {message}")
        return {"status": "success", "output": message, "error": None}

    async def _execute_git_pull(self, params: dict) -> dict:
        """
        Execute git pull command
        Validates repository path against configured allowed path
        """
        repo_path = params.get("repository_path")
        branch = params.get("branch", "main")

        # Validate repository path
        if not repo_path:
            return {
                "status": "error",
                "error": "repository_path parameter is required",
                "output": None,
            }

        allowed_paths = config.git_repo_paths
        if repo_path not in allowed_paths:
            return {
                "status": "error",
                "error": f"Repository path not allowed. Configured paths: {', '.join(allowed_paths)}",
                "output": None,
            }

        # Check if path exists
        if not os.path.isdir(repo_path):
            return {
                "status": "error",
                "error": f"Repository path does not exist: {repo_path}",
                "output": None,
            }

        # Check if it's a git repository
        git_dir = os.path.join(repo_path, ".git")
        if not os.path.isdir(git_dir):
            return {
                "status": "error",
                "error": f"Not a git repository: {repo_path}",
                "output": None,
            }

        try:
            logger.info(f"Executing git pull in {repo_path}, branch {branch}")

            # Execute git pull with timeout
            process = await asyncio.create_subprocess_exec(
                "git",
                "-C",
                repo_path,
                "pull",
                "origin",
                branch,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=config.command_timeout
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                return {
                    "status": "error",
                    "error": f"Git pull timed out after {config.command_timeout}s",
                    "output": None,
                }

            stdout_text = stdout.decode("utf-8").strip()
            stderr_text = stderr.decode("utf-8").strip()

            if process.returncode == 0:
                logger.info(f"Git pull successful: {stdout_text}")
                return {
                    "status": "success",
                    "output": stdout_text or "Git pull completed successfully",
                    "error": None,
                }
            else:
                logger.error(f"Git pull failed: {stderr_text}")
                return {
                    "status": "error",
                    "error": stderr_text or "Git pull failed",
                    "output": stdout_text,
                }

        except Exception as e:
            logger.error(f"Git pull exception: {e}", exc_info=True)
            return {"status": "error", "error": str(e), "output": None}

    async def _execute_docker_restart(self, params: dict) -> dict:
        """
        Execute docker restart command
        Validates container name against configured allowed name
        """
        container_name = params.get("container_name")

        # Validate container name
        if not container_name:
            return {
                "status": "error",
                "error": "container_name parameter is required",
                "output": None,
            }

        allowed_names = config.docker_container_names
        if container_name not in allowed_names:
            return {
                "status": "error",
                "error": f"Container name not allowed. Configured names: {', '.join(allowed_names)}",
                "output": None,
            }

        try:
            logger.info(f"Executing docker restart {container_name}")

            # Execute docker restart with timeout
            process = await asyncio.create_subprocess_exec(
                "docker",
                "restart",
                container_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=config.docker_timeout
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                return {
                    "status": "error",
                    "error": f"Docker restart timed out after {config.docker_timeout}s",
                    "output": None,
                }

            stdout_text = stdout.decode("utf-8").strip()
            stderr_text = stderr.decode("utf-8").strip()

            if process.returncode == 0:
                logger.info(f"Docker restart successful: {stdout_text}")
                return {
                    "status": "success",
                    "output": stdout_text or f"Container {container_name} restarted",
                    "error": None,
                }
            else:
                logger.error(f"Docker restart failed: {stderr_text}")
                return {
                    "status": "error",
                    "error": stderr_text or "Docker restart failed",
                    "output": stdout_text,
                }

        except Exception as e:
            logger.error(f"Docker restart exception: {e}", exc_info=True)
            return {"status": "error", "error": str(e), "output": None}


# Example of how to add custom commands:
# executor = CommandExecutor()
# async def my_custom_handler(params: dict) -> dict:
#     return {"status": "success", "output": "custom result", "error": None}
# executor.register("my_command", my_custom_handler)
