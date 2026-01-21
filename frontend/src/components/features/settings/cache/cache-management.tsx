'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Zap, BarChart3, Database, Clock, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { CacheSettingsForm } from './components/cache-settings-form'
import { CacheQuickStats } from './components/cache-quick-stats'
import { CacheStatsPanel } from './components/cache-stats-panel'
import { CacheEntriesList } from './components/cache-entries-list'
import { useCacheMutations } from './hooks/use-cache-mutations'

export default function CacheManagement() {
  const [showStats, setShowStats] = useState(false)
  const [showEntries, setShowEntries] = useState(false)

  const { clearCache, cleanupExpired } = useCacheMutations()

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear the entire cache?')) {
      clearCache.mutate(undefined)
    }
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-yellow-100 p-2 rounded-lg">
            <Zap className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Cache Settings</h1>
            <p className="text-gray-600">Control performance-related caching</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          <CacheSettingsForm />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setShowStats(!showStats)}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              {showStats ? 'Hide' : 'Show'} Stats
              {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowEntries(!showEntries)}
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              {showEntries ? 'Hide' : 'Show'} Entries
              {showEntries ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              onClick={() => cleanupExpired.mutate()}
              disabled={cleanupExpired.isPending}
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Cleanup Expired
            </Button>

            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={clearCache.isPending}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear All Cache
            </Button>
          </div>

          {/* Conditional Panels */}
          {showStats && (
            <CacheStatsPanel />
          )}

          {showEntries && (
            <CacheEntriesList />
          )}
        </div>

        {/* Quick Stats Sidebar */}
        <div>
          <CacheQuickStats />
        </div>
      </div>
    </div>
  )
}
