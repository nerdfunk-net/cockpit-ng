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
  inventory_source: "all" | "inventory"
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
