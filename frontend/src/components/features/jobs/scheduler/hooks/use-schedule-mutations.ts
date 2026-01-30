import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { JobSchedule, ScheduleFormData } from '../types'
import { useMemo } from 'react'

export function useScheduleMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Create schedule
  const createSchedule = useMutation({
    mutationFn: async (data: ScheduleFormData) => {
      return apiCall<JobSchedule>('api/job-schedules', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedules() })
      toast({
        title: 'Success',
        description: `Schedule "${data.job_identifier}" created successfully`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create schedule',
        variant: 'destructive'
      })
    }
  })

  // Update schedule
  const updateSchedule = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ScheduleFormData> }) => {
      return apiCall<JobSchedule>(`api/job-schedules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedules() })
      toast({
        title: 'Success',
        description: `Schedule "${data.job_identifier}" updated successfully`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update schedule',
        variant: 'destructive'
      })
    }
  })

  // Delete schedule
  const deleteSchedule = useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`api/job-schedules/${id}`, {
        method: 'DELETE'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedules() })
      toast({
        title: 'Success',
        description: 'Schedule deleted successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Failed to delete schedule',
        variant: 'destructive'
      })
    }
  })

  // Toggle active/inactive
  const toggleActive = useMutation({
    mutationFn: async (job: JobSchedule) => {
      return apiCall<JobSchedule>(`api/job-schedules/${job.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !job.is_active })
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedules() })
    },
    onError: (error: Error) => {
      toast({
        title: 'Toggle Failed',
        description: error.message || 'Failed to toggle schedule',
        variant: 'destructive'
      })
    }
  })

  // Run now
  const runNow = useMutation({
    mutationFn: async ({ id }: { id: number; identifier: string }) => {
      return apiCall(`job-runs/execute/${id}`, {
        method: 'POST'
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedules() })
      toast({
        title: 'Job Started',
        description: `Schedule "${variables.identifier}" has been queued for execution`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Execution Failed',
        description: error.message || 'Failed to start job execution',
        variant: 'destructive'
      })
    }
  })

  // Recalculate next runs
  const recalculateNextRuns = useMutation({
    mutationFn: async () => {
      return apiCall<{ message: string }>('api/job-schedules/debug/recalculate-next-runs', {
        method: 'POST'
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedules() })
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedulerDebug() })
      toast({
        title: 'Success',
        description: data.message || 'Next runs recalculated successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to recalculate next runs',
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleActive,
    runNow,
    recalculateNextRuns,
  }), [createSchedule, updateSchedule, deleteSchedule, toggleActive, runNow, recalculateNextRuns])
}
