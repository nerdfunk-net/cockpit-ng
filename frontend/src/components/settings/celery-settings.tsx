'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Activity,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Server,
  Database,
  PlayCircle
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'

const EMPTY_ARRAY: Schedule[] = []

interface CeleryStatus {
  redis_connected: boolean
  worker_count: number
  active_tasks: number
  beat_running: boolean
}

interface Schedule {
  name: string
  task: string
  schedule: string
  options: Record<string, unknown>
}

interface TaskStatus {
  task_id: string
  status: string
  result?: Record<string, unknown>
  error?: string
  progress?: Record<string, unknown>
}

interface WorkersData {
  active_tasks?: Record<string, unknown[]>
  stats?: Record<string, unknown>
  registered_tasks?: Record<string, string[]>
}

export function CelerySettingsPage() {
  const { apiCall } = useApi()

  // State
  const [celeryStatus, setCeleryStatus] = useState<CeleryStatus | null>(null)
  const [workers, setWorkers] = useState<WorkersData | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>(EMPTY_ARRAY)
  const [testTaskId, setTestTaskId] = useState<string>('')
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error'; text: string} | null>(null)

  // Load Celery status
  const loadStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await apiCall('/api/celery/status') as { success: boolean; status: CeleryStatus }
      if (response.success) {
        setCeleryStatus(response.status)
      }
    } catch (error) {
      console.error('Failed to load Celery status:', error)
    } finally {
      setIsLoading(false)
    }
  }, [apiCall])

  // Load workers
  const loadWorkers = useCallback(async () => {
    try {
      const response = await apiCall('/api/celery/workers') as { success: boolean; workers: WorkersData }
      if (response.success) {
        setWorkers(response.workers)
      }
    } catch (error) {
      console.error('Failed to load workers:', error)
    }
  }, [apiCall])

  // Load schedules
  const loadSchedules = useCallback(async () => {
    try {
      const response = await apiCall('/api/celery/schedules') as { success: boolean; schedules?: Schedule[] }
      if (response.success) {
        setSchedules(response.schedules || [])
      }
    } catch (error) {
      console.error('Failed to load schedules:', error)
    }
  }, [apiCall])

  // Submit test task
  const submitTestTask = useCallback(async () => {
    try {
      const response = await apiCall('/api/celery/test', {
        method: 'POST',
        body: { message: 'Test from Settings UI' }
      }) as { task_id?: string }

      if (response.task_id) {
        setTestTaskId(response.task_id)
        setMessage({ type: 'success', text: `Test task submitted: ${response.task_id}` })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to submit test task' })
    }
  }, [apiCall])

  // Check task status
  const checkTaskStatus = useCallback(async () => {
    if (!testTaskId) return

    try {
      const response = await apiCall(`/api/celery/tasks/${testTaskId}`) as TaskStatus
      setTaskStatus(response)
    } catch (error) {
      console.error('Failed to check task status:', error)
    }
  }, [testTaskId, apiCall])

  // Initial load
  useEffect(() => {
    loadStatus()
    loadWorkers()
    loadSchedules()
  }, [loadStatus, loadWorkers, loadSchedules])

  // Auto-refresh task status
  useEffect(() => {
    if (testTaskId && taskStatus?.status !== 'SUCCESS' && taskStatus?.status !== 'FAILURE') {
      const interval = setInterval(checkTaskStatus, 2000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [testTaskId, taskStatus, checkTaskStatus])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Celery Task Queue</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage Celery workers, tasks, and schedules
        </p>
      </div>

      {message && (
        <Alert className={message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redis</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {celeryStatus?.redis_connected ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-xl font-bold">Connected</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-xl font-bold">Disconnected</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{celeryStatus?.worker_count || 0}</div>
            <p className="text-xs text-muted-foreground">Active workers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{celeryStatus?.active_tasks || 0}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Beat Scheduler</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {celeryStatus?.beat_running ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-xl font-bold">Running</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-xl font-bold">Stopped</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="test">Test</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Current state of the Celery task queue system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Redis Connection</span>
                  <Badge variant={celeryStatus?.redis_connected ? 'default' : 'destructive'}>
                    {celeryStatus?.redis_connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Celery Workers</span>
                  <Badge variant="outline">{celeryStatus?.worker_count || 0} Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Beat Scheduler</span>
                  <Badge variant={celeryStatus?.beat_running ? 'default' : 'destructive'}>
                    {celeryStatus?.beat_running ? 'Running' : 'Stopped'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active Tasks</span>
                  <Badge variant="outline">{celeryStatus?.active_tasks || 0} Running</Badge>
                </div>
              </div>

              <div className="mt-6">
                <Button onClick={loadStatus} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh Status
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Celery Workers</CardTitle>
                  <CardDescription>Active worker processes and their statistics</CardDescription>
                </div>
                <Button onClick={loadWorkers} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {workers?.stats && Object.keys(workers.stats).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Max Concurrency</TableHead>
                      <TableHead>Pool</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(workers.stats).map(([name, stats]: [string, unknown]) => {
                      const workerStats = stats as Record<string, unknown> | undefined
                      const pool = workerStats?.pool as Record<string, unknown> | undefined
                      return (
                        <TableRow key={name}>
                          <TableCell className="font-mono text-sm">{name}</TableCell>
                          <TableCell>
                            <Badge variant="default">Active</Badge>
                          </TableCell>
                          <TableCell>{String(pool?.['max-concurrency'] ?? 'N/A')}</TableCell>
                          <TableCell>{String(pool?.implementation || 'N/A')}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No workers found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Periodic Task Schedules</CardTitle>
                  <CardDescription>Tasks configured to run on a schedule via Celery Beat</CardDescription>
                </div>
                <Button onClick={loadSchedules} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {schedules.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Schedule Name</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Schedule</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((schedule) => (
                      <TableRow key={schedule.name}>
                        <TableCell className="font-medium">{schedule.name}</TableCell>
                        <TableCell className="font-mono text-sm">{schedule.task}</TableCell>
                        <TableCell className="text-sm">{schedule.schedule}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No schedules configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Celery</CardTitle>
              <CardDescription>Submit a test task to verify Celery is working</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={submitTestTask}>
                <PlayCircle className="h-4 w-4 mr-2" />
                Submit Test Task
              </Button>

              {testTaskId && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Task ID:</p>
                    <code className="text-sm bg-muted px-2 py-1 rounded">{testTaskId}</code>
                  </div>

                  {taskStatus && (
                    <div className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Status:</span>
                        <Badge variant={
                          taskStatus.status === 'SUCCESS' ? 'default' :
                          taskStatus.status === 'FAILURE' ? 'destructive' :
                          'secondary'
                        }>
                          {taskStatus.status}
                        </Badge>
                      </div>

                      {taskStatus.result && (
                        <div>
                          <p className="text-sm font-medium">Result:</p>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                            {JSON.stringify(taskStatus.result, null, 2)}
                          </pre>
                        </div>
                      )}

                      {taskStatus.error && (
                        <div>
                          <p className="text-sm font-medium text-red-600">Error:</p>
                          <p className="text-sm text-red-600">{taskStatus.error}</p>
                        </div>
                      )}

                      <Button onClick={checkTaskStatus} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Status
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
