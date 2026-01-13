// Device types
export interface Device {
  id: string
  name: string
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

// Offboarding types
export interface OffboardProperties {
  removePrimaryIp: boolean
  removeInterfaceIps: boolean
  removeFromCheckMK: boolean
}

export type NautobotIntegrationMode = 'remove' | 'set-offboarding'

export interface OffboardResult {
  success: boolean
  device_id: string
  device_name?: string
  removed_items: string[]
  skipped_items: string[]
  errors: string[]
  summary: string
}

export interface OffboardSummary {
  totalDevices: number
  successfulDevices: number
  failedDevices: number
  results: OffboardResult[]
}

// Filter types
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

export interface TableFilters {
  deviceName: string
  role: string
  location: string
  ipAddress: string
  status: string
}

// Pagination types
export interface PaginationState {
  currentPage: number
  pageSize: number
  totalItems: number
  totalPages: number
}

// Status message types
export interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}
