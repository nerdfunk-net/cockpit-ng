'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Database, RefreshCw, Trash2 } from 'lucide-react'
import { useCacheEntries } from '../hooks/use-cache-queries'
import { useCacheMutations } from '../hooks/use-cache-mutations'
import type { CacheEntry } from '../types'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

const EMPTY_ENTRIES: CacheEntry[] = []

export function CacheEntriesList() {
  const [includeExpired, setIncludeExpired] = useState(false)
  const {
    data: entries = EMPTY_ENTRIES,
    isLoading,
    refetch,
  } = useCacheEntries(includeExpired)
  const { clearCache } = useCacheMutations()
  const { confirmDialog, openConfirm } = useConfirmDialog()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading cache entries...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Cache Entries
        </CardTitle>
        <CardDescription>
          Detailed view of individual cache entries with access patterns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="include-expired"
                checked={includeExpired}
                onCheckedChange={checked => {
                  setIncludeExpired(checked)
                }}
              />
              <Label htmlFor="include-expired" className="text-sm">
                Include expired entries
              </Label>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Entries List */}
          {entries.length > 0 ? (
            <>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {entries.map(entry => (
                  <div
                    key={entry.key}
                    className={`p-3 rounded-lg border ${
                      entry.is_expired ? 'status-error' : 'bg-card border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-foreground truncate">
                          {entry.key}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>NS: {entry.namespace}</span>
                          <span>Size: {(entry.size_bytes / 1024).toFixed(1)}KB</span>
                          <span>Accessed: {entry.access_count}x</span>
                          <span>Age: {Math.floor(entry.age_seconds / 60)}m</span>
                          {!entry.is_expired && (
                            <span className="text-success-foreground">
                              TTL: {Math.floor(entry.ttl_seconds / 60)}m
                            </span>
                          )}
                          {entry.is_expired && (
                            <span className="text-error-foreground">EXPIRED</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          openConfirm({
                            title: `Clear namespace "${entry.namespace}"?`,
                            description:
                              'This will remove all cache entries in this namespace.',
                            onConfirm: () => clearCache.mutate(entry.namespace),
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

              <div className="text-sm text-muted-foreground text-center">
                Showing {entries.length} entries
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No cache entries found
            </div>
          )}
        </div>
      </CardContent>
      <ConfirmDialog {...confirmDialog} />
    </Card>
  )
}
