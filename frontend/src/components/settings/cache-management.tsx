'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { Separator } from '../ui/separator'
import { 
  Settings, 
  Zap, 
  BarChart3, 
  Trash2, 
  Save, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Database,
  HardDrive,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useApi } from '../../hooks/use-api'

interface CacheSettings {
  enabled: boolean
  ttl_seconds: number
  prefetch_on_startup: boolean
  refresh_interval_minutes: number
  max_commits: number
  prefetch_items?: {
    git?: boolean
    locations?: boolean
  }
}

interface CacheStats {
  cache_size: number
  total_entries: number
  hit_count: number
  miss_count: number
  hit_rate: number
  namespaces: Record<string, number>
}

interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

export default function CacheManagement() {
  const { apiCall } = useApi()
  const [settings, setSettings] = useState<CacheSettings>({
    enabled: true,
    ttl_seconds: 600,
    prefetch_on_startup: true,
    refresh_interval_minutes: 15,
    max_commits: 500,
    prefetch_items: {
      git: true,
      locations: false
    }
  })
  const [originalSettings, setOriginalSettings] = useState<CacheSettings | null>(null)
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)

  const showMessage = (text: string, type: StatusMessage['type'] = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await apiCall<{ success: boolean; data: CacheSettings }>('settings/cache')
      if (response?.success && response.data) {
        const loadedSettings = {
          ...response.data,
          prefetch_items: response.data.prefetch_items || { git: true, locations: false }
        }
        setSettings(loadedSettings)
        setOriginalSettings(loadedSettings)
      } else {
        showMessage('Failed to load cache settings', 'error')
      }
    } catch (error) {
      console.error('Error loading cache settings:', error)
      showMessage('Error loading cache settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const response = await apiCall<{ success: boolean; message?: string }>('settings/cache', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response?.success) {
        setOriginalSettings(settings)
        showMessage('Cache settings saved successfully', 'success')
        await loadSettings() // Reload to get persisted values
      } else {
        showMessage(`Failed to save settings: ${response?.message || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      console.error('Error saving cache settings:', error)
      showMessage('Error saving cache settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const response = await apiCall<{ success: boolean; data: CacheStats }>('cache/stats')
      if (response?.success && response.data) {
        setStats(response.data)
      } else {
        showMessage('Failed to load cache statistics', 'error')
      }
    } catch (error) {
      console.error('Error loading cache stats:', error)
      showMessage('Error loading cache statistics', 'error')
    } finally {
      setLoadingStats(false)
    }
  }

  const clearCache = async (namespace?: string) => {
    const confirmMessage = namespace 
      ? `Are you sure you want to clear the "${namespace}" cache namespace?`
      : 'Are you sure you want to clear the entire cache?'
    
    if (!confirm(confirmMessage)) return

    setClearingCache(true)
    try {
      const body = namespace ? { namespace } : {}
      const response = await apiCall<{ success: boolean; message?: string }>('cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response?.success) {
        showMessage(response.message || 'Cache cleared successfully', 'success')
        if (showStats) {
          await loadStats() // Refresh stats if visible
        }
      } else {
        showMessage(`Failed to clear cache: ${response?.message || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      console.error('Error clearing cache:', error)
      showMessage('Error clearing cache', 'error')
    } finally {
      setClearingCache(false)
    }
  }

  const hasChanges = originalSettings && JSON.stringify(settings) !== JSON.stringify(originalSettings)

  useEffect(() => {
    loadSettings()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-yellow-100 p-2 rounded-lg">
              <Settings className="h-6 w-6 text-yellow-600 animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Cache Settings</h1>
              <p className="text-gray-600">Loading cache configuration...</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
        </div>
      </div>
    )
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

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-md border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : message.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' && <CheckCircle className="h-4 w-4" />}
            {message.type === 'error' && <AlertCircle className="h-4 w-4" />}
            {message.type === 'info' && <Clock className="h-4 w-4" />}
            {message.text}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Settings className="h-4 w-4" />
                Cache Configuration
              </CardTitle>
              <CardDescription className="text-blue-50 text-sm">
                Configure caching behavior to optimize performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Cache */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Enable Cache</Label>
                  <p className="text-sm text-gray-500">
                    Turn caching on or off globally
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked: boolean) => setSettings(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              <Separator />

              {/* TTL */}
              <div className="space-y-2">
                <Label htmlFor="ttl">TTL (Time To Live) - Seconds</Label>
                <Input
                  id="ttl"
                  type="number"
                  min="30"
                  step="30"
                  value={settings.ttl_seconds}
                  onChange={(e) => setSettings(prev => ({ ...prev, ttl_seconds: parseInt(e.target.value) || 600 }))}
                  placeholder="600"
                />
                <p className="text-sm text-gray-500">
                  How long to keep cached items before refreshing (minimum 30 seconds)
                </p>
              </div>

              {/* Prefetch on Startup */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Prefetch on Startup</Label>
                  <p className="text-sm text-gray-500">
                    Warm the cache when the backend starts
                  </p>
                </div>
                <Switch
                  checked={settings.prefetch_on_startup}
                  onCheckedChange={(checked: boolean) => setSettings(prev => ({ ...prev, prefetch_on_startup: checked }))}
                />
              </div>

              {/* Refresh Interval */}
              <div className="space-y-2">
                <Label htmlFor="refresh">Refresh Interval - Minutes</Label>
                <Input
                  id="refresh"
                  type="number"
                  min="0"
                  step="1"
                  value={settings.refresh_interval_minutes}
                  onChange={(e) => setSettings(prev => ({ ...prev, refresh_interval_minutes: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
                <p className="text-sm text-gray-500">
                  Automatic background refresh interval (0 disables periodic refresh)
                </p>
              </div>

              {/* Prefetch Items */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Startup Prefetch Items</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="prefetch-git"
                      checked={settings.prefetch_items?.git || false}
                      onCheckedChange={(checked: boolean) => setSettings(prev => ({
                        ...prev,
                        prefetch_items: { ...prev.prefetch_items, git: checked }
                      }))}
                    />
                    <Label htmlFor="prefetch-git" className="text-sm font-normal">
                      Git commits
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="prefetch-locations"
                      checked={settings.prefetch_items?.locations || false}
                      onCheckedChange={(checked: boolean) => setSettings(prev => ({
                        ...prev,
                        prefetch_items: { ...prev.prefetch_items, locations: checked }
                      }))}
                    />
                    <Label htmlFor="prefetch-locations" className="text-sm font-normal">
                      Locations
                    </Label>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Select items to warm on backend startup
                </p>
              </div>

              {/* Max Commits */}
              <div className="space-y-2">
                <Label htmlFor="max-commits">Max Commits</Label>
                <Input
                  id="max-commits"
                  type="number"
                  min="50"
                  step="50"
                  value={settings.max_commits}
                  onChange={(e) => setSettings(prev => ({ ...prev, max_commits: parseInt(e.target.value) || 500 }))}
                  placeholder="500"
                />
                <p className="text-sm text-gray-500">
                  Limit how many commits are prefetched and returned
                </p>
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={saveSettings}
                  disabled={saving || !hasChanges}
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Settings
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowStats(!showStats)
                    if (!showStats && !stats) {
                      loadStats()
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  {showStats ? 'Hide' : 'Show'} Cache Stats
                  {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => clearCache()}
                  disabled={clearingCache}
                  className="flex items-center gap-2"
                >
                  {clearingCache ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Clear Cache
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cache Stats Sidebar */}
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
                    <span className="font-medium">{(stats.cache_size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Total Entries:</span>
                    <span className="font-medium">{stats.total_entries}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Cache Hits:</span>
                    <span className="font-medium text-green-600">{stats.hit_count}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Cache Misses:</span>
                    <span className="font-medium text-red-600">{stats.miss_count}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Hit Rate:</span>
                    <span className="font-medium text-blue-600">{(stats.hit_rate * 100).toFixed(1)}%</span>
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
      </div>

      {/* Detailed Stats Panel */}
      {showStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Detailed Cache Statistics
            </CardTitle>
            <CardDescription>
              Comprehensive cache performance metrics and namespace breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading statistics...</span>
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Performance Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{stats.total_entries}</div>
                    <div className="text-sm text-blue-700">Total Entries</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{stats.hit_count}</div>
                    <div className="text-sm text-green-700">Cache Hits</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{stats.miss_count}</div>
                    <div className="text-sm text-red-700">Cache Misses</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {(stats.hit_rate * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-purple-700">Hit Rate</div>
                  </div>
                </div>

                {/* Namespace Breakdown */}
                {stats.namespaces && Object.keys(stats.namespaces).length > 0 && (
                  <div>
                    <h4 className="text-lg font-medium mb-3">Cache Namespaces</h4>
                    <div className="space-y-2">
                      {Object.entries(stats.namespaces).map(([namespace, count]) => (
                        <div key={namespace} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">{namespace}</div>
                            <div className="text-sm text-gray-500">{count} entries</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => clearCache(namespace)}
                            disabled={clearingCache}
                            className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Refresh Stats Button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={loadStats}
                    disabled={loadingStats}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`} />
                    Refresh Stats
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Failed to load cache statistics
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
