"""Unit tests for tasks/execution/deploy_agent_executor.py.

Covers execute_deploy_agent() — the executor that renders agent templates and
commits them to Git. Also covers AgentDeploymentService instantiation directly.
All tests run offline — no Git, Nautobot, or database connections required.

REGRESSION TESTS: tests marked with "→ RED before fix" currently fail because
AgentDeploymentService.__init__ calls service_factory.build_template_manager(),
which does not exist. The AttributeError is caught by the executor's except
block and returned as {'success': False}. The fix is to change the call to
service_factory.build_template_service().
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.execution.deploy_agent_executor import execute_deploy_agent

# Patch targets for AgentDeploymentService dependencies
_PATCH_GIT_SVC = "service_factory.build_git_service"
_PATCH_TEMPLATE_SVC = "service_factory.build_template_service"  # correct name (after fix)
_PATCH_RENDER_SVC = "service_factory.build_agent_template_render_service"
_PATCH_SCHEDULE_SVC = "service_factory.build_job_schedule_service"
_PATCH_TEMPLATE_JOB_SVC = "service_factory.build_job_template_service"
_PATCH_GIT_REPO = "repositories.git.git_repository_repository.GitRepositoryRepository"
_PATCH_AGENTS_REPO = "repositories.settings.settings_repository.AgentsSettingRepository"
_PATCH_DEPLOY = "services.agents.deployment_service.AgentDeploymentService.deploy"

_DEPLOY_TEMPLATE = {
    "name": "deploy",
    "deploy_agent_id": "agent-001",
    "deploy_template_id": 99,
    "deploy_path": "/etc/agent/config.conf",
    "deploy_custom_variables": None,
    "activate_after_deploy": False,
    "deploy_templates": None,
}


def _all_service_patches():
    """Return a list of (patch_target, kwargs) pairs for all AgentDeploymentService deps."""
    return [
        (_PATCH_GIT_SVC, {"return_value": MagicMock()}),
        (_PATCH_TEMPLATE_SVC, {"return_value": MagicMock()}),
        (_PATCH_RENDER_SVC, {"return_value": MagicMock()}),
        (_PATCH_SCHEDULE_SVC, {"return_value": MagicMock()}),
        (_PATCH_TEMPLATE_JOB_SVC, {"return_value": MagicMock()}),
        (_PATCH_GIT_REPO, {}),
        (_PATCH_AGENTS_REPO, {}),
    ]


# ── AgentDeploymentService instantiation (direct regression test) ─────────────


@pytest.mark.unit
def test_agent_deployment_service_instantiation():
    """AgentDeploymentService can be constructed when service_factory is correct.

    → RED before fix: build_template_manager() is called instead of
      build_template_service(), raising AttributeError on construction.
    """
    from services.agents.deployment_service import AgentDeploymentService

    with (
        patch(_PATCH_GIT_SVC, return_value=MagicMock()),
        patch(_PATCH_TEMPLATE_SVC, return_value=MagicMock()),
        patch(_PATCH_RENDER_SVC, return_value=MagicMock()),
        patch(_PATCH_GIT_REPO),
        patch(_PATCH_AGENTS_REPO),
    ):
        svc = AgentDeploymentService()

    assert svc.template_manager is not None
    assert svc.agent_template_render_service is not None


# ── happy path ────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_execute_deploy_agent_single_template_success():
    """Valid single-template job → executor builds AgentDeploymentService and calls deploy.

    → RED before fix: AttributeError from build_template_manager causes success=False.
    """
    with (
        patch(_PATCH_GIT_SVC, return_value=MagicMock()),
        patch(_PATCH_TEMPLATE_SVC, return_value=MagicMock()),
        patch(_PATCH_RENDER_SVC, return_value=MagicMock()),
        patch(_PATCH_SCHEDULE_SVC, return_value=MagicMock()),
        patch(_PATCH_TEMPLATE_JOB_SVC, return_value=MagicMock()),
        patch(_PATCH_GIT_REPO),
        patch(_PATCH_AGENTS_REPO),
        patch(_PATCH_DEPLOY, new_callable=AsyncMock, return_value={"success": True, "committed": True}),
    ):
        result = execute_deploy_agent(
            schedule_id=34,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=MagicMock(),
            template=_DEPLOY_TEMPLATE,
            job_run_id=857,
        )

    assert result["success"] is True


# ── missing / incomplete template ─────────────────────────────────────────────


@pytest.mark.unit
def test_execute_deploy_agent_missing_template():
    """No template and no schedule_id → success=False with message about template."""
    result = execute_deploy_agent(
        schedule_id=None,
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
def test_execute_deploy_agent_missing_deploy_agent_id():
    """Template without deploy_agent_id → success=False with message about deploy_agent_id."""
    template = {**_DEPLOY_TEMPLATE, "deploy_agent_id": None}

    with (
        patch(_PATCH_GIT_SVC, return_value=MagicMock()),
        patch(_PATCH_TEMPLATE_SVC, return_value=MagicMock()),
        patch(_PATCH_RENDER_SVC, return_value=MagicMock()),
        patch(_PATCH_SCHEDULE_SVC, return_value=MagicMock()),
        patch(_PATCH_TEMPLATE_JOB_SVC, return_value=MagicMock()),
        patch(_PATCH_GIT_REPO),
        patch(_PATCH_AGENTS_REPO),
    ):
        result = execute_deploy_agent(
            schedule_id=34,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=MagicMock(),
            template=template,
            job_run_id=857,
        )

    assert result["success"] is False
    assert "deploy_agent_id" in result["error"]


@pytest.mark.unit
def test_execute_deploy_agent_missing_deploy_template_id():
    """Single-template path with no deploy_template_id → success=False.

    → RED before fix: AttributeError from build_template_manager fires first,
      so the deploy_template_id check is never reached; the error message is
      about the missing factory attribute, not the missing template id.
    """
    template = {**_DEPLOY_TEMPLATE, "deploy_template_id": None}

    with (
        patch(_PATCH_GIT_SVC, return_value=MagicMock()),
        patch(_PATCH_TEMPLATE_SVC, return_value=MagicMock()),
        patch(_PATCH_RENDER_SVC, return_value=MagicMock()),
        patch(_PATCH_SCHEDULE_SVC, return_value=MagicMock()),
        patch(_PATCH_TEMPLATE_JOB_SVC, return_value=MagicMock()),
        patch(_PATCH_GIT_REPO),
        patch(_PATCH_AGENTS_REPO),
    ):
        result = execute_deploy_agent(
            schedule_id=34,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=MagicMock(),
            template=template,
            job_run_id=857,
        )

    assert result["success"] is False
    assert "deploy_template_id" in result["error"]
