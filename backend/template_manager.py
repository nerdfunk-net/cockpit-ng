"""
Template Management for Cockpit
Handles template storage, retrieval, and management operations
"""

from __future__ import annotations
import os
import logging
import json
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import hashlib
from core.database import get_db_session
from repositories.template_repository import TemplateRepository, TemplateVersionRepository
from core.models import Template, TemplateVersion

logger = logging.getLogger(__name__)


class TemplateManager:
    """Manages configuration templates in PostgreSQL database and file system"""

    def __init__(self, storage_path: str = None):
        if storage_path is None:
            # Use data/templates directory for file storage
            self.storage_path = os.path.join(
                os.path.dirname(os.path.dirname(__file__)), "data", "templates"
            )
            os.makedirs(self.storage_path, exist_ok=True)
        else:
            self.storage_path = storage_path

    def create_template(self, template_data: Dict[str, Any]) -> Optional[int]:
        """Create a new template"""
        try:
            repo = TemplateRepository()
            version_repo = TemplateVersionRepository()

            # Validate required fields
            if not template_data.get("name"):
                raise ValueError("Template name is required")

            if not template_data.get("source"):
                raise ValueError("Template source is required")

            # Check for existing active template with same name
            existing = repo.get_by_name(template_data["name"], active_only=True)
            if existing:
                raise ValueError(
                    f"Template with name '{template_data['name']}' already exists"
                )

            # Prepare data
            variables_json = json.dumps(template_data.get("variables", {}))
            tags_json = json.dumps(template_data.get("tags", []))

            # Handle content based on source
            content = template_data.get("content", "")
            content_hash = (
                hashlib.sha256(content.encode()).hexdigest() if content else None
            )

            # Create template using BaseRepository.create(**kwargs)
            template = repo.create(
                name=template_data["name"],
                source=template_data["source"],
                template_type=template_data.get("template_type", "jinja2"),
                category=template_data.get("category"),
                description=template_data.get("description"),
                git_repo_url=template_data.get("git_repo_url"),
                git_branch=template_data.get("git_branch", "main"),
                git_username=template_data.get("git_username"),
                git_token=template_data.get("git_token"),
                git_path=template_data.get("git_path"),
                git_verify_ssl=template_data.get("git_verify_ssl", True),
                content=content,
                filename=template_data.get("filename"),
                content_hash=content_hash,
                variables=variables_json,
                tags=tags_json,
                created_by=template_data.get("created_by"),
                scope=template_data.get("scope", "global"),
                is_active=True,
            )
            template_id = template.id

            # Save content to file if it's a file or webeditor template
            if template_data["source"] in ["file", "webeditor"] and content:
                self._save_template_to_file(
                    template_id,
                    template_data["name"],
                    content,
                    template_data.get("filename"),
                )

            # Create initial version
            if content:
                self._create_template_version_obj(
                    version_repo, template_id, content, content_hash, "Initial version"
                )

            logger.info(
                f"Template '{template_data['name']}' created with ID {template_id}"
            )
            return template_id

        except ValueError as e:
            raise e
        except Exception as e:
            logger.error(f"Error creating template: {e}")
            raise e

    def get_template(self, template_id: int) -> Optional[Dict[str, Any]]:
        """Get a template by ID"""
        try:
            repo = TemplateRepository()
            template = repo.get_by_id(template_id)

            if template:
                result = self._model_to_dict(template)
                logger.info(
                    f"DEBUG: get_template({template_id}) - scope={result.get('scope')}, created_by={result.get('created_by')}"
                )
                return result
            return None

        except Exception as e:
            logger.error(f"Error getting template {template_id}: {e}")
            return None

    def get_template_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Get a template by name"""
        try:
            repo = TemplateRepository()
            template = repo.get_by_name(name, active_only=True)

            if template:
                return self._model_to_dict(template)
            return None

        except Exception as e:
            logger.error(f"Error getting template by name '{name}': {e}")
            return None

    def list_templates(
        self,
        category: str = None,
        source: str = None,
        active_only: bool = True,
        username: str = None,
    ) -> List[Dict[str, Any]]:
        """List templates with optional filtering.

        Returns:
        - Global templates (scope='global')
        - Private templates owned by the user (scope='private' AND created_by=username)
        """
        try:
            repo = TemplateRepository()
            
            logger.info(f"DEBUG: list_templates - filtering for username={username}")
            
            templates = repo.list_templates(
                category=category,
                source=source,
                active_only=active_only,
                username=username
            )

            results = [self._model_to_dict(t) for t in templates]
            logger.info(f"DEBUG: list_templates - found {len(results)} templates")
            for template in results:
                logger.info(
                    f"DEBUG: list_templates - template: id={template['id']}, name={template['name']}, scope={template.get('scope')}, created_by={template.get('created_by')}"
                )

            return results

        except Exception as e:
            logger.error(f"Error listing templates: {e}")
            return []

    def update_template(self, template_id: int, template_data: Dict[str, Any]) -> bool:
        """Update an existing template"""
        try:
            repo = TemplateRepository()
            version_repo = TemplateVersionRepository()

            # Get current template
            current_obj = repo.get_by_id(template_id)
            if not current_obj:
                raise ValueError(f"Template with ID {template_id} not found")
            
            current = self._model_to_dict(current_obj)

            logger.info(
                f"DEBUG: update_template({template_id}) - incoming scope={template_data.get('scope')}, current scope={current.get('scope')}"
            )

            # Prepare update data
            variables_json = json.dumps(template_data.get("variables", {}))
            tags_json = json.dumps(template_data.get("tags", []))

            content = template_data.get("content", current.get("content", ""))
            content_hash = (
                hashlib.sha256(content.encode()).hexdigest() if content else None
            )

            # Check if content changed
            content_changed = content_hash != current.get("content_hash")

            # Get the scope to update
            new_scope = template_data.get("scope", current.get("scope", "global"))
            logger.info(
                f"DEBUG: update_template({template_id}) - will update scope to: {new_scope}"
            )

            # Prepare update kwargs
            update_kwargs = {
                "name": template_data.get("name", current["name"]),
                "template_type": template_data.get("template_type", current["template_type"]),
                "category": template_data.get("category", current["category"]),
                "description": template_data.get("description", current["description"]),
                "git_repo_url": template_data.get("git_repo_url", current["git_repo_url"]),
                "git_branch": template_data.get("git_branch", current["git_branch"]),
                "git_username": template_data.get("git_username", current["git_username"]),
                "git_token": template_data.get("git_token", current["git_token"]),
                "git_path": template_data.get("git_path", current["git_path"]),
                "git_verify_ssl": template_data.get("git_verify_ssl", current["git_verify_ssl"]),
                "content": content,
                "filename": template_data.get("filename", current["filename"]),
                "content_hash": content_hash,
                "variables": variables_json,
                "tags": tags_json,
                "scope": new_scope,
            }

            repo.update(template_id, **update_kwargs)

            logger.info(
                f"DEBUG: update_template({template_id}) - SQL UPDATE executed with scope={new_scope}"
            )

            # Save content to file if needed
            if current["source"] in ["file", "webeditor"] and content:
                self._save_template_to_file(
                    template_id,
                    template_data.get("name", current["name"]),
                    content,
                    template_data.get("filename", current.get("filename")),
                )

            # Create new version if content changed
            if content_changed and content:
                self._create_template_version_obj(
                    version_repo,
                    template_id,
                    content,
                    content_hash,
                    template_data.get("change_notes", "Template updated"),
                )

            logger.info(f"Template {template_id} updated")
            return True

        except Exception as e:
            logger.error(f"Error updating template {template_id}: {e}")
            return False

    def delete_template(self, template_id: int, hard_delete: bool = False) -> bool:
        """Delete a template (soft delete by default)"""
        try:
            repo = TemplateRepository()

            if hard_delete:
                # Hard delete - remove from database and file system
                template_dict = self.get_template(template_id)
                if template_dict:
                    repo.delete(template_id)
                    # Remove file if it exists
                    if template_dict["source"] in ["file", "webeditor"]:
                        self._remove_template_file(template_id, template_dict["name"])
            else:
                # Soft delete - mark as inactive using update
                repo.update(template_id, is_active=False)

            logger.info(
                f"Template {template_id} {'deleted' if hard_delete else 'deactivated'}"
            )
            return True

        except Exception as e:
            logger.error(f"Error deleting template {template_id}: {e}")
            return False

    def get_template_content(self, template_id: int) -> Optional[str]:
        """Get template content, loading from file if necessary"""
        try:
            template = self.get_template(template_id)
            if not template:
                return None

            # For Git templates, content might need to be fetched
            if template["source"] == "git":
                # TODO: Implement Git content fetching
                return template.get("content")

            # For file/webeditor templates, try database first, then file
            content = template.get("content")
            if not content and template["source"] in ["file", "webeditor"]:
                content = self._load_template_from_file(
                    template_id, template["name"], template.get("filename")
                )

            return content

        except Exception as e:
            logger.error(f"Error getting template content for {template_id}: {e}")
            return None

    def render_template(
        self, template_name: str, category: str, data: Dict[str, Any]
    ) -> str:
        """Render a template using Jinja2 with provided data"""
        try:
            # Import Jinja2 here to avoid import errors if not installed
            from jinja2 import Environment, BaseLoader

            # Find template by name and category
            template = self.get_template_by_name(template_name)
            if not template:
                # If no exact name match, try searching templates
                templates = self.list_templates(category=category if category else None)
                matching_templates = [
                    t for t in templates if t["name"] == template_name
                ]
                if matching_templates:
                    template = matching_templates[0]
                else:
                    raise ValueError(
                        f"Template '{template_name}' not found in category '{category}'"
                    )

            # Get template content
            content = self.get_template_content(template["id"])
            if not content:
                raise ValueError(f"Template content not found for '{template_name}'")

            # Create Jinja2 template and render
            env = Environment(loader=BaseLoader())
            jinja_template = env.from_string(content)
            rendered = jinja_template.render(**data)

            logger.info(
                f"Successfully rendered template '{template_name}' from category '{category}'"
            )
            return rendered

        except Exception as e:
            logger.error(
                f"Error rendering template '{template_name}' in category '{category}': {e}"
            )
            raise e

    def get_template_versions(self, template_id: int) -> List[Dict[str, Any]]:
        """Get version history for a template"""
        try:
            version_repo = TemplateVersionRepository()
            versions = version_repo.get_versions_by_template_id(template_id)
            return [self._version_model_to_dict(v) for v in versions]

        except Exception as e:
            logger.error(f"Error getting template versions for {template_id}: {e}")
            return []

    def _model_to_dict(self, template: Template) -> Dict[str, Any]:
        """Convert SQLAlchemy model to dictionary with proper data types"""
        result = {
            "id": template.id,
            "name": template.name,
            "source": template.source,
            "template_type": template.template_type,
            "category": template.category,
            "description": template.description,
            "git_repo_url": template.git_repo_url,
            "git_branch": template.git_branch,
            "git_username": template.git_username,
            "git_token": template.git_token,
            "git_path": template.git_path,
            "git_verify_ssl": bool(template.git_verify_ssl),
            "content": template.content,
            "filename": template.filename,
            "content_hash": template.content_hash,
            "created_by": template.created_by,
            "scope": template.scope,
            "is_active": bool(template.is_active),
            "last_sync": template.last_sync.isoformat() if template.last_sync else None,
            "sync_status": template.sync_status,
            "created_at": template.created_at.isoformat() if template.created_at else None,
            "updated_at": template.updated_at.isoformat() if template.updated_at else None,
        }

        # Parse JSON fields
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
        """Convert TemplateVersion model to dictionary"""
        return {
            "id": version.id,
            "template_id": version.template_id,
            "version_number": version.version_number,
            "content": version.content,
            "content_hash": version.content_hash,
            "created_at": version.created_at.isoformat() if version.created_at else None,
            "created_by": version.created_by,
            "change_notes": version.change_notes,
        }

    def _save_template_to_file(
        self, template_id: int, name: str, content: str, filename: str = None
    ) -> None:
        """Save template content to file system, preserving extension if possible"""
        try:
            # Use original extension if provided, else default to .txt
            ext = ".txt"
            if filename:
                ext = os.path.splitext(filename)[1] or ".txt"
            else:
                # Try to extract extension from name
                if "." in name:
                    ext = os.path.splitext(name)[1] or ".txt"
            safe_name = name.replace(" ", "_").replace("/", "_")
            file_out = f"{template_id}_{safe_name}{ext}"
            filepath = os.path.join(self.storage_path, file_out)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            logger.debug(f"Template content saved to {filepath}")
        except Exception as e:
            logger.error(f"Error saving template to file: {e}")

    def _load_template_from_file(
        self, template_id: int, name: str, filename: str = None
    ) -> Optional[str]:
        """Load template content from file system, trying multiple extensions"""
        try:
            safe_name = name.replace(" ", "_").replace("/", "_")
            exts = [".txt", ".j2", ".textfsm"]
            if filename:
                exts.insert(0, os.path.splitext(filename)[1])
            else:
                if "." in name:
                    exts.insert(0, os.path.splitext(name)[1])
            for ext in exts:
                file_in = f"{template_id}_{safe_name}{ext}"
                filepath = os.path.join(self.storage_path, file_in)
                if os.path.exists(filepath):
                    with open(filepath, "r", encoding="utf-8") as f:
                        return f.read()
            return None
        except Exception as e:
            logger.error(f"Error loading template from file: {e}")
            return None

    def _remove_template_file(
        self, template_id: int, name: str, filename: str = None
    ) -> None:
        """Remove template file from file system, trying multiple extensions"""
        try:
            safe_name = name.replace(" ", "_").replace("/", "_")
            exts = [".txt", ".j2", ".textfsm"]
            if filename:
                exts.insert(0, os.path.splitext(filename)[1])
            else:
                if "." in name:
                    exts.insert(0, os.path.splitext(name)[1])
            for ext in exts:
                file_rm = f"{template_id}_{safe_name}{ext}"
                filepath = os.path.join(self.storage_path, file_rm)
                if os.path.exists(filepath):
                    os.remove(filepath)
                    logger.debug(f"Template file removed: {filepath}")
        except Exception as e:
            logger.error(f"Error removing template file: {e}")

    def _create_template_version_obj(
        self, version_repo: TemplateVersionRepository, template_id: int, content: str, content_hash: str, notes: str = ""
    ) -> None:
        """Create a new version entry for a template"""
        try:
            # Get current version number
            version_number = version_repo.get_max_version_number(template_id) + 1

            # Create new version using BaseRepository.create(**kwargs)
            version_repo.create(
                template_id=template_id,
                version_number=version_number,
                content=content,
                content_hash=content_hash,
                change_notes=notes
            )

        except Exception as e:
            logger.error(f"Error creating template version: {e}")

    def search_templates(
        self, query: str, search_content: bool = False, username: str = None
    ) -> List[Dict[str, Any]]:
        """Search templates by name, description, category, or content.

        Respects scope and ownership - returns global templates and user's private templates.
        """
        try:
            repo = TemplateRepository()
            templates = repo.search_templates(
                query_text=query,
                search_content=search_content,
                username=username
            )
            return [self._model_to_dict(t) for t in templates]

        except Exception as e:
            logger.error(f"Error searching templates: {e}")
            return []

    def get_categories(self) -> List[str]:
        """Get all unique template categories"""
        try:
            repo = TemplateRepository()
            return repo.get_categories()

        except Exception as e:
            logger.error(f"Error getting categories: {e}")
            return []

    def health_check(self) -> Dict[str, Any]:
        """Check template database health"""
        try:
            repo = TemplateRepository()

            active_count = repo.get_active_count()
            total_count = repo.get_total_count()
            categories_count = repo.get_categories_count()

            return {
                "status": "healthy",
                "storage_path": self.storage_path,
                "active_templates": active_count,
                "total_templates": total_count,
                "categories": categories_count,
            }

        except Exception as e:
            logger.error(f"Template database health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}


# Global template manager instance
template_manager = TemplateManager()
