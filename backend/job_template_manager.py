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
    use_last_compare_run: bool = True,
    sync_not_found_devices: bool = False,
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
    ip_action: Optional[str] = None,
    ip_filter_field: Optional[str] = None,
    ip_filter_type: Optional[str] = None,
    ip_filter_value: Optional[str] = None,
    ip_include_null: bool = False,
    ip_mark_status: Optional[str] = None,
    ip_mark_tag: Optional[str] = None,
    ip_mark_description: Optional[str] = None,
    csv_import_repo_id: Optional[int] = None,
    csv_import_file_path: Optional[str] = None,
    csv_import_type: Optional[str] = None,
    csv_import_primary_key: Optional[str] = None,
    csv_import_update_existing: bool = True,
    csv_import_delimiter: Optional[str] = None,
    csv_import_quote_char: Optional[str] = None,
    csv_import_column_mapping: Optional[Dict[str, Any]] = None,
    csv_import_file_filter: Optional[str] = None,
    csv_import_defaults: Optional[Dict[str, Any]] = None,
    csv_import_format: Optional[str] = None,
    csv_import_add_prefixes: bool = False,
    csv_import_default_prefix_length: Optional[str] = None,
    csv_export_repo_id: Optional[int] = None,
    csv_export_file_path: Optional[str] = None,
    csv_export_properties: Optional[List[str]] = None,
    csv_export_delimiter: Optional[str] = None,
    csv_export_quote_char: Optional[str] = None,
    csv_export_include_headers: bool = True,
    ping_agent_id: Optional[str] = None,
    set_primary_ip_strategy: Optional[str] = None,
    set_primary_ip_agent_id: Optional[str] = None,
    collect_ip_address: bool = True,
    collect_mac_address: bool = True,
    collect_hostname: bool = True,
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
    deploy_templates_json = json.dumps(deploy_templates) if deploy_templates else None

    # Serialize csv_import_column_mapping to JSON string for storage
    csv_import_column_mapping_json = (
        json.dumps(csv_import_column_mapping)
        if csv_import_column_mapping is not None
        else None
    )

    # Serialize csv_import_defaults to JSON string for storage
    csv_import_defaults_json = (
        json.dumps(csv_import_defaults) if csv_import_defaults is not None else None
    )

    # Serialize csv_export_properties to JSON string for storage
    csv_export_properties_json = (
        json.dumps(csv_export_properties) if csv_export_properties is not None else None
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
        use_last_compare_run=use_last_compare_run,
        sync_not_found_devices=sync_not_found_devices,
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
        ip_action=ip_action,
        ip_filter_field=ip_filter_field,
        ip_filter_type=ip_filter_type,
        ip_filter_value=ip_filter_value,
        ip_include_null=ip_include_null,
        ip_mark_status=ip_mark_status,
        ip_mark_tag=ip_mark_tag,
        ip_mark_description=ip_mark_description,
        csv_import_repo_id=csv_import_repo_id,
        csv_import_file_path=csv_import_file_path,
        csv_import_type=csv_import_type,
        csv_import_primary_key=csv_import_primary_key,
        csv_import_update_existing=csv_import_update_existing,
        csv_import_delimiter=csv_import_delimiter,
        csv_import_quote_char=csv_import_quote_char,
        csv_import_column_mapping=csv_import_column_mapping_json,
        csv_import_file_filter=csv_import_file_filter,
        csv_import_defaults=csv_import_defaults_json,
        csv_import_format=csv_import_format,
        csv_import_add_prefixes=csv_import_add_prefixes,
        csv_import_default_prefix_length=csv_import_default_prefix_length,
        csv_export_repo_id=csv_export_repo_id,
        csv_export_file_path=csv_export_file_path,
        csv_export_properties=csv_export_properties_json,
        csv_export_delimiter=csv_export_delimiter,
        csv_export_quote_char=csv_export_quote_char,
        csv_export_include_headers=csv_export_include_headers,
        ping_agent_id=ping_agent_id,
        set_primary_ip_strategy=set_primary_ip_strategy,
        set_primary_ip_agent_id=set_primary_ip_agent_id,
        collect_ip_address=collect_ip_address,
        collect_mac_address=collect_mac_address,
        collect_hostname=collect_hostname,
        is_global=is_global,
        user_id=user_id if not is_global else None,
        created_by=created_by,
    )

    logger.info("Created job template: %s (ID: %s)", name, template.id)
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
    use_last_compare_run: Optional[bool] = None,
    sync_not_found_devices: Optional[bool] = None,
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
    ip_action: Optional[str] = None,
    ip_filter_field: Optional[str] = None,
    ip_filter_type: Optional[str] = None,
    ip_filter_value: Optional[str] = None,
    ip_include_null: Optional[bool] = None,
    ip_mark_status: Optional[str] = None,
    ip_mark_tag: Optional[str] = None,
    ip_mark_description: Optional[str] = None,
    csv_import_repo_id: Optional[int] = None,
    csv_import_file_path: Optional[str] = None,
    csv_import_type: Optional[str] = None,
    csv_import_primary_key: Optional[str] = None,
    csv_import_update_existing: Optional[bool] = None,
    csv_import_delimiter: Optional[str] = None,
    csv_import_quote_char: Optional[str] = None,
    csv_import_column_mapping: Optional[Dict[str, Any]] = None,
    csv_import_file_filter: Optional[str] = None,
    csv_import_defaults: Optional[Dict[str, Any]] = None,
    csv_import_format: Optional[str] = None,
    csv_import_add_prefixes: Optional[bool] = None,
    csv_import_default_prefix_length: Optional[str] = None,
    csv_export_repo_id: Optional[int] = None,
    csv_export_file_path: Optional[str] = None,
    csv_export_properties: Optional[List[str]] = None,
    csv_export_delimiter: Optional[str] = None,
    csv_export_quote_char: Optional[str] = None,
    csv_export_include_headers: Optional[bool] = None,
    ping_agent_id: Optional[str] = None,
    set_primary_ip_strategy: Optional[str] = None,
    set_primary_ip_agent_id: Optional[str] = None,
    collect_ip_address: Optional[bool] = None,
    collect_mac_address: Optional[bool] = None,
    collect_hostname: Optional[bool] = None,
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
    if use_last_compare_run is not None:
        update_data["use_last_compare_run"] = use_last_compare_run
    if sync_not_found_devices is not None:
        update_data["sync_not_found_devices"] = sync_not_found_devices
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
    if ip_action is not None:
        update_data["ip_action"] = ip_action
    if ip_filter_field is not None:
        update_data["ip_filter_field"] = ip_filter_field
    if ip_filter_type is not None:
        update_data["ip_filter_type"] = ip_filter_type
    if ip_filter_value is not None:
        update_data["ip_filter_value"] = ip_filter_value
    if ip_include_null is not None:
        update_data["ip_include_null"] = ip_include_null
    # Mark action options — allow explicit None to clear the values
    if ip_mark_status is not None:
        update_data["ip_mark_status"] = ip_mark_status
    if ip_mark_tag is not None:
        update_data["ip_mark_tag"] = ip_mark_tag
    if ip_mark_description is not None:
        update_data["ip_mark_description"] = ip_mark_description
    if csv_import_repo_id is not None:
        update_data["csv_import_repo_id"] = csv_import_repo_id
    if csv_import_file_path is not None:
        update_data["csv_import_file_path"] = csv_import_file_path
    if csv_import_type is not None:
        update_data["csv_import_type"] = csv_import_type
    if csv_import_primary_key is not None:
        update_data["csv_import_primary_key"] = csv_import_primary_key
    if csv_import_update_existing is not None:
        update_data["csv_import_update_existing"] = csv_import_update_existing
    if csv_import_delimiter is not None:
        update_data["csv_import_delimiter"] = csv_import_delimiter
    if csv_import_quote_char is not None:
        update_data["csv_import_quote_char"] = csv_import_quote_char
    if csv_import_column_mapping is not None:
        update_data["csv_import_column_mapping"] = json.dumps(csv_import_column_mapping)
    if csv_import_file_filter is not None:
        update_data["csv_import_file_filter"] = csv_import_file_filter
    if csv_import_defaults is not None:
        update_data["csv_import_defaults"] = json.dumps(csv_import_defaults)
    if csv_import_format is not None:
        update_data["csv_import_format"] = csv_import_format
    if csv_import_add_prefixes is not None:
        update_data["csv_import_add_prefixes"] = csv_import_add_prefixes
    if csv_import_default_prefix_length is not None:
        update_data["csv_import_default_prefix_length"] = (
            csv_import_default_prefix_length
        )
    if csv_export_repo_id is not None:
        update_data["csv_export_repo_id"] = csv_export_repo_id
    if csv_export_file_path is not None:
        update_data["csv_export_file_path"] = csv_export_file_path
    if csv_export_properties is not None:
        update_data["csv_export_properties"] = json.dumps(csv_export_properties)
    if csv_export_delimiter is not None:
        update_data["csv_export_delimiter"] = csv_export_delimiter
    if csv_export_quote_char is not None:
        update_data["csv_export_quote_char"] = csv_export_quote_char
    if csv_export_include_headers is not None:
        update_data["csv_export_include_headers"] = csv_export_include_headers
    if ping_agent_id is not None:
        update_data["ping_agent_id"] = ping_agent_id
    if set_primary_ip_strategy is not None:
        update_data["set_primary_ip_strategy"] = set_primary_ip_strategy
    if set_primary_ip_agent_id is not None:
        update_data["set_primary_ip_agent_id"] = set_primary_ip_agent_id
    if collect_ip_address is not None:
        update_data["collect_ip_address"] = collect_ip_address
    if collect_mac_address is not None:
        update_data["collect_mac_address"] = collect_mac_address
    if collect_hostname is not None:
        update_data["collect_hostname"] = collect_hostname
    if is_global is not None:
        update_data["is_global"] = is_global
        if is_global:
            update_data["user_id"] = None
        elif user_id is not None:
            update_data["user_id"] = user_id

    # DEBUG: log csv_import fields being written to the database
    logger.debug(
        "[CSV_DEBUG][STORE] template_id=%s incoming CSV args: "
        "repo_id=%r file_path=%r type=%r primary_key=%r "
        "delimiter=%r quote_char=%r update_existing=%r file_filter=%r "
        "column_mapping=%r defaults=%r",
        template_id,
        csv_import_repo_id,
        csv_import_file_path,
        csv_import_type,
        csv_import_primary_key,
        csv_import_delimiter,
        csv_import_quote_char,
        csv_import_update_existing,
        csv_import_file_filter,
        csv_import_column_mapping,
        csv_import_defaults,
    )
    logger.debug(
        "[CSV_DEBUG][STORE] CSV keys in update_data going to repo.update: %s",
        {k: v for k, v in update_data.items() if k.startswith("csv_")},
    )

    if not update_data:
        # Nothing to update, return current state
        return get_job_template(template_id)

    template = repo.update(template_id, **update_data)
    if template:
        logger.info("Updated job template: %s (ID: %s)", template.name, template_id)
        return _model_to_dict(template)
    return None


def delete_job_template(template_id: int) -> bool:
    """Delete a job template"""
    template = repo.get_by_id(template_id)
    if template:
        repo.delete(template_id)
        logger.info("Deleted job template: %s (ID: %s)", template.name, template_id)
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
        {
            "value": "ip_addresses",
            "label": "Maintain IP-Addresses",
            "description": "List, mark, or remove Nautobot IP addresses filtered by a field",
        },
        {
            "value": "csv_import",
            "label": "CSV Import",
            "description": "Import or update Nautobot objects from a CSV file in a Git repository",
        },
        {
            "value": "csv_export",
            "label": "CSV Export",
            "description": "Export Nautobot devices to a CSV file and commit it to a Git repository",
        },
        {
            "value": "ping_agent",
            "label": "Ping Agent",
            "description": "Ping devices from a saved inventory via a Cockpit Agent",
        },
        {
            "value": "set_primary_ip",
            "label": "Set Primary IP",
            "description": "Set the primary IP address of devices based on reachability or interface name",
        },
        {
            "value": "get_client_data",
            "label": "Get Client Data",
            "description": "Collect ARP table, MAC address table, and DNS hostnames from network devices",
        },
    ]


def _model_to_dict(template) -> Dict[str, Any]:
    """Convert SQLAlchemy model to dictionary"""
    # DEBUG: log csv_import fields as read back from the database
    logger.debug(
        "[CSV_DEBUG][LOAD] template id=%s name=%r "
        "delimiter=%r quote_char=%r primary_key=%r "
        "repo_id=%r file_path=%r type=%r file_filter=%r "
        "column_mapping=%r defaults=%r",
        template.id,
        template.name,
        template.csv_import_delimiter,
        template.csv_import_quote_char,
        template.csv_import_primary_key,
        template.csv_import_repo_id,
        template.csv_import_file_path,
        template.csv_import_type,
        template.csv_import_file_filter,
        template.csv_import_column_mapping,
        template.csv_import_defaults,
    )
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
        "use_last_compare_run": template.use_last_compare_run,
        "sync_not_found_devices": template.sync_not_found_devices,
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
            json.loads(template.deploy_templates) if template.deploy_templates else None
        ),
        "ip_action": template.ip_action,
        "ip_filter_field": template.ip_filter_field,
        "ip_filter_type": template.ip_filter_type,
        "ip_filter_value": template.ip_filter_value,
        "ip_include_null": template.ip_include_null,
        "ip_mark_status": template.ip_mark_status,
        "ip_mark_tag": template.ip_mark_tag,
        "ip_mark_description": template.ip_mark_description,
        "csv_import_repo_id": template.csv_import_repo_id,
        "csv_import_file_path": template.csv_import_file_path,
        "csv_import_type": template.csv_import_type,
        "csv_import_primary_key": template.csv_import_primary_key,
        "csv_import_update_existing": template.csv_import_update_existing,
        "csv_import_delimiter": template.csv_import_delimiter,
        "csv_import_quote_char": template.csv_import_quote_char,
        "csv_import_column_mapping": (
            json.loads(template.csv_import_column_mapping)
            if template.csv_import_column_mapping
            else None
        ),
        "csv_import_file_filter": template.csv_import_file_filter,
        "csv_import_defaults": (
            json.loads(template.csv_import_defaults)
            if template.csv_import_defaults
            else None
        ),
        "csv_import_format": template.csv_import_format,
        "csv_import_add_prefixes": template.csv_import_add_prefixes,
        "csv_import_default_prefix_length": template.csv_import_default_prefix_length,
        "csv_export_repo_id": template.csv_export_repo_id,
        "csv_export_file_path": template.csv_export_file_path,
        "csv_export_properties": (
            json.loads(template.csv_export_properties)
            if template.csv_export_properties
            else None
        ),
        "csv_export_delimiter": template.csv_export_delimiter,
        "csv_export_quote_char": template.csv_export_quote_char,
        "csv_export_include_headers": template.csv_export_include_headers,
        "ping_agent_id": template.ping_agent_id,
        "set_primary_ip_strategy": template.set_primary_ip_strategy,
        "set_primary_ip_agent_id": template.set_primary_ip_agent_id,
        "collect_ip_address": template.collect_ip_address,
        "collect_mac_address": template.collect_mac_address,
        "collect_hostname": template.collect_hostname,
        "is_global": template.is_global,
        "user_id": template.user_id,
        "created_by": template.created_by,
        "created_at": template.created_at,
        "updated_at": template.updated_at,
    }
