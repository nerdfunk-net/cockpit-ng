'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
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
          <div className="p-2.5 rounded-xl bg-purple-100 ring-1 ring-white/20">
            <RefreshCw className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-slate-700">
              CheckMK Sync Status
            </CardTitle>
            <p className="text-xs text-slate-500">Nautobot ↔ CheckMK device comparison</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            <span className="ml-2 text-sm text-slate-500">Loading sync status...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-red-600 py-4">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">Failed to load sync status</span>
          </div>
        ) : !data?.has_data ? (
          <div className="flex items-center gap-2 text-slate-500 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-sm">{data?.message ?? 'No comparison data available'}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-green-50">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium text-green-700">In Sync</span>
                </div>
                <div className="text-2xl font-bold text-green-700">{inSyncCount}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-xs font-medium text-red-700">Out of Sync</span>
                </div>
                <div className="text-2xl font-bold text-red-700">{outOfSyncCount}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-100">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-slate-600">Total</span>
                </div>
                <div className="text-2xl font-bold text-slate-700">{totalDevices}</div>
              </div>
            </div>
            {totalDevices > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Sync Progress</span>
                  <span>{inSyncPercent.toFixed(0)}% in sync</span>
                </div>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      inSyncPercent === 100
                        ? 'bg-green-500'
                        : inSyncPercent >= 80
                          ? 'bg-green-400'
                          : inSyncPercent >= 50
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                    )}
                    style={{ width: `${inSyncPercent}%` }}
                  />
                </div>
              </div>
            )}
            {data.completed_at && (
              <div className="text-xs text-slate-400 pt-1">
                Last compared: {new Date(data.completed_at).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
