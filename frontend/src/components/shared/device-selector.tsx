'use client'

import { useState, useEffect } from 'react'
import {
  DeviceSelectorProps,
  LogicalCondition,
  DeviceInfo
} from '@/types/shared/device-selector'

// Re-export types for backward compatibility
export type {
  DeviceSelectorProps,
  LogicalCondition,
  DeviceInfo,
  ConditionTree,
  ConditionItem,
  ConditionGroup
} from '@/types/shared/device-selector'

import { useConditionTree } from '@/hooks/shared/device-selector/use-condition-tree'
import { useDeviceFilter } from '@/hooks/shared/device-selector/use-device-filter'
import { useDevicePreview } from '@/hooks/shared/device-selector/use-device-preview'
import { useSavedInventories } from '@/hooks/shared/device-selector/use-saved-inventories'

import { ConditionTreeBuilder } from '@/components/shared/device-selector-components/condition-tree-builder'
import { DeviceTable } from '@/components/shared/device-selector-components/device-table'
import { SaveInventoryModal } from '@/components/shared/device-selector-components/save-inventory-modal'
import { LoadInventoryModal } from '@/components/shared/device-selector-components/load-inventory-modal'
import { ManageInventoryModal } from '@/components/shared/device-selector-components/manage-inventory-modal'
import { HelpModal } from '@/components/shared/device-selector-components/help-modal'
import { LogicalTreeModal } from '@/components/shared/device-selector-components/logical-tree-modal'

// Define default arrays outside component to prevent re-creating on every render
const EMPTY_CONDITIONS: LogicalCondition[] = []
const EMPTY_DEVICES: DeviceInfo[] = []
const EMPTY_DEVICE_IDS: string[] = []

export function DeviceSelector({
  onDevicesSelected,
  showActions = true,
  showSaveLoad = true,
  initialConditions = EMPTY_CONDITIONS,
  initialDevices = EMPTY_DEVICES,
  enableSelection = false,
  selectedDeviceIds = EMPTY_DEVICE_IDS,
  onSelectionChange,
  onInventoryLoaded
}: DeviceSelectorProps) {

  // -- HOOKS --

  // 1. Condition Tree Logic
  const {
    conditionTree,
    setConditionTree,
    currentGroupPath,
    setCurrentGroupPath,
    addConditionToTree,
    addGroup,
    removeItemFromTree,
    updateGroupLogic,
    findGroupPath,
    flatConditionsToTree
  } = useConditionTree()

  // 2. Device Filter Options & Inputs
  const {
    currentField,
    setCurrentField,
    currentOperator,
    setCurrentOperator,
    currentValue,
    setCurrentValue,
    currentLogic,
    setCurrentLogic,
    currentNegate,
    setCurrentNegate,
    fieldOptions,
    operatorOptions,
    fieldValues,
    customFields,
    locations,
    locationSearchValue,
    setLocationSearchValue,
    showLocationDropdown,
    setShowLocationDropdown,
    selectedCustomField,
    isLoadingFieldValues,
    isLoadingCustomFields,
    handleFieldChange,
    handleOperatorChange,
    handleCustomFieldSelect
  } = useDeviceFilter()

  // 3. Device Preview & Selection
  const {
    previewDevices,
    totalDevices,
    operationsExecuted,
    showPreviewResults,
    setShowPreviewResults,
    isLoadingPreview,
    currentPage,
    pageSize,
    setPageSize,
    selectedIds,
    setSelectedIds,
    currentPageDevices,
    totalPages,
    handlePageChange,
    handleSelectAll,
    handleSelectDevice,
    loadPreview
  } = useDevicePreview(
    conditionTree,
    initialDevices,
    selectedDeviceIds,
    onDevicesSelected,
    onSelectionChange
  )

  // 4. Saved Inventories Management
  const {
    savedInventories,
    isLoadingInventories,
    isSavingInventory,
    loadSavedInventories,
    saveInventory,
    loadInventory,
    updateInventoryDetails,
    deleteInventory,
    exportInventory,
    importInventory
  } = useSavedInventories()

  // -- LOCAL UI STATE --

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const [showLogicalTreeModal, setShowLogicalTreeModal] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)

  // -- EFFECTS --

  // Sync with initial props
  useEffect(() => {
    if (initialConditions.length > 0) {
      const initialTree = flatConditionsToTree(initialConditions)
      setConditionTree(initialTree)
    }
  }, [initialConditions, flatConditionsToTree, setConditionTree])

  // -- HANDLERS --

  const handleOpenSaveModal = async () => {
    if (conditionTree.items.length === 0) {
      alert('Please add at least one condition before saving.')
      return
    }
    await loadSavedInventories()
    setShowSaveModal(true)
  }

  const handleOpenLoadModal = async () => {
    await loadSavedInventories()
    setShowLoadModal(true)
  }

  const handleOpenManageModal = async () => {
    await loadSavedInventories()
    setShowManageModal(true)
  }

  const handleSaveInventory = async (name: string, description: string, scope: string, isUpdate: boolean, existingId?: number) => {
    try {
      const success = await saveInventory(name, description, scope, conditionTree, isUpdate, existingId)
      return success
    } catch (e) {
      alert('Error saving inventory: ' + (e as Error).message)
      return false
    }
  }

  const handleLoadInventory = async (id: number) => {
    try {
      const loadedTree = await loadInventory(id)
      if (loadedTree) {
        setConditionTree(loadedTree)
        setShowPreviewResults(false)
        setShowLoadModal(false)
        // Notify parent component that an inventory was loaded
        onInventoryLoaded?.(id)
      }
    } catch (error) {
      alert('Error loading inventory: ' + (error as Error).message)
    }
  }

  const handleExportInventory = async (id: number) => {
    try {
      await exportInventory(id)
    } catch (error) {
      alert('Error exporting inventory: ' + (error as Error).message)
    }
  }

  const handleImportInventory = async (file: File) => {
    try {
      await importInventory(file)
      alert('Inventory imported successfully!')
      // Reload the list
      await loadSavedInventories()
    } catch (error) {
      alert('Error importing inventory: ' + (error as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <ConditionTreeBuilder
        conditionTree={conditionTree}
        setConditionTree={setConditionTree}
        currentGroupPath={currentGroupPath}
        setCurrentGroupPath={setCurrentGroupPath}
        addConditionToTree={addConditionToTree}
        addGroup={addGroup}
        removeItemFromTree={removeItemFromTree}
        updateGroupLogic={updateGroupLogic}
        findGroupPath={findGroupPath}

        currentField={currentField}
        setCurrentField={setCurrentField}
        currentOperator={currentOperator}
        setCurrentOperator={setCurrentOperator}
        currentValue={currentValue}
        setCurrentValue={setCurrentValue}
        currentLogic={currentLogic}
        setCurrentLogic={setCurrentLogic}
        currentNegate={currentNegate}
        setCurrentNegate={setCurrentNegate}

        fieldOptions={fieldOptions}
        operatorOptions={operatorOptions}
        fieldValues={fieldValues}
        customFields={customFields}
        locations={locations}
        locationSearchValue={locationSearchValue}
        setLocationSearchValue={setLocationSearchValue}
        showLocationDropdown={showLocationDropdown}
        setShowLocationDropdown={setShowLocationDropdown}

        handleFieldChange={handleFieldChange}
        handleOperatorChange={handleOperatorChange}
        handleCustomFieldSelect={handleCustomFieldSelect}
        selectedCustomField={selectedCustomField}

        isLoadingFieldValues={isLoadingFieldValues}
        isLoadingCustomFields={isLoadingCustomFields}

        onPreview={loadPreview}
        isLoadingPreview={isLoadingPreview}
        showActions={showActions}
        showSaveLoad={showSaveLoad}

        onOpenSaveModal={handleOpenSaveModal}
        onOpenLoadModal={handleOpenLoadModal}
        onOpenManageModal={handleOpenManageModal}
        onShowHelp={() => setShowHelpModal(true)}
        onShowLogicalTree={() => setShowLogicalTreeModal(true)}
      />

      <DeviceTable
        devices={previewDevices}
        totalDevices={totalDevices}
        operationsExecuted={operationsExecuted}
        showPreviewResults={showPreviewResults}
        enableSelection={enableSelection}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectDevice={handleSelectDevice}
        onClearSelection={() => setSelectedIds(new Set())}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        pageSize={pageSize}
        setPageSize={setPageSize}
        currentPageDevices={currentPageDevices}
      />

      {/* Modals */}
      <SaveInventoryModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveInventory}
        isSaving={isSavingInventory}
        savedInventories={savedInventories}
      />

      <LoadInventoryModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        savedInventories={savedInventories}
        isLoading={isLoadingInventories}
        onLoad={handleLoadInventory}
      />

      <ManageInventoryModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        savedInventories={savedInventories}
        isLoading={isLoadingInventories}
        onUpdate={updateInventoryDetails}
        onDelete={deleteInventory}
        onExport={handleExportInventory}
        onImport={handleImportInventory}
      />

      <LogicalTreeModal
        isOpen={showLogicalTreeModal}
        onClose={() => setShowLogicalTreeModal(false)}
        conditionTree={conditionTree}
      />

      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </div>
  )
}
