export interface LogicalCondition {
  field: string
  operator: string
  value: string
  logic: string
}

export interface ConditionItem {
  id: string
  field: string
  operator: string
  value: string
}

export interface ConditionGroup {
  id: string
  type: 'group'
  logic: 'AND' | 'OR' | 'NOT'
  internalLogic: 'AND' | 'OR'
  items: (ConditionItem | ConditionGroup)[]
}

export interface ConditionTree {
  type: 'root'
  internalLogic: 'AND' | 'OR'
  items: (ConditionItem | ConditionGroup)[]
}

export interface DeviceInfo {
  id: string
  name?: string | null
  serial?: string | null
  location?: string
  role?: string
  device_type?: { name: string } | string
  manufacturer?: string
  platform?: { name: string } | string
  primary_ip4?: { address: string } | string
  status?: string
  tags: string[]
}

export interface FieldOption {
  value: string
  label: string
}

export interface LocationItem {
  id: string
  name: string
  hierarchicalPath: string
  parent?: { id: string }
}

export interface CustomField {
  name: string
  label: string
  type: string
}

export interface BackendConditionsResponse {
  id: number
  name: string
  description?: string
  conditions: Array<LogicalCondition | { version: number; tree: ConditionTree }>
  scope: string
  created_by: string
  created_at?: string
  updated_at?: string
}

export interface DeviceSelectorProps {
  onDevicesSelected?: (devices: DeviceInfo[], conditions: LogicalCondition[]) => void
  showActions?: boolean
  showSaveLoad?: boolean
  initialConditions?: LogicalCondition[]
  initialDevices?: DeviceInfo[]
  enableSelection?: boolean
  selectedDeviceIds?: string[]
  onSelectionChange?: (selectedIds: string[], selectedDevices: DeviceInfo[]) => void
  onInventoryLoaded?: (inventoryId: number) => void
}

// Backend operation types
export interface BackendCondition {
  field: string
  operator: string
  value: string
}

export interface BackendOperation {
  operation_type: string
  conditions: BackendCondition[]
  nested_operations: BackendOperation[]
  _parentLogic?: string
}
