import { Search, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Device, TableFilters, DropdownOption, LocationItem, PaginationState } from '@/types/features/nautobot/offboard'
import type { RefObject } from 'react'
import { DeviceFilters } from './device-filters'
import { DeviceTableHeader } from './device-table-header'
import { DeviceTableRow } from './device-table-row'
import { PaginationControls } from './pagination-controls'

interface DeviceTableProps {
  devices: Device[]
  selectedDevices: Set<string>
  filters: TableFilters
  roleFilters: Record<string, boolean>
  dropdownOptions: {
    roles: DropdownOption[]
    locations: DropdownOption[]
    statuses: DropdownOption[]
  }
  pagination: PaginationState
  isLoading: boolean
  locationSearch: string
  locationFiltered: LocationItem[]
  showLocationDropdown: boolean
  locationContainerRef: RefObject<HTMLDivElement>
  onSelectDevice: (deviceId: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  onFilterChange: (field: keyof TableFilters, value: string) => void
  onRoleFiltersChange: (filters: Record<string, boolean>) => void
  onLocationSearchChange: (search: string) => void
  onLocationSelect: (location: LocationItem) => void
  onLocationDropdownToggle: (show: boolean) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onClearFilters: () => void
  onReloadDevices: () => void
}

export function DeviceTable({
  devices,
  selectedDevices,
  filters,
  roleFilters,
  dropdownOptions,
  pagination,
  isLoading,
  locationSearch,
  locationFiltered,
  showLocationDropdown,
  locationContainerRef,
  onSelectDevice,
  onSelectAll,
  onFilterChange,
  onRoleFiltersChange,
  onLocationSearchChange,
  onLocationSelect,
  onLocationDropdownToggle,
  onPageChange,
  onPageSizeChange,
  onClearFilters,
  onReloadDevices
}: DeviceTableProps) {
  const allSelected = devices.length > 0 && devices.every(device => selectedDevices.has(device.id))

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-semibold">Devices</h3>
              <p className="text-blue-100 text-xs">Select devices to offboard from Nautobot</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-white hover:bg-white/20 text-xs h-6"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Clear Filters
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReloadDevices}
              className="text-white hover:bg-white/20 text-xs h-6"
              disabled={isLoading}
            >
              <Search className="h-3 w-3 mr-1" />
              Load Devices
            </Button>
          </div>
        </div>
      </div>
      <div className="p-0">
        {/* Filters */}
        <DeviceFilters
          filters={filters}
          roleFilters={roleFilters}
          dropdownOptions={dropdownOptions}
          locationSearch={locationSearch}
          locationFiltered={locationFiltered}
          showLocationDropdown={showLocationDropdown}
          locationContainerRef={locationContainerRef}
          onFilterChange={onFilterChange}
          onRoleFiltersChange={onRoleFiltersChange}
          onLocationSearchChange={onLocationSearchChange}
          onLocationSelect={onLocationSelect}
          onLocationDropdownToggle={onLocationDropdownToggle}
        />

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <DeviceTableHeader
              hasSelectedDevices={selectedDevices.size > 0}
              allSelected={allSelected}
              onSelectAll={onSelectAll}
            />
            <tbody className="divide-y divide-gray-200">
              {devices.map((device, index) => (
                <DeviceTableRow
                  key={device.id}
                  device={device}
                  isSelected={selectedDevices.has(device.id)}
                  index={index}
                  onSelect={onSelectDevice}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <PaginationControls
          pagination={pagination}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  )
}
