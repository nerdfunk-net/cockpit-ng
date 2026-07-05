import { StatusBadge } from '@/components/shared/status-badge'
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react'

export function getStatusBadge(status: string) {
  switch (status) {
    case 'expired':
      return (
        <StatusBadge variant="error" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expired
        </StatusBadge>
      )
    case 'expiring':
      return (
        <StatusBadge variant="warning" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Expiring
        </StatusBadge>
      )
    default:
      return (
        <StatusBadge variant="success" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Active
        </StatusBadge>
      )
  }
}
