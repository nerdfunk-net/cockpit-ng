import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { CelerySettings, CeleryActionResponse, PurgeQueueResponse, PurgeAllQueuesResponse } from '../types'
import { useMemo } from 'react'

export function useCeleryMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Save settings
  const saveSettings = useMutation({
    mutationFn: async (settings: CelerySettings) => {
      const response = await apiCall<CeleryActionResponse>('/api/celery/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to save settings')
      }
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.celery.settings() })
      toast({
        title: 'Success',
        description: data.message || 'Settings saved successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to save settings: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Trigger cleanup
  const triggerCleanup = useMutation({
    mutationFn: async () => {
      const response = await apiCall<CeleryActionResponse>('/api/celery/cleanup', {
        method: 'POST'
      })
      if (!response?.task_id) {
        throw new Error(response?.message || 'Failed to trigger cleanup')
      }
      return response
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: data.task_id ? `Cleanup task started: ${data.task_id}` : 'Cleanup started',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to trigger cleanup: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Submit test task
  const submitTestTask = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiCall<CeleryActionResponse>('/api/celery/test', {
        method: 'POST',
        body: JSON.stringify({ message })
      })
      if (!response?.task_id) {
        throw new Error('Failed to submit test task')
      }
      return response
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: `Test task submitted: ${data.task_id}`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to submit test task: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Purge queue
  const purgeQueue = useMutation({
    mutationFn: async (queueName: string) => {
      const response = await apiCall<PurgeQueueResponse>(`/api/celery/queues/${queueName}/purge`, {
        method: 'DELETE'
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to purge queue')
      }
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.celery.queues() })
      toast({
        title: 'Success',
        description: data.message || `Purged ${data.purged_tasks} task(s) from queue ${data.queue}`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to purge queue: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Purge all queues
  const purgeAllQueues = useMutation({
    mutationFn: async () => {
      const response = await apiCall<PurgeAllQueuesResponse>('/api/celery/queues/purge-all', {
        method: 'DELETE'
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to purge all queues')
      }
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.celery.queues() })
      toast({
        title: 'Success',
        description: data.message || `Purged ${data.total_purged} task(s) from all queues`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to purge all queues: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    saveSettings,
    triggerCleanup,
    submitTestTask,
    purgeQueue,
    purgeAllQueues,
  }), [saveSettings, triggerCleanup, submitTestTask, purgeQueue, purgeAllQueues])
}
