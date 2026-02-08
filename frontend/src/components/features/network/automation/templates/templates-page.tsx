'use client'

import { useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileCode } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'

// TanStack Query hooks
import { useTemplatesQuery } from './hooks/use-templates-queries'
import { useTemplatesMutations } from './hooks/use-templates-mutations'

// Feature components
import { TemplateList } from './components/template-list'
import { TemplateForm } from './components/template-form'
import { TemplateViewDialog } from './dialogs/template-view-dialog'
import { HelpAndExamplesContent } from './components/help-and-examples'

import type { Template } from './types/templates'

const EMPTY_ARRAY: Template[] = []

export function TemplatesPage() {
  const user = useAuthStore((state) => state.user)
  const username = user?.username
  const permissions = typeof user?.permissions === 'number' ? user.permissions : 0
  const isAdmin = (permissions & 16) !== 0

  const { apiCall } = useApi()
  const { toast } = useToast()

  // Data
  const { data: templates = EMPTY_ARRAY, isLoading } = useTemplatesQuery({ category: 'netmiko' })
  const { deleteTemplate } = useTemplatesMutations()

  // UI state
  const [activeTab, setActiveTab] = useState('list')
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null)

  // Handlers
  const handleEdit = useCallback(async (template: Template) => {
    try {
      const response = await apiCall<Template>(`templates/${template.id}`)
      setEditingTemplate(response)
      setActiveTab('create')
    } catch {
      toast({ title: 'Error', description: 'Failed to load template for editing', variant: 'destructive' })
    }
  }, [apiCall, toast])

  const handleView = useCallback(async (templateId: number) => {
    try {
      const response = await apiCall<Template>(`templates/${templateId}`)
      setViewingTemplate(response)
      setViewDialogOpen(true)
    } catch {
      toast({ title: 'Error', description: 'Failed to view template', variant: 'destructive' })
    }
  }, [apiCall, toast])

  const handleDelete = useCallback((templateId: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    deleteTemplate.mutate(templateId)
  }, [deleteTemplate])

  const handleFormComplete = useCallback(() => {
    setEditingTemplate(null)
    setActiveTab('list')
  }, [])

  const handleViewEditClick = useCallback(() => {
    if (viewingTemplate) {
      setViewDialogOpen(false)
      handleEdit(viewingTemplate)
    }
  }, [viewingTemplate, handleEdit])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <FileCode className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Netmiko Templates</h1>
            <p className="text-gray-600 mt-1">Create and manage your Jinja2 templates for network automation</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">My Templates</TabsTrigger>
          <TabsTrigger value="create">{editingTemplate ? 'Edit Template' : 'Create Template'}</TabsTrigger>
          <TabsTrigger value="help">Help & Examples</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <TemplateList
            templates={templates}
            isLoading={isLoading}
            username={username}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <TemplateForm
            editingTemplate={editingTemplate}
            isAdmin={isAdmin}
            onComplete={handleFormComplete}
          />
        </TabsContent>

        <TabsContent value="help" className="space-y-6">
          <HelpAndExamplesContent />
        </TabsContent>
      </Tabs>

      {/* View Template Dialog */}
      <TemplateViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        template={viewingTemplate}
        canEdit={viewingTemplate?.created_by === username}
        onEdit={handleViewEditClick}
      />
    </div>
  )
}
