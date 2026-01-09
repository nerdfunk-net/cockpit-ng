import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ChevronDown } from 'lucide-react'
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

interface DeviceFiltersRowProps {
  filters: {
    name: string
  }
  roleFilters: Record<string, boolean>
  statusFilters: Record<string, boolean>
  checkmkStatusFilters: {
    equal: boolean
    diff: boolean
    missing: boolean
  }
  selectedLocation: string
  availableRoles: string[]
  availableStatuses: string[]
  availableLocations: string[]
  onFilterChange: (column: string, value: string) => void
  onRoleFiltersChange: (filters: Record<string, boolean>) => void
  onStatusFiltersChange: (filters: Record<string, boolean>) => void
  onCheckmkStatusFiltersChange: (filters: { equal: boolean; diff: boolean; missing: boolean }) => void
  onLocationChange: (location: string) => void
  onPageChange: (page: number) => void
}

export function DeviceFiltersRow({
  filters,
  roleFilters,
  statusFilters,
  checkmkStatusFilters,
  selectedLocation,
  availableRoles,
  availableStatuses,
  availableLocations,
  onFilterChange,
  onRoleFiltersChange,
  onStatusFiltersChange,
  onCheckmkStatusFiltersChange,
  onLocationChange,
  onPageChange
}: DeviceFiltersRowProps) {
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
                    value={filters.name}
                    onChange={(e) => onFilterChange('name', e.target.value)}
                    className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                  />
                </div>
              </td>

              {/* Role Filter */}
              <td className="px-4 py-3 w-32">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Role</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs justify-between w-full">
                        Role Filter
                        {Object.values(roleFilters).filter(Boolean).length < availableRoles.length && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                            {Object.values(roleFilters).filter(Boolean).length}
                          </Badge>
                        )}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-32">
                      <DropdownMenuLabel className="text-xs">Filter by Role</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer text-red-600 hover:bg-red-50"
                        onSelect={() => {
                          const resetRoleFilters = availableRoles.reduce((acc: Record<string, boolean>, role: string) => {
                            acc[role] = false
                            return acc
                          }, {})
                          onRoleFiltersChange(resetRoleFilters)
                          onPageChange(1)
                        }}
                      >
                        Deselect all
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {availableRoles.map((role: string) => (
                        <DropdownMenuCheckboxItem
                          key={role}
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
              </td>

              {/* Status Filter */}
              <td className="px-4 py-3 w-28">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Status</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs justify-between w-full">
                        Status Filter
                        {Object.values(statusFilters).filter(Boolean).length < availableStatuses.length && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                            {Object.values(statusFilters).filter(Boolean).length}
                          </Badge>
                        )}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-32">
                      <DropdownMenuLabel className="text-xs">Filter by Status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer text-red-600 hover:bg-red-50"
                        onSelect={() => {
                          const resetStatusFilters = availableStatuses.reduce((acc: Record<string, boolean>, status: string) => {
                            acc[status] = false
                            return acc
                          }, {})
                          onStatusFiltersChange(resetStatusFilters)
                          onPageChange(1)
                        }}
                      >
                        Deselect all
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {availableStatuses.map((status: string) => (
                        <DropdownMenuCheckboxItem
                          key={status}
                          checked={statusFilters[status] || false}
                          onCheckedChange={(checked) =>
                            onStatusFiltersChange({ ...statusFilters, [status]: !!checked })
                          }
                        >
                          {status}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </td>

              {/* Location Filter - searchable dropdown */}
              <td className="px-4 py-3 w-40">
                <SearchableDropdown
                  label="Location"
                  placeholder="Filter by location..."
                  options={availableLocations}
                  value={selectedLocation}
                  onSelect={onLocationChange}
                  onClear={() => onLocationChange('')}
                />
              </td>

              {/* CheckMK Status Filter */}
              <td className="px-4 py-3 w-32">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">CheckMK Status</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs justify-between w-full">
                        Status Filter
                        {Object.values(checkmkStatusFilters).filter(Boolean).length < 3 && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                            {Object.values(checkmkStatusFilters).filter(Boolean).length}
                          </Badge>
                        )}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuLabel className="text-xs">Filter by Status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={checkmkStatusFilters.equal}
                        onCheckedChange={(checked) =>
                          onCheckmkStatusFiltersChange({ ...checkmkStatusFilters, equal: !!checked })
                        }
                      >
                        Equal
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={checkmkStatusFilters.diff}
                        onCheckedChange={(checked) =>
                          onCheckmkStatusFiltersChange({ ...checkmkStatusFilters, diff: !!checked })
                        }
                      >
                        Diff
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={checkmkStatusFilters.missing}
                        onCheckedChange={(checked) =>
                          onCheckmkStatusFiltersChange({ ...checkmkStatusFilters, missing: !!checked })
                        }
                      >
                        Missing
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </td>

              {/* Empty cell for actions column */}
              <td className="px-4 py-3"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
