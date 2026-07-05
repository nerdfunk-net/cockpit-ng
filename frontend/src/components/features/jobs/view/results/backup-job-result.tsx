'use client'

import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { StatusIcon } from '@/components/shared/status-icon'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertCircle,
  Server,
  GitBranch,
  Key,
  FileText,
  HardDrive,
  Wifi,
  Download,
} from 'lucide-react'
import { BackupJobResult, BackupDeviceResult, formatBytes } from '../types/job-results'

interface BackupJobResultProps {
  result: BackupJobResult
}

export function BackupJobResultView({ result }: BackupJobResultProps) {
  return (
    <div className="space-y-4">
      {/* Backup Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-success border border-success-border rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Download className="h-4 w-4 text-success-foreground" />
            <p className="text-xs text-success-foreground uppercase tracking-wide font-medium">
              Backed Up
            </p>
          </div>
          <p className="text-2xl font-bold text-success-foreground">
            {result.devices_backed_up}
          </p>
        </div>
        <div
          className={`${result.devices_failed > 0 ? 'status-error' : 'bg-muted border-border'} border rounded-lg p-3 text-center`}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <StatusIcon
              variant="error"
              className={`h-4 w-4 ${result.devices_failed > 0 ? '' : 'text-muted-foreground'}`}
            />
            <p
              className={`text-xs uppercase tracking-wide font-medium ${result.devices_failed > 0 ? 'text-error-foreground' : 'text-muted-foreground'}`}
            >
              Failed
            </p>
          </div>
          <p
            className={`text-2xl font-bold ${result.devices_failed > 0 ? 'text-error-foreground' : 'text-muted-foreground'}`}
          >
            {result.devices_failed}
          </p>
        </div>
        {result.git_commit_status && (
          <div className="bg-info border border-info-border rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-info-foreground" />
              <p className="text-xs text-info-foreground uppercase tracking-wide font-medium">
                Files Changed
              </p>
            </div>
            <p className="text-2xl font-bold text-info-foreground">
              {result.git_commit_status.files_changed}
            </p>
          </div>
        )}
        {result.repository && (
          <div className="bg-muted border border-border rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Repository
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">
              {result.repository}
            </p>
          </div>
        )}
      </div>

      {/* Git & Credential Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {result.git_status && (
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="h-5 w-5 text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">Git Repository</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Branch:</span>
                <span className="font-mono text-foreground">
                  {result.git_status.branch}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Operation:</span>
                <Badge variant="secondary" className="text-xs">
                  {result.git_status.operation}
                </Badge>
              </div>
              {result.git_commit_status && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Commit:</span>
                    <span className="font-mono text-foreground">
                      {result.git_commit_status.commit_hash}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status:</span>
                    <div className="flex gap-2">
                      {result.git_commit_status.committed && (
                        <StatusBadge variant="success" className="text-xs">
                          Committed
                        </StatusBadge>
                      )}
                      {result.git_commit_status.pushed && (
                        <StatusBadge variant="info" className="text-xs">
                          Pushed
                        </StatusBadge>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {result.credential_info && (
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Key className="h-5 w-5 text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">Credentials Used</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium text-foreground">
                  {result.credential_info.credential_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Username:</span>
                <span className="font-mono text-foreground">
                  {result.credential_info.username}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Backed Up Devices Table */}
      {result.backed_up_devices && result.backed_up_devices.length > 0 && (
        <div className="border border-success-border rounded-lg overflow-hidden">
          <div className="bg-success px-4 py-2">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-success-foreground" />
              <h4 className="text-sm font-semibold text-success-foreground">
                Backed Up Devices ({result.backed_up_devices.length})
              </h4>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-success hover:bg-success">
                  <TableHead className="text-xs font-semibold text-success-foreground">
                    Device Name
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-success-foreground">
                    IP Address
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-success-foreground">
                    Platform
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-success-foreground text-center">
                    SSH
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-success-foreground text-center">
                    Running
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-success-foreground text-center">
                    Startup
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-success-foreground text-right">
                    Size
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.backed_up_devices.map((device: BackupDeviceResult) => (
                  <TableRow
                    key={device.device_id}
                    className="bg-success/30 hover:bg-success/50 transition-colors border-b border-success-border"
                  >
                    <TableCell className="font-medium text-success-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-success-foreground"></div>
                        {device.device_name}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-success-foreground">
                      {device.device_ip}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant="success" className="text-xs">
                        {device.platform}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-center">
                      {device.ssh_connection_success ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <Wifi className="h-4 w-4 text-success-foreground mx-auto" />
                          </TooltipTrigger>
                          <TooltipContent>SSH Connected</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger>
                            <StatusIcon variant="error" className="h-4 w-4 mx-auto" />
                          </TooltipTrigger>
                          <TooltipContent>SSH Failed</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {device.running_config_success ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <StatusIcon variant="success" className="h-4 w-4 mx-auto" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Running config saved</p>
                            {device.running_config_file && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {device.running_config_file.split('/').pop()}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {device.startup_config_success ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <StatusIcon variant="success" className="h-4 w-4 mx-auto" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Startup config saved</p>
                            {device.startup_config_file && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {device.startup_config_file.split('/').pop()}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-xs text-success-foreground">
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
        <div className="border border-error-border rounded-lg overflow-hidden">
          <div className="bg-error px-4 py-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-error-foreground" />
              <h4 className="text-sm font-semibold text-error-foreground">
                Failed Devices ({result.failed_devices.length})
              </h4>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-error hover:bg-error">
                  <TableHead className="text-xs font-semibold text-error-foreground">
                    Device Name
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-error-foreground">
                    IP Address
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-error-foreground">
                    Platform
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-error-foreground text-center">
                    SSH
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-error-foreground">
                    Error
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.failed_devices.map((device: BackupDeviceResult) => (
                  <TableRow
                    key={device.device_id}
                    className="bg-error/30 hover:bg-error/50 transition-colors border-b border-error-border"
                  >
                    <TableCell className="font-medium text-error-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-error-foreground"></div>
                        {device.device_name}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-error-foreground">
                      {device.device_ip}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant="error" className="text-xs">
                        {device.platform}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-center">
                      {device.ssh_connection_success ? (
                        <Wifi className="h-4 w-4 text-success-foreground mx-auto" />
                      ) : (
                        <StatusIcon variant="error" className="h-4 w-4 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-error-foreground max-w-[200px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help line-clamp-2">
                            {device.error || 'Unknown error'}
                          </span>
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
