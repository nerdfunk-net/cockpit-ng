import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type {
  NautobotSettings,
  NautobotDefaults,
  DeviceOffboardingSettings,
  ApiResponse,
  TestConnectionResponse,
} from '../types'
import { useMemo } from 'react'

export function useNautobotMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  /**
   * Save Nautobot connection settings
   */
  const saveSettings = useMutation({
    mutationFn: async (settings: NautobotSettings) => {
      const response = await apiCall<ApiResponse<NautobotSettings>>('settings/nautobot', {
        method: 'POST',
        body: JSON.stringify(settings),
      })

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

  /**
   * Test Nautobot connection
   */
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

  /**
   * Save Nautobot defaults
   */
  const saveDefaults = useMutation({
    mutationFn: async (defaults: NautobotDefaults) => {
      const response = await apiCall<ApiResponse<NautobotDefaults>>('settings/nautobot/defaults', {
        method: 'POST',
        body: JSON.stringify(defaults),
      })

      if (!response.success) {
        throw new Error(response.message || 'Failed to save defaults')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nautobotSettings.defaults() })
      toast({
        title: 'Success',
        description: 'Nautobot defaults saved successfully!',
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

  /**
   * Save device offboarding settings
   */
  const saveOffboarding = useMutation({
    mutationFn: async (settings: DeviceOffboardingSettings) => {
      const response = await apiCall<ApiResponse<DeviceOffboardingSettings>>('settings/offboarding', {
        method: 'POST',
        body: JSON.stringify(settings),
      })

      if (!response.success) {
        throw new Error(response.message || 'Failed to save offboarding settings')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nautobotSettings.offboarding() })
      toast({
        title: 'Success',
        description: 'Device offboarding settings saved successfully!',
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

  // Memoize return object to prevent re-renders
  return useMemo(
    () => ({
      saveSettings,
      testConnection,
      saveDefaults,
      saveOffboarding,
    }),
    [saveSettings, testConnection, saveDefaults, saveOffboarding]
  )
}
