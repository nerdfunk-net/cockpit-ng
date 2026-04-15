'use client'

import { useState, useCallback, useMemo } from 'react'
import { Users } from 'lucide-react'
import { useClientDevicesQuery, useClientDataQuery } from '@/hooks/queries/use-clients-query'
import { DeviceList } from './device-list'
import { ClientsTable } from './clients-table'

interface ColumnFilters {
  ipAddress: string
  macAddress: string
  port: string
  vlan: string
  hostname: string
}

const INITIAL_FILTERS: ColumnFilters = {
  ipAddress: '',
  macAddress: '',
  port: '',
  vlan: '',
  hostname: '',
}

export function ClientsPage() {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(INITIAL_FILTERS)

  const devicesQuery = useClientDevicesQuery()

  const queryFilters = useMemo(
    () => ({
      deviceName: selectedDevice ?? undefined,
      ipAddress: columnFilters.ipAddress || undefined,
      macAddress: columnFilters.macAddress || undefined,
      port: columnFilters.port || undefined,
      vlan: columnFilters.vlan || undefined,
      hostname: columnFilters.hostname || undefined,
      page,
      pageSize: 50,
    }),
    [selectedDevice, columnFilters, page]
  )

  const dataQuery = useClientDataQuery(queryFilters)

  const handleDeviceSelect = useCallback((device: string | null) => {
    setSelectedDevice(device)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback(
    (key: keyof ColumnFilters, value: string) => {
      setColumnFilters((prev) => ({ ...prev, [key]: value }))
      setPage(1)
    },
    []
  )

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const items = dataQuery.data?.items ?? []
  const total = dataQuery.data?.total ?? 0
  const devices = devicesQuery.data ?? []

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
            selectedDevice={selectedDevice}
            onSelect={handleDeviceSelect}
            isLoading={devicesQuery.isLoading}
          />
        </div>

        {/* Right: Data table */}
        <div className="lg:col-span-3">
          <ClientsTable
            items={items}
            total={total}
            page={page}
            pageSize={50}
            filters={columnFilters}
            isLoading={dataQuery.isLoading}
            onFilterChange={handleFilterChange}
            onPageChange={handlePageChange}
            selectedDevice={selectedDevice}
          />
        </div>
      </div>
    </div>
  )
}
