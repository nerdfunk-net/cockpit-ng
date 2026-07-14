'use client'

import { useCallback, useMemo, useState } from 'react'
import { useApi } from '@/hooks/use-api'

export interface DeviceCheckResult {
  deviceName: string
  found: boolean
}

export interface CheckProgress {
  checked: number
  total: number
}

interface NautobotDeviceListItem {
  id: string
  name: string
}

const EMPTY_PROGRESS: CheckProgress = { checked: 0, total: 0 }
const EMPTY_RESULTS: DeviceCheckResult[] = []

export function useCheckDevices() {
  const { apiCall } = useApi()
  const [isChecking, setIsChecking] = useState(false)
  const [progress, setProgress] = useState<CheckProgress>(EMPTY_PROGRESS)
  const [results, setResults] = useState<DeviceCheckResult[]>(EMPTY_RESULTS)

  const runCheck = useCallback(
    async (deviceNames: string[]) => {
      if (deviceNames.length === 0) {
        setResults(EMPTY_RESULTS)
        return
      }

      setIsChecking(true)
      setResults(EMPTY_RESULTS)
      setProgress({ checked: 0, total: deviceNames.length })

      let checked = 0
      try {
        const entries = await Promise.all(
          deviceNames.map(async name => {
            try {
              const params = new URLSearchParams({ name_ic: name })
              const result = await apiCall<
                NautobotDeviceListItem[] | { devices?: NautobotDeviceListItem[] }
              >(`nautobot/devices?${params.toString()}`)
              const items = Array.isArray(result)
                ? result
                : (result.devices ?? [])
              const found = items.some(
                d => d.name.toLowerCase() === name.toLowerCase()
              )
              return { deviceName: name, found } satisfies DeviceCheckResult
            } catch {
              return { deviceName: name, found: false } satisfies DeviceCheckResult
            } finally {
              checked += 1
              setProgress({ checked, total: deviceNames.length })
            }
          })
        )

        entries.sort((a, b) => {
          if (a.found !== b.found) return a.found ? 1 : -1
          return a.deviceName.localeCompare(b.deviceName)
        })

        setResults(entries)
      } finally {
        setIsChecking(false)
      }
    },
    [apiCall]
  )

  return useMemo(
    () => ({ isChecking, progress, results, runCheck }),
    [isChecking, progress, results, runCheck]
  )
}
