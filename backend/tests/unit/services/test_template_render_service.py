"""Unit tests for services/agents/template_render_service.py."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.agents.template_render_service import AgentTemplateRenderService

_PATCH_DEVICE_QUERY = "service_factory.build_device_query_service"
_PATCH_CHECKMK_CONFIG = "service_factory.build_checkmk_config_service"
_PATCH_NAUTOBOT = "service_factory.build_nautobot_service"
_PATCH_NAUTOBOT_META = "service_factory.build_nautobot_metadata_service"


@pytest.mark.unit
def test_extract_template_variables_deduplicates() -> None:
    content = "Hello {{ name }} and {{ device.id }} {{ name }}"
    vars_used = AgentTemplateRenderService.extract_template_variables(content)
    assert vars_used == ["device.id", "name"]


@pytest.mark.unit
def test_populate_custom_variable_parses_json() -> None:
    svc = AgentTemplateRenderService()
    result = svc._populate_custom_variable({"value": '["a", "b"]'})
    assert result == ["a", "b"]


@pytest.mark.unit
def test_populate_custom_variable_returns_raw_string() -> None:
    svc = AgentTemplateRenderService()
    result = svc._populate_custom_variable({"value": "plain-text"})
    assert result == "plain-text"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_render_agent_template_simple_jinja() -> None:
    svc = AgentTemplateRenderService()
    mock_config = MagicMock()
    mock_config.load_snmp_mapping.return_value = {"public": "public"}

    with patch(_PATCH_DEVICE_QUERY, return_value=MagicMock()):
        with patch(_PATCH_CHECKMK_CONFIG, return_value=mock_config):
            result = await svc.render_agent_template(
                template_content="host: {{ hostname }}\n",
                inventory_id=None,
                pass_snmp_mapping=False,
                user_variables={"hostname": "web01"},
            )

    assert "host: web01" in result.rendered_content
    assert "hostname" in result.variables_used


@pytest.mark.asyncio
@pytest.mark.unit
async def test_render_agent_template_undefined_variable_raises() -> None:
    svc = AgentTemplateRenderService()

    with patch(_PATCH_DEVICE_QUERY, return_value=MagicMock()):
        with patch(_PATCH_CHECKMK_CONFIG, return_value=MagicMock()):
            with pytest.raises(ValueError, match="Template syntax error"):
                await svc.render_agent_template(
                    template_content="{% if %}",
                    inventory_id=None,
                    pass_snmp_mapping=False,
                )


@pytest.mark.asyncio
@pytest.mark.unit
async def test_populate_stored_variables_legacy_plain_value() -> None:
    svc = AgentTemplateRenderService()
    result = await svc._populate_stored_variables(
        {"foo": "bar"},
        username="alice",
    )
    assert result == {"foo": "bar"}


@pytest.mark.asyncio
@pytest.mark.unit
async def test_render_agent_template_loads_snmp_mapping() -> None:
    svc = AgentTemplateRenderService()
    mock_config = MagicMock()
    mock_config.load_snmp_mapping.return_value = {"public": "public"}

    with patch(_PATCH_DEVICE_QUERY, return_value=MagicMock()):
        with patch(_PATCH_CHECKMK_CONFIG, return_value=mock_config):
            result = await svc.render_agent_template(
                template_content="snmp: {{ snmp_mapping | length }}\n",
                inventory_id=None,
                pass_snmp_mapping=True,
                user_variables={},
            )

    assert "snmp: 1" in result.rendered_content


@pytest.mark.asyncio
@pytest.mark.unit
async def test_populate_stored_variables_custom_type() -> None:
    svc = AgentTemplateRenderService()
    stored = {"port": {"type": "custom", "value": "tcp/8080"}}

    result = await svc._populate_stored_variables(stored, username="alice")

    assert result["port"] == "tcp/8080"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_populate_stored_variables_unknown_type_treated_as_custom() -> None:
    svc = AgentTemplateRenderService()
    stored = {"x": {"type": "unknown", "value": "enabled"}}

    result = await svc._populate_stored_variables(stored, username=None)

    assert result["x"] == "enabled"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_populate_nautobot_variable_tags() -> None:
    svc = AgentTemplateRenderService()
    mock_nautobot = MagicMock()
    mock_nautobot.rest_request = AsyncMock(return_value={"results": [{"name": "prod"}]})

    with patch(_PATCH_NAUTOBOT, return_value=mock_nautobot):
        with patch(_PATCH_NAUTOBOT_META, return_value=MagicMock()):
            result = await svc._populate_nautobot_variable(
                {"metadata": {"nautobot_source": "tags"}}
            )

    assert result == [{"name": "prod"}]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_populate_yaml_variable_reads_file(tmp_path) -> None:
    svc = AgentTemplateRenderService()
    repo_dir = tmp_path / "clone"
    repo_dir.mkdir()
    (repo_dir / "vars.yaml").write_text("key: value\n", encoding="utf-8")

    mock_manager = MagicMock()
    mock_manager.get_repository.return_value = {"id": 1, "name": "cfg"}

    with patch(
        "services.git.repository_service.GitRepositoryService",
        return_value=mock_manager,
    ):
        with patch("services.git.paths.repo_path", return_value=repo_dir):
            result = await svc._populate_yaml_variable(
                {
                    "metadata": {
                        "yaml_file_id": 1,
                        "yaml_file_path": "vars.yaml",
                    }
                }
            )

    assert result == {"key": "value"}


@pytest.mark.asyncio
@pytest.mark.unit
async def test_populate_yaml_variable_rejects_path_traversal(tmp_path) -> None:
    svc = AgentTemplateRenderService()
    repo_dir = tmp_path / "clone"
    repo_dir.mkdir()
    mock_manager = MagicMock()
    mock_manager.get_repository.return_value = {"id": 1, "name": "cfg"}

    with patch(
        "services.git.repository_service.GitRepositoryService",
        return_value=mock_manager,
    ):
        with patch("services.git.paths.repo_path", return_value=repo_dir):
            with pytest.raises(ValueError, match="path traversal"):
                await svc._populate_yaml_variable(
                    {
                        "metadata": {
                            "yaml_file_id": 1,
                            "yaml_file_path": "../../etc/passwd",
                        }
                    }
                )


@pytest.mark.asyncio
@pytest.mark.unit
async def test_populate_inventory_variable_uses_cache() -> None:
    svc = AgentTemplateRenderService()
    mock_inventory = MagicMock()
    mock_inventory.analyze_inventory = AsyncMock(
        return_value={"locations": ["Site A"], "tags": []}
    )
    cache = {5: {"locations": ["Cached"]}}

    with patch("service_factory.build_inventory_service", return_value=mock_inventory):
        result = await svc._populate_inventory_variable(
            {
                "metadata": {
                    "inventory_id": 5,
                    "inventory_data_type": "locations",
                }
            },
            username="alice",
            inventory_cache=cache,
        )

    assert result == ["Cached"]
    mock_inventory.analyze_inventory.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_populate_stored_variables_yaml_type(tmp_path) -> None:
    svc = AgentTemplateRenderService()
    repo_dir = tmp_path / "clone"
    repo_dir.mkdir()
    (repo_dir / "data.yaml").write_text("count: 3\n", encoding="utf-8")
    mock_manager = MagicMock()
    mock_manager.get_repository.return_value = {"id": 2, "name": "repo"}

    with patch(
        "services.git.repository_service.GitRepositoryService",
        return_value=mock_manager,
    ):
        with patch("services.git.paths.repo_path", return_value=repo_dir):
            result = await svc._populate_stored_variables(
                {
                    "cfg": {
                        "type": "yaml",
                        "metadata": {
                            "yaml_file_id": 2,
                            "yaml_file_path": "data.yaml",
                        },
                    }
                },
                username="bob",
            )

    assert result["cfg"]["count"] == 3


@pytest.mark.asyncio
@pytest.mark.unit
async def test_render_agent_template_with_inventory_devices() -> None:
    svc = AgentTemplateRenderService()
    mock_device = MagicMock()
    mock_device.id = "uuid-1"
    mock_device.name = "router1"
    mock_device.primary_ip4 = "10.0.0.1/24"

    mock_inventory_svc = MagicMock()
    mock_inventory_svc.preview_inventory = AsyncMock(return_value=([mock_device], {}))

    mock_persistence = MagicMock()
    mock_persistence.get_inventory.return_value = {
        "id": 5,
        "conditions": [{"field": "name", "operator": "contains", "value": "r"}],
    }

    mock_device_query = MagicMock()
    mock_device_query.get_device_details = AsyncMock(
        return_value={"name": "router1", "status": "active"}
    )

    with patch(_PATCH_DEVICE_QUERY, return_value=mock_device_query):
        with patch(_PATCH_CHECKMK_CONFIG, return_value=MagicMock()):
            with patch(
                "service_factory.build_inventory_persistence_service",
                return_value=mock_persistence,
            ):
                with patch(
                    "service_factory.build_inventory_service",
                    return_value=mock_inventory_svc,
                ):
                    with patch(
                        "utils.inventory_converter.convert_saved_inventory_to_operations",
                        return_value=[],
                    ):
                        result = await svc.render_agent_template(
                            template_content="count: {{ devices | length }}\n",
                            inventory_id=5,
                            pass_snmp_mapping=False,
                            user_variables={},
                            username="alice",
                        )

    assert "count: 1" in result.rendered_content


@pytest.mark.asyncio
@pytest.mark.unit
async def test_render_agent_template_undefined_jinja_variable() -> None:
    svc = AgentTemplateRenderService()

    with patch(_PATCH_DEVICE_QUERY, return_value=MagicMock()):
        with patch(_PATCH_CHECKMK_CONFIG, return_value=MagicMock()):
            with pytest.raises(ValueError, match="Undefined variable"):
                await svc.render_agent_template(
                    template_content="hello {{ not_defined.attr }}\n",
                    inventory_id=None,
                    pass_snmp_mapping=False,
                    user_variables={},
                )


@pytest.mark.asyncio
@pytest.mark.unit
async def test_populate_nautobot_variable_locations() -> None:
    svc = AgentTemplateRenderService()
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={"data": {"locations": [{"id": "1", "name": "DC"}]}}
    )

    with patch(_PATCH_NAUTOBOT, return_value=mock_nb):
        with patch(_PATCH_NAUTOBOT_META, return_value=MagicMock()):
            result = await svc._populate_nautobot_variable(
                {"metadata": {"nautobot_source": "locations"}}
            )

    assert result == [{"id": "1", "name": "DC"}]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_populate_inventory_variable_custom_field_subset() -> None:
    svc = AgentTemplateRenderService()
    mock_inventory = MagicMock()
    mock_inventory.analyze_inventory = AsyncMock(
        return_value={
            "custom_fields": {"site": ["DC1", "DC2"], "other": []},
        }
    )

    with patch("service_factory.build_inventory_service", return_value=mock_inventory):
        result = await svc._populate_inventory_variable(
            {
                "metadata": {
                    "inventory_id": 3,
                    "inventory_data_type": "custom_fields",
                    "inventory_custom_field": "site",
                }
            },
            username="bob",
        )

    assert result == ["DC1", "DC2"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_render_agent_template_includes_path_in_context() -> None:
    svc = AgentTemplateRenderService()

    with patch(_PATCH_DEVICE_QUERY, return_value=MagicMock()):
        with patch(_PATCH_CHECKMK_CONFIG, return_value=MagicMock()):
            result = await svc.render_agent_template(
                template_content="path={{ path }}\n",
                inventory_id=None,
                pass_snmp_mapping=False,
                user_variables={},
                path="/etc/agent",
            )

    assert result.rendered_content.strip() == "path=/etc/agent"
