'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Server, Database, CheckCircle, XCircle, Activity, Clock } from 'lucide-react'
import { useCeleryStatus } from './hooks/use-celery-queries'
import { CeleryStatusOverview } from './components/celery-status-overview'
import { CelerySettingsForm } from './components/celery-settings-form'
import { CeleryWorkersList } from './components/celery-workers-list'
import { CeleryQueuesList } from './components/celery-queues-list'
import { CelerySchedulesList } from './components/celery-schedules-list'
import { CeleryTestPanel } from './components/celery-test-panel'

export function CelerySettingsPage() {
  const { data: celeryStatus } = useCeleryStatus()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="bg-purple-100 p-2 rounded-lg">
          <Server className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Celery Task Queue</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage Celery workers, tasks, and schedules
          </p>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={celeryStatus?.redis_connected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redis</CardTitle>
            <Database className={celeryStatus?.redis_connected ? 'h-4 w-4 text-green-600' : 'h-4 w-4 text-red-600'} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {celeryStatus?.redis_connected ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-xl font-bold text-green-700">Connected</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-xl font-bold text-red-700">Disconnected</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={(celeryStatus?.worker_count ?? 0) > 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workers</CardTitle>
            <Server className={(celeryStatus?.worker_count ?? 0) > 0 ? 'h-4 w-4 text-blue-600' : 'h-4 w-4 text-gray-400'} />
          </CardHeader>
          <CardContent>
            <div className={(celeryStatus?.worker_count ?? 0) > 0 ? 'text-2xl font-bold text-blue-700' : 'text-2xl font-bold text-gray-500'}>
              {celeryStatus?.worker_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">Active workers</p>
          </CardContent>
        </Card>

        <Card className={(celeryStatus?.active_tasks ?? 0) > 0 ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <Activity className={(celeryStatus?.active_tasks ?? 0) > 0 ? 'h-4 w-4 text-purple-600' : 'h-4 w-4 text-gray-400'} />
          </CardHeader>
          <CardContent>
            <div className={(celeryStatus?.active_tasks ?? 0) > 0 ? 'text-2xl font-bold text-purple-700' : 'text-2xl font-bold text-gray-500'}>
              {celeryStatus?.active_tasks || 0}
            </div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card className={celeryStatus?.beat_running ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Beat Scheduler</CardTitle>
            <Clock className={celeryStatus?.beat_running ? 'h-4 w-4 text-green-600' : 'h-4 w-4 text-red-600'} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {celeryStatus?.beat_running ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-xl font-bold text-green-700">Running</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-xl font-bold text-red-700">Stopped</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
          <TabsTrigger value="queues">Queues</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="test">Test</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <CeleryStatusOverview />
        </TabsContent>

        <TabsContent value="settings">
          <CelerySettingsForm />
        </TabsContent>

        <TabsContent value="workers">
          <CeleryWorkersList />
        </TabsContent>

        <TabsContent value="queues">
          <CeleryQueuesList />
        </TabsContent>

        <TabsContent value="schedules">
          <CelerySchedulesList />
        </TabsContent>

        <TabsContent value="test">
          <CeleryTestPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
