import type { GitImportFormData } from '../types'

// React best practice: Extract default arrays/objects to prevent re-render loops
export const EMPTY_GIT_REPOS = []
export const EMPTY_GIT_FILES = []

export const DEFAULT_IMPORT_VALUES: Partial<GitImportFormData> = {
  repositoryId: undefined,
  filePath: '',
} as const

export const SNMP_FILE_NAME = 'snmp_mapping.yaml' as const

export const CACHE_TIME = {
  SNMP_MAPPING: 2 * 60 * 1000,  // 2 minutes
} as const

export const MESSAGE_TIMEOUT = 5000 as const

export const COCKPIT_CONFIGS_CATEGORY = 'cockpit_configs' as const

export const EMPTY_STRING = ''
