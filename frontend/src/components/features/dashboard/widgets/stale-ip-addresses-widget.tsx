'use client'

import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Network, AlertTriangle, Loader2 } from 'lucide-react'
import { useIPAddressesQuery } from '@/hooks/queries/use-ip-addresses-query'

export function StaleIPAddressesWidget() {
  const { data, isLoading, isError } = useIPAddressesQuery()

  const filterLabel = (() => {
    if (!data?.filter_field) return null
    const op =
      data.filter_type && data.filter_type !== '__eq__' ? `__${data.filter_type}` : ''
    return `${data.filter_field}${op} = "${data.filter_value ?? ''}"`
  })()

  return (
    <Card className="analytics-card border-0 h-full transition-all duration-300 hover:shadow-analytics-lg">
      <CardContent className="p-4 h-full flex flex-col justify-center">
        {isLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            <span className="text-sm text-slate-500">Loading...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">Failed to load data</span>
          </div>
        ) : !data?.has_data ? (
          <div className="flex items-center gap-2 text-slate-500">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-sm">{data?.message ?? 'No data available'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 shrink-0">
              <div className="p-2 rounded-xl bg-emerald-100 ring-1 ring-white/20">
                <Network className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-slate-700">
                  Stale IP Addresses
                </CardTitle>
                <p className="text-xs text-slate-500">Latest list result</p>
              </div>
            </div>
            <div className="h-12 w-px bg-slate-200 shrink-0" />
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
                <p className="text-xs text-slate-400">
                  Last run: {new Date(data.completed_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
