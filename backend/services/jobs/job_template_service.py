"""Job template service — CRUD for job_templates table."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from repositories.jobs.job_template_repository import JobTemplateRepository

logger = logging.getLogger(__name__)


class JobTemplateService:
    def __init__(self) -> None:
        self._repo = JobTemplateRepository()

    def create_job_template(
        self,
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
        scan_condition_type: Optional[str] = None,
        scan_location_name: Optional[str] = None,
        scan_cidr: Optional[str] = None,
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
        ip_remove_skip_assigned: Optional[bool] = True,
        ip_remove_skip_reserved: Optional[bool] = True,
        csv_import_source: Optional[str] = None,
        csv_import_repo_id: Optional[int] = None,
        csv_import_file_path: Optional[str] = None,
        csv_import_agent_id: Optional[str] = None,
        csv_import_agent_flows: Optional[List[str]] = None,
        csv_import_type: Optional[str] = None,
        csv_import_primary_key: Optional[str] = None,
        csv_import_update_existing: bool = True,
        csv_import_import_unknown: bool = True,
        csv_import_delimiter: Optional[str] = None,
        csv_import_quote_char: Optional[str] = None,
        csv_import_column_mapping: Optional[Dict[str, Any]] = None,
        csv_import_file_filter: Optional[str] = None,
        csv_import_profile_id: Optional[int] = None,
        csv_import_format: Optional[str] = None,
        csv_import_add_prefixes: bool = False,
        csv_import_default_prefix_length: Optional[str] = None,
        csv_export_repo_id: Optional[int] = None,
        csv_export_file_path: Optional[str] = None,
        csv_export_properties: Optional[List[str]] = None,
        csv_export_delimiter: Optional[str] = None,
        csv_export_quote_char: Optional[str] = None,
        csv_export_include_headers: bool = True,
        backup_agent_id: Optional[str] = None,
        ping_agent_id: Optional[str] = None,
        set_primary_ip_strategy: Optional[str] = None,
        set_primary_ip_agent_id: Optional[str] = None,
        collect_ip_address: bool = True,
        collect_mac_address: bool = True,
        collect_hostname: bool = True,
        facts_prefixes: Optional[List[str]] = None,
        facts_agent_id: Optional[str] = None,
        open_ports_prefixes: Optional[List[str]] = None,
        open_ports_agent_id: Optional[str] = None,
        port_scan_target_source: Optional[str] = None,
        port_scan_cidrs: Optional[List[str]] = None,
        port_scan_agent_id: Optional[str] = None,
        port_scan_type: Optional[str] = None,
        port_scan_ports: Optional[str] = None,
        port_scan_service_detection: bool = False,
        port_scan_use_primary_ip_only: bool = True,
        port_scan_timeout: Optional[int] = 300,
        is_global: bool = False,
    ) -> Dict[str, Any]:
        if self._repo.check_name_exists(name, user_id if not is_global else None):
            raise ValueError(f"A job template with name '{name}' already exists")

        deploy_custom_variables_json = (
            json.dumps(deploy_custom_variables) if deploy_custom_variables else None
        )
        deploy_templates_json = (
            json.dumps(deploy_templates) if deploy_templates else None
        )
        csv_import_column_mapping_json = (
            json.dumps(csv_import_column_mapping)
            if csv_import_column_mapping is not None
            else None
        )
        csv_import_agent_flows_json = (
            json.dumps(csv_import_agent_flows)
            if csv_import_agent_flows is not None
            else None
        )
        csv_export_properties_json = (
            json.dumps(csv_export_properties)
            if csv_export_properties is not None
            else None
        )
        facts_prefixes_json = (
            json.dumps(facts_prefixes) if facts_prefixes is not None else None
        )
        open_ports_prefixes_json = (
            json.dumps(open_ports_prefixes) if open_ports_prefixes is not None else None
        )
        port_scan_cidrs_json = (
            json.dumps(port_scan_cidrs) if port_scan_cidrs is not None else None
        )

        template = self._repo.create(
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
            scan_condition_type=scan_condition_type,
            scan_location_name=scan_location_name,
            scan_cidr=scan_cidr,
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
            ip_remove_skip_assigned=ip_remove_skip_assigned,
            ip_remove_skip_reserved=ip_remove_skip_reserved,
            csv_import_source=csv_import_source,
            csv_import_repo_id=csv_import_repo_id,
            csv_import_file_path=csv_import_file_path,
            csv_import_agent_id=csv_import_agent_id,
            csv_import_agent_flows=csv_import_agent_flows_json,
            csv_import_type=csv_import_type,
            csv_import_primary_key=csv_import_primary_key,
            csv_import_update_existing=csv_import_update_existing,
            csv_import_import_unknown=csv_import_import_unknown,
            csv_import_delimiter=csv_import_delimiter,
            csv_import_quote_char=csv_import_quote_char,
            csv_import_column_mapping=csv_import_column_mapping_json,
            csv_import_file_filter=csv_import_file_filter,
            csv_import_profile_id=csv_import_profile_id,
            csv_import_format=csv_import_format,
            csv_import_add_prefixes=csv_import_add_prefixes,
            csv_import_default_prefix_length=csv_import_default_prefix_length,
            csv_export_repo_id=csv_export_repo_id,
            csv_export_file_path=csv_export_file_path,
            csv_export_properties=csv_export_properties_json,
            csv_export_delimiter=csv_export_delimiter,
            csv_export_quote_char=csv_export_quote_char,
            csv_export_include_headers=csv_export_include_headers,
            backup_agent_id=backup_agent_id,
            ping_agent_id=ping_agent_id,
            set_primary_ip_strategy=set_primary_ip_strategy,
            set_primary_ip_agent_id=set_primary_ip_agent_id,
            collect_ip_address=collect_ip_address,
            collect_mac_address=collect_mac_address,
            collect_hostname=collect_hostname,
            facts_prefixes=facts_prefixes_json,
            facts_agent_id=facts_agent_id,
            open_ports_prefixes=open_ports_prefixes_json,
            open_ports_agent_id=open_ports_agent_id,
            port_scan_target_source=port_scan_target_source,
            port_scan_cidrs=port_scan_cidrs_json,
            port_scan_agent_id=port_scan_agent_id,
            port_scan_type=port_scan_type,
            port_scan_ports=port_scan_ports,
            port_scan_service_detection=port_scan_service_detection,
            port_scan_use_primary_ip_only=port_scan_use_primary_ip_only,
            port_scan_timeout=port_scan_timeout,
            is_global=is_global,
            user_id=user_id if not is_global else None,
            created_by=created_by,
        )

        logger.info("Created job template: %s (ID: %s)", name, template.id)
        return self._to_dict(template)

    def get_job_template(self, template_id: int) -> Optional[Dict[str, Any]]:
        template = self._repo.get_by_id(template_id)
        if template:
            return self._to_dict(template)
        return None

    def get_job_template_by_name(
        self, name: str, user_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        template = self._repo.get_by_name(name, user_id)
        if template:
            return self._to_dict(template)
        return None

    def list_job_templates(
        self, user_id: Optional[int] = None, job_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if user_id is not None:
            templates = self._repo.get_user_templates(user_id, job_type)
        else:
            templates = self._repo.get_global_templates(job_type)
        return [self._to_dict(t) for t in templates]

    def get_user_job_templates(
        self, user_id: int, job_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        templates = self._repo.get_user_templates(user_id, job_type)
        return [self._to_dict(t) for t in templates]

    def update_job_template(
        self,
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
        scan_condition_type: Optional[str] = None,
        scan_location_name: Optional[str] = None,
        scan_cidr: Optional[str] = None,
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
        ip_remove_skip_assigned: Optional[bool] = None,
        ip_remove_skip_reserved: Optional[bool] = None,
        csv_import_source: Optional[str] = None,
        csv_import_repo_id: Optional[int] = None,
        csv_import_file_path: Optional[str] = None,
        csv_import_agent_id: Optional[str] = None,
        csv_import_agent_flows: Optional[List[str]] = None,
        csv_import_type: Optional[str] = None,
        csv_import_primary_key: Optional[str] = None,
        csv_import_update_existing: Optional[bool] = None,
        csv_import_import_unknown: Optional[bool] = None,
        csv_import_delimiter: Optional[str] = None,
        csv_import_quote_char: Optional[str] = None,
        csv_import_column_mapping: Optional[Dict[str, Any]] = None,
        csv_import_file_filter: Optional[str] = None,
        csv_import_profile_id: Optional[int] = None,
        csv_import_format: Optional[str] = None,
        csv_import_add_prefixes: Optional[bool] = None,
        csv_import_default_prefix_length: Optional[str] = None,
        csv_export_repo_id: Optional[int] = None,
        csv_export_file_path: Optional[str] = None,
        csv_export_properties: Optional[List[str]] = None,
        csv_export_delimiter: Optional[str] = None,
        csv_export_quote_char: Optional[str] = None,
        csv_export_include_headers: Optional[bool] = None,
        backup_agent_id: Optional[str] = None,
        ping_agent_id: Optional[str] = None,
        set_primary_ip_strategy: Optional[str] = None,
        set_primary_ip_agent_id: Optional[str] = None,
        collect_ip_address: Optional[bool] = None,
        collect_mac_address: Optional[bool] = None,
        collect_hostname: Optional[bool] = None,
        facts_prefixes: Optional[List[str]] = None,
        facts_agent_id: Optional[str] = None,
        open_ports_prefixes: Optional[List[str]] = None,
        open_ports_agent_id: Optional[str] = None,
        port_scan_target_source: Optional[str] = None,
        port_scan_cidrs: Optional[List[str]] = None,
        port_scan_agent_id: Optional[str] = None,
        port_scan_type: Optional[str] = None,
        port_scan_ports: Optional[str] = None,
        port_scan_service_detection: Optional[bool] = None,
        port_scan_use_primary_ip_only: Optional[bool] = None,
        port_scan_timeout: Optional[int] = None,
        is_global: Optional[bool] = None,
        user_id: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        if name is not None:
            if self._repo.check_name_exists(name, user_id, exclude_id=template_id):
                raise ValueError(f"A job template with name '{name}' already exists")

        update_data: Dict[str, Any] = {}

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
            update_data["write_timestamp_to_custom_field"] = (
                write_timestamp_to_custom_field
            )
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
            update_data["scan_response_custom_field_name"] = (
                scan_response_custom_field_name
            )
        if scan_set_reachable_ip_active is not None:
            update_data["scan_set_reachable_ip_active"] = scan_set_reachable_ip_active
        if scan_max_ips is not None:
            update_data["scan_max_ips"] = scan_max_ips
        if scan_condition_type is not None:
            update_data["scan_condition_type"] = scan_condition_type
        if scan_location_name is not None:
            update_data["scan_location_name"] = scan_location_name
        if scan_cidr is not None:
            update_data["scan_cidr"] = scan_cidr
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
        if ip_mark_status is not None:
            update_data["ip_mark_status"] = ip_mark_status
        if ip_mark_tag is not None:
            update_data["ip_mark_tag"] = ip_mark_tag
        if ip_mark_description is not None:
            update_data["ip_mark_description"] = ip_mark_description
        if ip_remove_skip_assigned is not None:
            update_data["ip_remove_skip_assigned"] = ip_remove_skip_assigned
        if ip_remove_skip_reserved is not None:
            update_data["ip_remove_skip_reserved"] = ip_remove_skip_reserved
        if csv_import_source is not None:
            update_data["csv_import_source"] = csv_import_source
        if csv_import_repo_id is not None:
            update_data["csv_import_repo_id"] = csv_import_repo_id
        if csv_import_file_path is not None:
            update_data["csv_import_file_path"] = csv_import_file_path
        if csv_import_agent_id is not None:
            update_data["csv_import_agent_id"] = csv_import_agent_id
        if csv_import_agent_flows is not None:
            update_data["csv_import_agent_flows"] = json.dumps(csv_import_agent_flows)
        if csv_import_type is not None:
            update_data["csv_import_type"] = csv_import_type
        if csv_import_primary_key is not None:
            update_data["csv_import_primary_key"] = csv_import_primary_key
        if csv_import_update_existing is not None:
            update_data["csv_import_update_existing"] = csv_import_update_existing
        if csv_import_import_unknown is not None:
            update_data["csv_import_import_unknown"] = csv_import_import_unknown
        if csv_import_delimiter is not None:
            update_data["csv_import_delimiter"] = csv_import_delimiter
        if csv_import_quote_char is not None:
            update_data["csv_import_quote_char"] = csv_import_quote_char
        if csv_import_column_mapping is not None:
            update_data["csv_import_column_mapping"] = json.dumps(
                csv_import_column_mapping
            )
        if csv_import_file_filter is not None:
            update_data["csv_import_file_filter"] = csv_import_file_filter
        if csv_import_profile_id is not None:
            update_data["csv_import_profile_id"] = csv_import_profile_id
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
        # backup_agent_id is always written: None clears it (switches back to Celery)
        update_data["backup_agent_id"] = backup_agent_id
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
        if facts_prefixes is not None:
            update_data["facts_prefixes"] = json.dumps(facts_prefixes)
        if facts_agent_id is not None:
            update_data["facts_agent_id"] = facts_agent_id
        if open_ports_prefixes is not None:
            update_data["open_ports_prefixes"] = json.dumps(open_ports_prefixes)
        if open_ports_agent_id is not None:
            update_data["open_ports_agent_id"] = open_ports_agent_id
        if port_scan_target_source is not None:
            update_data["port_scan_target_source"] = port_scan_target_source
        if port_scan_cidrs is not None:
            update_data["port_scan_cidrs"] = json.dumps(port_scan_cidrs)
        if port_scan_agent_id is not None:
            update_data["port_scan_agent_id"] = port_scan_agent_id
        if port_scan_type is not None:
            update_data["port_scan_type"] = port_scan_type
        if port_scan_ports is not None:
            update_data["port_scan_ports"] = port_scan_ports
        if port_scan_service_detection is not None:
            update_data["port_scan_service_detection"] = port_scan_service_detection
        if port_scan_use_primary_ip_only is not None:
            update_data["port_scan_use_primary_ip_only"] = port_scan_use_primary_ip_only
        if port_scan_timeout is not None:
            update_data["port_scan_timeout"] = port_scan_timeout
        if is_global is not None:
            update_data["is_global"] = is_global
            if is_global:
                update_data["user_id"] = None
            elif user_id is not None:
                update_data["user_id"] = user_id

        logger.debug(
            "[CSV_DEBUG][STORE] template_id=%s incoming CSV args: "
            "repo_id=%r file_path=%r type=%r primary_key=%r "
            "delimiter=%r quote_char=%r update_existing=%r file_filter=%r "
            "column_mapping=%r profile_id=%r source=%r agent_id=%r",
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
            csv_import_profile_id,
            csv_import_source,
            csv_import_agent_id,
        )
        logger.debug(
            "[CSV_DEBUG][STORE] CSV keys in update_data going to repo.update: %s",
            {k: v for k, v in update_data.items() if k.startswith("csv_")},
        )

        if not update_data:
            return self.get_job_template(template_id)

        template = self._repo.update(template_id, **update_data)
        if template:
            logger.info("Updated job template: %s (ID: %s)", template.name, template_id)
            return self._to_dict(template)
        return None

    def delete_job_template(self, template_id: int) -> bool:
        template = self._repo.get_by_id(template_id)
        if template:
            self._repo.delete(template_id)
            logger.info("Deleted job template: %s (ID: %s)", template.name, template_id)
            return True
        return False

    def get_job_types(self) -> List[Dict[str, str]]:
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
            {
                "value": "get_server_facts",
                "label": "Get Server Facts",
                "description": "Scan IP prefixes, gather Ansible facts from reachable hosts, and store them as Server records",
            },
            {
                "value": "get_open_ports",
                "label": "Get Open Ports",
                "description": "Scan IP prefixes and record open TCP/UDP ports via a Cockpit Ansible agent",
            },
            {
                "value": "port_scan",
                "label": "Port Scan",
                "description": "Scan open ports on reachable hosts via a Cockpit Nmap agent using CIDR prefixes or a saved inventory",
            },
        ]

    def _to_dict(self, template) -> Dict[str, Any]:
        logger.debug(
            "[CSV_DEBUG][LOAD] template id=%s name=%r "
            "delimiter=%r quote_char=%r primary_key=%r "
            "repo_id=%r file_path=%r type=%r file_filter=%r "
            "column_mapping=%r profile_id=%r source=%r",
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
            template.csv_import_profile_id,
            template.csv_import_source,
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
            "scan_condition_type": template.scan_condition_type,
            "scan_location_name": template.scan_location_name,
            "scan_cidr": template.scan_cidr,
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
            "ip_action": template.ip_action,
            "ip_filter_field": template.ip_filter_field,
            "ip_filter_type": template.ip_filter_type,
            "ip_filter_value": template.ip_filter_value,
            "ip_include_null": template.ip_include_null,
            "ip_mark_status": template.ip_mark_status,
            "ip_mark_tag": template.ip_mark_tag,
            "ip_mark_description": template.ip_mark_description,
            "ip_remove_skip_assigned": template.ip_remove_skip_assigned,
            "ip_remove_skip_reserved": template.ip_remove_skip_reserved,
            "csv_import_source": template.csv_import_source,
            "csv_import_repo_id": template.csv_import_repo_id,
            "csv_import_file_path": template.csv_import_file_path,
            "csv_import_agent_id": template.csv_import_agent_id,
            "csv_import_agent_flows": (
                json.loads(template.csv_import_agent_flows)
                if template.csv_import_agent_flows
                else None
            ),
            "csv_import_type": template.csv_import_type,
            "csv_import_primary_key": template.csv_import_primary_key,
            "csv_import_update_existing": template.csv_import_update_existing,
            "csv_import_import_unknown": template.csv_import_import_unknown,
            "csv_import_delimiter": template.csv_import_delimiter,
            "csv_import_quote_char": template.csv_import_quote_char,
            "csv_import_column_mapping": (
                json.loads(template.csv_import_column_mapping)
                if template.csv_import_column_mapping
                else None
            ),
            "csv_import_file_filter": template.csv_import_file_filter,
            "csv_import_profile_id": template.csv_import_profile_id,
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
            "backup_agent_id": template.backup_agent_id,
            "ping_agent_id": template.ping_agent_id,
            "set_primary_ip_strategy": template.set_primary_ip_strategy,
            "set_primary_ip_agent_id": template.set_primary_ip_agent_id,
            "collect_ip_address": template.collect_ip_address,
            "collect_mac_address": template.collect_mac_address,
            "collect_hostname": template.collect_hostname,
            "facts_prefixes": (
                json.loads(template.facts_prefixes) if template.facts_prefixes else None
            ),
            "facts_agent_id": template.facts_agent_id,
            "open_ports_prefixes": (
                json.loads(template.open_ports_prefixes)
                if template.open_ports_prefixes
                else None
            ),
            "open_ports_agent_id": template.open_ports_agent_id,
            "port_scan_target_source": template.port_scan_target_source,
            "port_scan_cidrs": (
                json.loads(template.port_scan_cidrs)
                if template.port_scan_cidrs
                else None
            ),
            "port_scan_agent_id": template.port_scan_agent_id,
            "port_scan_type": template.port_scan_type,
            "port_scan_ports": template.port_scan_ports,
            "port_scan_service_detection": template.port_scan_service_detection,
            "port_scan_use_primary_ip_only": template.port_scan_use_primary_ip_only,
            "port_scan_timeout": template.port_scan_timeout,
            "is_global": template.is_global,
            "user_id": template.user_id,
            "created_by": template.created_by,
            "created_at": template.created_at,
            "updated_at": template.updated_at,
        }
