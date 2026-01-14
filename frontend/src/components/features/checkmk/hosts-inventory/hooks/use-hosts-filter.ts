import { useState, useCallback, useMemo } from 'react'
import type { CheckMKHost, FilterOptions } from '@/types/checkmk/types'

interface UseHostsFilterReturn {
  filteredHosts: CheckMKHost[]
  hostNameFilter: string
  folderFilter: string
  folderFilters: Record<string, boolean>
  sortColumn: string
  sortOrder: 'asc' | 'desc' | 'none'
  activeFiltersCount: number
  setHostNameFilter: React.Dispatch<React.SetStateAction<string>>
  setFolderFilter: React.Dispatch<React.SetStateAction<string>>
  setFolderFilters: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  setSortColumn: React.Dispatch<React.SetStateAction<string>>
  setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc' | 'none'>>
  handleSort: (column: string) => void
  resetFilters: () => void
}

export function useHostsFilter(
  hosts: CheckMKHost[],
  filterOptions: FilterOptions,
  onPageReset?: () => void
): UseHostsFilterReturn {
  const [hostNameFilter, setHostNameFilter] = useState('')
  const [folderFilter, setFolderFilter] = useState('')
  const [folderFilters, setFolderFilters] = useState<Record<string, boolean>>(() => {
    // Initialize with all folders selected by default
    const initialFilters: Record<string, boolean> = {}
    filterOptions.folders.forEach(folder => {
      initialFilters[folder] = true
    })
    return initialFilters
  })
  const [sortColumn, setSortColumn] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none')

  // Compute filtered hosts as a derived value using useMemo
  const filteredHosts = useMemo(() => {
    let filtered = hosts.filter(host => {
      // Host name filter
      if (hostNameFilter) {
        const hostName = (host.host_name || '').toLowerCase()
        if (!hostName.includes(hostNameFilter.toLowerCase())) {
          return false
        }
      }

      // Multi-select folder filter (checkbox-based)
      if (Object.keys(folderFilters).length > 0) {
        const hostFolder = host.folder || ''
        if (!(hostFolder in folderFilters)) return true
        if (!folderFilters[hostFolder]) return false
      }

      return true
    })

    // Apply sorting
    if (sortColumn && sortOrder !== 'none') {
      filtered = filtered.slice().sort((a, b) => {
        let aVal: string, bVal: string

        switch (sortColumn) {
          case 'name':
            aVal = a.host_name || ''
            bVal = b.host_name || ''
            break
          case 'folder':
            aVal = a.folder || ''
            bVal = b.folder || ''
            break
          default:
            return 0
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [hosts, hostNameFilter, folderFilters, sortColumn, sortOrder])

  const resetFilters = useCallback(() => {
    setHostNameFilter('')
    setFolderFilter('')
    setSortColumn('')
    setSortOrder('none')
    if (onPageReset) {
      onPageReset()
    }

    // Reset folder filters to all selected
    const resetFolderFilters: Record<string, boolean> = {}
    filterOptions.folders.forEach(folder => {
      resetFolderFilters[folder] = true
    })
    setFolderFilters(resetFolderFilters)
  }, [filterOptions.folders, onPageReset])

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      // Toggle through: none -> asc -> desc -> none
      const nextOrder: Record<string, 'asc' | 'desc' | 'none'> = {
        'none': 'asc',
        'asc': 'desc',
        'desc': 'none',
      }
      const newOrder = nextOrder[sortOrder]
      if (newOrder !== undefined) {
        setSortOrder(newOrder)
      }
    } else {
      setSortColumn(column)
      setSortOrder('asc')
    }
  }, [sortColumn, sortOrder])

  // Calculate active filters count
  const activeFiltersCount = [
    hostNameFilter,
    folderFilter
  ].filter(Boolean).length +
  (Object.keys(folderFilters).length > 0 && Object.values(folderFilters).filter(Boolean).length < filterOptions.folders.size ? 1 : 0)

  return {
    filteredHosts,
    hostNameFilter,
    folderFilter,
    folderFilters,
    sortColumn,
    sortOrder,
    activeFiltersCount,
    setHostNameFilter,
    setFolderFilter,
    setFolderFilters,
    setSortColumn,
    setSortOrder,
    handleSort,
    resetFilters,
  }
}
