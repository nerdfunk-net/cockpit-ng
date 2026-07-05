'use client'

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
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle } from 'lucide-react'
import { CompareJobResult, CompareJobDeviceResult } from '../types/job-results'

interface CompareJobResultProps {
  result: CompareJobResult
}

function CheckmkStatusBadge({ status }: { status: CompareJobDeviceResult['checkmk_status'] }) {
  switch (status) {
    case 'equal':
      return (
        <span className="flex items-center gap-1 text-success-foreground">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs">Equal</span>
        </span>
      )
    case 'diff':
      return (
        <span className="flex items-center gap-1 text-warning-foreground">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs">Diff</span>
        </span>
      )
    case 'host_not_found':
      return (
        <span className="flex items-center gap-1 text-info-foreground">
          <HelpCircle className="h-4 w-4" />
          <span className="text-xs">Not in CheckMK</span>
        </span>
      )
    case 'error':
      return (
        <span className="flex items-center gap-1 text-error-foreground">
          <XCircle className="h-4 w-4" />
          <span className="text-xs">Error</span>
        </span>
      )
  }
}

export function CompareJobResultView({ result }: CompareJobResultProps) {
  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-muted rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
          <p className={`text-lg font-semibold ${result.success ? 'text-success-foreground' : 'text-error-foreground'}`}>
            {result.success ? 'Success' : 'Failed'}
          </p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="text-lg font-semibold text-foreground">{result.total}</p>
        </div>
        <div className="bg-success rounded-lg p-3 text-center">
          <p className="text-xs text-success-foreground uppercase tracking-wide">Completed</p>
          <p className="text-lg font-semibold text-success-foreground">{result.completed}</p>
        </div>
        <div className="bg-error rounded-lg p-3 text-center">
          <p className="text-xs text-error-foreground uppercase tracking-wide">Failed</p>
          <p className="text-lg font-semibold text-error-foreground">{result.failed}</p>
        </div>
        <div className="bg-warning rounded-lg p-3 text-center">
          <p className="text-xs text-warning-foreground uppercase tracking-wide">Differences</p>
          <p className="text-lg font-semibold text-warning-foreground">{result.differences_found}</p>
        </div>
      </div>

      {/* Message */}
      {result.message && <StatusAlert variant="info">{result.message}</StatusAlert>}

      {/* Device Results Table */}
      {result.results && result.results.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2 border-b">
            <h4 className="text-sm font-semibold text-foreground">Device Results</h4>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-xs font-semibold">Device</TableHead>
                  <TableHead className="text-xs font-semibold">CheckMK Status</TableHead>
                  <TableHead className="text-xs font-semibold">Priority Rule</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.results.map((deviceResult, index) => (
                  <TableRow
                    key={deviceResult.device_id || deviceResult.hostname || index}
                    className={index % 2 === 0 ? 'bg-card' : 'bg-muted/50'}
                  >
                    <TableCell className="text-sm font-medium">
                      {deviceResult.hostname || deviceResult.device_id?.slice(0, 8) || '-'}
                    </TableCell>
                    <TableCell>
                      <CheckmkStatusBadge status={deviceResult.checkmk_status} />
                      {deviceResult.error && (
                        <p className="text-xs text-destructive mt-1 truncate max-w-[200px]">
                          {deviceResult.error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {deviceResult.priority_rule ? (
                        <Badge variant="secondary" className="text-xs font-mono">
                          {deviceResult.priority_rule}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">default</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
