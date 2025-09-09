'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { 
  Activity, 
  Play, 
  Square, 
  Trash2, 
  Clock, 
  User, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  Eye
} from 'lucide-react'

interface BackgroundJob {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  completed_at?: string
  started_by: string
  progress?: {
    processed: number
    total: number
    message: string
  }
  results?: {
    devices_processed: number
    devices_added: number
    devices_updated: number
    errors: string[]
  }
}

export function CheckMKJobsPage() {
  const { token } = useAuthStore()
  const [jobs, setJobs] = useState<BackgroundJob[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedJob, setSelectedJob] = useState<BackgroundJob | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchFilter, setSearchFilter] = useState<string>('')
  
  // Auto-refresh jobs every 10 seconds
  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchJobs = async () => {
    if (!token) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/proxy/nb2cmk/jobs', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const startNewJob = async (jobType: string) => {
    if (!token) return
    
    try {
      // For now, all job types start device comparison jobs
      // In the future, we could add different endpoints for different job types
      const response = await fetch('/api/proxy/nb2cmk/start-diff-job', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        fetchJobs() // Refresh the job list
      }
    } catch (error) {
      console.error('Error starting job:', error)
    }
  }

  const stopJob = async (jobId: string) => {
    if (!token) return
    
    try {
      const response = await fetch(`/api/proxy/nb2cmk/job/${jobId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        fetchJobs() // Refresh the job list
      }
    } catch (error) {
      console.error('Error stopping job:', error)
    }
  }

  const clearJob = async (jobId: string) => {
    if (!token) return
    
    try {
      const response = await fetch(`/api/proxy/nb2cmk/job/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        fetchJobs() // Refresh the job list
      }
    } catch (error) {
      console.error('Error clearing job:', error)
    }
  }

  const clearAllCompletedJobs = async () => {
    if (!token) return
    
    try {
      const response = await fetch('/api/proxy/nb2cmk/jobs/clear-completed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        fetchJobs() // Refresh the job list
      }
    } catch (error) {
      console.error('Error clearing completed jobs:', error)
    }
  }

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    const matchesType = typeFilter === 'all' || job.type === typeFilter
    const matchesSearch = searchFilter === '' || 
      job.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      job.started_by.toLowerCase().includes(searchFilter.toLowerCase())
    
    return matchesStatus && matchesType && matchesSearch
  })

  // Pagination
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentJobs = filteredJobs.slice(startIndex, endIndex)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800"><AlertCircle className="h-3 w-3 mr-1" />Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'device-comparison':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700">Device Comparison</Badge>
      case 'sync-devices':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Device Sync</Badge>
      case 'backup':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700">Backup</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const calculateDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt)
    const end = completedAt ? new Date(completedAt) : new Date()
    const diffMs = end.getTime() - start.getTime()
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">CheckMK Jobs</h1>
          <p className="text-gray-600 mt-1">Manage and monitor background job execution</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={fetchJobs} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Job Management Actions */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">Job Management</h3>
                <p className="text-blue-100 text-xs">Start new background jobs and manage existing ones</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <Button onClick={() => startNewJob('device-comparison')} className="bg-purple-600 hover:bg-purple-700">
              <Play className="h-4 w-4 mr-2" />
              Start Device Comparison
            </Button>
            <Button onClick={clearAllCompletedJobs} variant="outline" className="text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Completed
            </Button>
          </div>
          
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Search</Label>
              <Input
                placeholder="Search jobs..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="device-comparison">Device Comparison</SelectItem>
                  <SelectItem value="sync-devices">Device Sync</SelectItem>
                  <SelectItem value="backup">Backup</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Per Page</Label>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(parseInt(value))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-gray-500/80 to-gray-600/80 text-white py-2 px-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-semibold">Job History</h3>
              <p className="text-gray-100 text-xs">Background job execution history and status</p>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Job ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Progress</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Started By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Started At</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    {loading ? "Loading jobs..." : "No jobs found"}
                  </td>
                </tr>
              ) : (
                currentJobs.map((job, index) => (
                  <tr key={job.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {job.id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3">
                      {getTypeBadge(job.type)}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="px-4 py-3">
                      {job.progress ? (
                        <div className="flex items-center space-x-2">
                          <Progress 
                            value={job.progress.total > 0 ? (job.progress.processed / job.progress.total) * 100 : 0}
                            className="w-16 h-2"
                          />
                          <span className="text-xs text-gray-600">
                            {job.progress.processed}/{job.progress.total}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <User className="h-3 w-3" />
                        <span>{job.started_by}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDateTime(job.started_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {calculateDuration(job.started_at, job.completed_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedJob(job)}
                          className="h-8 w-8 p-0"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {(job.status === 'running' || job.status === 'pending') && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => stopJob(job.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            title="Stop job"
                          >
                            <Square className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => clearJob(job.id)}
                            className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700"
                            title="Clear job"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const startPage = Math.max(1, currentPage - 2)
              const pageNum = startPage + i
              if (pageNum > totalPages) return null
              
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="w-8"
                >
                  {pageNum}
                </Button>
              )
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Job Details Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Job Details: {selectedJob?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><strong>Job ID:</strong> {selectedJob?.id}</div>
              <div><strong>Type:</strong> {selectedJob && getTypeBadge(selectedJob.type)}</div>
              <div><strong>Status:</strong> {selectedJob && getStatusBadge(selectedJob.status)}</div>
              <div><strong>Started By:</strong> {selectedJob?.started_by}</div>
              <div><strong>Started At:</strong> {selectedJob && formatDateTime(selectedJob.started_at)}</div>
              <div><strong>Duration:</strong> {selectedJob && calculateDuration(selectedJob.started_at, selectedJob.completed_at)}</div>
            </div>
            
            {selectedJob?.progress && (
              <div>
                <h3 className="font-semibold mb-2">Progress</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processed:</span>
                    <span>{selectedJob.progress.processed} of {selectedJob.progress.total}</span>
                  </div>
                  <Progress 
                    value={selectedJob.progress.total > 0 ? (selectedJob.progress.processed / selectedJob.progress.total) * 100 : 0}
                    className="w-full"
                  />
                  {selectedJob.progress.message && (
                    <div className="bg-gray-50 p-3 rounded text-sm">
                      {selectedJob.progress.message}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {selectedJob?.results && (
              <div>
                <h3 className="font-semibold mb-2">Results</h3>
                <div className="bg-gray-50 p-4 rounded">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Devices Processed: {selectedJob.results.devices_processed}</div>
                    <div>Devices Added: {selectedJob.results.devices_added}</div>
                    <div>Devices Updated: {selectedJob.results.devices_updated}</div>
                    <div>Errors: {selectedJob.results.errors.length}</div>
                  </div>
                  {selectedJob.results.errors.length > 0 && (
                    <div className="mt-3">
                      <h4 className="font-medium text-red-600 mb-2">Errors:</h4>
                      <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                        {selectedJob.results.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}