/**
 * API layer for CheckMK Sync Devices feature
 * Centralizes all API calls to backend services
 */

import type { NautobotDeviceRecord, Job, JobProgress } from '../types/sync-devices.types'

/**
 * Fetch devices from Nautobot
 */
export const fetchDevices = async (token: string, reload = false): Promise<{ devices?: NautobotDeviceRecord[] }> => {
  const response = await fetch(`/api/proxy/nautobot/devices${reload ? '?reload=true' : ''}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.detail || 'Failed to fetch devices')
  }
  
  return response.json()
}

/**
 * Fetch available completed jobs
 */
export const fetchJobs = async (token: string, limit = 50): Promise<{ jobs: Job[] }> => {
  const response = await fetch(`/api/proxy/nb2cmk/jobs?limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch jobs')
  }
  
  return response.json()
}

/**
 * Load job results by job ID
 */
export const loadJobResults = async (token: string, jobId: string) => {
  const response = await fetch(`/api/proxy/nb2cmk/jobs/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.detail || 'Failed to load job results')
  }
  
  return response.json()
}

/**
 * Clear all comparison results
 */
export const clearResults = async (token: string) => {
  const response = await fetch('/api/proxy/nb2cmk/jobs/clear', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.detail || 'Failed to clear results')
  }
  
  return response.json()
}

/**
 * Start a new device comparison job using Celery
 */
export const startComparisonJob = async (token: string): Promise<{ task_id: string; job_id?: string }> => {
  const response = await fetch('/api/proxy/celery/tasks/compare-nautobot-and-checkmk', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(null)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to start comparison job')
  }
  
  return response.json()
}

/**
 * Sync devices to CheckMK
 */
export const syncDevicesToCheckmk = async (
  token: string, 
  deviceIds: string[], 
  activateChanges = true
): Promise<{ task_id: string; job_id?: string; status: string; message: string }> => {
  const response = await fetch('/api/proxy/celery/tasks/sync-devices-to-checkmk', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      device_ids: deviceIds,
      activate_changes_after_sync: activateChanges
    })
  })
  
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.detail || 'Failed to sync devices')
  }
  
  return response.json()
}

/**
 * Add device to CheckMK
 */
export const addDeviceToCheckmk = async (token: string, deviceId: string) => {
  const response = await fetch(`/api/proxy/nb2cmk/device/${deviceId}/add`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.detail || 'Failed to add device')
  }
  
  return response.json()
}

/**
 * Get default site configuration
 */
export const getDefaultSite = async (token: string): Promise<{ default_site: string }> => {
  const response = await fetch('/api/proxy/nb2cmk/get_default_site', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch default site')
  }
  
  return response.json()
}

/**
 * Get Celery task status
 */
export const getCeleryTaskStatus = async (token: string, taskId: string): Promise<{
  status: string
  progress?: JobProgress
  result?: unknown
  error?: string
}> => {
  const response = await fetch(`/api/proxy/celery/tasks/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    throw new Error('Failed to get task status')
  }
  
  return response.json()
}

/**
 * Cancel a running Celery task
 */
export const cancelCeleryTask = async (token: string, taskId: string) => {
  const response = await fetch(`/api/proxy/celery/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    throw new Error('Failed to cancel task')
  }
  
  return response.json()
}
