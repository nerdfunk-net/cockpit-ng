import { useState, useCallback, useRef, useEffect } from 'react'
import type { RefObject } from 'react'
import { useApi } from '@/hooks/use-api'
import type { LocationItem } from '@/types/features/nautobot/offboard'
import { buildLocationHierarchy } from '@/utils/features/nautobot/offboard/location-helpers'

interface UseLocationFilterReturn {
  locationsList: LocationItem[]
  locationFiltered: LocationItem[]
  locationSearch: string
  showLocationDropdown: boolean
  selectedLocationId: string
  locationContainerRef: RefObject<HTMLDivElement>
  setLocationSearch: (search: string) => void
  setShowLocationDropdown: (show: boolean) => void
  handleLocationSearchChange: (search: string) => void
  handleLocationSelect: (location: LocationItem) => void
  loadLocations: () => Promise<void>
}

export function useLocationFilter(): UseLocationFilterReturn {
  const { apiCall } = useApi()
  const [locationsList, setLocationsList] = useState<LocationItem[]>([])
  const [locationFiltered, setLocationFiltered] = useState<LocationItem[]>([])
  const [locationSearch, setLocationSearch] = useState<string>('')
  const [showLocationDropdown, setShowLocationDropdown] = useState<boolean>(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const locationContainerRef = useRef<HTMLDivElement>(null!) // Non-null assertion

  const loadLocations = useCallback(async () => {
    try {
      const data = await apiCall<LocationItem[]>('nautobot/locations')
      const arr = Array.isArray(data) ? data : (data || [])
      const processed = buildLocationHierarchy(arr)
      setLocationsList(processed)
      setLocationFiltered(processed)
    } catch (error) {
      console.error('Error loading locations:', error)
      setLocationsList([])
      setLocationFiltered([])
    }
  }, [apiCall])

  const handleLocationSearchChange = useCallback((query: string) => {
    setLocationSearch(query)
    if (!query.trim()) {
      setLocationFiltered(locationsList)
    } else {
      setLocationFiltered(
        locationsList.filter(l => 
          (l.hierarchicalPath || '').toLowerCase().includes(query.toLowerCase())
        )
      )
    }
    setShowLocationDropdown(true)
  }, [locationsList])

  const handleLocationSelect = useCallback((location: LocationItem) => {
    setSelectedLocationId(location.id)
    setLocationSearch(location.hierarchicalPath || location.name)
    setShowLocationDropdown(false)
  }, [])

  // Click outside handler
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

  return {
    locationsList,
    locationFiltered,
    locationSearch,
    showLocationDropdown,
    selectedLocationId,
    locationContainerRef,
    setLocationSearch,
    setShowLocationDropdown,
    handleLocationSearchChange,
    handleLocationSelect,
    loadLocations
  }
}
