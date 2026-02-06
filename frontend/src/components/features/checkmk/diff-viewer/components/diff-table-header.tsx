import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import type { SystemFilter } from '@/types/features/checkmk/diff-viewer'

interface DiffTableHeaderProps {
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
  onDeviceNameFilterChange: (value: string) => void
  onRoleFiltersChange: (value: Record<string, boolean>) => void
  onLocationChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  onSystemFilterChange: (value: SystemFilter) => void
}

export function DiffTableHeader({
  deviceNameFilter,
  roleFilters,
  selectedLocation,
  statusFilter,
  systemFilter,
  filterOptions,
  onDeviceNameFilterChange,
  onRoleFiltersChange,
  onLocationChange,
  onStatusFilterChange,
  onSystemFilterChange,
}: DiffTableHeaderProps) {
  return (
    <thead>
      <tr className="border-b bg-gray-50">
        <th className="pl-4 pr-2 py-3 w-56 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>Device Name</div>
            <Input
              placeholder="Search..."
              value={deviceNameFilter}
              onChange={(e) => onDeviceNameFilterChange(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </th>
        <th className="px-4 py-3 w-36 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>IP Address</div>
            <div className="h-8" />
          </div>
        </th>
        <th className="px-4 py-3 w-40 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              Role
              {Object.values(roleFilters).some(v => v) && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                  {Object.values(roleFilters).filter(Boolean).length}
                </Badge>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-full text-xs justify-between">
                  Role
                  <ChevronDown className="h-4 w-4 ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuLabel className="text-xs">Filter by Role</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 hover:bg-red-50"
                  onSelect={() => {
                    const resetFilters: Record<string, boolean> = {}
                    filterOptions.roles.forEach(role => { resetFilters[role] = false })
                    onRoleFiltersChange(resetFilters)
                  }}
                >
                  Deselect all
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {Array.from(filterOptions.roles).sort().map((role) => (
                  <DropdownMenuCheckboxItem
                    key={`diff-role-${role}`}
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
        </th>
        <th className="px-4 py-3 w-48 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>Location</div>
            <Select value={selectedLocation} onValueChange={onLocationChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Array.from(filterOptions.locations).sort().map((loc) => (
                  <SelectItem key={`diff-loc-${loc}`} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </th>
        <th className="px-4 py-3 w-36 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>Status</div>
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Array.from(filterOptions.statuses).sort().map((status) => (
                  <SelectItem key={`diff-status-${status}`} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </th>
        <th className="px-4 py-3 w-44 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>System</div>
            <Select value={systemFilter} onValueChange={(v) => onSystemFilterChange(v as SystemFilter)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="both">Both Systems</SelectItem>
                <SelectItem value="nautobot">Nautobot Only</SelectItem>
                <SelectItem value="checkmk">CheckMK Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </th>
        <th className="px-4 py-3 w-36 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>CheckMK Diff</div>
            <div className="h-8" />
          </div>
        </th>
        <th className="px-4 py-3 w-28 text-left text-xs font-medium text-gray-600 uppercase">
          <div className="space-y-1">
            <div>Actions</div>
            <div className="h-8" />
          </div>
        </th>
      </tr>
    </thead>
  )
}
