import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { JobActionResponse, ClearHistoryResponse, JobSearchParams } from '../types'
import { useMemo } from 'react'

export function useJobMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Cancel job
  const cancelJob = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await apiCall<JobActionResponse>(`job-runs/${jobId}/cancel`, {
        method: 'POST'
      })
      // If apiCall succeeds (no exception), the HTTP status was successful
      return response
    },
    onSuccess: (data) => {
      // Invalidate job list to refresh
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.list() })
      toast({
        title: 'Job cancelled',
        description: data?.message || 'The job has been cancelled.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to cancel job',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Delete job
  const deleteJob = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await apiCall<JobActionResponse>(`job-runs/${jobId}`, {
        method: 'DELETE'
      })
      // If apiCall succeeds (no exception), the HTTP status was successful
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.list() })
      toast({
        title: 'Entry deleted',
        description: data?.message || 'The job run has been removed from history.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete entry',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Clear filtered history
  const clearFilteredHistory = useMutation({
    mutationFn: async (filters: JobSearchParams) => {
      // Build query params from filters
      const params = new URLSearchParams()

      if (filters.status) {
        const statusArr = Array.isArray(filters.status) ? filters.status : [filters.status]
        if (statusArr.length > 0) params.append('status', statusArr.join(','))
      }
      if (filters.job_type) {
        const typeArr = Array.isArray(filters.job_type) ? filters.job_type : [filters.job_type]
        if (typeArr.length > 0) params.append('job_type', typeArr.join(','))
      }
      if (filters.triggered_by) {
        const triggerArr = Array.isArray(filters.triggered_by) ? filters.triggered_by : [filters.triggered_by]
        if (triggerArr.length > 0) params.append('triggered_by', triggerArr.join(','))
      }
      if (filters.template_id) {
        const templateArr = Array.isArray(filters.template_id) ? filters.template_id : [filters.template_id]
        if (templateArr.length > 0) params.append('template_id', templateArr.join(','))
      }

      const queryString = params.toString()
      const endpoint = `job-runs/clear-filtered${queryString ? `?${queryString}` : ''}`

      const response = await apiCall<ClearHistoryResponse>(endpoint, {
        method: 'DELETE'
      })
      // If apiCall succeeds (no exception), the HTTP status was successful
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.list() })
      toast({
        title: 'History cleared',
        description: data?.message || `${data?.deleted_count || 0} job(s) cleared.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to clear history',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Clear all history
  const clearAllHistory = useMutation({
    mutationFn: async () => {
      const response = await apiCall<ClearHistoryResponse>('job-runs/clear-all', {
        method: 'DELETE'
      })
      // If apiCall succeeds (no exception), the HTTP status was successful
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all })
      toast({
        title: 'History cleared',
        description: data?.message || `All job history (${data?.deleted_count || 0} jobs) cleared.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to clear history',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    cancelJob,
    deleteJob,
    clearFilteredHistory,
    clearAllHistory,
  }), [cancelJob, deleteJob, clearFilteredHistory, clearAllHistory])
}
