import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface NautobotContactItem {
  id: string
  name?: string
  display?: string
}

interface NautobotContactsResponse {
  results?: NautobotContactItem[]
}

export function useNautobotContactsQuery(enabled = false) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.contacts(),
    queryFn: async () => {
      const response = await apiCall<NautobotContactItem[] | NautobotContactsResponse>(
        'nautobot/contacts'
      )
      if (Array.isArray(response)) {
        return response
      }
      return Array.isArray(response.results) ? response.results : []
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  })
}
