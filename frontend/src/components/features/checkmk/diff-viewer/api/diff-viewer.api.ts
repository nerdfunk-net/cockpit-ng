/**
 * API layer for Diff Viewer feature
 */

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

// Re-export from sync-devices API for job management
export { fetchJobs, loadJobResults, clearResults, startComparisonJob } from '../../sync-devices/api/sync-devices.api'
export type { Job } from '../../sync-devices/api/sync-devices.api'
