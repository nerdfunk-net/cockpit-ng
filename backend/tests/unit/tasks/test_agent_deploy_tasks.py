"""Unit tests for tasks/agent_deploy_tasks.py."""

from __future__ import annotations

from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_PATCH_GIT_SVC = "service_factory.build_git_service"
_PATCH_TEMPLATE_SVC = "service_factory.build_template_service"
_PATCH_RENDER_SVC = "service_factory.build_agent_template_render_service"
_PATCH_GIT_REPO = "repositories.git.git_repository_repository.GitRepositoryRepository"
_PATCH_AGENTS_REPO = "repositories.settings.settings_repository.AgentsSettingRepository"
_PATCH_DEPLOY = "services.agents.deployment_service.AgentDeploymentService.deploy"
_PATCH_DEPLOY_MULTI = "services.agents.deployment_service.AgentDeploymentService.deploy_multi"

from tasks.agent_deploy_tasks import deploy_agent_task


@pytest.mark.unit
class TestDeployAgentTaskSingleTemplate:
    def test_single_template_calls_deploy(self):
        deploy_result = {"success": True, "committed": True}

        with ExitStack() as stack:
            stack.enter_context(patch(_PATCH_GIT_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_TEMPLATE_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_RENDER_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_GIT_REPO))
            stack.enter_context(patch(_PATCH_AGENTS_REPO))
            stack.enter_context(
                patch(_PATCH_DEPLOY, new_callable=AsyncMock, return_value=deploy_result)
            )
            result = deploy_agent_task.run(
                template_id=42,
                custom_variables={"key": "value"},
                agent_id="agent-01",
                path="/etc/agent/config.yaml",
                inventory_id=5,
                activate_after_deploy=True,
                template_entries=None,
            )

        assert result["success"] is True

    def test_single_template_passes_correct_args(self):
        deploy_result = {"success": True}
        deploy_mock = AsyncMock(return_value=deploy_result)

        with ExitStack() as stack:
            stack.enter_context(patch(_PATCH_GIT_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_TEMPLATE_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_RENDER_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_GIT_REPO))
            stack.enter_context(patch(_PATCH_AGENTS_REPO))
            stack.enter_context(patch(_PATCH_DEPLOY, deploy_mock))
            deploy_agent_task.run(
                template_id=10,
                custom_variables=None,
                agent_id="agent-x",
                path="/path/file.yaml",
                inventory_id=None,
                activate_after_deploy=False,
                template_entries=None,
            )

        call_kwargs = deploy_mock.call_args.kwargs
        assert call_kwargs["template_id"] == 10
        assert call_kwargs["agent_id"] == "agent-x"
        assert call_kwargs["activate_after_deploy"] is False


@pytest.mark.unit
class TestDeployAgentTaskMultiTemplate:
    def test_multi_template_calls_deploy_multi(self):
        deploy_result = {"success": True, "files_committed": 2}
        entries = [
            {"template_id": 1, "path": "/etc/agent/t1.yaml"},
            {"template_id": 2, "path": "/etc/agent/t2.yaml"},
        ]

        with ExitStack() as stack:
            stack.enter_context(patch(_PATCH_GIT_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_TEMPLATE_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_RENDER_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_GIT_REPO))
            stack.enter_context(patch(_PATCH_AGENTS_REPO))
            stack.enter_context(
                patch(_PATCH_DEPLOY_MULTI, new_callable=AsyncMock, return_value=deploy_result)
            )
            result = deploy_agent_task.run(
                template_id=None,
                custom_variables=None,
                agent_id="agent-01",
                path=None,
                inventory_id=None,
                activate_after_deploy=True,
                template_entries=entries,
            )

        assert result["success"] is True

    def test_multi_template_passes_entries(self):
        deploy_result = {"success": True}
        deploy_mock = AsyncMock(return_value=deploy_result)
        entries = [{"template_id": 3}]

        with ExitStack() as stack:
            stack.enter_context(patch(_PATCH_GIT_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_TEMPLATE_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_RENDER_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_GIT_REPO))
            stack.enter_context(patch(_PATCH_AGENTS_REPO))
            stack.enter_context(patch(_PATCH_DEPLOY_MULTI, deploy_mock))
            deploy_agent_task.run(
                template_id=None,
                custom_variables=None,
                agent_id="my-agent",
                path=None,
                inventory_id=None,
                activate_after_deploy=False,
                template_entries=entries,
            )

        call_kwargs = deploy_mock.call_args.kwargs
        assert call_kwargs["template_entries"] == entries
        assert call_kwargs["agent_id"] == "my-agent"
