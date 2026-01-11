/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/display-name */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useSavedInventories } from './use-saved-inventories'
import { useApi } from '@/hooks/use-api'
import type { ConditionTree } from '@/types/shared/device-selector'
import * as savedInventoriesQueries from '@/hooks/queries/use-saved-inventories-queries'

// Mock dependencies
vi.mock('@/hooks/use-api')
vi.mock('@/hooks/queries/use-saved-inventories-queries')

const mockInventories = [
  {
    id: 1,
    name: 'Production Routers',
    description: 'All production routers',
    conditions: [],
    scope: 'global',
    created_by: 'admin',
    created_at: '2024-01-01',
    updated_at: '2024-01-01'
  },
  {
    id: 2,
    name: 'Test Switches',
    description: 'Test environment switches',
    conditions: [],
    scope: 'private',
    created_by: 'user1',
    created_at: '2024-01-02',
    updated_at: '2024-01-02'
  }
]

const mockConditionTree: ConditionTree = {
  type: 'root',
  internalLogic: 'AND',
  items: [
    { id: '1', field: 'device_type', operator: 'equals', value: 'Router' }
  ]
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useSavedInventories', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks for queries
    vi.mocked(savedInventoriesQueries.useSavedInventoriesQuery).mockReturnValue({
      data: { inventories: mockInventories, total: 2 },
      isLoading: false,
      refetch: vi.fn()
    } as any)

    vi.mocked(savedInventoriesQueries.useSaveInventoryMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true })
    } as any)

    vi.mocked(savedInventoriesQueries.useUpdateInventoryMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true })
    } as any)

    vi.mocked(savedInventoriesQueries.useDeleteInventoryMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true })
    } as any)

    // Mock useApi
    vi.mocked(useApi).mockReturnValue({
      apiCall: vi.fn().mockResolvedValue({
        conditions: [{
          version: 2,
          tree: mockConditionTree
        }]
      }),
      isLoading: false,
      error: null
    } as ReturnType<typeof useApi>)
  })

  describe('initialization', () => {
    it('should load saved inventories', () => {
      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      expect(result.current.savedInventories).toEqual(mockInventories)
      expect(result.current.isLoadingInventories).toBe(false)
    })
  })

  describe('loadSavedInventories', () => {
    it('should trigger refetch', async () => {
      const refetchMock = vi.fn()
      vi.mocked(savedInventoriesQueries.useSavedInventoriesQuery).mockReturnValue({
        data: { inventories: mockInventories, total: 2 },
        isLoading: false,
        refetch: refetchMock
      } as any)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      await act(async () => {
        await result.current.loadSavedInventories()
      })

      expect(refetchMock).toHaveBeenCalled()
    })
  })

  describe('saveInventory', () => {
    it('should save new inventory with tree structure', async () => {
      const mutateSpy = vi.fn().mockResolvedValue({ success: true })
      vi.mocked(savedInventoriesQueries.useSaveInventoryMutation).mockReturnValue({
        mutateAsync: mutateSpy
      } as any)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      await act(async () => {
        await result.current.saveInventory(
          'My Inventory',
          'Test description',
          mockConditionTree
        )
      })

      expect(mutateSpy).toHaveBeenCalledWith({
        name: 'My Inventory',
        description: 'Test description',
        conditions: [{
          version: 2,
          tree: mockConditionTree
        }],
        scope: 'global'
      })
    })

    it('should update existing inventory', async () => {
      const mutateSpy = vi.fn().mockResolvedValue({ success: true })
      vi.mocked(savedInventoriesQueries.useUpdateInventoryMutation).mockReturnValue({
        mutateAsync: mutateSpy
      } as any)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      await act(async () => {
        await result.current.saveInventory(
          'Updated Inventory',
          'Updated description',
          mockConditionTree,
          true,
          1
        )
      })

      expect(mutateSpy).toHaveBeenCalledWith({
        id: 1,
        data: {
          description: 'Updated description',
          conditions: [{
            version: 2,
            tree: mockConditionTree
          }]
        }
      })
    })

    it('should handle empty description', async () => {
      const mutateSpy = vi.fn().mockResolvedValue({ success: true })
      vi.mocked(savedInventoriesQueries.useSaveInventoryMutation).mockReturnValue({
        mutateAsync: mutateSpy
      } as any)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      await act(async () => {
        await result.current.saveInventory(
          'My Inventory',
          '',
          mockConditionTree
        )
      })

      expect(mutateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          description: undefined
        })
      )
    })

    it('should track saving state', async () => {
      const mutateSpy = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      vi.mocked(savedInventoriesQueries.useSaveInventoryMutation).mockReturnValue({
        mutateAsync: mutateSpy
      } as any)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      expect(result.current.isSavingInventory).toBe(false)

      act(() => {
        result.current.saveInventory('Test', 'Desc', mockConditionTree)
      })

      expect(result.current.isSavingInventory).toBe(true)

      await waitFor(() => {
        expect(result.current.isSavingInventory).toBe(false)
      })
    })
  })

  describe('loadInventory', () => {
    it('should load inventory with tree structure (version 2)', async () => {
      const apiCallMock = vi.fn().mockResolvedValue({
        conditions: [{
          version: 2,
          tree: mockConditionTree
        }]
      })

      vi.mocked(useApi).mockReturnValue({
        apiCall: apiCallMock,
        isLoading: false,
        error: null
      } as ReturnType<typeof useApi>)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      let loadedTree: ConditionTree | null = null

      await act(async () => {
        loadedTree = await result.current.loadInventory('Production Routers')
      })

      expect(apiCallMock).toHaveBeenCalledWith('inventory/by-name/Production%20Routers')
      expect(loadedTree).toEqual(mockConditionTree)
    })

    it('should load legacy flat conditions and convert to tree', async () => {
      const legacyConditions = [
        { field: 'device_type', operator: 'equals', value: 'Router', logic: 'AND' },
        { field: 'role', operator: 'equals', value: 'Core', logic: 'AND' }
      ]

      const apiCallMock = vi.fn().mockResolvedValue({
        conditions: legacyConditions
      })

      vi.mocked(useApi).mockReturnValue({
        apiCall: apiCallMock,
        isLoading: false,
        error: null
      } as ReturnType<typeof useApi>)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      let loadedTree: ConditionTree | null = null

      await act(async () => {
        loadedTree = await result.current.loadInventory('Old Inventory')
      })

      expect(loadedTree).toBeDefined()
      expect(loadedTree!.type).toBe('root')
      expect(loadedTree!.items).toHaveLength(2)
      expect(loadedTree!.items[0]).toMatchObject({
        field: 'device_type',
        operator: 'equals',
        value: 'Router'
      })
    })

    it('should return null for empty conditions', async () => {
      const apiCallMock = vi.fn().mockResolvedValue({
        conditions: []
      })

      vi.mocked(useApi).mockReturnValue({
        apiCall: apiCallMock,
        isLoading: false,
        error: null
      } as ReturnType<typeof useApi>)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      let loadedTree: ConditionTree | null = null

      await act(async () => {
        loadedTree = await result.current.loadInventory('Empty Inventory')
      })

      expect(loadedTree).toBeNull()
    })

    it('should handle load errors', async () => {
      const apiCallMock = vi.fn().mockRejectedValue(new Error('Network error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(useApi).mockReturnValue({
        apiCall: apiCallMock,
        isLoading: false,
        error: null
      } as ReturnType<typeof useApi>)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      await expect(async () => {
        await act(async () => {
          await result.current.loadInventory('Broken Inventory')
        })
      }).rejects.toThrow('Network error')

      expect(consoleSpy).toHaveBeenCalledWith('Error loading inventory:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('updateInventoryDetails', () => {
    it('should update inventory name and description only', async () => {
      const mutateSpy = vi.fn().mockResolvedValue({ success: true })
      vi.mocked(savedInventoriesQueries.useUpdateInventoryMutation).mockReturnValue({
        mutateAsync: mutateSpy
      } as any)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      await act(async () => {
        await result.current.updateInventoryDetails(1, 'New Name', 'New Description')
      })

      expect(mutateSpy).toHaveBeenCalledWith({
        id: 1,
        data: {
          name: 'New Name',
          description: 'New Description'
        }
      })
    })

    it('should handle empty description when updating', async () => {
      const mutateSpy = vi.fn().mockResolvedValue({ success: true })
      vi.mocked(savedInventoriesQueries.useUpdateInventoryMutation).mockReturnValue({
        mutateAsync: mutateSpy
      } as any)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      await act(async () => {
        await result.current.updateInventoryDetails(1, 'New Name', '')
      })

      expect(mutateSpy).toHaveBeenCalledWith({
        id: 1,
        data: {
          name: 'New Name',
          description: undefined
        }
      })
    })
  })

  describe('deleteInventory', () => {
    it('should delete inventory by id', async () => {
      const mutateSpy = vi.fn().mockResolvedValue({ success: true })
      vi.mocked(savedInventoriesQueries.useDeleteInventoryMutation).mockReturnValue({
        mutateAsync: mutateSpy
      } as any)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      await act(async () => {
        await result.current.deleteInventory(1)
      })

      expect(mutateSpy).toHaveBeenCalledWith(1)
    })

    it('should handle delete errors', async () => {
      const mutateSpy = vi.fn().mockRejectedValue(new Error('Delete failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(savedInventoriesQueries.useDeleteInventoryMutation).mockReturnValue({
        mutateAsync: mutateSpy
      } as any)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      await expect(async () => {
        await act(async () => {
          await result.current.deleteInventory(1)
        })
      }).rejects.toThrow('Delete failed')

      expect(consoleSpy).toHaveBeenCalledWith('Error deleting inventory:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('flatConditionsToTree helper', () => {
    it('should convert flat conditions to tree structure', async () => {
      const flatConditions = [
        { field: 'device_type', operator: 'equals', value: 'Router', logic: 'AND' },
        { field: 'role', operator: 'equals', value: 'Core', logic: 'AND' }
      ]

      const apiCallMock = vi.fn().mockResolvedValue({
        conditions: flatConditions
      })

      vi.mocked(useApi).mockReturnValue({
        apiCall: apiCallMock,
        isLoading: false,
        error: null
      } as ReturnType<typeof useApi>)

      const { result } = renderHook(() => useSavedInventories(), {
        wrapper: createWrapper()
      })

      let tree: ConditionTree | null = null
      await act(async () => {
        tree = await result.current.loadInventory('Test')
      })
      
      expect(tree).toBeDefined()
      expect(tree!.type).toBe('root')
      expect(tree!.internalLogic).toBe('AND')
      expect(tree!.items).toHaveLength(2)
    })
  })
})
