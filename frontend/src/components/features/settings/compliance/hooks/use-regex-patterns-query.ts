import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiResponse, RegexPattern } from '../types'
import { CACHE_TIME } from '../utils/constants'

interface UseRegexPatternsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseRegexPatternsQueryOptions = { enabled: true }

/**
 * Fetch regex patterns for compliance checks with automatic caching
 */
export function useRegexPatternsQuery(
  options: UseRegexPatternsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.complianceSettings.regexPatterns(),
    queryFn: async () => {
      const response = await apiCall<ApiResponse<RegexPattern[]>>(
        'settings/compliance/regex-patterns'
      )

      if (response?.success && response?.data) {
        return response.data
      }

      throw new Error('Failed to load regex patterns')
    },
    enabled,
    staleTime: CACHE_TIME.REGEX_PATTERNS,
  })
}
