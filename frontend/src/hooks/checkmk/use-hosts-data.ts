import { useState, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'
import type { CheckMKHost, FilterOptions } from '@/types/checkmk/types'

// Types

interface UseHostsDataReturn {
  hosts: CheckMKHost[]
  loading: boolean
  error: string | null
  filterOptions: FilterOptions
  loadHosts: () => Promise<void>
  reloadHosts: () => void
  setFilterOptions: React.Dispatch<React.SetStateAction<FilterOptions>>
}

const EMPTY_FILTER_OPTIONS: FilterOptions = {
  folders: new Set(),
  labels: new Set(),
}

export function useHostsData(
  showMessage: (text: string, type: 'success' | 'error' | 'info') => void,
  onFilterOptionsChange?: (options: FilterOptions) => void
): UseHostsDataReturn {
  const { apiCall } = useApi()
  
  const [hosts, setHosts] = useState<CheckMKHost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(EMPTY_FILTER_OPTIONS)

  const loadHosts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiCall<{ hosts?: CheckMKHost[] }>('checkmk/hosts')

      if (response?.hosts) {
        const newHosts = response.hosts
        setHosts(newHosts)

        // Extract filter options
        const newFilterOptions: FilterOptions = {
          folders: new Set(),
          labels: new Set(),
        }

        newHosts.forEach((host: CheckMKHost) => {
          if (host.folder) newFilterOptions.folders.add(host.folder)
          if (host.labels) {
            Object.keys(host.labels).forEach(label => {
              newFilterOptions.labels.add(label)
            })
          }
        })

        setFilterOptions(newFilterOptions)
        
        // Notify parent of filter options change
        if (onFilterOptionsChange) {
          onFilterOptionsChange(newFilterOptions)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load hosts'
      setError(message)
      showMessage(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [apiCall, showMessage, onFilterOptionsChange])

  const reloadHosts = useCallback(() => {
    void loadHosts()
  }, [loadHosts])

  return {
    hosts,
    loading,
    error,
    filterOptions,
    loadHosts,
    reloadHosts,
    setFilterOptions,
  }
}
