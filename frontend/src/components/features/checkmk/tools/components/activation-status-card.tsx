'use client'

import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import type { ActivationStatusResponse } from '../hooks/queries/use-checkmk-changes-query'

interface ActivationStatusCardProps {
  data: ActivationStatusResponse
  isLoading: boolean
}

export function ActivationStatusCard({ data, isLoading: _isLoading }: ActivationStatusCardProps) {
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
      return <Clock className="h-5 w-5 text-blue-600" />
    }
    switch (state) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'error':
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <Clock className="h-5 w-5 text-blue-600" />
    }
  }

  const getStatusColor = (state?: string) => {
    if (!state) return 'bg-blue-50 border-blue-200'
    switch (state) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
      case 'failed':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">Activation Status</span>
        </div>
        <div className="flex items-center space-x-2">
          {isRunning && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          <div className="text-xs text-blue-100">
            {data.data.title}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
        {/* Activation Overview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <span className="text-sm font-medium text-gray-700">Activation ID:</span>
            <code className="text-xs font-mono bg-white px-2 py-1 rounded border">{data.data.id}</code>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <Badge variant={isRunning ? 'default' : 'secondary'}>
              {isRunning ? 'In Progress' : 'Complete'}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <span className="text-sm font-medium text-gray-700">Started:</span>
            <span className="text-sm text-gray-600">{formatDate(extensions.time_started)}</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <span className="text-sm font-medium text-gray-700">Sites:</span>
            <div className="flex gap-1">
              {extensions.sites.map((site) => (
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
            <h4 className="text-sm font-semibold text-gray-700">Activated Changes:</h4>
            <div className="space-y-2">
              {extensions.changes.map((change) => (
                <div
                  key={change.id}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-md"
                >
                  <div className="flex items-start justify-between mb-1">
                    <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
                      {change.action_name}
                    </Badge>
                    <span className="text-xs text-gray-500">by {change.user_id}</span>
                  </div>
                  <p className="text-sm text-gray-900 mt-1">{change.text}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(change.time)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Site Status */}
        {statusPerSite.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Site Status:</h4>
            <div className="space-y-3">
              {statusPerSite.map((siteStatus) => (
                <Alert
                  key={siteStatus.site}
                  className={getStatusColor(siteStatus.state)}
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(siteStatus.state)}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">Site: {siteStatus.site}</span>
                        <Badge
                          variant={siteStatus.state === 'success' ? 'default' : 'secondary'}
                          className={
                            siteStatus.state === 'success'
                              ? 'bg-green-600 hover:bg-green-700'
                              : siteStatus.state === 'error'
                                ? 'bg-red-600 hover:bg-red-700'
                                : ''
                          }
                        >
                          {siteStatus.status_text}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700">{siteStatus.status_details}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-600 mt-2">
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
          <Alert className="bg-blue-50 border-blue-200">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <AlertDescription className="text-blue-800">
              Activation is in progress. Status will update automatically...
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
