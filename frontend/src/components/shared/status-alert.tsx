'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusIcon } from './status-icon'
import type { StatusVariant } from './status-badge'

const variantClasses: Record<StatusVariant, string> = {
  success: 'status-success border',
  warning: 'status-warning border',
  error: 'status-error border',
  info: 'status-info border',
}

interface StatusAlertProps {
  variant: StatusVariant
  children: React.ReactNode
  className?: string
  onDismiss?: () => void
}

export function StatusAlert({
  variant,
  children,
  className,
  onDismiss,
}: StatusAlertProps) {
  return (
    <Alert className={cn(variantClasses[variant], className)}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2">
          <StatusIcon variant={variant} className="flex-shrink-0 mt-0.5" />
          <AlertDescription className="flex-1 text-current">
            {children}
          </AlertDescription>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0 hover:bg-foreground/10 text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Alert>
  )
}
