// Repository Status Hook - Manages status dialog state and data fetching

import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { GitRepository, GitStatus } from '../types'

export interface RepositoryStatusHook {
  statusData: GitStatus | null
  isLoading: boolean
  showDialog: boolean
  openDialog: (repo: GitRepository) => Promise<void>
  closeDialog: () => void
}

export function useRepositoryStatus(): RepositoryStatusHook {
  const { apiCall } = useApi()
  const [statusData, setStatusData] = useState<GitStatus | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const openDialog = useCallback(async (repo: GitRepository) => {
    setStatusData(null)
    setShowDialog(true)
    setIsLoading(true)

    try {
      const response = await apiCall<{ success: boolean; data: GitStatus }>(
        `git/${repo.id}/status`
      )
      if (response.success) {
        setStatusData(response.data)
      } else {
        throw new Error('Failed to load repository status')
      }
    } catch (error) {
      console.error('Failed to load repository status:', error)
      setShowDialog(false)
    } finally {
      setIsLoading(false)
    }
  }, [apiCall])

  const closeDialog = useCallback(() => {
    setShowDialog(false)
    setStatusData(null)
  }, [])

  return useMemo(() => ({
    statusData,
    isLoading,
    showDialog,
    openDialog,
    closeDialog,
  }), [statusData, isLoading, showDialog, openDialog, closeDialog])
}
