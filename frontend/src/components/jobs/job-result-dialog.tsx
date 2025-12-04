"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  TooltipProvider,
} from "@/components/ui/tooltip"
import { Eye, AlertCircle } from "lucide-react"
import {
  JobRun,
  isBackupJobResult,
  isSyncJobResult,
  isRunCommandsJobResult,
  GenericJobResult,
} from "./types/job-results"
import { BackupJobResultView } from "./results/backup-job-result"
import { SyncJobResultView } from "./results/sync-job-result"
import { RunCommandsResultView } from "./results/run-commands-result"
import { GenericJobResultView } from "./results/generic-job-result"

interface JobResultDialogProps {
  jobRun: JobRun | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Routes to the appropriate result view based on job type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderJobResult(result: Record<string, any>): React.ReactElement {
  // Check type guards in order of specificity
  // Run commands must be checked first as it has similar fields to other types
  if (isRunCommandsJobResult(result)) {
    return <RunCommandsResultView result={result} />
  }
  
  if (isBackupJobResult(result)) {
    return <BackupJobResultView result={result} />
  }
  
  if (isSyncJobResult(result)) {
    return <SyncJobResultView result={result} />
  }
  
  // Fallback to generic view
  return <GenericJobResultView result={result as GenericJobResult} />
}

export function JobResultDialog({ jobRun, open, onOpenChange }: JobResultDialogProps) {
  if (!jobRun?.result) {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = jobRun.result as Record<string, any>

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl w-[90vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-500" />
            Job Result: {jobRun.job_name}
          </DialogTitle>
          <DialogDescription>
            {jobRun.job_type} • Completed {jobRun.completed_at ? new Date(jobRun.completed_at).toLocaleString() : 'N/A'}
          </DialogDescription>
        </DialogHeader>

        {((<TooltipProvider>
          <div className="space-y-4">
            {/* Route to the appropriate result view based on job type */}
            {(renderJobResult(result) as React.ReactNode)}

            {/* Error Message (for failed jobs) - common to all types */}
            {result.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-700">{String(result.error)}</p>
                </div>
              </div>
            )}

            {/* Raw JSON (collapsible) - common to all types */}
            <details className="border rounded-lg">
              <summary className="px-4 py-2 cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50">
                View Raw JSON
              </summary>
              <pre className="p-4 bg-gray-900 text-gray-100 text-xs overflow-x-auto rounded-b-lg">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        </TooltipProvider>) as React.ReactNode)}
      </DialogContent>
    </Dialog>
  )
}
