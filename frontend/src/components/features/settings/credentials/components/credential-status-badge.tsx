import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react'

export function getStatusBadge(status: string) {
  switch (status) {
    case 'expired':
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expired
        </Badge>
      )
    case 'expiring':
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-amber-100 text-amber-800 border-amber-300">
          <Clock className="h-3 w-3" />
          Expiring
        </Badge>
      )
    default:
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800 border-green-300">
          <CheckCircle className="h-3 w-3" />
          Active
        </Badge>
      )
  }
}
