'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, FileText, Loader2 } from 'lucide-react'
import { useJobTemplates, useJobTypes, useConfigRepos, useSavedInventories, useCommandTemplates, useCustomFields } from '../hooks/use-template-queries'
import { TemplateFormDialog } from './template-form-dialog'
import { TemplatesTable } from './templates-table'
import type { JobTemplate, JobType, GitRepository, SavedInventory, CommandTemplate, CustomField } from '../types'

// Constants for default parameters to prevent re-render loops
const EMPTY_TEMPLATES: JobTemplate[] = []
const EMPTY_JOB_TYPES: JobType[] = []
const EMPTY_CONFIG_REPOS: GitRepository[] = []
const EMPTY_INVENTORIES: SavedInventory[] = []
const EMPTY_COMMAND_TEMPLATES: CommandTemplate[] = []
const EMPTY_CUSTOM_FIELDS: CustomField[] = []

export function JobTemplatesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null)

  // TanStack Query hooks - replaces ALL manual state management
  const { data: templates = EMPTY_TEMPLATES, isLoading } = useJobTemplates()
  const { data: jobTypes = EMPTY_JOB_TYPES } = useJobTypes()
  const { data: configRepos = EMPTY_CONFIG_REPOS } = useConfigRepos()
  const { data: savedInventories = EMPTY_INVENTORIES, isLoading: loadingInventories } = useSavedInventories()
  const { data: commandTemplates = EMPTY_COMMAND_TEMPLATES } = useCommandTemplates()
  const { data: customFields = EMPTY_CUSTOM_FIELDS } = useCustomFields()

  const handleEditTemplate = (template: JobTemplate) => {
    setEditingTemplate(template)
    setIsDialogOpen(true)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingTemplate(null)
  }

  const handleSaved = () => {
    // Nothing needed - TanStack Query handles refetch automatically
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Job Templates</h1>
            <p className="text-muted-foreground mt-2">
              Create and manage reusable job templates for the scheduler
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditingTemplate(null)
            setIsDialogOpen(true)
          }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Templates Table or Empty State */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-xl font-semibold text-gray-700 mb-2">No job templates yet</p>
            <p className="text-gray-500 mb-4">
              Create your first job template to use in the scheduler
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Job Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TemplatesTable templates={templates} onEdit={handleEditTemplate} />
      )}

      {/* Form Dialog */}
      <TemplateFormDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        editingTemplate={editingTemplate}
        jobTypes={jobTypes}
        configRepos={configRepos}
        savedInventories={savedInventories}
        commandTemplates={commandTemplates}
        customFields={customFields}
        loadingInventories={loadingInventories}
        onSaved={handleSaved}
      />
    </div>
  )
}
