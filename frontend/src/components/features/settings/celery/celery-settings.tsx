'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Server, Database, CheckCircle, XCircle, Activity, Clock } from 'lucide-react'
import { IconChip } from '@/components/shared/icon-chip'
import { useCeleryStatus } from './hooks/use-celery-queries'
import { CeleryStatusOverview } from './components/celery-status-overview'
import { CelerySettingsForm } from './components/celery-settings-form'
import { CeleryCleanupJobs } from './components/celery-cleanup-jobs'
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
        <IconChip variant="primary">
          <Server className="h-6 w-6" />
        </IconChip>
        <div>
          <h1 className="text-3xl font-bold">Celery Task Queue</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage Celery workers, tasks, and schedules
          </p>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          className={celeryStatus?.redis_connected ? 'status-success' : 'status-error'}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redis</CardTitle>
            <Database
              className={
                celeryStatus?.redis_connected
                  ? 'h-4 w-4 text-success-foreground'
                  : 'h-4 w-4 text-error-foreground'
              }
            />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {celeryStatus?.redis_connected ? (
                <>
                  <CheckCircle className="h-5 w-5 text-success-foreground" />
                  <span className="text-xl font-bold">Connected</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-error-foreground" />
                  <span className="text-xl font-bold">Disconnected</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className={
            (celeryStatus?.worker_count ?? 0) > 0 ? 'status-info' : 'bg-muted border-border'
          }
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workers</CardTitle>
            <Server
              className={
                (celeryStatus?.worker_count ?? 0) > 0
                  ? 'h-4 w-4 text-info-foreground'
                  : 'h-4 w-4 text-muted-foreground'
              }
            />
          </CardHeader>
          <CardContent>
            <div
              className={
                (celeryStatus?.worker_count ?? 0) > 0
                  ? 'text-2xl font-bold'
                  : 'text-2xl font-bold text-muted-foreground'
              }
            >
              {celeryStatus?.worker_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">Active workers</p>
          </CardContent>
        </Card>

        <Card
          className={
            (celeryStatus?.active_tasks ?? 0) > 0
              ? 'bg-primary/10 border-primary/30'
              : 'bg-muted border-border'
          }
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <Activity
              className={
                (celeryStatus?.active_tasks ?? 0) > 0
                  ? 'h-4 w-4 text-primary'
                  : 'h-4 w-4 text-muted-foreground'
              }
            />
          </CardHeader>
          <CardContent>
            <div
              className={
                (celeryStatus?.active_tasks ?? 0) > 0
                  ? 'text-2xl font-bold text-primary'
                  : 'text-2xl font-bold text-muted-foreground'
              }
            >
              {celeryStatus?.active_tasks || 0}
            </div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card
          className={celeryStatus?.beat_running ? 'status-success' : 'status-error'}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Beat Scheduler</CardTitle>
            <Clock
              className={
                celeryStatus?.beat_running
                  ? 'h-4 w-4 text-success-foreground'
                  : 'h-4 w-4 text-error-foreground'
              }
            />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {celeryStatus?.beat_running ? (
                <>
                  <CheckCircle className="h-5 w-5 text-success-foreground" />
                  <span className="text-xl font-bold">Running</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-error-foreground" />
                  <span className="text-xl font-bold">Stopped</span>
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
          <TabsTrigger value="cleanup-jobs">Cleanup Jobs</TabsTrigger>
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

        <TabsContent value="cleanup-jobs">
          <CeleryCleanupJobs />
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
