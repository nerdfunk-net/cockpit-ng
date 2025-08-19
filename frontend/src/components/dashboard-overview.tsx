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
      bgColor: 'bg-blue-100',
      description: 'Network devices in Nautobot'
    },
    {
      title: 'Total Locations',
      value: stats.locations,
      icon: MapPin,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'Physical locations'
    },
    {
      title: 'IP Addresses',
      value: stats.ip_addresses,
      icon: Network,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      description: 'Assigned IP addresses'
    },
    {
      title: 'Total Prefixes',
      value: stats.prefixes,
      icon: Layers,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: 'Network prefixes'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Nautobot Dashboard</h1>
          <p className="text-gray-600">Network infrastructure overview and statistics</p>
        </div>
        <div className="flex items-center space-x-4">
          {cacheInfo && (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>{cacheInfo}</span>
            </div>
          )}
          <Button
            onClick={refreshData}
            disabled={loadingState === 'loading'}
            size="sm"
            className="flex items-center space-x-2"
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
            <span className="text-blue-800 font-medium">Loading dashboard statistics...</span>
          </div>
        </div>
      )}

      {loadingState === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Database className="h-5 w-5 text-red-500" />
              <span className="text-red-800 font-medium">
                Failed to load dashboard data. Please check your Nautobot connection.
              </span>
            </div>
            <Button onClick={refreshData} size="sm" variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const IconComponent = card.icon
          return (
            <Card key={card.title} className={cn(
              "transition-all duration-200 hover:shadow-lg",
              loadingState === 'loading' && "animate-pulse"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${card.bgColor}`}>
                    <IconComponent className={`h-6 w-6 ${card.color}`} />
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      "text-2xl font-bold text-gray-900",
                      loadingState === 'loading' && "text-gray-400"
                    )}>
                      {loadingState === 'loading' ? '-' : formatNumber(card.value)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-sm font-medium text-gray-600 mb-1">
                  {card.title}
                </CardTitle>
                <p className="text-xs text-gray-500">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Last Updated Info */}
      {lastUpdated && loadingState === 'success' && (
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        </div>
      )}

      {/* Quick Actions - Future Enhancement */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="justify-start h-auto p-4">
              <div className="flex items-center space-x-3">
                <Server className="h-5 w-5 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium">Onboard Device</div>
                  <div className="text-sm text-gray-500">Add new network device</div>
                </div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto p-4">
              <div className="flex items-center space-x-3">
                <Network className="h-5 w-5 text-green-600" />
                <div className="text-left">
                  <div className="font-medium">Backup Configs</div>
                  <div className="text-sm text-gray-500">Backup device configurations</div>
                </div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto p-4">
              <div className="flex items-center space-x-3">
                <Layers className="h-5 w-5 text-purple-600" />
                <div className="text-left">
                  <div className="font-medium">Manage Templates</div>
                  <div className="text-sm text-gray-500">Configure device templates</div>
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
