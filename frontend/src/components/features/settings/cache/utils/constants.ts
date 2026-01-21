import type { CacheSettings } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const DEFAULT_PREFETCH_ITEMS = {
  git: true,
  locations: false,
  devices: false,
} as const

export const DEFAULT_CACHE_SETTINGS: Partial<CacheSettings> = {
  enabled: true,
  ttl_seconds: 600,
  prefetch_on_startup: true,
  refresh_interval_minutes: 15,
  max_commits: 500,
  prefetch_items: DEFAULT_PREFETCH_ITEMS,
  devices_cache_interval_minutes: 60,
  locations_cache_interval_minutes: 10,
  git_commits_cache_interval_minutes: 15,
} as const

export const STALE_TIME = {
  SETTINGS: 5 * 60 * 1000,  // 5 minutes - settings rarely change
  STATS: 0,                  // Always fresh - real-time stats
  ENTRIES: 10 * 1000,        // 10 seconds - moderate freshness
} as const
