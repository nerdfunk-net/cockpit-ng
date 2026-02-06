import { useMemo, useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, RotateCcw, ArrowLeftRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DiffTableHeader } from './diff-table-header'
import { DiffTableRow } from './diff-table-row'
import type { DiffDevice, SystemFilter } from '@/types/features/checkmk/diff-viewer'

interface DiffDeviceTableProps {
  devices: DiffDevice[]
  totalDeviceCount: number
  deviceNameFilter: string
  roleFilters: Record<string, boolean>
  selectedLocation: string
  statusFilter: string
  systemFilter: SystemFilter
  filterOptions: {
    roles: Set<string>
    locations: Set<string>
    statuses: Set<string>
  }
  activeFiltersCount: number
  onDeviceNameFilterChange: (value: string) => void
  onRoleFiltersChange: (value: Record<string, boolean>) => void
  onLocationChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  onSystemFilterChange: (value: SystemFilter) => void
  onResetFilters: () => void
  onGetDiff: (device: DiffDevice) => void
}

export function DiffDeviceTable({
  devices,
  totalDeviceCount,
  deviceNameFilter,
  roleFilters,
  selectedLocation,
  statusFilter,
  systemFilter,
  filterOptions,
  activeFiltersCount,
  onDeviceNameFilterChange,
  onRoleFiltersChange,
  onLocationChange,
  onStatusFilterChange,
  onSystemFilterChange,
  onResetFilters,
  onGetDiff,
}: DiffDeviceTableProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  // Paginate devices
  const paginatedDevices = useMemo(() => {
    const start = currentPage * pageSize
    return devices.slice(start, start + pageSize)
  }, [devices, currentPage, pageSize])

  const totalPages = Math.ceil(devices.length / pageSize)

  // Reset page when filters change
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(Math.max(0, Math.min(newPage, totalPages - 1)))
  }, [totalPages])

  // Reset to first page when page size changes
  const handlePageSizeChange = useCallback((value: string) => {
    setPageSize(Number(value))
    setCurrentPage(0)
  }, [])

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      {/* Blue Header */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ArrowLeftRight className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-semibold">Device Inventory Comparison</h3>
              {activeFiltersCount > 0 ? (
                <p className="text-blue-100 text-xs">
                  Showing {devices.length} of {totalDeviceCount} devices
                  {` (${activeFiltersCount} filter${activeFiltersCount > 1 ? 's' : ''} active)`}
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
            systemFilter={systemFilter}
            filterOptions={filterOptions}
            onDeviceNameFilterChange={(v) => { onDeviceNameFilterChange(v); setCurrentPage(0) }}
            onRoleFiltersChange={(v) => { onRoleFiltersChange(v); setCurrentPage(0) }}
            onLocationChange={(v) => { onLocationChange(v); setCurrentPage(0) }}
            onStatusFilterChange={(v) => { onStatusFilterChange(v); setCurrentPage(0) }}
            onSystemFilterChange={(v) => { onSystemFilterChange(v); setCurrentPage(0) }}
          />
          <tbody>
            {paginatedDevices.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  {totalDeviceCount === 0
                    ? 'No devices loaded. Click "Run Diff" to compare inventories.'
                    : 'No devices match the current filters.'}
                </td>
              </tr>
            ) : (
              paginatedDevices.map((device, index) => (
                <DiffTableRow
                  key={`${device.name}-${device.source}`}
                  device={device}
                  index={index}
                  onGetDiff={onGetDiff}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {devices.length > 0 && (
        <div className="bg-gray-50 border-t px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Rows per page:</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100, 200].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
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
