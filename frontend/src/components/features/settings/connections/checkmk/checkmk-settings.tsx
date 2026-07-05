'use client'

import { useState, useCallback, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Settings, FileText, Shield } from 'lucide-react'
import { IconChip } from '@/components/shared/icon-chip'
import { useCheckMKSettingsQuery } from './hooks/use-checkmk-settings-query'
import {
  useCheckMKQueriesQuery,
  useCheckmkDynamicYamlQuery,
} from './hooks/use-checkmk-yaml-queries'
import { useCheckMKMutations } from './hooks/use-checkmk-mutations'
import { ConnectionSettingsForm } from './components/connection-settings-form'
import { YamlEditorCard } from './components/yaml-editor-card'
import { PriorityRulesPanel } from './components/priority-rules-panel'
import { CheckMKHelpDialog } from './dialogs/checkmk-help-dialog'
import { YamlValidationDialog } from './dialogs/yaml-validation-dialog'
import type { CheckMKSettings, ValidationError } from './types'
import {
  DEFAULT_CHECKMK_SETTINGS,
  DEFAULT_PRIORITY_RULE_FILENAME,
  TAB_VALUES,
  YAML_FILES,
  EMPTY_STRING,
} from './utils/constants'

export default function CheckMKSettingsForm() {
  const { data: settings = DEFAULT_CHECKMK_SETTINGS, isLoading: settingsLoading } =
    useCheckMKSettingsQuery()

  const {
    data: queriesYaml = EMPTY_STRING,
    isLoading: queriesYamlLoading,
    refetch: refetchQueriesYaml,
  } = useCheckMKQueriesQuery()

  const { saveSettings, testConnection, validateYaml, saveYaml } = useCheckMKMutations()

  // Which file is currently selected in the priority panel
  const [selectedFilename, setSelectedFilename] = useState<string>(
    DEFAULT_PRIORITY_RULE_FILENAME
  )

  // Dynamic YAML for the selected file in Tab 2
  const {
    data: selectedYaml = EMPTY_STRING,
    isLoading: selectedYamlLoading,
    refetch: refetchSelectedYaml,
  } = useCheckmkDynamicYamlQuery(selectedFilename)

  const [localSelectedYaml, setLocalSelectedYaml] = useState(selectedYaml)
  const [localQueriesYaml, setLocalQueriesYaml] = useState(queriesYaml)
  const [activeTab, setActiveTab] = useState<string>(TAB_VALUES.CONNECTION)
  const [validationError, setValidationError] = useState<ValidationError | null>(null)
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

  // Sync server data → local state when query data changes
  useEffect(() => {
    setLocalSelectedYaml(selectedYaml)
  }, [selectedYaml])

  useEffect(() => {
    setLocalQueriesYaml(queriesYaml)
  }, [queriesYaml])

  // Reset local yaml when a different file is selected
  useEffect(() => {
    setLocalSelectedYaml(selectedYaml)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilename])

  const handleSaveSettings = useCallback(
    (data: CheckMKSettings) => {
      saveSettings.mutate(data)
    },
    [saveSettings]
  )

  const handleTestConnection = useCallback(
    async (data: CheckMKSettings) => {
      setTestStatus('idle')
      setTestMessage('')

      testConnection.mutate(data, {
        onSuccess: () => {
          setTestStatus('success')
          setTestMessage('Connection successful!')
          setTimeout(() => {
            setTestStatus('idle')
            setTestMessage('')
          }, 5000)
        },
        onError: (error: Error) => {
          setTestStatus('error')
          setTestMessage(error.message)
          setTimeout(() => {
            setTestStatus('idle')
            setTestMessage('')
          }, 5000)
        },
      })
    },
    [testConnection]
  )

  const handleResetSettings = useCallback(() => {}, [])

  const handleValidateSelectedYaml = useCallback(() => {
    setValidationError(null)
    validateYaml.mutate(
      { content: localSelectedYaml, filename: selectedFilename },
      {
        onError: (error: ValidationError | Error) => {
          setValidationError(error)
          setShowValidationDialog(true)
        },
      }
    )
  }, [localSelectedYaml, selectedFilename, validateYaml])

  const handleValidateQueries = useCallback(() => {
    setValidationError(null)
    validateYaml.mutate(
      { content: localQueriesYaml, filename: YAML_FILES.QUERIES },
      {
        onError: (error: ValidationError | Error) => {
          setValidationError(error)
          setShowValidationDialog(true)
        },
      }
    )
  }, [localQueriesYaml, validateYaml])

  const handleSaveSelectedYaml = useCallback(() => {
    saveYaml.mutate({
      filename: selectedFilename,
      content: localSelectedYaml,
      apiPath: `config/checkmk/${selectedFilename}`,
    })
  }, [localSelectedYaml, selectedFilename, saveYaml])

  const handleSaveQueries = useCallback(() => {
    saveYaml.mutate({
      filename: YAML_FILES.QUERIES,
      content: localQueriesYaml,
      apiPath: `config/checkmk/${YAML_FILES.QUERIES}`,
    })
  }, [localQueriesYaml, saveYaml])

  const handleReloadSelectedYaml = useCallback(() => {
    refetchSelectedYaml()
  }, [refetchSelectedYaml])

  const handleReloadQueries = useCallback(() => {
    refetchQueriesYaml()
  }, [refetchQueriesYaml])

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <IconChip>
            <Shield className="h-6 w-6" />
          </IconChip>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">CheckMK Settings</h1>
            <p className="text-muted-foreground">
              Configure your CheckMK server connection and configuration files
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger
            value={TAB_VALUES.CONNECTION}
            className="flex items-center space-x-2"
          >
            <Settings className="h-4 w-4" />
            <span>Connection</span>
          </TabsTrigger>
          <TabsTrigger
            value={TAB_VALUES.CHECKMK_CONFIG}
            className="flex items-center space-x-2"
          >
            <FileText className="h-4 w-4" />
            <span>CheckMK Config</span>
          </TabsTrigger>
          <TabsTrigger
            value={TAB_VALUES.QUERIES}
            className="flex items-center space-x-2"
          >
            <FileText className="h-4 w-4" />
            <span>Queries</span>
          </TabsTrigger>
        </TabsList>

        {/* Connection Settings Tab */}
        <TabsContent value={TAB_VALUES.CONNECTION} className="space-y-6">
          <ConnectionSettingsForm
            settings={settings}
            onSave={handleSaveSettings}
            onTest={handleTestConnection}
            onReset={handleResetSettings}
            isSaving={saveSettings.isPending}
            isTesting={testConnection.isPending}
            testStatus={testStatus}
            testMessage={testMessage}
          />
        </TabsContent>

        {/* CheckMK Configuration Tab — split panel */}
        <TabsContent value={TAB_VALUES.CHECKMK_CONFIG}>
          <div className="grid grid-cols-[240px_1fr] gap-4 min-h-[520px]">
            {/* Left: priority rules list */}
            <div className="flex flex-col border rounded-lg p-3 bg-card">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Priority Rules
              </p>
              <PriorityRulesPanel
                selectedFilename={selectedFilename}
                onSelectFilename={setSelectedFilename}
              />
            </div>

            {/* Right: YAML editor for selected file */}
            <YamlEditorCard
              title={selectedFilename}
              value={localSelectedYaml}
              onChange={setLocalSelectedYaml}
              onSave={handleSaveSelectedYaml}
              onValidate={handleValidateSelectedYaml}
              onReload={handleReloadSelectedYaml}
              isLoading={selectedYamlLoading}
              isValidating={validateYaml.isPending}
              isSaving={saveYaml.isPending}
              showHelp={selectedFilename === YAML_FILES.CHECKMK}
              onHelpClick={() => setShowHelpDialog(true)}
              description={`Editing ${selectedFilename}. Click Save Configuration to persist changes.`}
            />
          </div>
        </TabsContent>

        {/* Queries Tab */}
        <TabsContent value={TAB_VALUES.QUERIES} className="space-y-6">
          <YamlEditorCard
            title={`CheckMK Queries Configuration (${YAML_FILES.QUERIES})`}
            value={localQueriesYaml}
            onChange={setLocalQueriesYaml}
            onSave={handleSaveQueries}
            onValidate={handleValidateQueries}
            onReload={handleReloadQueries}
            isLoading={queriesYamlLoading}
            isValidating={validateYaml.isPending}
            isSaving={saveYaml.isPending}
            description="Edit the CheckMK queries configuration YAML file. This defines custom queries and filters for CheckMK."
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CheckMKHelpDialog open={showHelpDialog} onOpenChange={setShowHelpDialog} />

      <YamlValidationDialog
        open={showValidationDialog}
        onOpenChange={setShowValidationDialog}
        error={validationError}
        filename={validationError?.filename}
      />
    </div>
  )
}
