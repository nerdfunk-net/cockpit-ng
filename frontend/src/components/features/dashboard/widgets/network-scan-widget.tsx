'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Network,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Activity,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanPrefixQuery } from '@/hooks/queries/use-scan-prefix-query'

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

export function NetworkScanWidget() {
  const { data, isLoading, isError } = useScanPrefixQuery()

  const totalIpsScanned = data?.total_ips_scanned ?? 0
  const totalReachable = data?.total_reachable ?? 0
  const totalUnreachable = data?.total_unreachable ?? 0
  const totalPrefixes = data?.total_prefixes ?? 0
  const reachabilityPercent = data?.reachability_percent ?? 0

  return (
    <Card className="analytics-card border-0 h-full transition-all duration-300 hover:shadow-analytics-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-100 ring-1 ring-white/20">
            <Activity className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-slate-700">
              Network Scan Status
            </CardTitle>
            <p className="text-xs text-slate-500">Latest prefix scan results</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            <span className="ml-2 text-sm text-slate-500">Loading scan data...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-red-600 py-4">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">Failed to load scan data</span>
          </div>
        ) : !data?.has_data ? (
          <div className="flex items-center gap-2 text-slate-500 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-sm">{data?.message ?? 'No scan data available'}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-indigo-50">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-medium text-indigo-700">Prefixes</span>
                </div>
                <div className="text-2xl font-bold text-indigo-700">{totalPrefixes}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Network className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">Total IPs</span>
                </div>
                <div className="text-2xl font-bold text-blue-700">{formatNumber(totalIpsScanned)}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium text-green-700">Reachable</span>
                </div>
                <div className="text-2xl font-bold text-green-700">{formatNumber(totalReachable)}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-100">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <XCircle className="h-4 w-4 text-slate-600" />
                  <span className="text-xs font-medium text-slate-600">Unreachable</span>
                </div>
                <div className="text-2xl font-bold text-slate-700">{formatNumber(totalUnreachable)}</div>
              </div>
            </div>
            {totalIpsScanned > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Reachability Rate</span>
                  <span>{reachabilityPercent.toFixed(1)}% reachable</span>
                </div>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      reachabilityPercent >= 90
                        ? 'bg-green-500'
                        : reachabilityPercent >= 70
                          ? 'bg-green-400'
                          : reachabilityPercent >= 50
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                    )}
                    style={{ width: `${reachabilityPercent}%` }}
                  />
                </div>
              </div>
            )}
            {data.completed_at && (
              <div className="text-xs text-slate-400 pt-1 border-t border-slate-200">
                Last scanned: {new Date(data.completed_at).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
