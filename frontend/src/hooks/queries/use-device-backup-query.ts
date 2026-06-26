import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface DeviceBackupStatus {
  device_id: string
  device_name: string
  last_backup_success: boolean
  last_backup_time: string | null
  total_successful_backups: number
  total_failed_backups: number
  last_error: string | null
}

export interface BackupCheckResponse {
  total_devices: number
  devices_with_successful_backup: number
  devices_with_failed_backup: number
  devices_never_backed_up: number
  devices: DeviceBackupStatus[]
}

export function useDeviceBackupQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.dashboard.deviceBackup(),
    queryFn: () => apiCall<BackupCheckResponse>('celery/device-backup-status'),
    staleTime: 2 * 60 * 1000,
  })
}
