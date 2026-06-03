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
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle } from 'lucide-react'
import { CompareJobResult, CompareJobDeviceResult } from '../types/job-results'

interface CompareJobResultProps {
  result: CompareJobResult
}

function CheckmkStatusBadge({ status }: { status: CompareJobDeviceResult['checkmk_status'] }) {
  switch (status) {
    case 'equal':
      return (
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs">Equal</span>
        </span>
      )
    case 'diff':
      return (
        <span className="flex items-center gap-1 text-yellow-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs">Diff</span>
        </span>
      )
    case 'host_not_found':
      return (
        <span className="flex items-center gap-1 text-blue-600">
          <HelpCircle className="h-4 w-4" />
          <span className="text-xs">Not in CheckMK</span>
        </span>
      )
    case 'error':
      return (
        <span className="flex items-center gap-1 text-red-600">
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
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
          <p className={`text-lg font-semibold ${result.success ? 'text-green-600' : 'text-red-600'}`}>
            {result.success ? 'Success' : 'Failed'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
          <p className="text-lg font-semibold text-gray-700">{result.total}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-xs text-green-600 uppercase tracking-wide">Completed</p>
          <p className="text-lg font-semibold text-green-700">{result.completed}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-xs text-red-600 uppercase tracking-wide">Failed</p>
          <p className="text-lg font-semibold text-red-700">{result.failed}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <p className="text-xs text-yellow-600 uppercase tracking-wide">Differences</p>
          <p className="text-lg font-semibold text-yellow-700">{result.differences_found}</p>
        </div>
      </div>

      {/* Message */}
      {result.message && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">{result.message}</p>
        </div>
      )}

      {/* Device Results Table */}
      {result.results && result.results.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h4 className="text-sm font-semibold text-gray-700">Device Results</h4>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-semibold">Device</TableHead>
                  <TableHead className="text-xs font-semibold">CheckMK Status</TableHead>
                  <TableHead className="text-xs font-semibold">Priority Rule</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.results.map((deviceResult, index) => (
                  <TableRow
                    key={deviceResult.device_id || deviceResult.hostname || index}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                  >
                    <TableCell className="text-sm font-medium">
                      {deviceResult.hostname || deviceResult.device_id?.slice(0, 8) || '-'}
                    </TableCell>
                    <TableCell>
                      <CheckmkStatusBadge status={deviceResult.checkmk_status} />
                      {deviceResult.error && (
                        <p className="text-xs text-red-500 mt-1 truncate max-w-[200px]">
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
                        <span className="text-xs text-gray-400">default</span>
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
