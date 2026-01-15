/**
 * Type definitions for nautobot-add-device feature
 */

// ============================================================================
// Core Data Types
// ============================================================================

export interface DropdownOption {
  id: string
  name: string
  display?: string
  value?: string
}

// Interface types come from OPTIONS API and have different structure
export interface InterfaceTypeOption {
  value: string
  display_name: string
}

export interface DeviceType {
  id: string
  model: string
  manufacturer: {
    id: string
    name?: string
    display?: string
  }
  display?: string
}

export interface Platform {
  id: string
  name: string
  display: string
  description?: string
  network_driver?: string
  manufacturer?: {
    id: string
    object_type: string
    url: string
  }
}

export interface SoftwareVersion {
  id: string
  version: string
  alias?: string
  release_date?: string
  end_of_support_date?: string
  documentation_url?: string
  long_term_support?: boolean
  pre_release?: boolean
  platform?: {
    id: string
    name: string
  }
  tags?: Array<{
    id: string
    name: string
  }>
}

export interface LocationItem {
  id: string
  name: string
  display?: string
  parent?: {
    id: string
    name: string
  }
  hierarchicalPath?: string
}

export interface VlanItem {
  id: string
  name: string
  description?: string
  vid: number
  role?: {
    id: string
    name: string
  }
  location?: {
    id: string
    name: string
  }
}

export interface InterfaceData {
  id: string
  name: string
  type: string
  status: string
  ip_addresses: Array<{
    id: string
    address: string
    namespace: string
    ip_role: string
    is_primary?: boolean
  }>
  // Optional properties
  enabled?: boolean
  mgmt_only?: boolean
  description?: string
  mac_address?: string
  mtu?: number
  mode?: string
  untagged_vlan?: string
  tagged_vlans?: string[]
  parent_interface?: string
  bridge?: string
  lag?: string
  tags?: string[]
}

export interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

export interface TagItem {
  id: string
  name: string
  color?: string
}

export interface CustomField {
  id: string
  key: string
  label: string
  type: {
    value: string
  }
  required: boolean
  description?: string
}

export interface NautobotDefaults {
  location: string
  platform: string
  interface_status: string
  device_status: string
  ip_address_status: string
  namespace: string
  device_role: string
  secret_group: string
  csv_delimiter: string
}

// ============================================================================
// Response Types for TanStack Query
// ============================================================================

export interface NautobotDropdownsResponse {
  roles: DropdownOption[]
  statuses: DropdownOption[]
  locations: LocationItem[]
  deviceTypes: DeviceType[]
  platforms: Platform[]
  softwareVersions: SoftwareVersion[]
  interfaceTypes: InterfaceTypeOption[]
  interfaceStatuses: DropdownOption[]
  namespaces: DropdownOption[]
  ipRoles: DropdownOption[]
  nautobotDefaults: NautobotDefaults | null
}

export interface DeviceSubmissionData {
  name: string
  serial?: string
  role: string
  status: string
  location: string
  device_type: string
  platform?: string
  software_version?: string
  tags?: string[]
  custom_fields?: Record<string, string>
  interfaces: InterfaceData[]
  add_prefix: boolean
  default_prefix_length: string
}

export interface DeviceSubmissionResult {
  success: boolean
  message: string
  messageType: 'success' | 'error' | 'warning'
  deviceId?: string
  summary?: {
    interfaces_created: number
    ip_addresses_created: number
  }
}

// ============================================================================
// CSV Import Types
// ============================================================================

// Interface data from CSV row
export interface CSVInterfaceData {
  name: string
  type: string
  status: string
  ip_address: string
  namespace?: string
  is_primary_ipv4?: boolean
  enabled?: boolean
  mgmt_only?: boolean
  description?: string
  mac_address?: string
  mtu?: number
  mode?: string
  untagged_vlan?: string
  tagged_vlans?: string[]
  parent_interface?: string
  bridge?: string
  lag?: string
  tags?: string[]
}

// Parsed device from CSV (after merging rows with same device name)
export interface ParsedDevice {
  name: string
  role?: string
  status?: string
  location?: string
  device_type?: string
  platform?: string
  software_version?: string
  serial?: string
  asset_tag?: string
  tags?: string[]
  custom_fields?: Record<string, string>
  interfaces: CSVInterfaceData[]
}

// Column mapping configuration
export interface CSVColumnMapping {
  csvColumn: string
  nautobotField: string
  isInterface: boolean
}

// Validation error for a specific device
export interface DeviceValidationError {
  deviceName: string
  field: string
  message: string
  severity: 'error' | 'warning'
}

// Import result for a single device
export interface DeviceImportResult {
  deviceName: string
  status: 'success' | 'error' | 'skipped'
  message: string
  deviceId?: string
  workflowStatus?: {
    step1_device: { status: string; message: string }
    step2_ip_addresses: { status: string; message: string }
    step3_interfaces: { status: string; message: string }
    step4_primary_ip: { status: string; message: string }
  }
}

// Summary of the entire import run
export interface ImportSummary {
  total: number
  success: number
  failed: number
  skipped: number
  results: DeviceImportResult[]
}

// CSV parsing result
export interface CSVParseResult {
  devices: ParsedDevice[]
  headers: string[]
  validationErrors: DeviceValidationError[]
  rowCount: number
}

// Available Nautobot fields for mapping
export const NAUTOBOT_DEVICE_FIELDS = [
  { key: 'name', label: 'Device Name', required: true },
  { key: 'role', label: 'Role', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'location', label: 'Location', required: false },
  { key: 'device_type', label: 'Device Type', required: false },
  { key: 'platform', label: 'Platform', required: false },
  { key: 'software_version', label: 'Software Version', required: false },
  { key: 'serial', label: 'Serial Number', required: false },
  { key: 'asset_tag', label: 'Asset Tag', required: false },
  { key: 'tags', label: 'Tags', required: false },
] as const

// Available interface fields for mapping (prefixed with interface_ in CSV)
export const NAUTOBOT_INTERFACE_FIELDS = [
  { key: 'name', label: 'Interface Name', required: true },
  { key: 'type', label: 'Interface Type', required: true },
  { key: 'status', label: 'Interface Status', required: true },
  { key: 'ip_address', label: 'IP Address', required: false },
  { key: 'namespace', label: 'Namespace', required: false },
  { key: 'is_primary_ipv4', label: 'Is Primary IPv4', required: false },
  { key: 'enabled', label: 'Enabled', required: false },
  { key: 'mgmt_only', label: 'Management Only', required: false },
  { key: 'description', label: 'Description', required: false },
  { key: 'mac_address', label: 'MAC Address', required: false },
  { key: 'mtu', label: 'MTU', required: false },
  { key: 'mode', label: 'Mode', required: false },
  { key: 'untagged_vlan', label: 'Untagged VLAN', required: false },
  { key: 'tagged_vlans', label: 'Tagged VLANs', required: false },
  { key: 'parent_interface', label: 'Parent Interface', required: false },
  { key: 'bridge', label: 'Bridge', required: false },
  { key: 'lag', label: 'LAG', required: false },
  { key: 'tags', label: 'Tags', required: false },
] as const

// Default column mappings (CSV column name -> Nautobot field)
export const DEFAULT_COLUMN_MAPPINGS: Record<string, string> = {
  // Device fields
  'name': 'name',
  'device_name': 'name',
  'hostname': 'name',
  'role': 'role',
  'device_role': 'role',
  'status': 'status',
  'device_status': 'status',
  'location': 'location',
  'site': 'location',
  'device_type': 'device_type',
  'model': 'device_type',
  'platform': 'platform',
  'os': 'platform',
  'software_version': 'software_version',
  'version': 'software_version',
  'serial': 'serial',
  'serial_number': 'serial',
  'asset_tag': 'asset_tag',
  'tags': 'tags',

  // Interface fields (with interface_ prefix)
  'interface_name': 'interface_name',
  'interface_type': 'interface_type',
  'interface_status': 'interface_status',
  'interface_ip_address': 'interface_ip_address',
  'interface_ip': 'interface_ip_address',
  'interface_namespace': 'interface_namespace',
  'interface_is_primary_ipv4': 'interface_is_primary_ipv4',
  'interface_primary': 'interface_is_primary_ipv4',
  'set_primary_ipv4': 'interface_is_primary_ipv4',
  'interface_enabled': 'interface_enabled',
  'interface_mgmt_only': 'interface_mgmt_only',
  'interface_description': 'interface_description',
  'interface_mac_address': 'interface_mac_address',
  'interface_mac': 'interface_mac_address',
  'interface_mtu': 'interface_mtu',
  'interface_mode': 'interface_mode',
  'interface_untagged_vlan': 'interface_untagged_vlan',
  'interface_tagged_vlans': 'interface_tagged_vlans',
  'interface_parent_interface': 'interface_parent_interface',
  'interface_bridge': 'interface_bridge',
  'interface_lag': 'interface_lag',
  'interface_tags': 'interface_tags',
}

// Fields that must be unique across merged rows (error if different values)
export const UNIQUE_DEVICE_FIELDS = ['serial', 'asset_tag', 'role', 'status', 'location', 'device_type', 'platform', 'software_version']
