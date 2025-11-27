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
import { History, RefreshCw, XCircle, ChevronLeft, ChevronRight, Trash2, Eye, CheckCircle2, XCircle as XCircleIcon, AlertCircle } from "lucide-react"
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
  result: Record<string, unknown> | null
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
          
          {viewingResult?.result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                  <p className={`text-lg font-semibold ${(viewingResult.result as Record<string, unknown>).success ? 'text-green-600' : 'text-red-600'}`}>
                    {(viewingResult.result as Record<string, unknown>).success ? 'Success' : 'Failed'}
                  </p>
                </div>
                {(viewingResult.result as Record<string, unknown>).total !== undefined && (
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
                    <p className="text-lg font-semibold text-gray-700">{(viewingResult.result as Record<string, unknown>).total as number}</p>
                  </div>
                )}
                {(viewingResult.result as Record<string, unknown>).success_count !== undefined && (
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-600 uppercase tracking-wide">Success</p>
                    <p className="text-lg font-semibold text-green-700">{(viewingResult.result as Record<string, unknown>).success_count as number}</p>
                  </div>
                )}
                {(viewingResult.result as Record<string, unknown>).failed_count !== undefined && (
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-red-600 uppercase tracking-wide">Failed</p>
                    <p className="text-lg font-semibold text-red-700">{(viewingResult.result as Record<string, unknown>).failed_count as number}</p>
                  </div>
                )}
                {(viewingResult.result as Record<string, unknown>).completed !== undefined && (
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-600 uppercase tracking-wide">Completed</p>
                    <p className="text-lg font-semibold text-green-700">{(viewingResult.result as Record<string, unknown>).completed as number}</p>
                  </div>
                )}
                {(viewingResult.result as Record<string, unknown>).failed !== undefined && (
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-red-600 uppercase tracking-wide">Failed</p>
                    <p className="text-lg font-semibold text-red-700">{(viewingResult.result as Record<string, unknown>).failed as number}</p>
                  </div>
                )}
                {(viewingResult.result as Record<string, unknown>).differences_found !== undefined && (
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-amber-600 uppercase tracking-wide">Differences</p>
                    <p className="text-lg font-semibold text-amber-700">{(viewingResult.result as Record<string, unknown>).differences_found as number}</p>
                  </div>
                )}
              </div>

              {/* Message */}
              {(viewingResult.result as Record<string, unknown>).message && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">{(viewingResult.result as Record<string, unknown>).message as string}</p>
                </div>
              )}

              {/* Device Results Table */}
              {Array.isArray((viewingResult.result as Record<string, unknown>).results) && 
               ((viewingResult.result as Record<string, unknown>).results as unknown[]).length > 0 && (
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
                        {((viewingResult.result as Record<string, unknown>).results as Array<Record<string, unknown>>).map((deviceResult, index) => (
                          <TableRow key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <TableCell className="text-sm font-medium">
                              {(deviceResult.hostname as string) || (deviceResult.device_id as string)?.slice(0, 8) || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {(deviceResult.operation as string) || '-'}
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
                                  <span className="cursor-help">{(deviceResult.message as string) || '-'}</span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-sm">
                                  <p className="text-xs">{(deviceResult.message as string) || '-'}</p>
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
              {(viewingResult.result as Record<string, unknown>).error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Error</p>
                    <p className="text-sm text-red-700">{(viewingResult.result as Record<string, unknown>).error as string}</p>
                  </div>
                </div>
              )}

              {/* Raw JSON (collapsible) */}
              <details className="border rounded-lg">
                <summary className="px-4 py-2 cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50">
                  View Raw JSON
                </summary>
                <pre className="p-4 bg-gray-900 text-gray-100 text-xs overflow-x-auto rounded-b-lg">
                  {JSON.stringify(viewingResult.result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
