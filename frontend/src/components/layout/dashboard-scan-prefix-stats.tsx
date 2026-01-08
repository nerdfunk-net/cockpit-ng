'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import {
  Network,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Activity,
  Layers
} from 'lucide-react'

interface ScanPrefixResult {
  has_data: boolean
  message?: string
  job_id?: number
  job_name?: string
  completed_at?: string
  total_prefixes?: number
  total_ips_scanned?: number
  total_reachable?: number
  total_unreachable?: number
  reachability_percent?: number
  resolve_dns?: boolean
  success?: boolean
  was_split?: boolean
}

interface DashboardScanPrefixStatsProps {
  refreshTrigger?: number
}

export default function DashboardScanPrefixStats({ refreshTrigger = 0 }: DashboardScanPrefixStatsProps) {
  const { apiCall } = useApi()
  const [data, setData] = useState<ScanPrefixResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await apiCall<ScanPrefixResult>('job-runs/dashboard/scan-prefix')
      setData(result)
    } catch (err) {
      console.error('Error fetching scan prefix stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  // Calculate values
  const totalIpsScanned = data?.total_ips_scanned ?? 0
  const totalReachable = data?.total_reachable ?? 0
  const totalUnreachable = data?.total_unreachable ?? 0
  const totalPrefixes = data?.total_prefixes ?? 0
  const reachabilityPercent = data?.reachability_percent ?? 0

  return (
    <Card className="analytics-card border-0 transition-all duration-300 hover:shadow-analytics-lg col-span-1 md:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
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
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            <span className="ml-2 text-sm text-slate-500">Loading scan data...</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-600 py-4">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        ) : !data?.has_data ? (
          <div className="flex items-center gap-2 text-slate-500 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-sm">{data?.message || 'No scan data available'}</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Prefixes */}
              <div className="text-center p-3 rounded-lg bg-indigo-50">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-medium text-indigo-700">Prefixes</span>
                </div>
                <div className="text-2xl font-bold text-indigo-700">{totalPrefixes}</div>
              </div>

              {/* Total IPs */}
              <div className="text-center p-3 rounded-lg bg-blue-50">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Network className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">Total IPs</span>
                </div>
                <div className="text-2xl font-bold text-blue-700">{formatNumber(totalIpsScanned)}</div>
              </div>

              {/* Reachable */}
              <div className="text-center p-3 rounded-lg bg-green-50">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium text-green-700">Reachable</span>
                </div>
                <div className="text-2xl font-bold text-green-700">{formatNumber(totalReachable)}</div>
              </div>

              {/* Unreachable */}
              <div className="text-center p-3 rounded-lg bg-slate-100">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <XCircle className="h-4 w-4 text-slate-600" />
                  <span className="text-xs font-medium text-slate-600">Unreachable</span>
                </div>
                <div className="text-2xl font-bold text-slate-700">{formatNumber(totalUnreachable)}</div>
              </div>
            </div>

            {/* Progress Bar */}
            {totalIpsScanned > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Reachability Rate</span>
                  <span>{reachabilityPercent.toFixed(1)}% reachable</span>
                </div>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      reachabilityPercent >= 90 ? "bg-green-500" :
                      reachabilityPercent >= 70 ? "bg-green-400" :
                      reachabilityPercent >= 50 ? "bg-amber-400" : "bg-red-400"
                    )}
                    style={{ width: `${reachabilityPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Additional Info */}
            {data.resolve_dns && (
              <div className="flex justify-center">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">DNS Resolved</span>
              </div>
            )}

            {/* Last Updated */}
            {data.completed_at && (
              <div className="text-xs text-slate-400 pt-1 border-t border-slate-200">
                Last scanned: {formatDate(data.completed_at)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
