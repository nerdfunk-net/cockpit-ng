'use client'

import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { CheckCircle, AlertTriangle, Loader2, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusAlert } from '@/components/shared/status-alert'
import { StatusBadge } from '@/components/shared/status-badge'
import type { ParsedCSVData, ValidationResult } from '../types'

const TERMINAL_STATUSES = ['SUCCESS', 'FAILURE', 'REVOKED']
const PREVIEW_ROW_LIMIT = 10

interface TaskStatusData {
  task_id: string
  status: string
  progress?: { current?: number; total?: number; status?: string }
  result?: unknown
  error?: string
}

interface CsvPreviewStepProps {
  parsedData: ParsedCSVData
  validationResults: ValidationResult[]
  validationSummary: {
    errorCount: number
    warningCount: number
    isValid: boolean
  }
  dryRunTaskId: string | null
}

export function CsvPreviewStep({
  parsedData,
  validationResults,
  validationSummary,
  dryRunTaskId,
}: CsvPreviewStepProps) {
  const { apiCall } = useApi()

  const { data: dryRunStatus, isFetching: isDryRunPolling } = useQuery<TaskStatusData>({
    queryKey: ['csv-update-dry-run', dryRunTaskId],
    queryFn: () => apiCall(`celery/tasks/${dryRunTaskId}`),
    enabled: !!dryRunTaskId,
    refetchInterval: query => {
      const status = (query.state.data as TaskStatusData | undefined)?.status
      if (status && TERMINAL_STATUSES.includes(status)) return false
      return 2000
    },
    staleTime: 0,
  })

  const previewHeaders = parsedData.headers.slice(0, 8)
  const hasMoreColumns = parsedData.headers.length > 8
  const previewRows = parsedData.rows.slice(0, PREVIEW_ROW_LIMIT)

  return (
    <div className="space-y-4">
      {/* Validation Summary */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Validation:</span>
        <Badge variant="secondary">{parsedData.rowCount} rows</Badge>
        {validationSummary.errorCount > 0 && (
          <Badge variant="destructive">{validationSummary.errorCount} errors</Badge>
        )}
        {validationSummary.warningCount > 0 && (
          <StatusBadge variant="warning">
            {validationSummary.warningCount} warnings
          </StatusBadge>
        )}
        {validationSummary.isValid && (
          <StatusBadge variant="success">
            <CheckCircle className="h-3 w-3 mr-1" />
            Valid
          </StatusBadge>
        )}
      </div>

      {/* Validation Issues */}
      {validationResults.length > 0 && (
        <div className="border rounded-md max-h-36 overflow-y-auto">
          {validationResults.map(result => (
            <div
              key={`${result.type}-${result.rowNumber ?? ''}-${result.message}`}
              className={`px-3 py-1.5 text-xs border-b last:border-0 flex items-start gap-1.5 ${
                result.type === 'error'
                  ? 'bg-error text-error-foreground'
                  : result.type === 'warning'
                    ? 'bg-warning text-warning-foreground'
                    : 'bg-success text-success-foreground'
              }`}
            >
              {result.type === 'error' ? (
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              ) : result.type === 'warning' ? (
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              ) : (
                <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              )}
              <span>
                {result.rowNumber ? `Row ${result.rowNumber}: ` : ''}
                {result.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Preview Table */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Data Preview</span>
          <span className="text-xs text-muted-foreground">
            (first {Math.min(PREVIEW_ROW_LIMIT, parsedData.rowCount)} rows
            {hasMoreColumns ? `, first 8 of ${parsedData.headers.length} columns` : ''})
          </span>
        </div>
        <div className="border rounded-md overflow-auto max-h-64">
          <Table>
            <TableHeader>
              <TableRow>
                {previewHeaders.map(h => (
                  <TableHead
                    key={h}
                    className="text-xs font-mono bg-muted whitespace-nowrap px-2 py-1.5"
                  >
                    {h}
                  </TableHead>
                ))}
                {hasMoreColumns && (
                  <TableHead className="text-xs text-muted-foreground bg-muted px-2 py-1.5">
                    +{parsedData.headers.length - 8} more
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, rowIdx) => (
                // eslint-disable-next-line react/no-array-index-key
                <TableRow key={rowIdx}>
                  {previewHeaders.map((header, colIdx) => (
                    <TableCell
                      key={header}
                      className="text-xs font-mono whitespace-nowrap px-2 py-1.5 max-w-[160px] truncate"
                      title={row[colIdx] ?? ''}
                    >
                      {row[colIdx] ?? ''}
                    </TableCell>
                  ))}
                  {hasMoreColumns && (
                    <TableCell className="text-xs text-muted-foreground px-2">…</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dry Run Result */}
      {dryRunTaskId && (
        <div className="border rounded-md p-3 bg-muted space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Dry Run Result</span>
            {isDryRunPolling &&
              !TERMINAL_STATUSES.includes(dryRunStatus?.status ?? '') && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              )}
            {dryRunStatus && (
              <Badge
                variant="outline"
                className={
                  dryRunStatus.status === 'SUCCESS'
                    ? 'border-success-border text-success-foreground'
                    : dryRunStatus.status === 'FAILURE'
                      ? 'border-error-border text-error-foreground'
                      : 'border-info-border text-info-foreground'
                }
              >
                {dryRunStatus.status}
              </Badge>
            )}
          </div>

          {!dryRunStatus && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Waiting for task to start…
            </div>
          )}

          {dryRunStatus?.status === 'PROGRESS' && dryRunStatus.progress && (
            <p className="text-xs text-muted-foreground">
              {(dryRunStatus.progress as { status?: string }).status ?? 'Processing…'}
            </p>
          )}

          {dryRunStatus?.status === 'SUCCESS' && (
            <StatusAlert variant="success">
              Dry run completed successfully. No errors found.
              {dryRunStatus.result != null && (
                <pre className="mt-1 font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(
                    dryRunStatus.result as Record<string, unknown>,
                    null,
                    2
                  )}
                </pre>
              )}
            </StatusAlert>
          )}

          {dryRunStatus?.status === 'FAILURE' && (
            <StatusAlert variant="error">
              Dry run failed: {dryRunStatus.error ?? 'Unknown error'}
            </StatusAlert>
          )}

          <p className="text-xs text-muted-foreground">Task ID: {dryRunTaskId}</p>
        </div>
      )}

      {/* Blocking error warning */}
      {validationSummary.errorCount > 0 && (
        <StatusAlert variant="error">
          Fix the {validationSummary.errorCount} validation error(s) before submitting.
        </StatusAlert>
      )}

      {parsedData.rowCount === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            No data rows found in the CSV file.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
