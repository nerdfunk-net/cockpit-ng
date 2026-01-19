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
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

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

  // Check task status and update messages
  useMemo(() => {
    if (!taskStatus) return

    if (taskStatus.status === 'SUCCESS') {
      if (taskStatus.result?.success === false) {
        setStatusMessage({
          type: 'error',
          message: taskStatus.result?.error || 'Task completed with error'
        })
      } else if (taskStatus.result?.results && taskStatus.result.results.length > 0) {
        setStatusMessage({
          type: 'success',
          message: `Check completed! Found ${taskStatus.result.results.length} devices.`
        })
      }
    } else if (taskStatus.status === 'FAILURE') {
      setStatusMessage({
        type: 'error',
        message: `Task failed: ${taskStatus.result?.error || 'Unknown error'}`
      })
    } else if (taskStatus.status === 'PROGRESS') {
      setStatusMessage({
        type: 'info',
        message: 'Processing devices...'
      })
    }
  }, [taskStatus])

  // Callbacks with useCallback for stability
  const handleSubmit = useCallback((data: UploadFormData) => {
    setStatusMessage({ type: 'info', message: 'Uploading CSV file and starting check...' })

    uploadCsv.mutate(data, {
      onSuccess: (response) => {
        setCurrentTaskId(response.task_id)
        setStatusMessage({ type: 'success', message: 'Check started! Processing devices...' })
      },
      onError: () => {
        // Error already handled by mutation hook with toast
        setStatusMessage(null)
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
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Search className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Check IP & Names</h1>
            <p className="text-gray-600 mt-1">Compare CSV device list with Nautobot devices</p>
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
