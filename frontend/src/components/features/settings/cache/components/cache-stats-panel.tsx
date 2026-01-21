'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HardDrive, RefreshCw, Database, Trash2 } from 'lucide-react'
import { useCacheStats } from '../hooks/use-cache-queries'
import { useCacheMutations } from '../hooks/use-cache-mutations'

interface CacheStatsPanelProps {
  onLoadNamespace?: (namespace: string) => void
}

const DEFAULT_PROPS: CacheStatsPanelProps = {}

export function CacheStatsPanel({ onLoadNamespace }: CacheStatsPanelProps = DEFAULT_PROPS) {
  const { data: stats, isLoading, refetch } = useCacheStats()
  const { clearCache } = useCacheMutations()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading statistics...</span>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-gray-500">
          Failed to load cache statistics
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Detailed Cache Statistics
        </CardTitle>
        <CardDescription>
          Comprehensive cache performance metrics and namespace breakdown.
          Statistics are stored in Redis and persist across application restarts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Performance Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.overview.total_items}</div>
              <div className="text-sm text-blue-700">Total Entries</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.overview.valid_items}</div>
              <div className="text-sm text-green-700">Valid Entries</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.overview.expired_items}</div>
              <div className="text-sm text-orange-700">Expired Entries</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats.performance.hit_rate_percent.toFixed(1)}%
              </div>
              <div className="text-sm text-purple-700">Hit Rate</div>
            </div>
          </div>

          {/* Additional Performance Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-lg font-bold text-gray-600">{stats.performance.cache_hits}</div>
              <div className="text-xs text-gray-600">Cache Hits</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-lg font-bold text-gray-600">{stats.performance.cache_misses}</div>
              <div className="text-xs text-gray-600">Cache Misses</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-lg font-bold text-gray-600">{stats.overview.total_size_mb.toFixed(2)} MB</div>
              <div className="text-xs text-gray-600">Memory Usage</div>
            </div>
          </div>

          {/* Namespace Breakdown */}
          {stats.namespaces && Object.keys(stats.namespaces).length > 0 && (
            <div>
              <h4 className="text-lg font-medium mb-3">Cache Namespaces</h4>
              <div className="space-y-2">
                {Object.entries(stats.namespaces).map(([namespace, info]) => (
                  <div key={namespace} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{namespace}</div>
                      <div className="text-sm text-gray-500">
                        {info.count} entries • {(info.size_bytes / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {onLoadNamespace && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onLoadNamespace(namespace)}
                          className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300"
                        >
                          <Database className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Clear the "${namespace}" namespace?`)) {
                            clearCache.mutate(namespace)
                          }
                        }}
                        disabled={clearCache.isPending}
                        className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Stats
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
