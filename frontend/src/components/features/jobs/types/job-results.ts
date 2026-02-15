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
  error?: string | {
    error?: string
    status_code?: number
    detail?: string
    title?: string
    fields?: Record<string, unknown>
  }
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
// Update Devices Job Result Types
// ============================================================================

export interface UpdateDeviceSuccess {
  device_id?: string
  device_name?: string
  updates: Record<string, unknown>
  result: Record<string, unknown>
  // IP Prefix specific fields
  row?: number
  prefix?: string
  namespace?: string
}

export interface UpdateDeviceFailure {
  device_id?: string
  device_name?: string
  identifier?: string
  // IP Prefix specific fields
  row?: number
  prefix?: string
  namespace?: string
  error: string
}

export interface UpdateDevicesJobResult {
  success: boolean
  dry_run: boolean
  summary: {
    total: number
    successful: number
    failed: number
    skipped: number
  }
  successes: UpdateDeviceSuccess[]
  failures: UpdateDeviceFailure[]
  skipped: UpdateDeviceFailure[]
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown
}

// ============================================================================
// Check IP Job Result Types
// ============================================================================

export interface CheckIPDeviceResult {
  ip_address: string
  device_name: string
  status: 'match' | 'name_mismatch' | 'ip_not_found' | 'error'
  nautobot_device_name?: string
  error?: string
}

export interface CheckIPJobResult {
  success: boolean
  message?: string
  error?: string
  total_devices?: number
  processed_devices?: number
  statistics: {
    matches: number
    name_mismatches: number
    ip_not_found: number
    errors: number
  }
  results: CheckIPDeviceResult[]
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown
}

// ============================================================================
// Deploy Agent Job Result Types
// ============================================================================

export interface DeployAgentTemplateResult {
  template_id: number
  template_name: string
  file_path: string | null
  inventory_id: number | null
  success: boolean
  rendered_size: number
  error?: string
}

export interface DeployAgentJobResult {
  success: boolean
  message?: string
  error?: string
  template_id?: number
  template_name?: string
  agent_id: string
  agent_name: string
  commit_sha: string
  commit_sha_short: string
  file_path?: string
  repository_name: string
  repository_url: string
  branch: string
  files_changed: number
  pushed: boolean
  timestamp: string
  // Multi-template results
  template_results?: DeployAgentTemplateResult[]
  // Activation fields
  activated?: boolean
  activation_output?: string
  activation_warning?: string
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown
}

// ============================================================================
// Scan Prefix Job Result Types
// ============================================================================

export interface ReachableIP {
  ip: string
  hostname?: string
}

export interface PrefixScanResult {
  prefix: string
  total_ips: number
  reachable_count: number
  unreachable_count: number
  reachable: ReachableIP[]
  unreachable: string[]
}

export interface ScanPrefixJobResult {
  success: boolean
  custom_field_name: string
  custom_field_value: string
  prefixes: PrefixScanResult[]
  total_prefixes: number
  total_ips_scanned: number
  total_reachable: number
  total_unreachable: number
  resolve_dns: boolean
  message?: string
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

/**
 * Check if result is an update_devices job result.
 * Has dry_run flag and summary object with total/successful/failed/skipped counts.
 */
export function isUpdateDevicesJobResult(result: Record<string, unknown>): result is UpdateDevicesJobResult {
  return (
    'dry_run' in result &&
    'summary' in result &&
    typeof result.summary === 'object' &&
    result.summary !== null &&
    'total' in result.summary &&
    'successful' in result.summary &&
    'failed' in result.summary &&
    'skipped' in result.summary
  )
}

/**
 * Check if result is a check_ip job result.
 * Has statistics object with matches/name_mismatches/ip_not_found/errors counts.
 */
export function isCheckIPJobResult(result: Record<string, unknown>): result is CheckIPJobResult {
  return (
    'statistics' in result &&
    typeof result.statistics === 'object' &&
    result.statistics !== null &&
    'matches' in result.statistics &&
    'name_mismatches' in result.statistics &&
    'ip_not_found' in result.statistics &&
    'errors' in result.statistics &&
    'results' in result &&
    Array.isArray(result.results)
  )
}

/**
 * Check if result is a deploy_agent job result.
 * Has agent_name, commit_sha, and repository_name fields.
 */
export function isDeployAgentJobResult(result: Record<string, unknown>): result is DeployAgentJobResult {
  return (
    'agent_name' in result &&
    'commit_sha' in result &&
    'repository_name' in result
  )
}

/**
 * Check if result is a scan_prefix job result.
 * Has prefixes array with total_ips_scanned and total_reachable/total_unreachable counts.
 */
export function isScanPrefixJobResult(result: Record<string, unknown>): result is ScanPrefixJobResult {
  return (
    'prefixes' in result &&
    Array.isArray(result.prefixes) &&
    'total_ips_scanned' in result &&
    'total_reachable' in result &&
    'total_unreachable' in result
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
