import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { LoadYamlResponse } from '../types'
import { CACHE_TIME, YAML_FILES } from '../utils/constants'

interface UseYamlQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseYamlQueryOptions = { enabled: true }

/**
 * Fetch CheckMK YAML configuration file
 */
export function useCheckMKYamlQuery(options: UseYamlQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.checkmkSettings.checkmkYaml(),
    queryFn: async () => {
      try {
        const response = await apiCall<LoadYamlResponse>(`config/${YAML_FILES.CHECKMK}`)

        if (response.success && response.data) {
          return response.data
        }

        // File doesn't exist, return empty string
        return ''
      } catch (error) {
        console.warn('Failed to load checkmk.yaml:', error)
        return ''
      }
    },
    enabled,
    staleTime: CACHE_TIME.YAML,
  })
}

/**
 * Fetch CheckMK queries YAML configuration file
 */
export function useCheckMKQueriesQuery(options: UseYamlQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.checkmkSettings.queriesYaml(),
    queryFn: async () => {
      try {
        const response = await apiCall<LoadYamlResponse>(`config/${YAML_FILES.QUERIES}`)

        if (response.success && response.data) {
          return response.data
        }

        // File doesn't exist, return empty string
        return ''
      } catch (error) {
        console.warn('Failed to load checkmk_queries.yaml:', error)
        return ''
      }
    },
    enabled,
    staleTime: CACHE_TIME.YAML,
  })
}
