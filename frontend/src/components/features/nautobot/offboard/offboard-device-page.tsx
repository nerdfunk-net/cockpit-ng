'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'
import type {
  DeviceVirtualChassisStatus,
  IpAddressMultipleAssignmentWarning,
  OffboardSummary,
  VirtualChassisDecision,
} from '@/types/features/nautobot/offboard'

// Custom hooks
import { useDeviceLoader } from './hooks/use-device-loader'
import { useDeviceFilters } from './hooks/use-device-filters'
import { useDeviceSelection } from './hooks/use-device-selection'
import { usePagination } from './hooks/use-pagination'
import { useLocationFilter } from './hooks/use-location-filter'
import { useOffboardOperations } from './hooks/use-offboard-operations'
import { useUrlParams } from './hooks/use-url-params'

// Components
import { OffboardHeader } from './components/offboard-header'
import { OffboardPanel } from './components/offboard-panel'
import { DeviceTable } from './components/device-table'
import { ConfirmationModal } from './components/confirmation-modal'
import { IpAssignmentWarningModal } from './components/ip-assignment-warning-modal'
import { ResultsModal } from './components/results-modal'
import { VirtualChassisModal } from './components/virtual-chassis-modal'

interface VCQueueItem {
  deviceId: string
  deviceName: string
  status: DeviceVirtualChassisStatus
}

export function OffboardDevicePage() {
  // Auth
  const { isAuthenticated, logout } = useAuthStore()

  // Toast notifications
  const { toast } = useToast()
  const showMessage = useCallback(
    (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
      const titleMap = {
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Info',
      }
      toast({
        title: titleMap[type],
        description: message,
        variant: type === 'error' ? 'destructive' : 'default',
      })
    },
    [toast]
  )

  // Device loader
  const { devices, isLoading, dropdownOptions, loadDevices, reloadDevices } =
    useDeviceLoader()

  // Device filters
  const {
    filteredDevices,
    filters,
    roleFilters,
    setFilters,
    setRoleFilters,
    handleFilterChange,
    clearAllFilters,
  } = useDeviceFilters(devices, dropdownOptions)

  // Location filter
  const {
    locationFiltered,
    locationSearch,
    showLocationDropdown,
    locationContainerRef,
    setShowLocationDropdown,
    handleLocationSearchChange,
    handleLocationSelect,
    loadLocations,
  } = useLocationFilter()

  // Device selection
  const { selectedDevices, handleSelectDevice, handleSelectAll, clearSelection } =
    useDeviceSelection()

  // Pagination
  const { pagination, currentPageItems, handlePageChange, handlePageSizeChange } =
    usePagination(filteredDevices.length)

  // Offboard operations
  const {
    isSubmitting,
    offboardProperties,
    setOffboardProperties,
    handleOffboardDevices,
    checkVCStatus,
    setVcDecision,
    checkIpAssignments,
    ipRemovalDecisions,
    setIpRemovalDecision,
  } = useOffboardOperations({ showMessage })

  // URL params
  useUrlParams(filters, setFilters)

  // Modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [offboardSummary, setOffboardSummary] = useState<OffboardSummary | null>(null)

  // Virtual chassis pre-check state
  const [vcDevicesQueue, setVcDevicesQueue] = useState<VCQueueItem[]>([])
  const [isCheckingVC, setIsCheckingVC] = useState(false)

  // IP assignment warning state
  const [ipWarnings, setIpWarnings] = useState<IpAddressMultipleAssignmentWarning[]>([])
  const [showIpWarningModal, setShowIpWarningModal] = useState(false)
  const [isCheckingIp, setIsCheckingIp] = useState(false)

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      logout()
    }
  }, [isAuthenticated, logout])

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await Promise.all([loadDevices(), loadLocations()])
      } catch (error) {
        showMessage(
          `Failed to load initial data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        )
      }
    }
    loadInitialData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const proceedToConfirmation = useCallback(async () => {
    if (!offboardProperties.removePrimaryIp) {
      setShowConfirmationModal(true)
      return
    }

    setIsCheckingIp(true)
    try {
      const selectedDeviceList = devices.filter(d => selectedDevices.has(d.id))
      const warnings = await checkIpAssignments(selectedDeviceList)
      if (warnings.length > 0) {
        setIpWarnings(warnings)
        setShowIpWarningModal(true)
      } else {
        setShowConfirmationModal(true)
      }
    } catch (error) {
      showMessage(
        `Failed to check IP assignments: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      )
      setShowConfirmationModal(true)
    } finally {
      setIsCheckingIp(false)
    }
  }, [offboardProperties.removePrimaryIp, devices, selectedDevices, checkIpAssignments, showMessage])

  // Handlers
  const handleReloadDevices = useCallback(async () => {
    try {
      await reloadDevices()
      showMessage('Devices reloaded successfully', 'success')
    } catch (error) {
      showMessage(
        `Failed to reload devices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      )
    }
  }, [reloadDevices, showMessage])

  const confirmOffboard = useCallback(async () => {
    if (selectedDevices.size === 0) {
      showMessage('Please select at least one device to offboard', 'error')
      return
    }

    setIsCheckingVC(true)
    showMessage('Checking virtual chassis membership...', 'info')

    const queue: VCQueueItem[] = []
    try {
      for (const deviceId of selectedDevices) {
        const vcStatus = await checkVCStatus(deviceId)
        if (vcStatus.is_in_chassis) {
          const deviceName = devices.find(d => d.id === deviceId)?.name || deviceId
          queue.push({ deviceId, deviceName, status: vcStatus })
        }
      }
    } catch (error) {
      showMessage(
        `Failed to check virtual chassis status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      )
      setIsCheckingVC(false)
      return
    }

    setIsCheckingVC(false)

    if (queue.length > 0) {
      setVcDevicesQueue(queue)
    } else {
      await proceedToConfirmation()
    }
  }, [selectedDevices, devices, checkVCStatus, showMessage, proceedToConfirmation])

  const handleVCDecide = useCallback(
    (deviceId: string, decision: VirtualChassisDecision) => {
      setVcDecision(deviceId, decision)

      setVcDevicesQueue(prev => {
        // If remove_all, remove any other queue items from the same VC
        const vcId = decision.virtual_chassis_id
        const filtered =
          decision.action === 'remove_all'
            ? prev.filter(
                item => item.status.virtual_chassis?.id !== vcId || item.deviceId === deviceId
              )
            : prev

        const remaining = filtered.slice(1)
        if (remaining.length === 0) {
          proceedToConfirmation()
        }
        return remaining
      })
    },
    [setVcDecision, proceedToConfirmation]
  )

  const handleVCCancel = useCallback(() => {
    setVcDevicesQueue([])
  }, [])

  const handleConfirmRemove = useCallback(async () => {
    setShowConfirmationModal(false)

    try {
      const summary = await handleOffboardDevices(Array.from(selectedDevices), devices)
      setOffboardSummary(summary)
      setShowResultsModal(true)
      clearSelection()

      // Refresh device list after offboarding
      setTimeout(() => loadDevices(), 1000)
    } catch (error) {
      console.error('Offboard process failed:', error)
    }
  }, [handleOffboardDevices, selectedDevices, devices, clearSelection, loadDevices])

  const currentPageDevices = currentPageItems(filteredDevices)

  // Loading state
  if (isLoading && devices.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          <span>Loading devices...</span>
        </div>
      </div>
    )
  }

  const currentVCItem = vcDevicesQueue[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <OffboardHeader />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Offboarding Panel */}
        <div className="lg:col-span-1">
          <OffboardPanel
            selectedCount={selectedDevices.size}
            isSubmitting={isSubmitting || isCheckingVC || isCheckingIp}
            offboardProperties={offboardProperties}
            onOffboardPropertiesChange={props =>
              setOffboardProperties(prev => ({ ...prev, ...props }))
            }
            onOffboard={confirmOffboard}
            isFormValid={selectedDevices.size > 0}
          />
        </div>

        {/* Devices Table */}
        <div className="lg:col-span-3">
          <DeviceTable
            devices={currentPageDevices}
            selectedDevices={selectedDevices}
            filters={filters}
            roleFilters={roleFilters}
            dropdownOptions={dropdownOptions}
            pagination={pagination}
            isLoading={isLoading}
            locationSearch={locationSearch}
            locationFiltered={locationFiltered}
            showLocationDropdown={showLocationDropdown}
            locationContainerRef={locationContainerRef}
            onSelectDevice={handleSelectDevice}
            onSelectAll={checked => handleSelectAll(currentPageDevices, checked)}
            onFilterChange={handleFilterChange}
            onRoleFiltersChange={setRoleFilters}
            onLocationSearchChange={handleLocationSearchChange}
            onLocationSelect={handleLocationSelect}
            onLocationDropdownToggle={setShowLocationDropdown}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onClearFilters={clearAllFilters}
            onReloadDevices={handleReloadDevices}
          />
        </div>
      </div>

      {/* Virtual Chassis Decision Modal */}
      {currentVCItem && (
        <VirtualChassisModal
          isOpen={vcDevicesQueue.length > 0}
          deviceId={currentVCItem.deviceId}
          deviceName={currentVCItem.deviceName}
          status={currentVCItem.status}
          onDecide={decision => handleVCDecide(currentVCItem.deviceId, decision)}
          onCancel={handleVCCancel}
        />
      )}

      {/* IP Assignment Warning Modal */}
      <IpAssignmentWarningModal
        isOpen={showIpWarningModal}
        warnings={ipWarnings}
        decisions={ipRemovalDecisions}
        onDecision={setIpRemovalDecision}
        onConfirm={() => {
          setShowIpWarningModal(false)
          setShowConfirmationModal(true)
        }}
        onCancel={() => {
          setShowIpWarningModal(false)
          setIpWarnings([])
        }}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmationModal}
        selectedCount={selectedDevices.size}
        onConfirm={handleConfirmRemove}
        onCancel={() => setShowConfirmationModal(false)}
      />

      {/* Results Modal */}
      <ResultsModal
        isOpen={showResultsModal}
        summary={offboardSummary}
        onClose={() => setShowResultsModal(false)}
      />
    </div>
  )
}
