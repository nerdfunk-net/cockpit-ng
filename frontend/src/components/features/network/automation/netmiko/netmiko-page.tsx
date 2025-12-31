'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Terminal } from 'lucide-react'
import type { DeviceInfo, LogicalCondition } from '@/components/shared/device-selector'

// Hooks
import { useCredentialManager } from './hooks/use-credential-manager'
import { useTemplateManager } from './hooks/use-template-manager'
import { useVariableManager } from './hooks/use-variable-manager'
import { useNetmikoExecution } from './hooks/use-netmiko-execution'

// Tab Components
import { DeviceSelectionTab } from './tabs/device-selection-tab'
import { VariablesAndTemplatesTab } from './tabs/variables-and-templates-tab'
import { CommandExecutionTab } from './tabs/command-execution-tab'

// Dialog Components
import { TestResultDialog } from './dialogs/test-result-dialog'
import { NautobotDataDialog } from './dialogs/nautobot-data-dialog'
import { ErrorDialog } from './dialogs/error-dialog'

// Results Component
import { ExecutionResults } from './components/execution-results'

// Types
import type { ErrorDetails } from './types'

export default function NetmikoPage() {
  // Device selection state
  const [previewDevices, setPreviewDevices] = useState<DeviceInfo[]>([])
  const [deviceConditions, setDeviceConditions] = useState<LogicalCondition[]>([])
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])
  const [selectedDevices, setSelectedDevices] = useState<DeviceInfo[]>([])

  // Commands state
  const [commands, setCommands] = useState('')
  const [enableMode, setEnableMode] = useState(false)
  const [writeConfig, setWriteConfig] = useState(false)
  const [dryRun, setDryRun] = useState(false)

  // Dialog state
  const [showTestResultDialog, setShowTestResultDialog] = useState(false)
  const [testResult, setTestResult] = useState<string>('')
  const [showNautobotDataDialog, setShowNautobotDataDialog] = useState(false)
  const [nautobotData, setNautobotData] = useState<Record<string, unknown> | null>(null)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null)

  // Custom hooks
  const credentialManager = useCredentialManager()
  const templateManager = useTemplateManager()
  const variableManager = useVariableManager()
  const executionManager = useNetmikoExecution()

  const handleDevicesSelected = (devices: DeviceInfo[], conditions: LogicalCondition[]) => {
    setPreviewDevices(devices)
    setDeviceConditions(conditions)
    const deviceIds = devices.map(d => d.id)
    setSelectedDeviceIds(deviceIds)
    setSelectedDevices(devices)
    executionManager.resetResults()
  }

  const handleSelectionChange = (selectedIds: string[], devices: DeviceInfo[]) => {
    setSelectedDeviceIds(selectedIds)
    setSelectedDevices(devices)
  }

  const handleExecuteCommands = async () => {
    if (selectedDevices.length === 0) {
      alert('Please select devices first using the Devices tab.')
      return
    }

    const usingTemplate = templateManager.selectedTemplateId !== 'none'

    if (!usingTemplate) {
      if (!commands.trim()) {
        alert('Please enter at least one command.')
        return
      }
      if (!credentialManager.username.trim() || !credentialManager.password.trim()) {
        alert('Please enter username and password.')
        return
      }
      
      await executionManager.executeCommands({
        selectedDevices,
        commands,
        enableMode,
        writeConfig,
        selectedCredentialId: credentialManager.selectedCredentialId,
        username: credentialManager.username,
        password: credentialManager.password,
      })
    } else {
      if (!dryRun && (!credentialManager.username.trim() || !credentialManager.password.trim())) {
        alert('Please enter username and password.')
        return
      }

      await executionManager.executeTemplate({
        selectedDevices,
        selectedTemplate: templateManager.selectedTemplate,
        editedTemplateContent: templateManager.editedTemplateContent,
        variables: variableManager.variables,
        useNautobotContext: variableManager.useNautobotContext,
        dryRun,
        enableMode,
        writeConfig,
        selectedCredentialId: credentialManager.selectedCredentialId,
        username: credentialManager.username,
        password: credentialManager.password,
      })
    }
  }

  const handleShowError = (error: ErrorDetails) => {
    setErrorDetails(error)
    setShowErrorDialog(true)
  }

  const handleShowTestResult = (result: string) => {
    setTestResult(result)
    setShowTestResultDialog(true)
  }

  const handleShowNautobotData = (data: Record<string, unknown>) => {
    setNautobotData(data)
    setShowNautobotDataDialog(true)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Terminal className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Netmiko Command Execution</h1>
            <p className="text-gray-600 mt-1">Execute commands on network devices using Netmiko</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="variables">Variables & Templates</TabsTrigger>
          <TabsTrigger value="commands">Execute</TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-6">
          <DeviceSelectionTab
            selectedDeviceIds={selectedDeviceIds}
            selectedDevices={selectedDevices}
            onDevicesSelected={handleDevicesSelected}
            onSelectionChange={handleSelectionChange}
          />
        </TabsContent>

        {/* Variables & Templates Tab */}
        <TabsContent value="variables" className="space-y-6">
          <VariablesAndTemplatesTab
            variables={variableManager.variables}
            useNautobotContext={variableManager.useNautobotContext}
            setUseNautobotContext={variableManager.setUseNautobotContext}
            addVariable={variableManager.addVariable}
            removeVariable={variableManager.removeVariable}
            updateVariable={variableManager.updateVariable}
            validateVariableName={variableManager.validateVariableName}
            templates={templateManager.templates}
            selectedTemplateId={templateManager.selectedTemplateId}
            selectedTemplate={templateManager.selectedTemplate}
            editedTemplateContent={templateManager.editedTemplateContent}
            isSavingTemplate={templateManager.isSavingTemplate}
            setEditedTemplateContent={templateManager.setEditedTemplateContent}
            handleTemplateChange={templateManager.handleTemplateChange}
            handleSaveTemplate={templateManager.handleSaveTemplate}
            selectedDevices={selectedDevices}
            onError={handleShowError}
            onShowTestResult={handleShowTestResult}
            onShowNautobotData={handleShowNautobotData}
          />
        </TabsContent>

        {/* Commands Tab */}
        <TabsContent value="commands" className="space-y-6">
          <CommandExecutionTab
            selectedDevices={selectedDevices}
            storedCredentials={credentialManager.storedCredentials}
            selectedCredentialId={credentialManager.selectedCredentialId}
            username={credentialManager.username}
            password={credentialManager.password}
            onCredentialChange={credentialManager.handleCredentialChange}
            onUsernameChange={credentialManager.setUsername}
            onPasswordChange={credentialManager.setPassword}
            commands={commands}
            setCommands={setCommands}
            selectedTemplateId={templateManager.selectedTemplateId}
            selectedTemplate={templateManager.selectedTemplate}
            enableMode={enableMode}
            setEnableMode={setEnableMode}
            writeConfig={writeConfig}
            setWriteConfig={setWriteConfig}
            dryRun={dryRun}
            setDryRun={setDryRun}
            isExecuting={executionManager.isExecuting}
            isCancelling={executionManager.isCancelling}
            currentSessionId={executionManager.currentSessionId}
            onExecute={handleExecuteCommands}
            onCancel={executionManager.cancelExecution}
          />

          {/* Execution Results */}
          {executionManager.showResults && executionManager.executionSummary && (
            <ExecutionResults
              results={executionManager.executionResults}
              summary={executionManager.executionSummary}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <TestResultDialog
        open={showTestResultDialog}
        onOpenChange={setShowTestResultDialog}
        testResult={testResult}
      />

      <NautobotDataDialog
        open={showNautobotDataDialog}
        onOpenChange={setShowNautobotDataDialog}
        nautobotData={nautobotData}
      />

      <ErrorDialog
        open={showErrorDialog}
        onOpenChange={setShowErrorDialog}
        errorDetails={errorDetails}
      />
    </div>
  )
}
