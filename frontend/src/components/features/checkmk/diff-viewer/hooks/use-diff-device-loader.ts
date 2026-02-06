import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { startDiffTask } from '../api/diff-viewer.api'
import { useAuthStore } from '@/lib/auth-store'
import type { DiffDevice, DiffTaskResult } from '@/types/features/checkmk/diff-viewer'
import type { CeleryTaskStatus } from '@/types/features/checkmk/sync-devices'

const EMPTY_ARRAY: DiffDevice[] = []

interface DiffTaskState {
  devices: DiffDevice[]
  totalNautobot: number
  totalCheckmk: number
  totalBoth: number
  loading: boolean
  error: string | null
  taskStatus: string | null
}

export function useDiffDeviceLoader() {
  const { apiCall } = useApi()
  const token = useAuthStore(state => state.token)
  const [state, setState] = useState<DiffTaskState>({
    devices: EMPTY_ARRAY,
    totalNautobot: 0,
    totalCheckmk: 0,
    totalBoth: 0,
    loading: false,
    error: null,
    taskStatus: null,
  })

  const pollTask = useCallback(async (taskId: string): Promise<DiffTaskResult | null> => {
    const maxAttempts = 120 // 4 minutes at 2s intervals
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const response = await apiCall<CeleryTaskStatus>(`celery/tasks/${taskId}`)
      if (!response) continue

      setState(prev => ({ ...prev, taskStatus: response.status }))

      if (response.status === 'SUCCESS') {
        const result = response.result as unknown as DiffTaskResult & { success?: boolean; error?: string }
        if (result && result.success !== false) {
          return result
        }
        throw new Error(result?.error || 'Task completed with errors')
      }

      if (response.status === 'FAILURE') {
        throw new Error(response.error || 'Task failed')
      }
    }
    throw new Error('Task timed out')
  }, [apiCall])

  const runDiff = useCallback(async () => {
    if (!token) return

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      taskStatus: 'PENDING',
    }))

    try {
      const { task_id } = await startDiffTask(token)
      const result = await pollTask(task_id)

      if (result) {
        setState({
          devices: result.all_devices || EMPTY_ARRAY,
          totalNautobot: result.total_nautobot || 0,
          totalCheckmk: result.total_checkmk || 0,
          totalBoth: result.total_both || 0,
          loading: false,
          error: null,
          taskStatus: 'SUCCESS',
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run diff'
      setState(prev => ({
        ...prev,
        loading: false,
        error: message,
        taskStatus: 'FAILURE',
      }))
    }
  }, [token, pollTask])

  return useMemo(() => ({
    devices: state.devices,
    totalNautobot: state.totalNautobot,
    totalCheckmk: state.totalCheckmk,
    totalBoth: state.totalBoth,
    loading: state.loading,
    error: state.error,
    taskStatus: state.taskStatus,
    runDiff,
  }), [state, runDiff])
}
