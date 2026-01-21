'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, Database } from 'lucide-react'
import { useCacheSettings } from '../hooks/use-cache-queries'
import { useCacheStats } from '../hooks/use-cache-queries'

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
            <span className="text-gray-600">Cache Status:</span>
            <span className={`font-medium ${settings.enabled ? 'text-green-600' : 'text-red-600'}`}>
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">TTL:</span>
            <span className="font-medium">{settings.ttl_seconds}s</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Max Commits:</span>
            <span className="font-medium">{settings.max_commits}</span>
          </div>

          {stats && (
            <>
              <Separator />
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Cache Size:</span>
                <span className="font-medium">{stats.overview.total_size_mb.toFixed(2)} MB</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Total Entries:</span>
                <span className="font-medium">{stats.overview.total_items}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Valid Entries:</span>
                <span className="font-medium text-green-600">{stats.overview.valid_items}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Expired Entries:</span>
                <span className="font-medium text-red-600">{stats.overview.expired_items}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Hit Rate:</span>
                <span className="font-medium text-blue-600">{stats.performance.hit_rate_percent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Uptime:</span>
                <span className="font-medium">{Math.floor(stats.overview.uptime_seconds / 60)}m</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Changes indicator */}
      {hasChanges && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Unsaved Changes</span>
            </div>
            <p className="text-xs text-yellow-700 mt-1">
              Don&apos;t forget to save your changes!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
