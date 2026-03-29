import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface GitRepository {
  id: number
  name: string
  category: string
  url: string
  branch: string
  auth_type?: string
  credential_name?: string
  path?: string
  verify_ssl: boolean
  git_author_name?: string
  git_author_email?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  last_sync?: string
  sync_status?: string
}

interface GitRepositoriesResponse {
  repositories: GitRepository[]
}

interface UseGitRepositoriesQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseGitRepositoriesQueryOptions = {}

/**
 * Hook for fetching Git repositories using TanStack Query
 *
 * Provides automatic caching, refetching, and loading states for Git repositories.
 * Repositories are used for device configs, templates, Agents, etc.
 *
 * @param options.enabled - Whether to enable the query (default: true)
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useGitRepositoriesQuery()
 *
 * const repositories = data?.repositories || []
 * ```
 */
export function useGitRepositoriesQuery(options: UseGitRepositoriesQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.git.repositories(),

    queryFn: async () => {
      return apiCall<GitRepositoriesResponse>('git-repositories', { method: 'GET' })
    },

    // Only run if enabled
    enabled,

    // Cache for 30 seconds (repositories don't change frequently)
    staleTime: 30 * 1000,

    // Keep in cache for 5 minutes
    gcTime: 5 * 60 * 1000,
  })
}

// Export types
export type { GitRepository, GitRepositoriesResponse }
