'use client'

import { useCallback, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'
import { parseProxyApiErrorMessage } from '@/lib/parse-proxy-api-error'
import type { ServerResponse } from '../types'

export function useRefreshServerOpenPorts(server: ServerResponse) {
  const { apiCall } = useApi()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canScanOpenPorts = Boolean(server.ansible_credentials?.agent_id)

  const scanMutation = useMutation({
    mutationFn: async (): Promise<ServerResponse> =>
      apiCall<ServerResponse>(`servers/${server.id}/refresh-open-ports`, {
        method: 'POST',
      }),
    onSuccess: updated => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers.all })
      queryClient.setQueryData(queryKeys.servers.detail(updated.id), updated)

      const tcpCount = updated.open_ports?.tcp_ports.length ?? 0
      const udpCount = updated.open_ports?.udp_ports.length ?? 0
      toast({
        title: 'Open ports updated',
        description: `Found ${tcpCount} TCP and ${udpCount} UDP open port(s).`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to scan open ports',
        description: parseProxyApiErrorMessage(error),
        variant: 'destructive',
      })
    },
  })

  const scanOpenPorts = useCallback(async () => {
    if (!canScanOpenPorts) {
      toast({
        title: 'Cannot scan open ports',
        description:
          'No stored Ansible connection settings for this server. Add the server again or restore credentials.',
        variant: 'destructive',
      })
      return
    }
    await scanMutation.mutateAsync()
  }, [canScanOpenPorts, scanMutation, toast])

  return useMemo(
    () => ({
      scanOpenPorts,
      isScanning: scanMutation.isPending,
      canScanOpenPorts,
    }),
    [scanOpenPorts, scanMutation.isPending, canScanOpenPorts]
  )
}
