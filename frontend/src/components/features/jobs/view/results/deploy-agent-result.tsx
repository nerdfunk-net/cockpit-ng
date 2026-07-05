'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { StatusIcon } from '@/components/shared/status-icon'
import {
  CheckCircle2,
  GitBranch,
  Bot,
  FileCode,
  Clock,
  RefreshCw,
  Layers,
} from 'lucide-react'
import { DeployAgentJobResult } from '../types/job-results'

interface DeployAgentResultViewProps {
  result: DeployAgentJobResult
}

export function DeployAgentResultView({ result }: DeployAgentResultViewProps) {
  const hasMultiTemplateResults =
    result.template_results && result.template_results.length > 0

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-muted rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
          <p
            className={`text-lg font-semibold ${result.success ? 'text-success-foreground' : 'text-error-foreground'}`}
          >
            {result.success ? 'Success' : 'Failed'}
          </p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Files Changed
          </p>
          <p className="text-lg font-semibold text-foreground">
            {String(result.files_changed ?? 0)}
          </p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pushed</p>
          <Badge variant={result.pushed ? 'default' : 'secondary'} className="mt-1">
            {result.pushed ? 'Yes' : 'No'}
          </Badge>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Commit</p>
          <p className="text-lg font-mono font-semibold text-foreground">
            {result.commit_sha_short || 'N/A'}
          </p>
        </div>
      </div>

      {/* Message */}
      {result.message && (
        <div
          className={`border rounded-lg p-3 flex items-start gap-2 ${
            result.success ? 'status-success' : 'status-error'
          }`}
        >
          <StatusIcon
            variant={result.success ? 'success' : 'error'}
            className="h-5 w-5 shrink-0 mt-0.5"
          />
          <p className="text-sm">{String(result.message)}</p>
        </div>
      )}

      {/* Git Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-primary" />
            Git Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-muted-foreground">Repository</span>
              <span className="text-foreground">{result.repository_name}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-muted-foreground">Branch</span>
              <Badge variant="outline">{result.branch}</Badge>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-muted-foreground">Commit SHA</span>
              <span className="text-foreground font-mono text-xs">
                {result.commit_sha || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-muted-foreground">Files Changed</span>
              <span className="text-foreground">{String(result.files_changed ?? 0)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium text-muted-foreground">Pushed to Remote</span>
              <Badge variant={result.pushed ? 'default' : 'secondary'}>
                {result.pushed ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Template Results */}
      {hasMultiTemplateResults && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-primary" />
              Deployed Templates ({result.template_results!.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.template_results!.map(tr => (
                <div
                  key={tr.template_id}
                  className={`rounded-lg border p-3 ${
                    tr.success
                      ? 'bg-success/50 border-success-border'
                      : 'bg-error/50 border-error-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon
                        variant={tr.success ? 'success' : 'error'}
                        className="h-4 w-4"
                      />
                      <span className="font-medium text-sm text-foreground">
                        {tr.template_name || `Template ${tr.template_id}`}
                      </span>
                    </div>
                    <Badge
                      variant={tr.success ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {tr.success ? 'Success' : 'Failed'}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {tr.file_path && (
                      <div className="flex items-center gap-1">
                        <FileCode className="h-3 w-3" />
                        <span className="font-mono">{tr.file_path}</span>
                      </div>
                    )}
                    {tr.success && tr.rendered_size > 0 && (
                      <div>
                        <span className="text-muted-foreground">Size: </span>
                        <span>{tr.rendered_size.toLocaleString()} chars</span>
                      </div>
                    )}
                    {tr.error && (
                      <div className="col-span-2 text-error-foreground mt-1">
                        {tr.error}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Single-Template Deployment Details (legacy/single mode) */}
      {!hasMultiTemplateResults && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary" />
              Deployment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="font-medium text-muted-foreground">Agent</span>
                <span className="text-foreground">{result.agent_name}</span>
              </div>
              {result.template_name && (
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium text-muted-foreground">Template</span>
                  <span className="text-foreground">{result.template_name}</span>
                </div>
              )}
              {result.file_path && (
                <div className="flex justify-between py-2 border-b items-center">
                  <span className="font-medium text-muted-foreground flex items-center gap-1">
                    <FileCode className="h-3.5 w-3.5" />
                    File Path
                  </span>
                  <span className="text-foreground font-mono text-xs">
                    {result.file_path}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Timestamp
                </span>
                <span className="text-foreground">{result.timestamp}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent info for multi-template mode */}
      {hasMultiTemplateResults && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary" />
              Agent Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="font-medium text-muted-foreground">Agent</span>
                <span className="text-foreground">{result.agent_name}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Timestamp
                </span>
                <span className="text-foreground">{result.timestamp}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activation Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-primary" />
            Agent Activation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-muted-foreground">Activation Enabled</span>
              <Badge variant={result.activated !== false ? 'default' : 'secondary'}>
                {result.activated !== false ? 'Yes' : 'No'}
              </Badge>
            </div>
            {result.activated && (
              <>
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium text-muted-foreground">Status</span>
                  <StatusBadge variant="success">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Success
                  </StatusBadge>
                </div>
                {result.activation_output && (
                  <div className="py-2">
                    <span className="font-medium text-muted-foreground block mb-1">
                      Output
                    </span>
                    <div className="bg-muted rounded p-2 font-mono text-xs text-foreground whitespace-pre-wrap">
                      {result.activation_output}
                    </div>
                  </div>
                )}
              </>
            )}
            {result.activation_warning && (
              <div className="py-2">
                <span className="font-medium text-muted-foreground block mb-1">
                  Warning
                </span>
                <div className="bg-warning border border-warning-border rounded p-2 text-xs text-warning-foreground">
                  {result.activation_warning}
                </div>
              </div>
            )}
            {!result.activated && !result.activation_warning && (
              <div className="py-2 text-muted-foreground text-xs">
                Agent activation was not enabled for this deployment.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
