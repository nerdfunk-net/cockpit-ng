'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { DiffViewerHeader } from './components/diff-viewer-header'
import { DiffDeviceTable } from './components/diff-device-table'
import { useDiffDeviceLoader } from './hooks/use-diff-device-loader'
import { useDiffFilters } from './hooks/use-diff-filters'
import { useDiffDeviceSelection } from './hooks/use-diff-device-selection'
import { useStatusMessages } from '../shared/hooks/use-status-messages'
import { useJobManagement } from '../shared/hooks/use-job-management'
import { useDiffComparison } from '../shared/hooks/use-diff-comparison'
import { StatusMessageCard } from '../shared/components/status-message-card'
import { JobControlsPanel } from '../shared/components/job-controls-panel'
import { DiffModal } from '../shared/components/diff-modal'
import type { DiffDevice, ViewMode, DiffDataSnapshot } from './types'
import type { Device, CeleryTaskResponse } from '../sync-devices/types'

export default function DiffViewerPage() {
  const token = useAuthStore(state => state.token)
  const { apiCall } = useApi()
  const { statusMessage, showMessage, clearMessage } = useStatusMessages()
  const { confirmDialog, openConfirm } = useConfirmDialog()
  const { selectedDevices, handleSelectDevice, handleSelectAll, clearSelection } = useDiffDeviceSelection()
  const [isSyncingSelected, setIsSyncingSelected] = useState(false)

  // Diff loader
  const {
    devices,
    totalNautobot,
    totalCheckmk,
    totalBoth,
    loading,
    error,
    runDiff,
    loadNautobotDevices,
    restoreData,
  } = useDiffDeviceLoader()

  // Mode state and per-mode data snapshots
  const [mode, setMode] = useState<ViewMode>(null)
  const nautobotSnapshotRef = useRef<DiffDataSnapshot | null>(null)
  const combinedSnapshotRef = useRef<DiffDataSnapshot | null>(null)

  // Track overlaid comparison statuses (must be before callbacks that use it)
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

  // Job management for comparison results overlay
  const jobManagement = useJobManagement(
    token,
    async (loadedDevices) => {
      // Overlay comparison results onto diff devices
      overlayComparisonResults(loadedDevices)
    },
    (message) => showMessage(message, 'error'),
    (message) => showMessage(message, 'success')
  )

  // Diff comparison for individual devices
  const {
    diffResult,
    loadingDiff,
    parseConfigComparison,
    getDiff,
    setDiffResult,
  } = useDiffComparison({ showMessage })

  // State for diff modal
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)

  // Enrich devices with comparison overlay BEFORE filtering
  const enrichedDevices = useMemo((): DiffDevice[] => {
    if (comparisonOverlay.size === 0) return devices
    return devices.map(device => {
      const status = comparisonOverlay.get(device.name.toLowerCase())
      if (status) {
        return { ...device, checkmk_diff_status: status }
      }
      return device
    })
  }, [devices, comparisonOverlay])

  // Filters - applied to enriched devices
  const {
    deviceNameFilter,
    setDeviceNameFilter,
    roleFilters,
    setRoleFilters,
    selectedLocation,
    setSelectedLocation,
    statusFilter,
    setStatusFilter,
    systemFilter,
    setSystemFilter,
    diffStatusFilters,
    setDiffStatusFilters,
    filterOptions,
    filteredDevices,
    activeFiltersCount,
    resetFilters,
  } = useDiffFilters(enrichedDevices)

  // Capture a snapshot of loaded data the first time each mode loads successfully
  useEffect(() => {
    if (loading || devices.length === 0) return
    if (mode === 'nautobot_only' && nautobotSnapshotRef.current === null) {
      nautobotSnapshotRef.current = { devices, totalNautobot, totalCheckmk, totalBoth }
    } else if (mode === 'combined' && combinedSnapshotRef.current === null) {
      combinedSnapshotRef.current = { devices, totalNautobot, totalCheckmk, totalBoth }
    }
  }, [loading, devices, totalNautobot, totalCheckmk, totalBoth, mode])

  // Handle mode selection
  const handleModeChange = useCallback((newMode: ViewMode) => {
    setMode(newMode)
    resetFilters()
    if (newMode === 'nautobot_only') {
      if (nautobotSnapshotRef.current) {
        restoreData(nautobotSnapshotRef.current)
      } else {
        loadNautobotDevices()
      }
    } else if (newMode === 'combined') {
      if (combinedSnapshotRef.current) {
        restoreData(combinedSnapshotRef.current)
      } else {
        runDiff()
      }
    }
  }, [resetFilters, restoreData, loadNautobotDevices, runDiff])

  // Handle get diff for a device
  const handleGetDiff = useCallback(async (diffDevice: DiffDevice) => {
    if (!diffDevice.nautobot_id) return
    // Convert DiffDevice to Device shape for the diff comparison hook
    const device: Device = {
      id: diffDevice.nautobot_id,
      name: diffDevice.name,
      role: diffDevice.role ? { name: diffDevice.role } : undefined,
      location: diffDevice.location ? { name: diffDevice.location } : undefined,
      status: diffDevice.status ? { name: diffDevice.status } : undefined,
      primary_ip4: diffDevice.ip_address ? { address: diffDevice.ip_address } : undefined,
    }
    setSelectedDevice(device)
    setIsDiffModalOpen(true)
    await getDiff(device)
  }, [getDiff])

  // Handle sync device to CheckMK
  const handleSync = useCallback(async (diffDevice: DiffDevice) => {
    if (!diffDevice.nautobot_id) {
      showMessage('Device ID is required for sync', 'error')
      return
    }

    try {
      showMessage(`Starting sync for ${diffDevice.name}...`, 'info')
      
      const response = await apiCall<CeleryTaskResponse>(`celery/tasks/sync-devices-to-checkmk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [diffDevice.nautobot_id],
          activate_changes_after_sync: true
        })
      })

      if (response?.task_id) {
        showMessage(`Sync task started for ${diffDevice.name}. Task ID: ${response.task_id}`, 'success')
      } else {
        showMessage(`Failed to queue sync task for ${diffDevice.name}`, 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync device'
      showMessage(`Failed to sync ${diffDevice.name}: ${message}`, 'error')
    }
  }, [apiCall, showMessage])

  // Handle bulk sync of selected devices
  const handleSyncSelected = useCallback(async () => {
    const deviceIds = Array.from(selectedDevices)
    if (deviceIds.length === 0) return

    setIsSyncingSelected(true)
    try {
      showMessage(`Starting sync for ${deviceIds.length} device(s)...`, 'info')
      const response = await apiCall<CeleryTaskResponse>('celery/tasks/sync-devices-to-checkmk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_ids: deviceIds, activate_changes_after_sync: true })
      })
      if (response?.task_id) {
        showMessage(`Sync task started for ${deviceIds.length} device(s). Task ID: ${response.task_id}`, 'success')
        clearSelection()
      } else {
        showMessage('Failed to queue bulk sync task', 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync selected devices'
      showMessage(`Bulk sync failed: ${message}`, 'error')
    } finally {
      setIsSyncingSelected(false)
    }
  }, [selectedDevices, apiCall, showMessage, clearSelection])

  // Handle start new comparison job
  const handleStartNewJob = useCallback(async () => {
    const result = await jobManagement.startNewJob()
    if (result) {
      showMessage('Comparison job started. Refresh jobs to see progress.', 'info')
    }
  }, [jobManagement, showMessage])

  // Handle clear results
  const handleClearResults = useCallback(() => {
    openConfirm({
      title: 'Delete Comparison Results',
      description: 'Are you sure you want to delete all comparison results? This action cannot be undone.',
      onConfirm: async () => {
        const success = await jobManagement.clearResults()
        if (success) {
          setComparisonOverlay(new Map())
        }
      },
      variant: 'destructive',
    })
  }, [jobManagement, openConfirm])

  // Handle close diff modal
  const handleCloseDiffModal = useCallback(() => {
    setIsDiffModalOpen(false)
    setDiffResult(null)
    setSelectedDevice(null)
  }, [setDiffResult])

  // Config comparison for diff modal
  const configComparison = diffResult ? parseConfigComparison(diffResult) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <DiffViewerHeader />

      {/* Status Message */}
      {statusMessage && (
        <StatusMessageCard message={statusMessage} onDismiss={clearMessage} />
      )}

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


      {/* Device Table */}
      <DiffDeviceTable
        devices={filteredDevices}
        totalDeviceCount={devices.length}
        deviceNameFilter={deviceNameFilter}
        roleFilters={roleFilters}
        selectedLocation={selectedLocation}
        statusFilter={statusFilter}
        systemFilter={systemFilter}
        diffStatusFilters={diffStatusFilters}
        filterOptions={filterOptions}
        totalBoth={totalBoth}
        totalNautobotOnly={totalNautobot - totalBoth}
        totalCheckmkOnly={totalCheckmk - totalBoth}
        activeFiltersCount={activeFiltersCount}
        loading={loading}
        selectedDevices={selectedDevices}
        isSyncingSelected={isSyncingSelected}
        onSelectDevice={handleSelectDevice}
        onSelectAll={handleSelectAll}
        onSyncSelected={handleSyncSelected}
        onDeviceNameFilterChange={setDeviceNameFilter}
        onRoleFiltersChange={setRoleFilters}
        onLocationChange={setSelectedLocation}
        onStatusFilterChange={setStatusFilter}
        onSystemFilterChange={setSystemFilter}
        onDiffStatusFiltersChange={setDiffStatusFilters}
        onResetFilters={resetFilters}
        onGetDiff={handleGetDiff}
        onSync={handleSync}
        onRunDiff={runDiff}
        mode={mode}
        onModeChange={handleModeChange}
      />

      {/* Job Controls Panel */}
      <JobControlsPanel
        selectedJobId={jobManagement.selectedJobId}
        availableJobs={jobManagement.availableJobs}
        loadingResults={jobManagement.loadingResults}
        onStartNewJob={handleStartNewJob}
        onSelectJob={jobManagement.setSelectedJobId}
        onLoadResults={async () => {
          // If devices array is empty, run diff first
          if (devices.length === 0) {
            showMessage('No diff data available. Running diff first...', 'info')
            await runDiff()
          }
          await jobManagement.loadJobResults()
        }}
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

      <ConfirmDialog {...confirmDialog} />
    </div>
  )
}
