'use client'

import { useCallback, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Loader2,
  Settings2,
  Upload,
  Zap,
} from 'lucide-react'
import { StatusAlert } from '@/components/shared/status-alert'
import { useAgentMutations } from '@/components/features/agents/operating/hooks/use-agent-mutations'
import { useGetDataAgents } from '@/components/features/nautobot/tools/csv-updates/hooks/use-get-data-agents'
import { combineAgentKeys } from '@/components/features/nautobot/tools/csv-updates/utils/agent-data'
import type { Profile } from '@/components/features/settings/defaults/profiles/types'
import type { CsvRepoFile, GitRepository } from '../../types'
import { CSV_IMPORT_FORMAT_LABELS, CSV_IMPORT_TYPE_LABELS } from '../../utils/constants'

interface CsvImportJobTemplateProps {
  formCsvImportSource: 'git' | 'agent'
  setFormCsvImportSource: (value: 'git' | 'agent') => void
  formCsvImportRepoId: number | null
  setFormCsvImportRepoId: (value: number | null) => void
  formCsvImportFilePath: string
  setFormCsvImportFilePath: (value: string) => void
  formCsvImportAgentId: string
  setFormCsvImportAgentId: (value: string) => void
  formCsvImportAgentFlows: string[]
  setFormCsvImportAgentFlows: (value: string[]) => void
  formCsvImportType: string
  setFormCsvImportType: (value: string) => void
  formCsvImportPrimaryKey: string
  setFormCsvImportPrimaryKey: (value: string) => void
  formCsvImportUpdateExisting: boolean
  setFormCsvImportUpdateExisting: (value: boolean) => void
  formCsvImportImportUnknown: boolean
  setFormCsvImportImportUnknown: (value: boolean) => void
  formCsvImportDelimiter: string
  setFormCsvImportDelimiter: (value: string) => void
  formCsvImportQuoteChar: string
  setFormCsvImportQuoteChar: (value: string) => void
  formCsvImportColumnMapping: Record<string, string | null>
  formCsvImportFileFilter: string
  setFormCsvImportFileFilter: (value: string) => void
  formCsvImportProfileId: number | null
  setFormCsvImportProfileId: (value: number | null) => void
  formCsvImportFormat: string
  setFormCsvImportFormat: (value: string) => void
  formCsvImportAddPrefixes: boolean
  setFormCsvImportAddPrefixes: (value: boolean) => void
  formCsvImportDefaultPrefixLength: string
  setFormCsvImportDefaultPrefixLength: (value: string) => void
  csvImportRepos: GitRepository[]
  csvFiles: CsvRepoFile[]
  csvHeaders: string[]
  csvFilesLoading: boolean
  csvHeadersLoading: boolean
  onAgentHeadersLoaded: (headers: string[]) => void
  profiles: Profile[]
  mappedColumnCount: number
  onOpenMappingDialog: () => void
  fileQuery: string
  setFileQuery: (value: string) => void
}

export function CsvImportJobTemplate({
  formCsvImportSource,
  setFormCsvImportSource,
  formCsvImportRepoId,
  setFormCsvImportRepoId,
  formCsvImportFilePath,
  setFormCsvImportFilePath,
  formCsvImportAgentId,
  setFormCsvImportAgentId,
  formCsvImportAgentFlows,
  setFormCsvImportAgentFlows,
  formCsvImportType,
  setFormCsvImportType,
  formCsvImportPrimaryKey,
  setFormCsvImportPrimaryKey,
  formCsvImportUpdateExisting,
  setFormCsvImportUpdateExisting,
  formCsvImportImportUnknown,
  setFormCsvImportImportUnknown,
  formCsvImportDelimiter,
  setFormCsvImportDelimiter,
  formCsvImportQuoteChar,
  setFormCsvImportQuoteChar,
  formCsvImportFileFilter,
  setFormCsvImportFileFilter,
  formCsvImportProfileId,
  setFormCsvImportProfileId,
  formCsvImportFormat,
  setFormCsvImportFormat,
  formCsvImportAddPrefixes,
  setFormCsvImportAddPrefixes,
  formCsvImportDefaultPrefixLength,
  setFormCsvImportDefaultPrefixLength,
  csvImportRepos,
  csvFiles,
  csvHeaders,
  csvFilesLoading,
  csvHeadersLoading,
  onAgentHeadersLoaded,
  profiles,
  mappedColumnCount,
  onOpenMappingDialog,
  fileQuery,
  setFileQuery,
}: CsvImportJobTemplateProps) {
  const [configOpen, setConfigOpen] = useState(true)
  const [optionsOpen, setOptionsOpen] = useState(true)
  const [agentError, setAgentError] = useState<string | null>(null)
  const [isFetchingAgentData, setIsFetchingAgentData] = useState(false)

  const isAgentSource = formCsvImportSource === 'agent'

  const { data: agents, isLoading: isLoadingAgents } = useGetDataAgents()
  const { getData } = useAgentMutations()

  const selectedAgent = agents.find(
    agent => (agent.agent_id ?? agent.id) === formCsvImportAgentId
  )

  // Union of the flows the agent currently reports and the flows already saved
  // on the template, so a saved selection stays visible while the agent is offline.
  const availableFlows = useMemo(() => {
    const reported = selectedAgent?.data_flows ?? []
    return Array.from(new Set([...reported, ...formCsvImportAgentFlows]))
  }, [selectedAgent, formCsvImportAgentFlows])

  const toggleFlowId = useCallback(
    (flowId: string) => {
      setFormCsvImportAgentFlows(
        formCsvImportAgentFlows.includes(flowId)
          ? formCsvImportAgentFlows.filter(id => id !== flowId)
          : [...formCsvImportAgentFlows, flowId]
      )
    },
    [formCsvImportAgentFlows, setFormCsvImportAgentFlows]
  )

  // Fetches sample data from the agent and derives the CSV headers used for
  // the primary key selector and the column mapping dialog — the same
  // combine logic the CSV Updates tool uses.
  const handleLoadAgentHeaders = useCallback(async () => {
    if (!formCsvImportAgentId || formCsvImportAgentFlows.length === 0) return

    setAgentError(null)
    setIsFetchingAgentData(true)

    const merged: Record<string, string> = {}
    const errors: string[] = []

    try {
      const responses = await Promise.all(
        formCsvImportAgentFlows.map(flowId =>
          getData
            .mutateAsync({ agent_id: formCsvImportAgentId, flow_id: flowId })
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

      const combined = combineAgentKeys(merged, {
        delimiter: formCsvImportDelimiter || ',',
        quoteChar: formCsvImportQuoteChar || '"',
      })
      if (!combined.data) {
        setAgentError(combined.error ?? 'Failed to combine agent data.')
        return
      }

      if (errors.length > 0) {
        setAgentError(`Some flows failed: ${errors.join('; ')}`)
      }

      onAgentHeadersLoaded(combined.data.headers)
    } finally {
      setIsFetchingAgentData(false)
    }
  }, [
    formCsvImportAgentId,
    formCsvImportAgentFlows,
    formCsvImportDelimiter,
    formCsvImportQuoteChar,
    getData,
    onAgentHeadersLoaded,
  ])

  const primaryKeyDisabled = isAgentSource
    ? csvHeaders.length === 0
    : !formCsvImportFilePath || csvHeadersLoading || csvHeaders.length === 0

  return (
    <div className="space-y-4">
      {/* Panel 1: CSV Import Configuration */}
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
          <CollapsibleTrigger asChild>
            <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg cursor-pointer select-none">
              <div className="flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span className="text-sm font-medium">CSV Import Configuration</span>
              </div>
              {configOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="panel-content p-6 space-y-4">
              {/* Data Source */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">
                  Data Source
                </Label>
                <Select
                  value={formCsvImportSource}
                  onValueChange={val => {
                    setFormCsvImportSource(val as 'git' | 'agent')
                    setFormCsvImportPrimaryKey('')
                  }}
                >
                  <SelectTrigger className="h-8 text-sm bg-card border-border shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="git">Git Repository</SelectItem>
                    <SelectItem value="agent">Get Data Agent</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Where the CSV data comes from when the job runs: files in a Git
                  repository, or the output of a Get Data agent.
                </p>
              </div>

              {!isAgentSource && (
                <>
                  {/* Info alert */}
                  <StatusAlert variant="info">
                    The <strong>CSV File</strong> below is used only to load an example
                    file for column mapping configuration. The actual files imported at
                    runtime are determined by the <strong>Import Options</strong> file
                    filter below.
                  </StatusAlert>

                  {/* Git Repository */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Git Repository
                    </Label>
                    <Select
                      value={formCsvImportRepoId?.toString() || ''}
                      onValueChange={val => {
                        setFormCsvImportRepoId(val ? parseInt(val) : null)
                        setFormCsvImportFilePath('')
                        setFormCsvImportPrimaryKey('')
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm bg-card border-border shadow-sm">
                        <SelectValue placeholder="Select a CSV imports repository..." />
                      </SelectTrigger>
                      <SelectContent>
                        {csvImportRepos.map(repo => (
                          <SelectItem key={repo.id} value={repo.id.toString()}>
                            {repo.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {csvImportRepos.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No repositories with category &quot;csv_imports&quot; found. Add
                        one in Settings → Git.
                      </p>
                    )}
                  </div>

                  {/* File Selector */}
                  {formCsvImportRepoId && (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">
                        CSV File (example for mapping)
                      </Label>
                      <Input
                        className="h-7 text-xs mb-1 bg-card border-border shadow-sm"
                        placeholder="Filter files..."
                        value={fileQuery}
                        onChange={e => setFileQuery(e.target.value)}
                      />
                      <Select
                        value={formCsvImportFilePath}
                        onValueChange={val => {
                          setFormCsvImportFilePath(val)
                          setFormCsvImportPrimaryKey('')
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm bg-card border-border shadow-sm">
                          {csvFilesLoading ? (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                            </span>
                          ) : (
                            <SelectValue placeholder="Select a CSV file..." />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {csvFiles.length === 0 && !csvFilesLoading && (
                            <SelectItem value="__none__" disabled>
                              No CSV files found
                            </SelectItem>
                          )}
                          {csvFiles
                            .filter(f => f.path.trim() !== '')
                            .map(file => (
                              <SelectItem key={file.path} value={file.path}>
                                {file.path}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              {isAgentSource && (
                <>
                  <StatusAlert variant="info">
                    The job fetches CSV data from the selected agent&apos;s flows at
                    runtime. Use <strong>Load Headers</strong> to fetch sample data now
                    and configure the primary key and column mapping.
                  </StatusAlert>

                  {/* Agent Selector */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Get Data Agent
                    </Label>
                    <Select
                      value={formCsvImportAgentId}
                      onValueChange={val => {
                        setFormCsvImportAgentId(val)
                        setFormCsvImportAgentFlows([])
                        setFormCsvImportPrimaryKey('')
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm bg-card border-border shadow-sm">
                        <SelectValue
                          placeholder={
                            isLoadingAgents
                              ? 'Loading agents…'
                              : 'Select a Get Data agent...'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            No Get Data agents configured
                          </SelectItem>
                        ) : (
                          agents.map(agent => (
                            <SelectItem
                              key={agent.id}
                              value={agent.agent_id ?? agent.id}
                            >
                              {agent.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Flow selection */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Data Flows (command-chain keys)
                    </Label>
                    <div className="border rounded-md p-2 space-y-0.5 max-h-28 overflow-y-auto">
                      {!formCsvImportAgentId ? (
                        <p className="text-xs text-muted-foreground px-1 py-0.5">
                          Select an agent first
                        </p>
                      ) : availableFlows.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-1 py-0.5">
                          Agent has not reported any flows yet
                        </p>
                      ) : (
                        availableFlows.map(flowId => (
                          <label
                            key={flowId}
                            className="flex items-center gap-2 px-1 py-0.5 text-sm cursor-pointer"
                          >
                            <Checkbox
                              checked={formCsvImportAgentFlows.includes(flowId)}
                              onCheckedChange={() => toggleFlowId(flowId)}
                            />
                            <span className="truncate">{flowId}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    onClick={handleLoadAgentHeaders}
                    disabled={
                      !formCsvImportAgentId ||
                      formCsvImportAgentFlows.length === 0 ||
                      isFetchingAgentData
                    }
                  >
                    {isFetchingAgentData ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {isFetchingAgentData ? 'Loading Headers…' : 'Load Headers'}
                  </Button>

                  {agentError && <StatusAlert variant="error">{agentError}</StatusAlert>}
                </>
              )}

              {/* Import Type */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">
                  Import Type
                </Label>
                <Select
                  value={formCsvImportType}
                  onValueChange={val => {
                    setFormCsvImportType(val)
                    setFormCsvImportPrimaryKey('')
                  }}
                >
                  <SelectTrigger className="h-8 text-sm bg-card border-border shadow-sm">
                    <SelectValue placeholder="Select object type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CSV_IMPORT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Primary Key */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">
                  Primary Key Column
                </Label>
                <Select
                  value={formCsvImportPrimaryKey}
                  onValueChange={setFormCsvImportPrimaryKey}
                  disabled={primaryKeyDisabled}
                >
                  <SelectTrigger className="h-8 text-sm bg-card border-border shadow-sm">
                    {csvHeadersLoading && !isAgentSource ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading headers...
                      </span>
                    ) : (
                      <SelectValue
                        placeholder={
                          isAgentSource
                            ? csvHeaders.length === 0
                              ? 'Load headers from the agent first...'
                              : 'Select lookup column...'
                            : !formCsvImportFilePath
                              ? 'Select a file first...'
                              : 'Select lookup column...'
                        }
                      />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders
                      .filter(h => h.trim() !== '')
                      .map(header => (
                        <SelectItem key={header} value={header}>
                          <code className="text-xs">{header}</code>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Column used to look up existing objects in Nautobot (e.g.
                  &quot;name&quot;, &quot;address&quot;)
                </p>
              </div>

              {/* Update / Import behavior */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="csv-import-update-data"
                    checked={formCsvImportUpdateExisting}
                    onCheckedChange={value =>
                      setFormCsvImportUpdateExisting(value === true)
                    }
                  />
                  <Label
                    htmlFor="csv-import-update-data"
                    className="text-sm text-muted-foreground"
                  >
                    Update data (update objects that already exist in Nautobot)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="csv-import-import-unknown"
                    checked={formCsvImportImportUnknown}
                    onCheckedChange={value =>
                      setFormCsvImportImportUnknown(value === true)
                    }
                  />
                  <Label
                    htmlFor="csv-import-import-unknown"
                    className="text-sm text-muted-foreground"
                  >
                    Import unknown data (create objects not found in Nautobot, using the
                    profile below for missing values)
                  </Label>
                </div>
              </div>

              {/* Profile */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">
                  Profile
                </Label>
                <Select
                  value={
                    formCsvImportProfileId != null
                      ? String(formCsvImportProfileId)
                      : ''
                  }
                  onValueChange={val =>
                    setFormCsvImportProfileId(val ? Number(val) : null)
                  }
                >
                  <SelectTrigger className="h-8 text-sm bg-card border-border shadow-sm">
                    <SelectValue placeholder="Select a profile..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map(profile => (
                      <SelectItem key={profile.id} value={String(profile.id)}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Profile values fill fields the CSV leaves blank — for updates and for
                  new objects. The CSV value always wins.
                </p>
              </div>

              {/* Delimiter & Quote Char */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Delimiter
                  </Label>
                  <Input
                    className="h-8 text-sm bg-card border-border shadow-sm"
                    value={formCsvImportDelimiter}
                    onChange={e => setFormCsvImportDelimiter(e.target.value)}
                    placeholder=","
                    maxLength={10}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Quote Character
                  </Label>
                  <Input
                    className="h-8 text-sm bg-card border-border shadow-sm"
                    value={formCsvImportQuoteChar}
                    onChange={e => setFormCsvImportQuoteChar(e.target.value)}
                    placeholder={'"'}
                    maxLength={10}
                  />
                </div>
              </div>

              {/* Column Mapping */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">
                    Column Mapping
                  </Label>
                  {mappedColumnCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {mappedColumnCount} columns mapped
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={csvHeaders.length === 0 || !formCsvImportType}
                  onClick={onOpenMappingDialog}
                >
                  <Settings2 className="h-3 w-3 mr-1" />
                  Edit Mapping
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Panel 2: Import Options */}
      <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
        <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
          <CollapsibleTrigger asChild>
            <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg cursor-pointer select-none">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">Import Options</span>
              </div>
              {optionsOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="panel-content p-6 space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">
                  Import Format
                </Label>
                <Select
                  value={formCsvImportFormat}
                  onValueChange={setFormCsvImportFormat}
                >
                  <SelectTrigger className="h-8 text-sm bg-card border-border shadow-sm">
                    <SelectValue placeholder="Select import format..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CSV_IMPORT_FORMAT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Cockpit: multi-row per device (one row per interface). Nautobot:
                  single-row export with NULL filtering. Generic: plain CSV.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">
                      Add Missing IP Prefixes
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically create parent prefixes when an IP address has no
                      matching prefix in Nautobot
                    </p>
                  </div>
                  <Switch
                    checked={formCsvImportAddPrefixes}
                    onCheckedChange={setFormCsvImportAddPrefixes}
                  />
                </div>
                {formCsvImportAddPrefixes && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Default Prefix Length
                    </Label>
                    <Input
                      className="h-8 text-sm bg-card border-border shadow-sm w-32"
                      value={formCsvImportDefaultPrefixLength}
                      onChange={e =>
                        setFormCsvImportDefaultPrefixLength(e.target.value)
                      }
                      placeholder="e.g. 24"
                      maxLength={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Applied when an IP in the CSV has no CIDR mask (e.g.{' '}
                      <code>192.168.1.1</code> → <code>192.168.1.1/24</code>). IPs that
                      already include a mask (e.g. <code>192.168.1.1/24</code>) are used
                      as-is.
                    </p>
                  </div>
                )}
              </div>
              {!isAgentSource && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">
                    File Filter
                  </Label>
                  <Input
                    className="h-8 text-sm bg-card border-border shadow-sm"
                    value={formCsvImportFileFilter}
                    onChange={e => setFormCsvImportFileFilter(e.target.value)}
                    placeholder="e.g. *.csv or devices_*.csv"
                  />
                  <p className="text-xs text-muted-foreground">
                    Glob pattern to select which CSV files are imported when the job
                    runs. All matching files in the repository will be processed
                    sequentially. Leave empty to import only the example file selected
                    above.
                  </p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  )
}
