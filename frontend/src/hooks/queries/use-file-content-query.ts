import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/auth-store'
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
  const { token } = useAuthStore()
  const { enabled } = options

  return useQuery({
    queryKey: queryKeys.git.fileContent(repoId, filePath),
    queryFn: async () => {
      if (!repoId || !filePath) {
        throw new Error('Missing required parameters')
      }
      
      const headers: Record<string, string> = {
        'Accept': 'text/plain',
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`/api/proxy/git/${repoId}/file-content?path=${encodeURIComponent(filePath)}`, {
        headers,
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.statusText}`)
      }
      
      // The proxy returns JSON-encoded text, so parse it first
      return response.json()
    },
    enabled: enabled && !!repoId && !!filePath,
    staleTime: 60 * 1000, // 1 minute
  })
}
