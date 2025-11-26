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
import { History, RefreshCw, Trash2 } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import { useToast } from "@/hooks/use-toast"

interface Job {
  id: string
  type: string
  status: string
  started_by: string
  started_at: string
  completed_at?: string
  progress?: {
    processed: number
    total: number
    message?: string
  }
  result_summary?: Record<string, unknown>
  error_message?: string
}

const EMPTY_ARRAY: Job[] = []

export function JobsViewPage() {
  const token = useAuthStore(state => state.token)
  const { toast } = useToast()
  const [jobs, setJobs] = useState<Job[]>(EMPTY_ARRAY)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    if (!token) return

    try {
      setLoading(true)
      const response = await fetch("/api/proxy/api/jobs?limit=50", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error("Error fetching jobs:", error)
    } finally {
      setLoading(false)
    }
  }, [token])

  const deleteJob = useCallback(async (jobId: string) => {
    if (!token) return

    try {
      setDeletingJobId(jobId)
      const response = await fetch(`/api/proxy/api/jobs/${jobId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        setJobs(prev => prev.filter(job => job.id !== jobId))
        toast({
          title: "Job deleted",
          description: "The job has been removed from history.",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Failed to delete job",
          description: error.detail || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting job:", error)
      toast({
        title: "Failed to delete job",
        description: "Network error",
        variant: "destructive",
      })
    } finally {
      setDeletingJobId(null)
    }
  }, [token, toast])

  const clearHistory = useCallback(async () => {
    if (!token) return

    if (!window.confirm("Are you sure you want to clear all completed, failed, and cancelled jobs?")) {
      return
    }

    try {
      setClearing(true)
      const response = await fetch("/api/proxy/api/jobs/cleanup", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const result = await response.json()
        await fetchJobs()
        toast({
          title: "History cleared",
          description: `Successfully removed ${result.deleted_count || 0} jobs.`,
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
  }, [token, fetchJobs, toast])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

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

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt).getTime()
    const end = completedAt ? new Date(completedAt).getTime() : Date.now()
    const duration = Math.floor((end - start) / 1000)

    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job History</h1>
          <p className="text-gray-600 mt-1">View running and completed background jobs</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchJobs} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={clearHistory}
            variant="outline"
            size="sm"
            disabled={clearing || jobs.length === 0}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear All
          </Button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
            <div className="flex items-center space-x-2">
              <History className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">Jobs</h3>
                <p className="text-blue-100 text-xs">Background job execution history</p>
              </div>
            </div>
          </div>
          <div className="bg-white flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <History className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-lg font-semibold text-gray-700 mb-1">No jobs found</p>
            <p className="text-sm text-gray-500">
              Job execution history will appear here
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
                  <h3 className="text-sm font-semibold">Jobs ({jobs.length})</h3>
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
                    <TableHead className="w-[200px] text-gray-600 font-semibold">Type</TableHead>
                    <TableHead className="w-[100px] text-gray-600 font-semibold">Status</TableHead>
                    <TableHead className="w-[100px] text-gray-600 font-semibold">Progress</TableHead>
                    <TableHead className="w-[120px] text-gray-600 font-semibold">Started</TableHead>
                    <TableHead className="w-[80px] text-gray-600 font-semibold">Duration</TableHead>
                    <TableHead className="w-[100px] text-gray-600 font-semibold">Started By</TableHead>
                    <TableHead className="w-[60px] text-right text-gray-600 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job, index) => (
                    <TableRow key={job.id} className={`hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <TableCell className="font-medium text-gray-700">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help truncate block max-w-[180px] hover:text-blue-600 transition-colors">
                              {job.type}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">ID: {job.id}</p>
                            {job.error_message && (
                              <p className="text-red-400 max-w-xs mt-1">{job.error_message}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs border ${getStatusBadgeClasses(job.status)}`}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {job.progress ? (
                          <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">
                            {job.progress.processed}/{job.progress.total}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDateTime(job.started_at)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        <span className="font-mono text-xs">{formatDuration(job.started_at, job.completed_at)}</span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 truncate max-w-[100px]">
                        {job.started_by}
                      </TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              onClick={() => deleteJob(job.id)}
                              disabled={deletingJobId === job.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete job</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
        </div>
      )}
    </div>
  )
}
