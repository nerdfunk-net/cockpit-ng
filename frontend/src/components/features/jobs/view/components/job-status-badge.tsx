'use client'

import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { StatusBadge } from '@/components/shared/status-badge'
import { getStatusBadgeVariant, NEUTRAL_BADGE_CLASSES } from '../utils/job-utils'

interface JobStatusBadgeProps {
  status: string
  progress?: {
    completed: number
    total: number
    percentage: number
  }
}

export function JobStatusBadge({ status, progress }: JobStatusBadgeProps) {
  const hasProgress = status === 'running' && progress
  const variant = getStatusBadgeVariant(status)

  const label = hasProgress ? (
    <span className="flex items-center gap-1.5">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <span className="font-semibold">{progress.percentage}%</span>
    </span>
  ) : (
    status
  )

  return (
    <div className="space-y-1.5">
      {variant ? (
        <StatusBadge
          variant={variant}
          className={`text-xs ${status.toLowerCase() === 'running' ? 'animate-pulse' : ''}`}
        >
          {label}
        </StatusBadge>
      ) : (
        <Badge className={`text-xs border ${NEUTRAL_BADGE_CLASSES}`}>{label}</Badge>
      )}

      {hasProgress && (
        <div className="flex items-center gap-1.5 text-xs">
          <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden max-w-[80px]">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
            {progress.completed}/{progress.total}
          </span>
        </div>
      )}
    </div>
  )
}
