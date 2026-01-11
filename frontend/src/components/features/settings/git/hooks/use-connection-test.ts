// Connection Test Hook - Manages connection testing state

import { useState, useCallback, useMemo } from 'react'
import { useGitMutations } from './queries/use-git-mutations'
import type { ConnectionTestValues } from '../validation'

export interface ConnectionTestHook {
  status: { type: 'success' | 'error'; text: string } | null
  isLoading: boolean
  testConnection: (data: ConnectionTestValues) => Promise<void>
  clearStatus: () => void
}

export function useConnectionTest(): ConnectionTestHook {
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { testConnection: testConnectionMutation } = useGitMutations()

  const testConnection = useCallback(async (data: ConnectionTestValues) => {
    setIsLoading(true)
    setStatus(null)

    try {
      const response = await testConnectionMutation.mutateAsync(data)
      setStatus({
        type: response.success ? 'success' : 'error',
        text: response.message,
      })
    } catch {
      setStatus({
        type: 'error',
        text: 'Connection test failed',
      })
    } finally {
      setIsLoading(false)
    }
  }, [testConnectionMutation])

  const clearStatus = useCallback(() => {
    setStatus(null)
  }, [])

  return useMemo(() => ({
    status,
    isLoading,
    testConnection,
    clearStatus,
  }), [status, isLoading, testConnection, clearStatus])
}
