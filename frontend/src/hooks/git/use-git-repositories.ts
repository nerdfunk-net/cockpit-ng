/**
 * Custom hook for managing Git repositories
 * Handles loading, selecting, and managing repository state
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { GitRepository, RepositoriesResponse } from '@/types/git'

export function useGitRepositories() {
  const [repositories, setRepositories] = useState<GitRepository[]>([])
  const [selectedRepo, setSelectedRepo] = useState<GitRepository | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { apiCall } = useApi()

  const loadRepositories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('Loading repositories...')
      const response = await apiCall<RepositoriesResponse>('git-repositories')
      console.log('Repositories loaded:', response)
      setRepositories(response.repositories || [])

      // Auto-select the first active repository
      const activeRepos = response.repositories?.filter(repo => repo.is_active) || []
      if (activeRepos.length > 0 && activeRepos[0]) {
        console.log('Auto-selecting first active repository:', activeRepos[0].name)
        setSelectedRepo(activeRepos[0])
      }
    } catch (err) {
      console.error('Error loading repositories:', err)
      setError('Failed to load repositories')
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  // Load repositories on mount
  useEffect(() => {
    loadRepositories()
  }, [loadRepositories])

  return useMemo(() => ({
    repositories,
    selectedRepo,
    setSelectedRepo,
    loading,
    error,
    reload: loadRepositories
  }), [repositories, selectedRepo, loading, error, loadRepositories])
}
