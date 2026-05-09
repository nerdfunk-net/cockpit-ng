# Refactoring Step 4.6 — `template_manager.py`

**Priority:** 4 — Manager Migration  
**Risk:** Medium  
**Estimated effort:** 4–6 hours  
**Prerequisites:** None strictly required  
**Independent of:** Steps 4.1–4.5, 4.7  

---

## Goal

Migrate `backend/template_manager.py` (525 lines, class-based with singleton) →  
`backend/services/templates/template_service.py`

---

## Current State

`template_manager.py` contains:
1. `TemplateManager` class — PostgreSQL CRUD for templates and template versions
2. Module-level `template_manager = TemplateManager()` singleton — used throughout the codebase

`service_factory.py` already has two functions that reference `TemplateManager`:
```python
def build_template_manager():
    from template_manager import TemplateManager
    return TemplateManager()

def build_template_import_service():
    from template_manager import template_manager  # uses the singleton
    from services.templates.import_service import TemplateImportService
    return TemplateImportService(template_manager=template_manager)

def build_template_render_orchestrator():
    from template_manager import template_manager  # uses the singleton
    ...
    return TemplateRenderOrchestrator(..., template_manager=template_manager)
```

The singleton is shared across `TemplateImportService` and `TemplateRenderOrchestrator`. Since `TemplateManager` is stateless (all state is in PostgreSQL), a fresh instance per request is functionally equivalent.

---

## Callers

```bash
grep -rn "import template_manager\|from template_manager" backend/ --include="*.py" | grep -v __pycache__
```

| File | Import | Usage |
|---|---|---|
| `service_factory.py` | × 3 (class + singleton × 2) | factory functions |
| `routers/settings/templates/git.py` | lazy `from template_manager import template_manager` | git template operations |
| `routers/settings/templates/health.py` | lazy | health check |
| `routers/settings/templates/content.py` | lazy × 3 | content endpoints |
| `routers/settings/templates/crud.py` | lazy × 7 | CRUD endpoints |
| `routers/network/automation/netmiko.py` | lazy `from template_manager import template_manager` | template lookup |
| `routers/agents/deploy.py` | lazy × 2 | template lookup |
| `tasks/execution/command_executor.py` | lazy | template rendering |
| `services/network/scanning/service.py` | `from template_manager import template_manager` (top-level) | scan service |
| `services/inventory/export_service.py` | lazy | export template |

---

## New File: `services/templates/template_service.py`

The existing `services/templates/` directory already contains `scan_service.py`, `import_service.py`, and `render_orchestrator.py`. The new file is a direct refactor of `TemplateManager` into `TemplateService`.

```python
"""Template service — CRUD for template and template_version records in PostgreSQL."""

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
    """CRUD service for templates stored in PostgreSQL.

    Drop-in replacement for the root-level TemplateManager class.
    All method signatures and return types are preserved.
    """

    def __init__(self) -> None:
        pass  # Repositories are created per-operation to avoid session leaks

    def create_template(self, template_data: Dict[str, Any]) -> Optional[int]:
        """Create a new template. Returns the new template ID or None on error."""
        try:
            repo = TemplateRepository()
            version_repo = TemplateVersionRepository()

            if not template_data.get("name"):
                raise ValueError("Template name is required")
            if not template_data.get("source"):
                raise ValueError("Template source is required")

            if repo.get_by_name(template_data["name"], active_only=True):
                raise ValueError(f"Template with name '{template_data['name']}' already exists")

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
                variables=json.dumps(template_data.get("variables", {})),
                tags=json.dumps(template_data.get("tags", [])),
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

            if content:
                version_repo.create(
                    template_id=template.id,
                    version=1,
                    content=content,
                    content_hash=content_hash,
                    created_by=template_data.get("created_by"),
                )

            logger.info("Created template: %s (ID: %s)", template_data["name"], template.id)
            return template.id
        except ValueError:
            raise
        except Exception as e:
            logger.error("Error creating template: %s", e)
            raise

    def get_template(self, template_id: int) -> Optional[Dict[str, Any]]:
        try:
            repo = TemplateRepository()
            template = repo.get_by_id(template_id)
            return self._to_dict(template) if template else None
        except Exception as e:
            logger.error("Error getting template %s: %s", template_id, e)
            raise

    def get_template_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        try:
            repo = TemplateRepository()
            template = repo.get_by_name(name, active_only=True)
            return self._to_dict(template) if template else None
        except Exception as e:
            logger.error("Error getting template by name '%s': %s", name, e)
            raise

    def get_all_templates(
        self,
        category: Optional[str] = None,
        active_only: bool = True,
        source: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        try:
            repo = TemplateRepository()
            if category:
                templates = repo.get_by_category(category, active_only=active_only)
            elif source:
                templates = repo.get_by_source(source, active_only=active_only)
            elif active_only:
                templates = repo.get_all_active()
            else:
                templates = repo.get_all()
            return [self._to_dict(t) for t in templates]
        except Exception as e:
            logger.error("Error getting templates: %s", e)
            raise

    def update_template(
        self, template_id: int, template_data: Dict[str, Any], updated_by: Optional[str] = None
    ) -> bool:
        try:
            repo = TemplateRepository()
            version_repo = TemplateVersionRepository()
            template = repo.get_by_id(template_id)
            if not template:
                raise ValueError(f"Template {template_id} not found")

            valid_fields = [
                "name", "source", "template_type", "category", "description",
                "filename", "variables", "tags", "use_nautobot_context",
                "pass_snmp_mapping", "inventory_id", "pre_run_command",
                "credential_id", "execution_mode", "file_path", "scope", "is_active",
            ]
            update_kwargs: Dict[str, Any] = {
                k: v for k, v in template_data.items() if k in valid_fields
            }

            if "variables" in update_kwargs and isinstance(update_kwargs["variables"], dict):
                update_kwargs["variables"] = json.dumps(update_kwargs["variables"])
            if "tags" in update_kwargs and isinstance(update_kwargs["tags"], list):
                update_kwargs["tags"] = json.dumps(update_kwargs["tags"])

            content = template_data.get("content")
            if content is not None:
                content_hash = hashlib.sha256(content.encode()).hexdigest()
                update_kwargs["content"] = content
                update_kwargs["content_hash"] = content_hash

                latest_version = version_repo.get_latest_version(template_id)
                new_version_num = (latest_version.version + 1) if latest_version else 1
                version_repo.create(
                    template_id=template_id,
                    version=new_version_num,
                    content=content,
                    content_hash=content_hash,
                    created_by=updated_by,
                )

            if update_kwargs:
                repo.update(template_id, **update_kwargs)
                logger.info("Updated template ID: %s", template_id)
            return True
        except ValueError:
            raise
        except Exception as e:
            logger.error("Error updating template %s: %s", template_id, e)
            raise

    def delete_template(self, template_id: int) -> bool:
        try:
            repo = TemplateRepository()
            repo.delete(template_id)
            logger.info("Deleted template ID: %s", template_id)
            return True
        except Exception as e:
            logger.error("Error deleting template %s: %s", template_id, e)
            raise

    def get_template_versions(self, template_id: int) -> List[Dict[str, Any]]:
        try:
            version_repo = TemplateVersionRepository()
            versions = version_repo.get_by_template(template_id)
            return [self._version_to_dict(v) for v in versions]
        except Exception as e:
            logger.error("Error getting versions for template %s: %s", template_id, e)
            raise

    def get_template_version(self, template_id: int, version_num: int) -> Optional[Dict[str, Any]]:
        try:
            version_repo = TemplateVersionRepository()
            version = version_repo.get_version(template_id, version_num)
            return self._version_to_dict(version) if version else None
        except Exception as e:
            logger.error("Error getting version %s for template %s: %s", version_num, template_id, e)
            raise

    def restore_template_version(
        self, template_id: int, version_num: int, restored_by: Optional[str] = None
    ) -> bool:
        try:
            repo = TemplateRepository()
            version_repo = TemplateVersionRepository()
            version = version_repo.get_version(template_id, version_num)
            if not version:
                raise ValueError(f"Version {version_num} not found for template {template_id}")

            content = version.content
            content_hash = hashlib.sha256(content.encode()).hexdigest() if content else None

            latest = version_repo.get_latest_version(template_id)
            new_version_num = (latest.version + 1) if latest else 1
            version_repo.create(
                template_id=template_id,
                version=new_version_num,
                content=content,
                content_hash=content_hash,
                created_by=restored_by,
            )
            repo.update(template_id, content=content, content_hash=content_hash)
            logger.info("Restored template %s to version %s", template_id, version_num)
            return True
        except ValueError:
            raise
        except Exception as e:
            logger.error("Error restoring template %s version %s: %s", template_id, version_num, e)
            raise

    def search_templates(self, query: str, active_only: bool = True) -> List[Dict[str, Any]]:
        try:
            repo = TemplateRepository()
            templates = repo.search(query, active_only=active_only)
            return [self._to_dict(t) for t in templates]
        except Exception as e:
            logger.error("Error searching templates: %s", e)
            raise

    def _to_dict(self, template: Template) -> Dict[str, Any]:
        variables = template.variables
        if isinstance(variables, str):
            try:
                variables = json.loads(variables)
            except (json.JSONDecodeError, TypeError):
                variables = {}

        tags = template.tags
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except (json.JSONDecodeError, TypeError):
                tags = []

        return {
            "id": template.id,
            "name": template.name,
            "source": template.source,
            "template_type": template.template_type,
            "category": template.category,
            "description": template.description,
            "content": template.content,
            "filename": template.filename,
            "content_hash": template.content_hash,
            "variables": variables,
            "tags": tags,
            "use_nautobot_context": template.use_nautobot_context,
            "pass_snmp_mapping": getattr(template, "pass_snmp_mapping", False),
            "inventory_id": template.inventory_id,
            "pre_run_command": template.pre_run_command,
            "credential_id": template.credential_id,
            "execution_mode": template.execution_mode,
            "file_path": template.file_path,
            "created_by": template.created_by,
            "scope": template.scope,
            "is_active": template.is_active,
            "created_at": template.created_at.isoformat() if template.created_at else None,
            "updated_at": template.updated_at.isoformat() if template.updated_at else None,
        }

    def _version_to_dict(self, version: TemplateVersion) -> Dict[str, Any]:
        return {
            "id": version.id,
            "template_id": version.template_id,
            "version": version.version,
            "content": version.content,
            "content_hash": version.content_hash,
            "created_by": version.created_by,
            "created_at": version.created_at.isoformat() if version.created_at else None,
        }
```

**Note:** The exact method list in `TemplateManager` should be cross-referenced against the actual file before implementing. The plan above covers the methods visible in the file preview; verify additional methods at lines 80–525.

---

## `service_factory.py` Updates

Replace the three existing `template_manager` references:

```python
# Remove these:
# def build_template_manager() → build_template_service() instead
# from template_manager import template_manager (singleton)

def build_template_service():
    """Create a fresh TemplateService instance."""
    from services.templates.template_service import TemplateService
    return TemplateService()

# Update build_template_import_service:
def build_template_import_service():
    from services.templates.import_service import TemplateImportService
    return TemplateImportService(template_manager=build_template_service())

# Update build_template_render_orchestrator:
def build_template_render_orchestrator():
    from services.templates.render_orchestrator import TemplateRenderOrchestrator
    return TemplateRenderOrchestrator(
        device_query_service=build_device_query_service(),
        checkmk_config_service=build_checkmk_config_service(),
        render_service=build_render_service(),
        inventory_service=build_inventory_service(),
        template_manager=build_template_service(),
    )
```

Also update the `TYPE_CHECKING` block — remove `from template_manager import TemplateManager`.

---

## `dependencies.py` Addition

```python
def get_template_service():
    """Provide a TemplateService instance."""
    return service_factory.build_template_service()
```

---

## Caller Updates

### `routers/settings/templates/crud.py`, `content.py`, `git.py`, `health.py`

These use the lazy singleton `from template_manager import template_manager`.

```python
# Before:
from template_manager import template_manager

# After:
import service_factory
template_manager = service_factory.build_template_service()
```

Or, for proper FastAPI injection, add `Depends(get_template_service)` to each endpoint and pass the instance as `template_manager`. The lazy-import-per-function approach is simpler for this step.

### `routers/network/automation/netmiko.py` and `routers/agents/deploy.py`

Same lazy replacement pattern.

### `tasks/execution/command_executor.py`

```python
# Before:
from template_manager import template_manager

# After:
import service_factory
template_manager = service_factory.build_template_service()
```

### `services/network/scanning/service.py`

```python
# Before:
from template_manager import template_manager

# After:
import service_factory
template_manager = service_factory.build_template_service()
```

### `services/inventory/export_service.py`

Same lazy replacement pattern.

---

## Steps

1. Read the full `template_manager.py` to capture all methods before implementing.
2. Create `backend/services/templates/template_service.py`.
3. Update `service_factory.py`: replace `build_template_manager()` with `build_template_service()`, update the two dependent builders.
4. Update `TYPE_CHECKING` block in `service_factory.py`.
5. Add `get_template_service()` to `dependencies.py`.
6. Update all 10 callers (lazy import replacement).
7. Delete `backend/template_manager.py`.
8. Verify:
   ```bash
   grep -rn "template_manager" backend/ --include="*.py" | grep -v __pycache__
   # Should return 0 results — or only service_factory references to build_template_service
   ```

---

## Verification Checklist

- [ ] `grep -rn "from template_manager\|import template_manager" backend/` → 0 results
- [ ] `template_manager.py` deleted
- [ ] `services/templates/template_service.py` exists
- [ ] `service_factory.build_template_service()` importable
- [ ] Template CRUD endpoints work
- [ ] Template render in netmiko/agents endpoints works
- [ ] `TemplateImportService` and `TemplateRenderOrchestrator` still construct via `build_*` factory functions
- [ ] Backend starts: `python -c "import main"`
