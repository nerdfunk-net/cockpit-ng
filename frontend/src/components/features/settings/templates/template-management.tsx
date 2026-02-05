'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileCode, Plus, Download } from 'lucide-react'
import { TemplatesList } from './components/templates-list'
import { TemplateForm } from './components/template-form'
import { ImportTemplates } from './components/import-templates'
import { TemplateViewDialog } from './components/template-view-dialog'
import { LoadInventoryDialog } from '@/components/features/general/inventory/dialogs/load-inventory-dialog'
import type { Template } from './types'
import type { SavedInventory } from '@/hooks/queries/use-saved-inventories-queries'
import { useApi } from '@/hooks/use-api'
import { useCallback } from 'react'

export default function TemplateManagement() {
  const { apiCall } = useApi()
  const [activeTab, setActiveTab] = useState('list')
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [viewingTemplateId, setViewingTemplateId] = useState<number | null>(null)
  const [selectedInventory, setSelectedInventory] = useState<{ id: number; name: string } | null>(null)
  const [showInventoryDialog, setShowInventoryDialog] = useState(false)
  const [inventories, setInventories] = useState<SavedInventory[]>([])
  const [isLoadingInventories, setIsLoadingInventories] = useState(false)

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setActiveTab('create')
  }

  const handleView = (templateId: number) => {
    setViewingTemplateId(templateId)
  }

  const handleFormSuccess = () => {
    // Keep form as-is after update
  }

  const handleFormCancel = () => {
    setActiveTab('list')
    // Clear editing template after tab switch to avoid flash of wrong content
    setTimeout(() => setEditingTemplate(null), 100)
  }

  const handleInventorySelected = (inventory: SavedInventory) => {
    setSelectedInventory({ id: inventory.id, name: inventory.name })
    setShowInventoryDialog(false)
  }

  const loadInventories = useCallback(async () => {
    setIsLoadingInventories(true)
    try {
      const response = await apiCall<{ inventories: SavedInventory[] }>('inventory')
      setInventories(response.inventories || [])
    } catch (error) {
      console.error('Failed to load inventories:', error)
    } finally {
      setIsLoadingInventories(false)
    }
  }, [apiCall])

  const handleDeleteInventory = useCallback(async (inventoryId: number) => {
    try {
      await apiCall(`inventory/${inventoryId}`, { method: 'DELETE' })
      await loadInventories()
    } catch (error) {
      console.error('Failed to delete inventory:', error)
    }
  }, [apiCall, loadInventories])

  const handleSelectInventory = () => {
    loadInventories()
    setShowInventoryDialog(true)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <FileCode className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Template Management</h1>
            <p className="text-gray-600">Manage configuration templates for network devices</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list" className="flex items-center space-x-2">
            <FileCode className="h-4 w-4" />
            <span>Templates List</span>
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Create Template</span>
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Import Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <TemplatesList onEdit={handleEdit} onView={handleView} />
        </TabsContent>

        <TabsContent value="create">
          <TemplateForm
            template={editingTemplate}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
            onSelectInventory={handleSelectInventory}
            selectedInventory={selectedInventory}
          />
        </TabsContent>

        <TabsContent value="import">
          <ImportTemplates />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <TemplateViewDialog
        templateId={viewingTemplateId}
        onClose={() => setViewingTemplateId(null)}
      />

      <LoadInventoryDialog
        show={showInventoryDialog}
        onClose={() => setShowInventoryDialog(false)}
        onLoad={handleInventorySelected}
        onDelete={handleDeleteInventory}
        inventories={inventories}
        isLoading={isLoadingInventories}
      />
    </div>
  )
}
