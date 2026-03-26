'use client'

import { useState } from 'react'
import { CheckCircle, AlertTriangle, RotateCcw, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  message?: string
  // Legacy flat shape support
  total_processed?: number
  successful?: number
  failed?: number
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

  // Support both nested `summary` shape and legacy flat shape
  const total: number =
    payload?.summary?.total ?? payload?.total_processed ?? 0
  const successful: number =
    payload?.summary?.successful ?? payload?.successful ?? 0
  const failed: number =
    payload?.summary?.failed ?? payload?.failed ?? 0
  const skipped: number = payload?.summary?.skipped ?? 0

  const successes: DeviceEntry[] = payload?.successes ?? []
  const failures: DeviceEntry[] = payload?.failures ?? []

  const allRows: Array<DeviceEntry & { ok: boolean }> = [
    ...successes.map((d) => ({ ...d, ok: true })),
    ...failures.map((d) => ({ ...d, ok: false })),
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        {isSuccess ? (
          <CheckCircle className="h-7 w-7 text-green-500 flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-7 w-7 text-red-500 flex-shrink-0" />
        )}
        <div>
          <h3 className="text-base font-semibold">
            {isSuccess ? 'Update Complete' : 'Update Failed'}
          </h3>
          {payload?.message && (
            <p className="text-sm text-gray-500">{payload.message}</p>
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
          <div className="flex items-center gap-1.5 px-3 py-2 border rounded-md bg-gray-50">
            <span className="text-sm text-gray-600">Total</span>
            <Badge variant="secondary">{total}</Badge>
          </div>
          {successful > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 border rounded-md bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700">Updated</span>
              <Badge className="bg-green-100 text-green-800 border-green-300">
                {successful}
              </Badge>
            </div>
          )}
          {failed > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 border rounded-md bg-red-50 border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-700">Failed</span>
              <Badge variant="destructive">{failed}</Badge>
            </div>
          )}
          {skipped > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 border rounded-md bg-yellow-50 border-yellow-200">
              <span className="text-sm text-yellow-700">Skipped</span>
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                {skipped}
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Per-device results table */}
      {allRows.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">Device Results</p>
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
                  <TableRow key={i} className={row.ok ? '' : 'bg-red-50'}>
                    <TableCell className="px-3 py-2">
                      {row.ok ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono px-3 py-2">
                      {row.device_name ?? row.device_id ?? `Row ${i + 1}`}
                    </TableCell>
                    <TableCell className="text-xs px-3 py-2">
                      {row.updated_fields && row.updated_fields.length > 0 ? (
                        <span className="text-gray-600">
                          {row.updated_fields.join(', ')}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs px-3 py-2">
                      {row.error ? (
                        <span className="text-red-600">{row.error}</span>
                      ) : row.warnings && row.warnings.length > 0 ? (
                        <span className="text-yellow-600">{row.warnings.join('; ')}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
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
        <p className="text-xs text-gray-400">
          Task ID: <span className="font-mono">{taskId}</span>
          {jobId != null && (
            <a
              href={`/jobs/view?job=${jobId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-0.5 text-blue-500 hover:text-blue-700"
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
            onClick={() => setShowRawJson((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            {showRawJson ? (
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            View Raw JSON
          </button>
          {showRawJson && (
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
