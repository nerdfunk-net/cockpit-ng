import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import type { TableFilters, DropdownOption, LocationItem } from '@/types/features/nautobot/offboard'
import type { RefObject } from 'react'

interface DeviceFiltersProps {
  filters: TableFilters
  roleFilters: Record<string, boolean>
  dropdownOptions: {
    roles: DropdownOption[]
    locations: DropdownOption[]
    statuses: DropdownOption[]
  }
  locationSearch: string
  locationFiltered: LocationItem[]
  showLocationDropdown: boolean
  locationContainerRef: RefObject<HTMLDivElement>
  onFilterChange: (field: keyof TableFilters, value: string) => void
  onRoleFiltersChange: (filters: Record<string, boolean>) => void
  onLocationSearchChange: (search: string) => void
  onLocationSelect: (location: LocationItem) => void
  onLocationDropdownToggle: (show: boolean) => void
}

export function DeviceFilters({
  filters,
  roleFilters,
  dropdownOptions,
  locationSearch,
  locationFiltered,
  showLocationDropdown,
  locationContainerRef,
  onFilterChange,
  onRoleFiltersChange,
  onLocationSearchChange,
  onLocationSelect,
  onLocationDropdownToggle
}: DeviceFiltersProps) {
  return (
    <div className="bg-gray-50 border-b">
      <div className="overflow-x-auto">
        <table className="w-full">
          <tbody>
            <tr>
              {/* Empty cell for checkbox column */}
              <td className="pl-4 pr-2 py-3 w-8 text-left"></td>

              {/* Device Name Filter */}
              <td className="pl-4 pr-2 py-3 w-48">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Device Name</Label>
                  <Input
                    placeholder="Filter by name..."
                    value={filters.deviceName}
                    onChange={(e) => onFilterChange('deviceName', e.target.value)}
                    className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                  />
                </div>
              </td>

              {/* IP Address Filter */}
              <td className="px-4 py-3 w-32">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">IP Address</Label>
                  <Input
                    placeholder="Filter by IP..."
                    value={filters.ipAddress}
                    onChange={(e) => onFilterChange('ipAddress', e.target.value)}
                    className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                  />
                </div>
              </td>

              {/* Role Filter - Multi-select with checkboxes */}
              <td className="pl-8 pr-4 py-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Role</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs justify-between w-full">
                        Role Filter
                        {Object.values(roleFilters).filter(Boolean).length < dropdownOptions.roles.length && (
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
                          dropdownOptions.roles.forEach(role => {
                            resetRoleFilters[role.name] = false
                          })
                          onRoleFiltersChange(resetRoleFilters)
                        }}
                      >
                        Deselect all
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {dropdownOptions.roles.map((role) => (
                        <DropdownMenuCheckboxItem
                          key={role.id}
                          checked={roleFilters[role.name] || false}
                          onCheckedChange={(checked) =>
                            onRoleFiltersChange({ ...roleFilters, [role.name]: !!checked })
                          }
                        >
                          {role.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </td>

              {/* Location Filter - hierarchical searchable dropdown */}
              <td className="pl-4 pr-2 py-3 w-40">
                <div className="space-y-1 relative" ref={locationContainerRef}>
                  <Label className="text-xs font-medium text-gray-600">Location</Label>
                  <div>
                    <Input
                      placeholder="Filter by location..."
                      value={locationSearch}
                      onChange={(e) => onLocationSearchChange(e.target.value)}
                      onFocus={() => onLocationDropdownToggle(true)}
                      className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                    />
                    {showLocationDropdown && (
                      <div className="absolute z-50 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {locationFiltered.length > 0 ? (
                          locationFiltered.map(loc => (
                            <div
                              key={loc.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                              onClick={() => {
                                onLocationSelect(loc)
                                onFilterChange('location', loc.name)
                              }}
                            >
                              {loc.hierarchicalPath}
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500 italic">No locations found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </td>

              {/* Status Filter */}
              <td className="px-4 py-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Status</Label>
                  <Select value={filters.status} onValueChange={(value) => onFilterChange('status', value)}>
                    <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {dropdownOptions.statuses.map(status => (
                        <SelectItem key={status.id} value={status.name}>{status.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
