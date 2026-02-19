'use client'

import { useState, useCallback, useEffect, useRef, useMemo, Suspense } from 'react'
import { useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { FileCode, Play, Save, RefreshCw, HelpCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useTemplateMutations } from '@/components/features/settings/templates/hooks/use-template-mutations'
import type { TemplateFormData } from '@/components/features/settings/templates/types'
import { useApi } from '@/hooks/use-api'

import { useTemplateEditor } from '../hooks/use-template-editor'
import { useTemplateRender } from '../hooks/use-template-render'
import { useInventoryDevices } from '../hooks/use-inventory-devices'
import { useSnmpMappings } from '../hooks/use-snmp-mappings'
import type { VariableDefinition } from '../types'
import { GeneralPanel } from './general-panel'
import { AgentOptionsPanel } from './agent-options-panel'
import { NetmikoOptionsPanel } from './netmiko-options-panel'
import { VariablesPanel } from './variables-panel'
import { VariableValuesPanel } from './variable-values-panel'
import { CodeEditorPanel } from './code-editor-panel'
import { RenderedOutputDialog } from './rendered-output-dialog'
import { TemplateEditorHelpDialog } from './template-editor-help-dialog'
import { AddVariableDialog } from '../dialogs/add-variable-dialog'
import type { NetmikoExecuteResponse, NautobotDeviceDetails } from '../types'

function TemplateEditorContent() {
  const { toast } = useToast()
  const { apiCall } = useApi()
  const editor = useTemplateEditor()
  const renderer = useTemplateRender()
  const { createTemplate, updateTemplate } = useTemplateMutations()

  const [selectedVariableId, setSelectedVariableId] = useState<string | null>(null)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [addVariableDialogOpen, setAddVariableDialogOpen] = useState(false)
  const lastInventoryIdRef = useRef<number | null>(null)
  const hasUpdatedDataRef = useRef<boolean>(false)
  const lastCategoryRef = useRef<string>('__none__')
  const lastTestDeviceIdRef = useRef<string | null>(null)
  const hasRefreshedInventoryVarsRef = useRef<boolean>(false)

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
  const watchedPreRunCommand = useWatch({ control: editor.form.control, name: 'preRunCommand' })
  // Note: credentialId is used directly in handleRender via form.getValues()

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

  // Update inventory-type variables when inventory selection changes
  useEffect(() => {
    if (watchedCategory === 'agent' && watchedInventoryId) {
      // Update all inventory-type variables to use the new inventory ID
      editor.variableManager.updateInventoryIdForInventoryVariables(watchedInventoryId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateInventoryIdForInventoryVariables is stable from useCallback
  }, [watchedCategory, watchedInventoryId, editor.variableManager.updateInventoryIdForInventoryVariables])

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
        const deviceDetails = await apiCall<NautobotDeviceDetails>(`nautobot/devices/${watchedTestDeviceId}/details`)

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

  // After loading a saved template, refresh inventory-type variable values from live inventory
  // (stored values may be stale if the inventory changed since the template was last saved)
  useEffect(() => {
    if (!editor.isEditMode) return
    if (hasRefreshedInventoryVarsRef.current) return

    const inventoryVars = editor.variableManager.variables.filter(
      (v) => v.type === 'inventory' && v.metadata?.inventory_id && v.metadata?.inventory_data_type
    )
    if (inventoryVars.length === 0) return // not loaded yet — wait for next render

    hasRefreshedInventoryVarsRef.current = true

    // Group variables by inventory_id to minimize analyze calls
    const byInventoryId = new Map<number, typeof inventoryVars>()
    for (const v of inventoryVars) {
      const invId = v.metadata!.inventory_id!
      if (!byInventoryId.has(invId)) byInventoryId.set(invId, [])
      byInventoryId.get(invId)!.push(v)
    }

    // Fetch fresh data for each unique inventory and update variable values
    byInventoryId.forEach((vars, invId) => {
      apiCall<{ locations: string[]; tags: string[]; custom_fields: Record<string, string[]>; statuses: string[]; roles: string[] }>(
        `inventory/${invId}/analyze`
      )
        .then((data) => {
          const updates: Record<string, string> = {}
          for (const v of vars) {
            const dataType = v.metadata!.inventory_data_type!
            let freshValues: unknown
            if (dataType === 'custom_fields') {
              const cfKey = v.metadata!.inventory_custom_field
              freshValues = cfKey ? (data.custom_fields[cfKey] ?? []) : data.custom_fields
            } else {
              freshValues = (data as Record<string, unknown>)[dataType] ?? []
            }
            updates[v.name] = JSON.stringify(freshValues, null, 2)
          }
          editor.variableManager.updateInventoryVariableValues(updates)
        })
        .catch((err) => {
          console.warn('[WARN] [template-editor-page] Failed to refresh inventory variables for inventory', invId, err)
        })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run once when inventory vars first appear after template load
  }, [editor.isEditMode, editor.variableManager.variables])

  // Toggle pre_run variables when command is entered/cleared
  useEffect(() => {
    if (watchedCategory === 'netmiko') {
      const hasCommand = Boolean(watchedPreRunCommand && watchedPreRunCommand.trim().length > 0)
      editor.variableManager.togglePreRunVariables(hasCommand)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- togglePreRunVariables is stable from useCallback
  }, [watchedCategory, watchedPreRunCommand, editor.variableManager.togglePreRunVariables])

  const handleContentChange = useCallback(
    (value: string) => {
      editor.setContent(value)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setContent is stable from useCallback
    [editor.setContent]
  )

  const existingVariableNames = useMemo(
    () => editor.variableManager.variables.map((v) => v.name).filter(Boolean),
    [editor.variableManager.variables]
  )

  const handleOpenAddVariableDialog = useCallback(() => {
    setAddVariableDialogOpen(true)
  }, [])

  const handleAddVariableFromDialog = useCallback(
    (variable: VariableDefinition) => {
      const newId = editor.variableManager.addVariableWithMetadata(
        variable.name,
        variable.value,
        variable.type,
        variable.metadata
      )
      setSelectedVariableId(newId)
      toast({ title: 'Variable Added', description: `Variable "${variable.name}" has been added` })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addVariableWithMetadata is stable from useCallback
    [editor.variableManager.addVariableWithMetadata, toast]
  )

  const handleExecutePreRun = useCallback(async () => {
    const formData = editor.form.getValues()
    
    // Validate required fields
    if (!formData.preRunCommand || !formData.preRunCommand.trim()) {
      toast({
        title: 'Missing Command',
        description: 'Please enter a pre-run command in the Netmiko Options panel',
        variant: 'destructive',
      })
      return
    }

    if (!formData.testDeviceId) {
      toast({
        title: 'Missing Device',
        description: 'Please select a test device in the Netmiko Options panel',
        variant: 'destructive',
      })
      return
    }

    // Get device details to build the request
    const deviceVar = editor.variableManager.variables.find(v => v.name === 'devices')
    if (!deviceVar || !deviceVar.value) {
      toast({
        title: 'Device Data Not Available',
        description: 'Please ensure a test device is selected',
        variant: 'destructive',
      })
      return
    }

    try {
      const devices = JSON.parse(deviceVar.value)
      if (!devices || devices.length === 0) {
        throw new Error('No device data available')
      }

      const device = devices[0]
      const deviceIp = device.primary_ip4 || device.primary_ip6 || device.name

      // Set executing state for BOTH variables
      editor.variableManager.setPreRunExecuting('pre_run.raw', true)
      editor.variableManager.setPreRunExecuting('pre_run.parsed', true)

      // Get device details for platform information
      const deviceDetailsVar = editor.variableManager.variables.find(v => v.name === 'device_details')
      let platform = 'cisco_ios' // Default platform
      if (deviceDetailsVar && deviceDetailsVar.value) {
        try {
          const deviceDetails = JSON.parse(deviceDetailsVar.value)
          // Try to extract platform from device details
          platform = deviceDetails.platform?.slug || deviceDetails.platform?.name || 'cisco_ios'
        } catch (e) {
          console.warn('Could not parse device details for platform:', e)
        }
      }

      // Build the request payload - backend expects 'ip' or 'primary_ip4' and 'platform'
      // Always use textfsm to get both raw and parsed output
      const payload = {
        devices: [{ 
          ip: deviceIp,
          platform: platform,
          name: device.name || deviceIp,
        }],
        commands: [formData.preRunCommand],
        use_textfsm: true,  // Always true to get both raw and parsed
        enable_mode: false,
        write_config: false,
        session_id: crypto.randomUUID(),
        credential_id: undefined as number | undefined,
      }

      // Add credentials if provided
      if (formData.credentialId && formData.credentialId !== 'none') {
        payload.credential_id = parseInt(formData.credentialId)
      }

      // Execute the command
      const response = await apiCall<NetmikoExecuteResponse>(
        'netmiko/execute-commands',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      )

      // Process the response
      if (response.results && response.results.length > 0) {
        const result = response.results[0]
        
        if (!result) {
          throw new Error('No result returned from command execution')
        }
        
        if (!result.success) {
          throw new Error(result.error || 'Command execution failed')
        }

        // Update BOTH variables from the single response
        // 1. Update pre_run.raw with the raw output
        editor.variableManager.updatePreRunVariable('pre_run.raw', result.output || '')
        
        // 2. Update pre_run.parsed with parsed output (or fallback to raw)
        let parsedValue = ''
        if (result.command_outputs && Object.keys(result.command_outputs).length > 0) {
          // Get the first command's output (we only sent one command)
          const commandKey = Object.keys(result.command_outputs)[0]
          if (commandKey) {
            const parsedData = result.command_outputs[commandKey]
            parsedValue = typeof parsedData === 'string' 
              ? parsedData 
              : JSON.stringify(parsedData, null, 2)
          } else {
            // Fallback to raw output if no key found
            parsedValue = result.output || ''
          }
        } else {
          // Fallback to raw output if no parsed data
          parsedValue = result.output || ''
        }
        editor.variableManager.updatePreRunVariable('pre_run.parsed', parsedValue)

        toast({
          title: 'Command Executed Successfully',
          description: `Both pre_run.raw and pre_run.parsed have been populated`,
        })
      } else {
        throw new Error('No results returned from command execution')
      }
    } catch (error) {
      console.error('Error executing pre-run command:', error)
      // Reset executing state for BOTH variables
      editor.variableManager.setPreRunExecuting('pre_run.raw', false)
      editor.variableManager.setPreRunExecuting('pre_run.parsed', false)
      
      toast({
        title: 'Execution Failed',
        description: error instanceof Error ? error.message : 'Failed to execute pre-run command',
        variant: 'destructive',
      })
    }
  }, [editor.form, editor.variableManager, apiCall, toast])

  const handleRender = useCallback(async () => {
    const formData = editor.form.getValues()
    
    // Validate netmiko-specific requirements
    if (formData.category === 'netmiko') {
      // If there's a pre_run_command, a test device must be selected
      if (formData.preRunCommand && formData.preRunCommand.trim() && !formData.testDeviceId) {
        toast({
          title: 'Missing Test Device',
          description: 'Please select a test device when using pre-run commands',
          variant: 'destructive',
        })
        return
      }
    }
    
    await renderer.render({
      content: formData.content,
      category: formData.category,
      variables: editor.variableManager.variables,
      // Agent-specific
      inventoryId: formData.inventoryId,
      passSnmpMapping: formData.passSnmpMapping,
      path: formData.path,
      // Netmiko-specific
      deviceId: formData.testDeviceId,
      credentialId: formData.credentialId,
      preRunCommand: formData.preRunCommand,
      useNautobotContext: formData.useNautobotContext,
    })
  }, [editor.form, editor.variableManager.variables, renderer, toast])

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

    // Build the variables record from user-defined variables with metadata
    const variables: Record<string, { value: string; type: string; metadata?: unknown }> = {}
    for (const v of editor.variableManager.variables) {
      if (v.name && !v.isAutoFilled) {
        variables[v.name] = {
          value: v.value,
          type: v.type || 'custom',
          ...(v.metadata ? { metadata: v.metadata } : {}),
        }
      }
    }

    // Build template data with category-specific fields
    const templateData: Record<string, string | number | boolean | null | Record<string, unknown>> = {
      name: formData.name,
      source: 'webeditor' as const,
      template_type: formData.template_type,
      category: formData.category,
      description: formData.description,
      scope: formData.scope,
      content: formData.content,
      variables,
    }

    // Add category-specific fields
    if (formData.category === 'agent') {
      templateData.use_nautobot_context = formData.useNautobotContext
      templateData.pass_snmp_mapping = formData.passSnmpMapping
      templateData.inventory_id = formData.inventoryId
      templateData.file_path = formData.path || null
    } else if (formData.category === 'netmiko') {
      templateData.execution_mode = formData.netmikoMode
      templateData.pre_run_command = formData.preRunCommand || null
      templateData.credential_id = formData.credentialId !== 'none' && formData.credentialId ? parseInt(formData.credentialId) : null
      templateData.file_path = formData.netmikoMode === 'write_to_file' ? formData.path || null : null
    }

    try {
      if (editor.isEditMode && editor.templateId) {
        await updateTemplate.mutateAsync({
          templateId: editor.templateId,
          formData: templateData as unknown as TemplateFormData,
        })
      } else {
        await createTemplate.mutateAsync({
          formData: templateData as unknown as TemplateFormData,
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-purple-100 p-2 rounded-lg">
            <FileCode className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {editor.isEditMode ? 'Edit Template' : 'Template Editor'}
            </h1>
            <p className="text-muted-foreground mt-2">
              Create and edit Jinja2 templates with variable support and live preview
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setHelpDialogOpen(true)}
          className="border-purple-300 text-purple-700 hover:bg-purple-50"
          title="Help & Documentation"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
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
              onAddVariable={handleOpenAddVariableDialog}
              onRemoveVariable={editor.variableManager.removeVariable}
            />
          </div>
          <div className="flex-[3] min-h-0 overflow-hidden">
            <VariableValuesPanel
              variables={editor.variableManager.variables}
              selectedVariableId={selectedVariableId}
              onUpdateVariable={editor.variableManager.updateVariable}
              onExecutePreRun={watchedCategory === 'netmiko' ? handleExecutePreRun : undefined}
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

      {/* Help Dialog */}
      <TemplateEditorHelpDialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen} />

      {/* Add Variable Dialog */}
      <AddVariableDialog
        open={addVariableDialogOpen}
        onOpenChange={setAddVariableDialogOpen}
        onAdd={handleAddVariableFromDialog}
        existingVariableNames={existingVariableNames}
        category={watchedCategory}
        inventoryId={watchedInventoryId}
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
