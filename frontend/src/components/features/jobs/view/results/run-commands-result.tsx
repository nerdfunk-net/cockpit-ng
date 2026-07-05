'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/shared/status-badge'
import { StatusIcon } from '@/components/shared/status-icon'
import { Server, Key, Eye, Terminal } from 'lucide-react'
import { RunCommandsJobResult, RunCommandsDeviceResult } from '../types/job-results'

interface RunCommandsResultProps {
  result: RunCommandsJobResult
}

export function RunCommandsResultView({ result }: RunCommandsResultProps) {
  const [viewingDevice, setViewingDevice] = useState<RunCommandsDeviceResult | null>(
    null
  )

  // Combine all devices into a single list for the table
  const allDevices = [
    ...(result.successful_devices || []),
    ...(result.failed_devices || []),
  ]

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-info border border-info-border rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Terminal className="h-4 w-4 text-info-foreground" />
            <p className="text-xs text-info-foreground uppercase tracking-wide font-medium">
              Template
            </p>
          </div>
          <p className="text-sm font-semibold text-info-foreground truncate">
            {result.command_template}
          </p>
        </div>
        <div className="bg-muted border border-border rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Server className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Total Devices
            </p>
          </div>
          <p className="text-2xl font-bold text-foreground">{result.total}</p>
        </div>
        <div className="bg-success border border-success-border rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <StatusIcon variant="success" className="h-4 w-4" />
            <p className="text-xs text-success-foreground uppercase tracking-wide font-medium">
              Successful
            </p>
          </div>
          <p className="text-2xl font-bold text-success-foreground">
            {result.success_count}
          </p>
        </div>
        <div
          className={`${result.failed_count > 0 ? 'status-error' : 'bg-muted border-border'} border rounded-lg p-3 text-center`}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <StatusIcon
              variant="error"
              className={`h-4 w-4 ${result.failed_count > 0 ? '' : 'text-muted-foreground'}`}
            />
            <p
              className={`text-xs uppercase tracking-wide font-medium ${result.failed_count > 0 ? 'text-error-foreground' : 'text-muted-foreground'}`}
            >
              Failed
            </p>
          </div>
          <p
            className={`text-2xl font-bold ${result.failed_count > 0 ? 'text-error-foreground' : 'text-muted-foreground'}`}
          >
            {result.failed_count}
          </p>
        </div>
      </div>

      {/* Credential Info */}
      {result.credential_info && (
        <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-lg px-4 py-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-foreground">
            Credentials:{' '}
            <span className="font-medium">
              {result.credential_info.credential_name}
            </span>
            <span className="text-muted-foreground mx-2">•</span>
            <span className="font-mono text-xs">{result.credential_info.username}</span>
          </span>
        </div>
      )}

      {/* Devices Table */}
      {allDevices.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2 border-b">
            <h4 className="text-sm font-semibold text-foreground">Device Results</h4>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-xs font-semibold w-8">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Device</TableHead>
                  <TableHead className="text-xs font-semibold">IP Address</TableHead>
                  <TableHead className="text-xs font-semibold">Platform</TableHead>
                  <TableHead className="text-xs font-semibold text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allDevices.map((device, index) => (
                  <TableRow
                    key={device.device_id}
                    className={index % 2 === 0 ? 'bg-card' : 'bg-muted/50'}
                  >
                    <TableCell className="py-2">
                      {device.success ? (
                        <StatusIcon variant="success" className="h-4 w-4" />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <StatusIcon
                              variant="error"
                              className="h-4 w-4 cursor-help"
                            />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="text-xs">
                              {device.error || 'Command execution failed'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="font-medium text-sm">
                        {device.device_name || device.device_id.slice(0, 8)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {device.device_ip || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className="text-xs">
                        {device.platform || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingDevice(device)}
                        className="h-7 px-2 text-xs"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View Output
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Device Output Dialog */}
      <Dialog
        open={!!viewingDevice}
        onOpenChange={open => !open && setViewingDevice(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Command Output: {viewingDevice?.device_name || viewingDevice?.device_id}
            </DialogTitle>
            <DialogDescription>
              {viewingDevice?.device_ip} • {viewingDevice?.platform}
              {viewingDevice?.success ? (
                <StatusBadge variant="success" className="ml-2">
                  <StatusIcon variant="success" className="h-3 w-3 mr-1" />
                  Success
                </StatusBadge>
              ) : (
                <StatusBadge variant="error" className="ml-2">
                  <StatusIcon variant="error" className="h-3 w-3 mr-1" />
                  Failed
                </StatusBadge>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Error message for failed devices */}
            {viewingDevice && !viewingDevice.success && viewingDevice.error && (
              <div className="bg-error border border-error-border rounded-lg p-3">
                <p className="text-xs font-medium text-error-foreground mb-1">Error:</p>
                <p className="text-sm text-error-foreground">{viewingDevice.error}</p>
              </div>
            )}

            {/* Commands executed */}
            {viewingDevice?.rendered_commands && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Commands Executed:
                </p>
                {/* Terminal-style output: intentionally hardcoded dark background,
                    consistent with the console-output precedent shared across
                    other job-result features (no semantic token exists for this yet). */}
                <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto max-h-32 overflow-y-auto font-mono">
                  {viewingDevice.rendered_commands}
                </pre>
              </div>
            )}

            {/* Output */}
            {viewingDevice?.output ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Output:
                </p>
                {/* Terminal-style output: intentionally hardcoded dark background,
                    consistent with the console-output precedent shared across
                    other job-result features (no semantic token exists for this yet). */}
                <pre className="bg-gray-900 text-gray-100 text-xs p-4 rounded-lg overflow-x-auto max-h-96 overflow-y-auto font-mono whitespace-pre-wrap">
                  {viewingDevice.output}
                </pre>
              </div>
            ) : viewingDevice?.success ? (
              <div className="text-center py-8 text-muted-foreground">
                <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No output captured</p>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
