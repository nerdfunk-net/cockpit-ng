export interface CacheSettings {
  enabled: boolean
  ttl_seconds: number
  prefetch_on_startup: boolean
  refresh_interval_minutes: number
  max_commits: number
  prefetch_items?: {
    git?: boolean
    locations?: boolean
    devices?: boolean
  }
  devices_cache_interval_minutes?: number
  locations_cache_interval_minutes?: number
  git_commits_cache_interval_minutes?: number
}

export interface CacheStats {
  overview: {
    total_items: number
    valid_items: number
    expired_items: number
    total_size_bytes: number
    total_size_mb: number
    uptime_seconds: number
  }
  performance: {
    cache_hits: number
    cache_misses: number
    hit_rate_percent: number
    expired_entries: number
    entries_created: number
    entries_cleared: number
  }
  namespaces: Record<string, { count: number; size_bytes: number }>
  keys: string[]
}

export interface CacheEntry {
  key: string
  namespace: string
  created_at: number
  expires_at: number
  last_accessed: number
  access_count: number
  size_bytes: number
  age_seconds: number
  ttl_seconds: number
  last_accessed_ago: number
  is_expired: boolean
}

export interface NamespaceInfo {
  namespace: string
  total_entries: number
  valid_entries: number
  expired_entries: number
  total_size_bytes: number
  total_size_mb: number
  entries: CacheEntry[]
}

export interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

// API Response types
export interface CacheSettingsResponse {
  success: boolean
  data: CacheSettings
}

export interface CacheStatsResponse {
  success: boolean
  data: CacheStats
}

export interface CacheEntriesResponse {
  success: boolean
  data: CacheEntry[]
  count: number
}

export interface NamespaceInfoResponse {
  success: boolean
  data: NamespaceInfo
}

export interface CacheActionResponse {
  success: boolean
  message?: string
  removed_count?: number
  cleared_count?: number
}
