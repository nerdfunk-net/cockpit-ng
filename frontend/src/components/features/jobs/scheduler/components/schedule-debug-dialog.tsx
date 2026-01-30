'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle, Calendar, CheckCircle2, Clock, RefreshCw, Server } from 'lucide-react'
import { useSchedulerDebug } from '../hooks/use-schedule-queries'
import { useScheduleMutations } from '../hooks/use-schedule-mutations'

interface ScheduleDebugDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScheduleDebugDialog({ open, onOpenChange }: ScheduleDebugDialogProps) {
  const { data: debugInfo, isLoading, refetch } = useSchedulerDebug({ enabled: open })
  const { recalculateNextRuns } = useScheduleMutations()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-500" />
            Scheduler Debug Info
          </DialogTitle>
          <DialogDescription>
            View scheduler database state and diagnose scheduling issues
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Loading scheduler info...</span>
          </div>
        ) : debugInfo ? (
          <div className="space-y-4">
            {/* Server Time Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Server Time
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600">UTC:</span>
                  <span className="ml-2 font-mono">{new Date(debugInfo.server_time.utc).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-blue-600">Offset:</span>
                  <span className="ml-2 font-mono">
                    UTC{debugInfo.server_time.timezone_offset_hours >= 0 ? '+' : ''}
                    {debugInfo.server_time.timezone_offset_hours}h
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-blue-600">⚠️ Note: {debugInfo.note}</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 uppercase">Total</p>
                <p className="text-2xl font-bold text-gray-700">
                  {debugInfo.schedule_summary.total_schedules}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-green-600 uppercase">Active</p>
                <p className="text-2xl font-bold text-green-700">
                  {debugInfo.schedule_summary.active_schedules}
                </p>
              </div>
              <div className={`${debugInfo.schedule_summary.due_now > 0 ? 'bg-amber-50' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
                <p className={`text-xs uppercase ${debugInfo.schedule_summary.due_now > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                  Due Now
                </p>
                <p className={`text-2xl font-bold ${debugInfo.schedule_summary.due_now > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                  {debugInfo.schedule_summary.due_now}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-600 uppercase">Celery</p>
                <p className={`text-sm font-medium ${debugInfo.celery_status.includes('active') ? 'text-green-600' : 'text-red-600'}`}>
                  {debugInfo.celery_status.includes('active') ? '✓ Active' : '✗ ' + debugInfo.celery_status}
                </p>
              </div>
            </div>

            {/* Due Schedules */}
            {debugInfo.due_schedules.length > 0 && (
              <div className="border border-amber-200 rounded-lg overflow-hidden">
                <div className="bg-amber-100 px-4 py-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <h4 className="font-semibold text-amber-800">Due Schedules (Should Be Running)</h4>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-50">
                      <TableHead className="text-xs">ID</TableHead>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Next Run (UTC)</TableHead>
                      <TableHead className="text-xs">Overdue By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debugInfo.due_schedules.map((schedule) => (
                      <TableRow key={schedule.id} className="bg-amber-50/50">
                        <TableCell className="font-mono text-xs">{schedule.id}</TableCell>
                        <TableCell className="font-medium">{schedule.job_identifier}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{schedule.schedule_type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {schedule.next_run ? new Date(schedule.next_run).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell className="text-amber-700 font-medium">
                          {Math.abs(Math.round(schedule.seconds_until_next_run / 60))} min
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Upcoming Schedules */}
            {debugInfo.upcoming_schedules.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-600" />
                  <h4 className="font-semibold text-gray-700">Upcoming Schedules</h4>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Template</TableHead>
                      <TableHead className="text-xs">Next Run</TableHead>
                      <TableHead className="text-xs">Time Until</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debugInfo.upcoming_schedules.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium">{schedule.job_identifier}</TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {schedule.template_name || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                {schedule.next_run ? new Date(schedule.next_run).toLocaleTimeString() : '-'}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">UTC: {schedule.next_run}</p>
                                <p className="text-xs">Local: {schedule.next_run_local}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {schedule.seconds_until_next_run < 60
                            ? `${schedule.seconds_until_next_run}s`
                            : schedule.seconds_until_next_run < 3600
                            ? `${Math.round(schedule.seconds_until_next_run / 60)}m`
                            : `${Math.round(schedule.seconds_until_next_run / 3600)}h`
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => recalculateNextRuns.mutate()}
                disabled={recalculateNextRuns.isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Recalculate All Next Runs
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No debug information available
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
