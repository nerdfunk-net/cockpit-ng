import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import type { TableFilters } from '@/types/features/nautobot/offboard'

export function useUrlParams(
  filters: TableFilters,
  setFilters: (filters: TableFilters | ((prev: TableFilters) => TableFilters)) => void
) {
  const searchParams = useSearchParams()

  useEffect(() => {
    const ipFilter = searchParams?.get('ip_filter')
    if (ipFilter && ipFilter !== filters.ipAddress) {
      setFilters(prev => ({
        ...prev,
        ipAddress: ipFilter
      }))
    }
  }, [searchParams, filters.ipAddress, setFilters])

  return {
    ipFilter: searchParams?.get('ip_filter') || null
  }
}
