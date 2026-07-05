export function getStatusBadgeVariant(
  status: string
): 'info' | 'error' | 'warning' | 'neutral' {
  const statusLower = status.toLowerCase()
  if (statusLower.includes('active') || statusLower.includes('online')) return 'info'
  if (statusLower.includes('failed') || statusLower.includes('offline'))
    return 'error'
  if (statusLower.includes('maintenance')) return 'warning'
  return 'neutral'
}

export const PAGE_SIZE_OPTIONS = [10, 50, 100, 200, 500]
