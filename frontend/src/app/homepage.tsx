'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { 
  Activity, 
  Server, 
  Network, 
  Shield, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Zap,
  GitBranch,
  Loader2
} from 'lucide-react'

interface CheckMKStats {
  total_hosts: number
  timestamp: string
}

export default function Home() {
  const { apiCall } = useApi()
  const [checkmkStats, setCheckmkStats] = useState<CheckMKStats | null>(null)
  const [checkmkLoading, setCheckmkLoading] = useState(true)
  const [checkmkError, setCheckmkError] = useState<string | null>(null)

  const stats = [
    {
      title: 'Total Devices',
      value: '156',
      change: '+12',
      changeType: 'positive' as const,
      icon: Server,
    },
    {
      title: 'Active Connections',
      value: '143',
      change: '+5',
      changeType: 'positive' as const,
      icon: Network,
    },
    {
      title: 'Security Score',
      value: '98%',
      change: '+2%',
      changeType: 'positive' as const,
      icon: Shield,
    },
    {
      title: 'Uptime',
      value: '99.9%',
      change: '0%',
      changeType: 'neutral' as const,
      icon: Activity,
    },
  ]

  // Fetch CheckMK stats
  useEffect(() => {
    const fetchCheckmkStats = async () => {
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

    fetchCheckmkStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recentActivity = [
    {
      id: 1,
      action: 'Device onboarded',
      device: 'SW-001-LAB',
      time: '2 minutes ago',
      status: 'success',
    },
    {
      id: 2,
      action: 'Configuration backup',
      device: 'RTR-003-PROD',
      time: '15 minutes ago',
      status: 'success',
    },
    {
      id: 3,
      action: 'Template sync failed',
      device: 'Multiple devices',
      time: '1 hour ago',
      status: 'error',
    },
    {
      id: 4,
      action: 'Git repository updated',
      device: 'config-templates',
      time: '2 hours ago',
      status: 'success',
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome to your network management control center
            </p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" className="button-apple">
              <Clock className="w-4 h-4 mr-2" />
              Sync Now
            </Button>
            <Button className="button-apple bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
              <Zap className="w-4 h-4 mr-2" />
              Quick Actions
            </Button>
          </div>
        </div>

        {/* Statistics Cards - Smaller for 6-8 total canvases */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title} className="glass shadow-apple hover:shadow-apple-lg transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                        <Icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <Badge
                        variant={stat.changeType === 'positive' ? 'default' : 'secondary'}
                        className={`text-xs ${
                          stat.changeType === 'positive'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        {stat.change}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">{stat.title}</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">{stat.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Main Content Grid - Updated for 6-8 total canvases */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Recent Activity */}
          <Card className="md:col-span-2 lg:col-span-2 xl:col-span-2 glass shadow-apple">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-base">
                <Activity className="w-4 h-4 mr-2" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-sm">
                Latest network operations and system events
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {recentActivity.slice(0, 3).map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-2 bg-gray-50/50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="text-xs font-medium text-gray-900">{activity.action}</p>
                        <p className="text-xs text-gray-500">{activity.device}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {activity.status === 'success' ? (
                        <CheckCircle className="w-3 h-3 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                      )}
                      <span className="text-xs text-gray-500">{activity.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="glass shadow-apple">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-base">
                <Zap className="w-4 h-4 mr-2" />
                Quick Actions
              </CardTitle>
              <CardDescription className="text-sm">
                Common tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <Button variant="outline" className="w-full justify-start button-apple text-xs h-8">
                <Server className="w-3 h-3 mr-2" />
                Onboard Device
              </Button>
              <Button variant="outline" className="w-full justify-start button-apple text-xs h-8">
                <GitBranch className="w-3 h-3 mr-2" />
                Sync Git
              </Button>
              <Button variant="outline" className="w-full justify-start button-apple text-xs h-8">
                <Shield className="w-3 h-3 mr-2" />
                Security Scan
              </Button>
            </CardContent>
          </Card>

          {/* Placeholder for additional canvases */}
          <Card className="glass shadow-apple">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-base">
                <Network className="w-4 h-4 mr-2" />
                Network Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Switches</span>
                  <span className="text-sm font-semibold text-green-600">24 Online</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Routers</span>
                  <span className="text-sm font-semibold text-green-600">8 Online</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Firewalls</span>
                  <span className="text-sm font-semibold text-yellow-600">2 Pending</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CheckMK Hosts Canvas */}
          <Card className="glass shadow-apple">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-base">
                <Shield className="w-4 h-4 mr-2" />
                CheckMK Hosts
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {checkmkLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="ml-2 text-xs text-gray-500">Loading...</span>
                </div>
              ) : checkmkError ? (
                <div className="text-center py-4">
                  <AlertTriangle className="h-4 w-4 text-red-500 mx-auto mb-2" />
                  <p className="text-xs text-red-600">{checkmkError}</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {checkmkStats?.total_hosts ?? 0}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Total Hosts</p>
                  {checkmkStats?.timestamp && (
                    <p className="text-xs text-gray-400 mt-1">
                      Updated: {new Date(checkmkStats.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Canvas */}
          <Card className="glass shadow-apple">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-base">
                <TrendingUp className="w-4 h-4 mr-2" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">CPU Usage</span>
                  <span className="text-sm font-semibold text-blue-600">45%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Memory</span>
                  <span className="text-sm font-semibold text-green-600">62%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Bandwidth</span>
                  <span className="text-sm font-semibold text-orange-600">78%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
