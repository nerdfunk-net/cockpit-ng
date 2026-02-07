'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Edit, RefreshCw } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { useVariableManager } from '@/components/features/network/automation/netmiko/hooks/use-variable-manager'
import { VariableManagerPanel } from '@/components/features/network/automation/netmiko/components/variable-manager-panel'
import { DeviceSearchPanel } from './device-search-panel'
import { PreRunCommandPanel } from './pre-run-command-panel'
import { TemplateRenderResultDialog, type TemplateRenderResult } from '@/components/features/network/automation/netmiko/dialogs/template-render-result-dialog'
import { NautobotDataDialog } from '@/components/features/network/automation/netmiko/dialogs/nautobot-data-dialog'
import { useTemplatesMutations } from '../hooks/use-templates-mutations'
import type { Template, DeviceSearchResult } from '../types/templates'
import { DEFAULT_FILE_PATH } from '../utils/template-constants'

interface TemplateFormProps {
  editingTemplate: Template | null
  isAdmin: boolean
  onComplete: () => void
}

export function TemplateForm({
  editingTemplate,
  isAdmin,
  onComplete,
}: TemplateFormProps) {
  const { apiCall } = useApi()
  const { toast } = useToast()
  const variableManager = useVariableManager()
  const { createTemplate, updateTemplate, renderTemplate } = useTemplatesMutations()

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    scope: (isAdmin ? 'global' : 'private') as 'global' | 'private',
    execution_mode: 'run_on_device' as 'run_on_device' | 'write_to_file' | 'sync_to_nautobot'
  })

  // Device search state
  const [selectedDevice, setSelectedDevice] = useState<DeviceSearchResult | null>(null)

  // Dialog state
  const [showNautobotDataDialog, setShowNautobotDataDialog] = useState(false)
  const [nautobotData, setNautobotData] = useState<Record<string, unknown> | null>(null)
  const [showRenderResultDialog, setShowRenderResultDialog] = useState(false)
  const [renderResult, setRenderResult] = useState<TemplateRenderResult | null>(null)

  // Pre-run command state
  const [preRunCommand, setPreRunCommand] = useState('')
  const [selectedCredentialId, setSelectedCredentialId] = useState<number | null>(null)

  // File path state
  const [filePath, setFilePath] = useState(DEFAULT_FILE_PATH)

  const handleFormChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const variablesToObject = useCallback((): Record<string, string> => {
    const varsObject: Record<string, string> = {}
    variableManager.variables.forEach(v => {
      if (v.name && variableManager.validateVariableName(v.name)) {
        varsObject[v.name] = v.value
      }
    })
    return varsObject
  }, [variableManager])

  const objectToVariables = (obj: Record<string, string> | undefined) => {
    if (!obj || Object.keys(obj).length === 0) {
      return [{ id: crypto.randomUUID(), name: '', value: '' }]
    }
    return Object.entries(obj).map(([name, value]) => ({
      id: crypto.randomUUID(),
      name,
      value
    }))
  }

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      content: '',
      scope: isAdmin ? 'global' : 'private',
      execution_mode: 'run_on_device'
    })
    variableManager.setVariables([{ id: crypto.randomUUID(), name: '', value: '' }])
    variableManager.setUseNautobotContext(false)
    setSelectedDevice(null)
    setPreRunCommand('')
    setSelectedCredentialId(null)
    setFilePath(DEFAULT_FILE_PATH)
  }, [isAdmin, variableManager])

  // Populate form when editingTemplate changes (parent loads full template via API)
  useEffect(() => {
    if (editingTemplate) {
      setFormData({
        name: editingTemplate.name,
        description: editingTemplate.description || '',
        content: editingTemplate.content || '',
        scope: editingTemplate.scope || 'global',
        execution_mode: editingTemplate.execution_mode || 'run_on_device'
      })
      variableManager.setVariables(objectToVariables(editingTemplate.variables))
      variableManager.setUseNautobotContext(editingTemplate.use_nautobot_context || false)
      setPreRunCommand(editingTemplate.pre_run_command || '')
      setSelectedCredentialId(editingTemplate.credential_id || null)
      setFilePath(editingTemplate.file_path || DEFAULT_FILE_PATH)
    }
  // Only run when editingTemplate identity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTemplate])

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast({ title: 'Validation', description: 'Please fill in name and content', variant: 'destructive' })
      return
    }

    if (formData.execution_mode === 'write_to_file' && !filePath.trim()) {
      toast({ title: 'Validation', description: 'Please enter a file path for write_to_file mode', variant: 'destructive' })
      return
    }

    const templateData = {
      name: formData.name,
      source: 'webeditor',
      template_type: 'jinja2',
      category: 'netmiko',
      description: formData.description,
      content: formData.content,
      scope: formData.scope,
      variables: variablesToObject(),
      use_nautobot_context: variableManager.useNautobotContext,
      pre_run_command: preRunCommand || undefined,
      credential_id: selectedCredentialId,
      execution_mode: formData.execution_mode,
      file_path: formData.execution_mode === 'write_to_file' ? filePath : undefined
    }

    createTemplate.mutate(templateData, {
      onSuccess: () => {
        resetForm()
        onComplete()
      },
    })
  }

  const handleUpdate = async () => {
    if (!editingTemplate) return

    if (formData.execution_mode === 'write_to_file' && !filePath.trim()) {
      toast({ title: 'Validation', description: 'Please enter a file path for write_to_file mode', variant: 'destructive' })
      return
    }

    updateTemplate.mutate({
      id: editingTemplate.id,
      data: {
        name: formData.name,
        description: formData.description,
        content: formData.content,
        scope: formData.scope,
        variables: variablesToObject(),
        use_nautobot_context: variableManager.useNautobotContext,
        pre_run_command: preRunCommand || undefined,
        credential_id: selectedCredentialId,
        execution_mode: formData.execution_mode,
        file_path: formData.execution_mode === 'write_to_file' ? filePath : undefined
      }
    }, {
      onSuccess: () => {
        resetForm()
        onComplete()
      },
    })
  }

  const handleShowNautobotData = async () => {
    if (!selectedDevice) {
      toast({ title: 'Info', description: 'Please select a device first', variant: 'destructive' })
      return
    }

    try {
      const response = await apiCall<Record<string, unknown>>(`nautobot/devices/${selectedDevice.id}/details`)
      setNautobotData(response)
      setShowNautobotDataDialog(true)
    } catch (error) {
      toast({ title: 'Error', description: 'Error fetching Nautobot data: ' + (error as Error).message, variant: 'destructive' })
    }
  }

  const handleRenderTemplate = async () => {
    if (!formData.content.trim()) {
      toast({ title: 'Validation', description: 'Please enter template content first', variant: 'destructive' })
      return
    }

    if (!selectedDevice) {
      toast({ title: 'Validation', description: 'Please select a device to render the template', variant: 'destructive' })
      return
    }

    if (preRunCommand.trim() && !selectedCredentialId) {
      toast({ title: 'Validation', description: 'Please select credentials for the pre-run command', variant: 'destructive' })
      return
    }

    const varsObject = variablesToObject()

    renderTemplate.mutate({
      template_content: formData.content,
      category: 'netmiko',
      device_id: selectedDevice.id,
      user_variables: varsObject,
      use_nautobot_context: variableManager.useNautobotContext,
      ...(preRunCommand.trim() && {
        pre_run_command: preRunCommand.trim(),
        credential_id: selectedCredentialId
      })
    }, {
      onSuccess: (response) => {
        setRenderResult({
          success: true,
          rendered_content: response.rendered_content,
          variables_used: response.variables_used,
          context_data: response.context_data,
          warnings: response.warnings
        })
        setShowRenderResultDialog(true)
      },
      onError: (error: unknown) => {
        let errorMessage = 'Unknown error'
        let errorDetails: string[] = []

        if (error && typeof error === 'object') {
          if ('message' in error && typeof (error as Error).message === 'string') {
            errorMessage = (error as Error).message
          }
          if ('details' in error && Array.isArray((error as Record<string, unknown>).details)) {
            errorDetails = (error as Record<string, unknown>).details as string[]
          }
        }

        setRenderResult({
          success: false,
          error_title: 'Template Rendering Failed',
          error_message: errorMessage,
          error_details: errorDetails.length > 0 ? errorDetails : undefined,
          context_data: {
            user_variables: varsObject,
            use_nautobot_context: variableManager.useNautobotContext,
            device_id: selectedDevice.id
          }
        })
        setShowRenderResultDialog(true)
      },
    })
  }

  const isPending = createTemplate.isPending || updateTemplate.isPending

  return (
    <>
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            {editingTemplate ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span className="text-sm font-medium">
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </span>
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              placeholder="e.g., interface-configuration"
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Brief description of this template"
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
            />
          </div>

          {/* Pre-run Command Panel */}
          <PreRunCommandPanel
            command={preRunCommand}
            onCommandChange={setPreRunCommand}
            credentialId={selectedCredentialId}
            onCredentialChange={setSelectedCredentialId}
          />

          {/* Mode Selection */}
          <div className="space-y-2 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <Label htmlFor="execution_mode" className="text-sm font-medium text-blue-900">Mode *</Label>
            <Select
              value={formData.execution_mode}
              onValueChange={(value) => handleFormChange('execution_mode', value)}
            >
              <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                <SelectValue placeholder="Select mode..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="run_on_device">Run on Device</SelectItem>
                <SelectItem value="write_to_file">Write to File</SelectItem>
                <SelectItem value="sync_to_nautobot">Sync to Nautobot</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-blue-700">
              Select how this template will be used when executed
            </p>
          </div>

          {/* File Path */}
          {formData.execution_mode === 'write_to_file' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-amber-900">File Path *</span>
              </div>

              <div className="bg-amber-100/50 border border-amber-200 rounded-md px-3 py-2 space-y-1">
                <p className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-semibold">Available variables:</span>
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Template: {'{template_name}'}
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Device: {'{device_name}'}, {'{hostname}'}, {'{serial}'}, {'{asset_tag}'}
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Location: {'{location.name}'}, {'{location.parent.name}'}, {'{location.parent.parent.name}'}
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Platform: {'{platform.name}'}, {'{platform.manufacturer.name}'}, {'{device_type.model}'}
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Other: {'{role.name}'}, {'{status.name}'}, {'{tenant.name}'}, {'{rack.name}'}, {'{custom_field_data.FIELD_NAME}'}
                </p>
              </div>

              <div className="space-y-2">
                <Input
                  id="file-path"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="templates/{device_name}-{template_name}.txt"
                  className="h-9 bg-white border-amber-200 font-mono text-sm focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* Template Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Template Content (Jinja2) *</Label>
            <Textarea
              id="content"
              placeholder="Enter your Jinja2 template here...&#10;&#10;Example:&#10;interface {{ user_variables.interface_name }}&#10; description {{ nautobot.name }}"
              value={formData.content}
              onChange={(e) => handleFormChange('content', e.target.value)}
              rows={15}
              className="font-mono text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
            />
            <p className="text-xs text-gray-500">
              Use <code className="bg-gray-100 px-1 rounded">{'{{ user_variables.var_name }}'}</code> for user variables
              and <code className="bg-gray-100 px-1 rounded">{'{{ nautobot.field }}'}</code> for device data
            </p>
          </div>

          {/* Template Variables Panel */}
          <VariableManagerPanel
            variables={variableManager.variables}
            useNautobotContext={variableManager.useNautobotContext}
            setUseNautobotContext={variableManager.setUseNautobotContext}
            addVariable={variableManager.addVariable}
            removeVariable={variableManager.removeVariable}
            updateVariable={variableManager.updateVariable}
            validateVariableName={variableManager.validateVariableName}
          />

          {/* Device Selection */}
          <DeviceSearchPanel
            selectedDevice={selectedDevice}
            onDeviceSelect={setSelectedDevice}
            onDeviceClear={() => setSelectedDevice(null)}
            onShowNautobotData={handleShowNautobotData}
            onRenderTemplate={handleRenderTemplate}
            canRender={!!formData.content.trim() && !!selectedDevice}
            isRendering={renderTemplate.isPending}
          />

          {/* Scope */}
          {isAdmin && (
            <div className="flex items-center space-x-2 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <Checkbox
                id="scope"
                checked={formData.scope === 'global'}
                onCheckedChange={(checked) => handleFormChange('scope', checked ? 'global' : 'private')}
              />
              <div className="flex-1">
                <label htmlFor="scope" className="text-sm font-medium cursor-pointer text-blue-900">
                  Make this template global
                </label>
                <p className="text-xs text-blue-700 mt-1">
                  Global templates are visible to all users. Uncheck to keep it private (visible only to you).
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm()
                  onComplete()
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={editingTemplate ? handleUpdate : handleCreate}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isPending}
              >
                {isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <NautobotDataDialog
        open={showNautobotDataDialog}
        onOpenChange={setShowNautobotDataDialog}
        nautobotData={nautobotData}
      />

      <TemplateRenderResultDialog
        open={showRenderResultDialog}
        onOpenChange={setShowRenderResultDialog}
        result={renderResult}
      />
    </>
  )
}
