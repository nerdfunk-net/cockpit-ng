import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'

interface PendingChange {
  id: string
  user_id: string
  action_name: string
  text: string
  time: string
}

interface PendingChangesResponse {
  success: boolean
  message: string
  data: {
    links: Array<{
      domainType: string
      rel: string
      href: string
      method: string
      type: string
    }>
    domainType: string
    value: PendingChange[]
    etag: string
  }
}

interface ActivateChangesResponse {
  success: boolean
  message: string
  data: {
    links: Array<{
      domainType: string
      rel: string
      href: string
      method: string
      type: string
    }>
    domainType: string
    id: string
    title: string
    members: Record<string, unknown>
    extensions: {
      sites: string[]
      is_running: boolean
      force_foreign_changes: boolean
      time_started: string
      changes: Array<{
        id: string
        user_id: string
        action_name: string
        text: string
        time: string
      }>
    }
  }
}

interface ActivationStatusResponse {
  success: boolean
  message: string
  data: {
    links: Array<{
      domainType: string
      rel: string
      href: string
      method: string
      type: string
    }>
    domainType: string
    id: string
    title: string
    members: Record<string, unknown>
    extensions: {
      sites: string[]
      is_running: boolean
      force_foreign_changes: boolean
      time_started: string
      changes: Array<{
        id: string
        user_id: string
        action_name: string
        text: string
        time: string
      }>
      status_per_site?: Array<{
        site: string
        phase: string
        state: string
        status_text: string
        status_details: string
        start_time: string
        end_time: string
      }>
    }
  }
}

/**
 * Hook for fetching pending CheckMK changes
 *
 * Returns list of pending configuration changes with their ETag.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useCheckmkPendingChangesQuery()
 *
 * const changes = data?.data.value || []
 * const etag = data?.data.etag
 * ```
 */
export function useCheckmkPendingChangesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.checkmk.pendingChanges(),

    queryFn: async () => {
      return apiCall<PendingChangesResponse>('checkmk/changes/pending')
    },

    // Don't cache pending changes - always fetch fresh data
    staleTime: 0,
    gcTime: 0,
  })
}

/**
 * Hook for fetching activation status
 *
 * Polls the activation status endpoint to track progress.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useCheckmkActivationStatusQuery(activationId, { enabled: !!activationId })
 * ```
 */
export function useCheckmkActivationStatusQuery(activationId: string | null, options?: { enabled?: boolean }) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.checkmk.activationStatus(activationId || ''),

    queryFn: async () => {
      if (!activationId) throw new Error('No activation ID provided')
      return apiCall<ActivationStatusResponse>(`checkmk/activation/${activationId}`)
    },

    enabled: options?.enabled ?? !!activationId,
    refetchInterval: (query) => {
      // Poll every 2 seconds while activation is running
      const isRunning = query.state.data?.data?.extensions?.is_running
      return isRunning ? 2000 : false
    },
    staleTime: 0,
  })
}

/**
 * Hook for CheckMK changes mutations
 *
 * Provides mutations for activating changes.
 *
 * @example
 * ```tsx
 * const { activateAllChanges, activateChangesWithEtag } = useCheckmkChangesMutations()
 *
 * // Activate all changes
 * activateAllChanges.mutate()
 *
 * // Activate with specific ETag
 * activateChangesWithEtag.mutate({ etag: '...' })
 * ```
 */
export function useCheckmkChangesMutations(onActivationStart?: (activationId: string) => void) {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const activateAllChanges = useMutation({
    mutationFn: async (): Promise<ActivateChangesResponse> => {
      return apiCall('checkmk/changes/activate', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    },
    onSuccess: (data) => {
      // Invalidate pending changes to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.checkmk.pendingChanges() })

      toast({
        title: 'Success',
        description: 'Activation started',
      })

      // Notify parent component of activation ID
      if (onActivationStart && data.data.id) {
        onActivationStart(data.data.id)
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to activate changes',
        variant: 'destructive',
      })
    },
  })

  const activateChangesWithEtag = useMutation({
    mutationFn: async ({ etag }: { etag: string }): Promise<ActivateChangesResponse> => {
      return apiCall(`checkmk/changes/activate/${etag}`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    },
    onSuccess: (data) => {
      // Invalidate pending changes to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.checkmk.pendingChanges() })

      toast({
        title: 'Success',
        description: 'Activation started',
      })

      // Notify parent component of activation ID
      if (onActivationStart && data.data.id) {
        onActivationStart(data.data.id)
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to activate changes',
        variant: 'destructive',
      })
    },
  })

  return {
    activateAllChanges,
    activateChangesWithEtag,
  }
}

export type { PendingChange, PendingChangesResponse, ActivateChangesResponse, ActivationStatusResponse }
