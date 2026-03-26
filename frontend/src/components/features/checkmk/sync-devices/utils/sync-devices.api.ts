/**
 * API layer for CheckMK Sync Devices feature
 */

export interface Job {
  id: string
  status: string
  created_at: string
  processed_devices: number
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
