import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { DefaultsApiResponse, DefaultsFields } from '../types/defaults-fields'

export function useServerDefaultsMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const saveDefaults = useMutation({
    mutationFn: async (defaults: DefaultsFields) => {
      const response = await apiCall<DefaultsApiResponse>('settings/server/defaults', {
        method: 'POST',
        body: JSON.stringify(defaults),
      })

      if (!response.success) {
        throw new Error(response.message || 'Failed to save server defaults')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.commonSettings.serverDefaults(),
      })
      toast({
        title: 'Success',
        description: 'Server defaults saved successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return useMemo(() => ({ saveDefaults }), [saveDefaults])
}
