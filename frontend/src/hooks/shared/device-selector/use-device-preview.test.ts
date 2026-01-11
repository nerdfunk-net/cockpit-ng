/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useDevicePreview } from './use-device-preview'
import type { ConditionTree, DeviceInfo } from '@/types/shared/device-selector'
import { createEmptyTree } from './use-condition-tree'
import * as devicePreviewMutation from '@/hooks/mutations/use-device-preview-mutation'

// Mock the mutation hook
vi.mock('@/hooks/mutations/use-device-preview-mutation')

const mockDevices: DeviceInfo[] = [
  {
    id: 'device-1',
    device_id: 'device-1',
    name: 'router-01',
    device_type: 'Router',
    role: 'Core',
    status: 'Active',
    manufacturer: 'Cisco'
  },
  {
    id: 'device-2',
    device_id: 'device-2',
    name: 'switch-01',
    device_type: 'Switch',
    role: 'Access',
    status: 'Active',
    manufacturer: 'Cisco'
  }
]

describe('useDevicePreview', () => {
  let conditionTree: ConditionTree
  let queryClient: QueryClient
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactElement

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create a fresh QueryClient for each test with gcTime set to prevent caching issues
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false, gcTime: 0 }
      },
      logger: {
        log: () => {},
        warn: () => {},
        error: () => {}
      }
    })
    
    // Create wrapper component
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)
    
    // Setup default mock for mutation - simple mock that doesn't trigger callbacks
    vi.mocked(devicePreviewMutation.useDevicePreviewMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      data: undefined,
      error: null,
      isIdle: true,
      isError: false,
      isSuccess: false,
      reset: vi.fn(),
      status: 'idle',
      variables: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0
    } as any)
    
    conditionTree = createEmptyTree()
    conditionTree.items = [{
      id: 'cond-1',
      field: 'device_type',
      operator: 'equals',
      value: 'Router'
    }]
  })
  
  afterEach(async () => {
    // Clear all query client caches and subscriptions
    queryClient.clear()
    await queryClient.cancelQueries()
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(
        () => useDevicePreview(conditionTree),
        { wrapper }
      )

      expect(result.current.previewDevices).toEqual([])
      expect(result.current.totalDevices).toBe(0)
      expect(result.current.operationsExecuted).toBe(0)
      expect(result.current.showPreviewResults).toBe(false)
      expect(result.current.isLoadingPreview).toBe(false)
      expect(result.current.selectedIds).toEqual(new Set())
      expect(result.current.currentPage).toBe(1)
      expect(result.current.pageSize).toBe(20)
    })

    it('should initialize with initial devices', () => {
      const { result } = renderHook(
        () => useDevicePreview(conditionTree, mockDevices),
        { wrapper }
      )

      expect(result.current.previewDevices).toEqual(mockDevices)
      expect(result.current.totalDevices).toBe(2)
      expect(result.current.showPreviewResults).toBe(true)
    })

    it('should initialize with selected device IDs', () => {
      const selectedIds = ['device-1']

      const { result } = renderHook(
        () => useDevicePreview(conditionTree, [], selectedIds),
        { wrapper }
      )

      expect(result.current.selectedIds).toEqual(new Set(['device-1']))
    })
  })

  describe('pagination', () => {
    it('should calculate total pages correctly', () => {
      const manyDevices = Array.from({ length: 45 }, (_, i) => ({
        ...mockDevices[0],
        id: `device-${i}`,
        device_id: `device-${i}`,
        name: `device-${i}`
      }))

      const { result } = renderHook(
        () => useDevicePreview(conditionTree, manyDevices),
        { wrapper }
      )

      expect(result.current.totalPages).toBe(3) // 45 devices / 20 per page = 3 pages
    })

    it('should paginate devices correctly', () => {
      const manyDevices = Array.from({ length: 25 }, (_, i) => ({
        ...mockDevices[0],
        id: `device-${i}`,
        device_id: `device-${i}`,
        name: `device-${i}`
      }))

      const { result } = renderHook(
        () => useDevicePreview(conditionTree, manyDevices),
        { wrapper }
      )

      // Page 1: devices 0-19
      expect(result.current.currentPageDevices).toHaveLength(20)
      expect(result.current.currentPageDevices[0].name).toBe('device-0')

      // Go to page 2
      act(() => {
        result.current.handlePageChange(2)
      })

      // Page 2: devices 20-24
      expect(result.current.currentPageDevices).toHaveLength(5)
      expect(result.current.currentPageDevices[0].name).toBe('device-20')
      expect(result.current.currentPage).toBe(2)
    })

    it('should change page size', () => {
      const manyDevices = Array.from({ length: 100 }, (_, i) => ({
        ...mockDevices[0],
        id: `device-${i}`,
        device_id: `device-${i}`,
        name: `device-${i}`
      }))

      const { result } = renderHook(
        () => useDevicePreview(conditionTree, manyDevices),
        { wrapper }
      )

      act(() => {
        result.current.setPageSize(50)
      })

      expect(result.current.totalPages).toBe(2) // 100 devices / 50 per page
      expect(result.current.currentPageDevices).toHaveLength(50)
    })
  })

  describe('selection', () => {
    it('should select all devices', () => {
      const { result } = renderHook(
        () => useDevicePreview(conditionTree, mockDevices),
        { wrapper }
      )

      act(() => {
        result.current.handleSelectAll(true)
      })

      expect(result.current.selectedIds.size).toBe(2)
      expect(result.current.selectedIds.has('device-1')).toBe(true)
      expect(result.current.selectedIds.has('device-2')).toBe(true)
    })

    it('should deselect all devices', () => {
      const { result } = renderHook(
        () => useDevicePreview(conditionTree, mockDevices, ['device-1', 'device-2']),
        { wrapper }
      )

      act(() => {
        result.current.handleSelectAll(false)
      })

      expect(result.current.selectedIds.size).toBe(0)
    })

    it('should select individual device', () => {
      const { result } = renderHook(
        () => useDevicePreview(conditionTree, mockDevices),
        { wrapper }
      )

      act(() => {
        result.current.handleSelectDevice('device-1', true)
      })

      expect(result.current.selectedIds.has('device-1')).toBe(true)
      expect(result.current.selectedIds.size).toBe(1)
    })

    it('should deselect individual device', () => {
      const { result } = renderHook(
        () => useDevicePreview(conditionTree, mockDevices, ['device-1', 'device-2']),
        { wrapper }
      )

      act(() => {
        result.current.handleSelectDevice('device-1', false)
      })

      expect(result.current.selectedIds.has('device-1')).toBe(false)
      expect(result.current.selectedIds.has('device-2')).toBe(true)
      expect(result.current.selectedIds.size).toBe(1)
    })

    it('should call onSelectionChange callback when selecting', () => {
      const onSelectionChange = vi.fn()

      const { result } = renderHook(
        () => useDevicePreview(conditionTree, mockDevices, [], undefined, onSelectionChange),
        { wrapper }
      )

      act(() => {
        result.current.handleSelectDevice('device-1', true)
      })

      expect(onSelectionChange).toHaveBeenCalledWith(
        ['device-1'],
        expect.arrayContaining([expect.objectContaining({ device_id: 'device-1' })])
      )
    })
  })

  describe('treeToFlatConditions', () => {
    it('should convert simple tree to flat conditions', () => {
      const tree: ConditionTree = {
        type: 'root',
        internalLogic: 'AND',
        items: [
          { id: '1', field: 'device_type', operator: 'equals', value: 'Router' },
          { id: '2', field: 'role', operator: 'equals', value: 'Core' }
        ]
      }

      const { result } = renderHook(
        () => useDevicePreview(tree),
        { wrapper }
      )

      const flatConditions = result.current.treeToFlatConditions(tree)

      expect(flatConditions).toHaveLength(2)
      expect(flatConditions[0]).toEqual({
        field: 'device_type',
        operator: 'equals',
        value: 'Router',
        logic: 'AND'
      })
      expect(flatConditions[1]).toEqual({
        field: 'role',
        operator: 'equals',
        value: 'Core',
        logic: 'AND'
      })
    })

    it('should handle nested groups', () => {
      const tree: ConditionTree = {
        type: 'root',
        internalLogic: 'AND',
        items: [
          { id: '1', field: 'device_type', operator: 'equals', value: 'Router' },
          {
            id: '2',
            type: 'group',
            internalLogic: 'OR',
            logic: 'AND',
            items: [
              { id: '3', field: 'status', operator: 'equals', value: 'Active' },
              { id: '4', field: 'status', operator: 'equals', value: 'Staged' }
            ]
          }
        ]
      }

      const { result } = renderHook(
        () => useDevicePreview(tree),
        { wrapper }
      )

      const flatConditions = result.current.treeToFlatConditions(tree)

      expect(flatConditions).toHaveLength(3)
      expect(flatConditions[0].field).toBe('device_type')
      expect(flatConditions[1].field).toBe('status')
      expect(flatConditions[1].logic).toBe('OR')
      expect(flatConditions[2].field).toBe('status')
      expect(flatConditions[2].logic).toBe('OR')
    })
  })

  describe('loadPreview', () => {
    it('should show alert when tree is empty', () => {
      const emptyTree = createEmptyTree()
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

      const { result } = renderHook(
        () => useDevicePreview(emptyTree),
        { wrapper }
      )

      act(() => {
        result.current.loadPreview()
      })

      expect(alertSpy).toHaveBeenCalledWith('Please add at least one condition.')
      alertSpy.mockRestore()
    })

    it('should call preview mutation with operations', () => {
      const mutateSpy = vi.fn()
      vi.mocked(devicePreviewMutation.useDevicePreviewMutation).mockReturnValue({
        mutate: mutateSpy,
        isPending: false,
        data: null,
        error: null
      } as any)

      const { result } = renderHook(
        () => useDevicePreview(conditionTree),
        { wrapper }
      )

      act(() => {
        result.current.loadPreview()
      })

      expect(mutateSpy).toHaveBeenCalledWith({
        operations: expect.arrayContaining([
          expect.objectContaining({
            operation_type: expect.any(String),
            conditions: expect.any(Array)
          })
        ])
      })
    })
  })

  describe('callbacks stability', () => {
    it.skip('should call onDevicesSelected with devices and flat conditions', async () => {
      const onDevicesSelected = vi.fn()

      // Mock mutation to return data so the useEffect triggers
      vi.mocked(devicePreviewMutation.useDevicePreviewMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isPending: false,
        data: {
          devices: mockDevices,
          total_count: 2,
          operations_executed: 1
        },
        error: null,
        isIdle: false,
        isError: false,
        isSuccess: true,
        reset: vi.fn(),
        status: 'success',
        variables: undefined,
        failureCount: 0,
        failureReason: null,
        isPaused: false,
        submittedAt: 0
      } as any)

      const { rerender } = renderHook(
        () => useDevicePreview(conditionTree, [], [], onDevicesSelected),
        { wrapper }
      )

      // Wait for the useEffect to process the data
      await waitFor(() => {
        expect(onDevicesSelected).toHaveBeenCalled()
      })

      // Verify callback was called with correct arguments
      expect(onDevicesSelected).toHaveBeenCalledWith(
        mockDevices,
        expect.arrayContaining([
          expect.objectContaining({
            field: 'device_type',
            operator: 'equals',
            value: 'Router'
          })
        ])
      )

      // Verify callback is stable across re-renders
      rerender()

      // Should not call again on re-render
      expect(onDevicesSelected).toHaveBeenCalledTimes(1)
    })
  })

  describe('state updates', () => {
    it('should update showPreviewResults', () => {
      const { result } = renderHook(
        () => useDevicePreview(conditionTree),
        { wrapper }
      )

      expect(result.current.showPreviewResults).toBe(false)

      act(() => {
        result.current.setShowPreviewResults(true)
      })

      expect(result.current.showPreviewResults).toBe(true)
    })

    it('should update currentPage', () => {
      const { result } = renderHook(
        () => useDevicePreview(conditionTree),
        { wrapper }
      )

      act(() => {
        result.current.setCurrentPage(3)
      })

      expect(result.current.currentPage).toBe(3)
    })

    it('should update selectedIds', () => {
      const { result } = renderHook(
        () => useDevicePreview(conditionTree),
        { wrapper }
      )

      const newIds = new Set(['device-1', 'device-2'])

      act(() => {
        result.current.setSelectedIds(newIds)
      })

      expect(result.current.selectedIds).toEqual(newIds)
    })
  })
})
