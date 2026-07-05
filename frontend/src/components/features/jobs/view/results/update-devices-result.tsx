'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusAlert } from '@/components/shared/status-alert'
import { StatusIcon } from '@/components/shared/status-icon'
import { UpdateDevicesJobResult } from '../types/job-results'
import { useState } from 'react'

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
        <StatusAlert variant="warning">
          <p className="text-sm font-medium">Dry Run Mode</p>
          <p className="text-sm">
            No actual changes were made. This was a preview of what would be updated.
          </p>
        </StatusAlert>
      )}

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusIcon variant={result.success ? 'success' : 'error'} />
            Update Summary
          </CardTitle>
          <CardDescription>
            Bulk device update {result.dry_run ? 'simulation' : 'operation'} completed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Devices</p>
              <p className="text-2xl font-bold text-foreground">{result.summary.total}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Successful</p>
              <p className="text-2xl font-bold text-success-foreground">
                {result.summary.successful}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-error-foreground">
                {result.summary.failed}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Skipped</p>
              <p className="text-2xl font-bold text-warning-foreground">
                {result.summary.skipped}
              </p>
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
                <StatusIcon variant="success" />
                Successful Updates ({result.successes.length})
              </CardTitle>
              <button
                type="button"
                onClick={() => setShowAllSuccesses(!showAllSuccesses)}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
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
                    className="border rounded-lg p-3 bg-success/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium text-foreground">
                            {success.device_name || success.device_id || success.prefix}
                          </p>
                          <Badge
                            variant="outline"
                            className="text-xs bg-success text-success-foreground border-success-border"
                          >
                            Updated
                          </Badge>
                        </div>
                        {success.row && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Row: {success.row}
                          </p>
                        )}
                        {success.namespace && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Namespace: {success.namespace}
                          </p>
                        )}
                        {success.device_id && success.device_name && (
                          <p className="text-xs text-muted-foreground mb-2">
                            ID: {success.device_id}
                          </p>
                        )}

                        {/* Show updates */}
                        {success.updates && Object.keys(success.updates).length > 0 && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() =>
                                toggleSuccess(
                                  success.device_id ||
                                    success.device_name ||
                                    success.prefix ||
                                    ''
                                )
                              }
                              className="text-sm text-primary hover:opacity-80 flex items-center gap-1"
                            >
                              {expandedSuccesses.has(
                                success.device_id ||
                                  success.device_name ||
                                  success.prefix ||
                                  ''
                              ) ? (
                                <>
                                  <ChevronUp className="h-3 w-3" />
                                  Hide changes
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  Show {Object.keys(success.updates).length} field(s)
                                  changed
                                </>
                              )}
                            </button>

                            {expandedSuccesses.has(
                              success.device_id ||
                                success.device_name ||
                                success.prefix ||
                                ''
                            ) && (
                              <div className="mt-2 space-y-2 pl-4 border-l-2 border-success-border">
                                {Object.entries(success.updates || EMPTY_OBJECT).map(
                                  ([field, value]) => (
                                    <div
                                      key={`${success.device_id || success.device_name || success.prefix}-${field}`}
                                      className="text-sm"
                                    >
                                      <span className="font-medium text-muted-foreground">
                                        {field}:
                                      </span>{' '}
                                      <span className="text-foreground font-mono text-xs">
                                        {formatValue(value)}
                                      </span>
                                    </div>
                                  )
                                )}
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
                <StatusIcon variant="error" />
                Failed Updates ({result.failures.length})
              </CardTitle>
              <button
                type="button"
                onClick={() => setShowAllFailures(!showAllFailures)}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
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
                    className="border rounded-lg p-3 bg-error/50"
                  >
                    <div className="flex items-start gap-2">
                      <StatusIcon variant="error" className="h-4 w-4 shrink-0 mt-1" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {failure.device_name ||
                            failure.device_id ||
                            failure.identifier ||
                            failure.prefix}
                        </p>
                        {failure.row && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Row: {failure.row}
                          </p>
                        )}
                        {failure.namespace && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Namespace: {failure.namespace}
                          </p>
                        )}
                        {failure.device_id && failure.device_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ID: {failure.device_id}
                          </p>
                        )}
                        <p className="text-sm text-error-foreground mt-2 whitespace-pre-wrap">
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
                <StatusIcon variant="warning" />
                Skipped Updates ({result.skipped.length})
              </CardTitle>
              <button
                type="button"
                onClick={() => setShowAllSkipped(!showAllSkipped)}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
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
                    className="border rounded-lg p-3 bg-warning/50"
                  >
                    <div className="flex items-start gap-2">
                      <StatusIcon variant="warning" className="h-4 w-4 shrink-0 mt-1" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {skipped.device_name ||
                            skipped.device_id ||
                            skipped.identifier ||
                            skipped.prefix}
                        </p>
                        {skipped.row && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Row: {skipped.row}
                          </p>
                        )}
                        {skipped.namespace && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Namespace: {skipped.namespace}
                          </p>
                        )}
                        {skipped.device_id && skipped.device_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ID: {skipped.device_id}
                          </p>
                        )}
                        <p className="text-sm text-warning-foreground mt-2 whitespace-pre-wrap">
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
