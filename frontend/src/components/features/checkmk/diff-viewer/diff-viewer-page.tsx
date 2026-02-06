'use client'

import { useState, useCallback, useMemo } from 'react'
import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthStore } from '@/lib/auth-store'
import { DiffViewerHeader } from './components/diff-viewer-header'
import { DiffStatsCards } from './components/diff-stats-cards'
import { DiffDeviceTable } from './components/diff-device-table'
import { useDiffDeviceLoader } from './hooks/use-diff-device-loader'
import { useDiffFilters } from './hooks/use-diff-filters'
import { useStatusMessages } from '../sync-devices/hooks/use-status-messages'
import { useJobManagement } from '../sync-devices/hooks/use-job-management'
import { useDiffComparison } from '../sync-devices/hooks/use-diff-comparison'
import { StatusMessageCard } from '../sync-devices/components/status-message-card'
import { JobControlsPanel } from '../sync-devices/components/job-controls-panel'
import { DiffModal } from '../sync-devices/components/diff-modal'
import type { DiffDevice } from '@/types/features/checkmk/diff-viewer'
import type { Device } from '@/types/features/checkmk/sync-devices'

export default function DiffViewerPage() {
  const token = useAuthStore(state => state.token)
  const { statusMessage, showMessage, clearMessage } = useStatusMessages()

  // Diff loader
  const {
    devices,
    totalNautobot,
    totalCheckmk,
    totalBoth,
    loading,
    error,
    runDiff,
  } = useDiffDeviceLoader()

  // Filters
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
    filterOptions,
    filteredDevices,
    activeFiltersCount,
    resetFilters,
  } = useDiffFilters(devices)

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

  // Track overlaid comparison statuses
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

  // Enrich devices with comparison overlay
  const enrichedDevices = useMemo((): DiffDevice[] => {
    if (comparisonOverlay.size === 0) return filteredDevices
    return filteredDevices.map(device => {
      const status = comparisonOverlay.get(device.name.toLowerCase())
      if (status) {
        return { ...device, checkmk_diff_status: status }
      }
      return device
    })
  }, [filteredDevices, comparisonOverlay])

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

  // Handle start new comparison job
  const handleStartNewJob = useCallback(async () => {
    const result = await jobManagement.startNewJob()
    if (result) {
      showMessage('Comparison job started. Refresh jobs to see progress.', 'info')
    }
  }, [jobManagement, showMessage])

  // Handle clear results
  const handleClearResults = useCallback(async () => {
    if (!confirm('Are you sure you want to delete all comparison results? This action cannot be undone.')) {
      return
    }
    const success = await jobManagement.clearResults()
    if (success) {
      setComparisonOverlay(new Map())
    }
  }, [jobManagement])

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

      {/* Stats Cards */}
      <DiffStatsCards
        totalDevices={devices.length}
        totalBoth={totalBoth}
        totalNautobotOnly={totalNautobot - totalBoth}
        totalCheckmkOnly={totalCheckmk - totalBoth}
      />

      {/* Device Table */}
      <DiffDeviceTable
        devices={enrichedDevices}
        totalDeviceCount={devices.length}
        deviceNameFilter={deviceNameFilter}
        roleFilters={roleFilters}
        selectedLocation={selectedLocation}
        statusFilter={statusFilter}
        systemFilter={systemFilter}
        filterOptions={filterOptions}
        activeFiltersCount={activeFiltersCount}
        loading={loading}
        onDeviceNameFilterChange={setDeviceNameFilter}
        onRoleFiltersChange={setRoleFilters}
        onLocationChange={setSelectedLocation}
        onStatusFilterChange={setStatusFilter}
        onSystemFilterChange={setSystemFilter}
        onResetFilters={resetFilters}
        onGetDiff={handleGetDiff}
        onRunDiff={runDiff}
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
    </div>
  )
}
