import { useState, useCallback, useMemo } from 'react'
import type { PaginationState } from '@/types/features/nautobot/offboard'

export function usePagination(totalItems: number, initialPageSize: number = 50) {
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)

  // Derive pagination state during render
  const pagination = useMemo((): PaginationState => {
    const totalPages = Math.ceil(totalItems / pageSize)
    return {
      currentPage: Math.min(currentPage, Math.max(0, totalPages - 1)),
      pageSize,
      totalItems,
      totalPages
    }
  }, [currentPage, pageSize, totalItems])

  const currentPageItems = useCallback(<T,>(items: T[]): T[] => {
    const startIndex = pagination.currentPage * pagination.pageSize
    const endIndex = startIndex + pagination.pageSize
    return items.slice(startIndex, endIndex)
  }, [pagination.currentPage, pagination.pageSize])

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage)
  }, [])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(0)
  }, [])

  return {
    pagination,
    currentPageItems,
    handlePageChange,
    handlePageSizeChange
  }
}
