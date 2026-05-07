// IP assignment types
export interface IpInterfaceAssignment {
  is_standby: boolean
  is_default: boolean
  is_destination: boolean
  interface: {
    name: string
    description: string
    type: string
    status: { name: string }
    device: { name: string }
    child_interfaces: unknown[]
  }
}

export interface IpAddressMultipleAssignmentWarning {
  deviceId: string
  deviceName: string
  ipAddress: string
  assignments: IpInterfaceAssignment[]
}

// Virtual chassis types
export interface VirtualChassisMember {
  id: string
  name: string
}

export interface VirtualChassisInfo {
  id: string
  name: string
  members: VirtualChassisMember[]
  master: VirtualChassisMember | null
}

export interface DeviceVirtualChassisStatus {
  is_in_chassis: boolean
  is_master: boolean
  virtual_chassis: VirtualChassisInfo | null
}

export type VirtualChassisAction = 'remove_all' | 'remove_single'

export interface VirtualChassisDecision {
  action: VirtualChassisAction
  virtual_chassis_id: string
  chassis_member_ids?: string[]
  new_master_id?: string
  new_master_name?: string
}

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
