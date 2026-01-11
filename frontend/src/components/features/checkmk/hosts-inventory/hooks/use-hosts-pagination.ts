import { useState, useCallback, useMemo } from 'react'
import type { CheckMKHost } from '@/types/checkmk/types'

interface UseHostsPaginationReturn {
  currentPage: number
  pageSize: number
  totalPages: number
  paginatedHosts: CheckMKHost[]
  handlePageChange: (newPage: number) => void
  setPageSize: React.Dispatch<React.SetStateAction<number>>
  resetPage: () => void
}

export function useHostsPagination(filteredHosts: CheckMKHost[]): UseHostsPaginationReturn {
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  const totalPages = Math.max(1, Math.ceil(filteredHosts.length / pageSize))

  const paginatedHosts = useMemo(() => {
    const start = currentPage * pageSize
    const end = start + pageSize
    return filteredHosts.slice(start, end)
  }, [currentPage, pageSize, filteredHosts])

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage)
  }, [])

  const resetPage = useCallback(() => {
    setCurrentPage(0)
  }, [])

  return {
    currentPage,
    pageSize,
    totalPages,
    paginatedHosts,
    handlePageChange,
    setPageSize,
    resetPage,
  }
}
