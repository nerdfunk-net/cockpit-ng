import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { ValidationResponse, SaveResponse } from '../types'
import { SNMP_FILE_NAME } from '../utils/constants'
import { useMemo } from 'react'

export function useSnmpMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  /**
   * Validate YAML content
   */
  const validateYaml = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiCall<ValidationResponse>('config/validate', {
        method: 'POST',
        body: JSON.stringify({ content })
      })

      if (!response.success || !response.valid) {
        throw {
          message: response.message || 'Invalid YAML',
          error: response.error,
          line: response.line,
          column: response.column,
        }
      }

      return response
    },
    onSuccess: () => {
      toast({
        title: 'Validation Successful',
        description: `${SNMP_FILE_NAME} is valid YAML`,
      })
    },
    onError: (error: unknown) => {
      // Error will be handled by component (show dialog)
      console.error('YAML validation error:', error)
    }
  })

  /**
   * Save SNMP mapping YAML content
   */
  const saveMapping = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiCall<SaveResponse>(`config/${SNMP_FILE_NAME}`, {
        method: 'POST',
        body: JSON.stringify({ content })
      })

      if (!response.success) {
        throw new Error(response.message || `Failed to save ${SNMP_FILE_NAME}`)
      }

      return response
    },
    onSuccess: () => {
      // Invalidate cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.commonSettings.snmpMapping() })

      toast({
        title: 'Success',
        description: `${SNMP_FILE_NAME} saved successfully`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    validateYaml,
    saveMapping,
  }), [validateYaml, saveMapping])
}
