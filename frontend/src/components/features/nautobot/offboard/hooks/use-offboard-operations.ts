import { useState, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'
import type {
  OffboardProperties,
  NautobotIntegrationMode,
  OffboardResult,
  OffboardSummary,
  Device
} from '@/types/features/nautobot/offboard'

interface UseOffboardOperationsProps {
  showMessage: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export function useOffboardOperations({ showMessage }: UseOffboardOperationsProps) {
  const { apiCall } = useApi()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [offboardProperties, setOffboardProperties] = useState<OffboardProperties>({
    removePrimaryIp: true,
    removeInterfaceIps: true,
    removeFromCheckMK: true
  })
  const [nautobotIntegrationMode, setNautobotIntegrationMode] = useState<NautobotIntegrationMode>('remove')

  const handleOffboardDevices = useCallback(async (
    deviceIds: string[],
    devices: Device[]
  ): Promise<OffboardSummary> => {
    setIsSubmitting(true)
    const results: OffboardResult[] = []
    let successCount = 0
    let failedCount = 0

    try {
      showMessage(
        `Starting offboard process for ${deviceIds.length} device${deviceIds.length > 1 ? 's' : ''}...`,
        'info'
      )

      for (let i = 0; i < deviceIds.length; i++) {
        const deviceId = deviceIds[i]
        const deviceName = devices.find(d => d.id === deviceId)?.name || deviceId

        try {
          showMessage(
            `Offboarding device ${i + 1} of ${deviceIds.length}: ${deviceName}...`,
            'info'
          )

          const response = await apiCall<OffboardResult>(
            `nautobot/offboard/${deviceId}`,
            {
              method: 'POST',
              body: {
                remove_primary_ip: offboardProperties.removePrimaryIp,
                remove_interface_ips: offboardProperties.removeInterfaceIps,
                remove_from_checkmk: offboardProperties.removeFromCheckMK,
                nautobot_integration_mode: nautobotIntegrationMode
              }
            }
          )

          if (response) {
            results.push(response)
            if (response.success) {
              successCount++
            } else {
              failedCount++
            }
          } else {
            failedCount++
            results.push({
              success: false,
              device_id: deviceId || 'unknown',
              device_name: deviceName || 'Unknown Device',
              removed_items: [],
              skipped_items: [],
              errors: ['No response received from server'],
              summary: 'Offboarding failed: No response from server'
            })
          }
        } catch (error) {
          failedCount++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.push({
            success: false,
            device_id: deviceId || 'unknown',
            device_name: deviceName || 'Unknown Device',
            removed_items: [],
            skipped_items: [],
            errors: [errorMessage],
            summary: `Offboarding failed: ${errorMessage}`
          })
        }
      }

      // Create summary
      const summary: OffboardSummary = {
        totalDevices: deviceIds.length,
        successfulDevices: successCount,
        failedDevices: failedCount,
        results
      }

      // Set final status message
      if (failedCount === 0) {
        showMessage(
          `Successfully offboarded all ${successCount} device${successCount > 1 ? 's' : ''}`,
          'success'
        )
      } else if (successCount === 0) {
        showMessage(
          `Failed to offboard all ${failedCount} device${failedCount > 1 ? 's' : ''}`,
          'error'
        )
      } else {
        showMessage(
          `Offboarding completed: ${successCount} successful, ${failedCount} failed`,
          'warning'
        )
      }

      return summary
    } catch (error) {
      console.error('Offboard process failed:', error)
      showMessage(
        `Offboard process failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      )
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }, [apiCall, offboardProperties, nautobotIntegrationMode, showMessage])

  return {
    isSubmitting,
    offboardProperties,
    nautobotIntegrationMode,
    setOffboardProperties,
    setNautobotIntegrationMode,
    handleOffboardDevices
  }
}
