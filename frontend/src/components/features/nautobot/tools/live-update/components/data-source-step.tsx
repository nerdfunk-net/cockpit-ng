'use client'

import { useCallback, useState } from 'react'
import { Loader2, Upload, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { StatusAlert } from '@/components/shared/status-alert'
import { useAgentMutations } from '@/components/features/agents/operating/hooks/use-agent-mutations'
import { useGetDataAgents } from '../hooks/use-get-data-agents'
import { CsvUploadDialog } from './csv-upload-dialog'
import type { ParsedCsvSource } from '../types'

interface DataSourceStepProps {
  onCsvParsed: (source: ParsedCsvSource) => void
  onAgentDataReceived: (result: Record<string, string>) => void
  useNewMapping: boolean
  onUseNewMappingChange: (value: boolean) => void
}

export function DataSourceStep({
  onCsvParsed,
  onAgentDataReceived,
  useNewMapping,
  onUseNewMappingChange,
}: DataSourceStepProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [agentError, setAgentError] = useState<string | null>(null)
  const { data: agents, isLoading: isLoadingAgents } = useGetDataAgents()
  const { getData } = useAgentMutations()

  const handleGetData = useCallback(() => {
    if (!selectedAgentId) return

    setAgentError(null)
    getData.mutate(
      { agent_id: selectedAgentId },
      {
        onSuccess: data => {
          if (data.status === 'success' && data.output) {
            const keys = Object.keys(data.output.result)
            if (keys.length === 0) {
              setAgentError('The agent returned no data keys.')
              return
            }
            onAgentDataReceived(data.output.result)
          } else {
            setAgentError(data.error ?? 'The agent did not return any data.')
          }
        },
      }
    )
  }, [selectedAgentId, getData, onAgentDataReceived])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload CSV
        </Button>

        <span className="text-sm text-muted-foreground px-1">or</span>

        <div className="space-y-1">
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
        </div>

        <Button
          onClick={handleGetData}
          disabled={!selectedAgentId || getData.isPending}
        >
          {getData.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Zap className="h-4 w-4 mr-2" />
          )}
          {getData.isPending ? 'Getting Data…' : 'Get Data'}
        </Button>
      </div>

      {agentError && <StatusAlert variant="error">{agentError}</StatusAlert>}

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

      <CsvUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onParsed={onCsvParsed}
      />
    </div>
  )
}
