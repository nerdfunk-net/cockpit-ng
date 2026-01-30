"use client"

import { CheckCircle2, XCircle, AlertCircle, Info, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UpdateDevicesJobResult } from "../../types/job-results"
import { useState } from "react"

interface UpdateDevicesResultViewProps {
  result: UpdateDevicesJobResult
}

const EMPTY_OBJECT = {}

export function UpdateDevicesResultView({ result }: UpdateDevicesResultViewProps) {
  const [expandedSuccesses, setExpandedSuccesses] = useState<Set<string>>(new Set())
  const [showAllSuccesses, setShowAllSuccesses] = useState(false)
  const [showAllFailures, setShowAllFailures] = useState(true)
  const [showAllSkipped, setShowAllSkipped] = useState(true)

  const toggleSuccess = (deviceKey: string) => {
    const newSet = new Set(expandedSuccesses)
    if (newSet.has(deviceKey)) {
      newSet.delete(deviceKey)
    } else {
      newSet.add(deviceKey)
    }
    setExpandedSuccesses(newSet)
  }

  // Format update value for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'null'
    if (Array.isArray(value)) {
      return value.length > 0 ? `[${value.join(', ')}]` : '[]'
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  return (
    <div className="space-y-4">
      {/* Dry Run Warning */}
      {result.dry_run && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
          <Info className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Dry Run Mode</p>
            <p className="text-sm text-yellow-700">
              No actual changes were made. This was a preview of what would be updated.
            </p>
          </div>
        </div>
      )}

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            Update Summary
          </CardTitle>
          <CardDescription>
            Bulk device update {result.dry_run ? 'simulation' : 'operation'} completed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Devices</p>
              <p className="text-2xl font-bold text-gray-900">{result.summary.total}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Successful</p>
              <p className="text-2xl font-bold text-green-600">{result.summary.successful}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">{result.summary.failed}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Skipped</p>
              <p className="text-2xl font-bold text-yellow-600">{result.summary.skipped}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Successful Updates */}
      {result.successes && result.successes.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Successful Updates ({result.successes.length})
              </CardTitle>
              <button
                type="button"
                onClick={() => setShowAllSuccesses(!showAllSuccesses)}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                {showAllSuccesses ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Expand
                  </>
                )}
              </button>
            </div>
          </CardHeader>
          {showAllSuccesses && (
            <CardContent>
              <div className="space-y-3">
                {result.successes.map((success, index) => (
                  <div
                    key={`success-${success.device_id || success.device_name || success.prefix || index}`}
                    className="border rounded-lg p-3 bg-green-50/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium text-gray-900">
                            {success.device_name || success.device_id || success.prefix}
                          </p>
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                            Updated
                          </Badge>
                        </div>
                        {success.row && (
                          <p className="text-xs text-gray-500 mb-2">Row: {success.row}</p>
                        )}
                        {success.namespace && (
                          <p className="text-xs text-gray-500 mb-2">Namespace: {success.namespace}</p>
                        )}
                        {success.device_id && success.device_name && (
                          <p className="text-xs text-gray-500 mb-2">ID: {success.device_id}</p>
                        )}
                        
                        {/* Show updates */}
                        {success.updates && Object.keys(success.updates).length > 0 && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => toggleSuccess(success.device_id || success.device_name || success.prefix || '')}
                              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {expandedSuccesses.has(success.device_id || success.device_name || success.prefix || '') ? (
                                <>
                                  <ChevronUp className="h-3 w-3" />
                                  Hide changes
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  Show {Object.keys(success.updates).length} field(s) changed
                                </>
                              )}
                            </button>
                            
                            {expandedSuccesses.has(success.device_id || success.device_name || success.prefix || '') && (
                              <div className="mt-2 space-y-2 pl-4 border-l-2 border-green-300">
                                {Object.entries(success.updates || EMPTY_OBJECT).map(([field, value]) => (
                                  <div key={`${success.device_id || success.device_name || success.prefix}-${field}`} className="text-sm">
                                    <span className="font-medium text-gray-700">{field}:</span>{' '}
                                    <span className="text-gray-900 font-mono text-xs">
                                      {formatValue(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Failed Updates */}
      {result.failures && result.failures.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Failed Updates ({result.failures.length})
              </CardTitle>
              <button
                type="button"
                onClick={() => setShowAllFailures(!showAllFailures)}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                {showAllFailures ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Expand
                  </>
                )}
              </button>
            </div>
          </CardHeader>
          {showAllFailures && (
            <CardContent>
              <div className="space-y-3">
                {result.failures.map((failure, index) => (
                  <div
                    key={`failure-${failure.device_id || failure.identifier || failure.prefix || index}`}
                    className="border rounded-lg p-3 bg-red-50/50"
                  >
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-1" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {failure.device_name || failure.device_id || failure.identifier || failure.prefix}
                        </p>
                        {failure.row && (
                          <p className="text-xs text-gray-500 mt-1">Row: {failure.row}</p>
                        )}
                        {failure.namespace && (
                          <p className="text-xs text-gray-500 mt-1">Namespace: {failure.namespace}</p>
                        )}
                        {failure.device_id && failure.device_name && (
                          <p className="text-xs text-gray-500 mt-1">ID: {failure.device_id}</p>
                        )}
                        <p className="text-sm text-red-700 mt-2 whitespace-pre-wrap">
                          {failure.error}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Skipped Updates */}
      {result.skipped && result.skipped.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                Skipped Updates ({result.skipped.length})
              </CardTitle>
              <button
                type="button"
                onClick={() => setShowAllSkipped(!showAllSkipped)}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                {showAllSkipped ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Expand
                  </>
                )}
              </button>
            </div>
          </CardHeader>
          {showAllSkipped && (
            <CardContent>
              <div className="space-y-3">
                {result.skipped.map((skipped, index) => (
                  <div
                    key={`skipped-${skipped.device_id || skipped.identifier || skipped.prefix || index}`}
                    className="border rounded-lg p-3 bg-yellow-50/50"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0 mt-1" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {skipped.device_name || skipped.device_id || skipped.identifier || skipped.prefix}
                        </p>
                        {skipped.row && (
                          <p className="text-xs text-gray-500 mt-1">Row: {skipped.row}</p>
                        )}
                        {skipped.namespace && (
                          <p className="text-xs text-gray-500 mt-1">Namespace: {skipped.namespace}</p>
                        )}
                        {skipped.device_id && skipped.device_name && (
                          <p className="text-xs text-gray-500 mt-1">ID: {skipped.device_id}</p>
                        )}
                        <p className="text-sm text-yellow-700 mt-2 whitespace-pre-wrap">
                          {skipped.error}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
