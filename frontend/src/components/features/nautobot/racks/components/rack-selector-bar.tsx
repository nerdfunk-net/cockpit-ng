import { useCallback, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSearchableDropdown } from '../../add-device/hooks/use-searchable-dropdown'
import { SearchableDropdownInput } from '../../add-device/components/searchable-dropdown-input'
import { buildLocationHierarchy } from '../../add-device/utils'
import { MODE_OPTIONS } from '../constants'
import type { LocationItem, RackItem } from '../../add-device/types'
import type { RackMode } from '../types'

interface RackSelectorBarProps {
  locations: LocationItem[]
  selectedLocationId: string
  onSelectLocation: (id: string) => void
  racks: RackItem[]
  selectedRackId: string
  onSelectRack: (id: string) => void
  mode: RackMode
  onModeChange: (mode: RackMode) => void
  isLoadingRacks: boolean
}

export function RackSelectorBar({
  locations,
  selectedLocationId,
  onSelectLocation,
  racks,
  selectedRackId,
  onSelectRack,
  mode,
  onModeChange,
  isLoadingRacks,
}: RackSelectorBarProps) {
  const hierarchicalLocations = useMemo(
    () => buildLocationHierarchy(locations),
    [locations]
  )

  const locationFilterPredicate = useCallback(
    (loc: LocationItem, query: string) =>
      (loc.hierarchicalPath || loc.name).toLowerCase().includes(query),
    []
  )

  const rackFilterPredicate = useCallback(
    (rack: RackItem, query: string) => rack.name.toLowerCase().includes(query),
    []
  )

  const locationDropdown = useSearchableDropdown({
    items: hierarchicalLocations,
    selectedId: selectedLocationId,
    onSelect: onSelectLocation,
    getDisplayText: (loc) => loc.hierarchicalPath || loc.name,
    filterPredicate: locationFilterPredicate,
  })

  const rackDropdown = useSearchableDropdown({
    items: racks,
    selectedId: selectedRackId,
    onSelect: onSelectRack,
    getDisplayText: (rack) => rack.name,
    filterPredicate: rackFilterPredicate,
  })

  return (
    <div className="flex flex-wrap gap-4 items-end">
      {/* Location selector */}
      <div className="flex-1 min-w-[220px]">
        <SearchableDropdownInput
          id="rack-location"
          label="Location"
          placeholder="Search location..."
          required
          inputClassName="border-gray-400 bg-white shadow-sm"
          dropdownState={locationDropdown}
          renderItem={(loc) => (
            <div className="flex flex-col">
              <span className="font-medium text-sm">{loc.name}</span>
              {loc.hierarchicalPath && loc.hierarchicalPath !== loc.name && (
                <span className="text-xs text-muted-foreground">{loc.hierarchicalPath}</span>
              )}
            </div>
          )}
          getItemKey={(loc) => loc.id}
        />
      </div>

      {/* Rack selector */}
      <div className="flex-1 min-w-[200px]">
        <SearchableDropdownInput
          id="rack-select"
          label="Rack"
          inputClassName="border-gray-400 bg-white shadow-sm"
          placeholder={
            !selectedLocationId
              ? 'Select a location first'
              : isLoadingRacks
              ? 'Loading racks...'
              : racks.length === 0
              ? 'No racks found'
              : 'Search rack...'
          }
          disabled={!selectedLocationId || isLoadingRacks}
          dropdownState={rackDropdown}
          renderItem={(rack) => (
            <div className="flex flex-col">
              <span className="font-medium text-sm">{rack.name}</span>
              {rack.u_height && (
                <span className="text-xs text-muted-foreground">{rack.u_height}U</span>
              )}
            </div>
          )}
          getItemKey={(rack) => rack.id}
        />
      </div>

      {/* Mode selector */}
      <div className="min-w-[180px]">
        <div className="space-y-1">
          <Label htmlFor="rack-mode" className="text-xs font-medium">
            Mode
          </Label>
          <Select
            value={mode}
            onValueChange={(val) => onModeChange(val as RackMode)}
          >
            <SelectTrigger id="rack-mode" className="border-gray-400 bg-white shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
