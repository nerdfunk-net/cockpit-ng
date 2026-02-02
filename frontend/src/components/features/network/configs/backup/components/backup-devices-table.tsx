'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Save, History, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useBackupMutations } from '../hooks/use-backup-mutations'
import type { Device, DeviceFilters, FilterOptions } from '../types'

interface BackupDevicesTableProps {
  devices: Device[]
  total: number
  filters: DeviceFilters
  onFiltersChange: (filters: DeviceFilters) => void
  filterOptions: FilterOptions
  onShowHistory: (device: Device) => void
  backupInProgress: Set<string>
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function BackupDevicesTable({
  devices,
  total,
  filters,
  onFiltersChange,
  filterOptions,
  onShowHistory,
  backupInProgress,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange
}: BackupDevicesTableProps) {
  const { triggerBackup } = useBackupMutations()

  const handleBackup = (device: Device) => {
    triggerBackup.mutate(device.id)
  }

  const isDeviceOffline = (status: string) => {
    const statusLower = status.toLowerCase()
    return statusLower.includes('offline') || statusLower.includes('failed')
  }

  const getStatusBadgeVariant = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('active') || statusLower.includes('online')) {
      return 'default'
    } else if (statusLower.includes('offline') || statusLower.includes('failed')) {
      return 'destructive'
    } else if (statusLower.includes('maintenance')) {
      return 'secondary'
    }
    return 'outline'
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4" />
          <div>
            <h3 className="text-sm font-semibold">Device Backup Management</h3>
            <p className="text-blue-100 text-xs">
              Showing {devices.length} of {total} devices
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="pl-4 pr-2 py-3 w-48 text-left text-xs font-medium text-gray-600 uppercase">
                  <div className="space-y-1">
                    <div>Device Name</div>
                    <div>
                      <Input
                        placeholder="Type 3+ chars for backend search..."
                        value={filters.name || ''}
                        onChange={(e) => onFiltersChange({ ...filters, name: e.target.value })}
                        className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </th>
                <th className="px-4 py-3 w-32 text-left text-xs font-medium text-gray-600 uppercase">IP Address</th>
                <th className="px-4 py-3 w-36 text-left text-xs font-medium text-gray-600 uppercase">
                  <div className="space-y-1">
                    <div>Role</div>
                    <div>
                      <Select
                        value={filters.role || "all"}
                        onValueChange={(value) => onFiltersChange({
                          ...filters,
                          role: value === "all" ? "" : value
                        })}
                      >
                        <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                          <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          {Array.from(filterOptions.roles).sort().map(role => (
                            <SelectItem key={`backup-role-${role}`} value={role}>{role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </th>
                <th className="pl-12 pr-4 py-3 w-56 text-left text-xs font-medium text-gray-600 uppercase">
                  <div className="space-y-1">
                    <div>Location</div>
                    <div>
                      <Select
                        value={filters.location || "all"}
                        onValueChange={(value) => onFiltersChange({
                          ...filters,
                          location: value === "all" ? "" : value
                        })}
                      >
                        <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                          <SelectValue placeholder="All Locations" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Locations</SelectItem>
                          {Array.from(filterOptions.locations).sort().map(location => (
                            <SelectItem key={`backup-location-${location}`} value={location}>{location}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </th>
                <th className="px-4 py-3 w-36 text-left text-xs font-medium text-gray-600 uppercase">
                  <div className="space-y-1">
                    <div>Device Type</div>
                    <div>
                      <Select
                        value={filters.deviceType || "all"}
                        onValueChange={(value) => onFiltersChange({
                          ...filters,
                          deviceType: value === "all" ? "" : value
                        })}
                      >
                        <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {Array.from(filterOptions.deviceTypes).sort().map(deviceType => (
                            <SelectItem key={`backup-devicetype-${deviceType}`} value={deviceType}>{deviceType}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </th>
                <th className="px-4 py-3 w-44 text-left text-xs font-medium text-gray-600 uppercase">
                  <div className="space-y-1">
                    <div>Status</div>
                    <div>
                      <Select
                        value={filters.status || "all"}
                        onValueChange={(value) => onFiltersChange({
                          ...filters,
                          status: value === "all" ? "" : value
                        })}
                      >
                        <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {Array.from(filterOptions.statuses).sort().map(status => (
                            <SelectItem key={`backup-status-${status}`} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </th>
                <th className="pl-12 pr-4 py-3 w-40 text-left text-xs font-medium text-gray-600 uppercase">Last Backup</th>
                <th className="pl-16 pr-4 py-3 w-32 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-8 text-muted-foreground">
                    No devices found
                  </td>
                </tr>
              ) : (
                devices.map((device) => {
                  const isOffline = isDeviceOffline(device.status?.name || '')
                  const isBackingUp = backupInProgress.has(device.id)

                  return (
                    <tr key={`backup-device-${device.id}`} className="border-b hover:bg-muted/50">
                      <td className="pl-4 pr-2 py-3 w-48 text-sm font-medium text-gray-900">{device.name}</td>
                      <td className="px-4 py-3 w-32 text-sm text-gray-600">{device.primary_ip4?.address || 'N/A'}</td>
                      <td className="px-4 py-3 w-36 text-sm text-gray-600">{device.role?.name || 'Unknown'}</td>
                      <td className="pl-12 pr-4 py-3 w-56 text-sm text-gray-600">{device.location?.name || 'Unknown'}</td>
                      <td className="px-4 py-3 w-36 text-sm text-gray-600">{device.device_type?.model || 'Unknown'}</td>
                      <td className="px-4 py-3 w-44">
                        <Badge variant={getStatusBadgeVariant(device.status?.name || '')}>
                          {device.status?.name || 'Unknown'}
                        </Badge>
                      </td>
                      <td className="pl-12 pr-4 py-3 w-40 text-sm text-gray-600">{device.cf_last_backup || 'Never'}</td>
                      <td className="pl-16 pr-4 py-3 w-32">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBackup(device)}
                            disabled={isOffline || isBackingUp}
                            title="Backup Device"
                          >
                            {isBackingUp ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onShowHistory(device)}
                            title="View Backup History"
                          >
                            <History className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, total)} of {total} entries
          </div>

          <div className="flex items-center gap-1">
            {/* Navigation buttons */}
            {totalPages > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(0)}
                  disabled={currentPage === 0}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(0, Math.min(totalPages - 5, currentPage - 2)) + i
                  if (pageNum >= totalPages) return null

                  return (
                    <Button
                      key={`backup-page-${pageNum}`}
                      variant={pageNum === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPageChange(pageNum)}
                    >
                      {pageNum + 1}
                    </Button>
                  )
                })}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(totalPages - 1)}
                  disabled={currentPage >= totalPages - 1}
                >
                  Last
                </Button>
              </>
            )}

            {/* Page Size Selector */}
            <div className="flex items-center gap-1 ml-2">
              <Label htmlFor="page-size" className="text-xs text-muted-foreground">Show:</Label>
              <Select value={pageSize.toString()} onValueChange={(value) => onPageSizeChange(parseInt(value))}>
                <SelectTrigger className="w-20 h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
