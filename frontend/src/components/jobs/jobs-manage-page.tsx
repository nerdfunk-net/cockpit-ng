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
import { Plus, Play, Pause, Trash2, Edit, Calendar, Clock } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import { useToast } from "@/hooks/use-toast"

interface JobSchedule {
  id: number
  job_identifier: string
  job_name: string
  schedule_type: "now" | "interval" | "hourly" | "daily" | "weekly" | "monthly" | "custom"
  cron_expression?: string
  interval_minutes?: number
  start_time?: string
  start_date?: string
  is_active: boolean
  is_global: boolean
  user_id?: number
  credential_id?: number
  job_parameters?: Record<string, any>
  created_at: string
  updated_at: string
  last_run?: string
  next_run?: string
}

interface JobType {
  identifier: string
  name: string
  description: string
  requires_credentials: boolean
  is_global_only: boolean
}

const EMPTY_SCHEDULES: JobSchedule[] = []
const EMPTY_TYPES: JobType[] = []

export function JobsManagePage() {
  const token = useAuthStore(state => state.token)
  const user = useAuthStore(state => state.user)
  const { toast } = useToast()
  const [jobSchedules, setJobSchedules] = useState<JobSchedule[]>(EMPTY_SCHEDULES)
  const [jobTypes, setJobTypes] = useState<JobType[]>(EMPTY_TYPES)
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<JobSchedule | null>(null)

  // Form state
  const [formJobType, setFormJobType] = useState("")
  const [formJobName, setFormJobName] = useState("")
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

  // Fetch available job types
  const fetchJobTypes = useCallback(async () => {
    if (!token) return

    try {
      const response = await fetch("/api/proxy/api/job-schedules/available/types", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setJobTypes(data.job_types || [])
      }
    } catch (error) {
      console.error("Error fetching job types:", error)
    }
  }, [token])

  useEffect(() => {
    fetchJobSchedules()
    fetchJobTypes()
  }, [fetchJobSchedules, fetchJobTypes])

  const handleSaveJob = useCallback(async () => {
    if (!token || !formJobName) return

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
            job_name: formJobName,
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
            title: "Job Updated",
            description: `Job schedule "${formJobName}" has been updated successfully.`,
            variant: "default"
          })
        } else {
          toast({
            title: "Update Failed",
            description: "Failed to update job schedule. Please try again.",
            variant: "destructive"
          })
        }
      } else {
        // Create new job
        if (!formJobType) return

        const response = await fetch("/api/proxy/api/job-schedules", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            job_identifier: formJobType,
            job_name: formJobName,
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
            title: "Job Created",
            description: `Job schedule "${formJobName}" has been created successfully.`,
            variant: "default"
          })
        } else {
          toast({
            title: "Creation Failed",
            description: "Failed to create job schedule. Please try again.",
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
  }, [token, editingJob, formJobType, formJobName, formScheduleType, formIsActive, formIsGlobal, fetchJobSchedules, toast])

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

  const handleRunNow = useCallback(async (jobId: number, jobName: string) => {
    if (!token) return

    try {
      const response = await fetch("/api/proxy/api/job-schedules/execute", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_schedule_id: jobId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Job Started",
          description: `Job "${jobName}" has been queued for execution. Task ID: ${data.celery_task_id}`,
          variant: "default"
        })
        // Refresh to update last_run timestamp
        fetchJobSchedules()
      } else {
        toast({
          title: "Execution Failed",
          description: "Failed to start job execution. Please try again.",
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
    setFormJobType(job.job_identifier)
    setFormJobName(job.job_name)
    setFormScheduleType(job.schedule_type)
    setFormIntervalMinutes(job.interval_minutes || 60)
    setFormStartTime(job.start_time || "00:00")
    setFormIsActive(job.is_active)
    setFormIsGlobal(job.is_global)
    setIsDialogOpen(true)
  }, [])

  const resetForm = useCallback(() => {
    setFormJobType("")
    setFormJobName("")
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
          <h1 className="text-3xl font-bold tracking-tight">Job Schedules</h1>
          <p className="text-muted-foreground">
            Manage and schedule automated tasks
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              New Job Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingJob ? "Edit Job Schedule" : "Create Job Schedule"}</DialogTitle>
              <DialogDescription>
                {editingJob ? "Update job schedule settings" : "Schedule a new automated task"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="job-type" className="text-sm font-semibold">Job Type</Label>
                <Select value={formJobType} onValueChange={setFormJobType} disabled={!!editingJob}>
                  <SelectTrigger id="job-type" className="h-11">
                    <SelectValue placeholder="Select job type" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobTypes.map((type) => (
                      <SelectItem key={type.identifier} value={type.identifier}>
                        <div className="flex flex-col">
                          <span className="font-medium">{type.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formJobType && (
                  <div className="p-3 rounded-md bg-muted/50 border">
                    <p className="text-sm text-muted-foreground">
                      {jobTypes.find(t => t.identifier === formJobType)?.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-name" className="text-sm font-semibold">Job Name</Label>
                <Input
                  id="job-name"
                  placeholder="Enter a descriptive name"
                  value={formJobName}
                  onChange={(e) => setFormJobName(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule-type" className="text-sm font-semibold">Schedule</Label>
                <Select
                  value={formScheduleType}
                  onValueChange={(value) => setFormScheduleType(value as JobSchedule["schedule_type"])}
                >
                  <SelectTrigger id="schedule-type" className="h-11">
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

              {formScheduleType === "interval" && (
                <div className="space-y-2">
                  <Label htmlFor="interval-minutes" className="text-sm font-semibold">Interval (minutes)</Label>
                  <Input
                    id="interval-minutes"
                    type="number"
                    min="1"
                    max="1440"
                    placeholder="60"
                    value={formIntervalMinutes}
                    onChange={(e) => setFormIntervalMinutes(parseInt(e.target.value) || 60)}
                    className="h-11"
                  />
                  <p className="text-sm text-muted-foreground">
                    Run every {formIntervalMinutes} minute{formIntervalMinutes !== 1 ? 's' : ''}
                    {formIntervalMinutes >= 60 && ` (${Math.floor(formIntervalMinutes / 60)}h ${formIntervalMinutes % 60}m)`}
                  </p>
                </div>
              )}

              {["hourly", "daily", "weekly", "monthly"].includes(formScheduleType) && (
                <div className="space-y-2">
                  <Label htmlFor="start-time" className="text-sm font-semibold">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="h-11"
                  />
                  <p className="text-sm text-muted-foreground">
                    First run at {formStartTime}
                  </p>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm font-semibold mb-3 text-muted-foreground">Options</p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                <div className="space-y-0.5">
                  <Label htmlFor="is-active" className="text-base font-medium">Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable this job schedule
                  </p>
                </div>
                <Switch
                  id="is-active"
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                />
              </div>

              {user?.role === "admin" && (
                <div className="flex items-center justify-between p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                  <div className="space-y-0.5">
                    <Label htmlFor="is-global" className="text-base font-medium flex items-center gap-2">
                      Global Job
                      <Badge variant="secondary" className="text-xs">Admin</Badge>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Visible to all users
                    </p>
                  </div>
                  <Switch
                    id="is-global"
                    checked={formIsGlobal}
                    onCheckedChange={setFormIsGlobal}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="min-w-[100px]">
                Cancel
              </Button>
              <Button onClick={handleSaveJob} className="min-w-[140px]">
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
            <p className="text-xl font-semibold mb-2">No job schedules yet</p>
            <p className="text-muted-foreground mb-4">
              Create your first job schedule to automate tasks
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Job Schedule
            </Button>
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
                      {job.job_name}
                      {job.is_global && (
                        <Badge variant="secondary" className="text-xs">
                          Global
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{job.job_identifier}</CardDescription>
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
                    onClick={() => handleRunNow(job.id, job.job_name)}
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
