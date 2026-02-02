import { useState, useEffect, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { GitRepository } from '@/types/git'

interface RepositoriesResponse {
  repositories: GitRepository[]
}

const EMPTY_REPOSITORIES: GitRepository[] = []

export function useGitRepositorySelector() {
  const [repositories, setRepositories] = useState<GitRepository[]>(EMPTY_REPOSITORIES)
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const { apiCall } = useApi()

  useEffect(() => {
    const loadRepositories = async () => {
      try {
        const response = await apiCall<RepositoriesResponse>('git-repositories')
        const activeRepos = response.repositories.filter(r => r.is_active)
        setRepositories(activeRepos)

        // Auto-select first TIG-Stack category repo
        const tigRepo = activeRepos.find(r => r.category === 'tig-stack')
        if (tigRepo) {
          setSelectedRepoId(tigRepo.id)
        } else if (activeRepos.length > 0 && activeRepos[0]) {
          setSelectedRepoId(activeRepos[0].id)
        }
      } catch (error) {
        console.error('Failed to load git repositories:', error)
      } finally {
        setLoading(false)
      }
    }

    loadRepositories()
  }, [apiCall])

  const selectedRepository = useMemo(
    () => repositories.find(r => r.id === selectedRepoId) || null,
    [repositories, selectedRepoId]
  )

  return useMemo(() => ({
    repositories,
    selectedRepoId,
    selectedRepository,
    setSelectedRepoId,
    loading
  }), [repositories, selectedRepoId, selectedRepository, loading])
}
