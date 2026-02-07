export interface Template {
  id: number
  name: string
  description: string
  content: string
  scope: 'global' | 'private'
  variables?: Record<string, string>
  use_nautobot_context?: boolean
  pre_run_command?: string
  credential_id?: number
  execution_mode?: 'run_on_device' | 'write_to_file' | 'sync_to_nautobot'
  file_path?: string
  created_by?: string
  category: string
  template_type: string
  source: string
  updated_at: string
}

export interface DeviceSearchResult {
  id: string
  name: string
  primary_ip4?: { address: string } | string
  location?: { name: string }
}

export interface TemplateFormData {
  name: string
  description: string
  content: string
  scope: 'global' | 'private'
  execution_mode: 'run_on_device' | 'write_to_file' | 'sync_to_nautobot'
}

export interface TemplatesListResponse {
  templates: Template[]
}

export interface SSHCredential {
  id: number
  name: string
  username: string
  type: string
}

export interface TemplateRenderResponse {
  rendered_content: string
  variables_used: string[]
  context_data?: Record<string, unknown>
  warnings?: string[]
  pre_run_output?: string
  pre_run_parsed?: Array<Record<string, unknown>>
}
