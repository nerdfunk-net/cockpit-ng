'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Settings,
} from 'lucide-react'
import type { JobStatus } from '../types'

interface JobStatusDisplayProps {
  jobId: string | null
  jobStatus: JobStatus | null
  onboardedIPAddress: string
  isCheckingJob: boolean
  onCheckStatus?: () => void
}

export function JobStatusDisplay({
  jobId,
  jobStatus,
  onboardedIPAddress,
  isCheckingJob,
  onCheckStatus,
}: JobStatusDisplayProps) {
  const router = useRouter()
  if (!jobId) {
    return null
  }

  // Normalize status to lowercase for comparison
  const normalizedStatus = jobStatus?.status?.toLowerCase()

  const handleGoToSyncDevices = () => {
    // Navigate to sync devices page with the IP address filter
    const ipAddresses = onboardedIPAddress
      .split(',')
      .map(ip => ip.trim())
      .filter(ip => ip.length > 0)
    const firstIP = ipAddresses[0] || ''

    // Navigate with query parameters to pre-fill the filter
    router.push(`/sync-devices?ip_filter=${encodeURIComponent(firstIP)}`)
  }

  const getStatusIcon = () => {
    if (isCheckingJob) {
      return <Loader2 className="h-5 w-5 text-primary animate-spin" />
    }

    switch (normalizedStatus) {
      case 'completed':
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-success-foreground" />
      case 'failed':
      case 'failure':
        return <XCircle className="h-5 w-5 text-error-foreground" />
      case 'running':
      case 'pending':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusColor = () => {
    switch (normalizedStatus) {
      case 'completed':
      case 'success':
        return 'border-success-border bg-success'
      case 'failed':
      case 'failure':
        return 'border-error-border bg-error'
      case 'running':
      case 'pending':
        return 'border-info-border bg-info'
      default:
        return 'border-border bg-muted'
    }
  }

  const getStatusBadgeVariant = () => {
    switch (normalizedStatus) {
      case 'completed':
      case 'success':
        return 'default'
      case 'failed':
      case 'failure':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const isSuccess = normalizedStatus === 'completed' || normalizedStatus === 'success'

  return (
    <Card className={`border-2 ${getStatusColor()}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <CardTitle className="text-lg">Onboarding Job Status</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {jobStatus && (
              <Badge variant={getStatusBadgeVariant()} className="text-sm">
                {jobStatus.status.toUpperCase()}
              </Badge>
            )}
            {onCheckStatus && (
              <Button
                onClick={onCheckStatus}
                disabled={isCheckingJob}
                size="sm"
                variant="outline"
                className="h-7 gap-1.5"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isCheckingJob ? 'animate-spin' : ''}`}
                />
                Check Status
              </Button>
            )}
            {isSuccess && (
              <Button
                onClick={handleGoToSyncDevices}
                size="sm"
                className="h-7 gap-1.5"
              >
                <Settings className="h-3.5 w-3.5" />
                Go to Sync Devices
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">Job ID:</div>
            <div className="font-mono text-foreground">{jobId}</div>

            {onboardedIPAddress && (
              <>
                <div className="text-muted-foreground">IP Address:</div>
                <div className="font-mono text-foreground">{onboardedIPAddress}</div>
              </>
            )}

            {jobStatus?.created_at && (
              <>
                <div className="text-muted-foreground">Started:</div>
                <div className="text-foreground">
                  {new Date(jobStatus.created_at).toLocaleString()}
                </div>
              </>
            )}

            {jobStatus?.completed_at && (
              <>
                <div className="text-muted-foreground">Completed:</div>
                <div className="text-foreground">
                  {new Date(jobStatus.completed_at).toLocaleString()}
                </div>
              </>
            )}
          </div>

          {jobStatus?.result && (
            <div className="mt-4 p-3 bg-card rounded-md border">
              <div className="text-sm font-medium text-foreground mb-2">Result:</div>
              <pre className="text-xs text-foreground whitespace-pre-wrap overflow-auto max-h-60">
                {typeof jobStatus.result === 'string'
                  ? jobStatus.result
                  : JSON.stringify(jobStatus.result, null, 2)}
              </pre>
            </div>
          )}

          {jobStatus?.error && (
            <div className="mt-4 p-3 bg-error rounded-md border border-error-border">
              <div className="text-sm font-medium text-error-foreground mb-2">
                Error:
              </div>
              <pre className="text-xs text-error-foreground whitespace-pre-wrap overflow-auto max-h-60">
                {jobStatus.error}
              </pre>
            </div>
          )}

          {isCheckingJob && (
            <div className="text-sm text-primary animate-pulse">
              Checking job status...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
