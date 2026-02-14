import type { JobTemplate, JobType, GitRepository, SavedInventory, CommandTemplate, CustomField } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const EMPTY_TEMPLATES: JobTemplate[] = []
export const EMPTY_TYPES: JobType[] = []
export const EMPTY_REPOS: GitRepository[] = []
export const EMPTY_INVENTORIES: SavedInventory[] = []
export const EMPTY_CMD_TEMPLATES: CommandTemplate[] = []
export const EMPTY_CUSTOM_FIELDS: CustomField[] = []

export const JOB_TYPE_LABELS: Record<string, string> = {
  backup: 'Backup',
  compare_devices: 'Compare Devices',
  run_commands: 'Run Commands',
  cache_devices: 'Cache Devices',
  sync_devices: 'Sync Devices',
  scan_prefixes: 'Scan Prefixes',
  deploy_agent: 'Deploy Agent',
} as const

export const JOB_TYPE_COLORS: Record<string, string> = {
  backup: 'bg-blue-500',
  compare_devices: 'bg-purple-500',
  run_commands: 'bg-green-500',
  cache_devices: 'bg-cyan-500',
  sync_devices: 'bg-orange-500',
  scan_prefixes: 'bg-purple-500',
  deploy_agent: 'bg-teal-500',
} as const

export const DEFAULT_TEMPLATE: Partial<JobTemplate> = {
  inventory_source: 'all',
  is_global: false,
  parallel_tasks: 1,
  activate_changes_after_sync: true,
  scan_resolve_dns: false,
} as const

export const STALE_TIME = {
  TEMPLATES: 30 * 1000,          // 30 seconds - moderately dynamic
  JOB_TYPES: 5 * 60 * 1000,      // 5 minutes - rarely changes
  CONFIG_REPOS: 2 * 60 * 1000,   // 2 minutes - occasionally changes
  INVENTORIES: 30 * 1000,        // 30 seconds - moderately dynamic
  CMD_TEMPLATES: 2 * 60 * 1000,  // 2 minutes - occasionally changes
  CUSTOM_FIELDS: 5 * 60 * 1000,  // 5 minutes - rarely changes
} as const
