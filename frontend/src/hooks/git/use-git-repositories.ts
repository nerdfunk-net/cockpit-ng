/**
 * Custom hook for managing Git repositories
 * Handles loading, selecting, and managing repository state
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { GitRepository, RepositoriesResponse } from '@/types/git'

export function useGitRepositories() {
  const [repositories, setRepositories] = useState<GitRepository[]>([])
  const [selectedRepo, setSelectedRepo] = useState<GitRepository | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { apiCall } = useApi()
  
  // Use ref to avoid recreating loadRepositories when apiCall changes
  const apiCallRef = useRef(apiCall)
  apiCallRef.current = apiCall

  const loadRepositories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('Loading repositories...')
      const response = await apiCallRef.current<RepositoriesResponse>('git-repositories')
      console.log('Repositories loaded:', response)
      setRepositories(response.repositories || [])
    } catch (err) {
      console.error('Error loading repositories:', err)
      setError('Failed to load repositories')
    } finally {
      setLoading(false)
    }
  }, []) // Empty deps - use ref

  // Load repositories on mount - only run once
  useEffect(() => {
    loadRepositories()
  }, [loadRepositories])

  // Memoize the return object to ensure stable reference
  return useMemo(() => ({
    repositories,
    selectedRepo,
    setSelectedRepo,
    loading,
    error,
    reload: loadRepositories
  }), [repositories, selectedRepo, loading, error, loadRepositories])
}
