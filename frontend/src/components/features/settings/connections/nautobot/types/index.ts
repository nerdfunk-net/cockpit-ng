import type { DeviceType } from '@/components/features/nautobot/add-device/types'

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
  interface_type: string
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

// Interface types come from Nautobot's OPTIONS choices — value/display_name, not id/name.
export interface InterfaceTypeOption {
  value: string
  display_name: string
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

export interface NautobotOptionsData {
  deviceStatuses: NautobotOption[]
  interfaceStatuses: NautobotOption[]
  interfaceTypes: InterfaceTypeOption[]
  ipAddressStatuses: NautobotOption[]
  ipPrefixStatuses: NautobotOption[]
  namespaces: NautobotOption[]
  deviceRoles: NautobotOption[]
  platforms: NautobotOption[]
  locations: LocationItem[]
  secretGroups: NautobotOption[]
  deviceTypes: DeviceType[]
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
