import { useState, useCallback } from 'react'
import type { CheckMKHost } from '@/types/checkmk/types'

interface UseHostsSelectionReturn {
  selectedHosts: Set<string>
  handleSelectHost: (hostName: string, checked: boolean) => void
  handleSelectAll: (checked: boolean, paginatedHosts: CheckMKHost[]) => void
  clearSelection: () => void
}

const EMPTY_SET: Set<string> = new Set()

export function useHostsSelection(): UseHostsSelectionReturn {
  const [selectedHosts, setSelectedHosts] = useState<Set<string>>(EMPTY_SET)

  const handleSelectHost = useCallback((hostName: string, checked: boolean) => {
    setSelectedHosts(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(hostName)
      } else {
        newSet.delete(hostName)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback((checked: boolean, paginatedHosts: CheckMKHost[]) => {
    if (checked) {
      setSelectedHosts(new Set(paginatedHosts.map(host => host.host_name)))
    } else {
      setSelectedHosts(new Set())
    }
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedHosts(new Set())
  }, [])

  return {
    selectedHosts,
    handleSelectHost,
    handleSelectAll,
    clearSelection,
  }
}
