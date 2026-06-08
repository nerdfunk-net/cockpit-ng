import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface PasswordCredential {
  id: number
  name: string
  username: string
  type: string
}

/** @deprecated Use PasswordCredential */
export type SshCredential = PasswordCredential

const STALE_TIME = 5 * 60 * 1000
const EMPTY: PasswordCredential[] = []

interface Options {
  enabled?: boolean
}

const DEFAULT_OPTIONS: Options = {}

export function usePasswordCredentialsQuery(options: Options = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.credentials.list({ source: 'ssh' }),
    queryFn: async (): Promise<PasswordCredential[]> => {
      const response = await apiCall<PasswordCredential[]>(
        'credentials/?include_expired=false'
      )
      return (response ?? []).filter((c) => ['ssh', 'generic'].includes(c.type))
    },
    enabled,
    staleTime: STALE_TIME,
    placeholderData: EMPTY,
  })
}

/** @deprecated Use usePasswordCredentialsQuery */
export function useSshCredentialsQuery(options: Options = DEFAULT_OPTIONS) {
  return usePasswordCredentialsQuery(options)
}
