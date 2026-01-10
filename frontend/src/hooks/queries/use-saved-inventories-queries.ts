import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { LogicalCondition, BackendConditionsResponse } from '@/types/shared/device-selector'

interface SavedInventory {
  id: number
  name: string
  description?: string
  conditions: LogicalCondition[]
  scope: string
  created_by: string
  created_at?: string
  updated_at?: string
}

interface SavedInventoriesResponse {
  inventories: SavedInventory[]
  total: number
}

interface SaveInventoryPayload {
  name: string
  description?: string
  conditions: unknown[] // Tree structure wrapped in array
  scope: string
}

interface UpdateInventoryPayload {
  description?: string
  conditions?: unknown[] // Tree structure wrapped in array
  name?: string
}

/**
 * Hook for fetching saved inventories
 *
 * Returns list of all saved inventory configurations.
 *
 * @example
 * ```tsx
 * const { data, isLoading, refetch } = useSavedInventoriesQuery()
 *
 * const inventories = data?.inventories || []
 * ```
 */
export function useSavedInventoriesQuery(enabled = true) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.inventory.list(),

    queryFn: async () => {
      return apiCall<SavedInventoriesResponse>('inventory')
    },

    enabled,

    // Inventories can be cached for a short time
    staleTime: 60 * 1000,     // 1 minute
    gcTime: 5 * 60 * 1000,    // 5 minutes
  })
}

/**
 * Hook for loading a specific inventory by name
 *
 * Returns the condition tree for a saved inventory.
 *
 * @param inventoryName - Name of the inventory to load
 * @param enabled - Whether to enable the query
 *
 * @example
 * ```tsx
 * const { data: tree, isLoading } = useInventoryByNameQuery('production-servers')
 * ```
 */
export function useInventoryByNameQuery(inventoryName: string | null, enabled = false) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.inventory.byName(inventoryName || ''),

    queryFn: async () => {
      if (!inventoryName) return null

      return apiCall<BackendConditionsResponse>(`inventory/by-name/${encodeURIComponent(inventoryName)}`)
    },

    enabled: !!inventoryName && enabled,

    // Don't cache loaded inventories (user might edit)
    staleTime: 0,
  })
}

/**
 * Hook for saving a new inventory
 *
 * @example
 * ```tsx
 * const { mutate: saveInventory, isPending } = useSaveInventoryMutation()
 *
 * saveInventory({
 *   name: 'My Inventory',
 *   description: 'Production servers',
 *   conditions: [{ version: 2, tree: conditionTree }],
 *   scope: 'global'
 * })
 * ```
 */
export function useSaveInventoryMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (payload: SaveInventoryPayload) => {
      return apiCall('inventory', {
        method: 'POST',
        body: payload
      })
    },

    onSuccess: () => {
      // Invalidate inventories list to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.list() })

      toast({
        title: 'Success',
        description: 'Inventory saved successfully',
      })
    },

    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save inventory',
        variant: 'destructive'
      })
    }
  })
}

/**
 * Hook for updating an existing inventory
 *
 * @example
 * ```tsx
 * const { mutate: updateInventory } = useUpdateInventoryMutation()
 *
 * updateInventory({
 *   id: 123,
 *   data: {
 *     description: 'Updated description',
 *     conditions: [{ version: 2, tree: conditionTree }]
 *   }
 * })
 * ```
 */
export function useUpdateInventoryMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateInventoryPayload }) => {
      return apiCall(`inventory/${id}`, {
        method: 'PUT',
        body: data
      })
    },

    onSuccess: () => {
      // Invalidate inventories list to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.list() })

      toast({
        title: 'Success',
        description: 'Inventory updated successfully',
      })
    },

    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update inventory',
        variant: 'destructive'
      })
    }
  })
}

/**
 * Hook for deleting an inventory
 *
 * @example
 * ```tsx
 * const { mutate: deleteInventory } = useDeleteInventoryMutation()
 *
 * deleteInventory(123)
 * ```
 */
export function useDeleteInventoryMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`inventory/${id}`, {
        method: 'DELETE'
      })
    },

    onSuccess: () => {
      // Invalidate inventories list to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.list() })

      toast({
        title: 'Success',
        description: 'Inventory deleted successfully',
      })
    },

    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete inventory',
        variant: 'destructive'
      })
    }
  })
}

export type { SavedInventory, SavedInventoriesResponse, SaveInventoryPayload, UpdateInventoryPayload }
