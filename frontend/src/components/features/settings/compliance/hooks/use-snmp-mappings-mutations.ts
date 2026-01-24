import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { SNMPMappingFormData, ImportResponse, ApiResponse } from '../types'
import { useMemo } from 'react'

export function useSnmpMappingsMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  /**
   * Create a new SNMP mapping
   */
  const createMapping = useMutation({
    mutationFn: async (data: SNMPMappingFormData) => {
      return apiCall('settings/compliance/snmp-mappings', {
        method: 'POST',
        body: JSON.stringify({ ...data, is_active: true }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.complianceSettings.snmpMappings(),
      })
      toast({
        title: 'Success',
        description: 'SNMP mapping created successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create SNMP mapping',
        variant: 'destructive',
      })
    },
  })

  /**
   * Update an existing SNMP mapping
   */
  const updateMapping = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: Partial<SNMPMappingFormData>
    }) => {
      // Remove empty password fields for update
      const { snmp_v3_auth_password, snmp_v3_priv_password, ...rest } = data
      const payload = {
        ...rest,
        ...(snmp_v3_auth_password ? { snmp_v3_auth_password } : {}),
        ...(snmp_v3_priv_password ? { snmp_v3_priv_password } : {}),
      }

      return apiCall(`settings/compliance/snmp-mappings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.complianceSettings.snmpMappings(),
      })
      toast({
        title: 'Success',
        description: 'SNMP mapping updated successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update SNMP mapping',
        variant: 'destructive',
      })
    },
  })

  /**
   * Delete an SNMP mapping
   */
  const deleteMapping = useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`settings/compliance/snmp-mappings/${id}`, {
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.complianceSettings.snmpMappings(),
      })
      toast({
        title: 'Success',
        description: 'SNMP mapping deleted successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete SNMP mapping',
        variant: 'destructive',
      })
    },
  })

  /**
   * Import SNMP mappings from YAML content
   */
  const importFromYaml = useMutation({
    mutationFn: async (yamlContent: string) => {
      const response = (await apiCall('settings/compliance/snmp-mappings/import', {
        method: 'POST',
        body: { yaml_content: yamlContent },
      })) as ApiResponse<ImportResponse> & { message?: string }

      if (response.success) {
        return response
      }

      throw new Error('Failed to import SNMP mappings')
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.complianceSettings.snmpMappings(),
      })
      const message =
        response.message ||
        `Successfully imported ${response.data?.imported || 0} SNMP mappings`
      toast({
        title: 'Success',
        description: message,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to import SNMP mappings',
        variant: 'destructive',
      })
    },
  })

  // Memoize return object to prevent re-renders
  return useMemo(
    () => ({
      createMapping,
      updateMapping,
      deleteMapping,
      importFromYaml,
    }),
    [createMapping, updateMapping, deleteMapping, importFromYaml]
  )
}
