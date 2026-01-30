import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import { useMemo } from 'react'

export function useBackupMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Trigger backup for single device
  const triggerBackup = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiCall<{ task_id: string; status: string }>('network/configs/backup/trigger', {
        method: 'POST',
        body: JSON.stringify({ device_id: deviceId })
      })
    },
    onSuccess: (data) => {
      // Invalidate devices query to refresh backup status
      queryClient.invalidateQueries({ queryKey: queryKeys.network.backupDevices() })

      toast({
        title: 'Backup Started',
        description: `Backup job initiated. Task ID: ${data?.task_id || 'N/A'}`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Backup Failed',
        description: error.message || 'Failed to start backup.',
        variant: 'destructive'
      })
    }
  })

  // Trigger bulk backup
  const triggerBulkBackup = useMutation({
    mutationFn: async (deviceIds: string[]) => {
      return apiCall<{ task_id: string; device_count: number }>('network/configs/backup/trigger-bulk', {
        method: 'POST',
        body: JSON.stringify({ device_ids: deviceIds })
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.network.backupDevices() })

      toast({
        title: 'Bulk Backup Started',
        description: `Backup initiated for ${data?.device_count || 0} devices.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Bulk Backup Failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Download backup
  const downloadBackup = useMutation({
    mutationFn: async ({ deviceId, backupId }: { deviceId: string; backupId: string }) => {
      const response = await fetch(`/api/proxy/network/configs/backup/download/${deviceId}/${backupId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      })

      if (!response.ok) {
        throw new Error('Failed to download backup')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${deviceId}_backup_${backupId.substring(0, 8)}.txt`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      return { success: true }
    },
    onSuccess: () => {
      toast({
        title: 'Download Started',
        description: 'Backup file download has started.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Download Failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Restore backup
  const restoreBackup = useMutation({
    mutationFn: async ({ deviceId, backupId }: { deviceId: string; backupId: string }) => {
      return apiCall<{ task_id: string; message?: string }>(`network/configs/backup/restore/${deviceId}/${backupId}`, {
        method: 'POST'
      })
    },
    onSuccess: (data) => {
      toast({
        title: 'Restore Started',
        description: data?.message || 'Configuration restore job has been initiated.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Restore Failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  return useMemo(() => ({
    triggerBackup,
    triggerBulkBackup,
    downloadBackup,
    restoreBackup,
  }), [triggerBackup, triggerBulkBackup, downloadBackup, restoreBackup])
}
