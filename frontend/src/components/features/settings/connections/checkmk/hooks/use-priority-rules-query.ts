import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { CheckMKPriorityRule } from '../types'

const EMPTY_RULES: CheckMKPriorityRule[] = []

export function usePriorityRulesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.checkmkPriorityRules.list(),
    queryFn: async () => {
      const result = await apiCall<CheckMKPriorityRule[]>('checkmk/priority-rules')
      return Array.isArray(result) ? result : EMPTY_RULES
    },
    staleTime: 30 * 1000,
  })
}
