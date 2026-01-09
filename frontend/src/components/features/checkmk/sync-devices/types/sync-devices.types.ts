/**
 * Type definitions for the CheckMK Sync Devices feature
 */

export interface Device {
  id: string
  name: string
  role: string
  status: string
  location: string
  checkmk_status: string
  diff?: string
  normalized_config?: {
    folder?: string
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
  ignored_attributes?: string[]
  result_data?: Record<string, unknown>
  error_message?: string
  processed_at?: string
}

export interface NautobotDeviceRecord {
  id?: string
  name?: string
  role?: { name?: string } | null
  status?: { name?: string } | null
  location?: { name?: string } | null
  primary_ip4?: { address?: string } | null
  device_type?: { model?: string } | null
}

export interface DeviceResult {
  id?: number
  job_id?: string
  device_name: string
  device?: string
  status: string
  result_data?: {
    data?: {
      result?: unknown
      normalized_config?: {
        folder?: string
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
      ignored_attributes?: string[]
    }
    comparison_result?: unknown
    status?: string
    normalized_config?: {
      folder?: string
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
    ignored_attributes?: string[]
  }
  error_message?: string
  processed_at?: string
  role?: { name: string } | string
  location?: { name: string } | string
  device_type?: { model: string }
  primary_ip4?: { address: string }
  device_status?: { name: string }
  device_id?: string
  checkmk_status?: string
  normalized_config?: {
    folder?: string
    attributes?: Record<string, unknown>
    internal?: {
      hostname?: string
      role?: string
      status?: string
      location?: string
    }
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
  ignored_attributes?: string[]
}

export interface AttributeConfig {
  site?: string
}

export interface Job {
  id: string
  status: string
  created_at: string
  processed_devices: number
}

export interface JobProgress {
  processed: number
  total: number
  message: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  current?: number
  success?: number
  failed?: number
}

export interface CeleryTaskProgress {
  current?: number
  total?: number
  status?: string
  completed?: number
  failed?: number
}

export interface CeleryTaskResult {
  completed?: number
  total?: number
  message?: string
  failed?: number
  job_id?: string
}

export interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

export interface FilterState {
  name: string
  role: string
  status: string
  location: string
  site: string
  checkmk_status: string
}

export interface CheckmkStatusFilters {
  equal: boolean
  diff: boolean
  missing: boolean
}

export interface ConfigComparison {
  key: string
  nautobotValue: unknown
  checkmkValue: unknown
  isDifferent: boolean
  nautobotMissing: boolean
  checkmkMissing: boolean
  isIgnored: boolean
}
