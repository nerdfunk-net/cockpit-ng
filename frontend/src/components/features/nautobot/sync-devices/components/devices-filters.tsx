'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'
import type { TableFilters, DropdownOption, LocationItem } from '../types'

const INPUT_CLASSES =
  'h-8 text-xs border-2 bg-card border-border hover:border-muted-foreground/50 focus:border-primary'

interface DevicesFiltersProps {
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
}

interface DropdownPosition {
  top: number
  left: number
  width: number | string
}

const EMPTY_LOCATIONS: LocationItem[] = []

export function DevicesFilters({
  filters,
  roleFilters,
  onRoleFiltersChange,
  filterOptions,
  locations,
  onFilterChange,
}: DevicesFiltersProps) {
  const locationContainerRef = useRef<HTMLDivElement | null>(null)
  const [locationSearch, setLocationSearch] = useState<string>('')
  const [showLocationDropdown, setShowLocationDropdown] = useState<boolean>(false)
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({
    top: 0,
    left: 0,
    width: 'auto',
  })

  // Derive filtered locations from search and locations prop
  const locationFiltered = useMemo(() => {
    const baseLocations = locations.length > 0 ? locations : EMPTY_LOCATIONS
    if (!locationSearch.trim()) {
      return baseLocations
    }
    return baseLocations.filter(l =>
      (l.hierarchicalPath || '').toLowerCase().includes(locationSearch.toLowerCase())
    )
  }, [locations, locationSearch])

  // Update dropdown position when it opens
  useEffect(() => {
    if (showLocationDropdown && locationContainerRef.current) {
      const rect = locationContainerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [showLocationDropdown])

  // Click outside handler to close dropdown
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!locationContainerRef.current) return
      if (!locationContainerRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleLocationSearch = useCallback((value: string) => {
    setLocationSearch(value)
    setShowLocationDropdown(true)
  }, [])

  const handleLocationSelect = useCallback(
    (loc: LocationItem) => {
      setLocationSearch(loc.hierarchicalPath || loc.name)
      setShowLocationDropdown(false)
      onFilterChange('location', loc.name)
    },
    [onFilterChange]
  )

  const handleDeselectAllRoles = useCallback(() => {
    const resetRoleFilters: Record<string, boolean> = {}
    filterOptions.roles.forEach(role => {
      resetRoleFilters[role.name] = false
    })
    onRoleFiltersChange(resetRoleFilters)
  }, [filterOptions.roles, onRoleFiltersChange])

  const selectedRoleCount = Object.values(roleFilters).filter(Boolean).length

  return (
    <div className="bg-muted border-b">
      <div className="overflow-x-auto">
        <table className="w-full">
          <tbody>
            <tr>
              {/* Empty cell for checkbox column */}
              <td className="pl-4 pr-2 py-3 w-8 text-left"></td>

              {/* Device Name Filter */}
              <td className="pl-4 pr-2 py-3 w-48">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Device Name
                  </Label>
                  <Input
                    placeholder="Filter by name..."
                    value={filters.deviceName}
                    onChange={e => onFilterChange('deviceName', e.target.value)}
                    className={INPUT_CLASSES}
                  />
                </div>
              </td>

              {/* IP Address Filter */}
              <td className="px-4 py-3 w-32">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">
                    IP Address
                  </Label>
                  <Input
                    placeholder="Filter by IP..."
                    value={filters.ipAddress}
                    onChange={e => onFilterChange('ipAddress', e.target.value)}
                    className={INPUT_CLASSES}
                  />
                </div>
              </td>

              {/* Role Filter - Multi-select with checkboxes */}
              <td className="pl-8 pr-4 py-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Role</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs justify-between w-full"
                      >
                        Role Filter
                        {selectedRoleCount < filterOptions.roles.length && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                            {selectedRoleCount}
                          </Badge>
                        )}
                        <ChevronDown className="h-4 w-4 ml-auto" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuLabel className="text-xs">
                        Filter by Role
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive hover:bg-error"
                        onSelect={handleDeselectAllRoles}
                      >
                        Deselect all
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {filterOptions.roles.map(role => (
                        <DropdownMenuCheckboxItem
                          key={role.id}
                          checked={roleFilters[role.name] || false}
                          onCheckedChange={checked =>
                            onRoleFiltersChange({
                              ...roleFilters,
                              [role.name]: !!checked,
                            })
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
                  <Label className="text-xs font-medium text-muted-foreground">Location</Label>
                  <div className="relative">
                    <Input
                      placeholder="Filter by location..."
                      value={locationSearch}
                      onChange={e => handleLocationSearch(e.target.value)}
                      onFocus={() => setShowLocationDropdown(true)}
                      className={INPUT_CLASSES}
                    />
                    {showLocationDropdown && (
                      <div
                        className="fixed z-[9999] mt-1 bg-popover border rounded-md shadow-xl max-h-60 overflow-y-auto min-w-[300px]"
                        style={{
                          top: dropdownPosition.top,
                          left: dropdownPosition.left,
                          width: dropdownPosition.width,
                        }}
                      >
                        {locationFiltered.length > 0 ? (
                          locationFiltered.map(loc => (
                            <div
                              key={loc.id}
                              className="px-3 py-2 hover:bg-muted cursor-pointer text-sm border-b border-border/50 last:border-b-0"
                              onClick={() => handleLocationSelect(loc)}
                            >
                              {loc.hierarchicalPath}
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-muted-foreground italic">
                            No locations found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </td>

              {/* Status Filter */}
              <td className="px-4 py-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={value => onFilterChange('status', value)}
                  >
                    <SelectTrigger className={INPUT_CLASSES}>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {filterOptions.statuses.map(status => (
                        <SelectItem key={status.id} value={status.name}>
                          {status.name}
                        </SelectItem>
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
