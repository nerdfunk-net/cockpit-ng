'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Upload, FileSpreadsheet, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { OBJECT_TYPE_LABELS } from '../constants'
import { combineAgentKeys } from '../utils/agent-data'
import type { ObjectType, CSVConfig, ParsedCSVData, ValidationResult } from '../types'
import type { Profile } from '@/components/features/settings/defaults/profiles/types'

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
  profiles: Profile[]
  selectedProfileId: number | null
  onProfileChange: (profileId: number) => void
}

const OBJECT_TYPE_OPTIONS: ObjectType[] = [
  'devices',
  'ip-prefixes',
  'ip-addresses',
  'locations',
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
      {children}
    </h3>
  )
}

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
  profiles,
  selectedProfileId,
  onProfileChange,
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

      const combined = combineAgentKeys(merged, csvConfig)
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
  }, [selectedAgentId, selectedFlowIds, getData, onAgentDataParsed, csvConfig])

  return (
    <div className="space-y-4">
      {/* Object Type + CSV Format — general settings that apply regardless of data source */}
      <div className="border rounded-md p-3">
        <div className="flex flex-wrap gap-6 divide-x divide-border">
          <div className="space-y-1.5">
            <SectionTitle>Object Type</SectionTitle>
            <Select
              value={objectType}
              onValueChange={v => onObjectTypeChange(v as ObjectType)}
            >
              <SelectTrigger className="w-56 h-8">
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

          {/* CSV Format — applies to both the uploaded file and Get Data agent text */}
          <div className="space-y-1.5 pl-6">
            <SectionTitle>CSV Format</SectionTitle>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">
                  Delimiter
                </Label>
                <Input
                  className="h-8 text-sm w-16"
                  value={csvConfig.delimiter}
                  onChange={e => onConfigChange({ delimiter: e.target.value })}
                  placeholder=","
                  maxLength={5}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Quote</Label>
                <Input
                  className="h-8 text-sm w-16"
                  value={csvConfig.quoteChar}
                  onChange={e => onConfigChange({ quoteChar: e.target.value })}
                  placeholder='"'
                  maxLength={1}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Group A: Get data from Agent */}
        <div className="border rounded-md p-3 space-y-2.5">
          <SectionTitle>Get data from Agent</SectionTitle>

          <div className="flex flex-wrap items-start gap-2">
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="w-full sm:w-52 h-8 text-sm">
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

            <Button
              size="sm"
              className="h-8"
              onClick={handleGetData}
              disabled={
                !selectedAgentId || selectedFlowIds.length === 0 || isFetchingAgentData
              }
            >
              {isFetchingAgentData ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isFetchingAgentData ? 'Getting Data…' : 'Get Data'}
            </Button>
          </div>

          <div className="border rounded-md p-2 space-y-0.5 max-h-28 overflow-y-auto">
            {!selectedAgentId ? (
              <p className="text-xs text-muted-foreground px-1 py-0.5">
                Select an agent first
              </p>
            ) : availableFlows.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-0.5">
                Agent has not reported any identifiers yet
              </p>
            ) : (
              availableFlows.map(flowId => (
                <label
                  key={flowId}
                  className="flex items-center gap-2 px-1 py-0.5 text-sm cursor-pointer"
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

          {agentError && <StatusAlert variant="error">{agentError}</StatusAlert>}
        </div>

        {/* Group B: Use upload */}
        <div className="border rounded-md p-3 space-y-2.5">
          <SectionTitle>Use upload</SectionTitle>

          <div className="flex flex-wrap items-center gap-2">
            {csvFile ? (
              <div className="flex items-center gap-2 flex-1 min-w-0 px-2.5 py-1.5 border rounded-md bg-info border-info-border">
                <FileSpreadsheet className="h-4 w-4 text-info-foreground flex-shrink-0" />
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
                  className="h-6 w-6 p-0 text-info-foreground hover:opacity-80"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Select CSV file
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onFileChange}
            />
          </div>

          {csvFile && (
            <Button size="sm" onClick={onParseCSV} disabled={isParsing} className="h-8">
              {isParsing ? 'Parsing…' : 'Parse CSV'}
            </Button>
          )}

          {csvFile && parsedData.rowCount === 0 && !isParsing && (
            <p className="text-xs text-muted-foreground">
              Click <strong>Parse CSV</strong> to analyze the file.
            </p>
          )}
        </div>
      </div>

      {/* Parse Results */}
      {parsedData.rowCount > 0 && (
        <div className="space-y-2">
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
            <div className="border rounded-md max-h-32 overflow-y-auto">
              {validationResults.map(result => (
                <div
                  key={`${result.type}-${result.rowNumber ?? ''}-${result.message}`}
                  className={`px-3 py-1 text-xs border-b last:border-0 ${
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

      {/* Options */}
      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="profile-select" className="text-sm text-muted-foreground">
            Profile
          </Label>
          <Select
            value={selectedProfileId != null ? String(selectedProfileId) : ''}
            onValueChange={value => onProfileChange(Number(value))}
          >
            <SelectTrigger id="profile-select" className="w-56 h-8">
              <SelectValue placeholder="Select a profile" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map(profile => (
                <SelectItem key={profile.id} value={String(profile.id)}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
            Use Default Properties (fill missing values from the selected profile above)
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
    </div>
  )
}
