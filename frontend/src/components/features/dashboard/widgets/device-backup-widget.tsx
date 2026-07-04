'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  HardDrive,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconChip } from '@/components/shared/icon-chip'
import { StatusBadge } from '@/components/shared/status-badge'
import { useDeviceBackupQuery } from '@/hooks/queries/use-device-backup-query'

function formatTimeAgo(timestamp: string | null): string {
  if (!timestamp) return 'Never'
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function DeviceBackupWidget() {
  const { data, isLoading, isError } = useDeviceBackupQuery()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all')

  const successRate =
    data?.total_devices
      ? Math.round((data.devices_with_successful_backup / data.total_devices) * 100)
      : 0

  const filteredDevices =
    data?.devices?.filter(device => {
      const matchesSearch =
        !searchFilter ||
        device.device_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        device.device_id.toLowerCase().includes(searchFilter.toLowerCase())
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'success'
            ? device.last_backup_success
            : !device.last_backup_success
      return matchesSearch && matchesStatus
    }) ?? []

  return (
    <>
      <Card
        className={cn(
          'analytics-card border-0 h-full transition-all duration-300 hover:shadow-analytics-lg cursor-pointer',
          isLoading && 'animate-pulse'
        )}
        onClick={() => !isLoading && setIsModalOpen(true)}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <IconChip variant="primary" className="p-3 rounded-xl">
              <HardDrive className="h-6 w-6" />
            </IconChip>
            <div className="text-right">
              <div className="text-3xl font-bold text-foreground">
                {isLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : isError ? (
                  <AlertTriangle className="h-8 w-8 text-error-foreground" />
                ) : (
                  `${successRate}%`
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <CardTitle className="text-sm font-semibold text-foreground mb-2">
            Device Backup Health
          </CardTitle>
          {!isLoading && !isError && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {data?.devices_with_successful_backup ?? 0} successful,{' '}
                {data?.devices_with_failed_backup ?? 0} failed
              </p>
              <p className="text-xs text-primary font-medium">Click to view details →</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] p-0 gap-0 overflow-hidden">
          <div className="panel-header px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Device Backup Status Report
              </DialogTitle>
              <DialogDescription className="text-panel-header-muted">
                Detailed per-device backup analysis
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid grid-cols-4 gap-4 p-6 bg-muted border-b">
            {(['all', 'success', 'failed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  'text-center p-3 rounded-lg transition-all hover:bg-card hover:shadow-sm',
                  statusFilter === f ? 'bg-card shadow-sm ring-2 ring-primary/30' : ''
                )}
              >
                <div
                  className={cn(
                    'text-2xl font-bold',
                    f === 'success'
                      ? 'text-success-foreground'
                      : f === 'failed'
                        ? 'text-error-foreground'
                        : 'text-foreground'
                  )}
                >
                  {f === 'all'
                    ? data?.total_devices ?? 0
                    : f === 'success'
                      ? data?.devices_with_successful_backup ?? 0
                      : data?.devices_with_failed_backup ?? 0}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {f === 'all' ? 'Total Devices' : f === 'success' ? 'Successful' : 'Failed'}
                </div>
              </button>
            ))}
            <div className="text-center p-3">
              <div className="text-2xl font-bold text-primary">{successRate}%</div>
              <div className="text-xs text-muted-foreground">Success Rate</div>
            </div>
          </div>

          <div className="px-6 pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search devices..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="pl-10 bg-card"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[400px] px-6 pb-6">
            <div className="space-y-3 mt-4">
              {filteredDevices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No devices found</p>
                </div>
              ) : (
                filteredDevices.map(device => (
                  <div
                    key={device.device_id}
                    className={cn(
                      'p-4 rounded-lg border transition-all duration-200 hover:shadow-md',
                      device.last_backup_success ? 'status-success' : 'status-error'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">
                          {device.last_backup_success ? (
                            <CheckCircle2 className="h-5 w-5 text-success-foreground" />
                          ) : (
                            <XCircle className="h-5 w-5 text-error-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{device.device_name}</h4>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{device.device_id}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{formatTimeAgo(device.last_backup_time)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <TrendingUp className="h-3.5 w-3.5" />
                              <span title="Total backup history: successful / failed">
                                History: {device.total_successful_backups} / {device.total_failed_backups}
                              </span>
                            </div>
                          </div>
                          {!device.last_backup_success && device.last_error && (
                            <div className="mt-2 p-2 bg-error border border-error-border rounded text-xs text-error-foreground">
                              <span className="font-semibold">Error:</span> {device.last_error}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <StatusBadge variant={device.last_backup_success ? 'success' : 'error'}>
                          {device.total_successful_backups > 0
                            ? Math.round(
                                (device.total_successful_backups /
                                  (device.total_successful_backups + device.total_failed_backups)) *
                                  100
                              )
                            : 0}
                          %
                        </StatusBadge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-between items-center px-6 py-3 bg-muted border-t">
            <p className="text-xs text-muted-foreground">
              {filteredDevices.length} of {data?.total_devices ?? 0} devices shown
            </p>
            <Button onClick={() => setIsModalOpen(false)} size="sm">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
