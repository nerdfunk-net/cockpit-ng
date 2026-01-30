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
  Server,
  GitBranch,
  Key,
  FileText,
  HardDrive,
  Wifi,
  Download,
} from "lucide-react"
import { BackupJobResult, BackupDeviceResult, formatBytes } from "../../types/job-results"

interface BackupJobResultProps {
  result: BackupJobResult
}

export function BackupJobResultView({ result }: BackupJobResultProps) {
  return (
    <div className="space-y-4">
      {/* Backup Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Download className="h-4 w-4 text-green-600" />
            <p className="text-xs text-green-600 uppercase tracking-wide font-medium">Backed Up</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{result.devices_backed_up}</p>
        </div>
        <div className={`${result.devices_failed > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} border rounded-lg p-3 text-center`}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <XCircleIcon className={`h-4 w-4 ${result.devices_failed > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            <p className={`text-xs uppercase tracking-wide font-medium ${result.devices_failed > 0 ? 'text-red-600' : 'text-gray-500'}`}>Failed</p>
          </div>
          <p className={`text-2xl font-bold ${result.devices_failed > 0 ? 'text-red-700' : 'text-gray-400'}`}>{result.devices_failed}</p>
        </div>
        {result.git_commit_status && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-purple-600" />
              <p className="text-xs text-purple-600 uppercase tracking-wide font-medium">Files Changed</p>
            </div>
            <p className="text-2xl font-bold text-purple-700">{result.git_commit_status.files_changed}</p>
          </div>
        )}
        {result.repository && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <HardDrive className="h-4 w-4 text-slate-600" />
              <p className="text-xs text-slate-600 uppercase tracking-wide font-medium">Repository</p>
            </div>
            <p className="text-sm font-semibold text-slate-700 truncate">{result.repository}</p>
          </div>
        )}
      </div>

      {/* Git & Credential Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {result.git_status && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="h-5 w-5 text-purple-600" />
              <h4 className="text-sm font-semibold text-purple-800">Git Repository</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-purple-600">Branch:</span>
                <span className="font-mono text-purple-800">{result.git_status.branch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-600">Operation:</span>
                <Badge className="bg-purple-100 text-purple-700 border-purple-300 text-xs">{result.git_status.operation}</Badge>
              </div>
              {result.git_commit_status && (
                <>
                  <div className="flex justify-between">
                    <span className="text-purple-600">Commit:</span>
                    <span className="font-mono text-purple-800">{result.git_commit_status.commit_hash}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-purple-600">Status:</span>
                    <div className="flex gap-2">
                      {result.git_commit_status.committed && (
                        <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">Committed</Badge>
                      )}
                      {result.git_commit_status.pushed && (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">Pushed</Badge>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {result.credential_info && (
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Key className="h-5 w-5 text-amber-600" />
              <h4 className="text-sm font-semibold text-amber-800">Credentials Used</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-amber-600">Name:</span>
                <span className="font-medium text-amber-800">{result.credential_info.credential_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-600">Username:</span>
                <span className="font-mono text-amber-800">{result.credential_info.username}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Backed Up Devices Table */}
      {result.backed_up_devices && result.backed_up_devices.length > 0 && (
        <div className="border border-green-200 rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-white" />
              <h4 className="text-sm font-semibold text-white">Backed Up Devices ({result.backed_up_devices.length})</h4>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-green-50 hover:bg-green-50">
                  <TableHead className="text-xs font-semibold text-green-800">Device Name</TableHead>
                  <TableHead className="text-xs font-semibold text-green-800">IP Address</TableHead>
                  <TableHead className="text-xs font-semibold text-green-800">Platform</TableHead>
                  <TableHead className="text-xs font-semibold text-green-800 text-center">SSH</TableHead>
                  <TableHead className="text-xs font-semibold text-green-800 text-center">Running</TableHead>
                  <TableHead className="text-xs font-semibold text-green-800 text-center">Startup</TableHead>
                  <TableHead className="text-xs font-semibold text-green-800 text-right">Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.backed_up_devices.map((device: BackupDeviceResult) => (
                  <TableRow 
                    key={device.device_id} 
                    className="bg-green-50/30 hover:bg-green-100/50 transition-colors border-b border-green-100"
                  >
                    <TableCell className="font-medium text-green-900">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        {device.device_name}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-green-700">{device.device_ip}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">
                        {device.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {device.ssh_connection_success ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <Wifi className="h-4 w-4 text-green-600 mx-auto" />
                          </TooltipTrigger>
                          <TooltipContent>SSH Connected</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger>
                            <XCircleIcon className="h-4 w-4 text-red-500 mx-auto" />
                          </TooltipTrigger>
                          <TooltipContent>SSH Failed</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {device.running_config_success ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Running config saved</p>
                            {device.running_config_file && (
                              <p className="text-xs text-gray-400 font-mono">{device.running_config_file.split('/').pop()}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {device.startup_config_success ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Startup config saved</p>
                            {device.startup_config_file && (
                              <p className="text-xs text-gray-400 font-mono">{device.startup_config_file.split('/').pop()}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-xs text-green-700">
                        {device.running_config_bytes && (
                          <div>R: {formatBytes(device.running_config_bytes)}</div>
                        )}
                        {device.startup_config_bytes && (
                          <div>S: {formatBytes(device.startup_config_bytes)}</div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Failed Devices Table */}
      {result.failed_devices && result.failed_devices.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-rose-500 px-4 py-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-white" />
              <h4 className="text-sm font-semibold text-white">Failed Devices ({result.failed_devices.length})</h4>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-red-50 hover:bg-red-50">
                  <TableHead className="text-xs font-semibold text-red-800">Device Name</TableHead>
                  <TableHead className="text-xs font-semibold text-red-800">IP Address</TableHead>
                  <TableHead className="text-xs font-semibold text-red-800">Platform</TableHead>
                  <TableHead className="text-xs font-semibold text-red-800 text-center">SSH</TableHead>
                  <TableHead className="text-xs font-semibold text-red-800">Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.failed_devices.map((device: BackupDeviceResult) => (
                  <TableRow 
                    key={device.device_id} 
                    className="bg-red-50/30 hover:bg-red-100/50 transition-colors border-b border-red-100"
                  >
                    <TableCell className="font-medium text-red-900">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        {device.device_name}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-red-700">{device.device_ip}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs bg-white border-red-300 text-red-700">
                        {device.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {device.ssh_connection_success ? (
                        <Wifi className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-red-500 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-red-700 max-w-[200px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help line-clamp-2">{device.error || 'Unknown error'}</span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-md">
                          <p className="text-xs">{device.error || 'Unknown error'}</p>
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
