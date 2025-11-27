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
import { Plus, Play, Pause, Trash2, Edit, Calendar, Clock, Globe, User } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import { useToast } from "@/hooks/use-toast"

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

const EMPTY_SCHEDULES: JobSchedule[] = []
const EMPTY_TEMPLATES: JobTemplate[] = []

export function JobsSchedulerPage() {
  const token = useAuthStore(state => state.token)
  const user = useAuthStore(state => state.user)
  const { toast } = useToast()
  const [jobSchedules, setJobSchedules] = useState<JobSchedule[]>(EMPTY_SCHEDULES)
  const [jobTemplates, setJobTemplates] = useState<JobTemplate[]>(EMPTY_TEMPLATES)
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<JobSchedule | null>(null)

  // Form state
  const [formTemplateId, setFormTemplateId] = useState<string>("")
  const [formIdentifier, setFormIdentifier] = useState("")
  const [formScheduleType, setFormScheduleType] = useState<JobSchedule["schedule_type"]>("daily")
  const [formIntervalMinutes, setFormIntervalMinutes] = useState(60)
  const [formStartTime, setFormStartTime] = useState("00:00")
  const [formIsActive, setFormIsActive] = useState(true)
  const [formIsGlobal, setFormIsGlobal] = useState(false)

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

  useEffect(() => {
    fetchJobSchedules()
    fetchJobTemplates()
  }, [fetchJobSchedules, fetchJobTemplates])

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
  }, [token, editingJob, formTemplateId, formIdentifier, formScheduleType, formIntervalMinutes, formStartTime, formIsActive, formIsGlobal, fetchJobSchedules, toast])

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
    }
  }, [token, toast, fetchJobSchedules])

  const handleEditJob = useCallback((job: JobSchedule) => {
    setEditingJob(job)
    setFormTemplateId(job.job_template_id.toString())
    setFormIdentifier(job.job_identifier)
    setFormScheduleType(job.schedule_type)
    setFormIntervalMinutes(job.interval_minutes || 60)
    setFormStartTime(job.start_time || "00:00")
    setFormIsActive(job.is_active)
    setFormIsGlobal(job.is_global)
    setIsDialogOpen(true)
  }, [])

  const resetForm = useCallback(() => {
    setFormTemplateId("")
    setFormIdentifier("")
    setFormScheduleType("daily")
    setFormIntervalMinutes(60)
    setFormStartTime("00:00")
    setFormIsActive(true)
    setFormIsGlobal(false)
    setEditingJob(null)
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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Scheduler</h1>
          <p className="text-muted-foreground">
            Schedule automated tasks using job templates
          </p>
        </div>
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
                    <Label htmlFor="start-time" className="text-sm font-medium text-gray-700">Start Time</Label>
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

              {/* Timing hint */}
              {formScheduleType === "interval" && (
                <p className="text-xs text-gray-500">
                  Run every {formIntervalMinutes} minute{formIntervalMinutes !== 1 ? 's' : ''}
                  {formIntervalMinutes >= 60 && ` (${Math.floor(formIntervalMinutes / 60)}h ${formIntervalMinutes % 60}m)`}
                </p>
              )}
              {["hourly", "daily", "weekly", "monthly"].includes(formScheduleType) && (
                <p className="text-xs text-gray-500">First run at {formStartTime}</p>
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

                {user?.role === "admin" && !editingJob && (
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
                    className="flex-1"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Run Now
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
