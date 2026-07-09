import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export type FieldMapping = Record<string, string | null>

interface FieldMappingResponse {
  success: boolean
  data: FieldMapping | null
}

interface UseFieldMappingQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseFieldMappingQueryOptions = {}

/**
 * Fetches the current user's saved field mapping for a given app (or null if
 * none has been saved yet). Reusable across any tool that adopts saved
 * field-mapping preferences, keyed by `appName`.
 */
export function useFieldMappingQuery(
  appName: string,
  options: UseFieldMappingQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.fieldMappings.detail(appName),
    queryFn: () => apiCall<FieldMappingResponse>(`field-mappings/${appName}`),
    enabled,
    staleTime: 30 * 1000,
    select: response => response?.data ?? null,
  })
}
