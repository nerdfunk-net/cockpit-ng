/**
 * API layer for Diff Viewer feature
 */

import type { DiffDevice } from '../types'

interface NautobotDeviceRaw {
  id: string
  name: string | null
  primary_ip4?: { address: string }
  role?: { name: string }
  location?: { name: string }
  status?: { name: string }
  device_type?: { model: string }
}

/**
 * Fetch all devices from Nautobot and convert to DiffDevice format
 */
export async function fetchNautobotDevices(
  token: string
): Promise<{ devices: DiffDevice[]; total: number }> {
  const response = await fetch('/api/proxy/nautobot/devices?limit=10000', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch Nautobot devices')
  }
  const data = await response.json()
  const devices: DiffDevice[] = (data.devices ?? []).map(
    (d: NautobotDeviceRaw): DiffDevice => ({
      name: d.name ?? '',
      source: 'nautobot',
      nautobot_id: d.id,
      ip_address: d.primary_ip4?.address,
      role: d.role?.name,
      location: d.location?.name,
      status: d.status?.name,
      device_type: d.device_type?.model,
    })
  )
  return { devices, total: data.count ?? devices.length }
}

/**
 * Start the diff task between Nautobot and CheckMK
 */
export const startDiffTask = async (token: string): Promise<{ task_id: string }> => {
  const response = await fetch('/api/proxy/celery/tasks/get-diff-between-nb-checkmk', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to start diff task')
  }

  return response.json()
}

// Re-export from shared API for job management
export { fetchJobs, loadJobResults, clearResults, startComparisonJob } from '../../shared/utils/api'
export type { Job } from '../../shared/utils/api'
