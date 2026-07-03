'use client'

import { useCallback, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'
import { parseProxyApiErrorMessage } from '@/lib/parse-proxy-api-error'
import { describeServerFactsChanges } from '../utils/describe-server-facts-changes'
import type { ServerResponse } from '../types'

export function useRefreshServerFacts(server: ServerResponse) {
  const { apiCall } = useApi()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canRefreshFacts = Boolean(server.ansible_credentials?.agent_id)

  const refreshMutation = useMutation({
    mutationFn: async (): Promise<ServerResponse> =>
      apiCall<ServerResponse>(`servers/${server.id}/refresh-facts`, {
        method: 'POST',
      }),
    onSuccess: updated => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers.all })
      queryClient.setQueryData(queryKeys.servers.detail(updated.id), updated)

      const changes = describeServerFactsChanges(server, updated)
      if (changes.length > 0) {
        toast({
          title: 'Facts updated',
          description: changes.join('\n'),
        })
      } else {
        toast({
          title: 'Facts refreshed',
          description: 'No changes detected compared to the previous data.',
        })
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to gather facts',
        description: parseProxyApiErrorMessage(error),
        variant: 'destructive',
      })
    },
  })

  const refreshFacts = useCallback(async () => {
    if (!canRefreshFacts) {
      toast({
        title: 'Cannot gather facts',
        description:
          'No stored Ansible connection settings for this server. Add the server again or restore credentials.',
        variant: 'destructive',
      })
      return
    }
    await refreshMutation.mutateAsync()
  }, [canRefreshFacts, refreshMutation, toast])

  return useMemo(
    () => ({
      refreshFacts,
      isRefreshing: refreshMutation.isPending,
      canRefreshFacts,
    }),
    [refreshFacts, refreshMutation.isPending, canRefreshFacts]
  )
}
