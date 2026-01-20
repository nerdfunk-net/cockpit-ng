import { useState, useCallback, useEffect } from 'react'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'
import type { Device, PaginationState } from '@/types/features/checkmk/sync-devices'

export function useDeviceLoader() {
  const { apiCall } = useApi()
  const { isAuthenticated, token } = useAuthStore()

  const [authReady, setAuthReady] = useState(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setPaginationState] = useState<PaginationState>({
    isBackendPaginated: false,
    hasMore: false,
    totalCount: 0,
    currentLimit: null,
    currentOffset: 0,
    filterType: null,
    filterValue: null,
  })

  const loadDevices = useCallback(async (
    deviceNameFilter = '',
    useBackendPagination = false,
    limit: number | null = null,
    offset = 0,
    reload = false
  ) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (useBackendPagination && limit) {
        params.append('limit', limit.toString())
        params.append('offset', offset.toString())
      }
      if (deviceNameFilter) {
        params.append('filter_type', 'name')
        params.append('filter_value', deviceNameFilter)
      }
      if (reload) {
        params.append('reload', 'true')
      }

      const endpoint = `nautobot/devices${params.toString() ? '?' + params.toString() : ''}`
      const response = await apiCall<{
        devices?: Device[];
        is_paginated?: boolean;
        has_more?: boolean;
        count?: number;
        current_limit?: number;
        current_offset?: number;
        sites?: string[];
        locations?: string[];
        device_types?: string[];
      }>(endpoint)

      if (response?.devices) {
        const newDevices = response.devices
        setDevices(newDevices)

        // Update pagination state
        setPaginationState({
          isBackendPaginated: response.is_paginated || false,
          hasMore: response.has_more || false,
          totalCount: response.count || 0,
          currentLimit: response.current_limit || null,
          currentOffset: response.current_offset || 0,
          filterType: deviceNameFilter ? 'name' : null,
          filterValue: deviceNameFilter || null,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load devices'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  const reloadDevices = useCallback(() => {
    return loadDevices('', false, null, 0, true)
  }, [loadDevices])

  // Authentication effect - wait for auth before loading data
  useEffect(() => {
    if (isAuthenticated && token) {
      setAuthReady(true)
      void loadDevices()
    }
  }, [isAuthenticated, token, loadDevices])

  return {
    devices,
    setDevices,
    loading,
    error,
    authReady,
    loadDevices,
    reloadDevices
  }
}
