'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Database,
  Server,
  Clock,
  Activity,
  RefreshCw
} from 'lucide-react'
import { useCeleryStatus } from '../hooks/use-celery-queries'

export function CeleryStatusOverview() {
  const { data: status, isLoading, refetch } = useCeleryStatus()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading status...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
        <CardTitle className="flex items-center space-x-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          <span>System Status</span>
        </CardTitle>
        <CardDescription className="text-blue-100 text-xs">
          Current state of the Celery task queue system
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50">
        <div className="space-y-3">
          {/* Redis Connection */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${
            status?.redis_connected
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              <Database className={status?.redis_connected ? 'h-5 w-5 text-green-600' : 'h-5 w-5 text-red-600'} />
              <span className="text-sm font-medium">Redis Connection</span>
            </div>
            <Badge className={
              status?.redis_connected
                ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-100'
                : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-100'
            }>
              {status?.redis_connected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>

          {/* Workers */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${
            (status?.worker_count ?? 0) > 0
              ? 'bg-blue-50 border border-blue-200'
              : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <Server className={(status?.worker_count ?? 0) > 0 ? 'h-5 w-5 text-blue-600' : 'h-5 w-5 text-gray-400'} />
              <span className="text-sm font-medium">Celery Workers</span>
            </div>
            <Badge className={
              (status?.worker_count ?? 0) > 0
                ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100'
                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-100'
            }>
              {status?.worker_count || 0} Active
            </Badge>
          </div>

          {/* Beat Scheduler */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${
            status?.beat_running
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              <Clock className={status?.beat_running ? 'h-5 w-5 text-green-600' : 'h-5 w-5 text-red-600'} />
              <span className="text-sm font-medium">Beat Scheduler</span>
            </div>
            <Badge className={
              status?.beat_running
                ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-100'
                : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-100'
            }>
              {status?.beat_running ? 'Running' : 'Stopped'}
            </Badge>
          </div>

          {/* Active Tasks */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${
            (status?.active_tasks ?? 0) > 0
              ? 'bg-purple-50 border border-purple-200'
              : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <Activity className={(status?.active_tasks ?? 0) > 0 ? 'h-5 w-5 text-purple-600' : 'h-5 w-5 text-gray-400'} />
              <span className="text-sm font-medium">Active Tasks</span>
            </div>
            <Badge className={
              (status?.active_tasks ?? 0) > 0
                ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-100'
                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-100'
            }>
              {status?.active_tasks || 0} Running
            </Badge>
          </div>
        </div>

        <div className="mt-6">
          <Button onClick={() => refetch()} disabled={isLoading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
