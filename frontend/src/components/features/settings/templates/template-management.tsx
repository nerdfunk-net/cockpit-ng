'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { FileCode, Download, Plus } from 'lucide-react'
import { TemplatesList } from './components/templates-list'
import { ImportTemplates } from './components/import-templates'
import { TemplateViewDialog } from './components/template-view-dialog'
import type { Template } from './types'

export default function TemplateManagement() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('list')
  const [viewingTemplateId, setViewingTemplateId] = useState<number | null>(null)

  const handleEdit = (template: Template) => {
    // Navigate to editor with template ID
    router.push(`/settings/templates/editor?id=${template.id}`)
  }

  const handleView = (templateId: number) => {
    setViewingTemplateId(templateId)
  }

  const handleCreateNew = () => {
    router.push('/settings/templates/editor')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-2 rounded-lg">
              <FileCode className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Templates - List & Import</h1>
              <p className="text-muted-foreground mt-2">Manage and import configuration templates for network devices</p>
            </div>
          </div>
          <Button
            onClick={handleCreateNew}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Template
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list" className="flex items-center space-x-2">
            <FileCode className="h-4 w-4" />
            <span>Templates List</span>
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Import Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <TemplatesList onEdit={handleEdit} onView={handleView} />
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
    </div>
  )
}
