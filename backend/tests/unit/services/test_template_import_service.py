"""Unit tests for TemplateImportService.

All tests run offline - no database or external Git repository required.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from models.templates import TemplateImportRequest
from services.templates.import_service import TemplateImportService


@pytest.mark.unit
def test_import_file_bulk_imports_supported_files() -> None:
    """File bulk import creates templates for supported extensions."""
    template_manager = MagicMock()
    template_manager.get_template_by_name.return_value = None
    template_manager.create_template.side_effect = [1, 2]
    service = TemplateImportService(template_manager)

    result = service.import_templates(
        TemplateImportRequest(
            source_type="file_bulk",
            default_category="netmiko",
            file_contents=[
                {"filename": "router.j2", "content": "hostname {{ name }}"},
                {"filename": "parser.textfsm", "content": "Value HOST (\\S+)"},
                {"filename": "ignore.md", "content": "# docs"},
            ],
        ),
        username="alice",
    )

    assert result.imported_templates == ["router", "parser"]
    assert result.skipped_templates == ["ignore.md"]
    assert result.failed_templates == []
    assert result.total_processed == 3
    first_create = template_manager.create_template.call_args_list[0].args[0]
    second_create = template_manager.create_template.call_args_list[1].args[0]
    assert first_create["category"] == "netmiko"
    assert first_create["created_by"] == "alice"
    assert second_create["template_type"] == "textfsm"
    assert second_create["category"] == "netmiko"


@pytest.mark.unit
def test_import_file_bulk_skips_existing_without_overwrite() -> None:
    """Existing file templates are skipped unless overwrite is requested."""
    template_manager = MagicMock()
    template_manager.get_template_by_name.return_value = {"id": 1, "name": "router"}
    service = TemplateImportService(template_manager)

    result = service.import_templates(
        TemplateImportRequest(
            source_type="file_bulk",
            file_contents=[{"filename": "router.j2", "content": "hostname {{ name }}"}],
            overwrite_existing=False,
        ),
        username="alice",
    )

    assert result.imported_templates == []
    assert result.skipped_templates == ["router"]
    template_manager.create_template.assert_not_called()


@pytest.mark.unit
def test_import_file_bulk_records_create_errors() -> None:
    """Template manager errors are recorded per uploaded file."""
    template_manager = MagicMock()
    template_manager.get_template_by_name.return_value = None
    template_manager.create_template.side_effect = RuntimeError("database unavailable")
    service = TemplateImportService(template_manager)

    result = service.import_templates(
        TemplateImportRequest(
            source_type="file_bulk",
            file_contents=[{"filename": "router.j2", "content": "hostname {{ name }}"}],
        ),
        username="alice",
    )

    assert result.imported_templates == []
    assert result.failed_templates == ["router.j2"]
    assert result.errors == {"router.j2": "database unavailable"}


@pytest.mark.unit
def test_import_yaml_bulk_reads_descriptor_and_template_file(tmp_path) -> None:
    """YAML bulk import reads descriptor metadata and referenced template content."""
    template_file = tmp_path / "router.j2"
    template_file.write_text("hostname {{ name }}", encoding="utf-8")
    descriptor = tmp_path / "router.yaml"
    descriptor.write_text(
        "\n".join(
            [
                f"path: {template_file}",
                "properties:",
                "  name: router_config",
                "  source: file",
                "  type: jinja2",
                "  category: netmiko",
                "  description: Router configuration",
            ]
        ),
        encoding="utf-8",
    )
    template_manager = MagicMock()
    template_manager.get_template_by_name.return_value = None
    template_manager.create_template.return_value = 99
    service = TemplateImportService(template_manager)

    result = service.import_templates(
        TemplateImportRequest(
            source_type="yaml_bulk",
            yaml_file_paths=[str(descriptor)],
            default_category="default",
        ),
        username="alice",
    )

    assert result.imported_templates == ["router_config"]
    assert result.failed_templates == []
    create_payload = template_manager.create_template.call_args.args[0]
    assert create_payload["content"] == "hostname {{ name }}"
    assert create_payload["filename"] == "router.j2"
    assert create_payload["description"] == "Router configuration"
    assert create_payload["created_by"] == "alice"


@pytest.mark.unit
def test_import_yaml_bulk_records_descriptor_errors(tmp_path) -> None:
    """Invalid YAML descriptors are reported as failed imports."""
    descriptor = tmp_path / "missing-path.yaml"
    descriptor.write_text("properties:\n  name: bad\n", encoding="utf-8")
    service = TemplateImportService(MagicMock())

    result = service.import_templates(
        TemplateImportRequest(
            source_type="yaml_bulk", yaml_file_paths=[str(descriptor)]
        ),
        username="alice",
    )

    assert result.imported_templates == []
    assert result.failed_templates == [str(descriptor)]
    assert result.errors[str(descriptor)] == "No template path specified in YAML"


@pytest.mark.unit
def test_import_templates_rejects_unknown_source() -> None:
    """Unsupported import sources raise ValueError."""
    service = TemplateImportService(MagicMock())

    with pytest.raises(ValueError, match="Unsupported import source type"):
        service.import_templates(
            TemplateImportRequest(source_type="unknown"),
            username="alice",
        )
