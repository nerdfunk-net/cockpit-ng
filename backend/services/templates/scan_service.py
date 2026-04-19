"""
Template scan service — discovers importable YAML template files on disk.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List

import yaml

from models.templates import ImportableTemplateInfo, TemplateScanImportResponse

logger = logging.getLogger(__name__)


class TemplateScanService:
    """Scans a directory for YAML template descriptor files."""

    def __init__(self, import_dir: Path | None = None) -> None:
        self._import_dir = import_dir or Path("../contributing-data")

    def scan_import_directory(self) -> TemplateScanImportResponse:
        """Return all importable templates found in the configured directory."""
        if not self._import_dir.exists():
            return TemplateScanImportResponse(
                templates=[], total_found=0, message="Import directory not found"
            )

        templates: List[ImportableTemplateInfo] = []
        yaml_files = list(self._import_dir.glob("*.yaml")) + list(
            self._import_dir.glob("*.yml")
        )

        for yaml_file in yaml_files:
            info = self._parse_yaml_file(yaml_file)
            if info is not None:
                templates.append(info)

        return TemplateScanImportResponse(
            templates=templates,
            total_found=len(templates),
            message=f"Found {len(templates)} importable templates",
        )

    def _parse_yaml_file(self, yaml_file: Path) -> ImportableTemplateInfo | None:
        try:
            with open(yaml_file, "r", encoding="utf-8") as fh:
                data = yaml.safe_load(fh)

            if not isinstance(data, dict):
                return None

            if "properties" in data and isinstance(data["properties"], dict):
                props = data["properties"]
                return ImportableTemplateInfo(
                    name=props.get("name", yaml_file.stem),
                    description=props.get("description", "No description available"),
                    category=props.get("category", "default"),
                    source=props.get("source", "file"),
                    file_path=str(yaml_file.absolute()),
                    template_type=props.get("type", props.get("template_type", "jinja2")),
                )

            return ImportableTemplateInfo(
                name=data.get("name", yaml_file.stem),
                description=data.get("description", "No description available"),
                category=data.get("category", "default"),
                source=data.get("source", "file"),
                file_path=str(yaml_file.absolute()),
                template_type=data.get("template_type", "jinja2"),
            )

        except Exception:
            logger.warning("Failed to parse %s", yaml_file, exc_info=True)
            return None
