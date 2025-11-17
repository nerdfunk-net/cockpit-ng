/**
 * Custom hook for loading Git commits
 * Handles loading commits for a specific branch in a repository
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { Commit } from '@/types/git'

export function useGitCommits(repoId: number | null, branch: string) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { apiCall } = useApi()

  const loadCommits = useCallback(async () => {
    if (!repoId || !branch) {
      setCommits([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      console.log('Loading commits for branch:', branch, 'in repo:', repoId)
      const response = await apiCall<Commit[]>(
        `git/${repoId}/commits/${encodeURIComponent(branch)}`
      )
      console.log('Commits loaded:', response.length, 'commits')
      setCommits(response)
    } catch (err) {
      console.error('Error loading commits:', err)
      setError('Failed to load commits')
      setCommits([])
    } finally {
      setLoading(false)
    }
  }, [repoId, branch, apiCall])

  // Load commits when repository or branch changes
  useEffect(() => {
    loadCommits()
  }, [loadCommits])

  return useMemo(() => ({
    commits,
    loading,
    error,
    reload: loadCommits
  }), [commits, loading, error, loadCommits])
}
