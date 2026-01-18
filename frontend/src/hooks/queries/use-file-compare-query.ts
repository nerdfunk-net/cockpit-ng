import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface FileCompareResponse {
  success: boolean
  left_lines: Array<{
    line_number: number | null
    content: string
    type: 'equal' | 'delete' | 'insert' | 'replace' | 'empty'
  }>
  right_lines: Array<{
    line_number: number | null
    content: string
    type: 'equal' | 'delete' | 'insert' | 'replace' | 'empty'
  }>
  diff: string
  left_file: string
  right_file: string
}

interface UseFileCompareQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseFileCompareQueryOptions = { enabled: false }

export function useFileCompareQuery(
  repoId: number | null,
  filePath1: string | null,
  filePath2: string | null,
  options: UseFileCompareQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled } = options

  return useQuery({
    queryKey: queryKeys.git.fileCompare(repoId, filePath1, filePath2),
    queryFn: async () => {
      if (!repoId || !filePath1 || !filePath2) {
        throw new Error('Missing required parameters')
      }
      return apiCall<FileCompareResponse>('file-compare/compare', {
        method: 'POST',
        body: JSON.stringify({
          repo_id: repoId,
          left_file: filePath1,
          right_file: filePath2
        })
      })
    },
    enabled: enabled && !!repoId && !!filePath1 && !!filePath2,
    staleTime: 5 * 60 * 1000, // 5 minutes (comparisons don't change)
  })
}
