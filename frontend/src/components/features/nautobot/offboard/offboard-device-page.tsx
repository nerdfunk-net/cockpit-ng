'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import type { OffboardSummary } from '@/types/features/nautobot/offboard'

// Custom hooks
import { useStatusMessages } from './hooks/use-status-messages'
import { useDeviceLoader } from './hooks/use-device-loader'
import { useDeviceFilters } from './hooks/use-device-filters'
import { useDeviceSelection } from './hooks/use-device-selection'
import { usePagination } from './hooks/use-pagination'
import { useLocationFilter } from './hooks/use-location-filter'
import { useOffboardOperations } from './hooks/use-offboard-operations'
import { useUrlParams } from './hooks/use-url-params'

// Components
import { OffboardHeader } from './components/offboard-header'
import { StatusMessageCard } from './components/status-message-card'
import { OffboardPanel } from './components/offboard-panel'
import { DeviceTable } from './components/device-table'
import { ConfirmationModal } from './components/confirmation-modal'
import { ResultsModal } from './components/results-modal'

export function OffboardDevicePage() {
  // Auth
  const { isAuthenticated, logout } = useAuthStore()

  // Status messages
  const { statusMessage, showMessage, clearMessage } = useStatusMessages()

  // Device loader
  const { devices, isLoading, dropdownOptions, loadDevices, reloadDevices } = useDeviceLoader()

  // Device filters
  const {
    filteredDevices,
    filters,
    roleFilters,
    setFilters,
    setRoleFilters,
    handleFilterChange,
    clearAllFilters
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
    loadLocations
  } = useLocationFilter()

  // Device selection
  const { selectedDevices, handleSelectDevice, handleSelectAll, clearSelection } = useDeviceSelection()

  // Pagination
  const { pagination, currentPageItems, handlePageChange, handlePageSizeChange } = usePagination(filteredDevices.length)

  // Offboard operations
  const {
    isSubmitting,
    offboardProperties,
    nautobotIntegrationMode,
    setOffboardProperties,
    setNautobotIntegrationMode,
    handleOffboardDevices
  } = useOffboardOperations({ showMessage })

  // URL params
  useUrlParams(filters, setFilters)

  // Modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [offboardSummary, setOffboardSummary] = useState<OffboardSummary | null>(null)

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
        showMessage('Loading devices...', 'info')
        await Promise.all([loadDevices(), loadLocations()])
        clearMessage()
      } catch (error) {
        showMessage(
          `Failed to load initial data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        )
      }
    }
    loadInitialData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handlers
  const handleReloadDevices = useCallback(async () => {
    try {
      showMessage('Reloading devices from Nautobot...', 'info')
      await reloadDevices()
      clearMessage()
    } catch (error) {
      showMessage(
        `Failed to reload devices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      )
    }
  }, [reloadDevices, showMessage, clearMessage])

  const confirmOffboard = useCallback(() => {
    if (selectedDevices.size === 0) {
      showMessage('Please select at least one device to offboard', 'error')
      return
    }
    setShowConfirmationModal(true)
  }, [selectedDevices.size, showMessage])

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <OffboardHeader />

      {/* Status Messages */}
      {statusMessage && (
        <StatusMessageCard message={statusMessage} onDismiss={clearMessage} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Offboarding Panel */}
        <div className="lg:col-span-1">
          <OffboardPanel
            selectedCount={selectedDevices.size}
            isSubmitting={isSubmitting}
            offboardProperties={offboardProperties}
            nautobotIntegrationMode={nautobotIntegrationMode}
            onOffboardPropertiesChange={(props) => setOffboardProperties(prev => ({ ...prev, ...props }))}
            onNautobotIntegrationModeChange={setNautobotIntegrationMode}
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
            onSelectAll={(checked) => handleSelectAll(currentPageDevices, checked)}
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