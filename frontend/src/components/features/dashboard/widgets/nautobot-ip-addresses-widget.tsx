'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Network, Loader2, AlertTriangle } from 'lucide-react'
import { IconChip } from '@/components/shared/icon-chip'
import { useNautobotStatsQuery } from '@/hooks/queries/use-nautobot-stats-query'

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

export function NautobotIPAddressesWidget() {
  const { data, isLoading, isError } = useNautobotStatsQuery()

  return (
    <Card className="analytics-card border-0 h-full transition-all duration-300 hover:shadow-analytics-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <IconChip variant="info" className="p-3 rounded-xl">
            <Network className="h-6 w-6" />
          </IconChip>
          <div className="text-right">
            <div className="text-3xl font-bold text-foreground">
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : isError ? (
                <AlertTriangle className="h-8 w-8 text-error-foreground" />
              ) : (
                formatNumber(data?.ip_addresses ?? 0)
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardTitle className="text-sm font-semibold text-foreground mb-2">
          IP Addresses
        </CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">Assigned IP addresses</p>
      </CardContent>
    </Card>
  )
}
