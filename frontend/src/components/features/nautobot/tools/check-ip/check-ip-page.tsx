'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Search, HelpCircle } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { StatusAlert } from '@/components/shared/status-alert'
import { IconChip } from '@/components/shared/icon-chip'
import { CheckIPUploadForm } from './components/check-ip-upload-form'
import { CheckIPProgress } from './components/check-ip-progress'
import { CheckIPSummary } from './components/check-ip-summary'
import { CheckIPResults } from './components/check-ip-results'
import { useCheckIpTaskQuery } from './hooks/use-check-ip-task-query'
import { useCheckIpMutations } from './hooks/use-check-ip-mutations'
import { useCheckIpSettings } from './hooks/use-check-ip-settings'
import { useToast } from '@/hooks/use-toast'
import type { StatusMessage, UploadFormData } from './types'
import { DEFAULT_DELIMITER, DEFAULT_QUOTE_CHAR, EMPTY_RESULTS } from './utils/constants'

export function CheckIPPage() {
  // Client-side UI state only
  const [showAll, setShowAll] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)

  // Server state managed by TanStack Query
  const { data: taskStatus, isLoading: isPolling } = useCheckIpTaskQuery({
    taskId: currentTaskId,
  })

  const { uploadCsv, isUploading } = useCheckIpMutations()
  const { data: settings } = useCheckIpSettings()
  const { toast } = useToast()
  const toastedTaskRef = useRef<string | null>(null)

  // Derived state with useMemo
  const results = useMemo(
    () => taskStatus?.result?.results || EMPTY_RESULTS,
    [taskStatus]
  )

  const effectiveDelimiter = useMemo(
    () => settings?.data?.csv_delimiter || DEFAULT_DELIMITER,
    [settings]
  )

  const effectiveQuoteChar = useMemo(
    () => settings?.data?.csv_quote_char || DEFAULT_QUOTE_CHAR,
    [settings]
  )

  // Check if task completed with results
  const hasResults = results.length > 0

  // Fire a toast once when the task completes successfully
  useEffect(() => {
    if (
      taskStatus?.status === 'SUCCESS' &&
      taskStatus.result?.results &&
      taskStatus.result.results.length > 0 &&
      toastedTaskRef.current !== taskStatus.task_id
    ) {
      toastedTaskRef.current = taskStatus.task_id
      toast({
        title: 'Check completed!',
        description: `Found ${taskStatus.result.results.length} devices.`,
      })
    }
  }, [taskStatus, toast])

  // Status messages for errors and in-progress state only
  const taskStatusMessage = useMemo<StatusMessage | null>(() => {
    if (!taskStatus) return null

    if (taskStatus.status === 'SUCCESS' && taskStatus.result?.success === false) {
      return {
        type: 'error',
        message: taskStatus.result?.error || 'Task completed with error',
      }
    }
    if (taskStatus.status === 'FAILURE') {
      return {
        type: 'error',
        message: `Task failed: ${taskStatus.result?.error || 'Unknown error'}`,
      }
    }
    if (taskStatus.status === 'PROGRESS') {
      return {
        type: 'info',
        message: 'Processing devices...',
      }
    }
    return null
  }, [taskStatus])

  const statusMessage = taskStatusMessage

  // Callbacks with useCallback for stability
  const handleSubmit = useCallback(
    (data: UploadFormData) => {
      uploadCsv.mutate(data, {
        onSuccess: response => {
          setCurrentTaskId(response.task_id)
        },
      })
    },
    [uploadCsv]
  )

  const handleToggleShowAll = useCallback(() => {
    setShowAll(prev => !prev)
  }, [])

  const isFormDisabled = isUploading || isPolling

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconChip>
            <Search className="h-6 w-6" />
          </IconChip>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Check IP & Names</h1>
            <p className="text-muted-foreground mt-2">
              Compare CSV device list with Nautobot devices
            </p>
          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Help">
              <HelpCircle className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 text-sm space-y-2">
            <p className="font-semibold">How it works</p>
            <p>
              Upload a CSV file with <code className="bg-muted px-1 rounded">ip_address</code> and{' '}
              <code className="bg-muted px-1 rounded">name</code> columns. The task loads all
              devices from Nautobot and compares each row:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><span className="text-success-foreground font-medium">Match</span> — IP found and device name matches.</li>
              <li><span className="text-warning-foreground font-medium">Name mismatch</span> — IP found but names are completely different.</li>
              <li><span className="text-warning-foreground font-medium">Partial mismatch</span> — IP found but one name is contained within the other (e.g. &ldquo;lab-003&rdquo; vs &ldquo;lab-003.tld.zz&rdquo;).</li>
              <li><span className="text-error-foreground font-medium">IP not found</span> — IP does not exist in Nautobot.</li>
            </ul>
            <p className="text-muted-foreground">
              CIDR notation is stripped before comparison. Name matching is case-insensitive.
            </p>
          </PopoverContent>
        </Popover>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <StatusAlert variant={statusMessage.type} className="font-mono text-xs">
          {statusMessage.message}
        </StatusAlert>
      )}

      {/* Upload Section */}
      <CheckIPUploadForm
        onSubmit={handleSubmit}
        isDisabled={isFormDisabled}
        defaultDelimiter={effectiveDelimiter}
        defaultQuoteChar={effectiveQuoteChar}
      />

      {/* Progress Section */}
      {taskStatus && (isPolling || taskStatus.status === 'SUCCESS') && (
        <CheckIPProgress taskStatus={taskStatus} />
      )}

      {/* Summary Statistics */}
      {hasResults && <CheckIPSummary results={results} />}

      {/* Results Section */}
      {hasResults && (
        <CheckIPResults
          results={results}
          showAll={showAll}
          onToggleShowAll={handleToggleShowAll}
        />
      )}
    </div>
  )
}
