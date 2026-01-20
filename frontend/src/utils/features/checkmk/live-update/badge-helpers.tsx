import { Badge } from '@/components/ui/badge'

/**
 * Get badge component for CheckMK status
 */
export const getCheckMKStatusBadge = (checkmkStatus: string | undefined) => {
  if (!checkmkStatus) {
    return <Badge variant="outline" className="bg-gray-100 text-gray-800">Unknown</Badge>
  }
  switch (checkmkStatus.toLowerCase()) {
    case 'equal':
      return <Badge variant="default" className="bg-green-100 text-green-800">Synced</Badge>
    case 'diff':
      return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Different</Badge>
    case 'host_not_found':
    case 'missing':
      return <Badge variant="destructive">Missing</Badge>
    case 'error':
      return <Badge variant="destructive" className="bg-red-100 text-red-800">Error</Badge>
    case 'unknown':
      return <Badge variant="outline">Unknown</Badge>
    default:
      return <Badge variant="outline">{checkmkStatus}</Badge>
  }
}
