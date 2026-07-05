import type { StatusVariant } from '@/components/shared/status-badge'

/**
 * Maps a check-ip result status to a semantic StatusVariant.
 * name_mismatch and name_partial_mismatch both fold into 'warning'
 * (amber/orange convention) since only 4 status buckets exist.
 */
export function getStatusVariant(status: string): StatusVariant {
  switch (status) {
    case 'match':
      return 'success'
    case 'name_mismatch':
    case 'name_partial_mismatch':
      return 'warning'
    case 'ip_not_found':
    case 'error':
      return 'error'
    default:
      return 'info'
  }
}

export function getProgressValue(
  status: string | undefined,
  progress: { current: number; total: number } | undefined
): number {
  if (status === 'SUCCESS') return 100
  if (status === 'FAILURE') return 0
  if (progress && progress.total > 0) {
    return Math.round((progress.current / progress.total) * 100)
  }
  return 0
}
