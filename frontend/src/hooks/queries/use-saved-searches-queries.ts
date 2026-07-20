import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'

/** Server-persisted query shape (API format: no local ids, memtotal_mb in MB). */
interface SavedServerSearch {
  id: number
  name: string
  description?: string
  query: Record<string, unknown>
  scope: string
  group_path?: string | null
  created_by: string
  created_at?: string
  updated_at?: string
}

interface SavedServerSearchesResponse {
  searches: SavedServerSearch[]
  total: number
}

interface SaveSearchPayload {
  name: string
  description?: string
  query: unknown
  scope: string
  group_path?: string | null
}

interface UpdateSearchPayload {
  name?: string
  description?: string
  query?: unknown
  scope?: string
  group_path?: string | null
}

interface RenameSearchGroupPayload {
  old_path: string
  new_name: string
}

interface RenameSearchGroupResponse {
  updated_count: number
  new_path: string
}

const EMPTY_GROUPS: string[] = []

/**
 * Hook for fetching saved server searches.
 */
export function useSavedSearchesQuery(enabled = true) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.savedSearches.list(),

    queryFn: async () => {
      return apiCall<SavedServerSearchesResponse>('servers/saved-searches')
    },

    enabled,

    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

/**
 * Fetch all unique saved-search group paths for the group filter dropdown.
 */
export function useSavedSearchGroupsQuery(enabled = true) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.savedSearches.groups(),
    queryFn: async () => {
      const response = await apiCall<{ groups: string[] }>(
        'servers/saved-searches/get-all-groups',
        { method: 'GET' }
      )
      return response?.groups ?? EMPTY_GROUPS
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook for saving a new server search.
 */
export function useSaveSearchMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (payload: SaveSearchPayload) => {
      return apiCall<SavedServerSearch>('servers/saved-searches', {
        method: 'POST',
        body: payload,
      })
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches.groups() })

      toast({
        title: 'Success',
        description: 'Search saved successfully',
      })
    },

    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save search',
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook for updating an existing saved server search.
 */
export function useUpdateSearchMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateSearchPayload }) => {
      return apiCall<SavedServerSearch>(`servers/saved-searches/${id}`, {
        method: 'PUT',
        body: data,
      })
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches.groups() })

      toast({
        title: 'Success',
        description: 'Search updated successfully',
      })
    },

    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update search',
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook for deleting a saved server search.
 */
export function useDeleteSearchMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`servers/saved-searches/${id}`, {
        method: 'DELETE',
      })
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches.groups() })

      toast({
        title: 'Success',
        description: 'Search deleted successfully',
      })
    },

    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete search',
        variant: 'destructive',
      })
    },
  })
}

export function useRenameSearchGroupMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (
      payload: RenameSearchGroupPayload
    ): Promise<RenameSearchGroupResponse> => {
      return apiCall<RenameSearchGroupResponse>('servers/saved-searches/rename-group', {
        method: 'POST',
        body: payload,
      })
    },
    onSuccess: (data: RenameSearchGroupResponse) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches.groups() })
      toast({
        title: 'Success',
        description: `Group renamed (${data.updated_count} ${data.updated_count === 1 ? 'search' : 'searches'} updated)`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to rename group',
        variant: 'destructive',
      })
    },
  })
}

export type {
  SavedServerSearch,
  SavedServerSearchesResponse,
  SaveSearchPayload,
  UpdateSearchPayload,
  RenameSearchGroupPayload,
  RenameSearchGroupResponse,
}
