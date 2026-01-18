import { useState, useMemo, useCallback } from 'react'
import type { Device, TableFilters, PaginationState } from '../types'
import { filterDevices, extractFilterOptions } from '../utils'

const DEFAULT_FILTERS: TableFilters = {
  deviceName: '',
  role: 'all',
  location: 'all',
  ipAddress: '',
  status: 'all',
}

const DEFAULT_PAGE_SIZE = 50

export function useDevicesFilter(devices: Device[]) {
  const [filters, setFilters] = useState<TableFilters>(DEFAULT_FILTERS)
  // Store user modifications to role filters (null means use defaults)
  const [userRoleFilters, setUserRoleFilters] = useState<Record<string, boolean> | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // Extract filter options from devices
  const filterOptions = useMemo(() => extractFilterOptions(devices), [devices])

  // Compute effective role filters: user overrides or default (all selected)
  const roleFilters = useMemo(() => {
    if (userRoleFilters !== null) {
      return userRoleFilters
    }
    // Default: all roles selected
    const defaults: Record<string, boolean> = {}
    filterOptions.roles.forEach((role) => {
      defaults[role.name] = true
    })
    return defaults
  }, [userRoleFilters, filterOptions.roles])

  // Apply filters
  const filteredDevices = useMemo(
    () => filterDevices(devices, filters, roleFilters),
    [devices, filters, roleFilters]
  )

  // Pagination calculations
  const totalPages = Math.ceil(filteredDevices.length / pageSize)

  const paginatedDevices = useMemo(() => {
    const start = currentPage * pageSize
    return filteredDevices.slice(start, start + pageSize)
  }, [filteredDevices, currentPage, pageSize])

  const pagination: PaginationState = useMemo(
    () => ({
      currentPage,
      pageSize,
      totalItems: filteredDevices.length,
      totalPages,
    }),
    [currentPage, pageSize, filteredDevices.length, totalPages]
  )

  // Reset to first page when filters change
  const handleFilterChange = useCallback(
    (field: keyof TableFilters, value: string) => {
      setFilters((prev) => ({ ...prev, [field]: value }))
      setCurrentPage(0)
    },
    []
  )

  const handleRoleFiltersChange = useCallback((newRoleFilters: Record<string, boolean>) => {
    setUserRoleFilters(newRoleFilters)
    setCurrentPage(0)
  }, [])

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    // Reset to defaults (all roles selected)
    setUserRoleFilters(null)
    setCurrentPage(0)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(0)
  }, [])

  return useMemo(
    () => ({
      filters,
      roleFilters,
      setRoleFilters: handleRoleFiltersChange,
      filterOptions,
      filteredDevices,
      paginatedDevices,
      pagination,
      handleFilterChange,
      clearAllFilters,
      setCurrentPage: handlePageChange,
      setPageSize: handlePageSizeChange,
    }),
    [
      filters,
      roleFilters,
      handleRoleFiltersChange,
      filterOptions,
      filteredDevices,
      paginatedDevices,
      pagination,
      handleFilterChange,
      clearAllFilters,
      handlePageChange,
      handlePageSizeChange,
    ]
  )
}
