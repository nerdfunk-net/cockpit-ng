'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatusAlert } from '@/components/shared/status-alert'
import { CheckIPJobResult } from '../types/job-results'
import { CheckCircle2, XCircle, AlertTriangle, Info, Download } from 'lucide-react'

interface CheckIPResultViewProps {
  result: CheckIPJobResult
}

const EMPTY_RESULTS: CheckIPJobResult['results'] = []

function downloadCSV(results: CheckIPJobResult['results']): void {
  if (results.length === 0) return

  const headers = ['IP Address', 'Device Name', 'Status', 'Nautobot Device Name', 'Error']
  const escape = (v: string) => {
    const s = v ?? ''
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const rows = results.map(r => [
    escape(r.ip_address),
    escape(r.device_name),
    escape(r.status),
    escape(r.nautobot_device_name ?? ''),
    escape(r.error ?? ''),
  ])
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `check-ip-results-${new Date().toISOString().split('T')[0]}.csv`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function CheckIPResultView({ result }: CheckIPResultViewProps) {
  const [showAll, setShowAll] = useState(false)

  const results = result.results || EMPTY_RESULTS
  const displayedResults = showAll ? results : results.filter(r => r.status !== 'match')

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'match':
        return <CheckCircle2 className="h-4 w-4 text-success-foreground" />
      case 'name_mismatch':
        return <AlertTriangle className="h-4 w-4 text-warning-foreground" />
      case 'name_partial_mismatch':
        return <AlertTriangle className="h-4 w-4 text-warning-foreground" />
      case 'ip_not_found':
        return <XCircle className="h-4 w-4 text-error-foreground" />
      case 'error':
        return <XCircle className="h-4 w-4 text-error-foreground" />
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />
    }
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'match':
        return 'bg-success text-success-foreground border-success-border'
      case 'name_mismatch':
        return 'bg-warning text-warning-foreground border-warning-border'
      case 'name_partial_mismatch':
        return 'bg-warning text-warning-foreground border-warning-border'
      case 'ip_not_found':
        return 'bg-error text-error-foreground border-error-border'
      case 'error':
        return 'bg-error text-error-foreground border-error-border'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Summary
          </CardTitle>
          <CardDescription>
            {result.message || 'Device comparison results'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Devices</p>
              <p className="text-2xl font-bold">
                {result.total_devices || results.length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Matches</p>
              <p className="text-2xl font-bold text-success-foreground">
                {result.statistics.matches}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Mismatches</p>
              <p className="text-2xl font-bold text-warning-foreground">
                {result.statistics.name_mismatches}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Partial Mismatches</p>
              <p className="text-2xl font-bold text-warning-foreground">
                {result.statistics.name_partial_mismatches ?? 0}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Not Found</p>
              <p className="text-2xl font-bold text-error-foreground">
                {result.statistics.ip_not_found}
              </p>
            </div>
          </div>
          {result.statistics.errors > 0 && (
            <StatusAlert variant="error" className="mt-4">
              {result.statistics.errors} device(s) encountered errors during processing
            </StatusAlert>
          )}
        </CardContent>
      </Card>

      {/* Results List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Device Results</CardTitle>
              <CardDescription>
                {showAll
                  ? `Showing all ${results.length} devices`
                  : `Showing ${displayedResults.length} differences (${results.length} total)`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => downloadCSV(results)}
                variant="outline"
                size="sm"
                disabled={results.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
              <Button
                onClick={() => setShowAll(!showAll)}
                variant={showAll ? 'default' : 'outline'}
                size="sm"
              >
                {showAll ? 'Show Differences Only' : 'Show All'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {displayedResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-success-foreground" />
                <p>All devices matched successfully!</p>
              </div>
            ) : (
              displayedResults.map(device => (
                <div
                  key={`${device.ip_address}-${device.device_name}`}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(device.status)}
                    <div>
                      <p className="font-medium">{device.device_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {device.ip_address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(device.status)} variant="outline">
                      {device.status.replaceAll('_', ' ').toUpperCase()}
                    </Badge>
                    {device.nautobot_device_name &&
                      device.nautobot_device_name !== device.device_name && (
                        <span className="text-sm text-muted-foreground">
                          → {device.nautobot_device_name}
                        </span>
                      )}
                    {device.error && (
                      <span
                        className="text-sm text-error-foreground max-w-xs truncate"
                        title={device.error}
                      >
                        {device.error}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
