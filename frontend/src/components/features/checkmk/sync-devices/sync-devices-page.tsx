'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { Button } from '@/components/ui/button'
import { Search, RotateCcw, Shield } from 'lucide-react'

// Types
import type { Device } from './types/sync-devices.types'

// Hooks
import { useStatusMessage } from './hooks/use-status-message'
import { usePagination } from './hooks/use-pagination'
import { useDeviceSelection } from './hooks/use-device-selection'
import { useDeviceFilters } from './hooks/use-device-filters'
import { useCeleryJobPolling } from './hooks/use-celery-job-polling'
import { useJobManagement } from './hooks/use-job-management'

// API
import {
  fetchDevices,
  syncDevicesToCheckmk,
  addDeviceToCheckmk,
  getDefaultSite
} from './api/sync-devices.api'

// Modal Components
import { StatusMessageModal } from './components/status-message-modal'
import { AddDeviceModal } from './components/add-device-modal'
import { JobProgressModal } from './components/job-progress-modal'
import { DeviceDetailsModal } from './components/device-details-modal'
import { DeviceDiffModal } from './components/device-diff-modal'

// Sub-Components
import { DeviceFiltersRow } from './components/device-filters-row'
import { DeviceTable } from './components/device-table'
import { PaginationControls } from './components/pagination-controls'
import { JobControls } from './components/job-controls'
import { DeviceActionsBar } from './components/device-actions-bar'

export function CheckMKSyncDevicesPage() {
  const { token } = useAuthStore()
  
  // Core state
  const [devices, setDevices] = useState<Device[]>([])
  const [addingDevices, setAddingDevices] = useState<Set<string>>(new Set())
  const [defaultSite, setDefaultSite] = useState<string>('cmk')
  const [selectedDeviceForView, setSelectedDeviceForView] = useState<Device | null>(null)
  const [selectedDeviceForDiff, setSelectedDeviceForDiff] = useState<Device | null>(null)
  const [isReloadingDevices, setIsReloadingDevices] = useState(false)
  
  // Add device modal state
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false)
  const [deviceToAdd, setDeviceToAdd] = useState<Device | null>(null)
  const [isAddingDevice, setIsAddingDevice] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)

  // Custom hooks
  const statusMsg = useStatusMessage()
  const deviceSelection = useDeviceSelection()
  const deviceFilters = useDeviceFilters(devices, defaultSite)
  const pagination = usePagination(deviceFilters.filteredDevices, 25)
  
  // Job management with callbacks
  const jobManagement = useJobManagement(
    token,
    (loadedDevices) => {
      setDevices(loadedDevices)
      deviceSelection.clearSelection()
    },
    (message) => statusMsg.showMessage(message, 'error'),
    (message) => statusMsg.showMessage(message, 'success')
  )
  
  // Celery job polling with callback
  const celeryPolling = useCeleryJobPolling(token, (result: unknown) => {
    const typedResult = result as { job_id?: string; message?: string }
    if (typedResult.job_id) {
      jobManagement.setCurrentJobId(typedResult.job_id)
      jobManagement.setSelectedJobId(typedResult.job_id)
    }
    jobManagement.fetchAvailableJobs()
    statusMsg.showMessage(
      typedResult.message || 'Comparison completed successfully',
      'success'
    )
  })

  // Fetch default site on mount
  useEffect(() => {
    if (token) {
      getDefaultSite(token)
        .then(data => setDefaultSite(data.default_site || 'cmk'))
        .catch(error => console.error('Error fetching default site:', error))
    }
  }, [token])

  // Reset to first page when filters change
  useEffect(() => {
    pagination.resetToFirstPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceFilters.filteredDevices.length])

  // Add device confirmation handlers
  const handleAddDeviceConfirmation = (device: Device) => {
    setDeviceToAdd(device)
    setShowAddDeviceModal(true)
  }

  const handleAddDeviceCancel = () => {
    setShowAddDeviceModal(false)
    setDeviceToAdd(null)
  }

  // Sync single device
  const handleSync = async (device: Device) => {
    try {
      statusMsg.showMessage(`Queuing sync for ${device.name}...`, 'info')

      const response = await syncDevicesToCheckmk(token!, [device.id], true)

      if (response?.task_id) {
        const message = response.job_id
          ? `Sync job queued for ${device.name}. Job ID: ${response.job_id}. Refresh job list to see progress.`
          : `Sync job queued for ${device.name}. Task ID: ${response.task_id}`
        statusMsg.showMessage(message, 'success')
        await jobManagement.fetchAvailableJobs()
      } else {
        statusMsg.showMessage(`Failed to queue sync for ${device.name}`, 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to queue sync job'

      if (message.includes('404') || message.includes('Not Found') || message.includes('not found')) {
        handleAddDeviceConfirmation(device)
      } else {
        statusMsg.showMessage(`Failed to sync ${device.name}: ${message}`, 'error')
      }
    }
  }

  // Add device from modal
  const handleAddDeviceFromModal = async (device: Device) => {
    try {
      setIsAddingDevice(true)
      statusMsg.showMessage(`Adding ${device.name} to CheckMK...`, 'info')

      await addDeviceToCheckmk(token!, device.id)

      statusMsg.showMessage(`Successfully added ${device.name} to CheckMK`, 'success')
      setShowAddDeviceModal(false)
      setDeviceToAdd(null)
      
      setDevices(prevDevices =>
        prevDevices.map(d =>
          d.id === device.id ? { ...d, checkmk_status: 'equal' } : d
        )
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add device'
      statusMsg.showMessage(`Failed to add ${device.name}: ${message}`, 'error')
    } finally {
      setIsAddingDevice(false)
    }
  }

  // Reload devices from Nautobot
  const handleReloadDevices = async () => {
    try {
      setIsReloadingDevices(true)

      const data = await fetchDevices(token!, true)

      if (!data?.devices) {
        throw new Error('Invalid response format')
      }

      const reloadedDevices: Device[] = data.devices.map((device, index) => ({
        id: device.id || device.name || `device_${index}`,
        name: device.name || device.id || `Device ${index + 1}`,
        role: device.role?.name || 'Unknown',
        status: device.status?.name || 'Unknown',
        location: device.location?.name || 'Unknown',
        checkmk_status: 'missing'
      }))

      setDevices(reloadedDevices)
      deviceSelection.clearSelection()
      deviceFilters.clearAllFilters()
      setSelectedDeviceForView(null)
      setSelectedDeviceForDiff(null)
      jobManagement.setCurrentJobId(null)
      jobManagement.setSelectedJobId('')

      statusMsg.showMessage(`Reloaded ${reloadedDevices.length} devices directly from Nautobot`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reload devices'
      statusMsg.showMessage(`Failed to reload devices: ${message}`, 'error')
    } finally {
      setIsReloadingDevices(false)
    }
  }

  // Sync selected devices
  const handleSyncDevices = async () => {
    if (deviceSelection.selectedDevices.size === 0) {
      statusMsg.showMessage('Please select devices to sync', 'error')
      return
    }

    if (!token) {
      statusMsg.showMessage('Authentication required', 'error')
      return
    }

    try {
      const selectedDeviceList = Array.from(deviceSelection.selectedDevices)

      const result = await syncDevicesToCheckmk(token, selectedDeviceList, true)

      deviceSelection.clearSelection()

      const message = result.job_id
        ? `Sync job queued for ${selectedDeviceList.length} device${selectedDeviceList.length === 1 ? '' : 's'}. Job ID: ${result.job_id}. Refresh the job list to see progress.`
        : `Sync job queued for ${selectedDeviceList.length} device${selectedDeviceList.length === 1 ? '' : 's'}. Task ID: ${result.task_id}`
      
      statusMsg.showMessage(message, 'success')
      await jobManagement.fetchAvailableJobs()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error queuing sync job'
      statusMsg.showMessage(message, 'error')
    }
  }

  // Add single device
  const handleAddDevice = async (device: Device) => {
    if (!token) {
      statusMsg.showMessage('Authentication required', 'error')
      return
    }

    setAddingDevices(prev => new Set(prev.add(device.id)))
    
    try {
      const result = await addDeviceToCheckmk(token, device.id)
      statusMsg.showMessage(`Successfully added ${result.hostname} to CheckMK`, 'success')
      
      setDevices(prevDevices => 
        prevDevices.map(d => 
          d.id === device.id ? { ...d, checkmk_status: 'equal' } : d
        )
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error adding device to CheckMK'
      statusMsg.showMessage(`Failed to add device: ${message}`, 'error')
    } finally {
      setAddingDevices(prev => {
        const newSet = new Set(prev)
        newSet.delete(device.id)
        return newSet
      })
    }
  }

  // Start new comparison job
  const startNewJob = async () => {
    if (!token) {
      statusMsg.showMessage('Authentication required', 'error')
      return
    }

    const result = await jobManagement.startNewJob()
    if (result) {
      celeryPolling.startPolling(result.task_id)
      setShowProgressModal(true)
    }
  }

  // Clear results handler
  const handleClearResults = async () => {
    if (!token) return
    
    if (!confirm('Are you sure you want to delete all comparison results? This action cannot be undone.')) {
      return
    }
    
    const success = await jobManagement.clearResults()
    if (success) {
      setDevices([])
      deviceSelection.clearSelection()
    }
  }

  // Always render the full interface - don't show separate loading page

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <Shield className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CheckMK Sync Devices</h1>
            <p className="text-gray-600 mt-1">Compare and synchronize devices between Nautobot and CheckMK</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">CheckMK Device Comparison</h3>
                <p className="text-blue-100 text-xs">Compare Nautobot devices with CheckMK hosts</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={deviceFilters.clearAllFilters}
                className="text-white hover:bg-white/20 text-xs h-6"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReloadDevices}
                className="text-white hover:bg-white/20 text-xs h-6"
                disabled={isReloadingDevices}
              >
                {isReloadingDevices ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                ) : (
                  <Search className="h-3 w-3 mr-1" />
                )}
                Load Devices
              </Button>
            </div>
          </div>
        </div>
        <div className="p-0">
          {/* Filters Row */}
          <DeviceFiltersRow
            filters={deviceFilters.filters}
            roleFilters={deviceFilters.roleFilters}
            statusFilters={deviceFilters.statusFilters}
            checkmkStatusFilters={deviceFilters.checkmkStatusFilters}
            availableRoles={deviceFilters.availableRoles}
            availableStatuses={deviceFilters.availableStatuses}
            availableLocations={deviceFilters.availableLocations}
            selectedLocation={deviceFilters.selectedLocation}
            onFilterChange={deviceFilters.handleFilterChange}
            onRoleFiltersChange={deviceFilters.setRoleFilters}
            onStatusFiltersChange={deviceFilters.setStatusFilters}
            onCheckmkStatusFiltersChange={deviceFilters.setCheckmkStatusFilters}
            onLocationChange={deviceFilters.setSelectedLocation}
            onPageChange={(page) => pagination.setCurrentPage(page)}
          />

          {/* Table */}
          <DeviceTable
            devices={devices}
            currentItems={pagination.currentItems}
            filteredDevices={deviceFilters.filteredDevices}
            selectedDevices={deviceSelection.selectedDevices}
            addingDevices={addingDevices}
            onSelectAll={(checked, items) => deviceSelection.handleSelectAll(checked, items)}
            onSelectDevice={deviceSelection.handleSelectDevice}
            onViewDevice={setSelectedDeviceForView}
            onShowDiff={setSelectedDeviceForDiff}
            onSyncDevice={handleSync}
            onAddDevice={handleAddDevice}
          />

          {/* Pagination */}
          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            itemsPerPage={pagination.itemsPerPage}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            totalItems={deviceFilters.filteredDevices.length}
            totalDevices={devices.length}
            onPageChange={pagination.setCurrentPage}
            onPageSizeChange={pagination.handlePageSizeChange}
          />

          {/* Device Actions */}
          <DeviceActionsBar
            selectedCount={deviceSelection.selectedDevices.size}
            filteredCount={deviceFilters.filteredDevices.length}
            selectedJobId={jobManagement.selectedJobId}
            devicesCount={devices.length}
            isAllFilteredSelected={deviceSelection.selectedDevices.size === deviceFilters.filteredDevices.length}
            onSelectAllFiltered={() => deviceSelection.handleSelectAllFiltered(deviceFilters.filteredDevices)}
            onSyncDevices={handleSyncDevices}
          />
        </div>
      </div>

      {/* Job Controls */}
      <JobControls
        selectedJobId={jobManagement.selectedJobId}
        availableJobs={jobManagement.availableJobs}
        loadingResults={jobManagement.loadingResults}
        onStartNewJob={startNewJob}
        onSelectJob={jobManagement.setSelectedJobId}
        onLoadResults={() => jobManagement.loadJobResults()}
        onRefreshJobs={jobManagement.fetchAvailableJobs}
        onClearResults={handleClearResults}
      />

      {/* Modals */}
      <DeviceDetailsModal 
        device={selectedDeviceForView}
        isOpen={!!selectedDeviceForView}
        onClose={() => setSelectedDeviceForView(null)}
      />

      <StatusMessageModal 
        statusMessage={statusMsg.statusMessage}
        isOpen={statusMsg.showStatusModal}
        onClose={() => statusMsg.setShowStatusModal(false)}
      />

      <DeviceDiffModal 
        device={selectedDeviceForDiff}
        isOpen={!!selectedDeviceForDiff}
        onClose={() => setSelectedDeviceForDiff(null)}
      />

      <JobProgressModal 
        jobProgress={celeryPolling.jobProgress}
        celeryTaskId={celeryPolling.celeryTaskId}
        currentJobId={jobManagement.currentJobId}
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        onCancel={celeryPolling.cancelTask}
        onViewResults={() => {
          setShowProgressModal(false)
          jobManagement.loadJobResults()
        }}
      />

      <AddDeviceModal 
        device={deviceToAdd}
        isOpen={showAddDeviceModal}
        isAdding={isAddingDevice}
        onConfirm={handleAddDeviceFromModal}
        onCancel={handleAddDeviceCancel}
      />
    </div>
  )
}
