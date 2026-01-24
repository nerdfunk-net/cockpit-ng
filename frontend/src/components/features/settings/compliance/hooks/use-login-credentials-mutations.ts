import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { LoginCredentialFormData } from '../types'
import { useMemo } from 'react'

export function useLoginCredentialsMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  /**
   * Create a new login credential
   */
  const createCredential = useMutation({
    mutationFn: async (data: LoginCredentialFormData) => {
      return apiCall('settings/compliance/login-credentials', {
        method: 'POST',
        body: JSON.stringify({ ...data, is_active: true }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.complianceSettings.loginCredentials(),
      })
      toast({
        title: 'Success',
        description: 'Login credential created successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create login credential',
        variant: 'destructive',
      })
    },
  })

  /**
   * Update an existing login credential
   */
  const updateCredential = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: Partial<LoginCredentialFormData>
    }) => {
      // Remove empty password field for update
      const payload = {
        ...data,
        ...(data.password ? {} : { password: undefined }),
      }

      return apiCall(`settings/compliance/login-credentials/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.complianceSettings.loginCredentials(),
      })
      toast({
        title: 'Success',
        description: 'Login credential updated successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update login credential',
        variant: 'destructive',
      })
    },
  })

  /**
   * Delete a login credential
   */
  const deleteCredential = useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`settings/compliance/login-credentials/${id}`, {
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.complianceSettings.loginCredentials(),
      })
      toast({
        title: 'Success',
        description: 'Login credential deleted successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete login credential',
        variant: 'destructive',
      })
    },
  })

  // Memoize return object to prevent re-renders
  return useMemo(
    () => ({
      createCredential,
      updateCredential,
      deleteCredential,
    }),
    [createCredential, updateCredential, deleteCredential]
  )
}
