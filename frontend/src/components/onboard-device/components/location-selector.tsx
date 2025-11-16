'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'
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
  placeholder = 'Select location...',
  required = true
}: LocationSelectorProps) {
  const selectedLocation = locations.find(loc => loc.id === selectedLocationId)
  const displayValue = selectedLocation?.hierarchicalPath || selectedLocation?.name || placeholder

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={`w-full justify-between h-10 text-sm border-2 ${
              selectedLocationId
                ? 'bg-blue-50 border-blue-500'
                : 'bg-white border-gray-300 hover:border-gray-400'
            }`}
          >
            <span className="truncate">{displayValue}</span>
            <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[400px] max-h-[400px] overflow-y-auto">
          {locations.map(location => (
            <DropdownMenuItem
              key={location.id}
              onClick={() => onChange(location)}
              className={`cursor-pointer text-sm ${
                location.id === selectedLocationId ? 'bg-blue-50 font-medium' : ''
              }`}
            >
              {location.hierarchicalPath || location.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
