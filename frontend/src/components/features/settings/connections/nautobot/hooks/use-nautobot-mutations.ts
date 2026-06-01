import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { NautobotSettings, ApiResponse, TestConnectionResponse } from '../types'

export function useNautobotMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const saveSettings = useMutation({
    mutationFn: async (settings: NautobotSettings) => {
      const response = await apiCall<ApiResponse<NautobotSettings>>(
        'settings/nautobot',
        {
          method: 'POST',
          body: JSON.stringify(settings),
        }
      )

      if (!response.success) {
        throw new Error(response.message || 'Failed to save settings')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nautobotSettings.settings() })
      toast({
        title: 'Success',
        description: 'Nautobot settings saved successfully!',
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

  const testConnection = useMutation({
    mutationFn: async (settings: NautobotSettings) => {
      const response = await apiCall<TestConnectionResponse>('settings/test/nautobot', {
        method: 'POST',
        body: JSON.stringify(settings),
      })

      if (!response.success) {
        throw new Error(response.message || 'Connection failed')
      }

      return response
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Connection successful!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Connection Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return useMemo(
    () => ({
      saveSettings,
      testConnection,
    }),
    [saveSettings, testConnection]
  )
}
