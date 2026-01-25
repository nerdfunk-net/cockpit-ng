'use client'

import { useState, useCallback, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Settings, FileText, Shield } from 'lucide-react'
import { useCheckMKSettingsQuery } from './hooks/use-checkmk-settings-query'
import { useCheckMKYamlQuery, useCheckMKQueriesQuery } from './hooks/use-checkmk-yaml-queries'
import { useCheckMKMutations } from './hooks/use-checkmk-mutations'
import { ConnectionSettingsForm } from './components/connection-settings-form'
import { YamlEditorCard } from './components/yaml-editor-card'
import { CheckMKHelpDialog } from './dialogs/checkmk-help-dialog'
import { YamlValidationDialog } from './dialogs/yaml-validation-dialog'
import type { CheckMKSettings, ValidationError } from './types'
import {
  DEFAULT_CHECKMK_SETTINGS,
  TAB_VALUES,
  YAML_FILES,
  EMPTY_STRING,
} from './utils/constants'

export default function CheckMKSettingsForm() {
  // TanStack Query - no manual state management needed
  const { data: settings = DEFAULT_CHECKMK_SETTINGS, isLoading: settingsLoading } =
    useCheckMKSettingsQuery()

  const {
    data: checkmkYaml = EMPTY_STRING,
    isLoading: checkmkYamlLoading,
    refetch: refetchCheckmkYaml,
  } = useCheckMKYamlQuery()

  const {
    data: queriesYaml = EMPTY_STRING,
    isLoading: queriesYamlLoading,
    refetch: refetchQueriesYaml,
  } = useCheckMKQueriesQuery()

  const { saveSettings, testConnection, validateYaml, saveYaml } = useCheckMKMutations()

  // Local state for UI only (not server data)
  const [localCheckmkYaml, setLocalCheckmkYaml] = useState(checkmkYaml)
  const [localQueriesYaml, setLocalQueriesYaml] = useState(queriesYaml)
  const [activeTab, setActiveTab] = useState<string>(TAB_VALUES.CONNECTION)
  const [validationError, setValidationError] = useState<ValidationError | null>(null)
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

  // Update local content when query data changes
  useMemo(() => {
    setLocalCheckmkYaml(checkmkYaml)
  }, [checkmkYaml])

  useMemo(() => {
    setLocalQueriesYaml(queriesYaml)
  }, [queriesYaml])

  // Callbacks with useCallback for stability
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

  const handleResetSettings = useCallback(() => {
    // Reset will be handled by form state
  }, [])

  const handleValidateCheckmk = useCallback(() => {
    setValidationError(null)
    validateYaml.mutate(
      { content: localCheckmkYaml, filename: YAML_FILES.CHECKMK },
      {
        onError: (error: any) => {
          setValidationError(error)
          setShowValidationDialog(true)
        },
      }
    )
  }, [localCheckmkYaml, validateYaml])

  const handleValidateQueries = useCallback(() => {
    setValidationError(null)
    validateYaml.mutate(
      { content: localQueriesYaml, filename: YAML_FILES.QUERIES },
      {
        onError: (error: any) => {
          setValidationError(error)
          setShowValidationDialog(true)
        },
      }
    )
  }, [localQueriesYaml, validateYaml])

  const handleSaveCheckmk = useCallback(() => {
    saveYaml.mutate({ filename: YAML_FILES.CHECKMK, content: localCheckmkYaml })
  }, [localCheckmkYaml, saveYaml])

  const handleSaveQueries = useCallback(() => {
    saveYaml.mutate({ filename: YAML_FILES.QUERIES, content: localQueriesYaml })
  }, [localQueriesYaml, saveYaml])

  const handleReloadCheckmk = useCallback(() => {
    refetchCheckmkYaml()
  }, [refetchCheckmkYaml])

  const handleReloadQueries = useCallback(() => {
    refetchQueriesYaml()
  }, [refetchQueriesYaml])

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">CheckMK Settings</h1>
            <p className="text-gray-600">
              Configure your CheckMK server connection and configuration files
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value={TAB_VALUES.CONNECTION} className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Connection</span>
          </TabsTrigger>
          <TabsTrigger value={TAB_VALUES.CHECKMK_CONFIG} className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>CheckMK Config</span>
          </TabsTrigger>
          <TabsTrigger value={TAB_VALUES.QUERIES} className="flex items-center space-x-2">
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

        {/* CheckMK Configuration Tab */}
        <TabsContent value={TAB_VALUES.CHECKMK_CONFIG} className="space-y-6">
          <YamlEditorCard
            title={`CheckMK Configuration (${YAML_FILES.CHECKMK})`}
            value={localCheckmkYaml}
            onChange={setLocalCheckmkYaml}
            onSave={handleSaveCheckmk}
            onValidate={handleValidateCheckmk}
            onReload={handleReloadCheckmk}
            isLoading={checkmkYamlLoading}
            isValidating={validateYaml.isPending}
            isSaving={saveYaml.isPending}
            showHelp={true}
            onHelpClick={() => setShowHelpDialog(true)}
            description="Edit the CheckMK configuration YAML file. This controls site mapping, folder structure, and host tag groups."
          />
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
