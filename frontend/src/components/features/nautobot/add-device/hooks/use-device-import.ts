'use client'

import { useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type {
  ParsedDevice,
  InterfaceData,
  DeviceSubmissionData,
  DeviceImportResult,
} from '../types'
import type { PrefixConfig } from './use-csv-import'

/**
 * Converts a parsed CSV device into the backend submission format and posts it.
 */
export function useDeviceImport() {
  const { apiCall } = useApi()

  const handleImportDevice = useCallback(
    async (
      device: ParsedDevice,
      prefixConfig: PrefixConfig,
      dryRun?: boolean
    ): Promise<DeviceImportResult> => {
      try {
        const interfaces: InterfaceData[] = device.interfaces.map(iface => ({
          id: crypto.randomUUID(),
          name: iface.name,
          type: iface.type || '',
          status: iface.status || '',
          enabled: iface.enabled,
          mgmt_only: iface.mgmt_only,
          description: iface.description,
          mac_address: iface.mac_address,
          mtu: iface.mtu,
          mode: iface.mode,
          untagged_vlan: iface.untagged_vlan,
          tagged_vlans: iface.tagged_vlans,
          parent_interface: iface.parent_interface,
          bridge: iface.bridge,
          lag: iface.lag,
          tags: iface.tags,
          ip_addresses: iface.ip_address
            ? [
                {
                  id: crypto.randomUUID(),
                  address: iface.ip_address,
                  namespace: iface.namespace || '',
                  ip_role: '',
                  is_primary: iface.is_primary_ipv4,
                },
              ]
            : [],
        }))

        const submissionData: DeviceSubmissionData = {
          name: device.name,
          serial: device.serial,
          role: device.role || '',
          status: device.status || '',
          location: device.location || '',
          device_type: device.device_type || '',
          platform: device.platform,
          software_version: device.software_version,
          tags: device.tags,
          custom_fields: device.custom_fields,
          interfaces,
          add_prefix: prefixConfig.addPrefix,
          default_prefix_length: prefixConfig.addPrefix
            ? prefixConfig.defaultPrefixLength
            : '',
          dry_run: dryRun === true,
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await apiCall<any>('nautobot/add-device', {
          method: 'POST',
          body: JSON.stringify(submissionData),
        })

        const success = response.success === true

        // Dry run: surface per-device validation errors returned by the backend
        if (response.dry_run) {
          const apiErrors: string[] = response.errors ?? []
          return {
            deviceName: device.name,
            status: success && apiErrors.length === 0 ? 'success' : 'error',
            message:
              apiErrors.length > 0
                ? apiErrors.join('; ')
                : `Device "${device.name}" passed Nautobot validation`,
          }
        }

        return {
          deviceName: device.name,
          status: success ? 'success' : 'error',
          message: success
            ? `Device "${device.name}" created successfully`
            : `Failed to create device "${device.name}": ${response.error ?? response.detail ?? response.message ?? 'Unknown error'}`,
          deviceId: response.device_id,
        }
      } catch (error) {
        return {
          deviceName: device.name,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    },
    [apiCall]
  )

  return useMemo(() => ({ handleImportDevice }), [handleImportDevice])
}
