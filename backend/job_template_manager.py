"""
Job Template Manager
Handles business logic for job templates using PostgreSQL and repository pattern.
"""

import json
import logging
from typing import Optional, List, Dict, Any

from repositories.jobs.job_template_repository import JobTemplateRepository

logger = logging.getLogger(__name__)

# Initialize repository
repo = JobTemplateRepository()


def create_job_template(
    name: str,
    job_type: str,
    user_id: int,
    created_by: str,
    description: Optional[str] = None,
    config_repository_id: Optional[int] = None,
    inventory_source: str = "all",
    inventory_repository_id: Optional[int] = None,
    inventory_name: Optional[str] = None,
    command_template_name: Optional[str] = None,
    backup_running_config_path: Optional[str] = None,
    backup_startup_config_path: Optional[str] = None,
    write_timestamp_to_custom_field: bool = False,
    timestamp_custom_field_name: Optional[str] = None,
    activate_changes_after_sync: bool = True,
    scan_resolve_dns: bool = False,
    scan_ping_count: Optional[int] = None,
    scan_timeout_ms: Optional[int] = None,
    scan_retries: Optional[int] = None,
    scan_interval_ms: Optional[int] = None,
    scan_custom_field_name: Optional[str] = None,
    scan_custom_field_value: Optional[str] = None,
    scan_response_custom_field_name: Optional[str] = None,
    scan_set_reachable_ip_active: bool = True,
    scan_max_ips: Optional[int] = None,
    parallel_tasks: int = 1,
    deploy_template_id: Optional[int] = None,
    deploy_agent_id: Optional[str] = None,
    deploy_path: Optional[str] = None,
    deploy_custom_variables: Optional[Dict[str, Any]] = None,
    activate_after_deploy: bool = True,
    deploy_templates: Optional[List[Dict[str, Any]]] = None,
    is_global: bool = False,
) -> Dict[str, Any]:
    """Create a new job template"""

    # Check for duplicate name
    if repo.check_name_exists(name, user_id if not is_global else None):
        raise ValueError(f"A job template with name '{name}' already exists")

    # Serialize deploy_custom_variables to JSON string for storage
    deploy_custom_variables_json = (
        json.dumps(deploy_custom_variables) if deploy_custom_variables else None
    )

    # Serialize deploy_templates to JSON string for storage
    deploy_templates_json = (
        json.dumps(deploy_templates) if deploy_templates else None
    )

    template = repo.create(
        name=name,
        job_type=job_type,
        description=description,
        config_repository_id=config_repository_id,
        inventory_source=inventory_source,
        inventory_repository_id=inventory_repository_id,
        inventory_name=inventory_name,
        command_template_name=command_template_name,
        backup_running_config_path=backup_running_config_path,
        backup_startup_config_path=backup_startup_config_path,
        write_timestamp_to_custom_field=write_timestamp_to_custom_field,
        timestamp_custom_field_name=timestamp_custom_field_name,
        activate_changes_after_sync=activate_changes_after_sync,
        scan_resolve_dns=scan_resolve_dns,
        scan_ping_count=scan_ping_count,
        scan_timeout_ms=scan_timeout_ms,
        scan_retries=scan_retries,
        scan_interval_ms=scan_interval_ms,
        scan_custom_field_name=scan_custom_field_name,
        scan_custom_field_value=scan_custom_field_value,
        scan_response_custom_field_name=scan_response_custom_field_name,
        scan_set_reachable_ip_active=scan_set_reachable_ip_active,
        scan_max_ips=scan_max_ips,
        parallel_tasks=parallel_tasks,
        deploy_template_id=deploy_template_id,
        deploy_agent_id=deploy_agent_id,
        deploy_path=deploy_path,
        deploy_custom_variables=deploy_custom_variables_json,
        activate_after_deploy=activate_after_deploy,
        deploy_templates=deploy_templates_json,
        is_global=is_global,
        user_id=user_id if not is_global else None,
        created_by=created_by,
    )

    logger.info(f"Created job template: {name} (ID: {template.id})")
    return _model_to_dict(template)


def get_job_template(template_id: int) -> Optional[Dict[str, Any]]:
    """Get a job template by ID"""
    template = repo.get_by_id(template_id)
    if template:
        return _model_to_dict(template)
    return None


def get_job_template_by_name(
    name: str, user_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """Get a job template by name"""
    template = repo.get_by_name(name, user_id)
    if template:
        return _model_to_dict(template)
    return None


def list_job_templates(
    user_id: Optional[int] = None, job_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List job templates with optional filters"""
    if user_id is not None:
        templates = repo.get_user_templates(user_id, job_type)
    else:
        templates = repo.get_global_templates(job_type)

    return [_model_to_dict(t) for t in templates]


def get_user_job_templates(
    user_id: int, job_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get all job templates accessible by a user (global + their private templates)"""
    templates = repo.get_user_templates(user_id, job_type)
    return [_model_to_dict(t) for t in templates]


def update_job_template(
    template_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    config_repository_id: Optional[int] = None,
    inventory_source: Optional[str] = None,
    inventory_repository_id: Optional[int] = None,
    inventory_name: Optional[str] = None,
    command_template_name: Optional[str] = None,
    backup_running_config_path: Optional[str] = None,
    backup_startup_config_path: Optional[str] = None,
    write_timestamp_to_custom_field: Optional[bool] = None,
    timestamp_custom_field_name: Optional[str] = None,
    activate_changes_after_sync: Optional[bool] = None,
    scan_resolve_dns: Optional[bool] = None,
    scan_ping_count: Optional[int] = None,
    scan_timeout_ms: Optional[int] = None,
    scan_retries: Optional[int] = None,
    scan_interval_ms: Optional[int] = None,
    scan_custom_field_name: Optional[str] = None,
    scan_custom_field_value: Optional[str] = None,
    scan_response_custom_field_name: Optional[str] = None,
    scan_set_reachable_ip_active: Optional[bool] = None,
    scan_max_ips: Optional[int] = None,
    parallel_tasks: Optional[int] = None,
    deploy_template_id: Optional[int] = None,
    deploy_agent_id: Optional[str] = None,
    deploy_path: Optional[str] = None,
    deploy_custom_variables: Optional[Dict[str, Any]] = None,
    activate_after_deploy: Optional[bool] = None,
    deploy_templates: Optional[List[Dict[str, Any]]] = None,
    is_global: Optional[bool] = None,
    user_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """Update a job template"""

    # Check for duplicate name if name is being updated
    if name is not None:
        if repo.check_name_exists(name, user_id, exclude_id=template_id):
            raise ValueError(f"A job template with name '{name}' already exists")

    # Build update kwargs
    update_data = {}

    if name is not None:
        update_data["name"] = name
    if description is not None:
        update_data["description"] = description
    if config_repository_id is not None:
        update_data["config_repository_id"] = config_repository_id
    if inventory_source is not None:
        update_data["inventory_source"] = inventory_source
    if inventory_repository_id is not None:
        update_data["inventory_repository_id"] = inventory_repository_id
    if inventory_name is not None:
        update_data["inventory_name"] = inventory_name
    if command_template_name is not None:
        update_data["command_template_name"] = command_template_name
    if backup_running_config_path is not None:
        update_data["backup_running_config_path"] = backup_running_config_path
    if backup_startup_config_path is not None:
        update_data["backup_startup_config_path"] = backup_startup_config_path
    if write_timestamp_to_custom_field is not None:
        update_data["write_timestamp_to_custom_field"] = write_timestamp_to_custom_field
    if timestamp_custom_field_name is not None:
        update_data["timestamp_custom_field_name"] = timestamp_custom_field_name
    if activate_changes_after_sync is not None:
        update_data["activate_changes_after_sync"] = activate_changes_after_sync
    if scan_resolve_dns is not None:
        update_data["scan_resolve_dns"] = scan_resolve_dns
    if scan_ping_count is not None:
        update_data["scan_ping_count"] = scan_ping_count
    if scan_timeout_ms is not None:
        update_data["scan_timeout_ms"] = scan_timeout_ms
    if scan_retries is not None:
        update_data["scan_retries"] = scan_retries
    if scan_interval_ms is not None:
        update_data["scan_interval_ms"] = scan_interval_ms
    if scan_custom_field_name is not None:
        update_data["scan_custom_field_name"] = scan_custom_field_name
    if scan_custom_field_value is not None:
        update_data["scan_custom_field_value"] = scan_custom_field_value
    if scan_response_custom_field_name is not None:
        update_data["scan_response_custom_field_name"] = scan_response_custom_field_name
    if scan_set_reachable_ip_active is not None:
        update_data["scan_set_reachable_ip_active"] = scan_set_reachable_ip_active
    if scan_max_ips is not None:
        update_data["scan_max_ips"] = scan_max_ips
    if parallel_tasks is not None:
        update_data["parallel_tasks"] = parallel_tasks
    if deploy_template_id is not None:
        update_data["deploy_template_id"] = deploy_template_id
    if deploy_agent_id is not None:
        update_data["deploy_agent_id"] = deploy_agent_id
    if deploy_path is not None:
        update_data["deploy_path"] = deploy_path
    if deploy_custom_variables is not None:
        update_data["deploy_custom_variables"] = json.dumps(deploy_custom_variables)
    if activate_after_deploy is not None:
        update_data["activate_after_deploy"] = activate_after_deploy
    if deploy_templates is not None:
        update_data["deploy_templates"] = json.dumps(deploy_templates)
    if is_global is not None:
        update_data["is_global"] = is_global
        if is_global:
            update_data["user_id"] = None
        elif user_id is not None:
            update_data["user_id"] = user_id

    if not update_data:
        # Nothing to update, return current state
        return get_job_template(template_id)

    template = repo.update(template_id, **update_data)
    if template:
        logger.info(f"Updated job template: {template.name} (ID: {template_id})")
        return _model_to_dict(template)
    return None


def delete_job_template(template_id: int) -> bool:
    """Delete a job template"""
    template = repo.get_by_id(template_id)
    if template:
        repo.delete(template_id)
        logger.info(f"Deleted job template: {template.name} (ID: {template_id})")
        return True
    return False


def get_job_types() -> List[Dict[str, str]]:
    """Get available job types with descriptions"""
    return [
        {
            "value": "backup",
            "label": "Backup",
            "description": "Backup device configurations",
        },
        {
            "value": "compare_devices",
            "label": "Compare Devices",
            "description": "Compare device configurations with CheckMK",
        },
        {
            "value": "run_commands",
            "label": "Run Commands",
            "description": "Execute commands on devices using templates",
        },
        {
            "value": "sync_devices",
            "label": "Sync Devices",
            "description": "Synchronize devices with CheckMK",
        },
        {
            "value": "scan_prefixes",
            "label": "Scan Prefixes",
            "description": "Scan network prefixes for devices",
        },
        {
            "value": "deploy_agent",
            "label": "Deploy Agent",
            "description": "Deploy agent configurations to Git repository",
        },
    ]


def _model_to_dict(template) -> Dict[str, Any]:
    """Convert SQLAlchemy model to dictionary"""
    return {
        "id": template.id,
        "name": template.name,
        "job_type": template.job_type,
        "description": template.description,
        "config_repository_id": template.config_repository_id,
        "inventory_source": template.inventory_source,
        "inventory_repository_id": template.inventory_repository_id,
        "inventory_name": template.inventory_name,
        "command_template_name": template.command_template_name,
        "backup_running_config_path": template.backup_running_config_path,
        "backup_startup_config_path": template.backup_startup_config_path,
        "write_timestamp_to_custom_field": template.write_timestamp_to_custom_field,
        "timestamp_custom_field_name": template.timestamp_custom_field_name,
        "activate_changes_after_sync": template.activate_changes_after_sync,
        "scan_resolve_dns": template.scan_resolve_dns,
        "scan_ping_count": template.scan_ping_count,
        "scan_timeout_ms": template.scan_timeout_ms,
        "scan_retries": template.scan_retries,
        "scan_interval_ms": template.scan_interval_ms,
        "scan_custom_field_name": template.scan_custom_field_name,
        "scan_custom_field_value": template.scan_custom_field_value,
        "scan_response_custom_field_name": template.scan_response_custom_field_name,
        "scan_set_reachable_ip_active": template.scan_set_reachable_ip_active,
        "scan_max_ips": template.scan_max_ips,
        "parallel_tasks": template.parallel_tasks,
        "deploy_template_id": template.deploy_template_id,
        "deploy_agent_id": template.deploy_agent_id,
        "deploy_path": template.deploy_path,
        "deploy_custom_variables": (
            json.loads(template.deploy_custom_variables)
            if template.deploy_custom_variables
            else None
        ),
        "activate_after_deploy": template.activate_after_deploy,
        "deploy_templates": (
            json.loads(template.deploy_templates)
            if template.deploy_templates
            else None
        ),
        "is_global": template.is_global,
        "user_id": template.user_id,
        "created_by": template.created_by,
        "created_at": template.created_at,
        "updated_at": template.updated_at,
    }
