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

export interface WorkersData {
  active_tasks?: Record<string, unknown[]>
  stats?: Record<string, unknown>
  registered_tasks?: Record<string, string[]>
}

export interface WorkerStats {
  pool?: {
    'max-concurrency'?: number | string
    implementation?: string
  }
}

export interface CelerySettings {
  max_workers: number
  cleanup_enabled: boolean
  cleanup_interval_hours: number
  cleanup_age_hours: number
  result_expires_hours: number
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
