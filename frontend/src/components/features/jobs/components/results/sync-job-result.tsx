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
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { SyncJobResult, SyncJobDeviceResult } from "../../types/job-results"

interface SyncJobResultProps {
  result: SyncJobResult
}

export function SyncJobResultView({ result }: SyncJobResultProps) {
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
      </div>

      {/* Message */}
      {result.message && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">{String(result.message)}</p>
        </div>
      )}

      {/* CheckMK Activation Status */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          CheckMK Activation Status
        </h4>
        {result.activation === null || result.activation === undefined ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Activation Disabled</p>
              <p className="text-xs text-gray-500">
                CheckMK changes were not activated (activate_changes_after_sync is disabled)
              </p>
            </div>
          </div>
        ) : result.activation.success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
            <div className="flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-700">Activation Successful</p>
              <p className="text-xs text-green-600">
                {result.activation.message || 'CheckMK changes were activated successfully'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-700">Activation Failed</p>
              <p className="text-xs text-red-600">
                {result.activation.error || result.activation.message || 'Failed to activate CheckMK changes'}
              </p>
            </div>
          </div>
        )}
      </div>

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
                {result.results.map((deviceResult: SyncJobDeviceResult, index: number) => (
                  <TableRow key={deviceResult.device_id || deviceResult.hostname || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <TableCell className="text-sm font-medium">
                      {deviceResult.hostname || deviceResult.device_id?.slice(0, 8) || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {deviceResult.operation || '-'}
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
                          <span className="cursor-help">
                            {(() => {
                              if (deviceResult.message) return deviceResult.message
                              if (typeof deviceResult.error === 'object' && deviceResult.error) {
                                return deviceResult.error.detail || deviceResult.error.error || 'Error occurred'
                              }
                              if (typeof deviceResult.error === 'string') return deviceResult.error
                              return '-'
                            })()}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-md">
                          {deviceResult.message ? (
                            <p className="text-xs">{deviceResult.message}</p>
                          ) : typeof deviceResult.error === 'object' && deviceResult.error ? (
                            <div className="text-xs space-y-2">
                              {deviceResult.error.detail && (
                                <p className="font-semibold">{deviceResult.error.detail}</p>
                              )}
                              {deviceResult.error.fields && (
                                <div className="space-y-1">
                                  <p className="font-semibold">Field Problems:</p>
                                  {Object.entries(deviceResult.error.fields).map(([field, errors]) => (
                                    <div key={field} className="ml-2">
                                      <p className="font-medium">{field}:</p>
                                      {typeof errors === 'object' && errors !== null ? (
                                        <ul className="ml-2 list-disc list-inside">
                                          {Object.entries(errors as Record<string, unknown>).map(([subField, subErrors]) => (
                                            <li key={subField}>
                                              <span className="font-medium">{subField}:</span>
                                              {Array.isArray(subErrors) ? (
                                                <ul className="ml-4 list-disc list-inside">
                                                  {subErrors.map((err) => (
                                                    <li key={String(err)}>{String(err)}</li>
                                                  ))}
                                                </ul>
                                              ) : (
                                                <span> {String(subErrors)}</span>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="ml-2">{String(errors)}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : typeof deviceResult.error === 'string' ? (
                            <p className="text-xs">{deviceResult.error}</p>
                          ) : (
                            <p className="text-xs">-</p>
                          )}
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
