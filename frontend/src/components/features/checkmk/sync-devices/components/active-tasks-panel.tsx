import React from 'react'
import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DeviceTask } from '@/types/features/checkmk/sync-devices'

interface ActiveTasksPanelProps {
  activeTasks: Map<string, DeviceTask>
  expandedErrorTasks: Set<string>
  onCancelTask: (taskId: string) => void
  onDismissTask: (taskId: string) => void
  onToggleErrorDetails: (taskId: string) => void
}

export function ActiveTasksPanel({
  activeTasks,
  expandedErrorTasks,
  onCancelTask,
  onDismissTask,
  onToggleErrorDetails
}: ActiveTasksPanelProps) {
  if (activeTasks.size === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {Array.from(activeTasks.values()).map((task) => {
        const isSuccess = task.status === 'SUCCESS'
        const isFailure = task.status === 'FAILURE'
        const isRunning = task.status === 'PENDING' || task.status === 'STARTED' || task.status === 'PROGRESS'
        const isBatch = Array.isArray(task.deviceId) && task.deviceId.length > 1

        return (
          <Card
            key={task.taskId}
            className={`${
              isSuccess ? 'border-green-500 bg-green-50' :
              isFailure ? 'border-red-500 bg-red-50' :
              'border-blue-200 bg-blue-50'
            } transition-all duration-300`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        isSuccess ? 'border-green-600 text-green-700 bg-green-100' :
                        isFailure ? 'border-red-600 text-red-700 bg-red-100' :
                        'border-blue-600 text-blue-700 bg-blue-100'
                      }`}
                    >
                      {task.operation === 'add' ? 'Adding' : task.operation === 'update' ? 'Updating' : 'Syncing'}
                    </Badge>
                    <span className={`font-medium text-sm ${
                      isSuccess ? 'text-green-800' :
                      isFailure ? 'text-red-800' :
                      'text-blue-800'
                    }`}>
                      {task.deviceName}
                    </span>
                  </div>

                  {/* Batch Progress Bar and Details */}
                  {isBatch && task.batchProgress && (
                    <div className="mt-2 space-y-1">
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            isSuccess ? 'bg-green-500' :
                            isFailure ? 'bg-red-500' :
                            'bg-blue-500'
                          }`}
                          style={{ width: `${(task.batchProgress.current / task.batchProgress.total) * 100}%` }}
                        />
                      </div>
                      {/* Progress Stats */}
                      <div className="flex items-center gap-3 text-xs">
                        <span className={
                          isSuccess ? 'text-green-700' :
                          isFailure ? 'text-red-700' :
                          'text-blue-700'
                        }>
                          {task.batchProgress.current}/{task.batchProgress.total} processed
                        </span>
                        {task.batchProgress.success > 0 && (
                          <span className="text-green-600">
                            ✓ {task.batchProgress.success} succeeded
                          </span>
                        )}
                        {task.batchProgress.failed > 0 && (
                          <span className="text-red-600">
                            ✗ {task.batchProgress.failed} failed
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={`text-xs mt-1 ${
                    isSuccess ? 'text-green-700' :
                    isFailure ? 'text-red-700' :
                    'text-gray-600'
                  }`}>
                    {isSuccess ? '✓ Successfully updated' : isFailure ? task.message : task.message}
                  </div>

                  {/* Detailed Error Display for Failed Tasks */}
                  {isFailure && task.message && (
                    <div className="mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleErrorDetails(task.taskId)}
                        className="h-6 text-xs text-red-700 hover:text-red-900 hover:bg-red-100 p-1"
                      >
                        {expandedErrorTasks.has(task.taskId) ? '▼' : '►'} View Error Details
                      </Button>

                      {expandedErrorTasks.has(task.taskId) && (
                        <div className="mt-2 bg-white border border-red-300 rounded p-3 text-xs">
                          {(() => {
                            try {
                              // Try to parse as JSON for detailed error info
                              const errorData = JSON.parse(task.message)
                              return (
                                <div className="space-y-2">
                                  {errorData.error && (
                                    <div>
                                      <span className="font-semibold text-red-700">Error: </span>
                                      <span className="text-red-800">{errorData.error}</span>
                                    </div>
                                  )}
                                  {errorData.status_code && (
                                    <div>
                                      <span className="font-semibold text-red-700">Status Code: </span>
                                      <span className="text-red-800">{errorData.status_code}</span>
                                    </div>
                                  )}
                                  {errorData.detail && (
                                    <div>
                                      <span className="font-semibold text-red-700">Detail: </span>
                                      <span className="text-red-800">{errorData.detail}</span>
                                    </div>
                                  )}
                                  {errorData.title && (
                                    <div>
                                      <span className="font-semibold text-red-700">Title: </span>
                                      <span className="text-red-800">{errorData.title}</span>
                                    </div>
                                  )}
                                  {errorData.fields && (
                                    <div>
                                      <div className="font-semibold text-red-700 mb-1">Field Problems:</div>
                                      <div className="bg-red-50 border border-red-200 rounded p-2 space-y-2">
                                        {Object.entries(errorData.fields).map(([field, errors]: [string, unknown]) => {
                                          // Recursive function to render nested field errors
                                          const renderErrors = (value: unknown, depth: number = 0): React.ReactElement => {
                                            if (Array.isArray(value)) {
                                              return (
                                                <ul className="list-disc list-inside text-red-600 mt-1 space-y-0.5">
                                                  {value.map((error: string) => (
                                                    <li key={error} className="text-xs">{error}</li>
                                                  ))}
                                                </ul>
                                              )
                                            } else if (typeof value === 'object' && value !== null) {
                                              return (
                                                <div className={depth > 0 ? "ml-3 mt-1" : ""}>
                                                  {Object.entries(value as Record<string, unknown>).map(([subField, subErrors]) => (
                                                    <div key={subField} className="border-l-2 border-red-300 pl-2 mt-1">
                                                      <div className="font-medium text-red-700 text-xs">{subField}:</div>
                                                      {renderErrors(subErrors, depth + 1)}
                                                    </div>
                                                  ))}
                                                </div>
                                              )
                                            } else {
                                              return <div className="text-xs text-red-600">{String(value)}</div>
                                            }
                                          }

                                          return (
                                            <div key={field} className="border-l-2 border-red-400 pl-2">
                                              <div className="font-medium text-red-700">{field}:</div>
                                              {renderErrors(errors)}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            } catch {
                              // If not JSON, display as plain text
                              return <div className="text-red-800 whitespace-pre-wrap">{task.message}</div>
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-2 flex items-center justify-end gap-2">
                    {/* Cancel button for running batch tasks */}
                    {isRunning && isBatch && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCancelTask(task.taskId)}
                        className="h-7 text-xs border-orange-400 text-orange-700 hover:text-orange-900 hover:bg-orange-50"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    )}
                    {/* Dismiss button for failed tasks */}
                    {isFailure && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDismissTask(task.taskId)}
                        className="h-7 text-xs text-red-700 hover:text-red-900 hover:bg-red-100"
                      >
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>
                <div className="ml-4">
                  {isRunning ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                  ) : isSuccess ? (
                    <span className="text-green-600 text-2xl">✓</span>
                  ) : isFailure ? (
                    <X className="h-6 w-6 text-red-600" />
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
