'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

// Feature imports
import type { SyncProperties, Device, DropdownOption, LocationItem } from './types'
import {
  useDevicesQuery,
  useReloadDevices,
  useNamespacesQuery,
  useLocationsQuery,
  useNautobotDefaultsQuery,
  usePrefixStatusesQuery,
  useInterfaceStatusesQuery,
  useIPAddressStatusesQuery,
  useSyncDevicesMutation,
  useDevicesFilter,
} from './hooks'
import { buildLocationHierarchy } from './utils'
import { SyncPropertiesPanel, DevicesTable } from './components'

const INITIAL_SYNC_PROPERTIES: SyncProperties = {
  prefix_status: '',
  interface_status: '',
  ip_address_status: '',
  namespace: '',
  sync_options: [],
}

const EMPTY_DEVICES: Device[] = []
const EMPTY_DROPDOWN_OPTIONS: DropdownOption[] = []
const EMPTY_LOCATIONS: LocationItem[] = []

export function SyncDevicesPage() {
  const searchParams = useSearchParams()

  // TanStack Query hooks
  const { data: devices = EMPTY_DEVICES, isLoading: devicesLoading, isFetching } = useDevicesQuery()
  const { data: namespaces = EMPTY_DROPDOWN_OPTIONS } = useNamespacesQuery()
  const { data: locations = EMPTY_LOCATIONS } = useLocationsQuery()
  const { data: defaults } = useNautobotDefaultsQuery()
  const { data: prefixStatuses = EMPTY_DROPDOWN_OPTIONS } = usePrefixStatusesQuery()
  const { data: interfaceStatuses = EMPTY_DROPDOWN_OPTIONS } = useInterfaceStatusesQuery()
  const { data: ipAddressStatuses = EMPTY_DROPDOWN_OPTIONS } = useIPAddressStatusesQuery()

  const { reloadDevices } = useReloadDevices()
  const syncMutation = useSyncDevicesMutation()

  // Local state
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [syncProperties, setSyncProperties] = useState<SyncProperties>(INITIAL_SYNC_PROPERTIES)
  const [isReloading, setIsReloading] = useState(false)

  // Filter hook
  const {
    filters,
    roleFilters,
    setRoleFilters,
    filterOptions,
    paginatedDevices,
    pagination,
    handleFilterChange,
    clearAllFilters,
    setCurrentPage,
    setPageSize,
  } = useDevicesFilter(devices)

  // Process locations with hierarchy
  const processedLocations = useMemo(
    () => buildLocationHierarchy(locations),
    [locations]
  )

  // Apply URL filter
  useEffect(() => {
    const ipFilter = searchParams?.get('ip_filter')
    if (ipFilter && filters.ipAddress !== ipFilter) {
      handleFilterChange('ipAddress', ipFilter)
    }
  }, [searchParams, filters.ipAddress, handleFilterChange])

  // Apply defaults when loaded
  useEffect(() => {
    if (defaults) {
      setSyncProperties((prev) => ({
        ...prev,
        namespace: prev.namespace || defaults.namespace,
        prefix_status: prev.prefix_status || defaults.ip_prefix_status,
        interface_status: prev.interface_status || defaults.interface_status,
        ip_address_status: prev.ip_address_status || defaults.ip_address_status,
      }))
    }
  }, [defaults])

  // Form validation
  const isFormValid =
    !!syncProperties.prefix_status &&
    !!syncProperties.interface_status &&
    !!syncProperties.ip_address_status &&
    !!syncProperties.namespace &&
    selectedDevices.size > 0

  // Handlers
  const handleSync = useCallback(() => {
    if (!isFormValid) return
    syncMutation.mutate(
      { deviceIds: Array.from(selectedDevices), syncProperties },
      { onSuccess: () => setSelectedDevices(new Set()) }
    )
  }, [isFormValid, syncMutation, selectedDevices, syncProperties])

  const handleReloadDevices = useCallback(async () => {
    setIsReloading(true)
    try {
      await reloadDevices()
    } finally {
      setIsReloading(false)
    }
  }, [reloadDevices])

  if (devicesLoading) {
    return (
      <div className="p-6 flex items-center justify-center space-x-2">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        <span>Loading sync devices...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="bg-blue-100 p-2 rounded-lg">
          <RefreshCw className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sync Devices</h1>
          <p className="text-gray-600 mt-1">Synchronize device data with Nautobot</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sync Properties Panel */}
        <div className="lg:col-span-1">
          <SyncPropertiesPanel
            syncProperties={syncProperties}
            onSyncPropertiesChange={setSyncProperties}
            namespaces={namespaces}
            prefixStatuses={prefixStatuses}
            interfaceStatuses={interfaceStatuses}
            ipAddressStatuses={ipAddressStatuses}
            selectedCount={selectedDevices.size}
            isFormValid={isFormValid}
            isSubmitting={syncMutation.isPending}
            onSync={handleSync}
          />
        </div>

        {/* Devices Table */}
        <div className="lg:col-span-3">
          <DevicesTable
            devices={paginatedDevices}
            selectedDevices={selectedDevices}
            onSelectionChange={setSelectedDevices}
            filters={filters}
            roleFilters={roleFilters}
            onRoleFiltersChange={setRoleFilters}
            filterOptions={filterOptions}
            locations={processedLocations}
            onFilterChange={handleFilterChange}
            onClearFilters={clearAllFilters}
            onReloadDevices={handleReloadDevices}
            isReloading={isReloading || isFetching}
            pagination={pagination}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </div>
  )
}
