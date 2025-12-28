'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  PlayCircle,
  Trash2,
  AlertTriangle,
  Save
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

interface CelerySettings {
  max_workers: number
  cleanup_enabled: boolean
  cleanup_interval_hours: number
  cleanup_age_hours: number
  result_expires_hours: number
}

const DEFAULT_CELERY_SETTINGS: CelerySettings = {
  max_workers: 4,
  cleanup_enabled: true,
  cleanup_interval_hours: 6,
  cleanup_age_hours: 24,
  result_expires_hours: 24
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
  
  // Settings state
  const [celerySettings, setCelerySettings] = useState<CelerySettings>(DEFAULT_CELERY_SETTINGS)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [cleanupRunning, setCleanupRunning] = useState(false)

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

  // Load Celery settings
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    try {
      const response = await apiCall('/api/celery/settings') as { success: boolean; settings?: CelerySettings }
      if (response.success && response.settings) {
        setCelerySettings(response.settings)
      }
    } catch (error) {
      console.error('Failed to load Celery settings:', error)
    } finally {
      setSettingsLoading(false)
    }
  }, [apiCall])

  // Save Celery settings
  const saveSettings = useCallback(async () => {
    setSettingsSaving(true)
    try {
      const response = await apiCall('/api/celery/settings', {
        method: 'PUT',
        body: celerySettings
      }) as { success: boolean; message?: string }
      
      if (response.success) {
        setMessage({ type: 'success', text: response.message || 'Settings saved successfully' })
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSettingsSaving(false)
    }
  }, [apiCall, celerySettings])

  // Trigger cleanup
  const triggerCleanup = useCallback(async () => {
    setCleanupRunning(true)
    try {
      const response = await apiCall('/api/celery/cleanup', {
        method: 'POST'
      }) as { task_id?: string; message?: string }
      
      if (response.task_id) {
        setMessage({ type: 'success', text: `Cleanup task started: ${response.task_id}` })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to trigger cleanup' })
    } finally {
      setCleanupRunning(false)
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
    loadSettings()
    loadWorkers()
    loadSchedules()
  }, [loadStatus, loadSettings, loadWorkers, loadSchedules])

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

      {message && (
        <Alert className={message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Status Overview */}
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
            <div className={(celeryStatus?.worker_count ?? 0) > 0 ? 'text-2xl font-bold text-blue-700' : 'text-2xl font-bold text-gray-500'}>{celeryStatus?.worker_count || 0}</div>
            <p className="text-xs text-muted-foreground">Active workers</p>
          </CardContent>
        </Card>

        <Card className={(celeryStatus?.active_tasks ?? 0) > 0 ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <Activity className={(celeryStatus?.active_tasks ?? 0) > 0 ? 'h-4 w-4 text-purple-600' : 'h-4 w-4 text-gray-400'} />
          </CardHeader>
          <CardContent>
            <div className={(celeryStatus?.active_tasks ?? 0) > 0 ? 'text-2xl font-bold text-purple-700' : 'text-2xl font-bold text-gray-500'}>{celeryStatus?.active_tasks || 0}</div>
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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="test">Test</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <Activity className="h-4 w-4" />
                <span>System Status</span>
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs">Current state of the Celery task queue system</CardDescription>
            </CardHeader>
            <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50">
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3 rounded-lg ${celeryStatus?.redis_connected ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-3">
                    <Database className={celeryStatus?.redis_connected ? 'h-5 w-5 text-green-600' : 'h-5 w-5 text-red-600'} />
                    <span className="text-sm font-medium">Redis Connection</span>
                  </div>
                  <Badge className={celeryStatus?.redis_connected ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-100' : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-100'}>
                    {celeryStatus?.redis_connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg ${(celeryStatus?.worker_count ?? 0) > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
                  <div className="flex items-center gap-3">
                    <Server className={(celeryStatus?.worker_count ?? 0) > 0 ? 'h-5 w-5 text-blue-600' : 'h-5 w-5 text-gray-400'} />
                    <span className="text-sm font-medium">Celery Workers</span>
                  </div>
                  <Badge className={(celeryStatus?.worker_count ?? 0) > 0 ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-100'}>
                    {celeryStatus?.worker_count || 0} Active
                  </Badge>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg ${celeryStatus?.beat_running ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-3">
                    <Clock className={celeryStatus?.beat_running ? 'h-5 w-5 text-green-600' : 'h-5 w-5 text-red-600'} />
                    <span className="text-sm font-medium">Beat Scheduler</span>
                  </div>
                  <Badge className={celeryStatus?.beat_running ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-100' : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-100'}>
                    {celeryStatus?.beat_running ? 'Running' : 'Stopped'}
                  </Badge>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg ${(celeryStatus?.active_tasks ?? 0) > 0 ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50 border border-gray-200'}`}>
                  <div className="flex items-center gap-3">
                    <Activity className={(celeryStatus?.active_tasks ?? 0) > 0 ? 'h-5 w-5 text-purple-600' : 'h-5 w-5 text-gray-400'} />
                    <span className="text-sm font-medium">Active Tasks</span>
                  </div>
                  <Badge className={(celeryStatus?.active_tasks ?? 0) > 0 ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-100' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-100'}>
                    {celeryStatus?.active_tasks || 0} Running
                  </Badge>
                </div>
              </div>

              <div className="mt-6">
                <Button onClick={loadStatus} disabled={isLoading} variant="outline">
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh Status
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Worker Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-blue-500" />
                  <div>
                    <CardTitle>Worker Configuration</CardTitle>
                    <CardDescription>Configure Celery worker settings</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="max-workers">Max Workers (Concurrency)</Label>
                  <Input
                    id="max-workers"
                    type="number"
                    min={1}
                    max={32}
                    value={celerySettings.max_workers}
                    onChange={(e) => setCelerySettings(prev => ({
                      ...prev,
                      max_workers: parseInt(e.target.value) || 4
                    }))}
                    disabled={settingsLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of concurrent worker processes. Default: 4
                  </p>
                </div>

                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <span className="font-medium">Restart Required:</span> Changes to worker configuration require restarting the Celery worker to take effect.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Cleanup Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-500" />
                  <div>
                    <CardTitle>Data Cleanup</CardTitle>
                    <CardDescription>Configure automatic cleanup of old task data</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="cleanup-enabled">Enable Automatic Cleanup</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically remove old task results and logs
                    </p>
                  </div>
                  <Switch
                    id="cleanup-enabled"
                    checked={celerySettings.cleanup_enabled}
                    onCheckedChange={(checked) => setCelerySettings(prev => ({
                      ...prev,
                      cleanup_enabled: checked
                    }))}
                    disabled={settingsLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cleanup-interval">Cleanup Interval (Hours)</Label>
                  <Input
                    id="cleanup-interval"
                    type="number"
                    min={1}
                    max={168}
                    value={celerySettings.cleanup_interval_hours}
                    onChange={(e) => setCelerySettings(prev => ({
                      ...prev,
                      cleanup_interval_hours: parseInt(e.target.value) || 6
                    }))}
                    disabled={settingsLoading || !celerySettings.cleanup_enabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    How often to run the cleanup task. Default: 6 hours
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cleanup-age">Data Retention (Hours)</Label>
                  <Input
                    id="cleanup-age"
                    type="number"
                    min={1}
                    max={720}
                    value={celerySettings.cleanup_age_hours}
                    onChange={(e) => setCelerySettings(prev => ({
                      ...prev,
                      cleanup_age_hours: parseInt(e.target.value) || 24
                    }))}
                    disabled={settingsLoading || !celerySettings.cleanup_enabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Remove task results and logs older than this. Default: 24 hours
                  </p>
                </div>

                <div className="pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={triggerCleanup}
                    disabled={cleanupRunning}
                    className="w-full"
                  >
                    {cleanupRunning ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Run Cleanup Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={settingsSaving}>
              {settingsSaving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
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
