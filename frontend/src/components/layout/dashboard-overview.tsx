'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import DashboardJobStats from '@/components/layout/dashboard-job-stats'
import DashboardDeviceBackupStatus from '@/components/layout/dashboard-device-backup-status'
import DashboardCheckmkSyncStatus from '@/components/layout/dashboard-checkmk-sync-status'
import DashboardScanPrefixStats from '@/components/layout/dashboard-scan-prefix-stats'
import {
  Server,
  MapPin,
  Network,
  Layers,
  RefreshCw,
  Clock,
  Database,
  Shield,
  Loader2,
  AlertTriangle
} from 'lucide-react'

interface DashboardStats {
  devices: number
  locations: number
  ip_addresses: number
  prefixes: number
}

interface CheckMKStats {
  total_hosts: number
  timestamp: string
}

interface CachedStats {
  stats: DashboardStats
  cacheTimestamp: string
}

type LoadingState = 'idle' | 'loading' | 'error' | 'success'

const CACHE_DURATION_MINUTES = 10
const CACHE_KEY = 'cockpit_dashboard_stats'

export default function DashboardOverview() {
  const { apiCall } = useApi()
  const [stats, setStats] = useState<DashboardStats>({
    devices: 0,
    locations: 0,
    ip_addresses: 0,
    prefixes: 0
  })
  const [checkmkStats, setCheckmkStats] = useState<CheckMKStats | null>(null)
  const [checkmkLoading, setCheckmkLoading] = useState(true)
  const [checkmkError, setCheckmkError] = useState<string | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')
  const [cacheInfo, setCacheInfo] = useState<string>('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    loadDashboardData()
    loadCheckmkData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadCheckmkData = async () => {
    try {
      setCheckmkLoading(true)
      setCheckmkError(null)
      const data = await apiCall<CheckMKStats>('checkmk/stats')
      setCheckmkStats(data)
    } catch (error) {
      console.error('Error fetching CheckMK stats:', error)
      setCheckmkError(error instanceof Error ? error.message : 'Failed to load CheckMK stats')
    } finally {
      setCheckmkLoading(false)
    }
  }

  const getCachedStats = (): DashboardStats | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return null

      const data: CachedStats = JSON.parse(cached)
      const cacheTime = new Date(data.cacheTimestamp)
      const now = new Date()
      const ageMinutes = (now.getTime() - cacheTime.getTime()) / (1000 * 60)

      if (ageMinutes < CACHE_DURATION_MINUTES) {
        const remainingMinutes = Math.ceil(CACHE_DURATION_MINUTES - ageMinutes)
        setCacheInfo(`📁 Cached data (expires in ${remainingMinutes}m)`)
        setLastUpdated(cacheTime)
        return data.stats
      } else {
        localStorage.removeItem(CACHE_KEY)
        return null
      }
    } catch {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
  }

  const cacheStats = (statsData: DashboardStats) => {
    try {
      const cacheData: CachedStats = {
        stats: statsData,
        cacheTimestamp: new Date().toISOString()
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
      setCacheInfo('📁 Cached data (expires in 10m)')
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to cache stats:', error)
    }
  }

  const loadDashboardData = async (force = false) => {
    // Check cache first unless forced refresh
    if (!force) {
      const cachedStats = getCachedStats()
      if (cachedStats) {
        setStats(cachedStats)
        setLoadingState('success')
        return
      }
    }

    setLoadingState('loading')
    setCacheInfo('🔄 Loading fresh data...')

    try {
      const data = await apiCall<DashboardStats>('nautobot/stats')
      setStats(data)
      cacheStats(data)
      setLoadingState('success')
    } catch (error) {
      console.error('Failed to load dashboard stats:', error)
      setLoadingState('error')
      setCacheInfo('❌ Failed to load data')
    }
  }

  const refreshData = () => {
    localStorage.removeItem(CACHE_KEY)
    setCacheInfo('')
    loadDashboardData(true)
    loadCheckmkData()
    // Trigger refresh for all child components
    setRefreshTrigger(prev => prev + 1)
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const statCards = [
    {
      title: 'Total Nautobot Devices',
      value: stats.devices,
      icon: Server,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      iconBg: 'bg-blue-100',
      description: 'Network devices in Nautobot'
    },
    {
      title: 'Total Locations',
      value: stats.locations,
      icon: MapPin,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      iconBg: 'bg-emerald-100',
      description: 'Physical locations'
    },
    {
      title: 'IP Addresses',
      value: stats.ip_addresses,
      icon: Network,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      iconBg: 'bg-cyan-100',
      description: 'Assigned IP addresses'
    },
    {
      title: 'Total Prefixes',
      value: stats.prefixes,
      icon: Layers,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      iconBg: 'bg-indigo-100',
      description: 'Network prefixes'
    }
  ]

  return (
    <div className="space-y-8 p-6 bg-slate-50/50 min-h-screen">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900">Cockpit Dashboard</h1>
          <p className="text-slate-600">Network infrastructure overview and real-time statistics</p>
        </div>
        <div className="flex items-center space-x-4">
          {cacheInfo && (
            <div className="flex items-center space-x-2 text-sm text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200">
              <Clock className="h-4 w-4" />
              <span>{cacheInfo}</span>
            </div>
          )}
          <Button
            onClick={refreshData}
            disabled={loadingState === 'loading'}
            size="sm"
            className="flex items-center space-x-2 button-analytics bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw className={cn(
              "h-4 w-4",
              loadingState === 'loading' && "animate-spin"
            )} />
            <span>Refresh Data</span>
          </Button>
        </div>
      </div>

      {/* Loading/Error States */}
      {loadingState === 'loading' && (
        <div className="status-info border rounded-xl p-4 analytics-card">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
            <span className="text-blue-800 font-medium">Loading dashboard statistics...</span>
          </div>
        </div>
      )}

      {loadingState === 'error' && (
        <div className="status-error border rounded-xl p-4 analytics-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Database className="h-5 w-5 text-red-500" />
              <span className="text-red-800 font-medium">
                Failed to load dashboard data. Please check your Nautobot connection.
              </span>
            </div>
            <Button onClick={refreshData} size="sm" variant="outline" className="button-analytics">
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {statCards.map((card) => {
          const IconComponent = card.icon
          return (
            <Card key={card.title} className={cn(
              "analytics-card border-0 transition-all duration-300 hover:shadow-analytics-lg",
              loadingState === 'loading' && "animate-pulse"
            )}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-xl ${card.iconBg} ring-1 ring-white/20`}>
                    <IconComponent className={`h-6 w-6 ${card.color}`} />
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      "text-3xl font-bold text-slate-900",
                      loadingState === 'loading' && "text-slate-400"
                    )}>
                      {loadingState === 'loading' ? '-' : formatNumber(card.value)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardTitle className="text-sm font-semibold text-slate-700 mb-2">
                  {card.title}
                </CardTitle>
                <p className="text-xs text-slate-500 leading-relaxed">{card.description}</p>
              </CardContent>
            </Card>
          )
        })}
        
        {/* CheckMK Hosts Card */}
        <Card className="analytics-card border-0 transition-all duration-300 hover:shadow-analytics-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-orange-100 ring-1 ring-white/20">
                <Shield className="h-6 w-6 text-orange-600" />
              </div>
              <div className="text-right">
                <div className={cn(
                  "text-3xl font-bold text-slate-900",
                  checkmkLoading && "text-slate-400"
                )}>
                  {checkmkLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  ) : checkmkError ? (
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                  ) : (
                    formatNumber(checkmkStats?.total_hosts ?? 0)
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <CardTitle className="text-sm font-semibold text-slate-700 mb-2">
              CheckMK Hosts
            </CardTitle>
            {checkmkLoading ? (
              <p className="text-xs text-slate-500 leading-relaxed">Loading CheckMK data...</p>
            ) : checkmkError ? (
              <p className="text-xs text-red-500 leading-relaxed">{checkmkError}</p>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                Total hosts monitored by CheckMK
                {checkmkStats?.timestamp && (
                  <span className="block mt-1 text-slate-400">
                    Updated: {new Date(checkmkStats.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Job Statistics Section */}
      <div className="col-span-full mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          <DashboardJobStats refreshTrigger={refreshTrigger} />
          <DashboardDeviceBackupStatus refreshTrigger={refreshTrigger} />
          <DashboardCheckmkSyncStatus refreshTrigger={refreshTrigger} />
          <DashboardScanPrefixStats refreshTrigger={refreshTrigger} />
        </div>
      </div>

      {/* Last Updated Info */}
      {lastUpdated && loadingState === 'success' && (
        <div className="text-center">
          <p className="text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200 inline-block">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}
