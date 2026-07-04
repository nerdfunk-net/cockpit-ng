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
import { IconChip } from '@/components/shared/icon-chip'
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
          <IconChip variant="info" className="p-2.5 rounded-xl">
            <Activity className="h-5 w-5" />
          </IconChip>
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">
              Network Scan Status
            </CardTitle>
            <p className="text-xs text-muted-foreground">Latest prefix scan results</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading scan data...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-error-foreground py-4">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">Failed to load scan data</span>
          </div>
        ) : !data?.has_data ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <AlertTriangle className="h-5 w-5 text-warning-foreground" />
            <span className="text-sm">{data?.message ?? 'No scan data available'}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Prefixes</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{totalPrefixes}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Total IPs</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{formatNumber(totalIpsScanned)}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-success">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                  <span className="text-xs font-medium text-success-foreground">Reachable</span>
                </div>
                <div className="text-2xl font-bold text-success-foreground">{formatNumber(totalReachable)}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Unreachable</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{formatNumber(totalUnreachable)}</div>
              </div>
            </div>
            {totalIpsScanned > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Reachability Rate</span>
                  <span>{reachabilityPercent.toFixed(1)}% reachable</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      reachabilityPercent >= 70
                        ? 'bg-success-foreground'
                        : reachabilityPercent >= 50
                          ? 'bg-warning-foreground'
                          : 'bg-error-foreground'
                    )}
                    style={{ width: `${reachabilityPercent}%` }}
                  />
                </div>
              </div>
            )}
            {data.completed_at && (
              <div className="text-xs text-muted-foreground pt-1 border-t border-border">
                Last scanned: {new Date(data.completed_at).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
