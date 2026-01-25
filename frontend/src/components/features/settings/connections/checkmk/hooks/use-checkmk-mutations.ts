import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type {
  CheckMKSettings,
  ValidationResponse,
  TestConnectionResponse,
  SaveYamlResponse,
  ApiResponse,
} from '../types'
import { useMemo } from 'react'

export function useCheckMKMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  /**
   * Save CheckMK connection settings
   */
  const saveSettings = useMutation({
    mutationFn: async (settings: CheckMKSettings) => {
      const response = await apiCall<ApiResponse<CheckMKSettings>>('settings/checkmk', {
        method: 'POST',
        body: JSON.stringify(settings),
      })

      if (!response.success) {
        throw new Error(response.message || 'Failed to save settings')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checkmkSettings.settings() })
      toast({
        title: 'Success',
        description: 'CheckMK settings saved successfully!',
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
   * Test CheckMK connection
   */
  const testConnection = useMutation({
    mutationFn: async (settings: CheckMKSettings) => {
      const response = await apiCall<TestConnectionResponse>('settings/test/checkmk', {
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
   * Validate YAML content
   */
  const validateYaml = useMutation({
    mutationFn: async ({ content, filename }: { content: string; filename: string }) => {
      const response = await apiCall<ValidationResponse>('config/validate', {
        method: 'POST',
        body: JSON.stringify({ content }),
      })

      if (!response.success || !response.valid) {
        throw {
          message: response.message || 'Invalid YAML',
          error: response.error,
          line: response.line,
          column: response.column,
          filename,
        }
      }

      return response
    },
    onSuccess: (_, variables) => {
      toast({
        title: 'Validation Successful',
        description: `${variables.filename} is valid YAML`,
      })
    },
    onError: (error: any) => {
      // Error will be handled by component (show dialog)
      console.error('YAML validation error:', error)
    },
  })

  /**
   * Save YAML file
   */
  const saveYaml = useMutation({
    mutationFn: async ({ filename, content }: { filename: string; content: string }) => {
      const response = await apiCall<SaveYamlResponse>(`config/${filename}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })

      if (!response.success) {
        throw new Error(response.message || `Failed to save ${filename}`)
      }

      return { filename, response }
    },
    onSuccess: ({ filename }) => {
      // Invalidate appropriate query based on filename
      if (filename === 'checkmk.yaml') {
        queryClient.invalidateQueries({ queryKey: queryKeys.checkmkSettings.checkmkYaml() })
      } else if (filename === 'checkmk_queries.yaml') {
        queryClient.invalidateQueries({ queryKey: queryKeys.checkmkSettings.queriesYaml() })
      }

      toast({
        title: 'Success',
        description: `${filename} saved successfully!`,
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
      validateYaml,
      saveYaml,
    }),
    [saveSettings, testConnection, validateYaml, saveYaml]
  )
}
