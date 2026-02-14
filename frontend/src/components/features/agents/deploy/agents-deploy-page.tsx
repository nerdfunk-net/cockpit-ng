'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { GitCommit } from 'lucide-react'

// Tabs
import { DeviceSelectionTab } from './tabs/device-selection-tab'
import { VariablesAndTemplatesTab } from './tabs/variables-and-templates-tab'
import { DeployTab } from './tabs/deploy-tab'

// Hooks
import { useTemplateManager } from './hooks/use-template-manager'
import { useVariableManager } from './hooks/use-variable-manager'
import { useAgentSelector } from './hooks/use-agent-selector'
import { useDeployExecution } from './hooks/use-deploy-execution'

// Dialogs
import { DryRunResultDialog } from './dialogs/dry-run-result-dialog'
import { ErrorDialog } from './dialogs/error-dialog'

// Types
import type { DeviceInfo } from '@/components/shared/device-selector'
import type { DeployConfig } from './types'

const EMPTY_DEVICES: DeviceInfo[] = []

interface ErrorDetails {
  title: string
  message: string
  details?: string[]
}

export function AgentsDeployPage() {
  const { toast } = useToast()

  // Device selection state
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])
  const [selectedDevices, setSelectedDevices] = useState<DeviceInfo[]>(EMPTY_DEVICES)
  const [selectedInventoryId, setSelectedInventoryId] = useState<number | null>(null)
  const [deployPath, setDeployPath] = useState<string>('')

  // Initialize hooks
  const templateManager = useTemplateManager('agent')
  const variableManager = useVariableManager()
  const agentSelector = useAgentSelector()
  const deployExecution = useDeployExecution()

  // Error dialog state
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null)

  // Clear variable overrides when template changes
  useEffect(() => {
    variableManager.clearOverrides()
  }, [templateManager.selectedTemplateId, variableManager])

  // Update deployPath when template changes (use template's file_path as default)
  useEffect(() => {
    if (templateManager.selectedTemplate?.file_path) {
      setDeployPath(templateManager.selectedTemplate.file_path)
    } else {
      setDeployPath('')
    }
  }, [templateManager.selectedTemplate])

  // Check if execution is allowed
  const canExecute = useMemo(() =>
    selectedDeviceIds.length > 0 &&
    templateManager.selectedTemplateId !== 'none' &&
    agentSelector.selectedAgentId !== null,
    [selectedDeviceIds.length, templateManager.selectedTemplateId, agentSelector.selectedAgentId]
  )

  // Build config for API calls
  const buildDeployConfig = useCallback((): DeployConfig => ({
    deviceIds: selectedDeviceIds,
    templateId: Number(templateManager.selectedTemplateId),
    variables: variableManager.variableOverrides,
    agentId: agentSelector.selectedAgentId!,
    path: deployPath || undefined,
    inventoryId: selectedInventoryId || undefined
  }), [
    selectedDeviceIds,
    templateManager.selectedTemplateId,
    variableManager.variableOverrides,
    agentSelector.selectedAgentId,
    deployPath,
    selectedInventoryId
  ])

  // Action handlers
  const handleDryRun = useCallback(async () => {
    try {
      // Validate that we have a selected template
      if (!templateManager.selectedTemplate) {
        setErrorDetails({
          title: 'Dry Run Failed',
          message: 'No template selected',
          details: ['Please select a template before running dry run']
        })
        setShowErrorDialog(true)
        return
      }

      const config = buildDeployConfig()
      await deployExecution.executeDryRun(
        config,
        templateManager.editedTemplateContent,
        templateManager.selectedTemplate.inventory_id,
        templateManager.selectedTemplate.pass_snmp_mapping
      )
    } catch (error) {
      setErrorDetails({
        title: 'Dry Run Failed',
        message: 'Failed to render template',
        details: [(error as Error).message]
      })
      setShowErrorDialog(true)
    }
  }, [buildDeployConfig, deployExecution, templateManager])

  const handleDeployToGit = useCallback(async () => {
    try {
      const config = buildDeployConfig()
      const response = await deployExecution.executeDeployToGit(config)
      toast({
        title: 'Success',
        description: response?.message || 'Configuration deployed to git repository'
      })
    } catch (error) {
      setErrorDetails({
        title: 'Deploy Failed',
        message: 'Failed to deploy configuration to git',
        details: [(error as Error).message]
      })
      setShowErrorDialog(true)
    }
  }, [buildDeployConfig, deployExecution, toast])

  const handleActivate = useCallback(async () => {
    try {
      const config = buildDeployConfig()
      const response = await deployExecution.executeActivate(config)
      toast({
        title: 'Success',
        description: response?.message || 'Container restarted successfully'
      })
    } catch (error) {
      setErrorDetails({
        title: 'Activation Failed',
        message: 'Failed to restart docker container',
        details: [(error as Error).message]
      })
      setShowErrorDialog(true)
    }
  }, [buildDeployConfig, deployExecution, toast])

  const handleDevicesSelected = useCallback((devices: DeviceInfo[]) => {
    setSelectedDeviceIds(devices.map(d => d.id))
    setSelectedDevices(devices)
    deployExecution.resetResults()
  }, [deployExecution])

  const handleInventoryLoaded = useCallback((inventoryId: number) => {
    setSelectedInventoryId(inventoryId)
  }, [])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <GitCommit className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Agents Deploy</h1>
            <p className="text-muted-foreground mt-2">Deploy Telegraf/InfluxDB/Grafana configurations to devices</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="devices" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="devices">Devices</TabsTrigger>
              <TabsTrigger value="variables">Variables & Templates</TabsTrigger>
              <TabsTrigger value="deploy">Deploy</TabsTrigger>
            </TabsList>

            <TabsContent value="devices">
              <DeviceSelectionTab
                selectedDeviceIds={selectedDeviceIds}
                selectedDevices={selectedDevices}
                onDevicesSelected={handleDevicesSelected}
                onInventoryLoaded={handleInventoryLoaded}
              />
            </TabsContent>

            <TabsContent value="variables">
              <VariablesAndTemplatesTab
                templates={templateManager.templates}
                selectedTemplateId={templateManager.selectedTemplateId}
                selectedTemplate={templateManager.selectedTemplate}
                isLoadingTemplate={templateManager.isLoadingTemplate}
                onTemplateChange={templateManager.handleTemplateChange}
                editedTemplateContent={templateManager.editedTemplateContent}
                onTemplateContentChange={templateManager.setEditedTemplateContent}
                variableOverrides={variableManager.variableOverrides}
                onVariableOverrideChange={variableManager.updateVariableOverride}
              />
            </TabsContent>

            <TabsContent value="deploy">
              <DeployTab
                agents={agentSelector.agents}
                selectedAgentId={agentSelector.selectedAgentId}
                onAgentChange={agentSelector.setSelectedAgentId}
                isAgentsLoading={agentSelector.loading}
                deployPath={deployPath}
                onDeployPathChange={setDeployPath}
                canExecute={canExecute}
                isDryRunning={deployExecution.isDryRunning}
                isDeploying={deployExecution.isDeploying}
                isActivating={deployExecution.isActivating}
                onDryRun={handleDryRun}
                onDeployToGit={handleDeployToGit}
                onActivate={handleActivate}
                selectedInventoryId={selectedInventoryId}
              />
            </TabsContent>
          </Tabs>

      {/* Dialogs */}
      <DryRunResultDialog
        show={deployExecution.showDryRunDialog}
        onClose={() => deployExecution.setShowDryRunDialog(false)}
        results={deployExecution.dryRunResults}
      />

      <ErrorDialog
        show={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        title={errorDetails?.title || ''}
        message={errorDetails?.message || ''}
        details={errorDetails?.details}
      />
    </div>
  )
}
