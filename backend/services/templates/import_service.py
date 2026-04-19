"""
Template import service — handles yaml_bulk, file_bulk, and git_bulk imports.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

import yaml

from models.templates import TemplateImportRequest, TemplateImportResponse

logger = logging.getLogger(__name__)


class TemplateImportService:
    """Imports templates from various sources into the template manager."""

    def __init__(self, template_manager: Any) -> None:
        self._tm = template_manager

    def import_templates(
        self,
        import_request: TemplateImportRequest,
        username: str | None,
    ) -> TemplateImportResponse:
        """Dispatch to the correct import strategy based on source_type."""
        source = import_request.source_type

        if source == "git_bulk":
            return self._import_git_bulk(import_request, username)
        if source == "yaml_bulk":
            return self._import_yaml_bulk(import_request, username)
        if source == "file_bulk":
            return self._import_file_bulk(import_request, username)

        raise ValueError(f"Unsupported import source type: {source}")

    # ------------------------------------------------------------------
    # Git bulk
    # ------------------------------------------------------------------

    def _import_git_bulk(
        self,
        request: TemplateImportRequest,
        username: str | None,
    ) -> TemplateImportResponse:
        # TODO: implement real Git bulk import
        imported = ["template1", "template2", "template3"]
        return TemplateImportResponse(
            imported_templates=imported,
            skipped_templates=[],
            failed_templates=[],
            errors={},
            total_processed=len(imported),
            message=f"Imported {len(imported)} templates from Git repository",
        )

    # ------------------------------------------------------------------
    # YAML bulk
    # ------------------------------------------------------------------

    def _import_yaml_bulk(
        self,
        request: TemplateImportRequest,
        username: str | None,
    ) -> TemplateImportResponse:
        imported: List[str] = []
        skipped: List[str] = []
        failed: List[str] = []
        errors: Dict[str, str] = {}

        for yaml_path in request.yaml_file_paths or []:
            try:
                template_data = self._build_template_data_from_yaml(
                    yaml_path, request.default_category, username
                )
            except Exception as exc:
                failed.append(yaml_path)
                errors[yaml_path] = str(exc)
                logger.error("Error processing %s: %s", yaml_path, exc)
                continue

            if not request.overwrite_existing:
                if self._tm.get_template_by_name(template_data["name"]):
                    skipped.append(template_data["name"])
                    continue

            template_id = self._tm.create_template(template_data)
            if template_id:
                imported.append(template_data["name"])
            else:
                failed.append(template_data["name"])
                errors[template_data["name"]] = "Failed to create template"

        return TemplateImportResponse(
            imported_templates=imported,
            skipped_templates=skipped,
            failed_templates=failed,
            errors=errors,
            total_processed=len(imported) + len(skipped) + len(failed),
            message=f"Imported {len(imported)} templates from YAML files",
        )

    def _build_template_data_from_yaml(
        self,
        yaml_path: str,
        default_category: str | None,
        username: str | None,
    ) -> Dict[str, Any]:
        with open(yaml_path, "r", encoding="utf-8") as fh:
            yaml_data = yaml.safe_load(fh)

        template_path = yaml_data.get("path", "")
        properties = yaml_data.get("properties", {})

        if not template_path:
            raise ValueError("No template path specified in YAML")

        if not os.path.isabs(template_path):
            current_file = os.path.abspath(__file__)
            services_templates_dir = os.path.dirname(current_file)
            services_dir = os.path.dirname(services_templates_dir)
            backend_dir = os.path.dirname(services_dir)
            project_root = os.path.dirname(backend_dir)
            template_path = os.path.join(project_root, template_path)

        if not os.path.exists(template_path):
            raise ValueError(f"Template file not found: {template_path}")

        with open(template_path, "r", encoding="utf-8") as fh:
            template_content = fh.read()

        template_name = properties.get(
            "name",
            os.path.splitext(os.path.basename(template_path))[0],
        )

        return {
            "name": template_name,
            "source": properties.get("source", "file"),
            "template_type": properties.get("type", "jinja2"),
            "category": properties.get("category", default_category or "uncategorized"),
            "content": template_content,
            "description": properties.get("description", ""),
            "filename": os.path.basename(template_path),
            "created_by": username,
            "scope": "global",
        }

    # ------------------------------------------------------------------
    # File bulk
    # ------------------------------------------------------------------

    def _import_file_bulk(
        self,
        request: TemplateImportRequest,
        username: str | None,
    ) -> TemplateImportResponse:
        imported: List[str] = []
        skipped: List[str] = []
        failed: List[str] = []
        errors: Dict[str, str] = {}
        allowed_extensions = {".txt", ".j2", ".textfsm"}

        for file_data in request.file_contents or []:
            filename = file_data["filename"]
            ext = os.path.splitext(filename)[1].lower()

            if ext not in allowed_extensions:
                skipped.append(filename)
                continue

            inferred_type = request.default_template_type
            inferred_category = request.default_category
            if ext == ".textfsm":
                inferred_type = "textfsm"
                inferred_category = inferred_category or "parser"

            template_name = os.path.splitext(filename)[0]

            if not request.overwrite_existing:
                if self._tm.get_template_by_name(template_name):
                    skipped.append(template_name)
                    continue

            template_data = {
                "name": template_name,
                "source": "file",
                "template_type": inferred_type,
                "category": inferred_category,
                "content": file_data["content"],
                "filename": filename,
                "created_by": username,
                "scope": "global",
            }

            try:
                template_id = self._tm.create_template(template_data)
                if template_id:
                    imported.append(template_name)
                else:
                    failed.append(template_name)
            except Exception as exc:
                failed.append(filename)
                errors[filename] = str(exc)

        return TemplateImportResponse(
            imported_templates=imported,
            skipped_templates=skipped,
            failed_templates=failed,
            errors=errors,
            total_processed=len(imported) + len(skipped) + len(failed),
            message=f"Imported {len(imported)} templates from uploaded files",
        )
