import { useMutation } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { useMemo } from 'react'
import type {
  ConfigContentSearchRequest,
  ConfigContentSearchResponse,
} from '@/components/features/network/configs/search/types'

interface SearchVariables {
  repoId: number
  request: ConfigContentSearchRequest
}

export function useConfigContentSearchMutation() {
  const { apiCall } = useApi()
  const { toast } = useToast()

  const mutation = useMutation({
    mutationFn: async ({ repoId, request }: SearchVariables) => {
      return apiCall<ConfigContentSearchResponse>(
        `git/${repoId}/files/content-search`,
        {
          method: 'POST',
          body: request,
        }
      )
    },
    onError: (error: Error) => {
      toast({
        title: 'Search failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return useMemo(
    () => ({
      search: mutation.mutate,
      searchAsync: mutation.mutateAsync,
      data: mutation.data,
      isSearching: mutation.isPending,
      error: mutation.error,
      reset: mutation.reset,
    }),
    [
      mutation.mutate,
      mutation.mutateAsync,
      mutation.data,
      mutation.isPending,
      mutation.error,
      mutation.reset,
    ]
  )
}
