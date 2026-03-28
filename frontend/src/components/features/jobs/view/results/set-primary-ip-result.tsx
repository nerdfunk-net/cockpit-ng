'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Network,
  SkipForward,
  Info,
} from 'lucide-react'
import type { SetPrimaryIpJobResult, SetPrimaryIpDeviceResult } from '../types/job-results'

interface SetPrimaryIpResultViewProps {
  result: SetPrimaryIpJobResult
}

const EMPTY_RESULTS: SetPrimaryIpDeviceResult[] = []

const STRATEGY_LABELS: Record<string, string> = {
  ip_reachable: 'IP is reachable',
  interface_name: 'Interface Name',
}

function StatusBadge({ status }: { status: SetPrimaryIpDeviceResult['status'] }) {
  switch (status) {
    case 'assigned':
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Assigned
        </Badge>
      )
    case 'skipped':
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
          <SkipForward className="h-3 w-3 mr-1" />
          Skipped
        </Badge>
      )
    case 'unreachable':
      return (
        <Badge variant="destructive" className="text-xs">
          <XCircle className="h-3 w-3 mr-1" />
          Unreachable
        </Badge>
      )
    case 'failed':
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      )
  }
}

export function SetPrimaryIpResultView({ result }: SetPrimaryIpResultViewProps) {
  const deviceResults = result.results ?? EMPTY_RESULTS
  const strategyLabel = STRATEGY_LABELS[result.strategy] ?? result.strategy

  // Interface Name scaffold response
  if (result.strategy === 'interface_name') {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Set Primary IP — Interface Name
            </CardTitle>
            <CardDescription>Strategy: {strategyLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3">
              <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">
                {result.note ?? 'Interface Name strategy is not yet implemented.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Set Primary IP Summary
          </CardTitle>
          <CardDescription>Strategy: {strategyLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-2xl font-bold">{result.total_devices ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Assigned</p>
              <p className="text-2xl font-bold text-green-600">{result.assigned_count ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Skipped</p>
              <p className="text-2xl font-bold text-amber-500">{result.skipped_count ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Unreachable</p>
              <p className="text-2xl font-bold text-red-600">{result.unreachable_count ?? 0}</p>
            </div>
          </div>
          {(result.failed_count ?? 0) > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm text-red-600 font-medium">
                {result.failed_count} device(s) failed — see details below.
              </p>
            </div>
          )}
          {result.execution_time_ms != null && (
            <p className="text-xs text-muted-foreground mt-3">
              Completed in {(result.execution_time_ms / 1000).toFixed(1)}s
            </p>
          )}
        </CardContent>
      </Card>

      {/* Device Results Table */}
      {deviceResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Network className="h-4 w-4" />
              Device Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {deviceResults.map(device => (
                <div key={device.device_name} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{device.device_name}</span>
                    <StatusBadge status={device.status} />
                  </div>

                  {device.status === 'assigned' && device.primary_ip && (
                    <p className="text-xs text-green-700 ml-1">
                      Primary IP set to{' '}
                      <code className="font-mono bg-green-50 px-1 rounded">{device.primary_ip}</code>
                    </p>
                  )}

                  {device.status === 'skipped' && device.reachable_ips.length > 0 && (
                    <p className="text-xs text-amber-600 ml-1">
                      Multiple IPs reachable:{' '}
                      {device.reachable_ips.map(ip => (
                        <code key={ip} className="font-mono bg-amber-50 px-1 rounded mr-1">
                          {ip}
                        </code>
                      ))}
                    </p>
                  )}

                  {device.status === 'failed' && device.reason && (
                    <p className="text-xs text-red-600 ml-1">{device.reason}</p>
                  )}

                  {device.status === 'unreachable' && (
                    <p className="text-xs text-muted-foreground ml-1">No reachable IPs found</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
