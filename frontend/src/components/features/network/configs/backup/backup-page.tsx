'use client'

import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Save, RotateCcw } from 'lucide-react'
import { useBackupDevices } from './hooks/use-backup-devices'
import { useBackupMutations } from './hooks/use-backup-mutations'
import { BackupFilters } from './components/backup-filters'
import { BackupDevicesTable } from './components/backup-devices-table'
import { BackupHistoryDialog } from './components/backup-history-dialog'
import { DEFAULT_PAGE_SIZE } from './utils/constants'
import type { Device, DeviceFilters, BackupSorting } from './types'

const EMPTY_FILTERS: DeviceFilters = {}

export default function BackupPage() {
  // UI state only
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [backupInProgress] = useState<Set<string>>(new Set())

  // Filter/pagination/sorting state
  const [filters, setFilters] = useState<DeviceFilters>(EMPTY_FILTERS)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sorting, setSorting] = useState<BackupSorting>({ order: 'none' })

  // TanStack Query - replaces ALL manual state management
  const { data, isLoading, error } = useBackupDevices({
    filters,
    pagination: {
      limit: pageSize,
      offset: currentPage * pageSize
    },
    sorting
  })

  const { triggerBulkBackup } = useBackupMutations()

  // Memoize devices to prevent re-render loops
  const devices = useMemo(() => data?.devices || [], [data?.devices])
  const total = data?.total || 0

  // Derived state (use useMemo, not useState)
  const filterOptions = useMemo(() => {
    const options = {
      roles: new Set<string>(),
      locations: new Set<string>(),
      deviceTypes: new Set<string>(),
      statuses: new Set<string>(),
    }

    devices.forEach(device => {
      if (device.role?.name) options.roles.add(device.role.name)
      if (device.location?.name) options.locations.add(device.location.name)
      if (device.device_type?.model) options.deviceTypes.add(device.device_type.model)
      if (device.status?.name) options.statuses.add(device.status.name)
    })

    return options
  }, [devices])

  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(Boolean).length
  }, [filters])

  const handleShowHistory = useCallback((device: Device) => {
    setSelectedDevice(device)
    setIsHistoryModalOpen(true)
  }, [])

  const handleBulkBackup = useCallback(() => {
    const deviceIds = devices.map(d => d.id)
    triggerBulkBackup.mutate(deviceIds)
  }, [devices, triggerBulkBackup])

  const handleResetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS)
    setCurrentPage(0)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(0)
  }, [])

  const handleSortChange = useCallback((column: string) => {
    setSorting((prev) => {
      if (prev.column !== column) {
        return { column, order: 'desc' }
      }
      if (prev.order === 'desc') {
        return { column, order: 'asc' }
      }
      return { order: 'none' }
    })
    setCurrentPage(0)
  }, [])

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <span>Error loading devices: {error.message}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading && devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading devices...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Save className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configuration Backup</h1>
            <p className="text-gray-600 mt-1">Manage device configuration backups</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
          <Button
            onClick={handleBulkBackup}
            disabled={devices.length === 0 || triggerBulkBackup.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Backup All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <BackupFilters
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleResetFilters}
        activeFiltersCount={activeFiltersCount}
      />

      {/* Devices Table */}
      <BackupDevicesTable
        devices={devices}
        total={total}
        filters={filters}
        onFiltersChange={setFilters}
        filterOptions={filterOptions}
        onShowHistory={handleShowHistory}
        backupInProgress={backupInProgress}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        sorting={sorting}
        onSortChange={handleSortChange}
      />

      {/* History Dialog */}
      <BackupHistoryDialog
        open={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
        device={selectedDevice}
      />
    </div>
  )
}
