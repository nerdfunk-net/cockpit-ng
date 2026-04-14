import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface RackMapping {
  origin_name: string
  mapped_name: string
}

interface UseRackMappingsQueryOptions {
  rack_name: string
  location_id: string
  enabled?: boolean
}

export function useRackMappingsQuery({
  rack_name,
  location_id,
  enabled = true,
}: UseRackMappingsQueryOptions) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.rackMappings({ rack_name, location_id }),
    queryFn: () =>
      apiCall<RackMapping[]>(
        `nautobot/rack-mappings?rack_name=${encodeURIComponent(rack_name)}&location_id=${encodeURIComponent(location_id)}`
      ),
    enabled: enabled && Boolean(rack_name) && Boolean(location_id),
    staleTime: 60 * 1000,
  })
}
