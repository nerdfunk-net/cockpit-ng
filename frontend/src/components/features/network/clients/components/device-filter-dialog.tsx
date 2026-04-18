'use client'

import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useState, useCallback } from 'react'
import { Filter } from 'lucide-react'
import { useSearchableDropdown } from '@/components/features/nautobot/add-device/hooks/use-searchable-dropdown'
import { SearchableDropdownInput } from '@/components/features/nautobot/add-device/components/searchable-dropdown-input'
import { buildLocationHierarchy } from '@/components/features/nautobot/add-device/utils'
import type { LocationItem } from '@/components/features/nautobot/add-device/types'
import type { DeviceFilter } from '@/hooks/queries/use-clients-query'

interface NamedItem {
  id: string
  name: string
}

interface DeviceTypeItem {
  id: string
  model: string
}

const EMPTY_NAMED: NamedItem[] = []
const EMPTY_DEVICE_TYPES: DeviceTypeItem[] = []
const EMPTY_LOCATIONS: LocationItem[] = []

interface DeviceFilterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (filter: DeviceFilter) => void
}

export function DeviceFilterDialog({ open, onOpenChange, onApply }: DeviceFilterDialogProps) {
  const { apiCall } = useApi()

  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedStatusId, setSelectedStatusId] = useState('')
  const [selectedDeviceTypeId, setSelectedDeviceTypeId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')

  const rolesQuery = useQuery({
    queryKey: ['nautobot', 'filter-options', 'roles'],
    queryFn: async () => {
      const res = await apiCall<NamedItem[]>('nautobot/roles/devices', { method: 'GET' })
      return res ?? EMPTY_NAMED
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const statusesQuery = useQuery({
    queryKey: ['nautobot', 'filter-options', 'statuses'],
    queryFn: async () => {
      const res = await apiCall<NamedItem[]>('nautobot/statuses/device', { method: 'GET' })
      return res ?? EMPTY_NAMED
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const deviceTypesQuery = useQuery({
    queryKey: ['nautobot', 'filter-options', 'device-types'],
    queryFn: async () => {
      const res = await apiCall<DeviceTypeItem[]>('nautobot/device-types', { method: 'GET' })
      return res ?? EMPTY_DEVICE_TYPES
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const locationsQuery = useQuery({
    queryKey: ['nautobot', 'filter-options', 'locations'],
    queryFn: async () => {
      const res = await apiCall<LocationItem[]>('nautobot/locations', { method: 'GET' })
      const items = Array.isArray(res) ? res : EMPTY_LOCATIONS
      return buildLocationHierarchy(items)
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const roles = rolesQuery.data ?? EMPTY_NAMED
  const statuses = statusesQuery.data ?? EMPTY_NAMED
  const deviceTypes = deviceTypesQuery.data ?? EMPTY_DEVICE_TYPES
  const locations = locationsQuery.data ?? EMPTY_LOCATIONS

  const nameFilter = useCallback(
    (item: NamedItem, query: string) => item.name.toLowerCase().includes(query),
    []
  )
  const modelFilter = useCallback(
    (item: DeviceTypeItem, query: string) => item.model.toLowerCase().includes(query),
    []
  )
  const getName = useCallback((item: NamedItem) => item.name, [])
  const getModel = useCallback((item: DeviceTypeItem) => item.model, [])
  const getLocationText = useCallback(
    (item: LocationItem) => item.hierarchicalPath ?? item.name,
    []
  )
  const locationFilter = useCallback(
    (item: LocationItem, query: string) =>
      (item.hierarchicalPath ?? item.name).toLowerCase().includes(query),
    []
  )

  const roleDropdown = useSearchableDropdown({
    items: roles,
    selectedId: selectedRoleId,
    onSelect: setSelectedRoleId,
    getDisplayText: getName,
    filterPredicate: nameFilter,
  })

  const statusDropdown = useSearchableDropdown({
    items: statuses,
    selectedId: selectedStatusId,
    onSelect: setSelectedStatusId,
    getDisplayText: getName,
    filterPredicate: nameFilter,
  })

  const deviceTypeDropdown = useSearchableDropdown({
    items: deviceTypes,
    selectedId: selectedDeviceTypeId,
    onSelect: setSelectedDeviceTypeId,
    getDisplayText: getModel,
    filterPredicate: modelFilter,
  })

  const locationDropdown = useSearchableDropdown({
    items: locations,
    selectedId: selectedLocationId,
    onSelect: setSelectedLocationId,
    getDisplayText: getLocationText,
    filterPredicate: locationFilter,
  })

  function handleReset() {
    setSelectedRoleId('')
    setSelectedStatusId('')
    setSelectedDeviceTypeId('')
    setSelectedLocationId('')
  }

  function handleApply() {
    const filter: DeviceFilter = {}
    if (selectedRoleId) {
      const item = roles.find((r) => r.id === selectedRoleId)
      if (item) filter.role = item.name
    }
    if (selectedStatusId) {
      const item = statuses.find((s) => s.id === selectedStatusId)
      if (item) filter.status = item.name
    }
    if (selectedDeviceTypeId) {
      const item = deviceTypes.find((dt) => dt.id === selectedDeviceTypeId)
      if (item) filter.device_type = item.model
    }
    if (selectedLocationId) {
      const item = locations.find((l) => l.id === selectedLocationId)
      if (item) filter.location = item.name
    }
    onApply(filter)
    onOpenChange(false)
  }

  function handleCancel() {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[563px] p-0 gap-0 [&>[data-slot='dialog-close']]:text-white [&>[data-slot='dialog-close']]:opacity-80 [&>[data-slot='dialog-close']]:hover:opacity-100">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <DialogTitle className="text-sm font-medium text-white">Filter Devices</DialogTitle>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div className="grid grid-cols-2 gap-4">
            <SearchableDropdownInput
              id="filter-role"
              label="Role"
              placeholder="Search role..."
              dropdownState={roleDropdown}
              renderItem={(item) => <div>{item.name}</div>}
              getItemKey={(item) => item.id}
            />

            <SearchableDropdownInput
              id="filter-status"
              label="Status"
              placeholder="Search status..."
              dropdownState={statusDropdown}
              renderItem={(item) => <div>{item.name}</div>}
              getItemKey={(item) => item.id}
            />

            <SearchableDropdownInput
              id="filter-device-type"
              label="Device Type"
              placeholder="Search device type..."
              dropdownState={deviceTypeDropdown}
              renderItem={(item) => <div>{item.model}</div>}
              getItemKey={(item) => item.id}
            />

            <SearchableDropdownInput
              id="filter-location"
              label="Location"
              placeholder="Search location..."
              dropdownState={locationDropdown}
              renderItem={(item) => <div>{item.hierarchicalPath ?? item.name}</div>}
              getItemKey={(item) => item.id}
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-3 bg-white border-t border-gray-100">
          <Button variant="ghost" onClick={handleReset}>
            Reset
          </Button>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Use Filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
