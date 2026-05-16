"""Unit tests for TemplateScanService.

All tests run offline - filesystem access is limited to pytest tmp_path.
"""

from __future__ import annotations

import pytest

from services.templates.scan_service import TemplateScanService


@pytest.mark.unit
def test_scan_import_directory_missing_dir_returns_empty_response(tmp_path) -> None:
    """Missing import directories return an empty scan response."""
    service = TemplateScanService(import_dir=tmp_path / "missing")

    result = service.scan_import_directory()

    assert result.templates == []
    assert result.total_found == 0
    assert result.message == "Import directory not found"


@pytest.mark.unit
def test_scan_import_directory_finds_yaml_and_yml_descriptors(tmp_path) -> None:
    """The scan discovers both .yaml and .yml template descriptors."""
    (tmp_path / "router.yaml").write_text(
        "\n".join(
            [
                "properties:",
                "  name: router_config",
                "  description: Router config",
                "  category: netmiko",
                "  source: file",
                "  type: jinja2",
            ]
        ),
        encoding="utf-8",
    )
    (tmp_path / "parser.yml").write_text(
        "\n".join(
            [
                "name: parser_template",
                "description: Parser",
                "category: parser",
                "source: file",
                "template_type: textfsm",
            ]
        ),
        encoding="utf-8",
    )
    (tmp_path / "ignored.txt").write_text("not yaml", encoding="utf-8")

    result = TemplateScanService(import_dir=tmp_path).scan_import_directory()

    assert result.total_found == 2
    names = {template.name for template in result.templates}
    assert names == {"router_config", "parser_template"}
    by_name = {template.name: template for template in result.templates}
    assert by_name["router_config"].template_type == "jinja2"
    assert by_name["parser_template"].template_type == "textfsm"
    assert result.message == "Found 2 importable templates"


@pytest.mark.unit
def test_scan_import_directory_skips_invalid_yaml_documents(tmp_path) -> None:
    """Non-dict YAML documents are ignored."""
    (tmp_path / "invalid.yaml").write_text("- just\n- a\n- list\n", encoding="utf-8")

    result = TemplateScanService(import_dir=tmp_path).scan_import_directory()

    assert result.templates == []
    assert result.total_found == 0


@pytest.mark.unit
def test_scan_import_directory_returns_defaults_for_minimal_descriptor(tmp_path) -> None:
    """Minimal descriptors use filename-derived and default metadata."""
    descriptor = tmp_path / "minimal.yaml"
    descriptor.write_text("name: minimal\n", encoding="utf-8")

    scan = TemplateScanService(import_dir=tmp_path).scan_import_directory()

    assert scan.total_found == 1
    result = scan.templates[0]
    assert result is not None
    assert result.name == "minimal"
    assert result.description == "No description available"
    assert result.category == "default"
    assert result.source == "file"
    assert result.template_type == "jinja2"
    assert result.file_path == str(descriptor.absolute())


@pytest.mark.unit
def test_scan_import_directory_skips_malformed_yaml(tmp_path) -> None:
    """Malformed YAML descriptors are ignored."""
    descriptor = tmp_path / "broken.yaml"
    descriptor.write_text("name: [unterminated\n", encoding="utf-8")

    result = TemplateScanService(import_dir=tmp_path).scan_import_directory()

    assert result.templates == []
    assert result.total_found == 0
