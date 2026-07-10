'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Upload, FileSpreadsheet, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/shared/status-badge'
import { StatusAlert } from '@/components/shared/status-alert'
import { useAgentMutations } from '@/components/features/agents/operating/hooks/use-agent-mutations'
import { useGetDataAgents } from '../hooks/use-get-data-agents'
import { OBJECT_TYPE_LABELS, AGENT_CSV_CONFIG } from '../constants'
import { combineAgentKeys } from '../utils/agent-data'
import type { ObjectType, CSVConfig, ParsedCSVData, ValidationResult } from '../types'

interface CsvSourceStepProps {
  objectType: ObjectType
  onObjectTypeChange: (type: ObjectType) => void
  csvConfig: CSVConfig
  onConfigChange: (updates: Partial<CSVConfig>) => void
  csvFile: File | null
  parsedData: ParsedCSVData
  validationResults: ValidationResult[]
  validationSummary: {
    errorCount: number
    warningCount: number
    successCount: number
    hasErrors: boolean
    isValid: boolean
  }
  isParsing: boolean
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onParseCSV: () => void
  onClear: () => void
  onAgentDataParsed: (data: ParsedCSVData) => void
  useNewMapping: boolean
  onUseNewMappingChange: (value: boolean) => void
  useDefaultProperties: boolean
  onUseDefaultPropertiesChange: (value: boolean) => void
  primaryIpEnabled: boolean
  onPrimaryIpEnabledChange: (value: boolean) => void
}

const OBJECT_TYPE_OPTIONS: ObjectType[] = [
  'devices',
  'ip-prefixes',
  'ip-addresses',
  'locations',
]

export function CsvSourceStep({
  objectType,
  onObjectTypeChange,
  csvConfig,
  onConfigChange,
  csvFile,
  parsedData,
  validationResults,
  validationSummary,
  isParsing,
  onFileChange,
  onParseCSV,
  onClear,
  onAgentDataParsed,
  useNewMapping,
  onUseNewMappingChange,
  useDefaultProperties,
  onUseDefaultPropertiesChange,
  primaryIpEnabled,
  onPrimaryIpEnabledChange,
}: CsvSourceStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [selectedFlowIds, setSelectedFlowIds] = useState<string[]>([])
  const [agentError, setAgentError] = useState<string | null>(null)
  const { data: agents, isLoading: isLoadingAgents } = useGetDataAgents()
  const { getData } = useAgentMutations()
  const [isFetchingAgentData, setIsFetchingAgentData] = useState(false)

  const selectedAgent = agents.find(
    agent => (agent.agent_id ?? agent.id) === selectedAgentId
  )
  const availableFlows = useMemo(() => selectedAgent?.data_flows ?? [], [selectedAgent])

  useEffect(() => {
    setSelectedFlowIds([])
  }, [selectedAgentId])

  const toggleFlowId = useCallback((flowId: string) => {
    setSelectedFlowIds(prev =>
      prev.includes(flowId) ? prev.filter(id => id !== flowId) : [...prev, flowId]
    )
  }, [])

  const handleGetData = useCallback(async () => {
    if (!selectedAgentId || selectedFlowIds.length === 0) return

    setAgentError(null)
    setIsFetchingAgentData(true)

    const merged: Record<string, string> = {}
    const errors: string[] = []

    try {
      const responses = await Promise.all(
        selectedFlowIds.map(flowId =>
          getData
            .mutateAsync({ agent_id: selectedAgentId, flow_id: flowId })
            .then(data => ({ flowId, data }))
            .catch((error: unknown) => ({
              flowId,
              data: {
                status: 'error' as const,
                error: error instanceof Error ? error.message : 'Request failed',
                output: null,
                command_id: '',
                execution_time_ms: 0,
              },
            }))
        )
      )

      for (const { flowId, data } of responses) {
        if (data.status === 'success' && data.output) {
          for (const [key, value] of Object.entries(data.output.result)) {
            merged[`${flowId}::${key}`] = value
          }
        } else {
          errors.push(`${flowId}: ${data.error ?? 'no data returned'}`)
        }
      }

      if (Object.keys(merged).length === 0) {
        setAgentError(errors.join('; ') || 'The agent returned no data.')
        return
      }

      const combined = combineAgentKeys(merged, AGENT_CSV_CONFIG)
      if (!combined.data) {
        setAgentError(combined.error ?? 'Failed to combine identifier data.')
        return
      }

      if (errors.length > 0) {
        setAgentError(`Some identifiers failed: ${errors.join('; ')}`)
      }

      onAgentDataParsed(combined.data)
    } finally {
      setIsFetchingAgentData(false)
    }
  }, [selectedAgentId, selectedFlowIds, getData, onAgentDataParsed])

  return (
    <div className="space-y-6">
      {/* Object Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Object Type</Label>
        <Select
          value={objectType}
          onValueChange={v => onObjectTypeChange(v as ObjectType)}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OBJECT_TYPE_OPTIONS.map(type => (
              <SelectItem key={type} value={type}>
                {OBJECT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* File Upload */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">CSV File</Label>
        {csvFile ? (
          <div className="flex items-center gap-3 p-3 border rounded-md bg-info border-info-border">
            <FileSpreadsheet className="h-5 w-5 text-info-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-info-foreground truncate">
                {csvFile.name}
              </p>
              <p className="text-xs text-info-foreground">
                {(csvFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 w-7 p-0 text-info-foreground hover:opacity-80"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-border rounded-md p-8 text-center cursor-pointer hover:border-info-border hover:bg-info transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
            <p className="text-xs text-muted-foreground mt-1">Accepts .csv files</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {/* Get Data agent source */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Or Get Data From an Agent</Label>
        <div className="flex flex-wrap items-start gap-3">
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-64">
              <SelectValue
                placeholder={
                  isLoadingAgents ? 'Loading agents…' : 'Select a Get Data agent'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {agents.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No Get Data agents configured
                </div>
              ) : (
                agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.agent_id ?? agent.id}>
                    {agent.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <div className="w-64 border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
            {!selectedAgentId ? (
              <p className="text-xs text-muted-foreground px-1 py-1">
                Select an agent first
              </p>
            ) : availableFlows.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-1">
                Agent has not reported any identifiers yet
              </p>
            ) : (
              availableFlows.map(flowId => (
                <label
                  key={flowId}
                  className="flex items-center gap-2 px-1 py-1 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selectedFlowIds.includes(flowId)}
                    onCheckedChange={() => toggleFlowId(flowId)}
                  />
                  <span className="truncate">{flowId}</span>
                </label>
              ))
            )}
          </div>

          <Button
            onClick={handleGetData}
            disabled={
              !selectedAgentId || selectedFlowIds.length === 0 || isFetchingAgentData
            }
          >
            {isFetchingAgentData ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            {isFetchingAgentData ? 'Getting Data…' : 'Get Data'}
          </Button>
        </div>

        {agentError && <StatusAlert variant="error">{agentError}</StatusAlert>}
      </div>

      {/* CSV Config + Parse */}
      <div className="flex items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">Delimiter</Label>
          <Input
            className="h-8 text-sm w-20"
            value={csvConfig.delimiter}
            onChange={e => onConfigChange({ delimiter: e.target.value })}
            placeholder=","
            maxLength={5}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">Quote Character</Label>
          <Input
            className="h-8 text-sm w-20"
            value={csvConfig.quoteChar}
            onChange={e => onConfigChange({ quoteChar: e.target.value })}
            placeholder='"'
            maxLength={1}
          />
        </div>
        {csvFile && (
          <Button onClick={onParseCSV} disabled={isParsing} className="h-8">
            {isParsing ? 'Parsing...' : 'Parse CSV'}
          </Button>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2 border rounded-md p-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="use-new-mapping"
            checked={useNewMapping}
            onCheckedChange={value => onUseNewMappingChange(value === true)}
          />
          <Label htmlFor="use-new-mapping" className="text-sm text-muted-foreground">
            Use new mapping (ignore any saved mapping and configure it again)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="use-default-properties"
            checked={useDefaultProperties}
            onCheckedChange={value => onUseDefaultPropertiesChange(value === true)}
          />
          <Label htmlFor="use-default-properties" className="text-sm text-muted-foreground">
            Use Default Properties (fill missing values from Settings / Common / Network
            Defaults)
          </Label>
        </div>
        {objectType === 'devices' && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="set-primary-ip"
              checked={primaryIpEnabled}
              onCheckedChange={value => onPrimaryIpEnabledChange(value === true)}
            />
            <Label htmlFor="set-primary-ip" className="text-sm text-muted-foreground">
              Set Primary IP (choose which interface IP becomes the device&apos;s primary
              IPv4 address)
            </Label>
          </div>
        )}
      </div>

      {/* Parse Results */}
      {parsedData.rowCount > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{parsedData.headers.length} columns</Badge>
            <Badge variant="secondary">{parsedData.rowCount} rows</Badge>
            {validationSummary.errorCount > 0 && (
              <Badge variant="destructive">{validationSummary.errorCount} errors</Badge>
            )}
            {validationSummary.warningCount > 0 && (
              <StatusBadge variant="warning">
                {validationSummary.warningCount} warnings
              </StatusBadge>
            )}
            {validationSummary.isValid && (
              <StatusBadge variant="success">Valid</StatusBadge>
            )}
          </div>

          {validationResults.length > 0 && (
            <div className="border rounded-md max-h-40 overflow-y-auto">
              {validationResults.map(result => (
                <div
                  key={`${result.type}-${result.rowNumber ?? ''}-${result.message}`}
                  className={`px-3 py-1.5 text-xs border-b last:border-0 ${
                    result.type === 'error'
                      ? 'bg-error text-error-foreground'
                      : result.type === 'warning'
                        ? 'bg-warning text-warning-foreground'
                        : 'bg-success text-success-foreground'
                  }`}
                >
                  {result.rowNumber ? `Row ${result.rowNumber}: ` : ''}
                  {result.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hint when file selected but not parsed */}
      {csvFile && parsedData.rowCount === 0 && !isParsing && (
        <Alert>
          <AlertDescription className="text-sm">
            Click <strong>Parse CSV</strong> to analyze the file and check for errors.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
