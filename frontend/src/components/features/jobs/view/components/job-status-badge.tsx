'use client'

import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { getStatusBadgeClasses } from '../utils/job-utils'

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

  return (
    <div className="space-y-1.5">
      <Badge className={`text-xs border ${getStatusBadgeClasses(status)}`}>
        {hasProgress ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="font-semibold">{progress.percentage}%</span>
          </span>
        ) : (
          status
        )}
      </Badge>

      {hasProgress && (
        <div className="flex items-center gap-1.5 text-xs">
          <div className="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <span className="text-gray-600 font-mono text-xs whitespace-nowrap">
            {progress.completed}/{progress.total}
          </span>
        </div>
      )}
    </div>
  )
}
