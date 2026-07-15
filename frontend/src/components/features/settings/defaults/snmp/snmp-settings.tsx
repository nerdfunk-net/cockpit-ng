'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  CheckCircle,
  RotateCcw,
  Network,
  Download,
  HelpCircle,
} from 'lucide-react'
import { useSnmpMappingQuery } from './hooks/use-snmp-mapping-query'
import { useSnmpMutations } from './hooks/use-snmp-mutations'
import { SnmpValidationDialog } from './dialogs/snmp-validation-dialog'
import { SnmpSemanticValidationDialog } from './dialogs/snmp-semantic-validation-dialog'
import { SnmpHelpDialog } from './dialogs/snmp-help-dialog'
import { GitImportDialog } from './dialogs/git-import-dialog'
import type { ValidationError, SnmpEntryError } from './types'
import { SNMP_FILE_NAME, EMPTY_STRING } from './utils/constants'
import { validateSnmpSemantics } from './utils/snmp-semantic-validation'

export function SnmpMappingSettings() {
  // TanStack Query - no manual state management needed
  const { data: snmpMapping = EMPTY_STRING, isLoading, refetch } = useSnmpMappingQuery()
  const { validateYaml, saveMapping } = useSnmpMutations()

  // Local state for UI only (not server data)
  const [localContent, setLocalContent] = useState(snmpMapping)
  const [validationError, setValidationError] = useState<ValidationError | null>(null)
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [snmpSemanticErrors, setSnmpSemanticErrors] = useState<SnmpEntryError[]>([])
  const [showSemanticDialog, setShowSemanticDialog] = useState(false)

  // Update local content when query data changes
  useEffect(() => {
    setLocalContent(snmpMapping)
  }, [snmpMapping])

  // Callbacks with useCallback for stability
  const handleValidate = useCallback(async () => {
    try {
      setValidationError(null)
      await validateYaml.mutateAsync(localContent)
      const semanticErrors = validateSnmpSemantics(localContent)
      if (semanticErrors.length > 0) {
        setSnmpSemanticErrors(semanticErrors)
        setShowSemanticDialog(true)
      }
    } catch (error) {
      setValidationError(error as ValidationError)
      setShowValidationDialog(true)
    }
  }, [localContent, validateYaml])

  const handleSave = useCallback(async () => {
    await saveMapping.mutateAsync(localContent)
  }, [localContent, saveMapping])

  const handleSaveAnyway = useCallback(async () => {
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
      <Card className="shadow-lg border-0 overflow-hidden p-0">
        <CardHeader className="panel-header border-b-0 rounded-none m-0 py-2 px-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm font-medium">
              <Network className="h-4 w-4" />
              <span>SNMP Mapping Configuration ({SNMP_FILE_NAME})</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenHelpDialog}
              className="h-7 w-7 p-0 text-current hover:bg-card/20"
              title="Show help and examples"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 panel-content space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              SNMP Mapping Content
            </Label>
            <Textarea
              value={localContent}
              onChange={e => setLocalContent(e.target.value)}
              placeholder="YAML content will be loaded here..."
              className="w-full h-96 font-mono text-sm border-border focus:border-primary focus:ring-ring/30"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Edit the SNMP mapping configuration YAML file. This defines SNMP
              credentials and mapping for different devices.
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
              disabled={
                isLoading || validateYaml.isPending || saveMapping.isPending || !localContent
              }
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
              className="flex items-center space-x-2"
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

      {/* Dialogs */}
      <SnmpValidationDialog
        open={showValidationDialog}
        onOpenChange={setShowValidationDialog}
        error={validationError}
      />

      <SnmpSemanticValidationDialog
        open={showSemanticDialog}
        onOpenChange={setShowSemanticDialog}
        errors={snmpSemanticErrors}
        onSaveAnyway={handleSaveAnyway}
      />

      <SnmpHelpDialog open={showHelpDialog} onOpenChange={setShowHelpDialog} />

      <GitImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
        fileType="yaml"
      />
    </div>
  )
}
