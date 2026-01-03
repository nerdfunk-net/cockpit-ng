/**
 * Type definitions for Ansible Inventory Builder
 */

export interface LogicalCondition {
  field: string
  operator: string
  value: string
  logic: string
}

export interface DeviceInfo {
  id: string
  name?: string | null // Name can be null/undefined for unnamed devices
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

export interface GitRepository {
  id: number
  name: string
  url: string
  branch: string
  category?: string
}

export interface SavedInventory {
  name: string
  description?: string
  conditions: LogicalCondition[]
  created_at?: string
  updated_at?: string
}

export interface GitPushResult {
  repository: string
  branch: string
  file: string
  device_count: number
  commit_message: string
}

export interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

/**
 * API call type from use-api hook
 */
export type ApiCallType = ReturnType<typeof import('@/hooks/use-api').useApi>['apiCall']
