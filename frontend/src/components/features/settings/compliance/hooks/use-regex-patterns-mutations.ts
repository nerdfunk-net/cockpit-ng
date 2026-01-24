import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { RegexPatternFormData } from '../types'
import { useMemo } from 'react'

export function useRegexPatternsMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  /**
   * Create a new regex pattern
   */
  const createPattern = useMutation({
    mutationFn: async (data: RegexPatternFormData) => {
      return apiCall('settings/compliance/regex-patterns', {
        method: 'POST',
        body: JSON.stringify({ ...data, is_active: true }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.complianceSettings.regexPatterns(),
      })
      toast({
        title: 'Success',
        description: 'Regex pattern created successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create regex pattern',
        variant: 'destructive',
      })
    },
  })

  /**
   * Update an existing regex pattern
   */
  const updatePattern = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: RegexPatternFormData
    }) => {
      return apiCall(`settings/compliance/regex-patterns/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.complianceSettings.regexPatterns(),
      })
      toast({
        title: 'Success',
        description: 'Regex pattern updated successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update regex pattern',
        variant: 'destructive',
      })
    },
  })

  /**
   * Delete a regex pattern
   */
  const deletePattern = useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`settings/compliance/regex-patterns/${id}`, {
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.complianceSettings.regexPatterns(),
      })
      toast({
        title: 'Success',
        description: 'Regex pattern deleted successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete regex pattern',
        variant: 'destructive',
      })
    },
  })

  // Memoize return object to prevent re-renders
  return useMemo(
    () => ({
      createPattern,
      updatePattern,
      deletePattern,
    }),
    [createPattern, updatePattern, deletePattern]
  )
}
