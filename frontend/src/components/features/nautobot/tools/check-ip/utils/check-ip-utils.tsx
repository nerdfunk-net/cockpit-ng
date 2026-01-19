import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'

export function getStatusIcon(status: string) {
  switch (status) {
    case 'match':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'name_mismatch':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    case 'ip_not_found':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />
    default:
      return <Info className="h-4 w-4 text-blue-500" />
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'match':
      return 'bg-green-100 text-green-700 border-green-300'
    case 'name_mismatch':
      return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    case 'ip_not_found':
      return 'bg-red-100 text-red-700 border-red-300'
    case 'error':
      return 'bg-red-100 text-red-700 border-red-300'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-300'
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
