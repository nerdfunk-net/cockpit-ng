'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Users } from 'lucide-react'
import { useNautobotDevicesSearchQuery, useClientDataQuery } from '@/hooks/queries/use-clients-query'
import { DeviceList } from './device-list'
import { ClientsTable } from './clients-table'

interface ColumnFilters {
  ipAddress: string
  macAddress: string
  port: string
  vlan: string
  hostname: string
  deviceName: string
}

const INITIAL_FILTERS: ColumnFilters = {
  ipAddress: '',
  macAddress: '',
  port: '',
  vlan: '',
  hostname: '',
  deviceName: '',
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export function ClientsPage() {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [tablePageSize, setTablePageSize] = useState(50)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(INITIAL_FILTERS)
  // Track if filters changed so we can reset page only on filter change, not debounce tick
  const filterChangedRef = useRef(false)

  // Device list state
  const [deviceSearch, setDeviceSearch] = useState('')
  const [devicePage, setDevicePage] = useState(1)
  const [devicePageSize, setDevicePageSize] = useState(25)
  const deviceSearchChangedRef = useRef(false)

  const debouncedFilters = useDebounce(columnFilters, 300)
  const debouncedDeviceSearch = useDebounce(deviceSearch, 300)

  const nautobotDevicesQuery = useNautobotDevicesSearchQuery({
    search: debouncedDeviceSearch,
    page: devicePage,
    pageSize: devicePageSize,
  })

  const queryFilters = useMemo(
    () => ({
      // Sidebar selection (exact device) takes priority over the column filter
      deviceName: selectedDevice ?? (debouncedFilters.deviceName || undefined),
      ipAddress: debouncedFilters.ipAddress || undefined,
      macAddress: debouncedFilters.macAddress || undefined,
      port: debouncedFilters.port || undefined,
      vlan: debouncedFilters.vlan || undefined,
      hostname: debouncedFilters.hostname || undefined,
      page,
      pageSize: tablePageSize,
    }),
    [selectedDevice, debouncedFilters, page, tablePageSize]
  )

  const dataQuery = useClientDataQuery(queryFilters)

  const handleDeviceSelect = useCallback((device: string | null) => {
    setSelectedDevice(device)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback(
    (key: keyof ColumnFilters, value: string) => {
      filterChangedRef.current = true
      setColumnFilters((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const handleDeviceSearchChange = useCallback((value: string) => {
    deviceSearchChangedRef.current = true
    setDeviceSearch(value)
  }, [])

  // Reset table to page 1 when debounced filters settle after a user change
  useEffect(() => {
    if (filterChangedRef.current) {
      filterChangedRef.current = false
      setPage(1)
    }
  }, [debouncedFilters])

  // Reset device list to page 1 when search changes
  useEffect(() => {
    if (deviceSearchChangedRef.current) {
      deviceSearchChangedRef.current = false
      setDevicePage(1)
    }
  }, [debouncedDeviceSearch])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const handleTablePageSizeChange = useCallback((size: number) => {
    setTablePageSize(size)
    setPage(1)
  }, [])

  const handleDevicePageSizeChange = useCallback((size: number) => {
    setDevicePageSize(size)
    setDevicePage(1)
  }, [])

  const items = dataQuery.data?.items ?? []
  const total = dataQuery.data?.total ?? 0
  const devices = useMemo(
    () => (nautobotDevicesQuery.data?.devices ?? []).map((d) => d.name),
    [nautobotDevicesQuery.data]
  )
  const deviceTotal = nautobotDevicesQuery.data?.count ?? 0

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Network Clients</h1>
            <p className="text-muted-foreground mt-2">
              Browse correlated client data collected from network devices
            </p>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Device list */}
        <div className="lg:col-span-1">
          <DeviceList
            devices={devices}
            total={deviceTotal}
            selectedDevice={selectedDevice}
            onSelect={handleDeviceSelect}
            isLoading={nautobotDevicesQuery.isLoading}
            search={deviceSearch}
            onSearchChange={handleDeviceSearchChange}
            page={devicePage}
            pageSize={devicePageSize}
            onPageChange={setDevicePage}
            onPageSizeChange={handleDevicePageSizeChange}
          />
        </div>

        {/* Right: Data table */}
        <div className="lg:col-span-3">
          <ClientsTable
            items={items}
            total={total}
            page={page}
            pageSize={tablePageSize}
            filters={columnFilters}
            isLoading={dataQuery.isLoading}
            isFetching={dataQuery.isFetching}
            onFilterChange={handleFilterChange}
            onPageChange={handlePageChange}
            onPageSizeChange={handleTablePageSizeChange}
            selectedDevice={selectedDevice}
          />
        </div>
      </div>
    </div>
  )
}
