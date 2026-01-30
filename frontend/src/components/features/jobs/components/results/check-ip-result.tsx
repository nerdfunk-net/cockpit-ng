"use client"

import React, { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckIPJobResult } from "../../types/job-results"
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react"

interface CheckIPResultViewProps {
  result: CheckIPJobResult
}

const EMPTY_RESULTS: CheckIPJobResult['results'] = []

export function CheckIPResultView({ result }: CheckIPResultViewProps) {
  const [showAll, setShowAll] = useState(false)
  
  const results = result.results || EMPTY_RESULTS
  const displayedResults = showAll 
    ? results 
    : results.filter(r => r.status !== 'match')

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'match':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'name_mismatch':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'ip_not_found':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Info className="h-4 w-4 text-gray-600" />
    }
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'match':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'name_mismatch':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'ip_not_found':
        return 'bg-red-100 text-red-700 border-red-300'
      case 'error':
        return 'bg-red-100 text-red-700 border-red-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Devices</p>
              <p className="text-2xl font-bold">{result.total_devices || results.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Matches</p>
              <p className="text-2xl font-bold text-green-600">{result.statistics.matches}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Mismatches</p>
              <p className="text-2xl font-bold text-yellow-600">{result.statistics.name_mismatches}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Not Found</p>
              <p className="text-2xl font-bold text-red-600">{result.statistics.ip_not_found}</p>
            </div>
          </div>
          {result.statistics.errors > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">
                <XCircle className="h-4 w-4 inline mr-1" />
                {result.statistics.errors} device(s) encountered errors during processing
              </p>
            </div>
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
                  : `Showing ${displayedResults.length} differences (${results.length} total)`
                }
              </CardDescription>
            </div>
            <Button 
              onClick={() => setShowAll(!showAll)} 
              variant={showAll ? "default" : "outline"}
              size="sm"
            >
              {showAll ? 'Show Differences Only' : 'Show All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {displayedResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>All devices matched successfully!</p>
              </div>
            ) : (
              displayedResults.map((device) => (
                <div key={`${device.ip_address}-${device.device_name}`} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(device.status)}
                    <div>
                      <p className="font-medium">{device.device_name}</p>
                      <p className="text-sm text-muted-foreground">{device.ip_address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(device.status)} variant="outline">
                      {device.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                    {device.nautobot_device_name && device.nautobot_device_name !== device.device_name && (
                      <span className="text-sm text-muted-foreground">
                        → {device.nautobot_device_name}
                      </span>
                    )}
                    {device.error && (
                      <span className="text-sm text-red-600 max-w-xs truncate" title={device.error}>
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
