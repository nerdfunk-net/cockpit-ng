import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { GitTreeNode } from '@/components/features/network/configs/view/types'

interface UseGitTreeQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseGitTreeQueryOptions = { enabled: true }

export function useGitTreeQuery(
  repoId: number | null,
  options: UseGitTreeQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled } = options

  return useQuery({
    queryKey: queryKeys.git.tree(repoId),
    queryFn: async () => {
      if (!repoId) throw new Error('Repository ID required')
      return apiCall<GitTreeNode>(`git/${repoId}/tree`)
    },
    enabled: enabled && !!repoId,
    staleTime: 5 * 60 * 1000, // 5 minutes (tree structure changes rarely)
  })
}
