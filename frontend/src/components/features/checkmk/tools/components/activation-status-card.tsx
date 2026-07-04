'use client'

import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import type { ActivationStatusResponse } from '../hooks/use-checkmk-changes-query'

interface ActivationStatusCardProps {
  data: ActivationStatusResponse
  isLoading: boolean
}

export function ActivationStatusCard({
  data,
  isLoading: _isLoading,
}: ActivationStatusCardProps) {
  const extensions = data.data.extensions
  const isRunning = extensions.is_running
  const statusPerSite = extensions.status_per_site || []

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const getStatusIcon = (state?: string) => {
    if (!state) {
      return <Clock className="h-5 w-5 text-info-foreground" />
    }
    switch (state) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-success-foreground" />
      case 'error':
      case 'failed':
        return <XCircle className="h-5 w-5 text-error-foreground" />
      default:
        return <Clock className="h-5 w-5 text-info-foreground" />
    }
  }

  const getStatusColor = (state?: string) => {
    if (!state) return 'status-info'
    switch (state) {
      case 'success':
        return 'status-success'
      case 'error':
      case 'failed':
        return 'status-error'
      default:
        return 'status-info'
    }
  }

  return (
    <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
      {/* Header with gradient */}
      <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">Activation Status</span>
        </div>
        <div className="flex items-center space-x-2">
          {isRunning && <Loader2 className="h-4 w-4 animate-spin" />}
          <div className="text-xs text-panel-header-muted">{data.data.title}</div>
        </div>
      </div>

      {/* Content area */}
      <div className="p-6 panel-content space-y-4">
        {/* Activation Overview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded-md">
            <span className="text-sm font-medium text-muted-foreground">
              Activation ID:
            </span>
            <code className="text-xs font-mono bg-card px-2 py-1 rounded border">
              {data.data.id}
            </code>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-md">
            <span className="text-sm font-medium text-muted-foreground">Status:</span>
            <Badge variant={isRunning ? 'default' : 'secondary'}>
              {isRunning ? 'In Progress' : 'Complete'}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-md">
            <span className="text-sm font-medium text-muted-foreground">Started:</span>
            <span className="text-sm text-muted-foreground">
              {formatDate(extensions.time_started)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-md">
            <span className="text-sm font-medium text-muted-foreground">Sites:</span>
            <div className="flex gap-1">
              {extensions.sites.map(site => (
                <Badge key={site} variant="outline" className="text-xs">
                  {site}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Changes List */}
        {extensions.changes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Activated Changes:
            </h4>
            <div className="space-y-2">
              {extensions.changes.map(change => (
                <div key={change.id} className="p-3 bg-muted border rounded-md">
                  <div className="flex items-start justify-between mb-1">
                    <Badge className="bg-info text-info-foreground border-info-border text-xs">
                      {change.action_name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      by {change.user_id}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1">{change.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(change.time)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Site Status */}
        {statusPerSite.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Site Status:
            </h4>
            <div className="space-y-3">
              {statusPerSite.map(siteStatus => (
                <Alert
                  key={siteStatus.site}
                  className={getStatusColor(siteStatus.state)}
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(siteStatus.state)}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">
                          Site: {siteStatus.site}
                        </span>
                        <StatusBadge
                          variant={
                            siteStatus.state === 'success'
                              ? 'success'
                              : siteStatus.state === 'error'
                                ? 'error'
                                : 'info'
                          }
                        >
                          {siteStatus.status_text}
                        </StatusBadge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {siteStatus.status_details}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                        <span>Phase: {siteStatus.phase}</span>
                        {siteStatus.start_time && (
                          <>
                            <span>•</span>
                            <span>Started: {formatDate(siteStatus.start_time)}</span>
                          </>
                        )}
                        {siteStatus.end_time && (
                          <>
                            <span>•</span>
                            <span>Ended: {formatDate(siteStatus.end_time)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isRunning && (
          <Alert className="status-info">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Activation is in progress. Status will update automatically...
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
