'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Radar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Network,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconChip } from '@/components/shared/icon-chip'
import { usePortScanQuery } from '@/hooks/queries/use-port-scan-query'

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

export function PortScanWidget() {
  const { data, isLoading, isError } = usePortScanQuery()

  const totalRuns = data?.total_runs ?? 0
  const totalNetworks = data?.total_networks ?? 0
  const totalIpsScanned = data?.total_ips_scanned ?? 0
  const totalReachable = data?.total_reachable ?? 0
  const totalUnreachable = data?.total_unreachable ?? 0
  const totalOpenTcp = data?.total_open_tcp_ports ?? 0
  const totalOpenUdp = data?.total_open_udp_ports ?? 0
  const reachabilityPercent = data?.reachability_percent ?? 0

  return (
    <Card className="analytics-card border-0 h-full gap-3 py-4 transition-all duration-300 hover:shadow-analytics-lg">
      <CardHeader className="px-4 pb-0">
        <div className="flex items-center gap-3">
          <IconChip variant="info" className="p-2.5 rounded-xl">
            <Radar className="h-5 w-5" />
          </IconChip>
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">
              Port Scan Summary
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Aggregated across{' '}
              {totalRuns > 0
                ? `${totalRuns} completed scan${totalRuns === 1 ? '' : 's'}`
                : 'all port scans'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading port scan data...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-error-foreground py-4">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">Failed to load port scan data</span>
          </div>
        ) : !data?.has_data ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <AlertTriangle className="h-5 w-5 text-warning-foreground" />
            <span className="text-sm">{data?.message ?? 'No port scan data available'}</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="text-center p-2.5 rounded-lg bg-muted">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Networks</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{totalNetworks}</div>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-muted">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Total IPs</span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {formatNumber(totalIpsScanned)}
                </div>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-success">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                  <span className="text-xs font-medium text-success-foreground">Reachable</span>
                </div>
                <div className="text-2xl font-bold text-success-foreground">
                  {formatNumber(totalReachable)}
                </div>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-muted">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Unreachable</span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {formatNumber(totalUnreachable)}
                </div>
              </div>
            </div>

            {totalIpsScanned > 0 && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>Reachability Rate</span>
                  <div className="flex items-center gap-2">
                    <span>{reachabilityPercent.toFixed(1)}% reachable</span>
                    <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                      TCP {formatNumber(totalOpenTcp)}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                      UDP {formatNumber(totalOpenUdp)}
                    </Badge>
                  </div>
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

            {data.latest_completed_at && (
              <div className="text-xs text-muted-foreground pt-1 border-t border-border">
                Last scan: {new Date(data.latest_completed_at).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
