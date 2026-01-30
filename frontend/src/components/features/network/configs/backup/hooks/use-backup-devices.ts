import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { STALE_TIME, EMPTY_DEVICES, EMPTY_HISTORY } from '../utils/constants'
import type { Device, DeviceFilters, BackupPagination, BackupSorting, BackupHistoryEntry } from '../types'

interface UseBackupDevicesOptions {
  filters?: DeviceFilters
  pagination?: BackupPagination
  sorting?: BackupSorting
  enabled?: boolean
}

const DEFAULT_DEVICES_OPTIONS: UseBackupDevicesOptions = {
  enabled: true
}

export function useBackupDevices(options: UseBackupDevicesOptions = DEFAULT_DEVICES_OPTIONS) {
  const { apiCall } = useApi()
  const { filters, pagination, sorting, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.network.backupDevices({ ...filters, ...pagination, ...sorting }),
    queryFn: async () => {
      const params = new URLSearchParams()

      // Filters
      if (filters?.name) params.append('name', filters.name)
      if (filters?.role) params.append('role', filters.role)
      if (filters?.location) params.append('location', filters.location)
      if (filters?.deviceType) params.append('device_type', filters.deviceType)
      if (filters?.status) params.append('status', filters.status)
      if (filters?.lastBackupDate) params.append('last_backup_date', filters.lastBackupDate)
      if (filters?.dateComparison) params.append('date_comparison', filters.dateComparison)

      // Pagination
      if (pagination?.limit) params.append('limit', pagination.limit.toString())
      if (pagination?.offset) params.append('offset', pagination.offset.toString())

      // Sorting
      if (sorting?.column) params.append('sort_by', sorting.column)
      if (sorting?.order && sorting.order !== 'none') params.append('sort_order', sorting.order)

      const response = await apiCall<{
        devices: Device[]
        total: number
        limit: number
        offset: number
      }>(`network/configs/backup/devices?${params}`)

      return {
        devices: response?.devices || EMPTY_DEVICES,
        total: response?.total || 0,
        limit: response?.limit || 50,
        offset: response?.offset || 0
      }
    },
    enabled,
    staleTime: STALE_TIME.DEVICES,
  })
}

const DEFAULT_HISTORY_OPTIONS: { enabled?: boolean } = {}

export function useBackupHistory(deviceId: string, options: { enabled?: boolean } = DEFAULT_HISTORY_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.network.backupHistory(deviceId),
    queryFn: async () => {
      const response = await apiCall<BackupHistoryEntry[]>(
        `network/configs/backup/history/${deviceId}`
      )
      return response || EMPTY_HISTORY
    },
    enabled: enabled && !!deviceId,
    staleTime: STALE_TIME.HISTORY,
  })
}
