'use client'

import { useState, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Device } from '@/types/features/checkmk/sync-devices'
import { useAuthStore } from '@/lib/auth-store'

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
import { JobControlsPanel } from './components/job-controls-panel'

export default function SyncDevicesPage() {
  const { token } = useAuthStore()

  // Status messages
  const { statusMessage, showMessage, clearMessage } = useStatusMessages()

  // Device loader
  const { devices, loading, error, authReady, reloadDevices, setDevices } = useDeviceLoader()

  // Device filters
  const {
    filteredDevices,
    deviceNameFilter,
    roleFilters,
    selectedLocation,
    statusFilter,
    checkmkFilter,
    filterOptions,
    activeFiltersCount,
    setDeviceNameFilter,
    setRoleFilters,
    setSelectedLocation,
    setStatusFilter,
    setCheckmkFilter,
    resetFilters
  } = useDeviceFilters(devices)

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

  // Merge devices helper - preserves IP addresses from existing devices
  const mergeDevicesWithExisting = useCallback((loadedDevices: Device[], currentDevices: Device[]) => {
    return loadedDevices.map(newDevice => {
      const existingDevice = currentDevices.find(d => d.id === newDevice.id)

      // If device exists and has IP address, preserve it (unless new device has one)
      if (existingDevice?.primary_ip4?.address && existingDevice.primary_ip4.address !== 'N/A') {
        return {
          ...newDevice,
          primary_ip4: newDevice.primary_ip4?.address && newDevice.primary_ip4.address !== 'N/A'
            ? newDevice.primary_ip4
            : existingDevice.primary_ip4
        }
      }

      return newDevice
    })
  }, [])

  // Job management
  const jobManagement = useJobManagement(
    token,
    (loadedDevices) => {
      // Use functional update to access current state
      setDevices(currentDevices => mergeDevicesWithExisting(loadedDevices, currentDevices))
      clearSelection()
    },
    (message) => showMessage(message),
    (message) => showMessage(message)
  )

  // Handle start new comparison job
  const handleStartNewJob = useCallback(async () => {
    const result = await jobManagement.startNewJob()
    if (result) {
      showMessage('Comparison job started. Refresh jobs to see progress.')
    }
  }, [jobManagement, showMessage])

  // Handle clear results
  const handleClearResults = useCallback(async () => {
    if (!confirm('Are you sure you want to delete all comparison results? This action cannot be undone.')) {
      return
    }

    const success = await jobManagement.clearResults()
    if (success) {
      setDevices([])
      clearSelection()
    }
  }, [jobManagement, setDevices, clearSelection])

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
        totalDeviceCount={devices.length}
        selectedDevices={selectedDevices}
        diffResults={deviceDiffResults}
        deviceNameFilter={deviceNameFilter}
        roleFilters={roleFilters}
        selectedLocation={selectedLocation}
        statusFilter={statusFilter}
        checkmkFilter={checkmkFilter}
        filterOptions={filterOptions}
        activeFiltersCount={activeFiltersCount}
        currentPage={currentPage}
        pageSize={pageSize}
        loading={loading}
        hasDevicesSynced={true}
        isActivating={isActivating}
        isSyncing={isSyncingSelected}
        onSelectDevice={handleSelectDevice}
        onSelectAll={(checked) => handleSelectAll(filteredDevices.slice(currentPage * pageSize, (currentPage + 1) * pageSize), checked)}
        onGetDiff={handleGetDiff}
        onSync={handleSync}
        onStartDiscovery={handleStartDiscovery}
        onDeviceNameFilterChange={setDeviceNameFilter}
        onRoleFiltersChange={setRoleFilters}
        onLocationChange={setSelectedLocation}
        onStatusFilterChange={setStatusFilter}
        onCheckmkFilterChange={setCheckmkFilter}
        onPageChange={handlePageChange}
        onPageSizeChange={setPageSize}
        onReloadDevices={reloadDevices}
        onResetFilters={resetFilters}
        onClearSelection={clearSelection}
        onSyncSelected={handleSyncSelectedDevices}
        onActivate={handleActivate}
      />

      {/* Job Controls Panel */}
      <JobControlsPanel
        selectedJobId={jobManagement.selectedJobId}
        availableJobs={jobManagement.availableJobs}
        loadingResults={jobManagement.loadingResults}
        onStartNewJob={handleStartNewJob}
        onSelectJob={jobManagement.setSelectedJobId}
        onLoadResults={() => jobManagement.loadJobResults()}
        onRefreshJobs={jobManagement.fetchAvailableJobs}
        onClearResults={handleClearResults}
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
