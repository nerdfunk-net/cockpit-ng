import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, Search, RotateCcw, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Device } from '@/types/features/checkmk/sync-devices'
import { DeviceTableHeader } from './device-table-header'
import { DeviceTableRow } from './device-table-row'

interface DeviceTableProps {
  devices: Device[]
  totalDeviceCount: number
  selectedDevices: Set<string>
  diffResults: Record<string, 'equal' | 'diff' | 'host_not_found'>
  deviceNameFilter: string
  roleFilters: Record<string, boolean>
  selectedLocation: string
  statusFilter: string
  filterOptions: {
    roles: Set<string>
    locations: Set<string>
    statuses: Set<string>
  }
  activeFiltersCount: number
  currentPage: number
  pageSize: number
  loading: boolean
  hasDevicesSynced: boolean
  isActivating: boolean
  isSyncing: boolean
  onSelectDevice: (deviceId: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  onGetDiff: (device: Device) => void
  onSync: (device: Device) => void
  onStartDiscovery: (device: Device, mode: string) => void
  onDeviceNameFilterChange: (value: string) => void
  onRoleFiltersChange: (filters: Record<string, boolean>) => void
  onLocationChange: (location: string) => void
  onStatusFilterChange: (status: string) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onReloadDevices: () => void
  onResetFilters: () => void
  onClearSelection: () => void
  onSyncSelected: () => void
  onActivate: () => void
}

export function DeviceTable({
  devices,
  totalDeviceCount,
  selectedDevices,
  diffResults,
  deviceNameFilter,
  roleFilters,
  selectedLocation,
  statusFilter,
  filterOptions,
  activeFiltersCount,
  currentPage,
  pageSize,
  loading,
  hasDevicesSynced,
  isActivating,
  isSyncing,
  onSelectDevice,
  onSelectAll,
  onGetDiff,
  onSync,
  onStartDiscovery,
  onDeviceNameFilterChange,
  onRoleFiltersChange,
  onLocationChange,
  onStatusFilterChange,
  onPageChange,
  onPageSizeChange,
  onReloadDevices,
  onResetFilters,
  onClearSelection,
  onSyncSelected,
  onActivate
}: DeviceTableProps) {
  // Pagination
  const totalPages = Math.ceil(devices.length / pageSize)
  const paginatedDevices = useMemo(() => {
    const start = currentPage * pageSize
    const end = start + pageSize
    return devices.slice(start, end)
  }, [devices, currentPage, pageSize])

  const allSelected = paginatedDevices.length > 0 && paginatedDevices.every(device => selectedDevices.has(device.id))

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      {/* Blue Header */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-semibold">Device Synchronization Management</h3>
              {activeFiltersCount > 0 ? (
                <p className="text-blue-100 text-xs">
                  Showing {devices.length} of {totalDeviceCount} devices
                  {activeFiltersCount > 0 && ` (${activeFiltersCount} filter${activeFiltersCount > 1 ? 's' : ''} active)`}
                </p>
              ) : (
                <p className="text-blue-100 text-xs">
                  Showing all {totalDeviceCount} devices
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {activeFiltersCount > 0 && (
              <>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  {activeFiltersCount} active
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetFilters}
                  className="h-8 w-8 p-0 text-white hover:bg-white/20"
                  title="Clear All Filters"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onReloadDevices}
              className="text-white hover:bg-white/20 text-xs h-7"
              disabled={loading}
              title="Reload devices from Nautobot"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
              ) : (
                <Search className="h-3 w-3 mr-1" />
              )}
              Load Devices
            </Button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="p-4 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <DeviceTableHeader
              hasSelectedDevices={selectedDevices.size > 0}
              allSelected={allSelected}
              deviceNameFilter={deviceNameFilter}
              roleFilters={roleFilters}
              selectedLocation={selectedLocation}
              statusFilter={statusFilter}
              filterOptions={filterOptions}
              onSelectAll={(checked) => onSelectAll(checked)}
              onDeviceNameFilterChange={onDeviceNameFilterChange}
              onRoleFiltersChange={onRoleFiltersChange}
              onLocationChange={onLocationChange}
              onStatusFilterChange={onStatusFilterChange}
            />
            <tbody className="divide-y divide-gray-200">
              {paginatedDevices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-8 text-muted-foreground">
                    No devices found
                  </td>
                </tr>
              ) : (
                paginatedDevices.map((device, index) => (
                  <DeviceTableRow
                    key={`sync-devices-device-${device.id}`}
                    device={device}
                    index={index}
                    isSelected={selectedDevices.has(device.id)}
                    diffResults={diffResults}
                    onSelect={onSelectDevice}
                    onGetDiff={onGetDiff}
                    onSync={onSync}
                    onStartDiscovery={onStartDiscovery}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, devices.length)} of {devices.length} entries
          </div>

          <div className="flex items-center gap-1">
            {/* Navigation buttons - only show when there are multiple pages */}
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
                      key={`sync-devices-page-${pageNum}`}
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

            {/* Page Size Selector - always visible */}
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

      {/* Action Buttons Footer */}
      <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {hasDevicesSynced ? (
            <span className="text-green-600">✓ Devices have been synced. Activate changes to apply them in CheckMK.</span>
          ) : (
            <span>Sync one or more devices to enable activation.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedDevices.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
            >
              Clear Selection
            </Button>
          )}
          <Button
            onClick={onSyncSelected}
            disabled={selectedDevices.size === 0 || isSyncing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing {selectedDevices.size} device{selectedDevices.size === 1 ? '' : 's'}...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Selected ({selectedDevices.size})
              </>
            )}
          </Button>
          <Button
            onClick={onActivate}
            disabled={!hasDevicesSynced || isActivating}
            className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400"
          >
            {isActivating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Activating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Activate Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
