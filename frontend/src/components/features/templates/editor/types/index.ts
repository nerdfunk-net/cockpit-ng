export interface TemplateVariable {
  id: string
  name: string
  value: string
  isDefault: boolean
  isAutoFilled: boolean
  description?: string
  requiresExecution?: boolean  // For pre_run variables that need command execution
  isExecuting?: boolean        // Track if execution is in progress
}

export interface EditorFormData {
  name: string
  template_type: 'jinja2' | 'text' | 'textfsm'
  category: string
  description: string
  scope: 'global' | 'private'
  content: string
  // Agent-specific
  inventoryId: number | null
  passSnmpMapping: boolean
  useNautobotContext: boolean
  path: string
  // Netmiko-specific
  netmikoMode: 'run_on_device' | 'write_to_file' | 'sync_to_nautobot'
  testDeviceId: string | null
  testDeviceName: string
  preRunCommand: string
  credentialId: string
}

export interface NetmikoExecuteResponse {
  results: Array<{
    device: string
    output: string
    command_outputs?: Record<string, any>  // Contains parsed TextFSM data per command
    success: boolean
    error?: string
  }>
  session_id: string
}

export interface RenderResult {
  success: boolean
  renderedContent: string
  error?: string
  warnings?: string[]
}
