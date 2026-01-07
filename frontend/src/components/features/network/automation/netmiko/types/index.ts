export interface StoredCredential {
  id: number
  name: string
  username: string
  type: string
  valid_until?: string
}

export interface CommandResult {
  device: string
  success: boolean
  output: string
  error?: string
}

export interface TemplateVariable {
  id: string
  name: string
  value: string
}

export interface Template {
  id: number
  name: string
  category: string
  content: string
  scope: 'global' | 'private'
  created_by?: string
  execution_mode?: 'run_on_device' | 'write_to_file' | 'sync_to_nautobot'
  file_path?: string
  credential_id?: number
  pre_run_command?: string
}

export interface ExecutionSummary {
  total: number
  successful: number
  failed: number
  cancelled: number
}

export interface ErrorDetails {
  title: string
  message: string
  details?: string[]
}

export interface TemplateExecutionResult {
  device_id: string
  device_name: string
  success: boolean
  rendered_content?: string
  output?: string
  error?: string
}

export interface CommandExecutionParams {
  selectedDevices: Array<{ id: string; name: string; primary_ip4?: string; platform?: string }>
  commands: string
  enableMode: boolean
  writeConfig: boolean
  sessionId: string
  selectedCredentialId: string
  username: string
  password: string
}

export interface TemplateExecutionParams {
  selectedDevices: Array<{ id: string; name: string }>
  templateId?: number
  templateContent?: string
  variables: TemplateVariable[]
  useNautobotContext: boolean
  dryRun: boolean
  enableMode: boolean
  writeConfig: boolean
  sessionId: string
  selectedCredentialId: string
  username: string
  password: string
}
