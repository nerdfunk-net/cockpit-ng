"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { History, RefreshCw } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"

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
  result_summary?: Record<string, any>
  error_message?: string
}

const EMPTY_ARRAY: Job[] = []

export function JobsViewPage() {
  const token = useAuthStore(state => state.token)
  const [jobs, setJobs] = useState<Job[]>(EMPTY_ARRAY)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-blue-500",
      running: "bg-yellow-500",
      completed: "bg-green-500",
      failed: "bg-red-500",
      cancelled: "bg-gray-500",
    }
    return colors[status.toLowerCase()] || "bg-gray-500"
  }

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt).getTime()
    const end = completedAt ? new Date(completedAt).getTime() : Date.now()
    const duration = Math.floor((end - start) / 1000)

    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading job history...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job History</h1>
          <p className="text-muted-foreground">
            View running and completed jobs
          </p>
        </div>
        <Button onClick={fetchJobs} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold mb-2">No jobs found</p>
            <p className="text-muted-foreground">
              Job execution history will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {job.type}
                      <Badge className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Started by {job.started_by} • {new Date(job.started_at).toLocaleString()}
                    </CardDescription>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDuration(job.started_at, job.completed_at)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {job.progress && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span>
                        {job.progress.processed} / {job.progress.total}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{
                          width: `${(job.progress.processed / job.progress.total) * 100}%`,
                        }}
                      />
                    </div>
                    {job.progress.message && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {job.progress.message}
                      </p>
                    )}
                  </div>
                )}

                {job.error_message && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive">{job.error_message}</p>
                  </div>
                )}

                {job.result_summary && Object.keys(job.result_summary).length > 0 && (
                  <div className="flex gap-4 text-sm">
                    {Object.entries(job.result_summary).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-muted-foreground">{key}: </span>
                        <span className="font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
