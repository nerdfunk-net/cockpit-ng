/**
 * Refactored Ansible Inventory Page - Main Component
 * Uses extracted hooks, components, and utilities for better maintainability
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'

// Import custom hooks
import {
  useConditionBuilder,
  usePreviewResults,
  useInventoryGeneration,
  useGitOperations,
  useSavedInventories,
} from './hooks'

// Import components (to be created)
import { ConditionBuilderTab } from './tabs'
import { PreviewResultsTab } from './tabs'
import { InventoryGenerationTab } from './tabs'

// Import dialogs (to be created)
import { SaveInventoryDialog } from './dialogs'
import { LoadInventoryDialog } from './dialogs'
import { GitSuccessDialog } from './dialogs'
import { CustomFieldsDialog } from './dialogs'

// Import utilities
import { buildOperationsFromConditions } from './utils'

// Import types
import type { DeviceInfo, LogicalCondition } from './types'

export default function AnsibleInventoryPage() {
  const { apiCall } = useApi()
  const { isAuthenticated, token } = useAuthStore()

  // Authentication state
  const [authReady, setAuthReady] = useState(false)

  // Use custom hooks for state management
  const conditionBuilder = useConditionBuilder()
  const previewResults = usePreviewResults()
  const inventoryGeneration = useInventoryGeneration()
  const gitOperations = useGitOperations()
  const savedInventories = useSavedInventories()

  // Authentication effect
  useEffect(() => {
    if (isAuthenticated && token) {
      console.log('Ansible Inventory: Authentication ready')
      setAuthReady(true)
      loadInitialData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token])

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadFieldOptions(),
        loadTemplateCategories(),
        loadGitRepositories()
      ])
    } catch (error) {
      console.error('Error loading initial data:', error)
    }
  }

  const loadFieldOptions = async () => {
    try {
      const response = await apiCall<{
        fields: Array<{value: string, label: string}>
        operators: Array<{value: string, label: string}>
        logical_operations: Array<{value: string, label: string}>
      }>('ansible-inventory/field-options')
      
      conditionBuilder.setFieldOptions(response.fields)
      conditionBuilder.setOperatorOptions(response.operators)
      
      // Modify logic options display labels
      const modifiedLogicOptions = response.logical_operations.map(option => {
        if (option.value === 'not') {
          return { ...option, label: '& NOT' }
        }
        return option
      })
      conditionBuilder.setLogicOptions(modifiedLogicOptions)
    } catch (error) {
      console.error('Error loading field options:', error)
    }
  }

  const loadTemplateCategories = async () => {
    try {
      const response = await apiCall<string[]>('templates/categories')
      inventoryGeneration.setTemplateCategories(response)
    } catch (error) {
      console.error('Error loading template categories:', error)
    }
  }

  const loadGitRepositories = async () => {
    try {
      const response = await apiCall<{
        repositories: Array<{id: number, name: string, url: string, branch: string}>
        total: number
      }>('ansible-inventory/git-repositories')
      
      gitOperations.setGitRepositories(response.repositories)
    } catch (error) {
      console.error('Error loading Git repositories:', error)
      gitOperations.setGitRepositories([])
    }
  }

  const handlePreviewResults = async () => {
    if (conditionBuilder.conditions.length === 0) {
      alert('Please add at least one condition.')
      return
    }

    previewResults.setIsLoadingPreview(true)
    try {
      const operations = buildOperationsFromConditions(conditionBuilder.conditions)
      const response = await apiCall<{
        devices: DeviceInfo[]
        total_count: number
        operations_executed: number
      }>('ansible-inventory/preview', {
        method: 'POST',
        body: { operations }
      })

      previewResults.updatePreview(
        response.devices,
        response.total_count,
        response.operations_executed
      )
      inventoryGeneration.setShowTemplateSection(true)
    } catch (error) {
      console.error('Error previewing results:', error)
      alert('Error previewing results: ' + (error as Error).message)
    } finally {
      previewResults.setIsLoadingPreview(false)
    }
  }

  // Loading state
  if (!authReady) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
              Loading Ansible Inventory Builder
            </CardTitle>
            <CardDescription>
              Establishing authentication and initializing inventory tools...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ansible Inventory Builder</h1>
          <p className="text-gray-600">Build dynamic Ansible inventories using logical operations</p>
        </div>
      </div>

      {/* Condition Builder Tab */}
      <ConditionBuilderTab
        conditionBuilder={conditionBuilder}
        apiCall={apiCall}
        onPreview={handlePreviewResults}
        savedInventories={savedInventories}
      />

      {/* Preview Results Tab */}
      {previewResults.showPreviewResults && (
        <PreviewResultsTab
          previewResults={previewResults}
        />
      )}

      {/* Inventory Generation Tab */}
      {inventoryGeneration.showTemplateSection && (
        <InventoryGenerationTab
          inventoryGeneration={inventoryGeneration}
          gitOperations={gitOperations}
          previewResults={previewResults}
          conditionBuilder={conditionBuilder}
          apiCall={apiCall}
          token={token}
        />
      )}

      {/* Dialogs */}
      <CustomFieldsDialog
        show={inventoryGeneration.showCustomFieldsMenu}
        onClose={() => inventoryGeneration.setShowCustomFieldsMenu(false)}
        customFields={conditionBuilder.customFields}
      />

      <GitSuccessDialog
        show={gitOperations.showGitSuccessModal}
        onClose={() => gitOperations.setShowGitSuccessModal(false)}
        result={gitOperations.gitPushResult}
      />

      <SaveInventoryDialog
        show={savedInventories.showSaveModal}
        onClose={() => savedInventories.closeSaveModal()}
        conditions={conditionBuilder.conditions}
        savedInventories={savedInventories}
        apiCall={apiCall}
      />

      <LoadInventoryDialog
        show={savedInventories.showLoadModal}
        onClose={() => savedInventories.closeLoadModal()}
        savedInventories={savedInventories}
        apiCall={apiCall}
        onLoad={(loadedConditions: LogicalCondition[]) => {
          conditionBuilder.loadConditions(loadedConditions)
          previewResults.resetPreview()
          inventoryGeneration.setShowTemplateSection(false)
          inventoryGeneration.setShowInventorySection(false)
        }}
      />
    </div>
  )
}
