'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  GitBranch
} from 'lucide-react'

export default function Home() {
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

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title} className="glass shadow-apple hover:shadow-apple-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                      <div className="flex items-center mt-2">
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
                        <span className="text-xs text-gray-500 ml-2">vs last week</span>
                      </div>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <Card className="lg:col-span-2 glass shadow-apple">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest network operations and system events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                        <p className="text-xs text-gray-500">{activity.device}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {activity.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
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
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="w-5 h-5 mr-2" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Common network management tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start button-apple">
                <Server className="w-4 h-4 mr-2" />
                Onboard New Device
              </Button>
              <Button variant="outline" className="w-full justify-start button-apple">
                <GitBranch className="w-4 h-4 mr-2" />
                Sync Git Repositories
              </Button>
              <Button variant="outline" className="w-full justify-start button-apple">
                <Shield className="w-4 h-4 mr-2" />
                Run Security Scan
              </Button>
              <Button variant="outline" className="w-full justify-start button-apple">
                <TrendingUp className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
