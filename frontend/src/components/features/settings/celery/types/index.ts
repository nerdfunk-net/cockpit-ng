export interface CeleryStatus {
  redis_connected: boolean
  worker_count: number
  active_tasks: number
  beat_running: boolean
}

export interface Schedule {
  name: string
  task: string
  schedule: string
  options: Record<string, unknown>
}

export interface TaskStatus {
  task_id: string
  status: string
  result?: Record<string, unknown>
  error?: string
  progress?: Record<string, unknown>
}

export interface QueueInfo {
  name: string
  routing_key: string
}

export interface WorkersData {
  active_tasks?: Record<string, unknown[]>
  stats?: Record<string, unknown>
  registered_tasks?: Record<string, string[]>
  active_queues?: Record<string, QueueInfo[]>
}

export interface WorkerStats {
  pool?: {
    'max-concurrency'?: number | string
    implementation?: string
  }
}

export interface QueueMetrics {
  name: string
  pending_tasks: number
  active_tasks: number
  workers_consuming: string[]
  worker_count: number
  routed_tasks: string[]
  exchange?: string
  routing_key?: string
}

export interface CeleryQueue {
  name: string
  description: string
  built_in?: boolean  // True for hardcoded queues (default, backup, network, heavy)
}

export interface CelerySettings {
  max_workers: number
  cleanup_enabled: boolean
  cleanup_interval_hours: number
  cleanup_age_hours: number
  result_expires_hours: number
  queues: CeleryQueue[]
}

// API Response types
export interface CeleryStatusResponse {
  success: boolean
  status: CeleryStatus
}

export interface CeleryWorkersResponse {
  success: boolean
  workers: WorkersData
}

export interface CelerySchedulesResponse {
  success: boolean
  schedules?: Schedule[]
}

export interface CelerySettingsResponse {
  success: boolean
  settings?: CelerySettings
}

export interface CeleryActionResponse {
  success: boolean
  message?: string
  task_id?: string
}

export interface CeleryQueuesResponse {
  success: boolean
  queues: QueueMetrics[]
  total_queues: number
  error?: string
}

export interface PurgeQueueResponse {
  success: boolean
  queue: string
  purged_tasks: number
  message: string
}

export interface PurgeAllQueuesResponse {
  success: boolean
  total_purged: number
  queues: Array<{
    queue: string
    purged_tasks: number
    error?: string
  }>
  message: string
}
