"use client"

import { useEffect, useState, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { History, RefreshCw, XCircle, ChevronLeft, ChevronRight, Trash2, Eye, ChevronDown, Loader2 } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import { useToast } from "@/hooks/use-toast"
import { JobResultDialog } from "../job-result-dialog"
import { JobRun, PaginatedResponse } from "../types/job-results"

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
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [jobTypeFilter, setJobTypeFilter] = useState<string[]>([])
  const [triggerFilter, setTriggerFilter] = useState<string[]>([])
  const [templateFilter, setTemplateFilter] = useState<string[]>([])
  const [availableTemplates, setAvailableTemplates] = useState<Array<{id: number, name: string}>>([])
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)
  const [viewingResult, setViewingResult] = useState<JobRun | null>(null)
  const [jobProgress, setJobProgress] = useState<Record<number, { completed: number; total: number; percentage: number }>>({})

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
      
      if (statusFilter.length > 0) {
        params.append("status", statusFilter.join(","))
      }
      if (jobTypeFilter.length > 0) {
        params.append("job_type", jobTypeFilter.join(","))
      }
      if (triggerFilter.length > 0) {
        params.append("triggered_by", triggerFilter.join(","))
      }
      if (templateFilter.length > 0) {
        params.append("template_id", templateFilter.join(","))
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

  const hasActiveFilters = statusFilter.length > 0 || jobTypeFilter.length > 0 || triggerFilter.length > 0 || templateFilter.length > 0

  const getFilterDescription = useCallback(() => {
    const parts: string[] = []
    if (statusFilter.length > 0) parts.push(`status: ${statusFilter.join(", ")}`)
    if (jobTypeFilter.length > 0) parts.push(`type: ${jobTypeFilter.join(", ")}`)
    if (triggerFilter.length > 0) parts.push(`trigger: ${triggerFilter.join(", ")}`)
    if (templateFilter.length > 0) {
      const templateNames = templateFilter.map(id => {
        const template = availableTemplates.find(t => t.id.toString() === id)
        return template?.name || id
      })
      parts.push(`template: ${templateNames.join(", ")}`)
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
      if (statusFilter.length > 0) params.append("status", statusFilter.join(","))
      if (jobTypeFilter.length > 0) params.append("job_type", jobTypeFilter.join(","))
      if (triggerFilter.length > 0) params.append("triggered_by", triggerFilter.join(","))
      if (templateFilter.length > 0) params.append("template_id", templateFilter.join(","))
      
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
      console.log('[Jobs] Auto-refreshing job list...')
      fetchJobRuns()
    }, 3000) // Refresh every 3 seconds for faster updates

    return () => clearInterval(interval)
  }, [jobRuns, fetchJobRuns])

  // Poll progress for running backup jobs
  useEffect(() => {
    if (!token) return

    const runningBackupJobs = jobRuns.filter(run => 
      run.status === "running" && 
      (run.job_type === "backup" || run.job_type === "Backup")
    )

    if (runningBackupJobs.length === 0) {
      setJobProgress({})
      return
    }

    const fetchProgress = async () => {
      const progressPromises = runningBackupJobs.map(async (run) => {
        try {
          const response = await fetch(`/api/proxy/job-runs/${run.id}/progress`, {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })
          if (response.ok) {
            const data = await response.json()
            return { runId: run.id, progress: data }
          }
        } catch (error) {
          console.error(`Error fetching progress for job ${run.id}:`, error)
        }
        return null
      })

      const results = await Promise.all(progressPromises)
      const newProgress: Record<number, { completed: number; total: number; percentage: number }> = {}
      
      results.forEach(result => {
        if (result && result.progress.completed !== null && result.progress.total !== null) {
          newProgress[result.runId] = {
            completed: result.progress.completed,
            total: result.progress.total,
            percentage: result.progress.percentage || 0,
          }
          console.log(`[Job ${result.runId}] Progress: ${result.progress.completed}/${result.progress.total} (${result.progress.percentage}%)`)
        }
      })

      setJobProgress(newProgress)
    }

    fetchProgress()
    const interval = setInterval(fetchProgress, 3000) // Poll every 3 seconds

    return () => clearInterval(interval)
  }, [jobRuns, token])

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

  const viewJobResult = useCallback(async (runId: number) => {
    if (!token) return
    
    try {
      // Fetch fresh job details to avoid stale cached data
      const response = await fetch(`/api/proxy/job-runs/${runId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      
      if (response.ok) {
        const freshJobRun = await response.json()
        setViewingResult(freshJobRun)
        console.log('[Jobs] Opened result dialog with fresh data for job', runId)
      } else {
        toast({
          title: "Failed to load job details",
          description: "Could not fetch the latest job information",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching job details:", error)
      toast({
        title: "Error loading job",
        description: "An error occurred while loading job details",
        variant: "destructive",
      })
    }
  }, [token, toast])

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

  // Helper functions for multi-select filters
  const toggleStatusFilter = (value: string) => {
    setStatusFilter(prev => 
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
    setPage(1)
  }

  const toggleJobTypeFilter = (value: string) => {
    setJobTypeFilter(prev => 
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
    setPage(1)
  }

  const toggleTriggerFilter = (value: string) => {
    setTriggerFilter(prev => 
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
    setPage(1)
  }

  const toggleTemplateFilter = (value: string) => {
    setTemplateFilter(prev => 
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
    setPage(1)
  }

  // Filter option definitions
  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "running", label: "Running" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
    { value: "cancelled", label: "Cancelled" },
  ]

  const jobTypeOptions = [
    { value: "backup", label: "Backup" },
    { value: "cache_devices", label: "Cache Devices" },
    { value: "cache_locations", label: "Cache Locations" },
    { value: "cache_git_commits", label: "Cache Git Commits" },
    { value: "sync_devices", label: "Sync Devices" },
    { value: "run_commands", label: "Run Commands" },
    { value: "compare_devices", label: "Compare Devices" },
    { value: "scan_prefixes", label: "Scan Prefixes" },
  ]

  const triggerOptions = [
    { value: "manual", label: "Manual" },
    { value: "schedule", label: "Schedule" },
    { value: "system", label: "System" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <TooltipProvider>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <History className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Job History</h1>
              <p className="text-gray-600 mt-1">View running and completed background jobs</p>
            </div>
          </div>
        <div className="flex items-center gap-3">
          {/* Filters */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[130px] justify-between">
                {statusFilter.length === 0 ? "All Status" : `${statusFilter.length} selected`}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[150px]">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {statusOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={statusFilter.includes(option.value)}
                  onCheckedChange={() => toggleStatusFilter(option.value)}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
              {statusFilter.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={false}
                    onCheckedChange={() => setStatusFilter([])}
                    className="text-red-600"
                  >
                    Clear all
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[150px] justify-between">
                {jobTypeFilter.length === 0 ? "All Types" : `${jobTypeFilter.length} selected`}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[180px]">
              <DropdownMenuLabel>Job Type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {jobTypeOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={jobTypeFilter.includes(option.value)}
                  onCheckedChange={() => toggleJobTypeFilter(option.value)}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
              {jobTypeFilter.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={false}
                    onCheckedChange={() => setJobTypeFilter([])}
                    className="text-red-600"
                  >
                    Clear all
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[130px] justify-between">
                {triggerFilter.length === 0 ? "All Triggers" : `${triggerFilter.length} selected`}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[150px]">
              <DropdownMenuLabel>Trigger</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {triggerOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={triggerFilter.includes(option.value)}
                  onCheckedChange={() => toggleTriggerFilter(option.value)}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
              {triggerFilter.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={false}
                    onCheckedChange={() => setTriggerFilter([])}
                    className="text-red-600"
                  >
                    Clear all
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[150px] justify-between">
                {templateFilter.length === 0 ? "All Templates" : `${templateFilter.length} selected`}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px]">
              <DropdownMenuLabel>Template</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableTemplates.map((template) => (
                <DropdownMenuCheckboxItem
                  key={template.id}
                  checked={templateFilter.includes(template.id.toString())}
                  onCheckedChange={() => toggleTemplateFilter(template.id.toString())}
                >
                  {template.name}
                </DropdownMenuCheckboxItem>
              ))}
              {templateFilter.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={false}
                    onCheckedChange={() => setTemplateFilter([])}
                    className="text-red-600"
                  >
                    Clear all
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

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
                        <div className="space-y-1.5">
                          <Badge className={`text-xs border ${getStatusBadgeClasses(run.status)}`}>
                            {run.status === "running" && jobProgress[run.id] ? (
                              <span className="flex items-center gap-1.5">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span className="font-semibold">{jobProgress[run.id]?.percentage ?? 0}%</span>
                              </span>
                            ) : (
                              run.status
                            )}
                          </Badge>
                          {run.status === "running" && jobProgress[run.id] && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <div className="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
                                <div 
                                  className="h-full bg-blue-500 transition-all duration-300"
                                  style={{ width: `${jobProgress[run.id]?.percentage ?? 0}%` }}
                                />
                              </div>
                              <span className="text-gray-600 font-mono text-xs whitespace-nowrap">
                                {jobProgress[run.id]?.completed ?? 0}/{jobProgress[run.id]?.total ?? 0}
                              </span>
                            </div>
                          )}
                        </div>
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
                                  onClick={() => viewJobResult(run.id)}
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
      <JobResultDialog
        jobRun={viewingResult}
        open={viewingResult !== null}
        onOpenChange={(open) => !open && setViewingResult(null)}
      />
    </div>
  )
}
