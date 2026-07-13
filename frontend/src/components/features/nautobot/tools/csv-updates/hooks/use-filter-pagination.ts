import { useState, useCallback, useMemo } from 'react'
import type { PaginationState } from '../types'
import { DEFAULT_FILTER_PAGE_SIZE } from '../constants'

/** Client-side pagination for the Filter step's row table (0-indexed page). */
export function useFilterPagination(totalItems: number) {
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_FILTER_PAGE_SIZE)

  const pagination = useMemo((): PaginationState => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    return {
      currentPage: Math.min(currentPage, totalPages - 1),
      pageSize,
      totalItems,
      totalPages,
    }
  }, [currentPage, pageSize, totalItems])

  const currentPageItems = useCallback(
    <T,>(items: T[]): T[] => {
      const startIndex = pagination.currentPage * pagination.pageSize
      return items.slice(startIndex, startIndex + pagination.pageSize)
    },
    [pagination.currentPage, pagination.pageSize]
  )

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage)
  }, [])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(0)
  }, [])

  const resetPage = useCallback(() => setCurrentPage(0), [])

  return useMemo(
    () => ({
      pagination,
      currentPageItems,
      handlePageChange,
      handlePageSizeChange,
      resetPage,
    }),
    [pagination, currentPageItems, handlePageChange, handlePageSizeChange, resetPage]
  )
}
