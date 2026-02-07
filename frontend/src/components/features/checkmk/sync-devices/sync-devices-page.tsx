'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthStore } from '@/lib/auth-store'
import type { Device } from '@/types/features/checkmk/sync-devices'

// Custom hooks
import { useStatusMessages } from './hooks/use-status-messages'
import { useDeviceLoader } from './hooks/use-device-loader'
import { useDeviceFilters } from './hooks/use-device-filters'
import { useDeviceSelection } from './hooks/use-device-selection'
import { useTaskTracking } from './hooks/use-task-tracking'
import { useDiffComparison } from './hooks/use-diff-comparison'
import { useDeviceOperations } from './hooks/use-device-operations'
import { useJobManagement } from './hooks/use-job-management'

// Components
import { StatusMessageCard } from './components/status-message-card'
import { ActiveTasksPanel } from './components/active-tasks-panel'
import { SyncDevicesHeader } from './components/sync-devices-header'
import { DeviceTable } from './components/device-table'
import { DiffModal } from './components/diff-modal'
import { AddDeviceModal } from './components/add-device-modal'

export default function SyncDevicesPage() {
  const token = useAuthStore(state => state.token)

  // Status messages
  const { statusMessage, showMessage, clearMessage } = useStatusMessages()

  // Device loader
  const { devices, loading, error, authReady, reloadDevices } = useDeviceLoader()

  // Track comparison overlay results
  const [comparisonOverlay, setComparisonOverlay] = useState<Map<string, string>>(new Map())

  // Overlay comparison job results onto devices
  const overlayComparisonResults = useCallback((loadedDevices: Device[]) => {
    const overlay = new Map<string, string>()
    for (const device of loadedDevices) {
      const key = device.name.toLowerCase()
      if (device.checkmk_status) {
        overlay.set(key, device.checkmk_status)
      }
    }
    setComparisonOverlay(overlay)
    showMessage(`Loaded comparison results for ${loadedDevices.length} devices`, 'success')
  }, [showMessage])

  // Job management for loading comparison results
  const jobManagement = useJobManagement(
    token,
    async (loadedDevices) => {
      // Overlay comparison results onto devices
      overlayComparisonResults(loadedDevices)
    },
    (message) => showMessage(message, 'error'),
    (message) => showMessage(message, 'success')
  )

  // Enrich devices with comparison overlay
  const enrichedDevices = useMemo((): Device[] => {
    if (comparisonOverlay.size === 0) return devices
    return devices.map(device => {
      const status = comparisonOverlay.get(device.name.toLowerCase())
      if (status) {
        return { ...device, checkmk_status: status }
      }
      return device
    })
  }, [devices, comparisonOverlay])

  // Device filters
  const {
    filteredDevices,
    deviceNameFilter,
    roleFilters,
    selectedLocation,
    statusFilter,
    checkmkFilters,
    filterOptions,
    activeFiltersCount,
    setDeviceNameFilter,
    setRoleFilters,
    setSelectedLocation,
    setStatusFilter,
    setCheckmkFilters,
    resetFilters
  } = useDeviceFilters(enrichedDevices)

  // Device selection
  const { selectedDevices, handleSelectDevice, handleSelectAll, clearSelection } = useDeviceSelection()

  // Task tracking
  const { activeTasks, expandedErrorTasks, trackTask, cancelTask, dismissTask, toggleErrorDetails } = useTaskTracking({
    showMessage
  })

  // Diff comparison
  const { diffResult, loadingDiff, deviceDiffResults, getDiff, parseConfigComparison, setDiffResult } = useDiffComparison({
    showMessage
  })

  // Modal state
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false)
  const [deviceToAdd, setDeviceToAdd] = useState<Device | null>(null)
  const [isAddingDevice, setIsAddingDevice] = useState(false)
  const [isSyncingSelected, setIsSyncingSelected] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  // Reset pagination when filters change and current page is out of bounds
  useEffect(() => {
    const totalPages = Math.ceil(filteredDevices.length / pageSize)
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(0)
    }
  }, [filteredDevices.length, pageSize, currentPage])

  // Handle add device confirmation
  const handleAddDeviceConfirmation = useCallback((device: Device) => {
    setDeviceToAdd(device)
    setShowAddDeviceModal(true)
  }, [])

  const handleAddDeviceCancel = useCallback(() => {
    setShowAddDeviceModal(false)
    setDeviceToAdd(null)
  }, [])

  // Device operations
  const {
    isActivating,
    handleAddDevice: handleAddDeviceOp,
    handleSync,
    handleSyncSelected,
    handleStartDiscovery,
    handleActivate
  } = useDeviceOperations({
    trackTask,
    showMessage,
    onAddDeviceConfirmation: handleAddDeviceConfirmation
  })

  // Handle add device
  const handleAddDevice = useCallback(async (device: Device) => {
    try {
      setIsAddingDevice(true)
      const response = await handleAddDeviceOp(device)
      if (response) {
        setShowAddDeviceModal(false)
        setDeviceToAdd(null)
      }
    } finally {
      setIsAddingDevice(false)
    }
  }, [handleAddDeviceOp])

  // Handle get diff
  const handleGetDiff = useCallback(async (device: Device) => {
    setSelectedDevice(device)
    setIsDiffModalOpen(true)
    await getDiff(device)
  }, [getDiff])

  // Handle sync selected devices
  const handleSyncSelectedDevices = useCallback(async () => {
    setIsSyncingSelected(true)
    try {
      const success = await handleSyncSelected(Array.from(selectedDevices), selectedDevices.size)
      if (success) {
        clearSelection()
      }
    } finally {
      setIsSyncingSelected(false)
    }
  }, [handleSyncSelected, selectedDevices, clearSelection])

  // Handle load latest comparison results
  const handleLoadLatestResults = useCallback(async () => {
    try {
      // Fetch available jobs
      await jobManagement.fetchAvailableJobs()

      // Get the latest job (first in the list, as they're already sorted by created_at desc)
      const latestJobId = jobManagement.availableJobs[0]?.id

      if (!latestJobId) {
        showMessage('No comparison results available. Please run a comparison job first.', 'info')
        return
      }

      // Load the latest job results
      await jobManagement.loadJobResults(latestJobId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load latest results'
      showMessage(message, 'error')
    }
  }, [jobManagement, showMessage])

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    const totalPages = Math.ceil(filteredDevices.length / pageSize)
    setCurrentPage(Math.max(0, Math.min(newPage, totalPages - 1)))
  }, [filteredDevices.length, pageSize])

  // Config comparison for diff modal
  const configComparison = diffResult ? parseConfigComparison(diffResult) : []

  // Handle modal close
  const handleCloseDiffModal = useCallback(() => {
    setIsDiffModalOpen(false)
    setDiffResult(null)
    setSelectedDevice(null)
  }, [setDiffResult])

  // Loading state
  if (!authReady || (loading && devices.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">
            {!authReady ? 'Establishing authentication...' : 'Loading devices...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <SyncDevicesHeader
        loading={loading}
        onReloadDevices={reloadDevices}
      />

      {/* Status Message */}
      {statusMessage && (
        <StatusMessageCard
          message={statusMessage}
          onDismiss={clearMessage}
        />
      )}

      {/* Active Tasks Panel */}
      <ActiveTasksPanel
        activeTasks={activeTasks}
        expandedErrorTasks={expandedErrorTasks}
        onCancelTask={cancelTask}
        onDismissTask={dismissTask}
        onToggleErrorDetails={toggleErrorDetails}
      />

      {/* Error Message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <X className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Device Table with integrated header and footer */}
      <DeviceTable
        devices={filteredDevices}
        totalDeviceCount={enrichedDevices.length}
        selectedDevices={selectedDevices}
        diffResults={deviceDiffResults}
        deviceNameFilter={deviceNameFilter}
        roleFilters={roleFilters}
        selectedLocation={selectedLocation}
        statusFilter={statusFilter}
        checkmkFilters={checkmkFilters}
        filterOptions={filterOptions}
        activeFiltersCount={activeFiltersCount}
        currentPage={currentPage}
        pageSize={pageSize}
        loading={loading}
        hasDevicesSynced={true}
        isActivating={isActivating}
        isSyncing={isSyncingSelected}
        loadingLatestResults={jobManagement.loadingResults}
        onSelectDevice={handleSelectDevice}
        onSelectAll={(checked) => handleSelectAll(filteredDevices.slice(currentPage * pageSize, (currentPage + 1) * pageSize), checked)}
        onGetDiff={handleGetDiff}
        onSync={handleSync}
        onStartDiscovery={handleStartDiscovery}
        onDeviceNameFilterChange={setDeviceNameFilter}
        onRoleFiltersChange={setRoleFilters}
        onLocationChange={setSelectedLocation}
        onStatusFilterChange={setStatusFilter}
        onCheckmkFiltersChange={setCheckmkFilters}
        onPageChange={handlePageChange}
        onPageSizeChange={setPageSize}
        onReloadDevices={reloadDevices}
        onLoadLatestResults={handleLoadLatestResults}
        onResetFilters={resetFilters}
        onClearSelection={clearSelection}
        onSyncSelected={handleSyncSelectedDevices}
        onActivate={handleActivate}
      />

      {/* Diff Modal */}
      <DiffModal
        isOpen={isDiffModalOpen}
        device={selectedDevice}
        diffResult={diffResult}
        loading={loadingDiff}
        configComparison={configComparison}
        onClose={handleCloseDiffModal}
      />

      {/* Add Device Modal */}
      <AddDeviceModal
        isOpen={showAddDeviceModal}
        device={deviceToAdd}
        isAdding={isAddingDevice}
        onConfirm={handleAddDevice}
        onCancel={handleAddDeviceCancel}
      />
    </div>
  )
}
