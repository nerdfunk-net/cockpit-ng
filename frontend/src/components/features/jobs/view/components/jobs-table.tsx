'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { History, AlertTriangle } from 'lucide-react'
import { JobStatusBadge } from './job-status-badge'
import { JobActionsMenu } from './job-actions-menu'
import { formatDuration, formatDateTime, getTriggerBadgeClasses, isJobSuspicious, getSuspiciousJobWarning } from '../utils/job-utils'
import type { JobRun, JobProgressResponse } from '../types'

interface JobsTableProps {
  jobs: JobRun[]
  total: number
  jobProgress: Record<number, JobProgressResponse>
  onViewResult: (jobId: number) => void
  onCancelJob: (jobId: number) => void
  onDeleteJob: (jobId: number) => void
  cancellingId: number | null
  deletingId: number | null
}

export function JobsTable({
  jobs,
  total,
  jobProgress,
  onViewResult,
  onCancelJob,
  onDeleteJob,
  cancellingId,
  deletingId,
}: JobsTableProps) {
  if (jobs.length === 0) {
    return (
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
    )
  }

  return (
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
              {jobs.map((run, index) => (
                <TableRow
                  key={run.id}
                  className={`hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  {/* Job Name */}
                  <TableCell className="font-medium text-gray-700">
                    <div className="flex items-center gap-2">
                      {isJobSuspicious(run) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse flex-shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-sm bg-amber-50 border-amber-200">
                            <div className="space-y-1 text-xs">
                              <p className="font-semibold text-amber-900">⚠️ Job May Be Stuck</p>
                              <p className="text-amber-700">{getSuspiciousJobWarning(run)}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
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
                    </div>
                  </TableCell>

                  {/* Job Type */}
                  <TableCell>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                      {run.job_type}
                    </span>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <JobStatusBadge
                      status={run.status}
                      progress={jobProgress[run.id]}
                    />
                  </TableCell>

                  {/* Trigger */}
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${getTriggerBadgeClasses(run.triggered_by)}`}>
                      {run.triggered_by}
                    </Badge>
                  </TableCell>

                  {/* Started */}
                  <TableCell className="text-sm text-gray-600">
                    {formatDateTime(run.started_at || run.queued_at)}
                  </TableCell>

                  {/* Duration */}
                  <TableCell className="text-sm text-gray-600">
                    <span className="font-mono text-xs">
                      {formatDuration(run.duration_seconds, run.started_at, run.completed_at)}
                    </span>
                  </TableCell>

                  {/* Template */}
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

                  {/* Actions */}
                  <TableCell className="text-right">
                    <JobActionsMenu
                      jobId={run.id}
                      status={run.status}
                      hasResult={!!(run.status === 'completed' && run.result)}
                      onViewResult={onViewResult}
                      onCancel={onCancelJob}
                      onDelete={onDeleteJob}
                      isCancelling={cancellingId === run.id}
                      isDeleting={deletingId === run.id}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>
    </div>
  )
}
