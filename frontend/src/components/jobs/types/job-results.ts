/**
 * Job Result Types and Type Guards
 * 
 * This file contains all the TypeScript interfaces and type guards
 * for different job result types in the Jobs View feature.
 */

// Base job run interface
export interface JobRun {
  id: number
  job_schedule_id: number | null
  job_template_id: number | null
  celery_task_id: string | null
  job_name: string
  job_type: string
  status: string
  triggered_by: string
  queued_at: string
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  error_message: string | null
  result: Record<string, unknown> | null
  target_devices: string[] | null
  executed_by: string | null
  schedule_name: string | null
  template_name: string | null
}

export interface PaginatedResponse {
  items: JobRun[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ============================================================================
// Backup Job Result Types
// ============================================================================

export interface BackupDeviceResult {
  device_id: string
  device_name: string
  device_ip: string
  platform: string
  running_config_file?: string
  startup_config_file?: string
  running_config_bytes?: number
  startup_config_bytes?: number
  ssh_connection_success: boolean
  running_config_success?: boolean
  startup_config_success?: boolean
  error?: string
}

export interface BackupJobResult {
  success: boolean
  devices_backed_up: number
  devices_failed: number
  message: string
  backed_up_devices: BackupDeviceResult[]
  failed_devices: BackupDeviceResult[]
  git_status?: {
    repository_existed: boolean
    operation: string
    repository_path: string
    repository_url: string
    branch: string
  }
  git_commit_status?: {
    committed: boolean
    pushed: boolean
    commit_hash: string
    files_changed: number
  }
  credential_info?: {
    credential_id: number
    credential_name: string
    username: string
  }
  repository?: string
  commit_date?: string
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown
}

// ============================================================================
// Sync Job Result Types (CheckMK Sync)
// ============================================================================

export interface SyncJobActivation {
  success: boolean
  message?: string
  error?: string
  data?: Record<string, unknown>
}

export interface SyncJobDeviceResult {
  device_id: string
  hostname?: string
  operation: string
  success: boolean
  message?: string
  error?: string
}

export interface SyncJobResult {
  success: boolean
  message: string
  total: number
  success_count: number
  failed_count: number
  results: SyncJobDeviceResult[]
  activation?: SyncJobActivation | null
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown
}

// ============================================================================
// Run Commands Job Result Types
// ============================================================================

export interface RunCommandsDeviceResult {
  device_id: string
  device_name: string | null
  device_ip: string | null
  platform: string | null
  success: boolean
  rendered_commands: string | null
  output: string | null
  error: string | null
}

export interface RunCommandsJobResult {
  success: boolean
  message: string
  command_template: string
  total: number
  success_count: number
  failed_count: number
  successful_devices: RunCommandsDeviceResult[]
  failed_devices: RunCommandsDeviceResult[]
  credential_info?: {
    credential_id: number
    credential_name: string
    username: string
  }
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown
}

// ============================================================================
// Bulk Onboard Job Result Types
// ============================================================================

export interface BulkOnboardDeviceResult {
  device_id: string
  device_name: string
  ip_address: string
  status: 'success' | 'failed'
  message: string
  job_id?: string
}

export interface BulkOnboardJobResult {
  device_count: number
  successful_devices: number
  failed_devices: number
  devices: BulkOnboardDeviceResult[]
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown
}

// ============================================================================
// Export Devices Job Result Types
// ============================================================================

export interface ExportDevicesJobResult {
  success: boolean
  message: string
  exported_devices: number
  requested_devices: number
  properties_count: number
  export_format: string
  file_path: string
  filename: string
  file_size_bytes: number
  error?: string
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown
}

// ============================================================================
// Generic Job Result (fallback)
// ============================================================================

export interface GenericDeviceResult {
  device_id?: string
  hostname?: string
  operation?: string
  success: boolean
  message?: string
  error?: string
}

export interface GenericJobResult {
  success: boolean
  message?: string
  total?: number
  success_count?: number
  failed_count?: number
  completed?: number
  failed?: number
  differences_found?: number
  results?: GenericDeviceResult[]
  error?: string
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if result is a backup job result.
 * Must check for 'backed_up_devices' specifically to distinguish from run_commands results.
 */
export function isBackupJobResult(result: Record<string, unknown>): result is BackupJobResult {
  return (
    'backed_up_devices' in result ||
    ('devices_backed_up' in result && 'devices_failed' in result)
  )
}

/**
 * Check if result is a sync job result (CheckMK sync).
 * Has activation field or is sync_devices type.
 */
export function isSyncJobResult(result: Record<string, unknown>): result is SyncJobResult {
  return (
    'activation' in result ||
    ('success_count' in result && 'results' in result && Array.isArray(result.results))
  )
}

/**
 * Check if result is a run_commands job result.
 * Has command_template and successful_devices or failed_devices.
 */
export function isRunCommandsJobResult(result: Record<string, unknown>): result is RunCommandsJobResult {
  return (
    'command_template' in result &&
    ('successful_devices' in result || 'failed_devices' in result)
  )
}

/**
 * Check if result is an export_devices job result.
 * Has file_path and export_format fields.
 */

export function isExportDevicesJobResult(result: Record<string, unknown>): result is ExportDevicesJobResult {
  return (
    'export_format' in result &&
    'file_path' in result &&
    'filename' in result
  )
}

/**
 * Check if result is a bulk_onboard job result.
 * Has device_count and devices array.
 */
export function isBulkOnboardJobResult(result: Record<string, unknown>): result is BulkOnboardJobResult {
  return (
    'device_count' in result &&
    'devices' in result &&
    Array.isArray(result.devices)
  )
}


// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format bytes to human readable string (e.g., "1.5 KB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
