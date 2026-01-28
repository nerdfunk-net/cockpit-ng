'use client'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Eye, XCircle, Trash2 } from 'lucide-react'
import { isJobActive } from '../utils/job-utils'

interface JobActionsMenuProps {
  jobId: number
  status: string
  hasResult: boolean
  onViewResult: (jobId: number) => void
  onCancel: (jobId: number) => void
  onDelete: (jobId: number) => void
  isCancelling: boolean
  isDeleting: boolean
}

export function JobActionsMenu({
  jobId,
  status,
  hasResult,
  onViewResult,
  onCancel,
  onDelete,
  isCancelling,
  isDeleting,
}: JobActionsMenuProps) {
  const jobIsActive = isJobActive(status)
  const showViewButton = status === 'completed' && hasResult
  const showCancelButton = jobIsActive
  const showDeleteButton = !jobIsActive

  return (
    <div className="flex items-center justify-end gap-1">
      {showViewButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              onClick={() => onViewResult(jobId)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>View result</p>
          </TooltipContent>
        </Tooltip>
      )}

      {showCancelButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => onCancel(jobId)}
              disabled={isCancelling}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Cancel job</p>
          </TooltipContent>
        </Tooltip>
      )}

      {showDeleteButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => onDelete(jobId)}
              disabled={isDeleting}
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
  )
}
