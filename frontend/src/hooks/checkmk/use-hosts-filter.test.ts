import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHostsFilter } from './use-hosts-filter'
import type { CheckMKHost, FilterOptions } from '@/types/checkmk/types'

// Mock data for testing
const mockHosts: CheckMKHost[] = [
  {
    host_name: 'server-01',
    folder: '/prod',
    attributes: {},
  },
  {
    host_name: 'server-02',
    folder: '/dev',
    attributes: {},
  },
  {
    host_name: 'database-01',
    folder: '/prod',
    attributes: {},
  },
  {
    host_name: 'web-01',
    folder: '/staging',
    attributes: {},
  },
]

const mockFilterOptions: FilterOptions = {
  folders: new Set(['/prod', '/dev', '/staging']),
  labels: new Set(),
}

describe('useHostsFilter', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useHostsFilter(mockHosts, mockFilterOptions))

    expect(result.current.filteredHosts).toEqual(mockHosts)
    expect(result.current.hostNameFilter).toBe('')
    expect(result.current.folderFilter).toBe('')
    expect(result.current.sortColumn).toBe('')
    expect(result.current.sortOrder).toBe('none')
    expect(result.current.activeFiltersCount).toBe(0)
  })

  it('should filter hosts by name', () => {
    const { result } = renderHook(() => useHostsFilter(mockHosts, mockFilterOptions))

    act(() => {
      result.current.setHostNameFilter('server')
    })

    expect(result.current.filteredHosts).toHaveLength(2)
    expect(result.current.filteredHosts[0].host_name).toBe('server-01')
    expect(result.current.filteredHosts[1].host_name).toBe('server-02')
  })

  it('should filter hosts by name case-insensitively', () => {
    const { result } = renderHook(() => useHostsFilter(mockHosts, mockFilterOptions))

    act(() => {
      result.current.setHostNameFilter('SERVER')
    })

    expect(result.current.filteredHosts).toHaveLength(2)
    expect(result.current.filteredHosts[0].host_name).toBe('server-01')
  })

  it('should filter hosts by folder', () => {
    const { result } = renderHook(() => useHostsFilter(mockHosts, mockFilterOptions))

    act(() => {
      result.current.setFolderFilters({ '/prod': true, '/dev': false, '/staging': false })
    })

    expect(result.current.filteredHosts).toHaveLength(2)
    expect(result.current.filteredHosts.every(h => h.folder === '/prod')).toBe(true)
  })

  it('should sort hosts by name ascending', () => {
    const { result } = renderHook(() => useHostsFilter(mockHosts, mockFilterOptions))

    act(() => {
      result.current.handleSort('name')
    })

    expect(result.current.sortOrder).toBe('asc')
    expect(result.current.filteredHosts[0].host_name).toBe('database-01')
    expect(result.current.filteredHosts[3].host_name).toBe('web-01')
  })

  it('should sort hosts by name descending', () => {
    const { result } = renderHook(() => useHostsFilter(mockHosts, mockFilterOptions))

    // First click: asc
    act(() => {
      result.current.handleSort('name')
    })

    // Second click: desc
    act(() => {
      result.current.handleSort('name')
    })

    expect(result.current.sortOrder).toBe('desc')
    expect(result.current.filteredHosts[0].host_name).toBe('web-01')
    expect(result.current.filteredHosts[3].host_name).toBe('database-01')
  })

  it('should toggle sort order: none -> asc -> desc -> none', () => {
    const { result } = renderHook(() => useHostsFilter(mockHosts, mockFilterOptions))

    // First click: asc
    act(() => {
      result.current.handleSort('name')
    })
    expect(result.current.sortOrder).toBe('asc')

    // Second click: desc
    act(() => {
      result.current.handleSort('name')
    })
    expect(result.current.sortOrder).toBe('desc')

    // Third click: none
    act(() => {
      result.current.handleSort('name')
    })
    expect(result.current.sortOrder).toBe('none')
  })

  it('should reset filters', () => {
    const onPageReset = vi.fn()
    const { result } = renderHook(() =>
      useHostsFilter(mockHosts, mockFilterOptions, onPageReset)
    )

    // Set some filters
    act(() => {
      result.current.setHostNameFilter('server')
      result.current.setFolderFilter('/prod')
      result.current.handleSort('name')
    })

    // Reset
    act(() => {
      result.current.resetFilters()
    })

    expect(result.current.hostNameFilter).toBe('')
    expect(result.current.folderFilter).toBe('')
    expect(result.current.sortColumn).toBe('')
    expect(result.current.sortOrder).toBe('none')
    expect(onPageReset).toHaveBeenCalled()
  })

  it('should combine multiple filters', () => {
    const { result } = renderHook(() => useHostsFilter(mockHosts, mockFilterOptions))

    act(() => {
      result.current.setHostNameFilter('server')
      result.current.setFolderFilters({ '/prod': true, '/dev': false, '/staging': false })
    })

    expect(result.current.filteredHosts).toHaveLength(1)
    expect(result.current.filteredHosts[0].host_name).toBe('server-01')
    expect(result.current.filteredHosts[0].folder).toBe('/prod')
  })

  it('should count active filters correctly', () => {
    const { result } = renderHook(() => useHostsFilter(mockHosts, mockFilterOptions))

    // No filters
    expect(result.current.activeFiltersCount).toBe(0)

    // Add host name filter
    act(() => {
      result.current.setHostNameFilter('server')
    })
    expect(result.current.activeFiltersCount).toBe(1)

    // Add folder filter
    act(() => {
      result.current.setFolderFilter('/prod')
    })
    expect(result.current.activeFiltersCount).toBe(2)
  })

  it('should handle empty host list', () => {
    const { result } = renderHook(() => useHostsFilter([], mockFilterOptions))

    expect(result.current.filteredHosts).toEqual([])

    act(() => {
      result.current.setHostNameFilter('test')
    })

    expect(result.current.filteredHosts).toEqual([])
  })

  it('should sort by folder', () => {
    const { result } = renderHook(() => useHostsFilter(mockHosts, mockFilterOptions))

    act(() => {
      result.current.handleSort('folder')
    })

    expect(result.current.sortOrder).toBe('asc')
    expect(result.current.filteredHosts[0].folder).toBe('/dev')
    expect(result.current.filteredHosts[3].folder).toBe('/staging')
  })
})
