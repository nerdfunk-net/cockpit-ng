import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StatusVariant } from './status-badge'

const variantIcons: Record<StatusVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
  info: Info,
}

const variantClasses: Record<StatusVariant, string> = {
  success: 'text-success-foreground',
  warning: 'text-warning-foreground',
  error: 'text-error-foreground',
  info: 'text-info-foreground',
}

interface StatusIconProps {
  variant: StatusVariant
  className?: string
}

export function StatusIcon({ variant, className }: StatusIconProps) {
  const Icon = variantIcons[variant]
  return <Icon className={cn('h-5 w-5', variantClasses[variant], className)} />
}
