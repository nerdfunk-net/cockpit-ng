export function getStatusBadgeVariant(status: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  const statusLower = status.toLowerCase()
  if (statusLower.includes('active') || statusLower.includes('online')) {
    return 'default' // Green
  } else if (statusLower.includes('offline') || statusLower.includes('failed')) {
    return 'destructive' // Red
  } else if (statusLower.includes('maintenance')) {
    return 'secondary' // Yellow
  }
  return 'outline' // Gray
}

export function formatTaskDuration(startedAt: Date): string {
  const now = new Date()
  const duration = Math.floor((now.getTime() - startedAt.getTime()) / 1000)

  if (duration < 60) {
    return `${duration}s`
  } else if (duration < 3600) {
    return `${Math.floor(duration / 60)}m ${duration % 60}s`
  } else {
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
  }
}

export function formatProgressPercentage(current: number, total: number): number {
  if (total === 0) return 0
  return Math.round((current / total) * 100)
}
