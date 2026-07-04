'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconChip } from '@/components/shared/icon-chip'
import { useCheckmkSyncQuery } from '@/hooks/queries/use-checkmk-sync-query'

export function CheckmkSyncWidget() {
  const { data, isLoading, isError } = useCheckmkSyncQuery()

  const inSyncCount = data?.in_sync ?? 0
  const outOfSyncCount = data?.differences_found ?? 0
  const totalDevices = data?.total ?? 0
  const inSyncPercent = totalDevices > 0 ? (inSyncCount / totalDevices) * 100 : 0

  return (
    <Card className="analytics-card border-0 h-full transition-all duration-300 hover:shadow-analytics-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <IconChip variant="primary" className="p-2.5 rounded-xl">
            <RefreshCw className="h-5 w-5" />
          </IconChip>
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">
              CheckMK Sync Status
            </CardTitle>
            <p className="text-xs text-muted-foreground">Nautobot ↔ CheckMK device comparison</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading sync status...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-error-foreground py-4">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">Failed to load sync status</span>
          </div>
        ) : !data?.has_data ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <AlertTriangle className="h-5 w-5 text-warning-foreground" />
            <span className="text-sm">{data?.message ?? 'No comparison data available'}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-success">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                  <span className="text-xs font-medium text-success-foreground">In Sync</span>
                </div>
                <div className="text-2xl font-bold text-success-foreground">{inSyncCount}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-error">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <XCircle className="h-4 w-4 text-error-foreground" />
                  <span className="text-xs font-medium text-error-foreground">Out of Sync</span>
                </div>
                <div className="text-2xl font-bold text-error-foreground">{outOfSyncCount}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Total</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{totalDevices}</div>
              </div>
            </div>
            {totalDevices > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Sync Progress</span>
                  <span>{inSyncPercent.toFixed(0)}% in sync</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      inSyncPercent >= 80
                        ? 'bg-success-foreground'
                        : inSyncPercent >= 50
                          ? 'bg-warning-foreground'
                          : 'bg-error-foreground'
                    )}
                    style={{ width: `${inSyncPercent}%` }}
                  />
                </div>
              </div>
            )}
            {data.completed_at && (
              <div className="text-xs text-muted-foreground pt-1">
                Last compared: {new Date(data.completed_at).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
