/**
 * Check if task is still active (needs polling)
 */
export function isTaskActive(status: string | undefined): boolean {
  if (!status) return false
  return !['SUCCESS', 'FAILURE', 'REVOKED'].includes(status)
}

/**
 * Get status badge variant based on task status
 */
export function getTaskStatusVariant(status: string): 'default' | 'destructive' | 'secondary' {
  switch (status) {
    case 'SUCCESS':
      return 'default'
    case 'FAILURE':
      return 'destructive'
    default:
      return 'secondary'
  }
}

/**
 * Format duration in hours to human-readable string
 */
export function formatHours(hours: number): string {
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`
  }
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''}`
}
