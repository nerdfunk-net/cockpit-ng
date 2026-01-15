import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { FileDiffResponse } from '@/components/features/network/configs/view/types'

interface UseFileDiffQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseFileDiffQueryOptions = { enabled: false }

export function useFileDiffQuery(
  repoId: number | null,
  commit1: string | null,
  commit2: string | null,
  filePath: string | null,
  options: UseFileDiffQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled } = options

  return useQuery({
    queryKey: queryKeys.git.fileDiff(repoId, commit1, commit2, filePath),
    queryFn: async () => {
      if (!repoId || !commit1 || !commit2 || !filePath) {
        throw new Error('Missing required parameters')
      }
      return apiCall<FileDiffResponse>(`git/${repoId}/diff`, {
        method: 'POST',
        body: JSON.stringify({ commit1, commit2, file_path: filePath })
      })
    },
    enabled: enabled && !!repoId && !!commit1 && !!commit2 && !!filePath,
    staleTime: 5 * 60 * 1000, // 5 minutes (diffs don't change)
  })
}
