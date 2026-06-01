"""Template service — CRUD for template and template_version records in PostgreSQL.

Drop-in replacement for the root-level template_manager.TemplateManager class.
All method signatures and return types are preserved.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict, List, Optional

from core.models import Template, TemplateVersion
from repositories.settings.template_repository import (
    TemplateRepository,
    TemplateVersionRepository,
)

logger = logging.getLogger(__name__)


class TemplateService:
    """CRUD service for templates stored in PostgreSQL."""

    def __init__(self, storage_path: Optional[str] = None) -> None:
        # storage_path parameter kept for backwards compatibility but no longer used
        pass

    def create_template(self, template_data: Dict[str, Any]) -> Optional[int]:
        """Create a new template. Returns the new template ID or None on error."""
        try:
            repo = TemplateRepository()
            version_repo = TemplateVersionRepository()

            if not template_data.get("name"):
                raise ValueError("Template name is required")
            if not template_data.get("source"):
                raise ValueError("Template source is required")

            existing = repo.get_by_name(template_data["name"], active_only=True)
            if existing:
                raise ValueError(f"Template with name '{template_data['name']}' already exists")

            variables_json = json.dumps(template_data.get("variables", {}))
            tags_json = json.dumps(template_data.get("tags", []))

            content = template_data.get("content", "")
            content_hash = hashlib.sha256(content.encode()).hexdigest() if content else None

            template = repo.create(
                name=template_data["name"],
                source=template_data["source"],
                template_type=template_data.get("template_type", "jinja2"),
                category=template_data.get("category"),
                description=template_data.get("description"),
                content=content,
                filename=template_data.get("filename"),
                content_hash=content_hash,
                variables=variables_json,
                tags=tags_json,
                use_nautobot_context=template_data.get("use_nautobot_context", False),
                pass_snmp_mapping=template_data.get("pass_snmp_mapping", False),
                inventory_id=template_data.get("inventory_id"),
                pre_run_command=template_data.get("pre_run_command"),
                credential_id=template_data.get("credential_id"),
                execution_mode=template_data.get("execution_mode", "run_on_device"),
                file_path=template_data.get("file_path"),
                created_by=template_data.get("created_by"),
                scope=template_data.get("scope", "global"),
                is_active=True,
            )
            template_id = template.id

            if content:
                self._create_template_version_obj(version_repo, template_id, content, content_hash, "Initial version")

            logger.info("Template '%s' created with ID %s", template_data["name"], template_id)
            return template_id

        except ValueError as e:
            raise e
        except Exception as e:
            logger.error("Error creating template: %s", e)
            raise e

    def get_template(self, template_id: int) -> Optional[Dict[str, Any]]:
        """Get a template by ID."""
        try:
            repo = TemplateRepository()
            template = repo.get_by_id(template_id)

            if template:
                result = self._model_to_dict(template)
                logger.debug(
                    "get_template(%s) - scope=%s, created_by=%s",
                    template_id,
                    result.get("scope"),
                    result.get("created_by"),
                )
                return result
            return None

        except Exception as e:
            logger.error("Error getting template %s: %s", template_id, e)
            return None

    def get_template_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Get a template by name."""
        try:
            repo = TemplateRepository()
            template = repo.get_by_name(name, active_only=True)

            if template:
                return self._model_to_dict(template)
            return None

        except Exception as e:
            logger.error("Error getting template by name '%s': %s", name, e)
            return None

    def list_templates(
        self,
        category: str = None,
        source: str = None,
        active_only: bool = True,
        username: str = None,
    ) -> List[Dict[str, Any]]:
        """List templates with optional filtering.

        Returns global templates (scope='global') and private templates owned
        by the user (scope='private' AND created_by=username).
        """
        try:
            repo = TemplateRepository()

            logger.debug("list_templates - filtering for username=%s", username)

            templates = repo.list_templates(
                category=category,
                source=source,
                active_only=active_only,
                username=username,
            )

            results = [self._model_to_dict(t) for t in templates]
            logger.debug("list_templates - found %s templates", len(results))
            for template in results:
                logger.debug(
                    "list_templates - template: id=%s, name=%s, scope=%s, created_by=%s",
                    template["id"],
                    template["name"],
                    template.get("scope"),
                    template.get("created_by"),
                )

            return results

        except Exception as e:
            logger.error("Error listing templates: %s", e)
            return []

    def update_template(self, template_id: int, template_data: Dict[str, Any]) -> bool:
        """Update an existing template."""
        try:
            repo = TemplateRepository()
            version_repo = TemplateVersionRepository()

            current_obj = repo.get_by_id(template_id)
            if not current_obj:
                raise ValueError(f"Template with ID {template_id} not found")

            current = self._model_to_dict(current_obj)

            logger.debug(
                "update_template(%s) - incoming scope=%s, current scope=%s",
                template_id,
                template_data.get("scope"),
                current.get("scope"),
            )

            variables_json = json.dumps(template_data.get("variables", current.get("variables", {})))
            tags_json = json.dumps(template_data.get("tags", current.get("tags", [])))

            content = template_data.get("content", current.get("content", ""))
            content_hash = hashlib.sha256(content.encode()).hexdigest() if content else None

            content_changed = content_hash != current.get("content_hash")

            new_scope = template_data.get("scope", current.get("scope", "global"))
            logger.debug(
                "update_template(%s) - will update scope to: %s",
                template_id,
                new_scope,
            )

            update_kwargs = {
                "name": template_data.get("name", current["name"]),
                "template_type": template_data.get("template_type", current["template_type"]),
                "category": template_data.get("category", current["category"]),
                "description": template_data.get("description", current["description"]),
                "content": content,
                "filename": template_data.get("filename", current["filename"]),
                "content_hash": content_hash,
                "variables": variables_json,
                "tags": tags_json,
                "use_nautobot_context": template_data.get(
                    "use_nautobot_context", current.get("use_nautobot_context", False)
                ),
                "pass_snmp_mapping": template_data.get("pass_snmp_mapping", current.get("pass_snmp_mapping", False)),
                "inventory_id": template_data.get("inventory_id", current.get("inventory_id")),
                "pre_run_command": template_data.get("pre_run_command", current.get("pre_run_command")),
                "credential_id": template_data.get("credential_id", current.get("credential_id")),
                "execution_mode": template_data.get("execution_mode", current.get("execution_mode", "run_on_device")),
                "file_path": template_data.get("file_path", current.get("file_path")),
                "scope": new_scope,
            }

            repo.update(template_id, **update_kwargs)

            logger.debug(
                "update_template(%s) - SQL UPDATE executed with scope=%s",
                template_id,
                new_scope,
            )

            if content_changed and content:
                self._create_template_version_obj(
                    version_repo,
                    template_id,
                    content,
                    content_hash,
                    template_data.get("change_notes", "Template updated"),
                )

            logger.info("Template %s updated", template_id)
            return True

        except Exception as e:
            logger.error("Error updating template %s: %s", template_id, e)
            return False

    def delete_template(self, template_id: int, hard_delete: bool = False) -> bool:
        """Delete a template (soft delete by default)."""
        try:
            repo = TemplateRepository()

            if hard_delete:
                repo.delete(template_id)
            else:
                repo.update(template_id, is_active=False)

            logger.info(
                "Template %s %s",
                template_id,
                "deleted" if hard_delete else "deactivated",
            )
            return True

        except Exception as e:
            logger.error("Error deleting template %s: %s", template_id, e)
            return False

    def get_template_content(self, template_id: int) -> Optional[str]:
        """Get template content from database."""
        try:
            template = self.get_template(template_id)
            if not template:
                return None
            return template.get("content")

        except Exception as e:
            logger.error("Error getting template content for %s: %s", template_id, e)
            return None

    def render_template(self, template_name: str, category: str, data: Dict[str, Any]) -> str:
        """Render a template using Jinja2 with provided data."""
        try:
            from jinja2 import BaseLoader, Environment

            template = self.get_template_by_name(template_name)
            if not template:
                templates = self.list_templates(category=category if category else None)
                matching_templates = [t for t in templates if t["name"] == template_name]
                if matching_templates:
                    template = matching_templates[0]
                else:
                    raise ValueError(f"Template '{template_name}' not found in category '{category}'")

            content = self.get_template_content(template["id"])
            if not content:
                raise ValueError(f"Template content not found for '{template_name}'")

            env = Environment(loader=BaseLoader())
            jinja_template = env.from_string(content)
            rendered = jinja_template.render(**data)

            logger.info(
                "Successfully rendered template '%s' from category '%s'",
                template_name,
                category,
            )
            return rendered

        except Exception as e:
            logger.error(
                "Error rendering template '%s' in category '%s': %s",
                template_name,
                category,
                e,
            )
            raise e

    def get_template_versions(self, template_id: int) -> List[Dict[str, Any]]:
        """Get version history for a template."""
        try:
            version_repo = TemplateVersionRepository()
            versions = version_repo.get_versions_by_template_id(template_id)
            return [self._version_model_to_dict(v) for v in versions]

        except Exception as e:
            logger.error("Error getting template versions for %s: %s", template_id, e)
            return []

    def search_templates(self, query: str, search_content: bool = False, username: str = None) -> List[Dict[str, Any]]:
        """Search templates by name, description, category, or content.

        Respects scope and ownership — returns global templates and user's
        private templates.
        """
        try:
            repo = TemplateRepository()
            templates = repo.search_templates(query_text=query, search_content=search_content, username=username)
            return [self._model_to_dict(t) for t in templates]

        except Exception as e:
            logger.error("Error searching templates: %s", e)
            return []

    def get_categories(self) -> List[str]:
        """Get all unique template categories."""
        try:
            repo = TemplateRepository()
            return repo.get_categories()

        except Exception as e:
            logger.error("Error getting categories: %s", e)
            return []

    def health_check(self) -> Dict[str, Any]:
        """Check template database health."""
        try:
            repo = TemplateRepository()

            active_count = repo.get_active_count()
            total_count = repo.get_total_count()
            categories_count = repo.get_categories_count()

            return {
                "status": "healthy",
                "storage_type": "database",
                "active_templates": active_count,
                "total_templates": total_count,
                "categories": categories_count,
            }

        except Exception as e:
            logger.error("Template database health check failed: %s", e)
            return {"status": "unhealthy", "error": str(e)}

    def mark_git_templates_sync_metadata(
        self,
        template_ids: List[int],
        *,
        sync_status: str,
        username: Optional[str] = None,
    ) -> None:
        """Update last_sync and sync_status for git-sourced templates after a mirror sync."""
        from datetime import datetime, timezone

        repo = TemplateRepository()
        now = datetime.now(timezone.utc)
        for tid in template_ids:
            try:
                obj = repo.get_by_id(tid)
                if not obj or obj.source != "git":
                    continue
                if username and getattr(obj, "scope", None) == "private":
                    if obj.created_by != username:
                        continue
                repo.update(tid, last_sync=now, sync_status=sync_status)
            except Exception as exc:
                logger.warning("Could not update sync metadata for template %s: %s", tid, exc)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _model_to_dict(self, template: Template) -> Dict[str, Any]:
        """Convert SQLAlchemy model to dictionary with proper data types."""
        result = {
            "id": template.id,
            "name": template.name,
            "source": template.source,
            "template_type": template.template_type,
            "category": template.category,
            "description": template.description,
            "content": template.content,
            "filename": template.filename,
            "content_hash": template.content_hash,
            "created_by": template.created_by,
            "scope": template.scope,
            "is_active": bool(template.is_active),
            "use_nautobot_context": bool(template.use_nautobot_context),
            "pass_snmp_mapping": bool(template.pass_snmp_mapping),
            "inventory_id": template.inventory_id,
            "pre_run_command": template.pre_run_command,
            "credential_id": template.credential_id,
            "execution_mode": template.execution_mode,
            "file_path": template.file_path,
            "last_sync": template.last_sync.isoformat() if template.last_sync else None,
            "sync_status": template.sync_status,
            "created_at": (template.created_at.isoformat() if template.created_at else None),
            "updated_at": (template.updated_at.isoformat() if template.updated_at else None),
        }

        if template.variables:
            try:
                result["variables"] = json.loads(template.variables)
            except json.JSONDecodeError:
                result["variables"] = {}
        else:
            result["variables"] = {}

        if template.tags:
            try:
                result["tags"] = json.loads(template.tags)
            except json.JSONDecodeError:
                result["tags"] = []
        else:
            result["tags"] = []

        return result

    def _version_model_to_dict(self, version: TemplateVersion) -> Dict[str, Any]:
        """Convert TemplateVersion model to dictionary."""
        return {
            "id": version.id,
            "template_id": version.template_id,
            "version_number": version.version_number,
            "content": version.content,
            "content_hash": version.content_hash,
            "created_at": (version.created_at.isoformat() if version.created_at else None),
            "created_by": version.created_by,
            "change_notes": version.change_notes,
        }

    def _create_template_version_obj(
        self,
        version_repo: TemplateVersionRepository,
        template_id: int,
        content: str,
        content_hash: str,
        notes: str = "",
    ) -> None:
        """Create a new version entry for a template."""
        try:
            version_number = version_repo.get_max_version_number(template_id) + 1
            version_repo.create(
                template_id=template_id,
                version_number=version_number,
                content=content,
                content_hash=content_hash,
                change_notes=notes,
            )
        except Exception as e:
            logger.error("Error creating template version: %s", e)
