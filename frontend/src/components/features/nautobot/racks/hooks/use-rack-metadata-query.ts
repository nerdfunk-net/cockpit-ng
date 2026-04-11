import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { fetchRackMetadata } from '@/services/nautobot-graphql'
import { RACK_STALE_TIMES } from '../constants'
import type { RackMetadata } from '../types'

interface UseRackMetadataQueryOptions {
  rackId?: string
}

const DEFAULT_OPTIONS: UseRackMetadataQueryOptions = {}

export function useRackMetadataQuery({ rackId }: UseRackMetadataQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()

  const query = useQuery({
    queryKey: queryKeys.nautobot.rackMetadata(rackId ?? ''),
    queryFn: async (): Promise<RackMetadata | null> => {
      if (!rackId) return null
      const response = await fetchRackMetadata(apiCall, rackId)
      const rack = response?.data?.racks?.[0]
      if (!rack) return null
      return {
        id: rack.id,
        name: rack.name,
        type: rack.type,
        width: rack.width,
        u_height: rack.u_height,
        status: rack.status,
      }
    },
    enabled: !!rackId,
    staleTime: RACK_STALE_TIMES.SEMI_STATIC,
  })

  return {
    rackMetadata: query.data ?? null,
    isLoading: query.isLoading,
  }
}
