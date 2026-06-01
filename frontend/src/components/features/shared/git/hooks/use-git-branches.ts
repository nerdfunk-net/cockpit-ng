/**
 * Custom hook for managing Git branches
 * Handles loading branches for a repository and auto-selecting current branch
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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

  const apiCallRef = useRef(apiCall)
  useEffect(() => {
    apiCallRef.current = apiCall
  }, [apiCall])

  const loadBranches = useCallback(async () => {
    if (!repoId) {
      setBranches([])
      setSelectedBranch('')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await apiCallRef.current<Branch[]>(`git/${repoId}/branches`)
      setBranches(response)
    } catch (err) {
      console.error('Error loading branches:', err)
      setError('Failed to load branches')
    } finally {
      setLoading(false)
    }
  }, [repoId])

  // Load branches when repository changes
  useEffect(() => {
    loadBranches()
  }, [repoId, loadBranches])

  const handleBranchChange = useCallback(
    (branch: string) => {
      setSelectedBranch(branch)
      if (onBranchChange) {
        onBranchChange(branch)
      }
    },
    [onBranchChange]
  )

  // Memoize the return object to ensure stable reference
  return useMemo(
    () => ({
      branches,
      selectedBranch,
      setSelectedBranch: handleBranchChange,
      loading,
      error,
      reload: loadBranches,
    }),
    [branches, selectedBranch, handleBranchChange, loading, error, loadBranches]
  )
}
