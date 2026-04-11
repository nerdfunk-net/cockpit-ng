// Device types
export interface Device {
  id: string
  name: string
  primary_ip4?: { address: string }
  role?: { name: string }
  location?: { name: string }
  device_type?: { model: string }
  status?: { name: string }
  checkmk_status?: string
  normalized_config?: {
    internal?: {
      hostname?: string
      role?: string
      status?: string
      location?: string
    }
    attributes?: Record<string, unknown>
  }
  checkmk_config?: {
    folder?: string
    attributes?: Record<string, unknown>
    effective_attributes?: Record<string, unknown> | null
    is_cluster?: boolean
    is_offline?: boolean
    cluster_nodes?: unknown[] | null
  }
  diff?: string
  error_message?: string
}

// Celery task types
export interface CeleryTaskResponse {
  task_id: string
  job_id?: string
  status: string
  message: string
}

export interface CeleryTaskStatus {
  task_id: string
  status: 'PENDING' | 'STARTED' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'RETRY' | 'REVOKED'
  result?: {
    success: boolean
    message: string
    device_id?: string
    hostname?: string
    results?: Array<{
      success: boolean
      error?: string
    }>
    [key: string]: unknown
  }
  error?: string
  progress?: {
    status?: string
    current?: number
    total?: number
    success?: number
    failed?: number
    [key: string]: unknown
  }
}

export interface DeviceTask {
  taskId: string
  deviceId: string | string[]
  deviceName: string
  operation: 'add' | 'update' | 'sync'
  status: CeleryTaskStatus['status']
  message: string
  startedAt: Date
  batchProgress?: {
    current: number
    total: number
    success: number
    failed: number
  }
}

// Pagination types
export interface PaginationState {
  isBackendPaginated: boolean
  hasMore: boolean
  totalCount: number
  currentLimit: number | null
  currentOffset: number
  filterType: string | null
  filterValue: string | null
}

// Filter types
export interface FilterOptions {
  roles: Set<string>
  locations: Set<string>
  statuses: Set<string>
  checkmkStatuses: Set<string>
}

export interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

// Diff types
export interface DiffResult {
  device_id: string
  device_name: string
  differences: {
    result: 'equal' | 'diff' | 'host_not_found'
    diff: string
    normalized_config: {
      folder: string
      attributes: Record<string, unknown>
    }
    checkmk_config: {
      folder: string
      attributes: Record<string, unknown>
      effective_attributes: Record<string, unknown> | null
      is_cluster: boolean
      is_offline: boolean
      cluster_nodes: unknown[] | null
    } | null
    ignored_attributes: string[]
  }
  timestamp: string
}

export interface ConfigAttribute {
  key: string
  nautobotValue: unknown
  checkmkValue: unknown
  isDifferent: boolean
  nautobotMissing: boolean
  checkmkMissing: boolean
  isIgnored: boolean
}
