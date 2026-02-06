'use client'

import { useState, useCallback, useMemo } from 'react'
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
  const [deployPath, setDeployPath] = useState<string>('')

  // Initialize hooks
  const templateManager = useTemplateManager('agent')
  const variableManager = useVariableManager()
  const agentSelector = useAgentSelector()
  const deployExecution = useDeployExecution()

  // Error dialog state
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null)

  // Check if execution is allowed
  const canExecute = useMemo(() =>
    selectedDeviceIds.length > 0 &&
    templateManager.selectedTemplateId !== 'none' &&
    agentSelector.selectedAgentId !== null &&
    deployPath.trim() !== '',
    [selectedDeviceIds.length, templateManager.selectedTemplateId, agentSelector.selectedAgentId, deployPath]
  )

  // Build config for API calls
  const buildDeployConfig = useCallback((): DeployConfig => ({
    deviceIds: selectedDeviceIds,
    templateId: Number(templateManager.selectedTemplateId),
    variables: variableManager.variables.reduce((acc, v) => {
      if (v.name && v.value) acc[v.name] = v.value
      return acc
    }, {} as Record<string, string>),
    agentId: agentSelector.selectedAgentId!,
    useNautobotContext: variableManager.useNautobotContext,
    path: deployPath
  }), [
    selectedDeviceIds,
    templateManager.selectedTemplateId,
    variableManager.variables,
    variableManager.useNautobotContext,
    agentSelector.selectedAgentId,
    deployPath
  ])

  // Action handlers
  const handleDryRun = useCallback(async () => {
    try {
      const config = buildDeployConfig()
      await deployExecution.executeDryRun(config)
    } catch (error) {
      setErrorDetails({
        title: 'Dry Run Failed',
        message: 'Failed to render templates',
        details: [(error as Error).message]
      })
      setShowErrorDialog(true)
    }
  }, [buildDeployConfig, deployExecution])

  const handleDeployToGit = useCallback(async () => {
    try {
      const config = buildDeployConfig()
      await deployExecution.executeDeployToGit(config)
      toast({
        title: 'Success',
        description: 'Configs deployed to git repository'
      })
    } catch (error) {
      setErrorDetails({
        title: 'Deploy Failed',
        message: 'Failed to deploy configs to git',
        details: [(error as Error).message]
      })
      setShowErrorDialog(true)
    }
  }, [buildDeployConfig, deployExecution, toast])

  const handleActivate = useCallback(async () => {
    try {
      const config = buildDeployConfig()
      await deployExecution.executeActivate(config)
      toast({
        title: 'Success',
        description: 'Configs activated via Cockpit Agent'
      })
    } catch (error) {
      setErrorDetails({
        title: 'Activation Failed',
        message: 'Failed to activate configs',
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <GitCommit className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Agents Deploy</h1>
            <p className="text-gray-600 mt-1">Deploy Telegraf/InfluxDB/Grafana configurations to devices</p>
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
              />
            </TabsContent>

            <TabsContent value="variables">
              <VariablesAndTemplatesTab
                variables={variableManager.variables}
                useNautobotContext={variableManager.useNautobotContext}
                onVariablesChange={variableManager.addVariable}
                onVariableUpdate={variableManager.updateVariable}
                onVariableRemove={variableManager.removeVariable}
                onUseNautobotContextChange={variableManager.setUseNautobotContext}
                templates={templateManager.templates}
                selectedTemplateId={templateManager.selectedTemplateId}
                onTemplateChange={templateManager.handleTemplateChange}
                editedTemplateContent={templateManager.editedTemplateContent}
                onTemplateContentChange={templateManager.setEditedTemplateContent}
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
