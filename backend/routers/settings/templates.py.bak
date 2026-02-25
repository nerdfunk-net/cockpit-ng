"""
Template router for template management operations.
"""

from __future__ import annotations
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
import os

from core.auth import require_permission
from models.templates import (
    TemplateRequest,
    TemplateResponse,
    TemplateListResponse,
    TemplateGitTestRequest,
    TemplateSyncRequest,
    TemplateSyncResponse,
    TemplateImportRequest,
    TemplateImportResponse,
    TemplateUpdateRequest,
    ImportableTemplateInfo,
    TemplateScanImportResponse,
    TemplateExecuteAndSyncRequest,
    TemplateExecuteAndSyncResponse,
    AdvancedTemplateRenderRequest,
    AdvancedTemplateRenderResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=TemplateListResponse)
async def list_templates(
    category: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> TemplateListResponse:
    """List all templates with optional filtering.

    Returns global templates and user's private templates.
    """
    try:
        from template_manager import template_manager

        logger.info(f"DEBUG: API list_templates - current_user dict: {current_user}")
        username = current_user.get("username")  # Get username from current_user
        logger.info(f"DEBUG: API list_templates - extracted username: {username}")

        if search:
            logger.info(
                f"DEBUG: API list_templates - using search with username={username}"
            )
            templates = template_manager.search_templates(
                search, search_content=True, username=username
            )
        else:
            logger.info(
                f"DEBUG: API list_templates - calling list_templates with username={username}"
            )
            templates = template_manager.list_templates(
                category=category,
                source=source,
                active_only=active_only,
                username=username,
            )

        # Convert to response models
        logger.info(
            f"DEBUG: API list_templates - received {len(templates)} templates from manager"
        )
        template_responses = []
        for template in templates:
            logger.info(
                f"DEBUG: API list_templates - converting template id={template['id']}, name={template['name']}, scope={template.get('scope')}"
            )
            template_responses.append(TemplateResponse(**template))

        logger.info(
            f"DEBUG: API list_templates - returning {len(template_responses)} templates to frontend"
        )
        return TemplateListResponse(
            templates=template_responses, total=len(template_responses)
        )

    except Exception as e:
        logger.error(f"Error listing templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list templates: {str(e)}",
        )


@router.get("/categories")
async def get_template_categories(
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> List[str]:
    """Get all template categories."""
    try:
        from template_manager import template_manager

        return template_manager.get_categories()

    except Exception as e:
        logger.error(f"Error getting template categories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get categories: {str(e)}",
        )


@router.get("/scan-import", response_model=TemplateScanImportResponse)
async def scan_import_directory(
    current_user: dict = Depends(require_permission("network.templates", "write")),
) -> TemplateScanImportResponse:
    """Scan the import directory for YAML template files."""
    try:
        import yaml
        from pathlib import Path

        # Import directory path
        import_dir = Path("../contributing-data")
        if not import_dir.exists():
            return TemplateScanImportResponse(
                templates=[], total_found=0, message="Import directory not found"
            )

        templates = []
        yaml_files = list(import_dir.glob("*.yaml")) + list(import_dir.glob("*.yml"))

        for yaml_file in yaml_files:
            try:
                with open(yaml_file, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)

                # Extract template information from YAML
                if isinstance(data, dict):
                    # Check if it's the expected import format with properties
                    if "properties" in data and isinstance(data["properties"], dict):
                        props = data["properties"]
                        source_value = props.get("source", "file")
                        print(
                            f"DEBUG: Processing {yaml_file.name} - source from props: {source_value}"
                        )
                        template_info = ImportableTemplateInfo(
                            name=props.get("name", yaml_file.stem),
                            description=props.get(
                                "description", "No description available"
                            ),
                            category=props.get("category", "default"),
                            source=source_value,
                            file_path=str(yaml_file.absolute()),
                            template_type=props.get(
                                "type", props.get("template_type", "jinja2")
                            ),
                        )
                    else:
                        # Fallback for direct format (properties at root level)
                        source_value = data.get("source", "file")
                        print(
                            f"DEBUG: Processing {yaml_file.name} - source from root: {source_value}"
                        )
                        template_info = ImportableTemplateInfo(
                            name=data.get("name", yaml_file.stem),
                            description=data.get(
                                "description", "No description available"
                            ),
                            category=data.get("category", "default"),
                            source=source_value,
                            file_path=str(yaml_file.absolute()),
                            template_type=data.get("template_type", "jinja2"),
                        )
                    print(
                        f"DEBUG: Created template_info for {yaml_file.name}: source={template_info.source}"
                    )
                    templates.append(template_info)
            except Exception as e:
                logger.warning(f"Failed to parse {yaml_file}: {str(e)}")
                continue

        return TemplateScanImportResponse(
            templates=templates,
            total_found=len(templates),
            message=f"Found {len(templates)} importable templates",
        )

    except Exception as e:
        logger.error(f"Failed to scan import directory: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scan import directory: {str(e)}",
        )


@router.post("", response_model=TemplateResponse)
async def create_template(
    template_request: TemplateRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
) -> TemplateResponse:
    """Create a new template. Requires write permission."""
    try:
        from template_manager import template_manager

        username = current_user.get("username")  # Get username from current_user

        template_data = template_request.dict(exclude_unset=True)
        # Set created_by to the current user
        template_data["created_by"] = username

        template_id = template_manager.create_template(template_data)

        if template_id:
            template = template_manager.get_template(template_id)
            return TemplateResponse(**template)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create template",
            )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create template: {str(e)}",
        )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: int,
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> TemplateResponse:
    """Get a specific template by ID."""
    try:
        from template_manager import template_manager

        template = template_manager.get_template(template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found",
            )

        return TemplateResponse(**template)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template: {str(e)}",
        )


@router.get("/name/{template_name}", response_model=TemplateResponse)
async def get_template_by_name(
    template_name: str,
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> TemplateResponse:
    """Get a template by name."""
    try:
        from template_manager import template_manager

        template = template_manager.get_template_by_name(template_name)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with name '{template_name}' not found",
            )

        return TemplateResponse(**template)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template by name '{template_name}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template: {str(e)}",
        )


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: int,
    template_request: TemplateUpdateRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
) -> TemplateResponse:
    """Update an existing template. Requires write permission."""
    try:
        from template_manager import template_manager

        # Get the existing template to check ownership
        existing_template = template_manager.get_template(template_id)
        if not existing_template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found",
            )

        # Check permissions: users can only edit their own templates, admins can edit all
        username = current_user.get("username")
        is_admin = current_user.get("permissions", 0) & 16  # Check admin permission bit

        if not is_admin and existing_template.get("created_by") != username:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit your own templates",
            )

        template_data = template_request.dict(exclude_unset=True)
        logger.info(
            f"DEBUG: API update_template({template_id}) - received data: {template_data}"
        )
        logger.info(
            f"DEBUG: API update_template({template_id}) - scope in data: {template_data.get('scope')}"
        )
        success = template_manager.update_template(template_id, template_data)

        if success:
            template = template_manager.get_template(template_id)
            return TemplateResponse(**template)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update template",
            )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating template {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update template: {str(e)}",
        )


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    hard_delete: bool = True,
    current_user: dict = Depends(require_permission("network.templates", "delete")),
) -> Dict[str, str]:
    """Delete a template."""
    try:
        from template_manager import template_manager

        success = template_manager.delete_template(template_id, hard_delete=hard_delete)

        if success:
            return {
                "message": f"Template {template_id} {'deleted' if hard_delete else 'deactivated'} successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete template",
            )

    except Exception as e:
        logger.error(f"Error deleting template {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete template: {str(e)}",
        )


@router.get("/{template_id}/content")
async def get_template_content(
    template_id: int,
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> Dict[str, str]:
    """Get template content."""
    try:
        from template_manager import template_manager

        content = template_manager.get_template_content(template_id)
        if content is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template content for ID {template_id} not found",
            )

        return {"content": content}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template content for {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template content: {str(e)}",
        )


@router.get("/{template_id}/versions")
async def get_template_versions(
    template_id: int,
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> List[Dict[str, Any]]:
    """Get version history for a template."""
    try:
        from template_manager import template_manager

        versions = template_manager.get_template_versions(template_id)
        return versions

    except Exception as e:
        logger.error(f"Error getting template versions for {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template versions: {str(e)}",
        )


@router.post("/upload")
async def upload_template_file(
    file: UploadFile = File(...),
    name: str = Form(...),
    category: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    template_type: str = Form("jinja2"),
    scope: str = Form("global"),
    current_user: dict = Depends(require_permission("network.templates", "write")),
) -> TemplateResponse:
    """Upload a template file."""
    try:
        from template_manager import template_manager

        username = current_user.get("username")  # Get username from current_user

        # Read file content
        content = await file.read()
        content_str = content.decode("utf-8")

        # Determine type/category based on filename
        ext = os.path.splitext(file.filename)[1].lower()
        inferred_type = template_type
        inferred_category = category
        if ext == ".textfsm":
            inferred_type = "textfsm"
            inferred_category = category or "parser"

        # Create template data
        template_data = {
            "name": name,
            "source": "file",
            "template_type": inferred_type,
            "category": inferred_category,
            "description": description,
            "content": content_str,
            "filename": file.filename,
            "created_by": username,
            "scope": scope,
        }

        template_id = template_manager.create_template(template_data)

        if template_id:
            template = template_manager.get_template(template_id)
            return TemplateResponse(**template)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create template from uploaded file",
            )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error uploading template file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload template file: {str(e)}",
        )


@router.post("/git/test")
async def test_git_connection(
    git_test: TemplateGitTestRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
) -> Dict[str, Any]:
    """Test Git repository connection for templates."""
    try:
        # TODO: Implement Git connection testing
        # For now, return a mock response
        return {
            "success": True,
            "message": "Git connection test successful",
            "repository_accessible": True,
            "files_found": ["template1.j2", "template2.txt"],
        }

    except Exception as e:
        logger.error(f"Error testing Git connection: {e}")
        return {
            "success": False,
            "message": f"Git connection test failed: {str(e)}",
            "repository_accessible": False,
        }


@router.post("/sync", response_model=TemplateSyncResponse)
async def sync_templates(
    sync_request: TemplateSyncRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
) -> TemplateSyncResponse:
    """Sync templates from Git repositories."""
    try:
        from template_manager import template_manager

        # TODO: Implement Git template synchronization
        # For now, return a mock response

        if sync_request.template_id:
            # Sync specific template
            synced_templates = [sync_request.template_id]
            failed_templates = []
            errors = {}
            message = f"Template {sync_request.template_id} synced successfully"
        else:
            # Sync all Git templates
            git_templates = template_manager.list_templates(source="git")
            synced_templates = [t["id"] for t in git_templates]
            failed_templates = []
            errors = {}
            message = f"Synced {len(synced_templates)} Git templates"

        return TemplateSyncResponse(
            synced_templates=synced_templates,
            failed_templates=failed_templates,
            errors=errors,
            message=message,
        )

    except Exception as e:
        logger.error(f"Error syncing templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync templates: {str(e)}",
        )


@router.post("/import", response_model=TemplateImportResponse)
async def import_templates(
    import_request: TemplateImportRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
) -> TemplateImportResponse:
    """Import multiple templates from various sources."""
    try:
        from template_manager import template_manager

        imported_templates = []
        skipped_templates = []
        failed_templates = []
        errors = {}

        # TODO: Implement template import functionality
        # For now, return a mock response

        if import_request.source_type == "git_bulk":
            # Import from Git repository
            imported_templates = ["template1", "template2", "template3"]
            message = (
                f"Imported {len(imported_templates)} templates from Git repository"
            )
        elif import_request.source_type == "yaml_bulk":
            # Import from YAML files
            import yaml

            if import_request.yaml_file_paths:
                for yaml_path in import_request.yaml_file_paths:
                    try:
                        print(f"Processing YAML file: {yaml_path}")

                        # Read and parse YAML file
                        with open(yaml_path, "r", encoding="utf-8") as f:
                            yaml_data = yaml.safe_load(f)

                        print(f"YAML data: {yaml_data}")

                        # Extract template info from YAML
                        template_path = yaml_data.get("path", "")
                        properties = yaml_data.get("properties", {})

                        if not template_path:
                            failed_templates.append(yaml_path)
                            errors[yaml_path] = "No template path specified in YAML"
                            continue

                        # Make path absolute - the path in YAML is relative to project root
                        if not os.path.isabs(template_path):
                            # Get the project root (go up from backend/routers/ to project root)
                            current_file = os.path.abspath(__file__)
                            routers_dir = os.path.dirname(
                                current_file
                            )  # backend/routers
                            backend_dir = os.path.dirname(routers_dir)  # backend
                            project_root = os.path.dirname(backend_dir)  # project root
                            template_path = os.path.join(project_root, template_path)

                        print(f"Template path: {template_path}")

                        # Read actual template content
                        if not os.path.exists(template_path):
                            failed_templates.append(yaml_path)
                            errors[yaml_path] = (
                                f"Template file not found: {template_path}"
                            )
                            print(f"ERROR: Template file not found: {template_path}")
                            continue

                        print(f"Reading template content from: {template_path}")
                        with open(template_path, "r", encoding="utf-8") as f:
                            template_content = f.read()

                        print(
                            f"Template content length: {len(template_content)} characters"
                        )

                        # Prepare template data
                        template_name = properties.get(
                            "name", os.path.splitext(os.path.basename(template_path))[0]
                        )
                        template_data = {
                            "name": template_name,
                            "source": properties.get("source", "file"),
                            "template_type": properties.get("type", "jinja2"),
                            "category": properties.get(
                                "category",
                                import_request.default_category or "uncategorized",
                            ),
                            "content": template_content,
                            "description": properties.get("description", ""),
                            "filename": os.path.basename(template_path),
                            "created_by": current_user.get("username"),
                            "scope": "global",  # Imported templates are global by default
                        }

                        print(
                            f"Template data prepared: {template_data['name']}, type: {template_data['template_type']}, category: {template_data['category']}, content_length: {len(template_data['content'])}"
                        )

                        # Check for existing template
                        if not import_request.overwrite_existing:
                            existing = template_manager.get_template_by_name(
                                template_data["name"]
                            )
                            if existing:
                                skipped_templates.append(template_data["name"])
                                print(
                                    f"SKIPPED: Template {template_data['name']} already exists"
                                )
                                continue

                        # Create template
                        print(f"Creating template: {template_data['name']}")
                        template_id = template_manager.create_template(template_data)
                        print(f"Template creation result: {template_id}")
                        if template_id:
                            imported_templates.append(template_data["name"])
                            print(
                                f"SUCCESS: Imported template: {template_data['name']}"
                            )
                        else:
                            failed_templates.append(template_data["name"])
                            errors[template_data["name"]] = "Failed to create template"
                            print(
                                f"FAILED: Could not create template: {template_data['name']}"
                            )

                    except Exception as e:
                        failed_templates.append(yaml_path)
                        errors[yaml_path] = str(e)
                        print(f"Error processing {yaml_path}: {e}")

            message = f"Imported {len(imported_templates)} templates from YAML files"
        elif import_request.source_type == "file_bulk":
            # Import from uploaded files
            # Accept .textfsm, .j2, .txt, etc.
            if import_request.file_contents:
                for file_data in import_request.file_contents:
                    try:
                        # Only allow certain extensions
                        ext = os.path.splitext(file_data["filename"])[1].lower()
                        if ext not in [".txt", ".j2", ".textfsm"]:
                            skipped_templates.append(file_data["filename"])
                            continue
                        # Use original filename for name and infer type/category
                        inferred_type = import_request.default_template_type
                        inferred_category = import_request.default_category
                        if ext == ".textfsm":
                            inferred_type = "textfsm"
                            if not inferred_category:
                                inferred_category = "parser"
                        template_data = {
                            "name": os.path.splitext(file_data["filename"])[0],
                            "source": "file",
                            "template_type": inferred_type,
                            "category": inferred_category,
                            "content": file_data["content"],
                            "filename": file_data["filename"],
                            "created_by": current_user.get("username"),
                            "scope": "global",  # Imported templates are global by default
                        }
                        if not import_request.overwrite_existing:
                            existing = template_manager.get_template_by_name(
                                template_data["name"]
                            )
                            if existing:
                                skipped_templates.append(template_data["name"])
                                continue
                        template_id = template_manager.create_template(template_data)
                        if template_id:
                            imported_templates.append(template_data["name"])
                        else:
                            failed_templates.append(template_data["name"])
                    except Exception as e:
                        failed_templates.append(file_data["filename"])
                        errors[file_data["filename"]] = str(e)
            message = (
                f"Imported {len(imported_templates)} templates from uploaded files"
            )
        else:
            raise ValueError(
                f"Unsupported import source type: {import_request.source_type}"
            )

        return TemplateImportResponse(
            imported_templates=imported_templates,
            skipped_templates=skipped_templates,
            failed_templates=failed_templates,
            errors=errors,
            total_processed=len(imported_templates)
            + len(skipped_templates)
            + len(failed_templates),
            message=message,
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error importing templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import templates: {str(e)}",
        )


@router.post("/advanced-render", response_model=AdvancedTemplateRenderResponse)
async def advanced_render_template(
    render_request: AdvancedTemplateRenderRequest,
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> AdvancedTemplateRenderResponse:
    """
    Advanced unified template rendering for both netmiko and agent templates.

    This endpoint:
    - Handles both netmiko and agent template types
    - Executes pre_run commands dynamically for netmiko templates
    - Fetches inventory context for agent templates
    - Supports all necessary variables and context

    The frontend should send user_variables WITHOUT pre_run.raw and pre_run.parsed,
    as the backend will execute and parse commands dynamically.
    """
    try:
        from services.nautobot.devices import device_query_service
        from services.checkmk.config import config_service
        from jinja2 import Template, TemplateError, UndefinedError
        import re

        category = render_request.category.lower()
        template_content = render_request.template_content
        warnings = []

        # Initialize pre_run variables (only used for netmiko templates)
        pre_run_output = None
        pre_run_parsed = None

        # Initialize context with user variables
        context = {}
        if render_request.user_variables:
            context.update(render_request.user_variables)

        # Handle netmiko templates
        if category == "netmiko":
            # Initialize pre_run to empty (optional, will be populated if command provided)
            context["pre_run"] = {"raw": "", "parsed": []}

            # Determine if we need to fetch device data
            # We need it if: use_nautobot_context is True OR pre_run_command is provided
            needs_device_data = (
                render_request.use_nautobot_context
                or (
                    render_request.pre_run_command
                    and render_request.pre_run_command.strip()
                )
            ) and render_request.device_id

            # Fetch Nautobot device data if needed
            if needs_device_data:
                try:
                    device_data = await device_query_service.get_device_details(
                        device_id=render_request.device_id,
                        use_cache=True,
                    )
                    context["device_details"] = device_data

                    # Build simplified devices array for compatibility
                    devices = [
                        {
                            "id": render_request.device_id,
                            "name": device_data.get("name", ""),
                            "primary_ip4": device_data.get("primary_ip4", {}).get(
                                "address", ""
                            )
                            if isinstance(device_data.get("primary_ip4"), dict)
                            else device_data.get("primary_ip4", ""),
                            "primary_ip6": device_data.get("primary_ip6", {}).get(
                                "address", ""
                            )
                            if isinstance(device_data.get("primary_ip6"), dict)
                            else device_data.get("primary_ip6", ""),
                        }
                    ]
                    context["devices"] = devices

                    logger.info(
                        f"Fetched Nautobot context for device {render_request.device_id}"
                    )
                except Exception as e:
                    error_msg = f"Failed to fetch Nautobot device data: {str(e)}"
                    logger.error(error_msg)
                    # If we needed device data for pre_run_command, this is critical
                    if (
                        render_request.pre_run_command
                        and render_request.pre_run_command.strip()
                    ):
                        raise ValueError(error_msg)
                    # Otherwise just add warning
                    warnings.append(error_msg)

            # Execute pre-run command if provided
            if (
                render_request.pre_run_command
                and render_request.pre_run_command.strip()
            ):
                if not render_request.device_id:
                    raise ValueError(
                        "A test device is required to execute pre-run commands. "
                        "Please select a test device in the Netmiko Options panel."
                    )
                if not render_request.credential_id:
                    raise ValueError(
                        "Device credentials are required to execute pre-run commands. "
                        "Please select credentials in the Netmiko Options panel."
                    )

                try:
                    # Import the render service to use its pre-run execution method
                    from services.network.automation.render import render_service

                    pre_run_result = await render_service._execute_pre_run_command(
                        device_id=render_request.device_id,
                        command=render_request.pre_run_command.strip(),
                        credential_id=render_request.credential_id,
                        nautobot_device=context.get("device_details"),
                    )

                    pre_run_output = pre_run_result.get("raw_output", "")
                    pre_run_parsed = pre_run_result.get("parsed_output", [])

                    # Add to context as pre_run object
                    context["pre_run"] = {
                        "raw": pre_run_output,
                        "parsed": pre_run_parsed,
                    }

                    if pre_run_result.get("parse_error"):
                        warnings.append(
                            f"TextFSM parsing not available: {pre_run_result['parse_error']}"
                        )

                    logger.info(
                        f"Pre-run command executed. Raw length: {len(pre_run_output)}, Parsed records: {len(pre_run_parsed)}"
                    )
                except Exception as e:
                    error_msg = f"Failed to execute pre-run command: {str(e)}"
                    logger.error(error_msg)
                    raise ValueError(error_msg)

        # Handle agent templates
        elif category == "agent":
            # Fetch inventory devices if inventory_id provided
            if render_request.inventory_id:
                try:
                    # Fetch devices from inventory using the same pattern as /api/inventory/resolve-devices
                    from inventory_manager import inventory_manager
                    from utils.inventory_converter import (
                        convert_saved_inventory_to_operations,
                    )
                    from services.inventory.inventory import inventory_service

                    # Get inventory by ID
                    inventory = inventory_manager.get_inventory(
                        render_request.inventory_id
                    )
                    if not inventory:
                        raise ValueError(
                            f"Inventory with ID {render_request.inventory_id} not found"
                        )

                    # Convert stored conditions to operations
                    conditions = inventory.get("conditions", [])
                    if not conditions:
                        logger.warning(
                            f"Inventory {render_request.inventory_id} has no conditions"
                        )
                        context["devices"] = []
                        context["device_details"] = {}
                    else:
                        operations = convert_saved_inventory_to_operations(conditions)

                        # Execute operations to get matching devices
                        devices, _ = await inventory_service.preview_inventory(
                            operations
                        )

                        # Convert devices to simple dict format for context
                        device_list = [
                            {
                                "id": device.id,
                                "name": device.name,
                                "primary_ip4": device.primary_ip4,
                            }
                            for device in devices
                        ]
                        context["devices"] = device_list

                        # Fetch device details for each device
                        device_details = {}
                        for device in devices:
                            try:
                                device_data = (
                                    await device_query_service.get_device_details(
                                        device_id=device.id,
                                        use_cache=True,
                                    )
                                )
                                # Use device name (hostname) as key for user-friendly Jinja2 templates
                                device_details[device.name] = device_data
                            except Exception as e:
                                warning_msg = f"Failed to fetch details for device {device.id}: {str(e)}"
                                logger.warning(warning_msg)
                                warnings.append(warning_msg)

                        context["device_details"] = device_details
                        logger.info(
                            f"Fetched {len(device_list)} devices from inventory {render_request.inventory_id}"
                        )

                except Exception as e:
                    error_msg = f"Failed to fetch inventory devices: {str(e)}"
                    logger.error(error_msg)
                    warnings.append(error_msg)

            # Load SNMP mapping if requested
            if render_request.pass_snmp_mapping:
                try:
                    snmp_mapping = config_service.load_snmp_mapping()
                    context["snmp_mapping"] = snmp_mapping
                    logger.info(f"Loaded SNMP mapping with {len(snmp_mapping)} entries")
                except Exception as e:
                    error_msg = f"Failed to load SNMP mapping: {str(e)}"
                    logger.error(error_msg)
                    warnings.append(error_msg)

            # Add path if provided
            if render_request.path:
                context["path"] = render_request.path

        # Extract variables used in template
        def extract_template_variables(template_content: str) -> List[str]:
            """Extract variable names from Jinja2 template."""
            pattern = r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_\.]*)"
            matches = re.findall(pattern, template_content)
            return sorted(set(matches))

        variables_used = extract_template_variables(template_content)

        # Render the template
        try:
            jinja_template = Template(template_content)
            rendered_content = jinja_template.render(**context)
        except UndefinedError as e:
            available_vars = list(context.keys())
            raise ValueError(
                f"Undefined variable in template: {str(e)}. Available variables: {', '.join(available_vars)}"
            )
        except TemplateError as e:
            raise ValueError(f"Template syntax error: {str(e)}")

        return AdvancedTemplateRenderResponse(
            rendered_content=rendered_content,
            variables_used=variables_used,
            context_data=context,
            warnings=warnings,
            pre_run_output=pre_run_output,
            pre_run_parsed=pre_run_parsed,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error in advanced template rendering: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to render template: {str(e)}",
        )


@router.get("/health")
async def template_health_check(
    current_user: dict = Depends(require_permission("network.templates", "read")),
) -> Dict[str, Any]:
    """Check template system health."""
    try:
        from template_manager import template_manager

        return template_manager.health_check()

    except Exception as e:
        logger.error(f"Template health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}


@router.post("/execute-and-sync", response_model=TemplateExecuteAndSyncResponse)
async def execute_template_and_sync_to_nautobot(
    request: TemplateExecuteAndSyncRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
) -> TemplateExecuteAndSyncResponse:
    """
    Execute template and sync results to Nautobot.

    This endpoint:
    1. Renders the template for each specified device
    2. Parses the rendered output (JSON/YAML/text)
    3. Updates device(s) in Nautobot via the update-devices Celery task
    4. Returns combined result with task tracking info

    Args:
        request: TemplateExecuteAndSyncRequest containing:
            - template_id: Template to execute
            - device_ids: List of device UUIDs
            - user_variables: Optional template variables
            - dry_run: Validate without updating (default: False)
            - output_format: Expected format (json/yaml/text)

    Returns:
        TemplateExecuteAndSyncResponse with task_id, job_id, and results
    """
    try:
        import json
        import yaml
        from template_manager import template_manager
        from tasks.update_devices_task import update_devices_task
        import job_run_manager

        logger.info(
            f"Execute-and-sync request for template {request.template_id} on {len(request.device_ids)} device(s)"
        )

        # Get template
        template = template_manager.get_template(request.template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {request.template_id} not found",
            )

        rendered_outputs = {}
        parsed_updates = []
        errors = []
        warnings = []

        # Get template content
        template_content = template_manager.get_template_content(request.template_id)
        if not template_content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template content for ID {request.template_id} not found",
            )

        # Render template for each device
        for device_id in request.device_ids:
            try:
                logger.info(f"Rendering template for device {device_id}")

                # Render template using the render_service (supports Nautobot context and pre-run commands)
                from services.network.automation.render import render_service

                result = await render_service.render_template(
                    template_content=template_content,
                    category=template["category"],
                    device_id=device_id,
                    user_variables=request.user_variables or {},
                    use_nautobot_context=template.get("use_nautobot_context", True),
                    pre_run_command=template.get("pre_run_command"),
                    credential_id=template.get("credential_id"),
                )

                rendered_content = result["rendered_content"]
                rendered_outputs[device_id] = rendered_content

                # Capture any warnings from rendering
                if result.get("warnings"):
                    for warning in result["warnings"]:
                        warnings.append(f"Device {device_id}: {warning}")

                # Parse the rendered output based on format
                try:
                    if request.output_format == "json":
                        # Parse JSON output
                        parsed_data = json.loads(rendered_content)
                        if isinstance(parsed_data, dict):
                            # Add device_id if not present
                            if "id" not in parsed_data and "name" not in parsed_data:
                                parsed_data["id"] = device_id
                            logger.info(
                                f"Parsed JSON for device {device_id}: interfaces={parsed_data.get('interfaces', 'NOT_FOUND')}"
                            )
                            if "interfaces" in parsed_data:
                                logger.info(
                                    f"  - Found {len(parsed_data['interfaces'])} interface(s) in parsed JSON"
                                )
                            parsed_updates.append(parsed_data)
                        else:
                            errors.append(
                                f"Device {device_id}: JSON output must be an object, got {type(parsed_data)}"
                            )

                    elif request.output_format == "yaml":
                        # Parse YAML output
                        parsed_data = yaml.safe_load(rendered_content)
                        if isinstance(parsed_data, dict):
                            # Add device_id if not present
                            if "id" not in parsed_data and "name" not in parsed_data:
                                parsed_data["id"] = device_id
                            parsed_updates.append(parsed_data)
                        else:
                            errors.append(
                                f"Device {device_id}: YAML output must be an object, got {type(parsed_data)}"
                            )

                    elif request.output_format == "text":
                        # Parse key-value pairs from text (simple format)
                        # Format: key=value (one per line)
                        parsed_data = {"id": device_id}
                        for line in rendered_content.strip().split("\n"):
                            line = line.strip()
                            if "=" in line and not line.startswith("#"):
                                key, value = line.split("=", 1)
                                parsed_data[key.strip()] = value.strip()

                        if len(parsed_data) > 1:  # More than just the id
                            parsed_updates.append(parsed_data)
                        else:
                            warnings.append(
                                f"Device {device_id}: No key-value pairs found in text output"
                            )

                    else:
                        errors.append(
                            f"Device {device_id}: Unsupported output format '{request.output_format}'"
                        )

                except json.JSONDecodeError as e:
                    errors.append(f"Device {device_id}: Failed to parse JSON: {str(e)}")
                except yaml.YAMLError as e:
                    errors.append(f"Device {device_id}: Failed to parse YAML: {str(e)}")
                except Exception as e:
                    errors.append(f"Device {device_id}: Parse error: {str(e)}")

            except Exception as e:
                errors.append(
                    f"Device {device_id}: Template rendering failed: {str(e)}"
                )
                logger.error(f"Error rendering template for device {device_id}: {e}")

        # If dry_run or errors occurred, return without triggering update task
        if request.dry_run:
            return TemplateExecuteAndSyncResponse(
                success=len(errors) == 0,
                message=f"Dry run completed. Parsed {len(parsed_updates)} device update(s). {len(errors)} error(s).",
                rendered_outputs=rendered_outputs,
                parsed_updates=parsed_updates,
                errors=errors,
                warnings=warnings,
            )

        if len(errors) > 0:
            return TemplateExecuteAndSyncResponse(
                success=False,
                message=f"Template rendering/parsing failed with {len(errors)} error(s)",
                rendered_outputs=rendered_outputs,
                parsed_updates=parsed_updates,
                errors=errors,
                warnings=warnings,
            )

        if len(parsed_updates) == 0:
            return TemplateExecuteAndSyncResponse(
                success=False,
                message="No device updates to process",
                rendered_outputs=rendered_outputs,
                errors=["No valid device updates parsed from template output"],
                warnings=warnings,
            )

        # Trigger the update-devices Celery task
        logger.info(
            f"Triggering update-devices task for {len(parsed_updates)} device(s)"
        )
        task = update_devices_task.delay(
            devices=parsed_updates,
            dry_run=False,
        )

        # Create job run record for tracking
        job_name = f"Sync to Nautobot from template '{template['name']}'"
        job_run = job_run_manager.create_job_run(
            job_name=job_name,
            job_type="template_execute_and_sync",
            triggered_by="manual",
            executed_by=current_user.get("username"),
        )

        # Mark as started with Celery task ID
        job_run_manager.mark_started(job_run["id"], task.id)

        return TemplateExecuteAndSyncResponse(
            success=True,
            message=f"Successfully queued update for {len(parsed_updates)} device(s)",
            task_id=task.id,
            job_id=str(job_run["id"]),
            rendered_outputs=rendered_outputs,
            parsed_updates=parsed_updates,
            errors=errors,
            warnings=warnings,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in execute-and-sync: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute template and sync: {str(e)}",
        )
