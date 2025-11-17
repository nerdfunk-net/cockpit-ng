/**
 * Custom hook for managing Git branches
 * Handles loading branches for a repository and auto-selecting current branch
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { Branch } from '@/types/git'

interface UseGitBranchesOptions {
  onBranchChange?: (branch: string) => void
}

const EMPTY_OPTIONS: UseGitBranchesOptions = {}

export function useGitBranches(
  repoId: number | null,
  options: UseGitBranchesOptions = EMPTY_OPTIONS
) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { apiCall } = useApi()
  const { onBranchChange } = options

  const loadBranches = useCallback(async () => {
    if (!repoId) {
      setBranches([])
      setSelectedBranch('')
      return
    }

    setLoading(true)
    setError(null)
    try {
      console.log('Loading branches for repo:', repoId)
      const response = await apiCall<Branch[]>(`git/${repoId}/branches`)
      console.log('Branches loaded:', response)
      setBranches(response)

      // Auto-select the current branch if available
      const currentBranch = response.find(branch => branch.current)
      if (currentBranch) {
        console.log('Auto-selecting current branch:', currentBranch.name)
        setSelectedBranch(currentBranch.name)
        if (onBranchChange) {
          onBranchChange(currentBranch.name)
        }
      }
    } catch (err) {
      console.error('Error loading branches:', err)
      setError('Failed to load branches')
    } finally {
      setLoading(false)
    }
  }, [repoId, apiCall, onBranchChange])

  // Load branches when repository changes
  useEffect(() => {
    loadBranches()
  }, [loadBranches])

  const handleBranchChange = useCallback((branch: string) => {
    setSelectedBranch(branch)
    if (onBranchChange) {
      onBranchChange(branch)
    }
  }, [onBranchChange])

  return useMemo(() => ({
    branches,
    selectedBranch,
    setSelectedBranch: handleBranchChange,
    loading,
    error,
    reload: loadBranches
  }), [branches, selectedBranch, handleBranchChange, loading, error, loadBranches])
}
