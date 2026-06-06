"""Unit tests for services/agents/deployment_service.py."""

from __future__ import annotations

from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_PATCH_SF = "service_factory"
_PATCH_AGENTS_REPO = "repositories.settings.settings_repository.AgentsSettingRepository"
_PATCH_GIT_REPO = "repositories.git.git_repository_repository.GitRepositoryRepository"


def _agents_settings(agents: list | None = None) -> SimpleNamespace:
    return SimpleNamespace(agents=agents or [])


def _git_repo(**kwargs: object) -> SimpleNamespace:
    defaults = {
        "id": 1,
        "name": "agents-repo",
        "url": "https://git.example.com/agents.git",
        "branch": "main",
        "auth_type": "token",
        "credential_name": None,
        "path": "/tmp/repo",
        "verify_ssl": True,
        "git_author_name": "Cockpit",
        "git_author_email": "cockpit@example.com",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _deployment_service(
    *,
    agents: list | None = None,
    git_repo: SimpleNamespace | None = None,
    pull_success: bool = True,
    commit_success: bool = True,
) -> tuple:
    """Build AgentDeploymentService with mocked dependencies."""
    from services.agents.deployment_service import AgentDeploymentService

    agents_repo = MagicMock()
    agents_repo.get_settings.return_value = _agents_settings(
        agents
        or [
            {
                "agent_id": "grafana-01",
                "name": "Grafana Agent",
                "git_repository_id": 1,
            }
        ]
    )

    git_repo_repo = MagicMock()
    git_repo_repo.get_by_id.return_value = git_repo or _git_repo()

    git_service = MagicMock()
    git_service.open_or_clone.return_value = MagicMock()
    git_service.get_repo_path.return_value = "/tmp/repo/work"
    pull_result = MagicMock(success=pull_success, message="ok")
    git_service.pull.return_value = pull_result

    commit_result = MagicMock(
        success=commit_success,
        message="pushed" if commit_success else "push failed",
        commit_sha="abc123def456",
        files_changed=1,
        pushed=commit_success,
    )
    git_service.commit_and_push.return_value = commit_result

    template_mgr = MagicMock()
    template_mgr.get_template.return_value = {
        "name": "agent-config",
        "inventory_id": None,
        "pass_snmp_mapping": False,
        "file_path": "configs/agent.yml",
        "variables": {},
    }
    template_mgr.get_template_content.return_value = "content: {{ var }}"

    render_svc = MagicMock()
    render_result = MagicMock(rendered_content="rendered-yaml")
    render_svc.render_agent_template = AsyncMock(return_value=render_result)

    stack = ExitStack()
    stack.enter_context(
        patch(f"{_PATCH_SF}.build_git_service", return_value=git_service)
    )
    stack.enter_context(
        patch(f"{_PATCH_SF}.build_template_service", return_value=template_mgr)
    )
    stack.enter_context(
        patch(
            f"{_PATCH_SF}.build_agent_template_render_service",
            return_value=render_svc,
        )
    )
    stack.enter_context(patch(_PATCH_AGENTS_REPO, return_value=agents_repo))
    stack.enter_context(patch(_PATCH_GIT_REPO, return_value=git_repo_repo))

    svc = AgentDeploymentService()
    return svc, stack, git_service, render_svc


@pytest.mark.unit
def test_load_agent_config_missing_agents_raises() -> None:
    svc, stack, _, _ = _deployment_service()
    svc.agents_repository.get_settings.return_value = _agents_settings(agents=None)
    with stack:
        with pytest.raises(ValueError, match="No agents configured"):
            svc._load_agent_config("missing")


@pytest.mark.unit
def test_load_agent_config_unknown_agent_raises() -> None:
    svc, stack, _, _ = _deployment_service()
    with stack:
        with pytest.raises(ValueError, match="not found"):
            svc._load_agent_config("unknown-id")


@pytest.mark.unit
def test_load_git_repository_missing_repo_id_raises() -> None:
    svc, stack, _, _ = _deployment_service(
        agents=[{"agent_id": "a1", "name": "Agent", "git_repository_id": None}]
    )
    with stack:
        with pytest.raises(ValueError, match="No git repository"):
            svc._load_git_repository({"name": "Agent"})


@pytest.mark.unit
def test_repo_to_dict_maps_fields() -> None:
    from services.agents.deployment_service import AgentDeploymentService

    repo = _git_repo(id=5, name="r1")
    result = AgentDeploymentService._repo_to_dict(repo)

    assert result["id"] == 5
    assert result["name"] == "r1"
    assert result["url"] == repo.url


@pytest.mark.unit
def test_update_progress_calls_task_context() -> None:
    from services.agents.deployment_service import AgentDeploymentService

    task = MagicMock()
    AgentDeploymentService._update_progress(task, 50, "Halfway")

    task.update_state.assert_called_once()
    assert task.update_state.call_args.kwargs["meta"]["current"] == 50


@pytest.mark.asyncio
@pytest.mark.unit
async def test_deploy_success_without_activation(tmp_path) -> None:
    svc, stack, _, _ = _deployment_service()
    with stack:
        with patch.object(svc, "_write_file") as write_file:
            result = await svc.deploy(
                template_id=1,
                agent_id="grafana-01",
                activate_after_deploy=False,
                username="alice",
            )

    assert result["success"] is True
    assert result["agent_id"] == "grafana-01"
    assert result["commit_sha"] == "abc123def456"
    write_file.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_deploy_setup_failure_returns_error() -> None:
    svc, stack, _, _ = _deployment_service()
    with stack:
        with patch.object(
            svc,
            "_setup_deployment",
            side_effect=ValueError("bad config"),
        ):
            result = await svc.deploy(template_id=1, agent_id="grafana-01")

    assert result["success"] is False
    assert "bad config" in result["error"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_deploy_multi_all_renders_fail() -> None:
    svc, stack, _, render_svc = _deployment_service()
    render_svc.render_agent_template = AsyncMock(side_effect=ValueError("render fail"))
    with stack:
        with patch.object(svc, "_write_file"):
            result = await svc.deploy_multi(
                template_entries=[{"template_id": 1}],
                agent_id="grafana-01",
                activate_after_deploy=False,
            )

    assert result["success"] is False
    assert "All template renders failed" in result["error"]


@pytest.mark.unit
def test_activate_agent_skipped_without_agent_id() -> None:
    svc, stack, _, _ = _deployment_service()
    with stack:
        result = svc._activate_agent(
            cockpit_agent_id=None,
            agent_name="Agent",
            username="alice",
        )

    assert "activation_warning" in result
    assert result.get("activated") is not True


@pytest.mark.unit
def test_activate_agent_git_pull_failure() -> None:
    svc, stack, _, _ = _deployment_service()
    cockpit = MagicMock()
    cockpit.send_git_pull.return_value = {"status": "error", "error": "denied"}

    mock_db = MagicMock()
    with stack:
        with patch("core.database.SessionLocal", return_value=mock_db):
            with patch(
                "services.cockpit_agent.cockpit_agent_service.CockpitAgentService",
                return_value=cockpit,
            ):
                result = svc._activate_agent(
                    cockpit_agent_id="grafana-01",
                    agent_name="Agent",
                    username="alice",
                )

    assert result["activated"] is False
    mock_db.close.assert_called_once()
