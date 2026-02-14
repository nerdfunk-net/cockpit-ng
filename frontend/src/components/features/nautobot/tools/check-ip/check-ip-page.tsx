'use client'

import { useState, useCallback, useMemo } from 'react'
import { Search } from 'lucide-react'
import { StatusAlert } from './components/status-alert'
import { CheckIPUploadForm } from './components/check-ip-upload-form'
import { CheckIPProgress } from './components/check-ip-progress'
import { CheckIPSummary } from './components/check-ip-summary'
import { CheckIPResults } from './components/check-ip-results'
import { useCheckIpTaskQuery } from './hooks/use-check-ip-task-query'
import { useCheckIpMutations } from './hooks/use-check-ip-mutations'
import { useCheckIpSettings } from './hooks/use-check-ip-settings'
import type { StatusMessage, UploadFormData } from './types'
import { DEFAULT_DELIMITER, DEFAULT_QUOTE_CHAR, EMPTY_RESULTS } from './utils/constants'

export function CheckIPPage() {
  // Client-side UI state only
  const [showAll, setShowAll] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [uploadStatusMessage, setUploadStatusMessage] = useState<StatusMessage | null>(null)

  // Server state managed by TanStack Query
  const { data: taskStatus, isLoading: isPolling } = useCheckIpTaskQuery({
    taskId: currentTaskId
  })

  const { uploadCsv, isUploading } = useCheckIpMutations()
  const { data: settings } = useCheckIpSettings()

  // Derived state with useMemo
  const results = useMemo(() => taskStatus?.result?.results || EMPTY_RESULTS, [taskStatus])

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

  // Derive status message from taskStatus - no side effects
  const taskStatusMessage = useMemo<StatusMessage | null>(() => {
    if (!taskStatus) return null

    if (taskStatus.status === 'SUCCESS') {
      if (taskStatus.result?.success === false) {
        return {
          type: 'error',
          message: taskStatus.result?.error || 'Task completed with error'
        }
      } else if (taskStatus.result?.results && taskStatus.result.results.length > 0) {
        return {
          type: 'success',
          message: `Check completed! Found ${taskStatus.result.results.length} devices.`
        }
      }
    } else if (taskStatus.status === 'FAILURE') {
      return {
        type: 'error',
        message: `Task failed: ${taskStatus.result?.error || 'Unknown error'}`
      }
    } else if (taskStatus.status === 'PROGRESS') {
      return {
        type: 'info',
        message: 'Processing devices...'
      }
    }
    return null
  }, [taskStatus])

  // Use upload message if present, otherwise use task message
  const statusMessage = uploadStatusMessage || taskStatusMessage

  // Callbacks with useCallback for stability
  const handleSubmit = useCallback((data: UploadFormData) => {
    setUploadStatusMessage({ type: 'info', message: 'Uploading CSV file and starting check...' })

    uploadCsv.mutate(data, {
      onSuccess: (response) => {
        setCurrentTaskId(response.task_id)
        setUploadStatusMessage({ type: 'success', message: 'Check started! Processing devices...' })
      },
      onError: () => {
        // Error already handled by mutation hook with toast
        setUploadStatusMessage(null)
      }
    })
  }, [uploadCsv])

  const handleToggleShowAll = useCallback(() => {
    setShowAll(prev => !prev)
  }, [])

  const isFormDisabled = isUploading || isPolling

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Search className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Check IP & Names</h1>
            <p className="text-muted-foreground mt-2">Compare CSV device list with Nautobot devices</p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {statusMessage && <StatusAlert message={statusMessage} />}

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
