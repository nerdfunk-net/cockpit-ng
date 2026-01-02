"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus, Play, Pause, Trash2, Edit, Calendar, Clock, Globe, User, Bug, AlertTriangle, CheckCircle2, RefreshCw, Server } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import { useToast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SchedulerDebugInfo {
  server_time: {
    utc: string
    local: string
    timezone_offset_hours: number
  }
  schedule_summary: {
    total_schedules: number
    active_schedules: number
    due_now: number
    upcoming: number
  }
  due_schedules: Array<{
    id: number
    job_identifier: string
    schedule_type: string
    start_time: string | null
    next_run: string | null
    next_run_local: string | null
    last_run: string | null
    seconds_until_next_run: number
    is_due: boolean
    template_name: string | null
  }>
  upcoming_schedules: Array<{
    id: number
    job_identifier: string
    schedule_type: string
    start_time: string | null
    next_run: string | null
    next_run_local: string | null
    last_run: string | null
    seconds_until_next_run: number
    is_due: boolean
    template_name: string | null
  }>
  celery_status: string
  note: string
}

interface JobSchedule {
  id: number
  job_identifier: string
  job_template_id: number
  template_name?: string
  template_job_type?: string
  schedule_type: "now" | "interval" | "hourly" | "daily" | "weekly" | "monthly" | "custom"
  cron_expression?: string
  interval_minutes?: number
  start_time?: string
  start_date?: string
  is_active: boolean
  is_global: boolean
  user_id?: number
  credential_id?: number
  job_parameters?: Record<string, unknown>
  created_at: string
  updated_at: string
  last_run?: string
  next_run?: string
}

interface JobTemplate {
  id: number
  name: string
  job_type: string
  description?: string
  inventory_source: string
  inventory_repository_id?: number
  inventory_name?: string
  command_template_name?: string
  is_global: boolean
  user_id?: number
  created_by?: string
  created_at: string
  updated_at: string
}

interface Credential {
  id: number
  name: string
  username: string
  type: string
  source: string
  owner?: string
}

const EMPTY_SCHEDULES: JobSchedule[] = []
const EMPTY_TEMPLATES: JobTemplate[] = []
const EMPTY_CREDENTIALS: Credential[] = []

export function JobsSchedulerPage() {
  const token = useAuthStore(state => state.token)
  const user = useAuthStore(state => state.user)
  const { toast } = useToast()
  const [jobSchedules, setJobSchedules] = useState<JobSchedule[]>(EMPTY_SCHEDULES)
  const [jobTemplates, setJobTemplates] = useState<JobTemplate[]>(EMPTY_TEMPLATES)
  const [credentials, setCredentials] = useState<Credential[]>(EMPTY_CREDENTIALS)
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<JobSchedule | null>(null)
  const [runningJobId, setRunningJobId] = useState<number | null>(null)
  
  // Debug dialog state
  const [isDebugDialogOpen, setIsDebugDialogOpen] = useState(false)
  const [debugInfo, setDebugInfo] = useState<SchedulerDebugInfo | null>(null)
  const [debugLoading, setDebugLoading] = useState(false)

  // Form state
  const [formTemplateId, setFormTemplateId] = useState<string>("")
  const [formIdentifier, setFormIdentifier] = useState("")
  const [formScheduleType, setFormScheduleType] = useState<JobSchedule["schedule_type"]>("daily")
  const [formIntervalMinutes, setFormIntervalMinutes] = useState(60)
  const [formStartTime, setFormStartTime] = useState("00:00")
  const [formIsActive, setFormIsActive] = useState(true)
  const [formIsGlobal, setFormIsGlobal] = useState(false)
  const [formCredentialId, setFormCredentialId] = useState<number | null>(null)

  // Fetch job schedules
  const fetchJobSchedules = useCallback(async () => {
    if (!token) return

    try {
      const response = await fetch("/api/proxy/api/job-schedules", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setJobSchedules(data)
      }
    } catch (error) {
      console.error("Error fetching job schedules:", error)
    } finally {
      setLoading(false)
    }
  }, [token])

  // Fetch available job templates
  const fetchJobTemplates = useCallback(async () => {
    if (!token) return

    try {
      const response = await fetch("/api/proxy/api/job-templates", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setJobTemplates(data.templates || [])
      }
    } catch (error) {
      console.error("Error fetching job templates:", error)
    }
  }, [token])

  // Fetch credentials (global + user's private)
  const fetchCredentials = useCallback(async () => {
    if (!token) return

    try {
      const response = await fetch("/api/proxy/api/credentials", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCredentials(data || [])
      }
    } catch (error) {
      console.error("Error fetching credentials:", error)
    }
  }, [token])

  // Fetch scheduler debug info
  const fetchSchedulerDebug = useCallback(async () => {
    if (!token) return

    try {
      setDebugLoading(true)
      const response = await fetch("/api/proxy/api/job-schedules/debug/scheduler-status", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setDebugInfo(data)
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch scheduler debug info",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error fetching scheduler debug:", error)
      toast({
        title: "Error",
        description: "Failed to fetch scheduler debug info",
        variant: "destructive"
      })
    } finally {
      setDebugLoading(false)
    }
  }, [token, toast])

  // Recalculate all next runs
  const handleRecalculateNextRuns = useCallback(async () => {
    if (!token) return

    try {
      const response = await fetch("/api/proxy/api/job-schedules/debug/recalculate-next-runs", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Success",
          description: data.message,
        })
        // Refresh debug info and schedules
        fetchSchedulerDebug()
        fetchJobSchedules()
      } else {
        toast({
          title: "Error",
          description: "Failed to recalculate next runs",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error recalculating next runs:", error)
    }
  }, [token, toast, fetchSchedulerDebug, fetchJobSchedules])

  useEffect(() => {
    fetchJobSchedules()
    fetchJobTemplates()
    fetchCredentials()
  }, [fetchJobSchedules, fetchJobTemplates, fetchCredentials])

  const resetForm = useCallback(() => {
    setFormTemplateId("")
    setFormIdentifier("")
    setFormScheduleType("daily")
    setFormIntervalMinutes(60)
    setFormStartTime("00:00")
    setFormIsActive(true)
    setFormIsGlobal(false)
    setFormCredentialId(null)
    setEditingJob(null)
  }, [])

  const handleSaveJob = useCallback(async () => {
    if (!token || !formIdentifier) return

    try {
      if (editingJob) {
        // Update existing job
        const response = await fetch(`/api/proxy/api/job-schedules/${editingJob.id}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            job_identifier: formIdentifier,
            schedule_type: formScheduleType,
            interval_minutes: formScheduleType === "interval" ? formIntervalMinutes : undefined,
            start_time: ["hourly", "daily", "weekly", "monthly"].includes(formScheduleType) ? formStartTime : undefined,
            is_active: formIsActive,
            credential_id: formCredentialId || undefined,
          }),
        })

        if (response.ok) {
          setIsDialogOpen(false)
          resetForm()
          fetchJobSchedules()
          toast({
            title: "Schedule Updated",
            description: `Schedule "${formIdentifier}" has been updated successfully.`,
            variant: "default"
          })
        } else {
          toast({
            title: "Update Failed",
            description: "Failed to update schedule. Please try again.",
            variant: "destructive"
          })
        }
      } else {
        // Create new job
        if (!formTemplateId) return

        const response = await fetch("/api/proxy/api/job-schedules", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            job_identifier: formIdentifier,
            job_template_id: parseInt(formTemplateId),
            schedule_type: formScheduleType,
            interval_minutes: formScheduleType === "interval" ? formIntervalMinutes : undefined,
            start_time: ["hourly", "daily", "weekly", "monthly"].includes(formScheduleType) ? formStartTime : undefined,
            is_active: formIsActive,
            is_global: formIsGlobal,
            credential_id: formCredentialId || undefined,
          }),
        })

        if (response.ok) {
          setIsDialogOpen(false)
          resetForm()
          fetchJobSchedules()
          toast({
            title: "Schedule Created",
            description: `Schedule "${formIdentifier}" has been created successfully.`,
            variant: "default"
          })
        } else {
          toast({
            title: "Creation Failed",
            description: "Failed to create schedule. Please try again.",
            variant: "destructive"
          })
        }
      }
    } catch (error) {
      console.error("Error saving job schedule:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      })
    }
  }, [token, editingJob, formTemplateId, formIdentifier, formScheduleType, formIntervalMinutes, formStartTime, formIsActive, formIsGlobal, formCredentialId, fetchJobSchedules, toast, resetForm])

  const handleToggleActive = useCallback(async (job: JobSchedule) => {
    if (!token) return

    try {
      const response = await fetch(`/api/proxy/api/job-schedules/${job.id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_active: !job.is_active,
        }),
      })

      if (response.ok) {
        fetchJobSchedules()
      }
    } catch (error) {
      console.error("Error toggling job:", error)
    }
  }, [token, fetchJobSchedules])

  const handleDeleteJob = useCallback(async (jobId: number) => {
    if (!token) return

    try {
      const response = await fetch(`/api/proxy/api/job-schedules/${jobId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        fetchJobSchedules()
      }
    } catch (error) {
      console.error("Error deleting job:", error)
    }
  }, [token, fetchJobSchedules])

  const handleRunNow = useCallback(async (jobId: number, jobIdentifier: string) => {
    if (!token) return

    setRunningJobId(jobId)
    try {
      const response = await fetch(`/api/proxy/job-runs/execute/${jobId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        toast({
          title: "Job Started",
          description: `Schedule "${jobIdentifier}" has been queued for execution.`,
          variant: "default"
        })
        // Refresh to update last_run timestamp
        fetchJobSchedules()
      } else {
        const error = await response.json()
        toast({
          title: "Execution Failed",
          description: error.detail || "Failed to start job execution. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error executing job:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while starting the job.",
        variant: "destructive"
      })
    } finally {
      setRunningJobId(null)
    }
  }, [token, toast, fetchJobSchedules])

  const handleEditJob = useCallback((job: JobSchedule) => {
    setEditingJob(job)
    setFormTemplateId(job.job_template_id ? job.job_template_id.toString() : "")
    setFormIdentifier(job.job_identifier)
    setFormScheduleType(job.schedule_type)
    setFormIntervalMinutes(job.interval_minutes || 60)
    setFormStartTime(job.start_time || "00:00")
    setFormIsActive(job.is_active)
    setFormIsGlobal(job.is_global)
    setFormCredentialId(job.credential_id ?? null)
    setIsDialogOpen(true)
  }, [])

  const getScheduleTypeLabel = (type: JobSchedule["schedule_type"], job?: JobSchedule) => {
    if (type === "interval" && job?.interval_minutes) {
      const hours = Math.floor(job.interval_minutes / 60)
      const mins = job.interval_minutes % 60
      if (hours > 0 && mins > 0) return `Every ${hours}h ${mins}m`
      if (hours > 0) return `Every ${hours} hour${hours > 1 ? 's' : ''}`
      return `Every ${mins} minute${mins > 1 ? 's' : ''}`
    }
    if ((type === "hourly" || type === "daily") && job?.start_time) {
      return `${type === "hourly" ? "Hourly" : "Daily"} at ${job.start_time}`
    }
    const labels = {
      now: "Run Once",
      interval: "Interval",
      hourly: "Hourly",
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      custom: "Custom",
    }
    return labels[type]
  }

  const getScheduleTypeColor = (type: JobSchedule["schedule_type"]) => {
    const colors = {
      now: "bg-blue-500",
      interval: "bg-cyan-500",
      hourly: "bg-green-500",
      daily: "bg-purple-500",
      weekly: "bg-orange-500",
      monthly: "bg-pink-500",
      custom: "bg-gray-500",
    }
    return colors[type]
  }

  const getJobTypeLabel = (jobType: string) => {
    const labels: Record<string, string> = {
      backup: "Backup",
      compare_devices: "Compare Devices",
      run_commands: "Run Commands",
      cache_devices: "Cache Devices",
      sync_devices: "Sync Devices",
    }
    return labels[jobType] || jobType
  }

  const selectedTemplate = jobTemplates.find(t => t.id.toString() === formTemplateId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading job schedules...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Job Scheduler</h1>
            <p className="text-gray-600 mt-1">
              Schedule automated tasks using job templates
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Debug Dialog */}
          <Dialog open={isDebugDialogOpen} onOpenChange={(open) => {
            setIsDebugDialogOpen(open)
            if (open) fetchSchedulerDebug()
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Bug className="mr-2 h-4 w-4" />
                Debug Scheduler
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-blue-500" />
                  Scheduler Debug Info
                </DialogTitle>
                <DialogDescription>
                  View scheduler database state and diagnose scheduling issues
                </DialogDescription>
              </DialogHeader>

              {debugLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-gray-600">Loading scheduler info...</span>
                </div>
              ) : debugInfo ? (
                <div className="space-y-4">
                  {/* Server Time Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Server Time
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-blue-600">UTC:</span>
                        <span className="ml-2 font-mono">{new Date(debugInfo.server_time.utc).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Offset:</span>
                        <span className="ml-2 font-mono">UTC{debugInfo.server_time.timezone_offset_hours >= 0 ? '+' : ''}{debugInfo.server_time.timezone_offset_hours}h</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-blue-600">
                      ⚠️ Note: {debugInfo.note}
                    </p>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 uppercase">Total</p>
                      <p className="text-2xl font-bold text-gray-700">{debugInfo.schedule_summary.total_schedules}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-green-600 uppercase">Active</p>
                      <p className="text-2xl font-bold text-green-700">{debugInfo.schedule_summary.active_schedules}</p>
                    </div>
                    <div className={`${debugInfo.schedule_summary.due_now > 0 ? 'bg-amber-50' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                      <p className={`text-xs uppercase ${debugInfo.schedule_summary.due_now > 0 ? 'text-amber-600' : 'text-gray-500'}`}>Due Now</p>
                      <p className={`text-2xl font-bold ${debugInfo.schedule_summary.due_now > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{debugInfo.schedule_summary.due_now}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-purple-600 uppercase">Celery</p>
                      <p className={`text-sm font-medium ${debugInfo.celery_status.includes('active') ? 'text-green-600' : 'text-red-600'}`}>
                        {debugInfo.celery_status.includes('active') ? '✓ Active' : '✗ ' + debugInfo.celery_status}
                      </p>
                    </div>
                  </div>

                  {/* Due Schedules (if any) */}
                  {debugInfo.due_schedules.length > 0 && (
                    <div className="border border-amber-200 rounded-lg overflow-hidden">
                      <div className="bg-amber-100 px-4 py-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <h4 className="font-semibold text-amber-800">Due Schedules (Should Be Running)</h4>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-amber-50">
                            <TableHead className="text-xs">ID</TableHead>
                            <TableHead className="text-xs">Name</TableHead>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs">Start Time (UTC)</TableHead>
                            <TableHead className="text-xs">Next Run (UTC)</TableHead>
                            <TableHead className="text-xs">Overdue By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {debugInfo.due_schedules.map((schedule) => (
                            <TableRow key={schedule.id} className="bg-amber-50/50">
                              <TableCell className="font-mono text-xs">{schedule.id}</TableCell>
                              <TableCell className="font-medium">{schedule.job_identifier}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{schedule.schedule_type}</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{schedule.start_time || '-'}</TableCell>
                              <TableCell className="font-mono text-xs">{schedule.next_run ? new Date(schedule.next_run).toLocaleString() : '-'}</TableCell>
                              <TableCell className="text-amber-700 font-medium">
                                {Math.abs(Math.round(schedule.seconds_until_next_run / 60))} min
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Upcoming Schedules */}
                  {debugInfo.upcoming_schedules.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-600" />
                        <h4 className="font-semibold text-gray-700">Upcoming Schedules</h4>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">ID</TableHead>
                            <TableHead className="text-xs">Name</TableHead>
                            <TableHead className="text-xs">Template</TableHead>
                            <TableHead className="text-xs">Start Time (UTC)</TableHead>
                            <TableHead className="text-xs">Next Run</TableHead>
                            <TableHead className="text-xs">Time Until</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {debugInfo.upcoming_schedules.map((schedule, idx) => (
                            <TableRow key={schedule.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              <TableCell className="font-mono text-xs">{schedule.id}</TableCell>
                              <TableCell className="font-medium">{schedule.job_identifier}</TableCell>
                              <TableCell className="text-xs text-gray-600">{schedule.template_name || '-'}</TableCell>
                              <TableCell className="font-mono text-xs">{schedule.start_time || '-'}</TableCell>
                              <TableCell className="font-mono text-xs">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      {schedule.next_run ? new Date(schedule.next_run).toLocaleTimeString() : '-'}
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">UTC: {schedule.next_run}</p>
                                      <p className="text-xs">Local: {schedule.next_run_local}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell className="text-green-600 font-medium">
                                {schedule.seconds_until_next_run < 60 
                                  ? `${schedule.seconds_until_next_run}s`
                                  : schedule.seconds_until_next_run < 3600
                                    ? `${Math.round(schedule.seconds_until_next_run / 60)}m`
                                    : `${Math.round(schedule.seconds_until_next_run / 3600)}h`
                                }
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <Button variant="outline" size="sm" onClick={fetchSchedulerDebug}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleRecalculateNextRuns}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Recalculate All Next Runs
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No debug information available
                </div>
              )}
            </DialogContent>
          </Dialog>
          
          {/* New Schedule Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                New Schedule
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 px-6 py-4">
              <DialogHeader className="text-white">
                <DialogTitle className="text-lg font-semibold text-white">
                  {editingJob ? "Edit Schedule" : "Create Schedule"}
                </DialogTitle>
                <DialogDescription className="text-blue-50">
                  {editingJob ? "Update schedule settings" : "Schedule a job template to run automatically"}
                </DialogDescription>
              </DialogHeader>
            </div>
            
            {/* Form content */}
            <div className="px-6 py-4 space-y-4">
              {/* Job Template and Identifier in grid */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="job-template" className="text-sm font-medium text-gray-700">Job Template</Label>
                  <Select value={formTemplateId} onValueChange={setFormTemplateId} disabled={!!editingJob}>
                    <SelectTrigger id="job-template" className="h-9 bg-white w-full truncate">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          <div className="flex items-center gap-2">
                            {template.is_global ? (
                              <Globe className="h-3.5 w-3.5 text-blue-500" />
                            ) : (
                              <User className="h-3.5 w-3.5 text-gray-400" />
                            )}
                            <span className="font-medium">{template.name}</span>
                            <span className="text-xs text-muted-foreground">({getJobTypeLabel(template.job_type)})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="identifier" className="text-sm font-medium text-gray-700">Schedule Identifier</Label>
                  <Input
                    id="identifier"
                    placeholder="e.g., daily-backup-core"
                    value={formIdentifier}
                    onChange={(e) => setFormIdentifier(e.target.value)}
                    className="h-9 bg-white"
                  />
                </div>
              </div>

              {/* Template description */}
              {selectedTemplate && (
                <div className="px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {getJobTypeLabel(selectedTemplate.job_type)}
                    </Badge>
                    {selectedTemplate.is_global ? (
                      <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">Global</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Private</Badge>
                    )}
                  </div>
                  {selectedTemplate.description || "No description provided"}
                </div>
              )}

              {/* Schedule and timing in grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="schedule-type" className="text-sm font-medium text-gray-700">Schedule</Label>
                  <Select
                    value={formScheduleType}
                    onValueChange={(value) => setFormScheduleType(value as JobSchedule["schedule_type"])}
                  >
                    <SelectTrigger id="schedule-type" className="h-9 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="now">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
                          <span>Run Once</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="interval">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-cyan-500" />
                          <span>Every X Minutes</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="hourly">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          <span>Hourly</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="daily">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-purple-500" />
                          <span>Daily</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="weekly">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-orange-500" />
                          <span>Weekly</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="monthly">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-pink-500" />
                          <span>Monthly</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Conditional timing field */}
                {formScheduleType === "interval" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="interval-minutes" className="text-sm font-medium text-gray-700">
                      Interval (minutes)
                    </Label>
                    <Input
                      id="interval-minutes"
                      type="number"
                      min="1"
                      max="1440"
                      placeholder="60"
                      value={formIntervalMinutes}
                      onChange={(e) => setFormIntervalMinutes(parseInt(e.target.value) || 60)}
                      className="h-9 bg-white"
                    />
                  </div>
                )}

                {["hourly", "daily", "weekly", "monthly"].includes(formScheduleType) && (
                  <div className="space-y-1.5">
                    <Label htmlFor="start-time" className="text-sm font-medium text-gray-700">Start Time (UTC)</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="h-9 bg-white"
                    />
                  </div>
                )}

                {/* Empty placeholder when "now" is selected to maintain grid alignment */}
                {formScheduleType === "now" && <div />}
              </div>

              {/* Timezone notice */}
              {["hourly", "daily", "weekly", "monthly"].includes(formScheduleType) && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 border border-blue-200 text-sm">
                  <Globe className="h-4 w-4 text-blue-500 shrink-0" />
                  <p className="text-blue-700">
                    <span className="font-medium">All times are in UTC.</span>
                    {' '}Your local time is currently UTC{new Date().getTimezoneOffset() <= 0 ? '+' : ''}{-new Date().getTimezoneOffset() / 60}h.
                    {' '}For {formStartTime} UTC, that&apos;s{' '}
                    <span className="font-mono font-medium">
                      {(() => {
                        const parts = formStartTime.split(':').map(Number)
                        const h = parts[0] ?? 0
                        const m = parts[1] ?? 0
                        const localH = (h - new Date().getTimezoneOffset() / 60 + 24) % 24
                        return `${String(Math.floor(localH)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                      })()}
                    </span>
                    {' '}local time.
                  </p>
                </div>
              )}

              {/* Timing hint */}
              {formScheduleType === "interval" && (
                <p className="text-xs text-gray-500">
                  Run every {formIntervalMinutes} minute{formIntervalMinutes !== 1 ? 's' : ''}
                  {formIntervalMinutes >= 60 && ` (${Math.floor(formIntervalMinutes / 60)}h ${formIntervalMinutes % 60}m)`}
                </p>
              )}
              {["hourly", "daily", "weekly", "monthly"].includes(formScheduleType) && (
                <p className="text-xs text-gray-500">First run at {formStartTime} UTC</p>
              )}

              {/* Credential selector for backup and run_commands jobs */}
              {selectedTemplate && (selectedTemplate.job_type === "backup" || selectedTemplate.job_type === "run_commands") && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="space-y-1.5">
                    <Label htmlFor="credential" className="text-sm font-medium text-gray-700">
                      Device Credentials <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formCredentialId?.toString() || "none"}
                      onValueChange={(v) => setFormCredentialId(v === "none" ? null : parseInt(v))}
                    >
                      <SelectTrigger id="credential" className="h-9 bg-white">
                        <SelectValue placeholder="Select credentials for device login" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-gray-400">No credential selected</span>
                        </SelectItem>
                        {credentials.map((cred) => (
                          <SelectItem key={cred.id} value={cred.id.toString()}>
                            <div className="flex items-center gap-2">
                              {cred.source === "general" ? (
                                <Globe className="h-3.5 w-3.5 text-blue-500" />
                              ) : (
                                <User className="h-3.5 w-3.5 text-gray-400" />
                              )}
                              <span className="font-medium">{cred.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({cred.username})
                              </span>
                              {cred.source === "general" && (
                                <Badge variant="secondary" className="text-xs ml-auto">Global</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Required for connecting to devices via SSH
                    </p>
                  </div>
                </div>
              )}

              {/* Options section with inline switches */}
              <div className="flex items-center gap-6 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <Switch
                    id="is-active"
                    checked={formIsActive}
                    onCheckedChange={setFormIsActive}
                  />
                  <Label htmlFor="is-active" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Active
                  </Label>
                </div>

                {user?.roles?.includes("admin") && !editingJob && (
                  <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
                    <Switch
                      id="is-global"
                      checked={formIsGlobal}
                      onCheckedChange={setFormIsGlobal}
                    />
                    <Label htmlFor="is-global" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
                      Global Schedule
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">Admin</Badge>
                    </Label>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-3 bg-gray-50 border-t border-gray-200">
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)} 
                className="h-9 px-4 border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveJob} 
                disabled={!formIdentifier || (!editingJob && !formTemplateId)}
                className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editingJob ? (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Update Schedule
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Schedule
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {jobSchedules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold mb-2">No schedules yet</p>
            <p className="text-muted-foreground mb-4">
              Create your first schedule using a job template
            </p>
            {jobTemplates.length === 0 ? (
              <p className="text-sm text-amber-600">
                Create a job template first in Jobs → Job Templates
              </p>
            ) : (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Schedule
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobSchedules.map((job) => (
            <Card key={job.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {job.job_identifier}
                      {job.is_global && (
                        <Badge variant="secondary" className="text-xs">
                          Global
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      {job.template_name && (
                        <>
                          <span className="font-medium">{job.template_name}</span>
                          <span className="text-xs">•</span>
                        </>
                      )}
                      {job.template_job_type && (
                        <Badge variant="outline" className="text-xs">
                          {getJobTypeLabel(job.template_job_type)}
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                  {job.is_active ? (
                    <Badge className="bg-green-500">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Paused</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${getScheduleTypeColor(job.schedule_type)}`} />
                  <span className="text-sm font-medium">
                    {getScheduleTypeLabel(job.schedule_type, job)}
                  </span>
                </div>

                {job.last_run && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Last run: {new Date(job.last_run).toLocaleString()}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRunNow(job.id, job.job_identifier)}
                    disabled={runningJobId === job.id}
                    className="flex-1"
                  >
                    {runningJobId === job.id ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Run Now
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditJob(job)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(job)}
                  >
                    {job.is_active ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteJob(job.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
