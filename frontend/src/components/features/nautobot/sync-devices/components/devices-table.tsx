'use client'

import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, RotateCcw } from 'lucide-react'
import { StatusBadge } from '@/components/shared/status-badge'
import type {
  Device,
  TableFilters,
  DropdownOption,
  LocationItem,
  PaginationState,
} from '../types'
import { getStatusBadgeVariant } from '../utils'
import { DevicesFilters } from './devices-filters'
import { DevicesPagination } from './devices-pagination'

interface DevicesTableProps {
  devices: Device[]
  selectedDevices: Set<string>
  onSelectionChange: (selected: Set<string>) => void
  filters: TableFilters
  roleFilters: Record<string, boolean>
  onRoleFiltersChange: (filters: Record<string, boolean>) => void
  filterOptions: {
    roles: DropdownOption[]
    locations: DropdownOption[]
    statuses: DropdownOption[]
  }
  locations: LocationItem[]
  onFilterChange: (field: keyof TableFilters, value: string) => void
  onClearFilters: () => void
  onReloadDevices: () => void
  isReloading: boolean
  pagination: PaginationState
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function DevicesTable({
  devices,
  selectedDevices,
  onSelectionChange,
  filters,
  roleFilters,
  onRoleFiltersChange,
  filterOptions,
  locations,
  onFilterChange,
  onClearFilters,
  onReloadDevices,
  isReloading,
  pagination,
  onPageChange,
  onPageSizeChange,
}: DevicesTableProps) {
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const newSelected = new Set(selectedDevices)
        devices.forEach(device => newSelected.add(device.id))
        onSelectionChange(newSelected)
      } else {
        onSelectionChange(new Set())
      }
    },
    [devices, selectedDevices, onSelectionChange]
  )

  const handleDeviceSelection = useCallback(
    (deviceId: string, checked: boolean) => {
      const newSelected = new Set(selectedDevices)
      if (checked) {
        newSelected.add(deviceId)
      } else {
        newSelected.delete(deviceId)
      }
      onSelectionChange(newSelected)
    },
    [selectedDevices, onSelectionChange]
  )

  const allSelected =
    devices.length > 0 && devices.every(device => selectedDevices.has(device.id))

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="panel-header py-2 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-semibold">Devices</h3>
              <p className="text-panel-header-muted text-xs">
                Select devices to synchronize with Nautobot
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-current hover:bg-card/20 text-xs h-6"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Clear Filters
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReloadDevices}
              className="text-current hover:bg-card/20 text-xs h-6"
              disabled={isReloading}
            >
              <Search className="h-3 w-3 mr-1" />
              Load Devices
            </Button>
          </div>
        </div>
      </div>

      <div className="p-0">
        {/* Filters */}
        <DevicesFilters
          filters={filters}
          roleFilters={roleFilters}
          onRoleFiltersChange={onRoleFiltersChange}
          filterOptions={filterOptions}
          locations={locations}
          onFilterChange={onFilterChange}
        />

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b">
              <tr>
                <th className="pl-4 pr-2 py-3 w-8 text-left">
                  <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} />
                </th>
                <th className="pl-4 pr-2 py-3 w-48 text-left text-xs font-medium text-muted-foreground uppercase">
                  Device Name
                </th>
                <th className="px-4 py-3 w-32 text-left text-xs font-medium text-muted-foreground uppercase">
                  IP Address
                </th>
                <th className="pl-8 pr-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Role
                </th>
                <th className="pl-4 pr-2 py-3 w-40 text-left text-xs font-medium text-muted-foreground uppercase">
                  Location
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {devices.map((device, index) => (
                <tr
                  key={device.id}
                  className={index % 2 === 0 ? 'bg-card' : 'bg-muted/50'}
                >
                  <td className="pl-4 pr-2 py-3 w-8 text-left">
                    <Checkbox
                      checked={selectedDevices.has(device.id)}
                      onCheckedChange={checked =>
                        handleDeviceSelection(device.id, checked as boolean)
                      }
                    />
                  </td>
                  <td className="pl-4 pr-2 py-3 w-48 text-sm font-medium text-foreground">
                    {device.name || 'Unnamed Device'}
                  </td>
                  <td className="px-4 py-3 w-32 text-sm text-muted-foreground">
                    {device.primary_ip4?.address || 'N/A'}
                  </td>
                  <td className="pl-8 pr-4 py-3 text-sm text-muted-foreground">
                    {device.role?.name || 'Unknown'}
                  </td>
                  <td className="pl-4 pr-2 py-3 w-40 text-sm text-muted-foreground">
                    {device.location?.name || 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const variant = getStatusBadgeVariant(
                        device.status?.name || 'unknown'
                      )
                      return variant === 'neutral' ? (
                        <Badge variant="secondary">
                          {device.status?.name || 'Unknown'}
                        </Badge>
                      ) : (
                        <StatusBadge variant={variant}>
                          {device.status?.name || 'Unknown'}
                        </StatusBadge>
                      )
                    })()}
                  </td>
                </tr>
              ))}
              {devices.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No devices found matching the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <DevicesPagination
          pagination={pagination}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  )
}
