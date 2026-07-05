'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FileText, Clock, Zap, Bot, Server } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CustomField {
  id: string
  name?: string
  key: string
  label: string
  type: {
    value: string
    label: string
  }
}

interface CockpitAgent {
  agent_id: string
  hostname: string
  status: string
}

interface BackupJobTemplateProps {
  formBackupRunningConfigPath: string
  setFormBackupRunningConfigPath: (value: string) => void
  formBackupStartupConfigPath: string
  setFormBackupStartupConfigPath: (value: string) => void
  formWriteTimestampToCustomField: boolean
  setFormWriteTimestampToCustomField: (value: boolean) => void
  formTimestampCustomFieldName: string
  setFormTimestampCustomFieldName: (value: string) => void
  formParallelTasks: number
  setFormParallelTasks: (value: number) => void
  formBackupAgentId: string
  setFormBackupAgentId: (value: string) => void
  netmikoAgents: CockpitAgent[]
  loadingAgents: boolean
  customFields: CustomField[]
}

export function BackupJobTemplate({
  formBackupRunningConfigPath,
  setFormBackupRunningConfigPath,
  formBackupStartupConfigPath,
  setFormBackupStartupConfigPath,
  formWriteTimestampToCustomField,
  setFormWriteTimestampToCustomField,
  formTimestampCustomFieldName,
  setFormTimestampCustomFieldName,
  formParallelTasks,
  setFormParallelTasks,
  formBackupAgentId,
  setFormBackupAgentId,
  netmikoAgents,
  loadingAgents,
  customFields,
}: BackupJobTemplateProps) {
  const executionMode = formBackupAgentId ? 'agent' : 'celery'

  const handleExecutionModeChange = (mode: string) => {
    if (mode === 'celery') {
      setFormBackupAgentId('')
    } else if (mode === 'agent' && netmikoAgents.length > 0) {
      setFormBackupAgentId(netmikoAgents[0]?.agent_id ?? '')
    }
  }

  return (
    <>
      {/* Backup Paths Section */}
      <div className="rounded-lg border border-warning-border bg-warning/30 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-warning-foreground" />
          <Label className="text-sm font-semibold text-warning-foreground">
            Backup Configuration Paths
          </Label>
        </div>

        <div className="bg-warning border border-warning-border rounded-md px-3 py-2 space-y-1">
          <p className="text-xs text-warning-foreground leading-relaxed">
            <span className="font-semibold">Available variables</span> (leave empty to
            use defaults):
          </p>
          <p className="text-xs text-warning-foreground leading-relaxed">
            Device: {'{device_name}'}, {'{hostname}'}, {'{serial}'}, {'{asset_tag}'}
          </p>
          <p className="text-xs text-warning-foreground leading-relaxed">
            Location: {'{location.name}'}, {'{location.parent.name}'},{' '}
            {'{location.parent.parent.name}'}
          </p>
          <p className="text-xs text-warning-foreground leading-relaxed">
            Modifier: use <span className="font-mono">{'| location_type:Value'}</span>{' '}
            to filter by location type — e.g.{' '}
            <span className="font-mono">{'| location_type:City'}</span>
          </p>
          <p className="text-xs text-warning-foreground leading-relaxed">
            Platform: {'{platform.name}'}, {'{platform.manufacturer.name}'},{' '}
            {'{device_type.model}'}
          </p>
          <p className="text-xs text-warning-foreground leading-relaxed">
            Other: {'{role.name}'}, {'{status.name}'}, {'{tenant.name}'},{' '}
            {'{rack.name}'}, {'{custom_field_data.FIELD_NAME}'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label
              htmlFor="running-config-path"
              className="text-sm text-warning-foreground font-medium flex items-center gap-1"
            >
              Running Config Path{' '}
              <span className="text-xs text-warning-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="running-config-path"
              placeholder="{custom_field_data.net}/{location.name}/{device_name}.running_config"
              value={formBackupRunningConfigPath}
              onChange={e => setFormBackupRunningConfigPath(e.target.value)}
              className="h-9 bg-card border-warning-border font-mono text-sm focus:ring-ring/30 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="startup-config-path"
              className="text-sm text-warning-foreground font-medium flex items-center gap-1"
            >
              Startup Config Path{' '}
              <span className="text-xs text-warning-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="startup-config-path"
              placeholder="{custom_field_data.net}/{location.name}/{device_name}.startup_config"
              value={formBackupStartupConfigPath}
              onChange={e => setFormBackupStartupConfigPath(e.target.value)}
              className="h-9 bg-card border-warning-border font-mono text-sm focus:ring-ring/30 focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Backup Timestamp Section */}
      <div className="rounded-lg border border-info-border bg-info/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-info-foreground" />
          <Label className="text-sm font-semibold text-info-foreground">
            Backup Timestamp
          </Label>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-3">
            <Switch
              id="write-timestamp"
              checked={formWriteTimestampToCustomField}
              onCheckedChange={checked => {
                setFormWriteTimestampToCustomField(checked)
                if (!checked) {
                  setFormTimestampCustomFieldName('')
                }
              }}
            />
            <Label
              htmlFor="write-timestamp"
              className="text-sm text-info-foreground cursor-pointer"
            >
              Write timestamp to custom field
            </Label>
          </div>

          {formWriteTimestampToCustomField && (
            <div className="flex-1 space-y-1">
              <Select
                value={formTimestampCustomFieldName}
                onValueChange={setFormTimestampCustomFieldName}
                disabled={customFields.length === 0}
              >
                <SelectTrigger
                  id="timestamp-custom-field"
                  className={cn(
                    'h-9 bg-card',
                    !formTimestampCustomFieldName
                      ? 'border-destructive focus:ring-destructive/30 focus:border-destructive'
                      : 'border-info-border'
                  )}
                >
                  <SelectValue
                    placeholder={
                      customFields.length === 0
                        ? 'No suitable custom fields found'
                        : 'Select custom field...'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {customFields.map(field => (
                    <SelectItem key={field.id} value={field.key}>
                      <div className="flex items-center gap-2">
                        <span>{field.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          {field.type.label}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!formTimestampCustomFieldName && (
                <p className="text-xs text-destructive font-medium">
                  Please select a custom field
                </p>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-info-foreground mt-2">
          When enabled, the backup completion timestamp will be written to the selected
          custom field in Nautobot
        </p>
      </div>

      {/* Execution Engine Section — only shown when at least one Netmiko agent is available */}
      {netmikoAgents.length > 0 && (
        <div className="rounded-lg border border-info-border bg-info/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-info-foreground" />
            <Label className="text-sm font-semibold text-info-foreground">
              Execution Engine
            </Label>
          </div>

          <RadioGroup
            value={executionMode}
            onValueChange={handleExecutionModeChange}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="celery" id="exec-celery" />
              <Label htmlFor="exec-celery" className="text-sm text-info-foreground cursor-pointer font-medium">
                Celery Worker
              </Label>
              <span className="text-xs text-info-foreground">
                — direct SSH from the backend (parallel execution supported)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="agent" id="exec-agent" />
              <Label htmlFor="exec-agent" className="text-sm text-info-foreground cursor-pointer font-medium">
                Netmiko Agent
              </Label>
              <span className="text-xs text-info-foreground">
                — route SSH through a remote cockpit agent (sequential)
              </span>
            </div>
          </RadioGroup>

          {executionMode === 'agent' && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs text-info-foreground">
                Select Agent <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formBackupAgentId}
                onValueChange={setFormBackupAgentId}
                disabled={loadingAgents}
              >
                <SelectTrigger
                  className={cn(
                    'h-9 bg-card',
                    !formBackupAgentId ? 'border-destructive' : 'border-info-border'
                  )}
                >
                  <SelectValue placeholder="Select agent…" />
                </SelectTrigger>
                <SelectContent>
                  {netmikoAgents.map(agent => (
                    <SelectItem key={agent.agent_id} value={agent.agent_id}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        <span>{agent.hostname}</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-xs',
                            agent.status === 'online'
                              ? 'bg-success text-success-foreground'
                              : agent.status === 'offline'
                              ? 'bg-error text-error-foreground'
                              : 'bg-info text-info-foreground'
                          )}
                        >
                          {agent.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!formBackupAgentId && (
                <p className="text-xs text-destructive font-medium">Please select an agent</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Parallel Execution Section — hidden when agent mode is active */}
      {!formBackupAgentId && (
        <div className="rounded-lg border border-info-border bg-info/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-info-foreground" />
            <Label className="text-sm font-semibold text-info-foreground">
              Parallel Execution
            </Label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="parallel-tasks"
                className="text-sm text-info-foreground font-medium"
              >
                Number of Parallel Tasks
              </Label>
              <Badge variant="secondary" className="text-xs">
                {formParallelTasks === 1 ? 'Sequential' : `${formParallelTasks} workers`}
              </Badge>
            </div>
            <Input
              id="parallel-tasks"
              type="number"
              min="1"
              max="50"
              value={formParallelTasks}
              onChange={e => {
                const value = parseInt(e.target.value) || 1
                setFormParallelTasks(Math.min(50, Math.max(1, value)))
              }}
              className="h-9 bg-card border-info-border focus:ring-ring/30 focus:border-primary"
            />
            <p className="text-xs text-info-foreground leading-relaxed">
              <span className="font-semibold">Recommended:</span> 1 = sequential (safe,
              slow), 5-10 = moderate parallel execution, 20+ = high parallel execution
              (requires sufficient Celery workers)
            </p>
          </div>
        </div>
      )}
    </>
  )
}
