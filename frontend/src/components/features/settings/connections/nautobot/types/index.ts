export interface NautobotSettings {
  url: string
  token: string
  timeout: number
  verify_ssl: boolean
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
  csv_quote_char: string
}

export interface NautobotOption {
  id: string
  name: string
  color?: string
  description?: string
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

export interface CustomField {
  id: string
  name?: string
  key?: string
  type: {
    value: string
  }
  description?: string
  required?: boolean
  default?: string
}

export interface CustomFieldChoice {
  id: string
  value: string
  display: string
  weight: number
  custom_field: {
    id: string
    object_type: string
    url: string
  }
}

export interface DeviceOffboardingSettings {
  remove_all_custom_fields: boolean
  clear_device_name: boolean
  keep_serial: boolean
  location_id: string
  status_id: string
  role_id: string
  custom_field_settings: { [key: string]: string }
}

export interface NautobotOptionsData {
  deviceStatuses: NautobotOption[]
  interfaceStatuses: NautobotOption[]
  ipAddressStatuses: NautobotOption[]
  ipPrefixStatuses: NautobotOption[]
  namespaces: NautobotOption[]
  deviceRoles: NautobotOption[]
  platforms: NautobotOption[]
  locations: LocationItem[]
  secretGroups: NautobotOption[]
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
}

export interface TestConnectionResponse {
  success: boolean
  message?: string
}
