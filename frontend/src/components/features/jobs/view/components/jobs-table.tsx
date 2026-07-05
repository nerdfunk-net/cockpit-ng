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
import {
  formatDuration,
  formatDateTime,
  getTriggerBadgeClasses,
  isJobSuspicious,
  getSuspiciousJobWarning,
} from '../utils/job-utils'
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
        <div className="panel-header py-2 px-4">
          <div className="flex items-center space-x-2">
            <History className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-semibold">Job Runs</h3>
              <p className="text-panel-header-muted text-xs">
                Background job execution history
              </p>
            </div>
          </div>
        </div>
        <div className="bg-card flex flex-col items-center justify-center py-16">
          <div className="p-4 bg-muted rounded-full mb-4">
            <History className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold text-foreground mb-1">No job runs found</p>
          <p className="text-sm text-muted-foreground">
            Job execution history will appear here when jobs are scheduled or run
            manually
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <div className="panel-header py-2 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-semibold">Job Runs ({total})</h3>
              <p className="text-panel-header-muted text-xs">
                Background job execution history
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-card">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-[180px] text-muted-foreground font-semibold">
                  Job Name
                </TableHead>
                <TableHead className="w-[120px] text-muted-foreground font-semibold">
                  Type
                </TableHead>
                <TableHead className="w-[90px] text-muted-foreground font-semibold">
                  Status
                </TableHead>
                <TableHead className="w-[80px] text-muted-foreground font-semibold">
                  Trigger
                </TableHead>
                <TableHead className="w-[110px] text-muted-foreground font-semibold">
                  Started
                </TableHead>
                <TableHead className="w-[80px] text-muted-foreground font-semibold">
                  Duration
                </TableHead>
                <TableHead className="w-[100px] text-muted-foreground font-semibold">
                  Template
                </TableHead>
                <TableHead className="w-[60px] text-right text-muted-foreground font-semibold">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((run, index) => (
                <TableRow
                  key={run.id}
                  className={`hover:bg-primary/5 transition-colors ${index % 2 === 0 ? 'bg-card' : 'bg-muted/50'}`}
                >
                  {/* Job Name */}
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      {isJobSuspicious(run) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-4 w-4 text-warning-foreground animate-pulse flex-shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            className="max-w-sm status-warning"
                          >
                            <div className="space-y-1 text-xs">
                              <p className="font-semibold">⚠️ Job May Be Stuck</p>
                              <p>{getSuspiciousJobWarning(run)}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help truncate block max-w-[160px] hover:text-primary transition-colors">
                            {run.job_name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-sm">
                          <div className="space-y-1 text-xs">
                            <p>
                              <strong>ID:</strong> {run.id}
                            </p>
                            <p>
                              <strong>Schedule:</strong> {run.schedule_name || '-'}
                            </p>
                            {run.celery_task_id && (
                              <p>
                                <strong>Task ID:</strong>{' '}
                                {run.celery_task_id.slice(0, 8)}...
                              </p>
                            )}
                            {run.executed_by && (
                              <p>
                                <strong>Executed by:</strong> {run.executed_by}
                              </p>
                            )}
                            {run.error_message && (
                              <p className="text-destructive mt-2">{run.error_message}</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>

                  {/* Job Type */}
                  <TableCell>
                    <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded text-foreground">
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
                    <Badge
                      variant="outline"
                      className={`text-xs ${getTriggerBadgeClasses(run.triggered_by)}`}
                    >
                      {run.triggered_by}
                    </Badge>
                  </TableCell>

                  {/* Started */}
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(run.started_at || run.queued_at)}
                  </TableCell>

                  {/* Duration */}
                  <TableCell className="text-sm text-muted-foreground">
                    <span className="font-mono text-xs">
                      {formatDuration(
                        run.duration_seconds,
                        run.started_at,
                        run.completed_at
                      )}
                    </span>
                  </TableCell>

                  {/* Template */}
                  <TableCell className="text-sm text-muted-foreground">
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
