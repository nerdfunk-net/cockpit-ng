'use client'

import { useState, useCallback, useMemo } from 'react'
import { History, RefreshCw } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { JobResultDialog } from '../dialogs/job-result-dialog'
import { JobsFilter } from './components/jobs-filter'
import { JobsTable } from './components/jobs-table'
import { JobsPagination } from './components/jobs-pagination'
import { ClearHistoryDialog } from './components/clear-history-dialog'
import { useJobsQuery } from './hooks/use-jobs-query'
import { useJobDetailQuery } from './hooks/use-job-detail-query'
import { useAllJobsProgress } from './hooks/use-job-progress-query'
import { useJobMutations } from './hooks/use-job-mutations'
import { DEFAULT_PAGE_SIZE, DEFAULT_PAGE, EMPTY_ARRAY, EMPTY_PROGRESS } from './utils/constants'
import type { JobSearchParams } from './types'

export function JobsViewPage() {
  // Filter state (TODO: Move to URL search params in future enhancement)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [jobTypeFilter, setJobTypeFilter] = useState<string[]>([])
  const [triggerFilter, setTriggerFilter] = useState<string[]>([])
  const [templateFilter, setTemplateFilter] = useState<string[]>([])
  const [page, setPage] = useState(DEFAULT_PAGE)

  // Dialog state
  const [viewingJobId, setViewingJobId] = useState<number | null>(null)
  const [clearHistoryDialogOpen, setClearHistoryDialogOpen] = useState(false)

  // Mutation loading states
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Build query params from filter state
  const queryParams: JobSearchParams = useMemo(() => ({
    page,
    page_size: DEFAULT_PAGE_SIZE,
    ...(statusFilter.length > 0 && { status: statusFilter }),
    ...(jobTypeFilter.length > 0 && { job_type: jobTypeFilter }),
    ...(triggerFilter.length > 0 && { triggered_by: triggerFilter }),
    ...(templateFilter.length > 0 && { template_id: templateFilter }),
  }), [page, statusFilter, jobTypeFilter, triggerFilter, templateFilter])

  // TanStack Query hooks
  const { data: jobsData, isLoading, refetch } = useJobsQuery({ params: queryParams })
  const { data: viewingJob } = useJobDetailQuery(viewingJobId)
  const { data: jobProgress = EMPTY_PROGRESS } = useAllJobsProgress(jobsData?.items || EMPTY_ARRAY)

  // Mutations
  const { cancelJob, deleteJob, clearFilteredHistory, clearAllHistory } = useJobMutations()

  // Derived data
  const jobs = jobsData?.items || EMPTY_ARRAY
  const total = jobsData?.total || 0
  const totalPages = jobsData?.total_pages || 1

  // Derive available templates from job runs data
  const templates = useMemo(() => {
    const templateMap = new Map<number, string>()

    jobs.forEach(job => {
      if (job.job_template_id && job.template_name) {
        templateMap.set(job.job_template_id, job.template_name)
      }
    })

    return Array.from(templateMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [jobs])

  // Filter helpers
  const hasActiveFilters = statusFilter.length > 0 || jobTypeFilter.length > 0 ||
                          triggerFilter.length > 0 || templateFilter.length > 0

  const getFilterDescription = useCallback(() => {
    const parts: string[] = []
    if (statusFilter.length > 0) parts.push(`status: ${statusFilter.join(", ")}`)
    if (jobTypeFilter.length > 0) parts.push(`type: ${jobTypeFilter.join(", ")}`)
    if (triggerFilter.length > 0) parts.push(`trigger: ${triggerFilter.join(", ")}`)
    if (templateFilter.length > 0) {
      const templateNames = templateFilter.map(id => {
        const template = templates.find(t => t.id.toString() === id)
        return template?.name || id
      })
      parts.push(`template: ${templateNames.join(", ")}`)
    }
    return parts.length > 0 ? parts.join(", ") : "all"
  }, [statusFilter, jobTypeFilter, triggerFilter, templateFilter, templates])

  // Event handlers
  const handleFilterChange = useCallback((setter: (value: string[]) => void) => {
    return (values: string[]) => {
      setter(values)
      setPage(DEFAULT_PAGE) // Reset to page 1 on filter change
    }
  }, [])

  const handleCancelJob = useCallback(async (jobId: number) => {
    setCancellingId(jobId)
    try {
      await cancelJob.mutateAsync(jobId)
    } finally {
      setCancellingId(null)
    }
  }, [cancelJob])

  const handleDeleteJob = useCallback(async (jobId: number) => {
    setDeletingId(jobId)
    try {
      await deleteJob.mutateAsync(jobId)
    } finally {
      setDeletingId(null)
    }
  }, [deleteJob])

  const handleClearHistory = useCallback(() => {
    setClearHistoryDialogOpen(true)
  }, [])

  const handleConfirmClearHistory = useCallback(async () => {
    setClearHistoryDialogOpen(false)

    if (hasActiveFilters) {
      await clearFilteredHistory.mutateAsync(queryParams)
    } else {
      await clearAllHistory.mutateAsync()
    }
  }, [hasActiveFilters, queryParams, clearFilteredHistory, clearAllHistory])

  // Loading state
  if (isLoading && jobs.length === 0) {
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
    <div className="space-y-6">
      {/* Header */}
      <TooltipProvider>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-2 rounded-lg">
              <History className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Job History</h1>
              <p className="text-muted-foreground mt-2">View running and completed background jobs</p>
            </div>
          </div>

          {/* Filters */}
          <JobsFilter
            statusFilter={statusFilter}
            jobTypeFilter={jobTypeFilter}
            triggerFilter={triggerFilter}
            templateFilter={templateFilter}
            availableTemplates={templates}
            onStatusChange={handleFilterChange(setStatusFilter)}
            onJobTypeChange={handleFilterChange(setJobTypeFilter)}
            onTriggerChange={handleFilterChange(setTriggerFilter)}
            onTemplateChange={handleFilterChange(setTemplateFilter)}
            onRefresh={() => refetch()}
            onClearHistory={handleClearHistory}
            isRefreshing={isLoading}
            isClearing={clearFilteredHistory.isPending || clearAllHistory.isPending}
            hasJobs={jobs.length > 0}
            hasActiveFilters={hasActiveFilters}
            filterDescription={getFilterDescription()}
          />
        </div>
      </TooltipProvider>

      {/* Jobs Table */}
      <JobsTable
        jobs={jobs}
        total={total}
        jobProgress={jobProgress}
        onViewResult={setViewingJobId}
        onCancelJob={handleCancelJob}
        onDeleteJob={handleDeleteJob}
        cancellingId={cancellingId}
        deletingId={deletingId}
      />

      {/* Pagination */}
      <JobsPagination
        currentPage={page}
        totalPages={totalPages}
        pageSize={DEFAULT_PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      {/* View Result Dialog */}
      <JobResultDialog
        jobRun={viewingJob || null}
        open={viewingJobId !== null}
        onOpenChange={(open) => !open && setViewingJobId(null)}
      />

      {/* Clear History Confirmation Dialog */}
      <ClearHistoryDialog
        open={clearHistoryDialogOpen}
        onOpenChange={setClearHistoryDialogOpen}
        onConfirm={handleConfirmClearHistory}
        hasActiveFilters={hasActiveFilters}
        filterDescription={getFilterDescription()}
      />
    </div>
  )
}
