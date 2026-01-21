import { useState, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'
import type { Device, CeleryTaskResponse } from '@/types/features/checkmk/sync-devices'

interface UseDeviceOperationsProps {
  trackTask: (taskId: string, deviceId: string | string[], deviceName: string, operation: 'add' | 'update' | 'sync') => void
  showMessage: (text: string, type: 'success' | 'error' | 'info') => void
  onAddDeviceConfirmation: (device: Device) => void
}

export function useDeviceOperations({ trackTask, showMessage, onAddDeviceConfirmation }: UseDeviceOperationsProps) {
  const { apiCall } = useApi()
  const [hasDevicesSynced, setHasDevicesSynced] = useState(false)
  const [isActivating, setIsActivating] = useState(false)

  const handleAddDevice = useCallback(async (device: Device) => {
    try {
      // Call Celery endpoint with device_id as query parameter
      const response = await apiCall<CeleryTaskResponse>(`celery/tasks/add-device-to-checkmk?device_id=${device.id}`, {
        method: 'POST'
      })

      if (response?.task_id) {
        // Start tracking the task (task panel will show progress)
        trackTask(response.task_id, device.id, device.name, 'add')
        return response
      } else {
        showMessage(`Failed to queue add task for ${device.name}`, 'error')
        return null
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add device'
      showMessage(`Failed to queue add for ${device.name}: ${message}`, 'error')
      throw err
    }
  }, [apiCall, showMessage, trackTask])

  const handleSync = useCallback(async (device: Device) => {
    try {
      // Use batch endpoint with single device for consistency
      const response = await apiCall<CeleryTaskResponse>(`celery/tasks/sync-devices-to-checkmk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [device.id],
          activate_changes_after_sync: true
        })
      })

      if (response?.task_id) {
        // Start tracking the task (task panel will show progress)
        trackTask(response.task_id, [device.id], device.name, 'update')
      } else {
        showMessage(`Failed to queue sync task for ${device.name}`, 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync device'

      // Check if it's a 404 error (device not found in CheckMK)
      if (message.includes('404') || message.includes('Not Found') || message.includes('not found')) {
        // Ask user if they want to add the device to CheckMK
        onAddDeviceConfirmation(device)
      } else {
        showMessage(`Failed to queue sync for ${device.name}: ${message}`, 'error')
      }
    }
  }, [apiCall, showMessage, onAddDeviceConfirmation, trackTask])

  const handleSyncSelected = useCallback(async (deviceIds: string[], deviceCount: number) => {
    if (deviceIds.length === 0) {
      showMessage('No devices selected', 'error')
      return
    }

    try {
      // Use batch sync endpoint
      const response = await apiCall<CeleryTaskResponse>(`celery/tasks/sync-devices-to-checkmk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: deviceIds,
          activate_changes_after_sync: true
        })
      })

      if (response?.task_id) {
        // Track the batch task with detailed progress
        trackTask(
          response.task_id,
          deviceIds,
          `${deviceCount} device${deviceCount === 1 ? '' : 's'}`,
          'sync'
        )

        // Show success message with job tracking info
        if (response.job_id) {
          showMessage(
            `Sync job queued for ${deviceCount} device${deviceCount === 1 ? '' : 's'}. Job ID: ${response.job_id}. View progress in Jobs/Views.`,
            'success'
          )
        } else {
          showMessage(
            `Sync job queued for ${deviceCount} device${deviceCount === 1 ? '' : 's'}`,
            'success'
          )
        }

        return true
      } else {
        showMessage(`Failed to queue batch sync task`, 'error')
        return false
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync selected devices'
      showMessage(message, 'error')
      return false
    }
  }, [apiCall, showMessage, trackTask])

  const handleStartDiscovery = useCallback(async (device: Device, mode: string = 'fix_all') => {
    const modeLabels: Record<string, string> = {
      'new': 'Monitor undecided services',
      'remove': 'Remove vanished services',
      'fix_all': 'Accept all',
      'refresh': 'Rescan',
      'only_host_labels': 'Update host labels',
      'only_service_labels': 'Update service labels',
      'tabula_rasa': 'Remove all and find new'
    }

    try {
      showMessage(`Starting discovery (${modeLabels[mode] || mode}) for ${device.name}...`, 'info')

      const response = await apiCall<{ success?: boolean; data?: { redirected?: boolean } }>(`checkmk/service-discovery/host/${device.name}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode: mode
        })
      })

      if (response?.success) {
        showMessage(`Service discovery completed for ${device.name}`, 'success')
      } else if (response?.data?.redirected) {
        showMessage(`Discovery started for ${device.name} (running in background)`, 'success')
      } else {
        showMessage(`Failed to start discovery for ${device.name}`, 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start discovery'
      showMessage(`Failed to start discovery for ${device.name}: ${message}`, 'error')
    }
  }, [apiCall, showMessage])

  const handleActivate = useCallback(async () => {
    try {
      setIsActivating(true)
      showMessage('Activating changes in CheckMK...', 'info')

      const response = await apiCall('checkmk/changes/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          force_foreign_changes: true
        })
      })

      if (response) {
        showMessage('Successfully activated pending changes in CheckMK', 'success')
        setHasDevicesSynced(false) // Reset the state after activation
      } else {
        showMessage('Failed to activate changes in CheckMK', 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to activate changes'
      showMessage(`Failed to activate changes: ${message}`, 'error')
    } finally {
      setIsActivating(false)
    }
  }, [apiCall, showMessage])

  // Callback for when a task succeeds
  const onTaskSuccess = useCallback(() => {
    setHasDevicesSynced(true)
  }, [])

  return {
    hasDevicesSynced,
    isActivating,
    handleAddDevice,
    handleSync,
    handleSyncSelected,
    handleStartDiscovery,
    handleActivate,
    onTaskSuccess
  }
}
