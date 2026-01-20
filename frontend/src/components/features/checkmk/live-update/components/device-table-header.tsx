import { ChevronDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { SearchableDropdown } from '@/components/shared/searchable-dropdown'
import type { FilterOptions } from '@/types/features/checkmk/live-update'

interface DeviceTableHeaderProps {
  hasSelectedDevices: boolean
  allSelected: boolean
  deviceNameFilter: string
  roleFilters: Record<string, boolean>
  selectedLocation: string
  statusFilter: string
  filterOptions: FilterOptions
  onSelectAll: (checked: boolean) => void
  onDeviceNameFilterChange: (value: string) => void
  onRoleFiltersChange: (filters: Record<string, boolean>) => void
  onLocationChange: (location: string) => void
  onStatusFilterChange: (status: string) => void
  onSort?: (column: string) => void
}

export function DeviceTableHeader({
  allSelected,
  deviceNameFilter,
  roleFilters,
  selectedLocation,
  statusFilter,
  filterOptions,
  onSelectAll,
  onDeviceNameFilterChange,
  onRoleFiltersChange,
  onLocationChange,
  onStatusFilterChange
}: DeviceTableHeaderProps) {
  return (
    <thead className="bg-gray-100 border-b">
      <tr>
        <th className="pl-4 pr-2 py-3 w-8 text-left">
          <Checkbox
            checked={allSelected}
            onCheckedChange={onSelectAll}
            aria-label="Select all devices"
          />
        </th>
        <th className="pl-4 pr-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>Device Name</div>
            <div>
              <Input
                placeholder="Type 3+ chars for backend search..."
                value={deviceNameFilter}
                onChange={(e) => onDeviceNameFilterChange(e.target.value)}
                className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
              />
            </div>
          </div>
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>IP Address</div>
            <div className="h-8" />
          </div>
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>Role</div>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs justify-between w-full">
                    Role Filter
                    {Object.values(roleFilters).filter(Boolean).length < filterOptions.roles.size && Object.keys(roleFilters).length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                        {Object.values(roleFilters).filter(Boolean).length}
                      </Badge>
                    )}
                    <ChevronDown className="h-4 w-4 ml-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuLabel className="text-xs">Filter by Role</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600 hover:bg-red-50"
                    onSelect={() => {
                      const resetRoleFilters: Record<string, boolean> = {}
                      filterOptions.roles.forEach(role => {
                        resetRoleFilters[role] = false
                      })
                      onRoleFiltersChange(resetRoleFilters)
                    }}
                  >
                    Deselect all
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {Array.from(filterOptions.roles).sort().map((role) => (
                    <DropdownMenuCheckboxItem
                      key={`live-update-role-${role}`}
                      checked={roleFilters[role] || false}
                      onCheckedChange={(checked) =>
                        onRoleFiltersChange({ ...roleFilters, [role]: !!checked })
                      }
                    >
                      {role}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </th>
        <th className="pl-12 pr-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>Location</div>
            <div>
              <SearchableDropdown
                label=""
                placeholder="Filter by location..."
                options={Array.from(filterOptions.locations).sort()}
                value={selectedLocation}
                onSelect={onLocationChange}
                onClear={() => onLocationChange('')}
              />
            </div>
          </div>
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>Status</div>
            <div>
              <Select value={statusFilter || "all"} onValueChange={(value) => onStatusFilterChange(value === "all" ? "" : value)}>
                <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Array.from(filterOptions.statuses).sort().map(status => (
                    <SelectItem key={`live-update-status-${status}`} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </th>
        <th className="pl-12 pr-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>CheckMK</div>
            <div className="h-8" />
          </div>
        </th>
        <th className="pl-16 pr-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>Actions</div>
            <div className="h-8" />
          </div>
        </th>
      </tr>
    </thead>
  )
}
