'use client'

import { useState } from 'react'
import {
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface DeviceEntry {
  device_id?: string
  device_name?: string
  // JSON `tasks/update-devices` failures identify the device via this nested
  // object instead of a flat device_name.
  device_identifier?: { name?: string }
  updated_fields?: string[]
  warnings?: string[]
  error?: string
  message?: string
}

interface TaskResultPayload {
  success?: boolean
  dry_run?: boolean
  summary?: {
    total?: number
    successful?: number
    failed?: number
    skipped?: number
  }
  successes?: DeviceEntry[]
  failures?: DeviceEntry[]
  skipped?: DeviceEntry[]
  // JSON `tasks/update-devices` nests successes/failures/skipped under `results`
  // instead of at the top level.
  results?: {
    successes?: DeviceEntry[]
    failures?: DeviceEntry[]
    skipped?: DeviceEntry[]
  }
  message?: string
  // Legacy/JSON-task flat shape support
  total_processed?: number
  successful?: number
  failed?: number
  devices_processed?: number
  successful_updates?: number
  failed_updates?: number
  skipped_updates?: number
}

interface CsvSummaryStepProps {
  taskStatus: string
  taskResult: unknown
  taskError: string | undefined
  taskId: string | null
  jobId: number | null
  onReset: () => void
}

export function CsvSummaryStep({
  taskStatus,
  taskResult,
  taskError,
  taskId,
  jobId,
  onReset,
}: CsvSummaryStepProps) {
  const [showRawJson, setShowRawJson] = useState(false)

  const isSuccess = taskStatus === 'SUCCESS'
  const payload: TaskResultPayload | null =
    typeof taskResult === 'object' && taskResult !== null
      ? (taskResult as TaskResultPayload)
      : null

  // Support the CSV task's top-level/summary shape, the JSON task's flat
  // `*_updates` shape, and legacy flat fields.
  const total: number =
    payload?.summary?.total ?? payload?.total_processed ?? payload?.devices_processed ?? 0
  const successful: number =
    payload?.summary?.successful ?? payload?.successful ?? payload?.successful_updates ?? 0
  const failed: number =
    payload?.summary?.failed ?? payload?.failed ?? payload?.failed_updates ?? 0
  const skipped: number = payload?.summary?.skipped ?? payload?.skipped_updates ?? 0

  // Support both the CSV task's top-level successes/failures and the JSON
  // task's `results.{successes,failures}` nesting. Guard against the API
  // returning a non-array (e.g. a transient progress payload) since this
  // crosses a network boundary.
  const rawSuccesses = payload?.successes ?? payload?.results?.successes
  const rawFailures = payload?.failures ?? payload?.results?.failures
  const successes: DeviceEntry[] = Array.isArray(rawSuccesses) ? rawSuccesses : []
  const failures: DeviceEntry[] = Array.isArray(rawFailures) ? rawFailures : []

  const allRows: Array<DeviceEntry & { ok: boolean }> = [
    ...successes.map(d => ({ ...d, ok: true })),
    ...failures.map(d => ({ ...d, ok: false })),
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        {isSuccess ? (
          <CheckCircle className="h-7 w-7 text-success-foreground flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-7 w-7 text-error-foreground flex-shrink-0" />
        )}
        <div>
          <h3 className="text-base font-semibold">
            {isSuccess ? 'Update Complete' : 'Update Failed'}
          </h3>
          {payload?.message && (
            <p className="text-sm text-muted-foreground">{payload.message}</p>
          )}
        </div>
      </div>

      {/* Error detail */}
      {taskStatus === 'FAILURE' && taskError && (
        <Alert className="status-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm break-all">{taskError}</AlertDescription>
        </Alert>
      )}

      {/* Stats cards */}
      {isSuccess && total > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 px-3 py-2 border rounded-md bg-muted">
            <span className="text-sm text-muted-foreground">Total</span>
            <Badge variant="secondary">{total}</Badge>
          </div>
          {successful > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 border border-success-border rounded-md bg-success">
              <CheckCircle className="h-4 w-4 text-success-foreground" />
              <span className="text-sm text-success-foreground">Updated</span>
              <StatusBadge variant="success">{successful}</StatusBadge>
            </div>
          )}
          {failed > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 border border-error-border rounded-md bg-error">
              <AlertTriangle className="h-4 w-4 text-error-foreground" />
              <span className="text-sm text-error-foreground">Failed</span>
              <Badge variant="destructive">{failed}</Badge>
            </div>
          )}
          {skipped > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 border border-warning-border rounded-md bg-warning">
              <span className="text-sm text-warning-foreground">Skipped</span>
              <StatusBadge variant="warning">{skipped}</StatusBadge>
            </div>
          )}
        </div>
      )}

      {/* Per-device results table */}
      {allRows.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Device Results</p>
          <div className="border rounded-md overflow-auto max-h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs px-3 py-2 w-8"></TableHead>
                  <TableHead className="text-xs px-3 py-2">Device</TableHead>
                  <TableHead className="text-xs px-3 py-2">Updated Fields</TableHead>
                  <TableHead className="text-xs px-3 py-2">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRows.map((row, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <TableRow key={i} className={row.ok ? '' : 'bg-error'}>
                    <TableCell className="px-3 py-2">
                      {row.ok ? (
                        <CheckCircle className="h-3.5 w-3.5 text-success-foreground" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-error-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono px-3 py-2">
                      {row.device_name ??
                        row.device_identifier?.name ??
                        row.device_id ??
                        `Row ${i + 1}`}
                    </TableCell>
                    <TableCell className="text-xs px-3 py-2">
                      {row.updated_fields && row.updated_fields.length > 0 ? (
                        <span className="text-muted-foreground">
                          {row.updated_fields.join(', ')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs px-3 py-2">
                      {row.error ? (
                        <span className="text-error-foreground">{row.error}</span>
                      ) : row.warnings && row.warnings.length > 0 ? (
                        <span className="text-warning-foreground">
                          {row.warnings.join('; ')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Task ID */}
      {taskId && (
        <p className="text-xs text-muted-foreground">
          Task ID: <span className="font-mono">{taskId}</span>
          {jobId != null && (
            <a
              href={`/jobs/view?job=${jobId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-0.5 text-primary hover:text-primary/80"
            >
              View job <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </p>
      )}

      {/* Raw JSON */}
      {taskResult != null && (
        <div className="border rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setShowRawJson(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted hover:bg-muted/70 transition-colors text-left"
          >
            {showRawJson ? (
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            View Raw JSON
          </button>
          {showRawJson && (
            // Terminal/console-style output block — left hardcoded per repo precedent
            <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all p-3 bg-slate-50 border-t max-h-96 overflow-auto">
              {JSON.stringify(taskResult as Record<string, unknown>, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Action */}
      <div>
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Start Over
        </Button>
      </div>
    </div>
  )
}
