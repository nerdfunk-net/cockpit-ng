'use client'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { FileCode, Play, Save, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useTemplateMutations } from '@/components/features/settings/templates/hooks/use-template-mutations'
import { useApi } from '@/hooks/use-api'

import { useTemplateEditor } from '../hooks/use-template-editor'
import { useTemplateRender } from '../hooks/use-template-render'
import { useInventoryDevices } from '../hooks/use-inventory-devices'
import { useSnmpMappings } from '../hooks/use-snmp-mappings'
import { GeneralPanel } from './general-panel'
import { AgentOptionsPanel } from './agent-options-panel'
import { NetmikoOptionsPanel } from './netmiko-options-panel'
import { VariablesPanel } from './variables-panel'
import { VariableValuesPanel } from './variable-values-panel'
import { CodeEditorPanel } from './code-editor-panel'
import { RenderedOutputDialog } from './rendered-output-dialog'

function TemplateEditorContent() {
  const { toast } = useToast()
  const { apiCall } = useApi()
  const editor = useTemplateEditor()
  const renderer = useTemplateRender()
  const { createTemplate, updateTemplate } = useTemplateMutations()

  const [selectedVariableId, setSelectedVariableId] = useState<string | null>(null)
  const lastInventoryIdRef = useRef<number | null>(null)
  const hasUpdatedDataRef = useRef<boolean>(false)
  const lastCategoryRef = useRef<string>('__none__')
  const lastTestDeviceIdRef = useRef<string | null>(null)

  const watchedContent = useWatch({ control: editor.form.control, name: 'content' })
  const watchedTemplateType = useWatch({
    control: editor.form.control,
    name: 'template_type',
  })
  const watchedCategory = useWatch({ control: editor.form.control, name: 'category' })
  const watchedInventoryId = useWatch({ control: editor.form.control, name: 'inventoryId' })
  const watchedPath = useWatch({ control: editor.form.control, name: 'path' })
  const watchedPassSnmpMapping = useWatch({ control: editor.form.control, name: 'passSnmpMapping' })
  const watchedUseNautobotContext = useWatch({ control: editor.form.control, name: 'useNautobotContext' })
  const watchedTestDeviceId = useWatch({ control: editor.form.control, name: 'testDeviceId' })

  // Fetch inventory devices when category is agent and inventory is selected
  const inventoryDevices = useInventoryDevices(
    watchedInventoryId,
    watchedCategory === 'agent' && watchedInventoryId !== null
  )

  // Fetch SNMP mappings when category is agent
  const snmpMappings = useSnmpMappings(watchedCategory === 'agent')

  // Track category changes and reset data reload flags
  useEffect(() => {
    const categoryChanged = lastCategoryRef.current !== watchedCategory
    if (categoryChanged) {
      lastCategoryRef.current = watchedCategory
      // Reset flags to force reload when switching categories
      hasUpdatedDataRef.current = false
      lastTestDeviceIdRef.current = null
    }
  }, [watchedCategory])

  // Update variables with device data when inventory devices are loaded
  useEffect(() => {
    // Check if inventory ID has changed
    const inventoryChanged = lastInventoryIdRef.current !== watchedInventoryId
    if (inventoryChanged) {
      lastInventoryIdRef.current = watchedInventoryId
      hasUpdatedDataRef.current = false // Reset update flag for new inventory
    }

    // Update if we have data and haven't updated yet for this inventory
    if (watchedCategory === 'agent' && inventoryDevices.deviceCount > 0 && !hasUpdatedDataRef.current) {
      editor.variableManager.updateDeviceData({
        devices: inventoryDevices.devices,
        device_details: inventoryDevices.device_details,
      })
      hasUpdatedDataRef.current = true
    } else if (watchedCategory === 'agent' && watchedInventoryId === null) {
      // Clear device data when inventory is deselected
      editor.variableManager.updateDeviceData(null)
      hasUpdatedDataRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateDeviceData is stable from useCallback
  }, [watchedCategory, watchedInventoryId, inventoryDevices.deviceCount, inventoryDevices.devices, inventoryDevices.device_details, editor.variableManager.updateDeviceData])

  // Update snmp_mapping variable when SNMP mappings are loaded
  useEffect(() => {
    if (watchedCategory === 'agent' && !snmpMappings.isLoading) {
      editor.variableManager.updateSnmpMapping(snmpMappings.snmpMappings)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateSnmpMapping is stable from useCallback
  }, [watchedCategory, snmpMappings.isLoading, snmpMappings.snmpMappings, editor.variableManager.updateSnmpMapping])

  // Update path variable when path field changes
  useEffect(() => {
    if (watchedCategory === 'agent') {
      editor.variableManager.updatePath(watchedPath || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updatePath is stable from useCallback
  }, [watchedCategory, watchedPath, editor.variableManager.updatePath])

  // Toggle snmp_mapping variable based on checkbox
  useEffect(() => {
    if (watchedCategory === 'agent') {
      editor.variableManager.toggleSnmpMappingVariable(watchedPassSnmpMapping)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toggleSnmpMappingVariable is stable from useCallback
  }, [watchedCategory, watchedPassSnmpMapping, editor.variableManager.toggleSnmpMappingVariable])

  // Toggle device_details variable based on checkbox
  useEffect(() => {
    if (watchedCategory === 'agent') {
      editor.variableManager.toggleDeviceDetailsVariable(watchedUseNautobotContext)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toggleDeviceDetailsVariable is stable from useCallback
  }, [watchedCategory, watchedUseNautobotContext, editor.variableManager.toggleDeviceDetailsVariable])

  // Fetch device details for Netmiko test device
  useEffect(() => {
    if (watchedCategory !== 'netmiko' || !watchedTestDeviceId) {
      // Clear device data when no test device is selected
      if (watchedCategory === 'netmiko') {
        editor.variableManager.updateDeviceData(null)
      }
      return
    }

    // Skip if we've already fetched this device (unless category just changed)
    if (lastTestDeviceIdRef.current === watchedTestDeviceId) {
      return
    }

    const fetchDeviceDetails = async () => {
      try {
        const deviceDetails = await apiCall<any>(`nautobot/devices/${watchedTestDeviceId}/details`)
        
        // Build the devices array with simplified data
        const devices = [
          {
            id: deviceDetails.id,
            name: deviceDetails.name,
            primary_ip4: deviceDetails.primary_ip4?.address || null,
          },
        ]

        // Update variables with device data
        editor.variableManager.updateDeviceData({
          devices,
          device_details: deviceDetails,
        })
        
        // Update ref after successful fetch
        lastTestDeviceIdRef.current = watchedTestDeviceId
      } catch (error) {
        console.error('Error fetching device details:', error)
        editor.variableManager.updateDeviceData(null)
      }
    }

    fetchDeviceDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateDeviceData is stable from useCallback
  }, [watchedCategory, watchedTestDeviceId, apiCall, editor.variableManager.updateDeviceData])

  const handleContentChange = useCallback(
    (value: string) => {
      editor.setContent(value)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setContent is stable from useCallback
    [editor.setContent]
  )

  const handleRender = useCallback(async () => {
    const formData = editor.form.getValues()
    await renderer.render({
      content: formData.content,
      category: formData.category,
      variables: editor.variableManager.variables,
      inventoryId: formData.inventoryId,
      passSnmpMapping: formData.passSnmpMapping,
      path: formData.path,
    })
  }, [editor.form, editor.variableManager.variables, renderer])

  const handleSave = useCallback(async () => {
    const isValid = await editor.form.trigger()
    if (!isValid) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    const formData = editor.form.getValues()

    // Build the variables record from user-defined variables
    const variables: Record<string, string> = {}
    for (const v of editor.variableManager.variables) {
      if (v.name && !v.isAutoFilled) {
        variables[v.name] = v.value
      }
    }

    const templateData = {
      name: formData.name,
      source: 'webeditor' as const,
      template_type: formData.template_type,
      category: formData.category,
      description: formData.description,
      scope: formData.scope,
      content: formData.content,
      variables,
      use_nautobot_context: formData.category === 'agent',
    }

    try {
      if (editor.isEditMode && editor.templateId) {
        await updateTemplate.mutateAsync({
          templateId: editor.templateId,
          formData: templateData,
        })
      } else {
        await createTemplate.mutateAsync({
          formData: templateData,
        })
      }
    } catch {
      // Error toast handled by mutation hooks
    }
  }, [editor, createTemplate, updateTemplate, toast])

  if (editor.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-gray-600">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading template...</span>
        </div>
      </div>
    )
  }

  const isSaving = createTemplate.isPending || updateTemplate.isPending

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center space-x-3">
        <div className="bg-purple-100 p-2 rounded-lg">
          <FileCode className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {editor.isEditMode ? 'Edit Template' : 'Template Editor'}
          </h1>
          <p className="text-gray-600 mt-1">
            Create and edit Jinja2 templates with variable support and live preview
          </p>
        </div>
      </div>

      {/* General Panel */}
      <GeneralPanel form={editor.form} />

      {/* Agent Options (conditional) */}
      {watchedCategory === 'agent' && (
        <AgentOptionsPanel
          form={editor.form}
          isLoadingDevices={inventoryDevices.isLoading}
          deviceCount={inventoryDevices.deviceCount}
        />
      )}

      {/* Netmiko Options (conditional) */}
      {watchedCategory === 'netmiko' && (
        <NetmikoOptionsPanel form={editor.form} />
      )}

      {/* Main Split Area */}
      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-4" style={{ minHeight: '500px' }}>
        {/* Left: Variables */}
        <div className="flex flex-col overflow-hidden border rounded-lg shadow-sm bg-white">
          <div className="flex-[2] min-h-0 overflow-hidden">
            <VariablesPanel
              variables={editor.variableManager.variables}
              selectedVariableId={selectedVariableId}
              onSelectVariable={setSelectedVariableId}
              onAddVariable={editor.variableManager.addVariable}
              onRemoveVariable={editor.variableManager.removeVariable}
            />
          </div>
          <div className="flex-[3] min-h-0 overflow-hidden">
            <VariableValuesPanel
              variables={editor.variableManager.variables}
              selectedVariableId={selectedVariableId}
              onUpdateVariable={editor.variableManager.updateVariable}
            />
          </div>
        </div>

        {/* Right: Code Editor */}
        <div className="overflow-hidden border rounded-lg shadow-sm">
          <CodeEditorPanel
            value={watchedContent}
            onChange={handleContentChange}
            language={watchedTemplateType}
          />
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          variant="outline"
          onClick={handleRender}
          disabled={renderer.isRendering || !watchedContent.trim()}
          className="border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          {renderer.isRendering ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}
          {renderer.isRendering ? 'Rendering...' : 'Show Rendered Template'}
        </Button>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-green-600 hover:bg-green-700"
        >
          {isSaving && <RefreshCw className="h-4 w-4 animate-spin mr-1" />}
          <Save className="h-4 w-4 mr-1" />
          {editor.isEditMode ? 'Update Template' : 'Save Template'}
        </Button>
      </div>

      {/* Rendered Output Dialog */}
      <RenderedOutputDialog
        open={renderer.showDialog}
        onOpenChange={renderer.setShowDialog}
        result={renderer.renderResult}
      />
    </div>
  )
}

export function TemplateEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-gray-600">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading editor...</span>
          </div>
        </div>
      }
    >
      <TemplateEditorContent />
    </Suspense>
  )
}
