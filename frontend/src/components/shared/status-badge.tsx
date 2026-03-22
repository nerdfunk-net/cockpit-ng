import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type StatusVariant = 'success' | 'warning' | 'error' | 'info'

interface StatusBadgeProps {
  variant: StatusVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<StatusVariant, string> = {
  success: 'status-success border',
  warning: 'status-warning border',
  error: 'status-error border',
  info: 'status-info border',
}

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(variantClasses[variant], className)}
    >
      {children}
    </Badge>
  )
}
