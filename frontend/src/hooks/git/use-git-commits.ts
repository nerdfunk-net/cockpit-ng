/**
 * Custom hook for loading Git commits
 * Handles loading commits for a specific branch in a repository
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { Commit } from '@/types/git'

export function useGitCommits(repoId: number | null, branch: string) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { apiCall } = useApi()
  
  // Use ref to avoid recreating loadCommits when apiCall changes
  const apiCallRef = useRef(apiCall)
  apiCallRef.current = apiCall

  const loadCommits = useCallback(async () => {
    if (!repoId || !branch) {
      setCommits([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      console.log('Loading commits for branch:', branch, 'in repo:', repoId)
      const response = await apiCallRef.current<Commit[]>(
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
  }, [repoId, branch])

  // Load commits when repository or branch changes
  useEffect(() => {
    loadCommits()
  }, [repoId, branch, loadCommits])

  // Memoize the return object to ensure stable reference
  return useMemo(() => ({
    commits,
    loading,
    error,
    reload: loadCommits
  }), [commits, loading, error, loadCommits])
}
