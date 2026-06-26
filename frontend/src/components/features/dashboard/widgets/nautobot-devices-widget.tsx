'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Server, Loader2, AlertTriangle } from 'lucide-react'
import { useNautobotStatsQuery } from '@/hooks/queries/use-nautobot-stats-query'

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

export function NautobotDevicesWidget() {
  const { data, isLoading, isError } = useNautobotStatsQuery()

  return (
    <Card className="analytics-card border-0 h-full transition-all duration-300 hover:shadow-analytics-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="p-3 rounded-xl bg-blue-100 ring-1 ring-white/20">
            <Server className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-slate-900">
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              ) : isError ? (
                <AlertTriangle className="h-8 w-8 text-red-500" />
              ) : (
                formatNumber(data?.devices ?? 0)
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardTitle className="text-sm font-semibold text-slate-700 mb-2">
          Total Nautobot Devices
        </CardTitle>
        <p className="text-xs text-slate-500 leading-relaxed">Network devices in Nautobot</p>
      </CardContent>
    </Card>
  )
}
