import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { SelectedInterface, ServerLocation, ServerResponse } from '@/components/features/server-clients/server/types'

interface CreateServerPayload {
  hostname: string
  location?: ServerLocation | null
  primary_ipv4?: string | null
  primary_interface?: string | null
  os_family?: string | null
  processor_count?: number | null
  memtotal_mb?: number | null
  disk_count?: number | null
  architecture?: string | null
  distribution_release?: string | null
  distribution_version?: string | null
  contact?: string | null
  nautobot_uuid?: string | null
  is_virtual?: boolean | null
  ansible_facts?: Record<string, unknown> | null
}

interface UpdateServerPayload {
  hostname?: string
  location?: ServerLocation | null
  primary_ipv4?: string | null
  primary_interface?: string | null
  os_family?: string | null
  processor_count?: number | null
  memtotal_mb?: number | null
  disk_count?: number | null
  architecture?: string | null
  distribution_release?: string | null
  distribution_version?: string | null
  contact?: string | null
  nautobot_uuid?: string | null
  is_virtual?: boolean | null
  ansible_facts?: Record<string, unknown> | null
  selected_interfaces?: SelectedInterface[] | null
}

export function useServerMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createServer = useMutation({
    mutationFn: async (data: CreateServerPayload): Promise<ServerResponse> =>
      apiCall<ServerResponse>('servers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers.list() })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to save server',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const updateServer = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateServerPayload }): Promise<ServerResponse> =>
      apiCall<ServerResponse>(`servers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers.list() })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update server',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const deleteServer = useMutation({
    mutationFn: async (id: number): Promise<void> =>
      apiCall<void>(`servers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers.list() })
      toast({ title: 'Server removed', description: 'The server was deleted.' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to remove server',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return { createServer, updateServer, deleteServer }
}
