// Repository Debug Hook - Manages debug dialog state and operations

import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { GitRepository, DebugResult, DebugOperation } from '../types'

export interface RepositoryDebugHook {
  debugRepo: GitRepository | null
  debugResult: DebugResult | null
  debugTab: string
  isLoading: boolean
  showDialog: boolean
  openDialog: (repo: GitRepository) => void
  closeDialog: () => void
  setDebugTab: (tab: string) => void
  runOperation: (operation: DebugOperation) => Promise<void>
}

export function useRepositoryDebug(): RepositoryDebugHook {
  const { apiCall } = useApi()
  const [debugRepo, setDebugRepo] = useState<GitRepository | null>(null)
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null)
  const [debugTab, setDebugTab] = useState('diagnostics')
  const [showDialog, setShowDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const openDialog = useCallback((repo: GitRepository) => {
    setDebugRepo(repo)
    setDebugTab('diagnostics')
    setDebugResult(null)
    setShowDialog(true)
  }, [])

  const closeDialog = useCallback(() => {
    setShowDialog(false)
    setDebugRepo(null)
    setDebugResult(null)
  }, [])

  const runOperation = useCallback(async (operation: DebugOperation) => {
    if (!debugRepo) return

    setIsLoading(true)
    setDebugResult(null)

    try {
      const endpoint = operation === 'diagnostics'
        ? `git-repositories/${debugRepo.id}/debug/diagnostics`
        : `git-repositories/${debugRepo.id}/debug/${operation}`

      const method = operation === 'diagnostics' ? 'GET' : 'POST'

      const response = await apiCall(endpoint, { method })
      setDebugResult(response as DebugResult)
    } catch (error) {
      const err = error as Error
      setDebugResult({
        success: false,
        message: err.message || 'Debug operation failed',
        details: {
          error: err.message || 'Unknown error',
          error_type: 'FetchError',
        },
      })
    } finally {
      setIsLoading(false)
    }
  }, [debugRepo, apiCall])

  return useMemo(() => ({
    debugRepo,
    debugResult,
    debugTab,
    isLoading,
    showDialog,
    openDialog,
    closeDialog,
    setDebugTab,
    runOperation,
  }), [debugRepo, debugResult, debugTab, isLoading, showDialog, openDialog, closeDialog, runOperation])
}
