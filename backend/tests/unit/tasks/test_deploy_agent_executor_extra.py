"""Additional coverage tests for tasks/execution/deploy_agent_executor.py.

Covers: schedule→template lookup, JSON string parsing for deploy_templates and
deploy_custom_variables, multi-template with inventory resolution, and exception path.
"""

from __future__ import annotations

import json
from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.execution.deploy_agent_executor import execute_deploy_agent

_PATCH_GIT_SVC = "service_factory.build_git_service"
_PATCH_TEMPLATE_SVC = "service_factory.build_template_service"
_PATCH_RENDER_SVC = "service_factory.build_agent_template_render_service"
_PATCH_SCHEDULE_SVC = "service_factory.build_job_schedule_service"
_PATCH_TEMPLATE_JOB_SVC = "service_factory.build_job_template_service"
_PATCH_GIT_REPO = "repositories.git.git_repository_repository.GitRepositoryRepository"
_PATCH_AGENTS_REPO = "repositories.settings.settings_repository.AgentsSettingRepository"
_PATCH_INVENTORY_SVC = "service_factory.build_inventory_persistence_service"
_PATCH_DEPLOY = "services.agents.deployment_service.AgentDeploymentService.deploy"
_PATCH_DEPLOY_MULTI = "services.agents.deployment_service.AgentDeploymentService.deploy_multi"

_BASE_TEMPLATE = {
    "name": "deploy",
    "deploy_agent_id": "agent-001",
    "deploy_template_id": 99,
    "deploy_path": "/etc/agent/config.conf",
    "deploy_custom_variables": None,
    "activate_after_deploy": False,
    "deploy_templates": None,
}


def _all_patches(stack: ExitStack, extra: list | None = None):
    stack.enter_context(patch(_PATCH_GIT_SVC, return_value=MagicMock()))
    stack.enter_context(patch(_PATCH_TEMPLATE_SVC, return_value=MagicMock()))
    stack.enter_context(patch(_PATCH_RENDER_SVC, return_value=MagicMock()))
    stack.enter_context(patch(_PATCH_GIT_REPO))
    stack.enter_context(patch(_PATCH_AGENTS_REPO))
    stack.enter_context(patch(_PATCH_SCHEDULE_SVC, return_value=MagicMock()))
    stack.enter_context(patch(_PATCH_TEMPLATE_JOB_SVC, return_value=MagicMock()))
    for p in extra or []:
        stack.enter_context(p)


@pytest.mark.unit
class TestScheduleToTemplateLookup:
    def test_resolves_template_from_schedule_when_no_template_provided(self):
        schedule = {"job_template_id": 7}
        template = {**_BASE_TEMPLATE}
        sched_svc = MagicMock()
        sched_svc.get_job_schedule.return_value = schedule
        tmpl_svc = MagicMock()
        tmpl_svc.get_job_template.return_value = template
        deploy_result = {"success": True}

        with ExitStack() as stack:
            _all_patches(stack)
            stack.enter_context(patch(_PATCH_SCHEDULE_SVC, return_value=sched_svc))
            stack.enter_context(patch(_PATCH_TEMPLATE_JOB_SVC, return_value=tmpl_svc))
            stack.enter_context(
                patch(_PATCH_DEPLOY, new_callable=AsyncMock, return_value=deploy_result)
            )
            result = execute_deploy_agent(
                schedule_id=3,
                credential_id=None,
                job_parameters=None,
                target_devices=None,
                task_context=MagicMock(),
                template=None,
                job_run_id=None,
            )

        assert result["success"] is True
        sched_svc.get_job_schedule.assert_called_once_with(3)
        tmpl_svc.get_job_template.assert_called_once_with(7)

    def test_returns_error_when_schedule_has_no_template(self):
        sched_svc = MagicMock()
        sched_svc.get_job_schedule.return_value = {"job_template_id": None}
        tmpl_svc = MagicMock()
        tmpl_svc.get_job_template.return_value = None

        with ExitStack() as stack:
            _all_patches(stack)
            stack.enter_context(patch(_PATCH_SCHEDULE_SVC, return_value=sched_svc))
            stack.enter_context(patch(_PATCH_TEMPLATE_JOB_SVC, return_value=tmpl_svc))
            result = execute_deploy_agent(
                schedule_id=3,
                credential_id=None,
                job_parameters=None,
                target_devices=None,
                task_context=MagicMock(),
                template=None,
                job_run_id=None,
            )

        assert result["success"] is False
        assert "template" in result["error"].lower()


@pytest.mark.unit
class TestDeployTemplatesJsonString:
    def test_parses_deploy_templates_json_string(self):
        entries = [{"template_id": 1, "path": "/etc/t1.yaml"}]
        template = {**_BASE_TEMPLATE, "deploy_templates": json.dumps(entries)}
        deploy_result = {"success": True, "files_committed": 1}

        with ExitStack() as stack:
            _all_patches(stack)
            stack.enter_context(
                patch(_PATCH_DEPLOY_MULTI, new_callable=AsyncMock, return_value=deploy_result)
            )
            result = execute_deploy_agent(
                schedule_id=None,
                credential_id=None,
                job_parameters=None,
                target_devices=None,
                task_context=MagicMock(),
                template=template,
                job_run_id=None,
            )

        assert result["success"] is True

    def test_invalid_deploy_templates_json_falls_back_to_single(self):
        template = {**_BASE_TEMPLATE, "deploy_templates": "not-valid-json"}
        deploy_result = {"success": True}

        with ExitStack() as stack:
            _all_patches(stack)
            stack.enter_context(
                patch(_PATCH_DEPLOY, new_callable=AsyncMock, return_value=deploy_result)
            )
            result = execute_deploy_agent(
                schedule_id=None,
                credential_id=None,
                job_parameters=None,
                target_devices=None,
                task_context=MagicMock(),
                template=template,
                job_run_id=None,
            )

        assert result["success"] is True


@pytest.mark.unit
class TestDeployCustomVariablesJsonString:
    def test_parses_custom_variables_json_string(self):
        variables = {"env": "prod", "region": "eu"}
        template = {**_BASE_TEMPLATE, "deploy_custom_variables": json.dumps(variables)}
        deploy_result = {"success": True}
        deploy_mock = AsyncMock(return_value=deploy_result)

        with ExitStack() as stack:
            _all_patches(stack)
            stack.enter_context(patch(_PATCH_DEPLOY, deploy_mock))
            result = execute_deploy_agent(
                schedule_id=None,
                credential_id=None,
                job_parameters=None,
                target_devices=None,
                task_context=MagicMock(),
                template=template,
                job_run_id=None,
            )

        assert result["success"] is True
        call_kwargs = deploy_mock.call_args.kwargs
        assert call_kwargs["custom_variables"] == variables

    def test_invalid_custom_variables_json_treated_as_none(self):
        template = {**_BASE_TEMPLATE, "deploy_custom_variables": "{bad-json"}
        deploy_result = {"success": True}
        deploy_mock = AsyncMock(return_value=deploy_result)

        with ExitStack() as stack:
            _all_patches(stack)
            stack.enter_context(patch(_PATCH_DEPLOY, deploy_mock))
            result = execute_deploy_agent(
                schedule_id=None,
                credential_id=None,
                job_parameters=None,
                target_devices=None,
                task_context=MagicMock(),
                template=template,
                job_run_id=None,
            )

        assert result["success"] is True
        call_kwargs = deploy_mock.call_args.kwargs
        assert call_kwargs["custom_variables"] is None


@pytest.mark.unit
class TestInventoryResolution:
    def test_resolves_inventory_in_single_template_path(self):
        inv = {"id": 77, "name": "prod-inv"}
        template = {
            **_BASE_TEMPLATE,
            "inventory_name": "prod-inv",
            "inventory_source": "inventory",
        }
        deploy_result = {"success": True}
        deploy_mock = AsyncMock(return_value=deploy_result)
        inv_svc = MagicMock()
        inv_svc.get_inventory_by_name.return_value = inv

        with ExitStack() as stack:
            _all_patches(stack)
            stack.enter_context(patch(_PATCH_INVENTORY_SVC, return_value=inv_svc))
            stack.enter_context(patch(_PATCH_DEPLOY, deploy_mock))
            result = execute_deploy_agent(
                schedule_id=None,
                credential_id=None,
                job_parameters=None,
                target_devices=None,
                task_context=MagicMock(),
                template=template,
                job_run_id=None,
            )

        assert result["success"] is True
        call_kwargs = deploy_mock.call_args.kwargs
        assert call_kwargs["inventory_id"] == 77

    def test_resolves_inventory_in_multi_template_path(self):
        inv = {"id": 55}
        entries = [{"template_id": 1, "path": "/t1.yaml", "inventory_id": None}]
        template = {
            **_BASE_TEMPLATE,
            "deploy_templates": entries,
            "inventory_name": "prod",
            "inventory_source": "inventory",
        }
        deploy_result = {"success": True}
        deploy_mock = AsyncMock(return_value=deploy_result)
        inv_svc = MagicMock()
        inv_svc.get_inventory_by_name.return_value = inv

        with ExitStack() as stack:
            _all_patches(stack)
            stack.enter_context(patch(_PATCH_INVENTORY_SVC, return_value=inv_svc))
            stack.enter_context(patch(_PATCH_DEPLOY_MULTI, deploy_mock))
            result = execute_deploy_agent(
                schedule_id=None,
                credential_id=None,
                job_parameters=None,
                target_devices=None,
                task_context=MagicMock(),
                template=template,
                job_run_id=None,
            )

        assert result["success"] is True
        call_kwargs = deploy_mock.call_args.kwargs
        assert call_kwargs["template_entries"][0]["inventory_id"] == 55


@pytest.mark.unit
class TestExceptionHandling:
    def test_returns_failure_on_unexpected_exception(self):
        with ExitStack() as stack:
            stack.enter_context(patch(_PATCH_GIT_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_TEMPLATE_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_RENDER_SVC, return_value=MagicMock()))
            stack.enter_context(patch(_PATCH_GIT_REPO))
            stack.enter_context(patch(_PATCH_AGENTS_REPO))
            stack.enter_context(
                patch(_PATCH_SCHEDULE_SVC, side_effect=RuntimeError("unexpected crash"))
            )
            result = execute_deploy_agent(
                schedule_id=5,
                credential_id=None,
                job_parameters=None,
                target_devices=None,
                task_context=MagicMock(),
                template=None,
                job_run_id=None,
            )

        assert result["success"] is False
        assert "unexpected crash" in result["error"]
