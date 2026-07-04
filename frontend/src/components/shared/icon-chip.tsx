import { cn } from '@/lib/utils'

export type IconChipVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'

const variantClasses: Record<IconChipVariant, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  error: 'bg-error text-error-foreground',
  info: 'bg-info text-info-foreground',
  neutral: 'bg-muted text-muted-foreground',
}

interface IconChipProps {
  variant?: IconChipVariant
  className?: string
  children: React.ReactNode
}

/** Tinted icon container used in page headers (replaces bg-{color}-100 boxes). */
export function IconChip({ variant = 'primary', className, children }: IconChipProps) {
  return (
    <div className={cn('p-2 rounded-lg', variantClasses[variant], className)}>
      {children}
    </div>
  )
}
