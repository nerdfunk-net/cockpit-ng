import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface SshCredential {
  id: number
  name: string
  username: string
  type: string
}

const STALE_TIME = 5 * 60 * 1000
const EMPTY: SshCredential[] = []

interface Options {
  enabled?: boolean
}

const DEFAULT_OPTIONS: Options = {}

export function useSshCredentialsQuery(options: Options = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.credentials.list({ source: 'ssh' }),
    queryFn: async (): Promise<SshCredential[]> => {
      const response = await apiCall<SshCredential[]>(
        'credentials/?include_expired=false'
      )
      return (response ?? []).filter((c) => c.type === 'ssh')
    },
    enabled,
    staleTime: STALE_TIME,
    placeholderData: EMPTY,
  })
}
