import { useMemo, useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ArrowLeftRight,
  RefreshCw,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DiffTableHeader } from './diff-table-header'
import { DiffTableRow } from './diff-table-row'
import type { DiffDevice, IpAddressFilter } from '../types'

interface DiffDeviceTableProps {
  devices: DiffDevice[]
  totalDeviceCount: number
  deviceNameFilter: string
  roleFilters: Record<string, boolean>
  selectedLocation: string
  statusFilter: string
  systemFilters: Record<string, boolean>
  ipAddressFilter: IpAddressFilter
  diffStatusFilters: Record<string, boolean>
  filterOptions: {
    roles: Set<string>
    locations: Set<string>
    statuses: Set<string>
  }
  totalBoth: number
  totalNautobotOnly: number
  totalCheckmkOnly: number
  activeFiltersCount: number
  loading: boolean
  selectedDevices: Set<string>
  isSyncingSelected: boolean
  onSelectDevice: (nautobotId: string, checked: boolean) => void
  onSelectAll: (devices: DiffDevice[], checked: boolean) => void
  onSyncSelected: () => void
  onDeviceNameFilterChange: (value: string) => void
  onRoleFiltersChange: (value: Record<string, boolean>) => void
  onLocationChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  onSystemFiltersChange: (value: Record<string, boolean>) => void
  onIpAddressFilterChange: (value: IpAddressFilter) => void
  onDiffStatusFiltersChange: (value: Record<string, boolean>) => void
  onResetFilters: () => void
  onGetDiff: (device: DiffDevice) => void
  onSync: (device: DiffDevice) => void
  onRunDiff: () => void
  onRefresh: () => void
}

export function DiffDeviceTable({
  devices,
  totalDeviceCount,
  deviceNameFilter,
  roleFilters,
  selectedLocation,
  statusFilter,
  systemFilters,
  ipAddressFilter,
  diffStatusFilters,
  filterOptions,
  totalBoth,
  totalNautobotOnly,
  totalCheckmkOnly,
  activeFiltersCount,
  loading,
  selectedDevices,
  isSyncingSelected,
  onSelectDevice,
  onSelectAll,
  onSyncSelected,
  onDeviceNameFilterChange,
  onRoleFiltersChange,
  onLocationChange,
  onStatusFilterChange,
  onSystemFiltersChange,
  onIpAddressFilterChange,
  onDiffStatusFiltersChange,
  onResetFilters,
  onGetDiff,
  onSync,
  onRunDiff,
  onRefresh,
}: DiffDeviceTableProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  // Paginate devices
  const paginatedDevices = useMemo(() => {
    const start = currentPage * pageSize
    return devices.slice(start, start + pageSize)
  }, [devices, currentPage, pageSize])

  const totalPages = Math.ceil(devices.length / pageSize)

  // Selection state derived from current page
  const selectableOnPage = useMemo(
    () => paginatedDevices.filter(d => !!d.nautobot_id),
    [paginatedDevices]
  )
  const isAllSelected =
    selectableOnPage.length > 0 &&
    selectableOnPage.every(d => selectedDevices.has(d.nautobot_id!))
  const isIndeterminate =
    !isAllSelected && selectableOnPage.some(d => selectedDevices.has(d.nautobot_id!))

  // Reset page when filters change
  const handlePageChange = useCallback(
    (newPage: number) => {
      setCurrentPage(Math.max(0, Math.min(newPage, totalPages - 1)))
    },
    [totalPages]
  )

  // Reset to first page when page size changes
  const handlePageSizeChange = useCallback((value: string) => {
    setPageSize(Number(value))
    setCurrentPage(0)
  }, [])

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      {/* Panel Header */}
      <div className="panel-header py-2 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ArrowLeftRight className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-semibold">Device Inventory Comparison</h3>
              {totalDeviceCount > 0 ? (
                <div className="flex items-center gap-2 mt-0.5 text-xs text-panel-header-muted">
                  <span>
                    <span className="font-semibold text-current">{totalDeviceCount}</span>{' '}
                    total
                  </span>
                  <span className="opacity-40">·</span>
                  <span>
                    <span className="font-semibold text-current">{totalBoth}</span> both
                  </span>
                  <span className="opacity-40">·</span>
                  <span>
                    <span className="font-semibold text-current">
                      {totalNautobotOnly}
                    </span>{' '}
                    Nautobot
                  </span>
                  <span className="opacity-40">·</span>
                  <span>
                    <span className="font-semibold text-current">{totalCheckmkOnly}</span>{' '}
                    CheckMK
                  </span>
                  {activeFiltersCount > 0 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="opacity-70">{devices.length} shown</span>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-panel-header-muted text-xs mt-0.5">
                  {loading ? 'Loading…' : 'Click Run Diff or Refresh to load devices.'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {selectedDevices.size > 0 && (
              <Button
                onClick={onSyncSelected}
                disabled={isSyncingSelected}
                size="sm"
                className="bg-card text-primary hover:bg-card/90 font-medium"
              >
                {isSyncingSelected ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                    Syncing {selectedDevices.size}...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Selected ({selectedDevices.size})
                  </>
                )}
              </Button>
            )}
            {activeFiltersCount > 0 && (
              <>
                <Badge
                  variant="secondary"
                  className="bg-card/20 text-current border-current/30"
                >
                  {activeFiltersCount} active
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetFilters}
                  className="h-8 w-8 p-0 text-current hover:bg-card/20"
                  title="Clear All Filters"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="sm"
              disabled={loading}
              className="text-current hover:bg-card/20"
              title="Reload devices from Nautobot (bypass cache)"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Load Nautobot
            </Button>
            <Button
              onClick={onRunDiff}
              variant="ghost"
              size="sm"
              disabled={loading}
              className="text-current hover:bg-card/20"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Running...' : 'Run Diff'}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <DiffTableHeader
            deviceNameFilter={deviceNameFilter}
            roleFilters={roleFilters}
            selectedLocation={selectedLocation}
            statusFilter={statusFilter}
            systemFilters={systemFilters}
            ipAddressFilter={ipAddressFilter}
            diffStatusFilters={diffStatusFilters}
            filterOptions={filterOptions}
            isAllSelected={isAllSelected}
            isIndeterminate={isIndeterminate}
            onSelectAll={checked => onSelectAll(paginatedDevices, checked)}
            onDeviceNameFilterChange={v => {
              onDeviceNameFilterChange(v)
              setCurrentPage(0)
            }}
            onRoleFiltersChange={v => {
              onRoleFiltersChange(v)
              setCurrentPage(0)
            }}
            onLocationChange={v => {
              onLocationChange(v)
              setCurrentPage(0)
            }}
            onStatusFilterChange={v => {
              onStatusFilterChange(v)
              setCurrentPage(0)
            }}
            onSystemFiltersChange={v => {
              onSystemFiltersChange(v)
              setCurrentPage(0)
            }}
            onIpAddressFilterChange={v => {
              onIpAddressFilterChange(v)
              setCurrentPage(0)
            }}
            onDiffStatusFiltersChange={v => {
              onDiffStatusFiltersChange(v)
              setCurrentPage(0)
            }}
          />
          <tbody>
            {paginatedDevices.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-muted-foreground">
                  {totalDeviceCount === 0
                    ? loading
                      ? 'Loading devices...'
                      : 'No devices loaded. Click "Run Diff" to compare inventories, or "Refresh" to load Nautobot devices.'
                    : 'No devices match the current filters.'}
                </td>
              </tr>
            ) : (
              paginatedDevices.map((device, index) => (
                <DiffTableRow
                  key={`${device.name}-${device.source}`}
                  device={device}
                  index={index}
                  isSelected={
                    !!device.nautobot_id && selectedDevices.has(device.nautobot_id)
                  }
                  onSelectDevice={onSelectDevice}
                  onGetDiff={onGetDiff}
                  onSync={onSync}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {devices.length > 0 && (
        <div className="bg-muted border-t px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100, 200, 250, 500].map(size => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {Math.max(1, totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 0}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
