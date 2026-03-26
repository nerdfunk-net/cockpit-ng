'use client'

import { CheckCircle, AlertTriangle, RotateCcw, ExternalLink } from 'lucide-react'
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

interface TaskSummaryResult {
  total_processed?: number
  successful?: number
  failed?: number
  skipped?: number
  results?: Array<{
    object_id?: string
    object_name?: string
    name?: string
    success?: boolean
    message?: string
    changes?: Record<string, unknown>
  }>
  message?: string
}

interface CsvSummaryStepProps {
  taskStatus: string
  taskResult: unknown
  taskError: string | undefined
  taskId: string | null
  onReset: () => void
}

export function CsvSummaryStep({
  taskStatus,
  taskResult,
  taskError,
  taskId,
  onReset,
}: CsvSummaryStepProps) {
  const isSuccess = taskStatus === 'SUCCESS'
  const summary: TaskSummaryResult | null =
    typeof taskResult === 'object' && taskResult !== null
      ? (taskResult as TaskSummaryResult)
      : null

  const totalProcessed: number = summary?.total_processed ?? 0
  const successful: number = summary?.successful ?? 0
  const failed: number = summary?.failed ?? 0
  const skipped: number = summary?.skipped ?? 0
  const results: NonNullable<TaskSummaryResult['results']> = summary?.results ?? []

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
          {summary?.message && (
            <p className="text-sm text-gray-500">{summary.message}</p>
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

      {isSuccess && totalProcessed > 0 ? (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 px-3 py-2 border rounded-md bg-gray-50">
            <span className="text-sm text-gray-600">Total</span>
            <Badge variant="secondary">{totalProcessed}</Badge>
          </div>
          {successful > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-2 border rounded-md bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700">Updated</span>
              <Badge className="bg-green-100 text-green-800 border-green-300">
                {successful}
              </Badge>
            </div>
          ) : null}
          {failed > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-2 border rounded-md bg-red-50 border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-700">Failed</span>
              <Badge variant="destructive">{failed}</Badge>
            </div>
          ) : null}
          {skipped > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-2 border rounded-md bg-yellow-50 border-yellow-200">
              <span className="text-sm text-yellow-700">Skipped</span>
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                {skipped}
              </Badge>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Per-item results table */}
      {results.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">Item Results</p>
          <div className="border rounded-md overflow-auto max-h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs px-3 py-2">Object</TableHead>
                  <TableHead className="text-xs px-3 py-2 w-20">Status</TableHead>
                  <TableHead className="text-xs px-3 py-2">Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={i} className={r.success === false ? 'bg-red-50' : ''}>
                    <TableCell className="text-xs font-mono px-3 py-1.5">
                      {r.object_name ?? r.name ?? r.object_id ?? `Row ${i + 1}`}
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      {r.success !== false ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 px-3 py-1.5">
                      {r.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {isSuccess &&
      totalProcessed === 0 &&
      results.length === 0 &&
      taskResult != null ? (
        <div className="border rounded-md p-3 bg-slate-50">
          <p className="text-xs font-medium text-gray-600 mb-1">Task Result</p>
          <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">
            {JSON.stringify(taskResult as Record<string, unknown>, null, 2)}
          </pre>
        </div>
      ) : null}

      {/* Task ID */}
      {taskId && (
        <p className="text-xs text-gray-400">
          Task ID: <span className="font-mono">{taskId}</span>
          <a
            href={`/settings/jobs?task=${taskId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-0.5 text-blue-500 hover:text-blue-700"
          >
            View job <ExternalLink className="h-3 w-3" />
          </a>
        </p>
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
