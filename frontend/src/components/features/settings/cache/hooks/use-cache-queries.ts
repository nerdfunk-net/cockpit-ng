import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type {
  CacheSettings,
  CacheSettingsResponse,
  CacheStatsResponse,
  CacheEntriesResponse,
  NamespaceInfoResponse
} from '../types'
import { DEFAULT_CACHE_SETTINGS, STALE_TIME } from '../utils/constants'

interface UseCacheSettingsOptions {
  enabled?: boolean
}

interface UseQueryOptions {
  enabled?: boolean
}

const DEFAULT_SETTINGS_OPTIONS: UseCacheSettingsOptions = { enabled: true }
const DEFAULT_QUERY_OPTIONS: UseQueryOptions = {}

/**
 * Fetch cache settings with automatic caching
 */
export function useCacheSettings(options: UseCacheSettingsOptions = DEFAULT_SETTINGS_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.cache.settings(),
    queryFn: async () => {
      const response = await apiCall<CacheSettingsResponse>('settings/cache', { method: 'GET' })
      if (!response?.success || !response.data) {
        throw new Error('Failed to load cache settings')
      }

      // Merge with defaults
      return {
        ...DEFAULT_CACHE_SETTINGS,
        ...response.data,
        prefetch_items: response.data.prefetch_items || DEFAULT_CACHE_SETTINGS.prefetch_items,
      } as CacheSettings
    },
    enabled,
    staleTime: STALE_TIME.SETTINGS,
  })
}

/**
 * Fetch cache statistics with automatic refresh
 */
export function useCacheStats(options: UseQueryOptions = DEFAULT_QUERY_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.cache.stats(),
    queryFn: async () => {
      const response = await apiCall<CacheStatsResponse>('cache/stats', { method: 'GET' })
      if (!response?.success || !response.data) {
        throw new Error('Failed to load cache statistics')
      }
      return response.data
    },
    enabled,
    staleTime: STALE_TIME.STATS, // Always fresh
    refetchInterval: enabled ? 30000 : false, // Auto-refresh every 30s when visible
  })
}

/**
 * Fetch cache entries with filtering
 */
export function useCacheEntries(
  includeExpired: boolean = false,
  options: UseQueryOptions = DEFAULT_QUERY_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.cache.entries(includeExpired),
    queryFn: async () => {
      const response = await apiCall<CacheEntriesResponse>(
        `cache/entries?include_expired=${includeExpired}`,
        { method: 'GET' }
      )
      if (!response?.success || !response.data) {
        throw new Error('Failed to load cache entries')
      }
      return response.data
    },
    enabled,
    staleTime: STALE_TIME.ENTRIES,
  })
}

/**
 * Fetch namespace information
 */
export function useCacheNamespace(
  namespace: string | null,
  options: UseQueryOptions = DEFAULT_QUERY_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.cache.namespace(namespace!),
    queryFn: async () => {
      const response = await apiCall<NamespaceInfoResponse>(
        `cache/namespace/${namespace}`,
        { method: 'GET' }
      )
      if (!response?.success || !response.data) {
        throw new Error(`Failed to load namespace '${namespace}' information`)
      }
      return response.data
    },
    enabled: enabled && !!namespace,
    staleTime: STALE_TIME.ENTRIES,
  })
}
