import { useState, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'
import type {
  DeviceVirtualChassisStatus,
  IpAddressMultipleAssignmentWarning,
  OffboardProperties,
  OffboardResult,
  OffboardSummary,
  Device,
  VirtualChassisDecision,
} from '@/types/features/nautobot/offboard'

interface UseOffboardOperationsProps {
  showMessage: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

const DEFAULT_OFFBOARD_PROPERTIES: OffboardProperties = {
  removePrimaryIp: true,
  removeInterfaceIps: true,
  removeFromCheckMK: true,
}

export function useOffboardOperations({ showMessage }: UseOffboardOperationsProps) {
  const { apiCall } = useApi()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [offboardProperties, setOffboardProperties] = useState<OffboardProperties>(
    DEFAULT_OFFBOARD_PROPERTIES
  )
  const [vcDecisions, setVcDecisions] = useState<
    Record<string, VirtualChassisDecision>
  >({})
  const [ipRemovalDecisions, setIpRemovalDecisions] = useState<Record<string, boolean>>(
    {}
  )

  const checkVCStatus = useCallback(
    async (deviceId: string): Promise<DeviceVirtualChassisStatus> => {
      const response = await apiCall<DeviceVirtualChassisStatus>(
        `nautobot/devices/is-virtual-chassis/${deviceId}`,
        { method: 'GET' }
      )
      if (!response) {
        return { is_in_chassis: false, is_master: false, virtual_chassis: null }
      }
      return response
    },
    [apiCall]
  )

  const setVcDecision = useCallback(
    (deviceId: string, decision: VirtualChassisDecision) => {
      setVcDecisions(prev => ({ ...prev, [deviceId]: decision }))
    },
    []
  )

  const setIpRemovalDecision = useCallback((deviceId: string, remove: boolean) => {
    setIpRemovalDecisions(prev => ({ ...prev, [deviceId]: remove }))
  }, [])

  const resetIpRemovalDecisions = useCallback(() => {
    setIpRemovalDecisions({})
  }, [])

  const checkIpAssignments = useCallback(
    async (devicesToCheck: Device[]): Promise<IpAddressMultipleAssignmentWarning[]> => {
      if (!offboardProperties.removePrimaryIp) return []

      const warnings: IpAddressMultipleAssignmentWarning[] = []

      for (const device of devicesToCheck) {
        const ip = device.primary_ip4?.address
        if (!ip) continue

        try {
          const ipOnly = ip.split('/')[0] ?? ip
          const response = await apiCall<{
            count: number
            ip_addresses: Array<{ interface_assignments?: Array<unknown> }>
          }>(
            `nautobot/ipam/ip-addresses/detailed?address=${encodeURIComponent(ipOnly)}&get_interface_assignments=true`,
            { method: 'GET' }
          )
          const assignments = response?.ip_addresses?.[0]?.interface_assignments ?? []
          if (assignments.length > 1) {
            warnings.push({
              deviceId: device.id,
              deviceName: device.name,
              ipAddress: ip,
              assignments:
                assignments as IpAddressMultipleAssignmentWarning['assignments'],
            })
          }
        } catch {
          // Skip devices where the IP check fails — proceed with the global setting
        }
      }

      return warnings
    },
    [apiCall, offboardProperties.removePrimaryIp]
  )

  const handleOffboardDevices = useCallback(
    async (deviceIds: string[], devices: Device[]): Promise<OffboardSummary> => {
      setIsSubmitting(true)
      const results: OffboardResult[] = []
      let successCount = 0
      let failedCount = 0

      // Track which chassis have already been fully removed (remove_all)
      // so we can skip other selected devices from the same chassis.
      const handledChassisIds = new Set<string>()

      try {
        showMessage(
          `Starting offboard process for ${deviceIds.length} device${deviceIds.length > 1 ? 's' : ''}...`,
          'info'
        )

        let deviceIndex = 0
        for (const deviceId of deviceIds) {
          deviceIndex++
          const deviceName = devices.find(d => d.id === deviceId)?.name ?? deviceId
          const decision = vcDecisions[deviceId]

          // Skip devices whose chassis was already fully removed by an earlier remove_all call
          if (
            decision?.virtual_chassis_id &&
            handledChassisIds.has(decision.virtual_chassis_id) &&
            decision.action !== 'remove_all'
          ) {
            results.push({
              success: true,
              device_id: deviceId,
              device_name: deviceName,
              removed_items: [],
              skipped_items: ['Device removed as part of virtual chassis offboarding'],
              errors: [],
              summary: 'Handled as part of virtual chassis removal',
            })
            successCount++
            continue
          }

          try {
            showMessage(
              `Offboarding device ${deviceIndex} of ${deviceIds.length}: ${deviceName}...`,
              'info'
            )

            const requestBody: Record<string, unknown> = {
              remove_primary_ip:
                ipRemovalDecisions[deviceId] ?? offboardProperties.removePrimaryIp,
              remove_interface_ips: offboardProperties.removeInterfaceIps,
              remove_from_checkmk: offboardProperties.removeFromCheckMK,
            }

            if (decision) {
              requestBody.virtual_chassis_action = decision.action
              requestBody.virtual_chassis_id = decision.virtual_chassis_id
              if (decision.chassis_member_ids) {
                requestBody.chassis_member_ids = decision.chassis_member_ids
              }
              if (decision.new_master_id) {
                requestBody.new_master_id = decision.new_master_id
              }
              if (decision.new_master_name) {
                requestBody.new_master_name = decision.new_master_name
              }
            }

            const response = await apiCall<OffboardResult>(
              `nautobot/offboard/${deviceId}`,
              {
                method: 'POST',
                body: requestBody,
              }
            )

            if (response) {
              results.push(response)
              if (response.success) {
                successCount++
                if (decision?.action === 'remove_all' && decision.virtual_chassis_id) {
                  handledChassisIds.add(decision.virtual_chassis_id)
                }
              } else {
                failedCount++
              }
            } else {
              failedCount++
              results.push({
                success: false,
                device_id: deviceId,
                device_name: deviceName,
                removed_items: [],
                skipped_items: [],
                errors: ['No response received from server'],
                summary: 'Offboarding failed: No response from server',
              })
            }
          } catch (error) {
            failedCount++
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error'
            results.push({
              success: false,
              device_id: deviceId,
              device_name: deviceName,
              removed_items: [],
              skipped_items: [],
              errors: [errorMessage],
              summary: `Offboarding failed: ${errorMessage}`,
            })
          }
        }

        const summary: OffboardSummary = {
          totalDevices: deviceIds.length,
          successfulDevices: successCount,
          failedDevices: failedCount,
          results,
        }

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

        // Clear decisions after the operation completes
        setVcDecisions({})
        setIpRemovalDecisions({})

        return summary
      } catch (error) {
        showMessage(
          `Offboard process failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        )
        throw error
      } finally {
        setIsSubmitting(false)
      }
    },
    [apiCall, offboardProperties, vcDecisions, ipRemovalDecisions, showMessage]
  )

  return {
    isSubmitting,
    offboardProperties,
    setOffboardProperties,
    handleOffboardDevices,
    checkVCStatus,
    setVcDecision,
    checkIpAssignments,
    ipRemovalDecisions,
    setIpRemovalDecision,
    resetIpRemovalDecisions,
  }
}
