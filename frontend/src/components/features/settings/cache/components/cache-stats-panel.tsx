'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HardDrive, RefreshCw, Database, Trash2 } from 'lucide-react'
import { useCacheStats } from '../hooks/use-cache-queries'
import { useCacheMutations } from '../hooks/use-cache-mutations'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

interface CacheStatsPanelProps {
  onLoadNamespace?: (namespace: string) => void
}

const DEFAULT_PROPS: CacheStatsPanelProps = {}

export function CacheStatsPanel({
  onLoadNamespace,
}: CacheStatsPanelProps = DEFAULT_PROPS) {
  const { data: stats, isLoading, refetch } = useCacheStats()
  const { clearCache } = useCacheMutations()
  const { confirmDialog, openConfirm } = useConfirmDialog()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading statistics...</span>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
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
          Comprehensive cache performance metrics and namespace breakdown. Statistics
          are stored in Redis and persist across application restarts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Performance Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-info p-4 rounded-lg">
              <div className="text-2xl font-bold text-info-foreground">
                {stats.overview.total_items}
              </div>
              <div className="text-sm text-info-foreground">Total Entries</div>
            </div>
            <div className="bg-success p-4 rounded-lg">
              <div className="text-2xl font-bold text-success-foreground">
                {stats.overview.valid_items}
              </div>
              <div className="text-sm text-success-foreground">Valid Entries</div>
            </div>
            <div className="bg-error p-4 rounded-lg">
              <div className="text-2xl font-bold text-error-foreground">
                {stats.overview.expired_items}
              </div>
              <div className="text-sm text-error-foreground">Expired Entries</div>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {stats.performance.hit_rate_percent.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Hit Rate</div>
            </div>
          </div>

          {/* Additional Performance Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-lg font-bold text-foreground">
                {stats.performance.cache_hits}
              </div>
              <div className="text-xs text-muted-foreground">Cache Hits</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-lg font-bold text-foreground">
                {stats.performance.cache_misses}
              </div>
              <div className="text-xs text-muted-foreground">Cache Misses</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-lg font-bold text-foreground">
                {stats.overview.total_size_mb.toFixed(2)} MB
              </div>
              <div className="text-xs text-muted-foreground">Memory Usage</div>
            </div>
          </div>

          {/* Namespace Breakdown */}
          {stats.namespaces && Object.keys(stats.namespaces).length > 0 && (
            <div>
              <h4 className="text-lg font-medium mb-3">Cache Namespaces</h4>
              <div className="space-y-2">
                {Object.entries(stats.namespaces).map(([namespace, info]) => (
                  <div
                    key={namespace}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{namespace}</div>
                      <div className="text-sm text-muted-foreground">
                        {info.count} entries •{' '}
                        {(info.size_bytes / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {onLoadNamespace && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onLoadNamespace(namespace)}
                          className="text-primary hover:text-primary border-border hover:border-primary/50"
                        >
                          <Database className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          openConfirm({
                            title: `Clear the "${namespace}" namespace?`,
                            description:
                              'This will remove all cache entries in this namespace.',
                            onConfirm: () => clearCache.mutate(namespace),
                            variant: 'destructive',
                          })
                        }}
                        disabled={clearCache.isPending}
                        className="text-error-foreground hover:text-error-foreground border-error-border hover:border-error-border"
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
      <ConfirmDialog {...confirmDialog} />
    </Card>
  )
}
