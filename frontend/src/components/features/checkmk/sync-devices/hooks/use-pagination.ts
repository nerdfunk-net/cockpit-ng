import { useState, useMemo, useCallback } from 'react'

/**
 * Hook for managing pagination state and logic
 */
export function usePagination<T>(items: T[], initialPageSize = 25) {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(initialPageSize)

  const totalPages = useMemo(() => Math.ceil(items.length / itemsPerPage), [items.length, itemsPerPage])
  const startIndex = useMemo(() => (currentPage - 1) * itemsPerPage, [currentPage, itemsPerPage])
  const endIndex = useMemo(() => startIndex + itemsPerPage, [startIndex, itemsPerPage])
  const currentItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex])

  const handlePageSizeChange = useCallback((newSize: string) => {
    setItemsPerPage(parseInt(newSize))
    setCurrentPage(1)
  }, [])

  const resetToFirstPage = useCallback(() => {
    setCurrentPage(1)
  }, [])

  return {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    currentItems,
    startIndex,
    endIndex,
    handlePageSizeChange,
    resetToFirstPage
  }
}
