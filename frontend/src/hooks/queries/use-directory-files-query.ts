import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { DirectoryFilesResponse } from '@/components/features/network/configs/view/types'

interface UseDirectoryFilesQueryOptions {
  path?: string
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseDirectoryFilesQueryOptions = { path: '', enabled: true }

export function useDirectoryFilesQuery(
  repoId: number | null,
  options: UseDirectoryFilesQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { path = '', enabled } = options

  return useQuery({
    queryKey: queryKeys.git.directoryFiles(repoId, path),
    queryFn: async () => {
      if (!repoId) throw new Error('Repository ID required')
      const url = path
        ? `git/${repoId}/directory?path=${encodeURIComponent(path)}`
        : `git/${repoId}/directory`
      return apiCall<DirectoryFilesResponse>(url)
    },
    enabled: enabled && !!repoId,
    staleTime: 30 * 1000, // 30 seconds (files may change frequently)
  })
}
