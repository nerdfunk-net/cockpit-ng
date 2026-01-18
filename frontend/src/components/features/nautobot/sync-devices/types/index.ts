// Types for Sync Devices feature

export interface Device {
  id: string
  name: string | null
  primary_ip4?: {
    address: string
  }
  role?: {
    name: string
  }
  location?: {
    name: string
  }
  device_type?: {
    model: string
  }
  status?: {
    name: string
  }
}

export interface SyncProperties {
  prefix_status: string
  interface_status: string
  ip_address_status: string
  namespace: string
  sync_options: string[]
}

export interface DropdownOption {
  id: string
  name: string
}

export interface LocationItem {
  id: string
  name: string
  parent?: { id: string }
  hierarchicalPath?: string
}

export interface NautobotDefaults {
  namespace: string
  interface_status: string
  ip_address_status: string
  ip_prefix_status: string
}

export interface TableFilters {
  deviceName: string
  role: string
  location: string
  ipAddress: string
  status: string
}

export interface PaginationState {
  currentPage: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface DropdownOptions {
  namespaces: DropdownOption[]
  prefixStatuses: DropdownOption[]
  interfaceStatuses: DropdownOption[]
  ipAddressStatuses: DropdownOption[]
  roles: DropdownOption[]
  locations: DropdownOption[]
  statuses: DropdownOption[]
}
