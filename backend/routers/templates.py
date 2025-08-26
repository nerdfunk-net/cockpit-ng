"""
Template router for template management operations.
"""

from __future__ import annotations
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
import os

from core.auth import verify_token
from models.templates import (
    TemplateRequest, 
    TemplateResponse, 
    TemplateListResponse,
    TemplateContentRequest,
    TemplateContentResponse,
    TemplateGitTestRequest,
    TemplateSyncRequest,
    TemplateSyncResponse,
    TemplateImportRequest,
    TemplateImportResponse,
    TemplateUpdateRequest,
    ImportableTemplateInfo,
    TemplateScanImportResponse
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=TemplateListResponse)
async def list_templates(
    category: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    current_user: str = Depends(verify_token)
) -> TemplateListResponse:
    """List all templates with optional filtering."""
    try:
        from template_manager import template_manager

        if search:
            templates = template_manager.search_templates(search, search_content=True)
        else:
            templates = template_manager.list_templates(category=category, source=source, active_only=active_only)

        # Convert to response models
        template_responses = []
        for template in templates:
            template_responses.append(TemplateResponse(**template))

        return TemplateListResponse(
            templates=template_responses,
            total=len(template_responses)
        )

    except Exception as e:
        logger.error(f"Error listing templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list templates: {str(e)}"
        )


@router.get("/categories")
async def get_template_categories(current_user: str = Depends(verify_token)) -> List[str]:
    """Get all template categories."""
    try:
        from template_manager import template_manager
        return template_manager.get_categories()

    except Exception as e:
        logger.error(f"Error getting template categories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get categories: {str(e)}"
        )


@router.get("/scan-import", response_model=TemplateScanImportResponse)
async def scan_import_directory(
    current_user: str = Depends(verify_token)
) -> TemplateScanImportResponse:
    """Scan the import directory for YAML template files."""
    try:
        import yaml
        from pathlib import Path
        
        # Import directory path
        import_dir = Path("../data/import_on_new_installation")
        if not import_dir.exists():
            return TemplateScanImportResponse(
                templates=[],
                total_found=0,
                message="Import directory not found"
            )
        
        templates = []
        yaml_files = list(import_dir.glob("*.yaml")) + list(import_dir.glob("*.yml"))
        
        for yaml_file in yaml_files:
            try:
                with open(yaml_file, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)
                
                # Extract template information from YAML
                if isinstance(data, dict):
                    # Check if it's the expected import format with properties
                    if 'properties' in data and isinstance(data['properties'], dict):
                        props = data['properties']
                        source_value = props.get('source', 'file')
                        print(f"DEBUG: Processing {yaml_file.name} - source from props: {source_value}")
                        template_info = ImportableTemplateInfo(
                            name=props.get('name', yaml_file.stem),
                            description=props.get('description', 'No description available'),
                            category=props.get('category', 'default'),
                            source=source_value,
                            file_path=str(yaml_file.absolute()),
                            template_type=props.get('type', props.get('template_type', 'jinja2'))
                        )
                    else:
                        # Fallback for direct format (properties at root level)
                        source_value = data.get('source', 'file')
                        print(f"DEBUG: Processing {yaml_file.name} - source from root: {source_value}")
                        template_info = ImportableTemplateInfo(
                            name=data.get('name', yaml_file.stem),
                            description=data.get('description', 'No description available'),
                            category=data.get('category', 'default'),
                            source=source_value,
                            file_path=str(yaml_file.absolute()),
                            template_type=data.get('template_type', 'jinja2')
                        )
                    print(f"DEBUG: Created template_info for {yaml_file.name}: source={template_info.source}")
                    templates.append(template_info)
            except Exception as e:
                logger.warning(f"Failed to parse {yaml_file}: {str(e)}")
                continue
        
        return TemplateScanImportResponse(
            templates=templates,
            total_found=len(templates),
            message=f"Found {len(templates)} importable templates"
        )
    
    except Exception as e:
        logger.error(f"Failed to scan import directory: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scan import directory: {str(e)}"
        )


@router.post("", response_model=TemplateResponse)
async def create_template(
    template_request: TemplateRequest,
    current_user: str = Depends(verify_token)
) -> TemplateResponse:
    """Create a new template."""
    try:
        from template_manager import template_manager

        template_data = template_request.dict(exclude_unset=True)
        template_id = template_manager.create_template(template_data)

        if template_id:
            template = template_manager.get_template(template_id)
            return TemplateResponse(**template)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create template"
            )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create template: {str(e)}"
        )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: int,
    current_user: str = Depends(verify_token)
) -> TemplateResponse:
    """Get a specific template by ID."""
    try:
        from template_manager import template_manager

        template = template_manager.get_template(template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )

        return TemplateResponse(**template)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template: {str(e)}"
        )


@router.get("/name/{template_name}", response_model=TemplateResponse)
async def get_template_by_name(
    template_name: str,
    current_user: str = Depends(verify_token)
) -> TemplateResponse:
    """Get a template by name."""
    try:
        from template_manager import template_manager

        template = template_manager.get_template_by_name(template_name)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with name '{template_name}' not found"
            )

        return TemplateResponse(**template)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template by name '{template_name}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template: {str(e)}"
        )


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: int,
    template_request: TemplateUpdateRequest,
    current_user: str = Depends(verify_token)
) -> TemplateResponse:
    """Update an existing template."""
    try:
        from template_manager import template_manager

        template_data = template_request.dict(exclude_unset=True, exclude_none=True)
        success = template_manager.update_template(template_id, template_data)

        if success:
            template = template_manager.get_template(template_id)
            return TemplateResponse(**template)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update template"
            )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating template {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update template: {str(e)}"
        )


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    hard_delete: bool = True,
    current_user: str = Depends(verify_token)
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
                detail="Failed to delete template"
            )

    except Exception as e:
        logger.error(f"Error deleting template {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete template: {str(e)}"
        )


@router.get("/{template_id}/content")
async def get_template_content(
    template_id: int,
    current_user: str = Depends(verify_token)
) -> Dict[str, str]:
    """Get template content."""
    try:
        from template_manager import template_manager

        content = template_manager.get_template_content(template_id)
        if content is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template content for ID {template_id} not found"
            )

        return {"content": content}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template content for {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template content: {str(e)}"
        )


@router.post("/{template_id}/render", response_model=TemplateContentResponse)
async def render_template(
    template_id: int,
    render_request: TemplateContentRequest,
    current_user: str = Depends(verify_token)
) -> TemplateContentResponse:
    """Render a template with provided variables."""
    try:
        from template_manager import template_manager

        template = template_manager.get_template(template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )

        content = template_manager.get_template_content(template_id)
        if not content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template content for ID {template_id} not found"
            )

        # TODO: Implement template rendering with Jinja2
        # For now, return basic variable substitution
        variables = render_request.variables or {}
        rendered_content = content
        variables_used = []

        # Simple variable substitution for demonstration
        import re
        variable_pattern = r'{{\\s*([^}]+)\\s*}}'
        matches = re.findall(variable_pattern, content)

        for match in matches:
            var_name = match.strip()
            if var_name in variables:
                rendered_content = rendered_content.replace(f"{{{{ {var_name} }}}}", str(variables[var_name]))
                variables_used.append(var_name)

        return TemplateContentResponse(
            template_id=template_id,
            template_name=template['name'],
            rendered_content=rendered_content,
            variables_used=variables_used
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rendering template {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to render template: {str(e)}"
        )


@router.get("/{template_id}/versions")
async def get_template_versions(
    template_id: int,
    current_user: str = Depends(verify_token)
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
            detail=f"Failed to get template versions: {str(e)}"
        )


@router.post("/upload")
async def upload_template_file(
    file: UploadFile = File(...),
    name: str = Form(...),
    category: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    template_type: str = Form("jinja2"),
    current_user: str = Depends(verify_token)
) -> TemplateResponse:
    """Upload a template file."""
    try:
        from template_manager import template_manager

        # Read file content
        content = await file.read()
        content_str = content.decode('utf-8')

        # Determine type/category based on filename
        ext = os.path.splitext(file.filename)[1].lower()
        inferred_type = template_type
        inferred_category = category
        if ext == '.textfsm':
            inferred_type = 'textfsm'
            inferred_category = category or 'parser'

        # Create template data
        template_data = {
            'name': name,
            'source': 'file',
            'template_type': inferred_type,
            'category': inferred_category,
            'description': description,
            'content': content_str,
            'filename': file.filename
        }

        template_id = template_manager.create_template(template_data)

        if template_id:
            template = template_manager.get_template(template_id)
            return TemplateResponse(**template)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create template from uploaded file"
            )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error uploading template file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload template file: {str(e)}"
        )


@router.post("/git/test")
async def test_git_connection(
    git_test: TemplateGitTestRequest,
    current_user: str = Depends(verify_token)
) -> Dict[str, Any]:
    """Test Git repository connection for templates."""
    try:
        # TODO: Implement Git connection testing
        # For now, return a mock response
        return {
            "success": True,
            "message": "Git connection test successful",
            "repository_accessible": True,
            "files_found": ["template1.j2", "template2.txt"]
        }

    except Exception as e:
        logger.error(f"Error testing Git connection: {e}")
        return {
            "success": False,
            "message": f"Git connection test failed: {str(e)}",
            "repository_accessible": False
        }


@router.post("/sync", response_model=TemplateSyncResponse)
async def sync_templates(
    sync_request: TemplateSyncRequest,
    current_user: str = Depends(verify_token)
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
            synced_templates = [t['id'] for t in git_templates]
            failed_templates = []
            errors = {}
            message = f"Synced {len(synced_templates)} Git templates"

        return TemplateSyncResponse(
            synced_templates=synced_templates,
            failed_templates=failed_templates,
            errors=errors,
            message=message
        )

    except Exception as e:
        logger.error(f"Error syncing templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync templates: {str(e)}"
        )


@router.post("/import", response_model=TemplateImportResponse)
async def import_templates(
    import_request: TemplateImportRequest,
    current_user: str = Depends(verify_token)
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
            message = f"Imported {len(imported_templates)} templates from Git repository"
        elif import_request.source_type == "yaml_bulk":
            # Import from YAML files
            import yaml
            
            if import_request.yaml_file_paths:
                for yaml_path in import_request.yaml_file_paths:
                    try:
                        print(f"Processing YAML file: {yaml_path}")
                        
                        # Read and parse YAML file
                        with open(yaml_path, 'r', encoding='utf-8') as f:
                            yaml_data = yaml.safe_load(f)
                        
                        print(f"YAML data: {yaml_data}")
                        
                        # Extract template info from YAML
                        template_path = yaml_data.get('path', '')
                        properties = yaml_data.get('properties', {})
                        
                        if not template_path:
                            failed_templates.append(yaml_path)
                            errors[yaml_path] = "No template path specified in YAML"
                            continue
                        
                        # Make path absolute - the path in YAML is relative to project root
                        if not os.path.isabs(template_path):
                            # Get the project root (go up from backend/routers/ to project root)
                            current_file = os.path.abspath(__file__)
                            routers_dir = os.path.dirname(current_file)  # backend/routers
                            backend_dir = os.path.dirname(routers_dir)   # backend
                            project_root = os.path.dirname(backend_dir)  # project root
                            template_path = os.path.join(project_root, template_path)
                        
                        print(f"Template path: {template_path}")
                        
                        # Read actual template content
                        if not os.path.exists(template_path):
                            failed_templates.append(yaml_path)
                            errors[yaml_path] = f"Template file not found: {template_path}"
                            print(f"ERROR: Template file not found: {template_path}")
                            continue
                            
                        print(f"Reading template content from: {template_path}")
                        with open(template_path, 'r', encoding='utf-8') as f:
                            template_content = f.read()
                        
                        print(f"Template content length: {len(template_content)} characters")
                        
                        # Prepare template data
                        template_name = properties.get('name', os.path.splitext(os.path.basename(template_path))[0])
                        template_data = {
                            'name': template_name,
                            'source': properties.get('source', 'file'),
                            'template_type': properties.get('type', 'jinja2'),
                            'category': properties.get('category', import_request.default_category or 'uncategorized'),
                            'content': template_content,
                            'description': properties.get('description', ''),
                            'filename': os.path.basename(template_path)
                        }
                        
                        print(f"Template data prepared: {template_data['name']}, type: {template_data['template_type']}, category: {template_data['category']}, content_length: {len(template_data['content'])}")
                        
                        # Check for existing template
                        if not import_request.overwrite_existing:
                            existing = template_manager.get_template_by_name(template_data['name'])
                            if existing:
                                skipped_templates.append(template_data['name'])
                                print(f"SKIPPED: Template {template_data['name']} already exists")
                                continue
                        
                        # Create template
                        print(f"Creating template: {template_data['name']}")
                        template_id = template_manager.create_template(template_data)
                        print(f"Template creation result: {template_id}")
                        if template_id:
                            imported_templates.append(template_data['name'])
                            print(f"SUCCESS: Imported template: {template_data['name']}")
                        else:
                            failed_templates.append(template_data['name'])
                            errors[template_data['name']] = "Failed to create template"
                            print(f"FAILED: Could not create template: {template_data['name']}")
                            
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
                        ext = os.path.splitext(file_data['filename'])[1].lower()
                        if ext not in ['.txt', '.j2', '.textfsm']:
                            skipped_templates.append(file_data['filename'])
                            continue
                        # Use original filename for name and infer type/category
                        inferred_type = import_request.default_template_type
                        inferred_category = import_request.default_category
                        if ext == '.textfsm':
                            inferred_type = 'textfsm'
                            if not inferred_category:
                                inferred_category = 'parser'
                        template_data = {
                            'name': os.path.splitext(file_data['filename'])[0],
                            'source': 'file',
                            'template_type': inferred_type,
                            'category': inferred_category,
                            'content': file_data['content'],
                            'filename': file_data['filename']
                        }
                        if not import_request.overwrite_existing:
                            existing = template_manager.get_template_by_name(template_data['name'])
                            if existing:
                                skipped_templates.append(template_data['name'])
                                continue
                        template_id = template_manager.create_template(template_data)
                        if template_id:
                            imported_templates.append(template_data['name'])
                        else:
                            failed_templates.append(template_data['name'])
                    except Exception as e:
                        failed_templates.append(file_data['filename'])
                        errors[file_data['filename']] = str(e)
            message = f"Imported {len(imported_templates)} templates from uploaded files"
        else:
            raise ValueError(f"Unsupported import source type: {import_request.source_type}")

        return TemplateImportResponse(
            imported_templates=imported_templates,
            skipped_templates=skipped_templates,
            failed_templates=failed_templates,
            errors=errors,
            total_processed=len(imported_templates) + len(skipped_templates) + len(failed_templates),
            message=message
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error importing templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import templates: {str(e)}"
        )


@router.get("/health")
async def template_health_check(current_user: str = Depends(verify_token)) -> Dict[str, Any]:
    """Check template system health."""
    try:
        from template_manager import template_manager
        return template_manager.health_check()

    except Exception as e:
        logger.error(f"Template health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }
