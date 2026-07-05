'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle2, XCircle as XCircleIcon } from 'lucide-react'
import { BulkOnboardJobResult } from '../types/job-results'

interface BulkOnboardResultProps {
  result: BulkOnboardJobResult
}

export function BulkOnboardResultView({ result }: BulkOnboardResultProps) {
  // Determine overall success based on failed devices count
  // If there are no failures, consider it a success
  const isSuccess = result.failed_devices === 0

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-muted rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
          <p
            className={`text-lg font-semibold ${isSuccess ? 'text-success-foreground' : 'text-error-foreground'}`}
          >
            {isSuccess ? 'Success' : 'Failed'}
          </p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="text-lg font-semibold text-foreground">{result.device_count}</p>
        </div>
        <div className="bg-success rounded-lg p-3 text-center">
          <p className="text-xs text-success-foreground uppercase tracking-wide">Success</p>
          <p className="text-lg font-semibold text-success-foreground">
            {result.successful_devices}
          </p>
        </div>
        <div className="bg-error rounded-lg p-3 text-center">
          <p className="text-xs text-error-foreground uppercase tracking-wide">Failed</p>
          <p className="text-lg font-semibold text-error-foreground">{result.failed_devices}</p>
        </div>
      </div>

      {/* Device Results Table */}
      {result.devices && result.devices.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2 border-b">
            <h4 className="text-sm font-semibold text-foreground">Device Results</h4>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-xs font-semibold">Device Name</TableHead>
                  <TableHead className="text-xs font-semibold">IP Address</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.devices.map((device, index) => (
                  <TableRow
                    key={device.device_id || index}
                    className={index % 2 === 0 ? 'bg-card' : 'bg-muted/50'}
                  >
                    <TableCell className="text-sm font-medium">
                      {device.device_name || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {device.ip_address || '-'}
                    </TableCell>
                    <TableCell>
                      {device.status === 'success' ? (
                        <span className="flex items-center gap-1 text-success-foreground">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs">Success</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-error-foreground">
                          <XCircleIcon className="h-4 w-4" />
                          <span className="text-xs">Failed</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help max-w-[300px] block truncate">
                            {device.message || '-'}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-sm">
                          <p className="text-xs">{device.message || '-'}</p>
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
