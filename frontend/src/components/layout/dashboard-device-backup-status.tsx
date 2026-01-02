'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import {
  HardDrive,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Search
} from 'lucide-react'
import { Input } from '@/components/ui/input'

interface DeviceBackupStatus {
  device_id: string
  device_name: string
  last_backup_success: boolean
  last_backup_time: string | null
  total_successful_backups: number
  total_failed_backups: number
  last_error: string | null
}

interface BackupCheckResponse {
  total_devices: number
  devices_with_successful_backup: number
  devices_with_failed_backup: number
  devices_never_backed_up: number
  devices: DeviceBackupStatus[]
}

interface DashboardDeviceBackupStatusProps {
  refreshTrigger?: number
}

export default function DashboardDeviceBackupStatus({ refreshTrigger = 0 }: DashboardDeviceBackupStatusProps) {
  const { apiCall } = useApi()
  const [backupStatus, setBackupStatus] = useState<BackupCheckResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all')

  const loadBackupStatus = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiCall<BackupCheckResponse>('celery/device-backup-status')
      setBackupStatus(data)
    } catch (err) {
      console.error('Error fetching backup status:', err)
      setError(err instanceof Error ? err.message : 'Failed to load backup status')
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  useEffect(() => {
    loadBackupStatus()
  }, [loadBackupStatus, refreshTrigger])

  const formatTimeAgo = (timestamp: string | null): string => {
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

  const filteredDevices = backupStatus?.devices?.filter(device => {
    // Apply search filter
    const matchesSearch = !searchFilter ||
      device.device_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      device.device_id.toLowerCase().includes(searchFilter.toLowerCase())

    // Apply status filter
    const matchesStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'success' ? device.last_backup_success :
      statusFilter === 'failed' ? !device.last_backup_success :
      true

    return matchesSearch && matchesStatus
  }) || []

  const successRate = backupStatus?.total_devices
    ? Math.round((backupStatus.devices_with_successful_backup / backupStatus.total_devices) * 100)
    : 0

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">Failed to load device backup status</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Summary Card - Clickable */}
      <Card
        className={cn(
          "analytics-card border-0 transition-all duration-300 hover:shadow-analytics-lg cursor-pointer",
          loading && "animate-pulse"
        )}
        onClick={() => !loading && setIsModalOpen(true)}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-xl bg-blue-100 ring-1 ring-white/20">
              <HardDrive className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-right">
              <div className={cn(
                "text-3xl font-bold text-slate-900",
                loading && "text-slate-400"
              )}>
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                ) : (
                  `${successRate}%`
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <CardTitle className="text-sm font-semibold text-slate-700 mb-2">
            Device Backup Health
          </CardTitle>
          {loading ? (
            <p className="text-xs text-slate-500 leading-relaxed">Loading device status...</p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 leading-relaxed">
                {backupStatus?.devices_with_successful_backup || 0} successful, {backupStatus?.devices_with_failed_backup || 0} failed
              </p>
              <p className="text-xs text-blue-600 font-medium">
                Click to view details →
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 px-6 py-4">
            <DialogHeader className="text-white">
              <DialogTitle className="text-lg font-semibold text-white">
                Device Backup Status Report
              </DialogTitle>
              <DialogDescription className="text-blue-50">
                Detailed per-device backup analysis
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 p-6 bg-slate-50 border-b">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                "text-center p-3 rounded-lg transition-all hover:bg-white hover:shadow-sm",
                statusFilter === 'all' ? 'bg-white shadow-sm ring-2 ring-blue-200' : ''
              )}
            >
              <div className="text-2xl font-bold text-slate-900">{backupStatus?.total_devices || 0}</div>
              <div className="text-xs text-slate-600">Total Devices</div>
            </button>
            <button
              onClick={() => setStatusFilter('success')}
              className={cn(
                "text-center p-3 rounded-lg transition-all hover:bg-white hover:shadow-sm",
                statusFilter === 'success' ? 'bg-white shadow-sm ring-2 ring-green-200' : ''
              )}
            >
              <div className="text-2xl font-bold text-green-600">{backupStatus?.devices_with_successful_backup || 0}</div>
              <div className="text-xs text-slate-600">Successful</div>
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={cn(
                "text-center p-3 rounded-lg transition-all hover:bg-white hover:shadow-sm",
                statusFilter === 'failed' ? 'bg-white shadow-sm ring-2 ring-red-200' : ''
              )}
            >
              <div className="text-2xl font-bold text-red-600">{backupStatus?.devices_with_failed_backup || 0}</div>
              <div className="text-xs text-slate-600">Failed</div>
            </button>
            <div className="text-center p-3">
              <div className="text-2xl font-bold text-blue-600">{successRate}%</div>
              <div className="text-xs text-slate-600">Success Rate</div>
            </div>
          </div>

          {/* Search Filter */}
          <div className="px-6 pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search devices..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
          </div>

          {/* Device List */}
          <div className="overflow-y-auto max-h-[400px] px-6 pb-6">
            <div className="space-y-3 mt-4">
              {filteredDevices.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No devices found</p>
                </div>
              ) : (
                filteredDevices.map((device) => (
                  <div
                    key={device.device_id}
                    className={cn(
                      "p-4 rounded-lg border transition-all duration-200 hover:shadow-md",
                      device.last_backup_success
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">
                          {device.last_backup_success ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900">{device.device_name}</h4>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{device.device_id}</p>

                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{formatTimeAgo(device.last_backup_time)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <TrendingUp className="h-3.5 w-3.5" />
                              <span title="Total backup history: successful / failed">
                                History: {device.total_successful_backups} / {device.total_failed_backups}
                              </span>
                            </div>
                          </div>

                          {!device.last_backup_success && device.last_error && (
                            <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-800">
                              <span className="font-semibold">Error:</span> {device.last_error}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Success Rate Badge */}
                      <div className="text-right">
                        <div className={cn(
                          "px-2 py-1 rounded-full text-xs font-semibold",
                          device.last_backup_success
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        )}>
                          {device.total_successful_backups > 0
                            ? Math.round((device.total_successful_backups / (device.total_successful_backups + device.total_failed_backups)) * 100)
                            : 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center px-6 py-3 bg-slate-50 border-t">
            <p className="text-xs text-slate-500">
              {filteredDevices.length} of {backupStatus?.total_devices || 0} devices shown
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => loadBackupStatus()}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Refresh'
                )}
              </Button>
              <Button onClick={() => setIsModalOpen(false)} size="sm">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
