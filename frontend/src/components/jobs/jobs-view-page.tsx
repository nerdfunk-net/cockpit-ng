"use client"

import { useEffect, useState, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { History, RefreshCw, XCircle, ChevronLeft, ChevronRight, Trash2, Eye, CheckCircle2, XCircle as XCircleIcon, AlertCircle, Server, GitBranch, Key, FileText, HardDrive, Wifi, Download } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import { useToast } from "@/hooks/use-toast"

interface JobRun {
  id: number
  job_schedule_id: number | null
  job_template_id: number | null
  celery_task_id: string | null
  job_name: string
  job_type: string
  status: string
  triggered_by: string
  queued_at: string
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  error_message: string | null
  result: Record<string, React.ReactNode> | null
  target_devices: string[] | null
  executed_by: string | null
  schedule_name: string | null
  template_name: string | null
}

interface PaginatedResponse {
  items: JobRun[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Backup job result types
interface BackupDeviceResult {
  device_id: string
  device_name: string
  device_ip: string
  platform: string
  running_config_file?: string
  startup_config_file?: string
  running_config_bytes?: number
  startup_config_bytes?: number
  ssh_connection_success: boolean
  running_config_success?: boolean
  startup_config_success?: boolean
  error?: string
}

interface BackupJobResult {
  success: boolean
  devices_backed_up: number
  devices_failed: number
  message: string
  backed_up_devices: BackupDeviceResult[]
  failed_devices: BackupDeviceResult[]
  git_status?: {
    repository_existed: boolean
    operation: string
    repository_path: string
    repository_url: string
    branch: string
  }
  git_commit_status?: {
    committed: boolean
    pushed: boolean
    commit_hash: string
    files_changed: number
  }
  credential_info?: {
    credential_id: number
    credential_name: string
    username: string
  }
  repository?: string
  commit_date?: string
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown
}

// Helper to check if result is a backup job result
function isBackupJobResult(result: Record<string, unknown>): result is BackupJobResult {
  return (
    'backed_up_devices' in result || 
    'failed_devices' in result ||
    ('devices_backed_up' in result && 'devices_failed' in result)
  )
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const EMPTY_ARRAY: JobRun[] = []

export function JobsViewPage() {
  const token = useAuthStore(state => state.token)
  const { toast } = useToast()
  const [jobRuns, setJobRuns] = useState<JobRun[]>(EMPTY_ARRAY)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("all")
  const [triggerFilter, setTriggerFilter] = useState<string>("all")
  const [templateFilter, setTemplateFilter] = useState<string>("all")
  const [availableTemplates, setAvailableTemplates] = useState<Array<{id: number, name: string}>>([])
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)
  const [viewingResult, setViewingResult] = useState<JobRun | null>(null)

  // Fetch available templates for filter dropdown
  const fetchTemplates = useCallback(async () => {
    if (!token) return
    try {
      const response = await fetch("/api/proxy/job-runs/templates", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (response.ok) {
        const data = await response.json()
        setAvailableTemplates(data.templates || [])
      }
    } catch (error) {
      console.error("Error fetching templates:", error)
    }
  }, [token])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const fetchJobRuns = useCallback(async () => {
    if (!token) return

    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      })
      
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      if (jobTypeFilter && jobTypeFilter !== "all") {
        params.append("job_type", jobTypeFilter)
      }
      if (triggerFilter && triggerFilter !== "all") {
        params.append("triggered_by", triggerFilter)
      }
      if (templateFilter && templateFilter !== "all") {
        params.append("template_id", templateFilter)
      }

      const response = await fetch(`/api/proxy/job-runs?${params.toString()}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data: PaginatedResponse = await response.json()
        setJobRuns(data.items || [])
        setTotal(data.total)
        setTotalPages(data.total_pages)
      }
    } catch (error) {
      console.error("Error fetching job runs:", error)
    } finally {
      setLoading(false)
    }
  }, [token, page, pageSize, statusFilter, jobTypeFilter, triggerFilter, templateFilter])

  const cancelJobRun = useCallback(async (runId: number) => {
    if (!token) return

    try {
      setCancellingId(runId)
      const response = await fetch(`/api/proxy/job-runs/${runId}/cancel`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        await fetchJobRuns()
        toast({
          title: "Job cancelled",
          description: "The job has been cancelled.",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Failed to cancel job",
          description: error.detail || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error cancelling job:", error)
      toast({
        title: "Failed to cancel job",
        description: "Network error",
        variant: "destructive",
      })
    } finally {
      setCancellingId(null)
    }
  }, [token, toast, fetchJobRuns])

  const deleteJobRun = useCallback(async (runId: number) => {
    if (!token) return

    try {
      setDeletingId(runId)
      const response = await fetch(`/api/proxy/job-runs/${runId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        await fetchJobRuns()
        toast({
          title: "Entry deleted",
          description: "The job run has been removed from history.",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Failed to delete entry",
          description: error.detail || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting job run:", error)
      toast({
        title: "Failed to delete entry",
        description: "Network error",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }, [token, toast, fetchJobRuns])

  const hasActiveFilters = statusFilter !== "all" || jobTypeFilter !== "all" || triggerFilter !== "all" || templateFilter !== "all"

  const getFilterDescription = useCallback(() => {
    const parts: string[] = []
    if (statusFilter !== "all") parts.push(`status: ${statusFilter}`)
    if (jobTypeFilter !== "all") parts.push(`type: ${jobTypeFilter}`)
    if (triggerFilter !== "all") parts.push(`trigger: ${triggerFilter}`)
    if (templateFilter !== "all") {
      const template = availableTemplates.find(t => t.id.toString() === templateFilter)
      parts.push(`template: ${template?.name || templateFilter}`)
    }
    return parts.length > 0 ? parts.join(", ") : "all"
  }, [statusFilter, jobTypeFilter, triggerFilter, templateFilter, availableTemplates])

  const clearHistory = useCallback(async () => {
    if (!token) return
    
    const filterDesc = getFilterDescription()
    const confirmMsg = hasActiveFilters
      ? `Are you sure you want to clear job history matching: ${filterDesc}? This cannot be undone.`
      : "Are you sure you want to clear all job history? This cannot be undone."
    
    if (!confirm(confirmMsg)) return

    try {
      setClearing(true)
      
      // Build query params based on active filters
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (jobTypeFilter !== "all") params.append("job_type", jobTypeFilter)
      if (triggerFilter !== "all") params.append("triggered_by", triggerFilter)
      if (templateFilter !== "all") params.append("template_id", templateFilter)
      
      const endpoint = hasActiveFilters
        ? `/api/proxy/job-runs/clear-filtered?${params.toString()}`
        : "/api/proxy/job-runs/clear-all"
      
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        await fetchJobRuns() // Refresh to show remaining jobs
        toast({
          title: "History cleared",
          description: data.message || "Job history has been cleared.",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Failed to clear history",
          description: error.detail || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error clearing history:", error)
      toast({
        title: "Failed to clear history",
        description: "Network error",
        variant: "destructive",
      })
    } finally {
      setClearing(false)
    }
  }, [token, toast, statusFilter, jobTypeFilter, triggerFilter, templateFilter, hasActiveFilters, getFilterDescription, fetchJobRuns])

  useEffect(() => {
    fetchJobRuns()
  }, [fetchJobRuns])

  // Auto-refresh for running jobs
  useEffect(() => {
    const hasRunningJobs = jobRuns.some(run => run.status === "running" || run.status === "pending")
    if (!hasRunningJobs) return

    const interval = setInterval(() => {
      fetchJobRuns()
    }, 5000)

    return () => clearInterval(interval)
  }, [jobRuns, fetchJobRuns])

  const getStatusBadgeClasses = (status: string): string => {
    const classes: Record<string, string> = {
      completed: "bg-green-100 text-green-700 border-green-200",
      running: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse",
      pending: "bg-amber-100 text-amber-700 border-amber-200",
      failed: "bg-red-100 text-red-700 border-red-200",
      cancelled: "bg-slate-100 text-slate-600 border-slate-200",
    }
    return classes[status.toLowerCase()] || "bg-slate-100 text-slate-600 border-slate-200"
  }

  const getTriggerBadgeClasses = (triggeredBy: string): string => {
    const classes: Record<string, string> = {
      manual: "bg-purple-100 text-purple-700 border-purple-200",
      system: "bg-cyan-100 text-cyan-700 border-cyan-200",
      schedule: "bg-slate-100 text-slate-600 border-slate-200",
    }
    return classes[triggeredBy.toLowerCase()] || "bg-slate-100 text-slate-600 border-slate-200"
  }

  const formatDuration = (durationSeconds: number | null, startedAt: string | null, completedAt: string | null): string => {
    if (durationSeconds !== null) {
      const duration = Math.round(durationSeconds)
      if (duration < 60) return `${duration}s`
      if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
      return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
    }
    
    if (startedAt && !completedAt) {
      // Still running - calculate from start
      const start = new Date(startedAt).getTime()
      const duration = Math.floor((Date.now() - start) / 1000)
      if (duration < 60) return `${duration}s`
      if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
      return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
    }

    return "-"
  }

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return "-"
    const date = new Date(dateStr)
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading && jobRuns.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Loading job history...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <TooltipProvider>
        <div className="flex items-center justify-between">
          <div>
          <h1 className="text-3xl font-bold text-gray-900">Job History</h1>
          <p className="text-gray-600 mt-1">View running and completed background jobs</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filters */}
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={jobTypeFilter} onValueChange={(value) => { setJobTypeFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Job Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="backup">Backup</SelectItem>
              <SelectItem value="cache_devices">Cache Devices</SelectItem>
              <SelectItem value="cache_locations">Cache Locations</SelectItem>
              <SelectItem value="cache_git_commits">Cache Git Commits</SelectItem>
              <SelectItem value="sync_devices">Sync Devices</SelectItem>
              <SelectItem value="run_commands">Run Commands</SelectItem>
              <SelectItem value="compare_devices">Compare Devices</SelectItem>
            </SelectContent>
          </Select>

          <Select value={triggerFilter} onValueChange={(value) => { setTriggerFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Trigger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Triggers</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="schedule">Schedule</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>

          <Select value={templateFilter} onValueChange={(value) => { setTemplateFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Templates</SelectItem>
              {availableTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id.toString()}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={fetchJobRuns} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={clearHistory} 
                variant="outline" 
                size="sm" 
                disabled={clearing || jobRuns.length === 0}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <Trash2 className={`mr-2 h-4 w-4 ${clearing ? 'animate-spin' : ''}`} />
                {hasActiveFilters ? "Clear Filtered" : "Clear All"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{hasActiveFilters ? `Clear jobs matching: ${getFilterDescription()}` : "Clear all job history"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      </TooltipProvider>

      {jobRuns.length === 0 ? (
        <div className="rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
            <div className="flex items-center space-x-2">
              <History className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">Job Runs</h3>
                <p className="text-blue-100 text-xs">Background job execution history</p>
              </div>
            </div>
          </div>
          <div className="bg-white flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <History className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-lg font-semibold text-gray-700 mb-1">No job runs found</p>
            <p className="text-sm text-gray-500">
              Job execution history will appear here when jobs are scheduled or run manually
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="h-4 w-4" />
                <div>
                  <h3 className="text-sm font-semibold">Job Runs ({total})</h3>
                  <p className="text-blue-100 text-xs">Background job execution history</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white">
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="w-[180px] text-gray-600 font-semibold">Job Name</TableHead>
                    <TableHead className="w-[120px] text-gray-600 font-semibold">Type</TableHead>
                    <TableHead className="w-[90px] text-gray-600 font-semibold">Status</TableHead>
                    <TableHead className="w-[80px] text-gray-600 font-semibold">Trigger</TableHead>
                    <TableHead className="w-[110px] text-gray-600 font-semibold">Started</TableHead>
                    <TableHead className="w-[80px] text-gray-600 font-semibold">Duration</TableHead>
                    <TableHead className="w-[100px] text-gray-600 font-semibold">Template</TableHead>
                    <TableHead className="w-[60px] text-right text-gray-600 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobRuns.map((run, index) => (
                    <TableRow key={run.id} className={`hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <TableCell className="font-medium text-gray-700">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help truncate block max-w-[160px] hover:text-blue-600 transition-colors">
                              {run.job_name}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-sm">
                            <div className="space-y-1 text-xs">
                              <p><strong>ID:</strong> {run.id}</p>
                              <p><strong>Schedule:</strong> {run.schedule_name || '-'}</p>
                              {run.celery_task_id && (
                                <p><strong>Task ID:</strong> {run.celery_task_id.slice(0, 8)}...</p>
                              )}
                              {run.executed_by && (
                                <p><strong>Executed by:</strong> {run.executed_by}</p>
                              )}
                              {run.error_message && (
                                <p className="text-red-400 mt-2">{run.error_message}</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                          {run.job_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs border ${getStatusBadgeClasses(run.status)}`}>
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${getTriggerBadgeClasses(run.triggered_by)}`}>
                          {run.triggered_by}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDateTime(run.started_at || run.queued_at)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        <span className="font-mono text-xs">
                          {formatDuration(run.duration_seconds, run.started_at, run.completed_at)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate block max-w-[90px] cursor-help">
                              {run.template_name || '-'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{run.template_name || 'No template'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {run.status === "completed" && run.result && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                  onClick={() => setViewingResult(run)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View result</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {(run.status === "pending" || run.status === "running") && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  onClick={() => cancelJobRun(run.id)}
                                  disabled={cancellingId === run.id}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Cancel job</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {run.status !== "pending" && run.status !== "running" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  onClick={() => deleteJobRun(run.id)}
                                  disabled={deletingId === run.id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete entry</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
              <div className="text-sm text-gray-600">
                Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} of {total} runs
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-gray-600 px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Result Dialog */}
      <Dialog open={viewingResult !== null} onOpenChange={(open) => !open && setViewingResult(null)}>
        <DialogContent className="sm:max-w-6xl w-[90vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-500" />
              Job Result: {viewingResult?.job_name}
            </DialogTitle>
            <DialogDescription>
              {viewingResult?.job_type} • Completed {viewingResult?.completed_at ? new Date(viewingResult.completed_at).toLocaleString() : 'N/A'}
            </DialogDescription>
          </DialogHeader>

          {viewingResult?.result && (() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = viewingResult.result as Record<string, any>

            return ((<TooltipProvider><div className="space-y-4" key="result-content">
              {/* Summary - only show for non-backup jobs */}
              {!isBackupJobResult(result) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                  <p className={`text-lg font-semibold ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                    {result.success ? 'Success' : 'Failed'}
                  </p>
                </div>
                {result.total !== undefined && (
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
                    <p className="text-lg font-semibold text-gray-700">{String(result.total)}</p>
                  </div>
                )}
                {result.success_count !== undefined && (
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-600 uppercase tracking-wide">Success</p>
                    <p className="text-lg font-semibold text-green-700">{String(result.success_count)}</p>
                  </div>
                )}
                {result.failed_count !== undefined && (
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-red-600 uppercase tracking-wide">Failed</p>
                    <p className="text-lg font-semibold text-red-700">{String(result.failed_count)}</p>
                  </div>
                )}
                {result.completed !== undefined && (
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-600 uppercase tracking-wide">Completed</p>
                    <p className="text-lg font-semibold text-green-700">{String(result.completed)}</p>
                  </div>
                )}
                {result.failed !== undefined && (
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-red-600 uppercase tracking-wide">Failed</p>
                    <p className="text-lg font-semibold text-red-700">{String(result.failed)}</p>
                  </div>
                )}
                {result.differences_found !== undefined && (
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-amber-600 uppercase tracking-wide">Differences</p>
                    <p className="text-lg font-semibold text-amber-700">{String(result.differences_found)}</p>
                  </div>
                )}
              </div>
              )}

              {/* Message */}
              {result.message && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">{String(result.message)}</p>
                </div>
              )}

              {/* Backup Job Results - Specialized Display */}
              {isBackupJobResult(result) && (
                <div className="space-y-4">
                  {/* Backup Summary Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Download className="h-4 w-4 text-green-600" />
                        <p className="text-xs text-green-600 uppercase tracking-wide font-medium">Backed Up</p>
                      </div>
                      <p className="text-2xl font-bold text-green-700">{result.devices_backed_up}</p>
                    </div>
                    <div className={`${result.devices_failed > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} border rounded-lg p-3 text-center`}>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <XCircleIcon className={`h-4 w-4 ${result.devices_failed > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                        <p className={`text-xs uppercase tracking-wide font-medium ${result.devices_failed > 0 ? 'text-red-600' : 'text-gray-500'}`}>Failed</p>
                      </div>
                      <p className={`text-2xl font-bold ${result.devices_failed > 0 ? 'text-red-700' : 'text-gray-400'}`}>{result.devices_failed}</p>
                    </div>
                    {result.git_commit_status && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-purple-600" />
                          <p className="text-xs text-purple-600 uppercase tracking-wide font-medium">Files Changed</p>
                        </div>
                        <p className="text-2xl font-bold text-purple-700">{result.git_commit_status.files_changed}</p>
                      </div>
                    )}
                    {result.repository && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <HardDrive className="h-4 w-4 text-slate-600" />
                          <p className="text-xs text-slate-600 uppercase tracking-wide font-medium">Repository</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-700 truncate">{result.repository}</p>
                      </div>
                    )}
                  </div>

                  {/* Git & Credential Info Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {result.git_status && (
                      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <GitBranch className="h-5 w-5 text-purple-600" />
                          <h4 className="text-sm font-semibold text-purple-800">Git Repository</h4>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-purple-600">Branch:</span>
                            <span className="font-mono text-purple-800">{result.git_status.branch}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-purple-600">Operation:</span>
                            <Badge className="bg-purple-100 text-purple-700 border-purple-300 text-xs">{result.git_status.operation}</Badge>
                          </div>
                          {result.git_commit_status && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-purple-600">Commit:</span>
                                <span className="font-mono text-purple-800">{result.git_commit_status.commit_hash}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-purple-600">Status:</span>
                                <div className="flex gap-2">
                                  {result.git_commit_status.committed && (
                                    <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">Committed</Badge>
                                  )}
                                  {result.git_commit_status.pushed && (
                                    <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">Pushed</Badge>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {result.credential_info && (
                      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Key className="h-5 w-5 text-amber-600" />
                          <h4 className="text-sm font-semibold text-amber-800">Credentials Used</h4>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-amber-600">Name:</span>
                            <span className="font-medium text-amber-800">{result.credential_info.credential_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-amber-600">Username:</span>
                            <span className="font-mono text-amber-800">{result.credential_info.username}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Backed Up Devices Table */}
                  {result.backed_up_devices && result.backed_up_devices.length > 0 && (
                    <div className="border border-green-200 rounded-lg overflow-hidden">
                      <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-white" />
                          <h4 className="text-sm font-semibold text-white">Backed Up Devices ({result.backed_up_devices.length})</h4>
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-green-50 hover:bg-green-50">
                              <TableHead className="text-xs font-semibold text-green-800">Device Name</TableHead>
                              <TableHead className="text-xs font-semibold text-green-800">IP Address</TableHead>
                              <TableHead className="text-xs font-semibold text-green-800">Platform</TableHead>
                              <TableHead className="text-xs font-semibold text-green-800 text-center">SSH</TableHead>
                              <TableHead className="text-xs font-semibold text-green-800 text-center">Running</TableHead>
                              <TableHead className="text-xs font-semibold text-green-800 text-center">Startup</TableHead>
                              <TableHead className="text-xs font-semibold text-green-800 text-right">Size</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.backed_up_devices.map((device: BackupDeviceResult) => (
                              <TableRow 
                                key={device.device_id} 
                                className="bg-green-50/30 hover:bg-green-100/50 transition-colors border-b border-green-100"
                              >
                                <TableCell className="font-medium text-green-900">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    {device.device_name}
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-sm text-green-700">{device.device_ip}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">
                                    {device.platform}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  {device.ssh_connection_success ? (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Wifi className="h-4 w-4 text-green-600 mx-auto" />
                                      </TooltipTrigger>
                                      <TooltipContent>SSH Connected</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <XCircleIcon className="h-4 w-4 text-red-500 mx-auto" />
                                      </TooltipTrigger>
                                      <TooltipContent>SSH Failed</TooltipContent>
                                    </Tooltip>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {device.running_config_success ? (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Running config saved</p>
                                        {device.running_config_file && (
                                          <p className="text-xs text-gray-400 font-mono">{device.running_config_file.split('/').pop()}</p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {device.startup_config_success ? (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Startup config saved</p>
                                        {device.startup_config_file && (
                                          <p className="text-xs text-gray-400 font-mono">{device.startup_config_file.split('/').pop()}</p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="text-xs text-green-700">
                                    {device.running_config_bytes && (
                                      <div>R: {formatBytes(device.running_config_bytes)}</div>
                                    )}
                                    {device.startup_config_bytes && (
                                      <div>S: {formatBytes(device.startup_config_bytes)}</div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Failed Devices Table */}
                  {result.failed_devices && result.failed_devices.length > 0 && (
                    <div className="border border-red-200 rounded-lg overflow-hidden">
                      <div className="bg-gradient-to-r from-red-500 to-rose-500 px-4 py-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-white" />
                          <h4 className="text-sm font-semibold text-white">Failed Devices ({result.failed_devices.length})</h4>
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-red-50 hover:bg-red-50">
                              <TableHead className="text-xs font-semibold text-red-800">Device Name</TableHead>
                              <TableHead className="text-xs font-semibold text-red-800">IP Address</TableHead>
                              <TableHead className="text-xs font-semibold text-red-800">Platform</TableHead>
                              <TableHead className="text-xs font-semibold text-red-800 text-center">SSH</TableHead>
                              <TableHead className="text-xs font-semibold text-red-800">Error</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.failed_devices.map((device: BackupDeviceResult) => (
                              <TableRow 
                                key={device.device_id} 
                                className="bg-red-50/30 hover:bg-red-100/50 transition-colors border-b border-red-100"
                              >
                                <TableCell className="font-medium text-red-900">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    {device.device_name}
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-sm text-red-700">{device.device_ip}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs bg-white border-red-300 text-red-700">
                                    {device.platform}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  {device.ssh_connection_success ? (
                                    <Wifi className="h-4 w-4 text-green-600 mx-auto" />
                                  ) : (
                                    <XCircleIcon className="h-4 w-4 text-red-500 mx-auto" />
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-red-700 max-w-[200px]">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help line-clamp-2">{device.error || 'Unknown error'}</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-md">
                                      <p className="text-xs">{device.error || 'Unknown error'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generic Device Results Table (for non-backup jobs) */}
              {!isBackupJobResult(result) && Array.isArray(result.results) && 
               (result.results as unknown[]).length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <h4 className="text-sm font-semibold text-gray-700">Device Results</h4>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs font-semibold">Device</TableHead>
                          <TableHead className="text-xs font-semibold">Operation</TableHead>
                          <TableHead className="text-xs font-semibold">Status</TableHead>
                          <TableHead className="text-xs font-semibold">Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(result.results as Array<Record<string, unknown>>).map((deviceResult, index) => (
                          <TableRow key={String(deviceResult.device_id || deviceResult.hostname || index)} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <TableCell className="text-sm font-medium">
                              {String(deviceResult.hostname || '').slice(0, 100) || String(deviceResult.device_id || '').slice(0, 8) || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {String(deviceResult.operation || '-')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {deviceResult.success ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span className="text-xs">Success</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-600">
                                  <XCircleIcon className="h-4 w-4" />
                                  <span className="text-xs">Failed</span>
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-gray-600 max-w-[200px] truncate">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">{String(deviceResult.message || '-')}</span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-sm">
                                  <p className="text-xs">{String(deviceResult.message || '-')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Error Message (for failed jobs) */}
              {result.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Error</p>
                    <p className="text-sm text-red-700">{String(result.error)}</p>
                  </div>
                </div>
              )}

              {/* Raw JSON (collapsible) */}
              <details className="border rounded-lg">
                <summary className="px-4 py-2 cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50">
                  View Raw JSON
                </summary>
                <pre className="p-4 bg-gray-900 text-gray-100 text-xs overflow-x-auto rounded-b-lg">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div></TooltipProvider>) as React.ReactNode)
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
