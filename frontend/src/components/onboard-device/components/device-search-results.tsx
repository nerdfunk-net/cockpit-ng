'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle } from 'lucide-react'

interface DeviceSearchResult {
  id: string
  name: string
  device_type?: {
    display?: string
    manufacturer?: {
      name?: string
    }
  }
  status?: {
    name?: string
    color?: string
  }
  location?: {
    name?: string
  }
  primary_ip4?: {
    address?: string
  }
}

interface DeviceSearchResultsProps {
  results: DeviceSearchResult[]
  searchQuery: string
}

export function DeviceSearchResults({ results, searchQuery }: DeviceSearchResultsProps) {
  if (!searchQuery) {
    return null
  }

  if (results.length === 0) {
    return (
      <Card className="border-2 border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <CardTitle className="text-lg text-green-800">Device Not Found</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-green-700">
            No device found with name &quot;{searchQuery}&quot; in Nautobot. You can proceed with
            onboarding.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-yellow-200 bg-yellow-50">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <XCircle className="h-5 w-5 text-yellow-600" />
          <CardTitle className="text-lg text-yellow-800">
            Device Already Exists ({results.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-yellow-700 mb-4">
          Found {results.length} device{results.length > 1 ? 's' : ''} matching &quot;
          {searchQuery}&quot;:
        </p>
        <div className="space-y-3">
          {results.map(device => (
            <div
              key={device.id}
              className="bg-white rounded-lg border border-yellow-200 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{device.name}</span>
                {device.status && (
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: device.status.color || '#64748b',
                      color: device.status.color || '#64748b'
                    }}
                  >
                    {device.status.name}
                  </Badge>
                )}
              </div>
              {device.device_type && (
                <div className="text-sm text-slate-600">
                  <span className="font-medium">Type:</span>{' '}
                  {device.device_type.manufacturer?.name && (
                    <span>{device.device_type.manufacturer.name} - </span>
                  )}
                  {device.device_type.display}
                </div>
              )}
              {device.location && (
                <div className="text-sm text-slate-600">
                  <span className="font-medium">Location:</span> {device.location.name}
                </div>
              )}
              {device.primary_ip4 && (
                <div className="text-sm text-slate-600">
                  <span className="font-medium">IP:</span> {device.primary_ip4.address}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
