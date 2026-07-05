'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { Database, Server, Clock, Activity, RefreshCw } from 'lucide-react'
import { useCeleryStatus } from '../hooks/use-celery-queries'

export function CeleryStatusOverview() {
  const { data: status, isLoading, refetch } = useCeleryStatus()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading status...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="panel-header border-b-0 rounded-none m-0 py-2 px-4">
        <CardTitle className="flex items-center space-x-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          <span>System Status</span>
        </CardTitle>
        <CardDescription className="text-panel-header-muted text-xs">
          Current state of the Celery task queue system
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 panel-content">
        <div className="space-y-3">
          {/* Redis Connection */}
          <div
            className={`flex items-center justify-between p-3 rounded-lg border ${
              status?.redis_connected ? 'status-success' : 'status-error'
            }`}
          >
            <div className="flex items-center gap-3">
              <Database
                className={
                  status?.redis_connected
                    ? 'h-5 w-5 text-success-foreground'
                    : 'h-5 w-5 text-error-foreground'
                }
              />
              <span className="text-sm font-medium">Redis Connection</span>
            </div>
            <StatusBadge variant={status?.redis_connected ? 'success' : 'error'}>
              {status?.redis_connected ? 'Connected' : 'Disconnected'}
            </StatusBadge>
          </div>

          {/* Workers */}
          <div
            className={`flex items-center justify-between p-3 rounded-lg border ${
              (status?.worker_count ?? 0) > 0 ? 'status-info' : 'bg-muted border-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <Server
                className={
                  (status?.worker_count ?? 0) > 0
                    ? 'h-5 w-5 text-info-foreground'
                    : 'h-5 w-5 text-muted-foreground'
                }
              />
              <span className="text-sm font-medium">Celery Workers</span>
            </div>
            {(status?.worker_count ?? 0) > 0 ? (
              <StatusBadge variant="info">{status?.worker_count || 0} Active</StatusBadge>
            ) : (
              <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                {status?.worker_count || 0} Active
              </Badge>
            )}
          </div>

          {/* Beat Scheduler */}
          <div
            className={`flex items-center justify-between p-3 rounded-lg border ${
              status?.beat_running ? 'status-success' : 'status-error'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock
                className={
                  status?.beat_running
                    ? 'h-5 w-5 text-success-foreground'
                    : 'h-5 w-5 text-error-foreground'
                }
              />
              <span className="text-sm font-medium">Beat Scheduler</span>
            </div>
            <StatusBadge variant={status?.beat_running ? 'success' : 'error'}>
              {status?.beat_running ? 'Running' : 'Stopped'}
            </StatusBadge>
          </div>

          {/* Active Tasks */}
          <div
            className={`flex items-center justify-between p-3 rounded-lg border ${
              (status?.active_tasks ?? 0) > 0
                ? 'bg-primary/10 border-primary/30'
                : 'bg-muted border-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <Activity
                className={
                  (status?.active_tasks ?? 0) > 0
                    ? 'h-5 w-5 text-primary'
                    : 'h-5 w-5 text-muted-foreground'
                }
              />
              <span className="text-sm font-medium">Active Tasks</span>
            </div>
            <Badge
              variant="outline"
              className={
                (status?.active_tasks ?? 0) > 0
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-muted text-muted-foreground border-border'
              }
            >
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
