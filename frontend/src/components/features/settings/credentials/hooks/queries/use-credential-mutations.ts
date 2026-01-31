import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type {
  CredentialCreatePayload,
  CredentialUpdatePayload,
} from '../../types'
import { useMemo } from 'react'

export function useCredentialMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Create credential
  const createCredential = useMutation({
    mutationFn: async (data: CredentialCreatePayload) => {
      const response = await apiCall('credentials', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all })
      toast({
        title: 'Success',
        description: 'Credential created successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message.includes('400')
          ? 'Invalid credential data. Please check your inputs.'
          : `Failed to create credential: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Update credential
  const updateCredential = useMutation({
    mutationFn: async (data: CredentialUpdatePayload) => {
      const { id, ...payload } = data
      const response = await apiCall(`credentials/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all })
      toast({
        title: 'Success',
        description: 'Credential updated successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message.includes('400')
          ? 'Invalid credential data. Please check your inputs.'
          : `Failed to update credential: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Delete credential
  const deleteCredential = useMutation({
    mutationFn: async (id: number) => {
      await apiCall(`credentials/${id}`, {
        method: 'DELETE'
      })
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all })
      toast({
        title: 'Success',
        description: 'Credential deleted successfully',
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
    createCredential,
    updateCredential,
    deleteCredential,
  }), [createCredential, updateCredential, deleteCredential])
}
