/**
 * API layer for CheckMK shared operations
 * Authorization is injected server-side by the proxy from the httpOnly cookie.
 */

export interface Job {
  id: string
  status: string
  created_at: string
  processed_devices: number
}

export const fetchJobs = async (limit = 50): Promise<{ jobs: Job[] }> => {
  const response = await fetch(`/api/proxy/nb2cmk/jobs?limit=${limit}`, {
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch jobs')
  }

  return response.json()
}

export const loadJobResults = async (jobId: string) => {
  const response = await fetch(`/api/proxy/nb2cmk/jobs/${jobId}`, {
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.detail || 'Failed to load job results')
  }

  return response.json()
}

export const clearResults = async () => {
  const response = await fetch('/api/proxy/nb2cmk/jobs/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.detail || 'Failed to clear results')
  }

  return response.json()
}

export const startComparisonJob = async (): Promise<{ task_id: string; job_id?: string }> => {
  const response = await fetch('/api/proxy/celery/tasks/compare-nautobot-and-checkmk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(null),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to start comparison job')
  }

  return response.json()
}
