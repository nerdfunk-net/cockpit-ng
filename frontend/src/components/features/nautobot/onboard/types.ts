// Type definitions for onboard device functionality

export interface DropdownOption {
  id: string
  name: string
  display?: string
  value?: string
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

export interface OnboardFormData {
  ip_address: string
  location_id: string
  namespace_id: string
  role_id: string
  status_id: string
  platform_id: string
  secret_groups_id: string
  interface_status_id: string
  ip_address_status_id: string
  prefix_status_id: string
  port: number
  timeout: number
  onboarding_timeout: number
  sync_options: string[]
}

export interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

export interface NautobotDefaults {
  location: string
  platform: string
  interface_status: string
  device_status: string
  ip_address_status: string
  ip_prefix_status: string
  namespace: string
  device_role: string
  secret_group: string
  csv_delimiter: string
}

export interface CSVRow {
  ipaddress: string
  location?: string
  interface_status?: string
  device_status?: string
  ipaddress_status?: string
  namespace?: string
  device_role?: string
  secret_group?: string
  platform?: string
}

export interface ParsedCSVRow {
  ip_address?: string
  location?: string
  namespace?: string
  role?: string
  status?: string
  platform?: string
  port?: number
  timeout?: number
  interface_status?: string
  ip_address_status?: string
  prefix_status?: string
  secret_groups?: string
  tags?: string[]
  custom_fields?: Record<string, string>
}

export interface BulkOnboardingResult {
  ip_address: string
  status: 'success' | 'error'
  message: string
  job_id?: string
}

export interface IPValidation {
  isValid: boolean
  message: string
}

export interface OnboardResponse {
  message: string
  job_id: string
}

export interface JobStatus {
  job_id: string
  status: string
  created_at?: string
  completed_at?: string
  error?: string
  result?: {
    success: boolean
    message: string
    error?: string
  }
}

export interface CSVLookupData {
  locations: LocationItem[]
  namespaces: DropdownOption[]
  deviceRoles: DropdownOption[]
  platforms: DropdownOption[]
  deviceStatuses: DropdownOption[]
  interfaceStatuses: DropdownOption[]
  ipAddressStatuses: DropdownOption[]
  prefixStatuses: DropdownOption[]
  secretGroups: DropdownOption[]
  availableTags: DropdownOption[]
  defaults?: NautobotDefaults
}
