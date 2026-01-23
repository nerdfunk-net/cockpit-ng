'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  CheckCircle,
  RotateCcw,
  Network,
  Settings,
  Download,
  HelpCircle
} from 'lucide-react'
import { useSnmpMappingQuery } from './hooks/use-snmp-mapping-query'
import { useSnmpMutations } from './hooks/use-snmp-mutations'
import { SnmpValidationDialog } from './dialogs/snmp-validation-dialog'
import { SnmpHelpDialog } from './dialogs/snmp-help-dialog'
import { GitImportDialog } from './dialogs/git-import-dialog'
import type { ValidationError } from './types'
import { SNMP_FILE_NAME, EMPTY_STRING } from './utils/constants'

export default function CommonSettingsForm() {
  // TanStack Query - no manual state management needed
  const { data: snmpMapping = EMPTY_STRING, isLoading, refetch } = useSnmpMappingQuery()
  const { validateYaml, saveMapping } = useSnmpMutations()

  // Local state for UI only (not server data)
  const [localContent, setLocalContent] = useState(snmpMapping)
  const [activeTab, setActiveTab] = useState('snmp-mapping')
  const [validationError, setValidationError] = useState<ValidationError | null>(null)
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)

  // Update local content when query data changes
  useEffect(() => {
    setLocalContent(snmpMapping)
  }, [snmpMapping])

  // Callbacks with useCallback for stability
  const handleValidate = useCallback(async () => {
    try {
      setValidationError(null)
      await validateYaml.mutateAsync(localContent)
    } catch (error) {
      setValidationError(error as ValidationError)
      setShowValidationDialog(true)
    }
  }, [localContent, validateYaml])

  const handleSave = useCallback(async () => {
    await saveMapping.mutateAsync(localContent)
  }, [localContent, saveMapping])

  const handleReload = useCallback(() => {
    refetch()
  }, [refetch])

  const handleImport = useCallback((content: string) => {
    setLocalContent(content)
  }, [])

  const handleOpenImportDialog = useCallback(() => {
    setShowImportDialog(true)
  }, [])

  const handleOpenHelpDialog = useCallback(() => {
    setShowHelpDialog(true)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Settings className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Common Settings</h1>
            <p className="text-muted-foreground">
              Manage common settings used across multiple applications
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-1 w-full max-w-xs">
          <TabsTrigger value="snmp-mapping" className="flex items-center space-x-2">
            <Network className="h-4 w-4" />
            <span>SNMP Mapping</span>
          </TabsTrigger>
        </TabsList>

        {/* SNMP Mapping Tab */}
        <TabsContent value="snmp-mapping" className="space-y-6">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm font-medium">
                  <Network className="h-4 w-4" />
                  <span>SNMP Mapping Configuration ({SNMP_FILE_NAME})</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenHelpDialog}
                  className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
                  title="Show help and examples"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  SNMP Mapping Content
                </Label>
                <Textarea
                  value={localContent}
                  onChange={(e) => setLocalContent(e.target.value)}
                  placeholder="YAML content will be loaded here..."
                  className="w-full h-96 font-mono text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500">
                  Edit the SNMP mapping configuration YAML file. This defines SNMP credentials and mapping for different devices.
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReload}
                  disabled={isLoading || validateYaml.isPending || saveMapping.isPending}
                  className="flex items-center space-x-2"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  <span>Reload</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenImportDialog}
                  disabled={isLoading || validateYaml.isPending || saveMapping.isPending}
                  className="flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Import from Git</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleValidate}
                  disabled={isLoading || validateYaml.isPending || saveMapping.isPending || !localContent}
                  className="flex items-center space-x-2"
                >
                  {validateYaml.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span>Check YAML</span>
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isLoading || validateYaml.isPending || saveMapping.isPending}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {saveMapping.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Network className="h-4 w-4" />
                  )}
                  <span>Save Mapping</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <SnmpValidationDialog
        open={showValidationDialog}
        onOpenChange={setShowValidationDialog}
        error={validationError}
      />

      <SnmpHelpDialog
        open={showHelpDialog}
        onOpenChange={setShowHelpDialog}
      />

      <GitImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
        fileType="yaml"
      />
    </div>
  )
}
