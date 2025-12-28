/**
 * Refactored Ansible Inventory Page - Main Component
 * Uses shared DeviceSelector component and custom hooks for maintainability
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { List } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'

// Import shared DeviceSelector
import { DeviceSelector, type DeviceInfo, type LogicalCondition } from '@/components/shared/device-selector'

// Import custom hooks
import {
  useInventoryGeneration,
  useGitOperations,
} from './hooks'

// Import components
import { InventoryGenerationTab } from './tabs'

// Import dialogs
import { GitSuccessDialog } from './dialogs'

export default function AnsibleInventoryPage() {
  const { apiCall } = useApi()
  const { isAuthenticated, token } = useAuthStore()

  // Authentication state
  const [authReady, setAuthReady] = useState(false)

  // Device selection state (from DeviceSelector)
  const [previewDevices, setPreviewDevices] = useState<DeviceInfo[]>([])
  const [deviceConditions, setDeviceConditions] = useState<LogicalCondition[]>([])

  // Use custom hooks for state management
  const inventoryGeneration = useInventoryGeneration()
  const gitOperations = useGitOperations()

  // Authentication effect
  useEffect(() => {
    if (isAuthenticated && token && !authReady) {
      setAuthReady(true)
    }
  }, [isAuthenticated, token, authReady])

  // Load initial data once when authReady becomes true
  useEffect(() => {
    if (!authReady) return

    const loadInitialData = async () => {
      try {
        // Load template categories
        const categoriesResponse = await apiCall<string[]>('templates/categories')
        inventoryGeneration.setTemplateCategories(categoriesResponse)

        // Load git repositories
        const gitResponse = await apiCall<{
          repositories: Array<{id: number, name: string, url: string, branch: string}>
          total: number
        }>('ansible-inventory/git-repositories')
        gitOperations.setGitRepositories(gitResponse.repositories)
      } catch (error) {
        console.error('Error loading initial data:', error)
      }
    }

    loadInitialData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady])

  const handleDevicesSelected = (devices: DeviceInfo[], conditions: LogicalCondition[]) => {
    setPreviewDevices(devices)
    setDeviceConditions(conditions)
    inventoryGeneration.setShowTemplateSection(true)
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
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <List className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ansible Inventory Builder</h1>
            <p className="text-gray-600 mt-1">Build dynamic Ansible inventories using logical operations</p>
          </div>
        </div>
      </div>

      {/* Device Selector - replaces ConditionBuilderTab and PreviewResultsTab */}
      <Card>
        <CardHeader>
          <CardTitle>Select Devices</CardTitle>
          <CardDescription>
            Use logical operations to filter devices for inventory generation
          </CardDescription>
        </CardHeader>
      </Card>

      <DeviceSelector
        onDevicesSelected={handleDevicesSelected}
        showActions={true}
        showSaveLoad={true}
        enableSelection={false}
      />

      {/* Inventory Generation Tab */}
      {inventoryGeneration.showTemplateSection && (
        <InventoryGenerationTab
          inventoryGeneration={inventoryGeneration}
          gitOperations={gitOperations}
          previewDevices={previewDevices}
          deviceConditions={deviceConditions}
          apiCall={apiCall}
          token={token}
        />
      )}

      {/* Dialogs */}
      <GitSuccessDialog
        show={gitOperations.showGitSuccessModal}
        onClose={() => gitOperations.setShowGitSuccessModal(false)}
        result={gitOperations.gitPushResult}
      />
    </div>
  )
}
