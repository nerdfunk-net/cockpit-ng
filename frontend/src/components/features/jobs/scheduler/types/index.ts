export interface JobSchedule {
  id: number
  job_identifier: string
  job_template_id: number
  template_name?: string
  template_job_type?: string
  schedule_type: "now" | "interval" | "hourly" | "daily" | "weekly" | "monthly" | "custom"
  cron_expression?: string
  interval_minutes?: number
  start_time?: string
  start_date?: string
  is_active: boolean
  is_global: boolean
  user_id?: number
  credential_id?: number
  job_parameters?: Record<string, unknown>
  created_at: string
  updated_at: string
  last_run?: string
  next_run?: string
}

export interface JobTemplate {
  id: number
  name: string
  job_type: string
  description?: string
  inventory_source: string
  inventory_repository_id?: number
  inventory_name?: string
  command_template_name?: string
  is_global: boolean
  user_id?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Credential {
  id: number
  name: string
  username: string
  type: string
  source: string
  owner?: string
}

export interface SchedulerDebugInfo {
  server_time: {
    utc: string
    local: string
    timezone_offset_hours: number
  }
  schedule_summary: {
    total_schedules: number
    active_schedules: number
    due_now: number
    upcoming: number
  }
  due_schedules: Array<{
    id: number
    job_identifier: string
    schedule_type: string
    start_time: string | null
    next_run: string | null
    next_run_local: string | null
    last_run: string | null
    seconds_until_next_run: number
    is_due: boolean
    template_name: string | null
  }>
  upcoming_schedules: Array<{
    id: number
    job_identifier: string
    schedule_type: string
    start_time: string | null
    next_run: string | null
    next_run_local: string | null
    last_run: string | null
    seconds_until_next_run: number
    is_due: boolean
    template_name: string | null
  }>
  celery_status: string
  note: string
}

export interface ScheduleFormData {
  job_identifier: string
  job_template_id: number
  schedule_type: JobSchedule['schedule_type']
  interval_minutes?: number
  start_time?: string
  is_active: boolean
  is_global: boolean
  credential_id?: number | null
}
