import { BarChart3, RefreshCw, Eye } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { JobProgress } from '../types/sync-devices.types'

interface JobProgressModalProps {
  jobProgress: JobProgress | null
  celeryTaskId: string | null
  currentJobId: string | null
  isOpen: boolean
  onClose: () => void
  onCancel: () => void
  onViewResults: (jobId: string) => void
}

export function JobProgressModal({
  jobProgress,
  celeryTaskId,
  currentJobId,
  isOpen,
  onClose,
  onCancel,
  onViewResults
}: JobProgressModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <span>Job Progress</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {jobProgress && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Status:</span>
                  <Badge
                    variant={
                      jobProgress.status === 'completed' ? 'default' :
                      jobProgress.status === 'running' ? 'secondary' :
                      jobProgress.status === 'failed' ? 'destructive' :
                      'outline'
                    }
                  >
                    {jobProgress.status.charAt(0).toUpperCase() + jobProgress.status.slice(1)}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Progress:</span>
                  <span>{jobProgress.processed} of {jobProgress.total} devices</span>
                </div>

                {/* Detailed Progress Stats */}
                {(jobProgress.success !== undefined || jobProgress.failed !== undefined) && (
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>
                      {jobProgress.success !== undefined && (
                        <span className="text-green-600">✓ {jobProgress.success} succeeded</span>
                      )}
                    </span>
                    <span>
                      {jobProgress.failed !== undefined && jobProgress.failed > 0 && (
                        <span className="text-red-600">✗ {jobProgress.failed} failed</span>
                      )}
                    </span>
                  </div>
                )}

                {/* Progress Bar */}
                {jobProgress.total > 0 && (
                  <div className="space-y-1">
                    <Progress
                      value={(jobProgress.processed / jobProgress.total) * 100}
                      className="w-full"
                    />
                    <div className="text-xs text-center text-gray-500">
                      {Math.round((jobProgress.processed / jobProgress.total) * 100)}%
                    </div>
                  </div>
                )}

                {/* Progress Message */}
                {jobProgress.message && (
                  <div className="bg-gray-50 p-3 rounded text-sm">
                    {jobProgress.message}
                  </div>
                )}

                {/* Task ID */}
                {celeryTaskId && (
                  <div className="text-xs text-gray-500 font-mono">
                    Task ID: {celeryTaskId.slice(0, 16)}...
                  </div>
                )}

                {/* Job ID (once available) */}
                {currentJobId && (
                  <div className="text-xs text-gray-500 font-mono">
                    Job ID: {currentJobId.slice(0, 16)}...
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex space-x-2 pt-2">
                {/* Cancel button for running tasks */}
                {(jobProgress.status === 'running' || jobProgress.status === 'pending') && (
                  <Button
                    onClick={onCancel}
                    variant="outline"
                    className="flex-1 border-orange-400 text-orange-700 hover:bg-orange-50"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Cancel Job
                  </Button>
                )}

                {/* View Results button for completed tasks */}
                {jobProgress.status === 'completed' && (
                  <Button
                    onClick={() => {
                      onClose()
                      if (currentJobId) {
                        onViewResults(currentJobId)
                      }
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Results
                  </Button>
                )}

                {/* Close button */}
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
