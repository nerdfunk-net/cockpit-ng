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
    command_outputs?: Record<string, unknown>  // Contains parsed TextFSM data per command
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

export interface NautobotDeviceDetails {
  id: string
  name: string
  hostname?: string
  asset_tag?: string | null
  serial?: string | null
  primary_ip4?: {
    id: string
    address: string
    description?: string
    ip_version?: number
    host?: string
    mask_length?: number
    dns_name?: string
    status?: { id: string; name: string }
    parent?: { id: string; prefix: string }
  } | null
  role?: { id: string; name: string } | null
  device_type?: {
    id: string
    model: string
    manufacturer?: { id: string; name: string }
  } | null
  platform?: {
    id: string
    name: string
    network_driver?: string
    manufacturer?: { id: string; name: string }
  } | null
  location?: {
    id: string
    name: string
    description?: string
    parent?: { id: string; name: string } | null
  } | null
  status?: { id: string; name: string } | null
  config_context?: Record<string, unknown>
  local_config_context_data?: Record<string, unknown>
  _custom_field_data?: Record<string, unknown>
  interfaces?: Array<Record<string, unknown>>
  console_ports?: Array<Record<string, unknown>>
  console_server_ports?: Array<Record<string, unknown>>
  power_ports?: Array<Record<string, unknown>>
  power_outlets?: Array<Record<string, unknown>>
  secrets_group?: { id: string; name: string } | null
  tags?: Array<{ id: string; name: string }>
}
