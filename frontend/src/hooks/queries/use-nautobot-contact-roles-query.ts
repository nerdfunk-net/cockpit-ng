import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface NautobotContactRoleItem {
  id: string
  name?: string
  display?: string
}

interface NautobotContactRolesResponse {
  results?: NautobotContactRoleItem[]
}

export function useNautobotContactRolesQuery(enabled = false) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.contactRoles(),
    queryFn: async () => {
      const response = await apiCall<NautobotContactRoleItem[] | NautobotContactRolesResponse>(
        'nautobot/roles/contacts'
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

