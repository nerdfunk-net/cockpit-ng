'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useApi } from '@/hooks/use-api'
import { Network, AlertTriangle, Loader2 } from 'lucide-react'

interface IPAddressesResult {
  has_data: boolean
  message?: string
  job_id?: number
  job_name?: string
  completed_at?: string
  total?: number
  filter_field?: string
  filter_type?: string | null
  filter_value?: string
  include_null?: boolean
  success?: boolean
}

interface DashboardIPAddressesStatsProps {
  refreshTrigger?: number
}

export default function DashboardIPAddressesStats({ refreshTrigger = 0 }: DashboardIPAddressesStatsProps) {
  const { apiCall } = useApi()
  const [data, setData] = useState<IPAddressesResult | null>(null)
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
      const result = await apiCall<IPAddressesResult>('job-runs/dashboard/ip-addresses')
      setData(result)
    } catch (err) {
      console.error('Error fetching IP addresses stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString()

  const filterLabel = (() => {
    if (!data?.filter_field) return null
    const op = data.filter_type && data.filter_type !== '__eq__' ? `__${data.filter_type}` : ''
    return `${data.filter_field}${op} = "${data.filter_value ?? ''}"`
  })()

  return (
    <Card className="analytics-card border-0 transition-all duration-300 hover:shadow-analytics-lg col-span-1 md:col-span-2">
      <CardContent className="p-4">
        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            <span className="text-sm text-slate-500">Loading...</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        ) : !data?.has_data ? (
          <div className="flex items-center gap-2 text-slate-500">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-sm">{data?.message || 'No data available'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            {/* Icon + title */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="p-2 rounded-xl bg-emerald-100 ring-1 ring-white/20">
                <Network className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-slate-700">Old IP Addresses</CardTitle>
                <p className="text-xs text-slate-500">Latest list result</p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-12 w-px bg-slate-200 shrink-0" />

            {/* Number + filter + timestamp */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-emerald-700">{data.total ?? 0}</span>
                <span className="text-xs font-medium text-emerald-600">Total Found</span>
              </div>
              {filterLabel && (
                <code className="block text-xs text-emerald-800 font-mono bg-emerald-50 border border-emerald-200 rounded px-2 py-1 break-all">
                  {filterLabel}
                </code>
              )}
              {data.completed_at && (
                <p className="text-xs text-slate-400">Last run: {formatDate(data.completed_at)}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
