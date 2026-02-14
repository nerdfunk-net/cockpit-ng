import type { FilterOption, JobRun, JobTemplate, JobProgressResponse } from '../types'

// React best practice: Extract default arrays to prevent re-render loops
export const EMPTY_ARRAY: JobRun[] = []
export const EMPTY_TEMPLATES: JobTemplate[] = []
export const EMPTY_PROGRESS: Record<number, JobProgressResponse> = {}

// Filter options
export const STATUS_OPTIONS: readonly FilterOption[] = [
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
] as const

export const JOB_TYPE_OPTIONS: readonly FilterOption[] = [
  { value: "backup", label: "Backup" },
  { value: "cache_devices", label: "Cache Devices" },
  { value: "cache_locations", label: "Cache Locations" },
  { value: "cache_git_commits", label: "Cache Git Commits" },
  { value: "sync_devices", label: "Sync Devices" },
  { value: "run_commands", label: "Run Commands" },
  { value: "compare_devices", label: "Compare Devices" },
  { value: "scan_prefixes", label: "Scan Prefixes" },
  { value: "deploy_agent", label: "Deploy Agent" },
] as const

export const TRIGGER_OPTIONS: readonly FilterOption[] = [
  { value: "manual", label: "Manual" },
  { value: "schedule", label: "Schedule" },
  { value: "system", label: "System" },
] as const

// Cache durations for TanStack Query
export const STALE_TIME = {
  JOBS_LIST: 10 * 1000,      // 10s - frequently changing when jobs running
  TEMPLATES: 5 * 60 * 1000,  // 5 min - rarely changes
  PROGRESS: 0,               // Always fresh for active jobs
  DETAIL: 30 * 1000,         // 30s - for job detail view
} as const

// Polling intervals
export const JOB_POLL_INTERVAL = 3000 // 3 seconds for auto-refresh
export const PROGRESS_POLL_INTERVAL = 3000 // 3 seconds for backup progress

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 25
export const DEFAULT_PAGE = 1
