import type { Device, BackupHistoryEntry, FilterOptions } from '../types'

export const EMPTY_DEVICES: Device[] = []
export const EMPTY_HISTORY: BackupHistoryEntry[] = []
export const EMPTY_FILTER_OPTIONS: FilterOptions = {
  roles: new Set(),
  locations: new Set(),
  deviceTypes: new Set(),
  statuses: new Set(),
}

export const DEFAULT_PAGE_SIZE = 50
export const DEFAULT_PAGINATION = {
  limit: 50,
  offset: 0,
}

export const STALE_TIME = {
  DEVICES: 30 * 1000,        // 30 seconds
  HISTORY: 60 * 1000,        // 1 minute
  FILTER_OPTIONS: 5 * 60 * 1000,  // 5 minutes
} as const

export const STATUS_BADGE_VARIANTS = {
  active: 'default',
  online: 'default',
  offline: 'destructive',
  failed: 'destructive',
  maintenance: 'secondary',
} as const
