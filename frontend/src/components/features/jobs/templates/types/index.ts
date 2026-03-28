export interface DeployTemplateEntry {
  template_id: number
  inventory_id: number | null
  path: string
  custom_variables: Record<string, string>
}

export interface JobTemplate {
  id: number
  name: string
  job_type: string
  description?: string
  config_repository_id?: number
  inventory_source: 'all' | 'inventory'
  inventory_repository_id?: number
  inventory_name?: string
  command_template_name?: string
  backup_running_config_path?: string
  backup_startup_config_path?: string
  write_timestamp_to_custom_field?: boolean
  timestamp_custom_field_name?: string
  activate_changes_after_sync?: boolean
  scan_resolve_dns?: boolean
  scan_ping_count?: number
  scan_timeout_ms?: number
  scan_retries?: number
  scan_interval_ms?: number
  scan_custom_field_name?: string
  scan_custom_field_value?: string
  scan_response_custom_field_name?: string
  scan_set_reachable_ip_active?: boolean
  scan_max_ips?: number
  parallel_tasks?: number
  deploy_template_id?: number
  deploy_agent_id?: string
  deploy_path?: string
  deploy_custom_variables?: Record<string, string>
  activate_after_deploy?: boolean
  deploy_templates?: DeployTemplateEntry[]
  // Maintain IP-Addresses (ip_addresses type)
  ip_action?: string
  ip_filter_field?: string
  ip_filter_type?: string | null
  ip_filter_value?: string
  ip_include_null?: boolean
  // Mark action options
  ip_mark_status?: string
  ip_mark_tag?: string
  ip_mark_description?: string
  // Remove action options
  ip_remove_skip_assigned?: boolean
  // CSV Export (csv_export type)
  csv_export_repo_id?: number
  csv_export_file_path?: string
  csv_export_properties?: string[]
  csv_export_delimiter?: string
  csv_export_quote_char?: string
  csv_export_include_headers?: boolean
  // CSV Import (csv_import type)
  csv_import_repo_id?: number
  csv_import_file_path?: string
  csv_import_type?: string
  csv_import_primary_key?: string
  csv_import_update_existing?: boolean
  csv_import_delimiter?: string
  csv_import_quote_char?: string
  csv_import_column_mapping?: Record<string, string | null>
  csv_import_file_filter?: string
  csv_import_defaults?: Record<string, string>
  csv_import_format?: string
  csv_import_add_prefixes?: boolean
  csv_import_default_prefix_length?: string
  // Ping Agent (ping_agent type)
  ping_agent_id?: string | null
  // Set Primary IP (set_primary_ip type)
  set_primary_ip_strategy?: string | null
  set_primary_ip_agent_id?: string | null
  is_global: boolean
  user_id?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface JobType {
  value: string
  label: string
  description: string
}

export interface GitRepository {
  id: number
  name: string
  url: string
  branch: string
  category: string
}

export interface SavedInventory {
  id: number
  name: string
  description?: string
  scope: string
  created_by: string
}

export interface CommandTemplate {
  id: number
  name: string
  category: string
}

export interface IpAddressStatus {
  id: string
  name: string
}

export interface IpAddressTag {
  id: string
  name: string
  slug: string
}

export interface CsvRepoFile {
  name: string
  path: string
  directory: string
  size: number
}

export interface NautobotDefaults {
  csv_delimiter: string
  csv_quote_char: string
}

export interface CustomField {
  id: string
  name?: string
  key: string
  label: string
  type: {
    value: string
    label: string
  }
}
