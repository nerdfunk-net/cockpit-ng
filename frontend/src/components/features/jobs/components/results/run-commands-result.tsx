"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Server,
  Key,
  Eye,
  Terminal,
} from "lucide-react"
import { RunCommandsJobResult, RunCommandsDeviceResult } from "../../types/job-results"

interface RunCommandsResultProps {
  result: RunCommandsJobResult
}

export function RunCommandsResultView({ result }: RunCommandsResultProps) {
  const [viewingDevice, setViewingDevice] = useState<RunCommandsDeviceResult | null>(null)

  // Combine all devices into a single list for the table
  const allDevices = [
    ...(result.successful_devices || []),
    ...(result.failed_devices || []),
  ]

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Terminal className="h-4 w-4 text-blue-600" />
            <p className="text-xs text-blue-600 uppercase tracking-wide font-medium">Template</p>
          </div>
          <p className="text-sm font-semibold text-blue-700 truncate">{result.command_template}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Server className="h-4 w-4 text-gray-600" />
            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">Total Devices</p>
          </div>
          <p className="text-2xl font-bold text-gray-700">{result.total}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <p className="text-xs text-green-600 uppercase tracking-wide font-medium">Successful</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{result.success_count}</p>
        </div>
        <div className={`${result.failed_count > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} border rounded-lg p-3 text-center`}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <XCircleIcon className={`h-4 w-4 ${result.failed_count > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            <p className={`text-xs uppercase tracking-wide font-medium ${result.failed_count > 0 ? 'text-red-600' : 'text-gray-500'}`}>Failed</p>
          </div>
          <p className={`text-2xl font-bold ${result.failed_count > 0 ? 'text-red-700' : 'text-gray-400'}`}>{result.failed_count}</p>
        </div>
      </div>

      {/* Credential Info */}
      {result.credential_info && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          <Key className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-700">
            Credentials: <span className="font-medium">{result.credential_info.credential_name}</span>
            <span className="text-amber-500 mx-2">•</span>
            <span className="font-mono text-xs">{result.credential_info.username}</span>
          </span>
        </div>
      )}

      {/* Devices Table */}
      {allDevices.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h4 className="text-sm font-semibold text-gray-700">Device Results</h4>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-semibold w-8">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Device</TableHead>
                  <TableHead className="text-xs font-semibold">IP Address</TableHead>
                  <TableHead className="text-xs font-semibold">Platform</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allDevices.map((device, index) => (
                  <TableRow key={device.device_id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <TableCell className="py-2">
                      {device.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <XCircleIcon className="h-4 w-4 text-red-500 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="text-xs">{device.error || 'Command execution failed'}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="font-medium text-sm">{device.device_name || device.device_id.slice(0, 8)}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="font-mono text-xs text-gray-600">{device.device_ip || '-'}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className="text-xs">{device.platform || 'Unknown'}</Badge>
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
      <Dialog open={!!viewingDevice} onOpenChange={(open) => !open && setViewingDevice(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Command Output: {viewingDevice?.device_name || viewingDevice?.device_id}
            </DialogTitle>
            <DialogDescription>
              {viewingDevice?.device_ip} • {viewingDevice?.platform}
              {viewingDevice?.success ? (
                <Badge className="ml-2 bg-green-100 text-green-700 border-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Success
                </Badge>
              ) : (
                <Badge className="ml-2 bg-red-100 text-red-700 border-red-300">
                  <XCircleIcon className="h-3 w-3 mr-1" />
                  Failed
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Error message for failed devices */}
            {viewingDevice && !viewingDevice.success && viewingDevice.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-medium text-red-700 mb-1">Error:</p>
                <p className="text-sm text-red-600">{viewingDevice.error}</p>
              </div>
            )}
            
            {/* Commands executed */}
            {viewingDevice?.rendered_commands && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Commands Executed:</p>
                <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto max-h-32 overflow-y-auto font-mono">
                  {viewingDevice.rendered_commands}
                </pre>
              </div>
            )}
            
            {/* Output */}
            {viewingDevice?.output ? (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Output:</p>
                <pre className="bg-gray-900 text-gray-100 text-xs p-4 rounded-lg overflow-x-auto max-h-96 overflow-y-auto font-mono whitespace-pre-wrap">
                  {viewingDevice.output}
                </pre>
              </div>
            ) : viewingDevice?.success ? (
              <div className="text-center py-8 text-gray-500">
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
