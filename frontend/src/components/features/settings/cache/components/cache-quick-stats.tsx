'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Database } from 'lucide-react'
import { useCacheSettings } from '../hooks/use-cache-queries'
import { useCacheStats } from '../hooks/use-cache-queries'
import { StatusAlert } from '@/components/shared/status-alert'

interface CacheQuickStatsProps {
  hasChanges?: boolean
}

export function CacheQuickStats({ hasChanges = false }: CacheQuickStatsProps) {
  const { data: settings } = useCacheSettings()
  const { data: stats } = useCacheStats({ enabled: true })

  if (!settings) return null

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            Quick Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Cache Status:</span>
            <span
              className={`font-medium ${settings.enabled ? 'text-success-foreground' : 'text-error-foreground'}`}
            >
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">TTL:</span>
            <span className="font-medium">{settings.ttl_seconds}s</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Max Commits:</span>
            <span className="font-medium">{settings.max_commits}</span>
          </div>

          {stats && (
            <>
              <Separator />
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Cache Size:</span>
                <span className="font-medium">
                  {stats.overview.total_size_mb.toFixed(2)} MB
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Entries:</span>
                <span className="font-medium">{stats.overview.total_items}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Valid Entries:</span>
                <span className="font-medium text-success-foreground">
                  {stats.overview.valid_items}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Expired Entries:</span>
                <span className="font-medium text-error-foreground">
                  {stats.overview.expired_items}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Hit Rate:</span>
                <span className="font-medium text-info-foreground">
                  {stats.performance.hit_rate_percent.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Uptime:</span>
                <span className="font-medium">
                  {Math.floor(stats.overview.uptime_seconds / 60)}m
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Changes indicator */}
      {hasChanges && (
        <StatusAlert variant="warning">
          <span className="font-medium">Unsaved Changes</span>
          <p className="text-xs mt-1">Don&apos;t forget to save your changes!</p>
        </StatusAlert>
      )}
    </div>
  )
}
