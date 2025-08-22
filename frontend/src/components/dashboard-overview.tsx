'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { 
  Server, 
  MapPin, 
  Network, 
  Layers,
  RefreshCw,
  Clock,
  Database
} from 'lucide-react'

interface DashboardStats {
  devices: number
  locations: number
  ip_addresses: number
  prefixes: number
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
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')
  const [cacheInfo, setCacheInfo] = useState<string>('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

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
    } catch (error) {
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
      title: 'Total Devices',
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
          <h1 className="text-3xl font-bold text-slate-900">Analytics Dashboard</h1>
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
      <div className="analytics-grid">
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
      </div>

      {/* Last Updated Info */}
      {lastUpdated && loadingState === 'success' && (
        <div className="text-center">
          <p className="text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200 inline-block">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        </div>
      )}

      {/* Quick Actions - Modern Analytics Style */}
      <Card className="analytics-card border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold text-slate-900">Quick Actions</CardTitle>
          <p className="text-slate-600">Common network management tasks</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="justify-start h-auto p-6 analytics-card border border-slate-200 hover:border-blue-300 group">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                  <Server className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-900">Onboard Device</div>
                  <div className="text-sm text-slate-500">Add new network device</div>
                </div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto p-6 analytics-card border border-slate-200 hover:border-emerald-300 group">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                  <Network className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-900">Backup Configs</div>
                  <div className="text-sm text-slate-500">Backup device configurations</div>
                </div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto p-6 analytics-card border border-slate-200 hover:border-indigo-300 group">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                  <Layers className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-900">Manage Templates</div>
                  <div className="text-sm text-slate-500">Configure device templates</div>
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
