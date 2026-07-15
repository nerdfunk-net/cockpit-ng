'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useProfileFieldsQuery } from '@/components/features/settings/defaults/profiles/hooks/use-profile-fields-query'
import type {
  DeviceSubmissionData,
  InterfaceData,
} from '@/components/features/nautobot/add-device/types'
import type { DeviceUpdatePayload } from '../types'

export type AddDeviceResultStatus = 'success' | 'error' | 'skipped'

export interface AddDeviceResult {
  deviceName: string
  status: AddDeviceResultStatus
  message: string
}

export interface AddProgress {
  done: number
  total: number
}

const EMPTY_PROGRESS: AddProgress = { done: 0, total: 0 }
const EMPTY_RESULTS: AddDeviceResult[] = []

const REQUIRED_FIELDS = ['role', 'status', 'location', 'device_type'] as const

function firstString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Fills device-level and interface-level fields missing from a CSV-derived
 * payload with the values from the selected profile (defaults to "Network"),
 * then submits each resulting device to `nautobot/add-device` — the same
 * endpoint the add-device feature uses, so the existing
 * automatic-prefix-creation behavior (`add_prefix`) applies here too.
 */
export function useAddMissingDevices(profileId: number | null) {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { data: defaults } = useProfileFieldsQuery(profileId)

  const [isAdding, setIsAdding] = useState(false)
  const [progress, setProgress] = useState<AddProgress>(EMPTY_PROGRESS)
  const [results, setResults] = useState<AddDeviceResult[]>(EMPTY_RESULTS)

  const addDevices = useCallback(
    async (payloads: DeviceUpdatePayload[]) => {
      if (payloads.length === 0) {
        setResults(EMPTY_RESULTS)
        return EMPTY_RESULTS
      }

      setIsAdding(true)
      setResults(EMPTY_RESULTS)
      setProgress({ done: 0, total: payloads.length })

      const entries: AddDeviceResult[] = []
      let succeeded = false

      try {
        for (const payload of payloads) {
          const status = firstString(payload.status) || defaults?.device_status || ''
          const role = firstString(payload.role) || defaults?.device_role || ''
          const location = firstString(payload.location) || defaults?.location || ''
          const deviceType =
            firstString(payload.device_type) || defaults?.device_type || ''
          const platform = firstString(payload.platform) || defaults?.platform || undefined

          const requiredValues: Record<(typeof REQUIRED_FIELDS)[number], string> = {
            role,
            status,
            location,
            device_type: deviceType,
          }
          const missing = REQUIRED_FIELDS.filter(field => !requiredValues[field])

          if (missing.length > 0) {
            entries.push({
              deviceName: payload.name,
              status: 'skipped',
              message: `Missing required field(s): ${missing.join(', ')}`,
            })
            setProgress({ done: entries.length, total: payloads.length })
            continue
          }

          const interfaces: InterfaceData[] = payload.interfaces.map(iface => ({
            id: crypto.randomUUID(),
            name: iface.name,
            type: iface.type || defaults?.interface_type || '',
            status: iface.status || defaults?.interface_status || '',
            ip_addresses: iface.ip_address
              ? [
                  {
                    id: crypto.randomUUID(),
                    address: iface.ip_address,
                    namespace: defaults?.namespace || '',
                    ip_role: '',
                    is_primary: iface.is_primary_ipv4,
                  },
                ]
              : [],
          }))

          const tagsValue = payload.tags
          const tags =
            typeof tagsValue === 'string' && tagsValue.trim()
              ? tagsValue.split(',').map(tag => tag.trim()).filter(Boolean)
              : undefined

          const submissionData: DeviceSubmissionData = {
            name: payload.name,
            role,
            status,
            location,
            device_type: deviceType,
            platform,
            serial: firstString(payload.serial) || undefined,
            software_version: firstString(payload.software_version) || undefined,
            tags,
            interfaces,
            add_prefix: true,
            default_prefix_length: '/24',
            dry_run: false,
          }

          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const response = await apiCall<any>('nautobot/add-device', {
              method: 'POST',
              body: JSON.stringify(submissionData),
            })

            const success = response?.success === true
            if (success) succeeded = true

            entries.push({
              deviceName: payload.name,
              status: success ? 'success' : 'error',
              message: success
                ? `Device "${payload.name}" created successfully`
                : `Failed to create device "${payload.name}": ${response?.error ?? response?.detail ?? response?.message ?? 'Unknown error'}`,
            })
          } catch (error) {
            entries.push({
              deviceName: payload.name,
              status: 'error',
              message: error instanceof Error ? error.message : 'Unknown error',
            })
          }

          setProgress({ done: entries.length, total: payloads.length })
        }

        setResults(entries)
        return entries
      } finally {
        setIsAdding(false)
        if (succeeded) {
          queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.all })
        }
      }
    },
    [apiCall, defaults, queryClient]
  )

  return useMemo(
    () => ({ isAdding, progress, results, addDevices }),
    [isAdding, progress, results, addDevices]
  )
}
