import { useState, useRef, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import type { LocationItem } from '../types'
import { filterLocations } from '../utils/location-utils'
import { EMPTY_ARRAY } from '../utils/constants'

interface LocationSearchDropdownProps {
  locations: LocationItem[]
  value: string
  onChange: (locationId: string) => void
  placeholder?: string
  disabled?: boolean
}

export function LocationSearchDropdown({
  locations = EMPTY_ARRAY as LocationItem[],
  value,
  onChange,
  placeholder = 'Search location...',
  disabled = false,
}: LocationSearchDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Get display value from selected location
  const displayValue = useMemo(() => {
    if (!value) return ''
    const selectedLocation = locations.find(loc => loc.id === value)
    return selectedLocation?.hierarchicalPath || selectedLocation?.name || ''
  }, [value, locations])

  // Use display value as search query - initialize lazily
  const [searchQuery, setSearchQuery] = useState(() => displayValue)
  const [isUserEditing, setIsUserEditing] = useState(false)

  // Update search query when value changes externally (not from user input)
  useEffect(() => {
    if (!isUserEditing && displayValue !== searchQuery) {
      queueMicrotask(() => {
        setSearchQuery(displayValue)
      })
    }
  }, [displayValue, isUserEditing, searchQuery])

  // Filter locations based on search query
  const filteredLocations = useMemo(
    () => filterLocations(locations, searchQuery),
    [locations, searchQuery]
  )

  // Update dropdown position when it opens
  useEffect(() => {
    if (showDropdown && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [showDropdown])

  // Handle location selection
  const handleSelect = (location: LocationItem) => {
    setSearchQuery(location.hierarchicalPath || location.name)
    setIsUserEditing(false)
    onChange(location.id)
    setShowDropdown(false)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.location-dropdown-container')) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
    return undefined
  }, [showDropdown])

  return (
    <div className="relative location-dropdown-container" ref={containerRef}>
      <Input
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value)
          setIsUserEditing(true)
          setShowDropdown(true)
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setIsUserEditing(false)}
        disabled={disabled}
        className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
      />
      {showDropdown && !disabled && (
        <div
          className="fixed z-[9999] mt-1 bg-white border border-gray-300 rounded-md shadow-xl max-h-60 overflow-y-auto min-w-[300px]"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width || 'auto',
          }}
        >
          {filteredLocations.length > 0 ? (
            filteredLocations.map((location) => (
              <div
                key={location.id}
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                onClick={() => handleSelect(location)}
              >
                {location.hierarchicalPath}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500 italic">No locations found</div>
          )}
        </div>
      )}
    </div>
  )
}
