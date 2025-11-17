'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { LocationItem } from '../types'

const EMPTY_LOCATIONS: LocationItem[] = []

interface LocationSelectorProps {
  locations: LocationItem[]
  selectedLocationId: string
  value: string
  onChange: (location: LocationItem) => void
  label?: string
  placeholder?: string
  required?: boolean
}

export function LocationSelector({
  locations = EMPTY_LOCATIONS,
  selectedLocationId,
  onChange,
  label = 'Location',
  placeholder = 'Search location...',
  required = true
}: LocationSelectorProps) {
  const [locationSearch, setLocationSearch] = useState<string>('')
  const [locationFiltered, setLocationFiltered] = useState<LocationItem[]>(locations)
  const [showDropdown, setShowDropdown] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Initialize filtered locations when locations prop changes
  useEffect(() => {
    setLocationFiltered(locations)
  }, [locations])

  // Set search value when a location is selected
  useEffect(() => {
    if (selectedLocationId && locations.length > 0) {
      const selected = locations.find(loc => loc.id === selectedLocationId)
      if (selected) {
        setLocationSearch(selected.hierarchicalPath || selected.name)
      }
    }
  }, [selectedLocationId, locations])

  // Click outside handler to close dropdown
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleSearchChange = (query: string) => {
    setLocationSearch(query)
    if (!query.trim()) {
      setLocationFiltered(locations)
    } else {
      setLocationFiltered(
        locations.filter(l =>
          (l.hierarchicalPath || l.name || '').toLowerCase().includes(query.toLowerCase())
        )
      )
    }
    setShowDropdown(true)
  }

  const handleLocationSelect = (location: LocationItem) => {
    setLocationSearch(location.hierarchicalPath || location.name)
    setShowDropdown(false)
    onChange(location)
  }

  return (
    <div className="space-y-1" ref={containerRef}>
      <Label className="text-[11px] font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={locationSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          className={`h-7 text-xs border-2 ${
            selectedLocationId
              ? 'bg-blue-50 border-blue-500'
              : 'bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500'
          }`}
        />
        {showDropdown && (
          <div
            className="absolute z-[9999] mt-1 bg-white border border-gray-300 rounded-md shadow-xl max-h-60 overflow-y-auto w-full"
          >
            {locationFiltered.length > 0 ? (
              locationFiltered.map(loc => (
                <div
                  key={loc.id}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-gray-100 last:border-b-0"
                  onClick={() => handleLocationSelect(loc)}
                >
                  {loc.hierarchicalPath || loc.name}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-gray-500 italic">No locations found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
