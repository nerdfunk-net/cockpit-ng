import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface UseFileContentQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseFileContentQueryOptions = { enabled: false }

export function useFileContentQuery(
  repoId: number | null,
  filePath: string | null,
  options: UseFileContentQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled } = options

  return useQuery({
    queryKey: queryKeys.git.fileContent(repoId, filePath),
    queryFn: async () => {
      if (!repoId || !filePath) {
        throw new Error('Missing required parameters')
      }

      // The proxy returns JSON-encoded text content
      return apiCall<string>(`git/${repoId}/file-content?path=${encodeURIComponent(filePath)}`, {
        method: 'GET',
        headers: { Accept: 'text/plain' },
      })
    },
    enabled: enabled && !!repoId && !!filePath,
    staleTime: 60 * 1000, // 1 minute
  })
}
