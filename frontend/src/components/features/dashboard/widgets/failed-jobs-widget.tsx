'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { IconChip } from '@/components/shared/icon-chip'
import { useJobStatsQuery } from '@/hooks/queries/use-job-stats-query'

export function FailedJobsWidget() {
  const { data, isLoading, isError } = useJobStatsQuery()

  const failed = data?.job_runs?.failed ?? 0

  return (
    <Card className="analytics-card border-0 h-full transition-all duration-300 hover:shadow-analytics-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <IconChip variant="error" className="p-3 rounded-xl">
            <XCircle className="h-6 w-6" />
          </IconChip>
          <div className="text-right">
            <div className="text-3xl font-bold text-foreground">
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : isError ? (
                <AlertTriangle className="h-8 w-8 text-error-foreground" />
              ) : (
                failed.toString()
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardTitle className="text-sm font-semibold text-foreground mb-2">
          Failed Jobs
        </CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">Jobs with errors</p>
      </CardContent>
    </Card>
  )
}
