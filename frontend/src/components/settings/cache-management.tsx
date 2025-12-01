'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
    devices?: boolean
  }
  // Cache task intervals (in minutes) - 0 means disabled
  devices_cache_interval_minutes?: number
  locations_cache_interval_minutes?: number
  git_commits_cache_interval_minutes?: number
}

interface CacheStats {
  overview: {
    total_items: number
    valid_items: number
    expired_items: number
    total_size_bytes: number
    total_size_mb: number
    uptime_seconds: number
  }
  performance: {
    cache_hits: number
    cache_misses: number
    hit_rate_percent: number
    expired_entries: number
    entries_created: number
    entries_cleared: number
  }
  namespaces: Record<string, { count: number; size_bytes: number }>
  keys: string[]
}

interface CacheEntry {
  key: string
  namespace: string
  created_at: number
  expires_at: number
  last_accessed: number
  access_count: number
  size_bytes: number
  age_seconds: number
  ttl_seconds: number
  last_accessed_ago: number
  is_expired: boolean
}

interface NamespaceInfo {
  namespace: string
  total_entries: number
  valid_entries: number
  expired_entries: number
  total_size_bytes: number
  total_size_mb: number
  entries: CacheEntry[]
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
      locations: false,
      devices: false
    },
    devices_cache_interval_minutes: 60,
    locations_cache_interval_minutes: 10,
    git_commits_cache_interval_minutes: 15
  })
  const [originalSettings, setOriginalSettings] = useState<CacheSettings | null>(null)
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [entries, setEntries] = useState<CacheEntry[]>([])
  const [namespaceInfo, setNamespaceInfo] = useState<NamespaceInfo | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [showEntries, setShowEntries] = useState(false)
  const [includeExpired, setIncludeExpired] = useState(false)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [loadingNamespace, setLoadingNamespace] = useState(false)

  const showMessage = useCallback((text: string, type: StatusMessage['type'] = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }, [])

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiCall<{ success: boolean; data: CacheSettings }>('settings/cache')
      if (response?.success && response.data) {
        const loadedSettings = {
          ...response.data,
          prefetch_items: response.data.prefetch_items || { git: true, locations: false, devices: false },
          devices_cache_interval_minutes: response.data.devices_cache_interval_minutes ?? 60,
          locations_cache_interval_minutes: response.data.locations_cache_interval_minutes ?? 10,
          git_commits_cache_interval_minutes: response.data.git_commits_cache_interval_minutes ?? 15
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
  }, [apiCall, showMessage])

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

  const loadEntries = async () => {
    setLoadingEntries(true)
    try {
      const response = await apiCall<{ success: boolean; data: CacheEntry[]; count: number }>(`cache/entries?include_expired=${includeExpired}`)
      if (response?.success && response.data) {
        setEntries(response.data)
      } else {
        showMessage('Failed to load cache entries', 'error')
      }
    } catch (error) {
      console.error('Error loading cache entries:', error)
      showMessage('Error loading cache entries', 'error')
    } finally {
      setLoadingEntries(false)
    }
  }

  const loadNamespaceInfo = async (namespace: string) => {
    setLoadingNamespace(true)
    try {
      const response = await apiCall<{ success: boolean; data: NamespaceInfo }>(`cache/namespace/${namespace}`)
      if (response?.success && response.data) {
        setNamespaceInfo(response.data)
      } else {
        showMessage(`Failed to load namespace '${namespace}' information`, 'error')
      }
    } catch (error) {
      console.error('Error loading namespace info:', error)
      showMessage('Error loading namespace information', 'error')
    } finally {
      setLoadingNamespace(false)
    }
  }

  const cleanupExpired = async () => {
    setClearingCache(true)
    try {
      const response = await apiCall<{ success: boolean; message?: string; removed_count?: number }>('cache/cleanup', {
        method: 'POST'
      })

      if (response?.success) {
        showMessage(response.message || `Removed ${response.removed_count || 0} expired entries`, 'success')
        if (showStats) {
          await loadStats()
        }
        if (showEntries) {
          await loadEntries()
        }
      } else {
        showMessage(`Failed to cleanup expired entries: ${response?.message || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      console.error('Error cleaning up expired entries:', error)
      showMessage('Error cleaning up expired entries', 'error')
    } finally {
      setClearingCache(false)
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
      const response = await apiCall<{ success: boolean; message?: string; cleared_count?: number }>('cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response?.success) {
        showMessage(response.message || 'Cache cleared successfully', 'success')
        if (showStats) {
          await loadStats() // Refresh stats if visible
        }
        if (showEntries) {
          await loadEntries() // Refresh entries if visible
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
  }, [loadSettings])

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
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            {/* Compact Header */}
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <div>
                  <h1 className="text-sm font-semibold">Cache Configuration</h1>
                  <p className="text-blue-100 text-xs">Configure caching behavior to optimize performance</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
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
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="prefetch-devices"
                      checked={settings.prefetch_items?.devices || false}
                      onCheckedChange={(checked: boolean) => setSettings(prev => ({
                        ...prev,
                        prefetch_items: { ...prev.prefetch_items, devices: checked }
                      }))}
                    />
                    <Label htmlFor="prefetch-devices" className="text-sm font-normal">
                      Devices
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

              {/* Cache Task Intervals Section */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-medium">Background Cache Tasks</h3>
                  <p className="text-sm text-gray-500">
                    Configure how often background tasks refresh the cache. Set to 0 to disable a task.
                    These tasks will appear in Jobs → View.
                  </p>
                </div>
                
                {/* Devices Cache Interval */}
                <div className="space-y-2">
                  <Label htmlFor="devices-interval">Devices Cache Interval (minutes)</Label>
                  <Input
                    id="devices-interval"
                    type="number"
                    min="0"
                    step="5"
                    value={settings.devices_cache_interval_minutes ?? 60}
                    onChange={(e) => setSettings(prev => ({ ...prev, devices_cache_interval_minutes: parseInt(e.target.value) || 0 }))}
                    placeholder="60"
                  />
                  <p className="text-sm text-gray-500">
                    How often to refresh the devices cache from Nautobot (0 = disabled)
                  </p>
                </div>

                {/* Locations Cache Interval */}
                <div className="space-y-2">
                  <Label htmlFor="locations-interval">Locations Cache Interval (minutes)</Label>
                  <Input
                    id="locations-interval"
                    type="number"
                    min="0"
                    step="1"
                    value={settings.locations_cache_interval_minutes ?? 10}
                    onChange={(e) => setSettings(prev => ({ ...prev, locations_cache_interval_minutes: parseInt(e.target.value) || 0 }))}
                    placeholder="10"
                  />
                  <p className="text-sm text-gray-500">
                    How often to refresh the locations cache from Nautobot (0 = disabled)
                  </p>
                </div>

                {/* Git Commits Cache Interval */}
                <div className="space-y-2">
                  <Label htmlFor="git-interval">Git Commits Cache Interval (minutes)</Label>
                  <Input
                    id="git-interval"
                    type="number"
                    min="0"
                    step="1"
                    value={settings.git_commits_cache_interval_minutes ?? 15}
                    onChange={(e) => setSettings(prev => ({ ...prev, git_commits_cache_interval_minutes: parseInt(e.target.value) || 0 }))}
                    placeholder="15"
                  />
                  <p className="text-sm text-gray-500">
                    How often to refresh the git commits cache (0 = disabled)
                  </p>
                </div>
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-4">
                <Button
                  onClick={saveSettings}
                  disabled={saving || !hasChanges}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
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
                  {showStats ? 'Hide' : 'Show'} Stats
                  {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEntries(!showEntries)
                    if (!showEntries && entries.length === 0) {
                      loadEntries()
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <Database className="h-4 w-4" />
                  {showEntries ? 'Hide' : 'Show'} Entries
                  {showEntries ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                <Button
                  variant="outline"
                  onClick={cleanupExpired}
                  disabled={clearingCache}
                  className="flex items-center gap-2"
                >
                  {clearingCache ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                  Cleanup Expired
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
                  Clear All Cache
                </Button>
              </div>
            </div>
          </div>
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
                    <span className="text-gray-600">Cache Hits:</span>
                    <span className="font-medium text-green-600">{stats.performance.cache_hits}</span>
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadNamespaceInfo(namespace)}
                              disabled={loadingNamespace}
                              className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300"
                            >
                              <Database className="h-3 w-3" />
                            </Button>
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

      {/* Cache Entries Panel */}
      {showEntries && (
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
            {loadingEntries ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading cache entries...</span>
              </div>
            ) : entries && entries.length > 0 ? (
              <div className="space-y-4">
                {/* Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="include-expired"
                      checked={includeExpired}
                      onCheckedChange={(checked) => {
                        setIncludeExpired(checked)
                        loadEntries()
                      }}
                    />
                    <Label htmlFor="include-expired" className="text-sm">
                      Include expired entries
                    </Label>
                  </div>
                  <Button
                    variant="outline"
                    onClick={loadEntries}
                    disabled={loadingEntries}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingEntries ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                {/* Entries List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {entries.map((entry) => (
                    <div 
                      key={entry.key} 
                      className={`p-3 rounded-lg border ${
                        entry.is_expired 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm text-gray-900 truncate">
                            {entry.key}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            <span>NS: {entry.namespace}</span>
                            <span>Size: {(entry.size_bytes / 1024).toFixed(1)}KB</span>
                            <span>Accessed: {entry.access_count}x</span>
                            <span>Age: {Math.floor(entry.age_seconds / 60)}m</span>
                            {!entry.is_expired && (
                              <span className="text-green-600">
                                TTL: {Math.floor(entry.ttl_seconds / 60)}m
                              </span>
                            )}
                            {entry.is_expired && (
                              <span className="text-red-600">EXPIRED</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => clearCache(entry.namespace)}
                          disabled={clearingCache}
                          className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-sm text-gray-500 text-center">
                  Showing {entries.length} entries
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No cache entries found
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Namespace Details Modal */}
      {namespaceInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Namespace: {namespaceInfo.namespace}
            </CardTitle>
            <CardDescription>
              Detailed information about the &apos;{namespaceInfo.namespace}&apos; cache namespace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Namespace Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-xl font-bold text-blue-600">{namespaceInfo.total_entries}</div>
                  <div className="text-sm text-blue-700">Total Entries</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-xl font-bold text-green-600">{namespaceInfo.valid_entries}</div>
                  <div className="text-sm text-green-700">Valid Entries</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-xl font-bold text-red-600">{namespaceInfo.expired_entries}</div>
                  <div className="text-sm text-red-700">Expired Entries</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-xl font-bold text-purple-600">{namespaceInfo.total_size_mb.toFixed(2)} MB</div>
                  <div className="text-sm text-purple-700">Memory Usage</div>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setNamespaceInfo(null)}
                  className="flex items-center gap-2"
                >
                  Close Details
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
