"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, Activity, Wifi } from "lucide-react"
import type { PingAgentJobResult, PingAgentDeviceResult } from "../types/job-results"

interface PingAgentResultViewProps {
  result: PingAgentJobResult
}

const EMPTY_RESULTS: PingAgentDeviceResult[] = []

export function PingAgentResultView({ result }: PingAgentResultViewProps) {
  const output = result.output
  const deviceResults = output?.results ?? EMPTY_RESULTS

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Ping Summary
          </CardTitle>
          <CardDescription>
            Agent ping results for {output?.total_devices ?? 0} device(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Devices</p>
              <p className="text-2xl font-bold">{output?.total_devices ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Reachable</p>
              <p className="text-2xl font-bold text-green-600">{output?.reachable_count ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Unreachable</p>
              <p className="text-2xl font-bold text-red-600">{output?.unreachable_count ?? 0}</p>
            </div>
          </div>
          {result.execution_time_ms != null && (
            <p className="text-xs text-muted-foreground mt-3">
              Completed in {(result.execution_time_ms / 1000).toFixed(1)}s
            </p>
          )}
        </CardContent>
      </Card>

      {/* Per-device results */}
      {deviceResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wifi className="h-4 w-4" />
              Device Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {deviceResults.map((device) => {
                const hasReachable = device.ip_results.some((ip) => ip.reachable)
                return (
                  <div key={device.device_name} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{device.device_name}</span>
                      {hasReachable ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Reachable
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          <XCircle className="h-3 w-3 mr-1" />
                          Unreachable
                        </Badge>
                      )}
                    </div>

                    {device.ip_results.length > 0 ? (
                      <div className="space-y-1 ml-2">
                        {device.ip_results.map((ip) => (
                          <div key={ip.ip_address} className="flex items-center gap-3 text-xs text-muted-foreground">
                            {ip.reachable ? (
                              <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                            ) : (
                              <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                            )}
                            <span className="font-mono w-40">{ip.ip_address}</span>
                            {ip.reachable ? (
                              <span className="text-green-700">
                                {ip.latency_ms != null ? `${ip.latency_ms} ms` : "reachable"}
                              </span>
                            ) : (
                              <span className="text-red-500">not reachable</span>
                            )}
                            {ip.packet_loss_percent > 0 && ip.reachable && (
                              <span className="text-amber-500">{ip.packet_loss_percent}% loss</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground ml-2">No IP addresses found</p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
