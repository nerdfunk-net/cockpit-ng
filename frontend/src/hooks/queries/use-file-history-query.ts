import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { FileHistoryResponse } from '@/components/features/network/configs/view/types'

interface UseFileHistoryQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseFileHistoryQueryOptions = { enabled: false }

export function useFileHistoryQuery(
  repoId: number | null,
  filePath: string | null,
  options: UseFileHistoryQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled } = options

  return useQuery({
    queryKey: queryKeys.git.fileHistory(repoId, filePath),
    queryFn: async () => {
      if (!repoId || !filePath) {
        throw new Error('Missing required parameters')
      }
      return apiCall<FileHistoryResponse>(
        `git/${repoId}/files/${filePath}/complete-history`
      )
    },
    enabled: enabled && !!repoId && !!filePath,
    staleTime: 5 * 60 * 1000, // 5 minutes (history doesn't change often)
  })
}
