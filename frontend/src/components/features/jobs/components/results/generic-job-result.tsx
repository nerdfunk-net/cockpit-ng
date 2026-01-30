"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  CheckCircle2,
  XCircle as XCircleIcon,
} from "lucide-react"
import { GenericJobResult, GenericDeviceResult } from "../../types/job-results"

interface GenericJobResultProps {
  result: GenericJobResult
}

export function GenericJobResultView({ result }: GenericJobResultProps) {
  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
          <p className={`text-lg font-semibold ${result.success ? 'text-green-600' : 'text-red-600'}`}>
            {result.success ? 'Success' : 'Failed'}
          </p>
        </div>
        {result.total !== undefined && (
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-lg font-semibold text-gray-700">{String(result.total)}</p>
          </div>
        )}
        {result.success_count !== undefined && (
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-green-600 uppercase tracking-wide">Success</p>
            <p className="text-lg font-semibold text-green-700">{String(result.success_count)}</p>
          </div>
        )}
        {result.failed_count !== undefined && (
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-xs text-red-600 uppercase tracking-wide">Failed</p>
            <p className="text-lg font-semibold text-red-700">{String(result.failed_count)}</p>
          </div>
        )}
        {result.completed !== undefined && (
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-green-600 uppercase tracking-wide">Completed</p>
            <p className="text-lg font-semibold text-green-700">{String(result.completed)}</p>
          </div>
        )}
        {result.failed !== undefined && (
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-xs text-red-600 uppercase tracking-wide">Failed</p>
            <p className="text-lg font-semibold text-red-700">{String(result.failed)}</p>
          </div>
        )}
        {result.differences_found !== undefined && (
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-xs text-amber-600 uppercase tracking-wide">Differences</p>
            <p className="text-lg font-semibold text-amber-700">{String(result.differences_found)}</p>
          </div>
        )}
      </div>

      {/* Message */}
      {result.message && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">{String(result.message)}</p>
        </div>
      )}

      {/* Device Results Table */}
      {result.results && result.results.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h4 className="text-sm font-semibold text-gray-700">Device Results</h4>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-semibold">Device</TableHead>
                  <TableHead className="text-xs font-semibold">Operation</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.results.map((deviceResult: GenericDeviceResult, index: number) => (
                  <TableRow key={String(deviceResult.device_id || deviceResult.hostname || index)} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <TableCell className="text-sm font-medium">
                      {String(deviceResult.hostname || '').slice(0, 100) || String(deviceResult.device_id || '').slice(0, 8) || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {String(deviceResult.operation || '-')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {deviceResult.success ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs">Success</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircleIcon className="h-4 w-4" />
                          <span className="text-xs">Failed</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 max-w-[200px] truncate">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{String(deviceResult.message || deviceResult.error || '-')}</span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-sm">
                          <p className="text-xs">{String(deviceResult.message || deviceResult.error || '-')}</p>
                        </TooltipContent>
                      </Tooltip>
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
