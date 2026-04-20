'use client'

import { useState, useCallback, useMemo } from 'react'
import { Layers, RefreshCw, Play, CheckSquare, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useStackDevicesQuery } from './hooks/use-stack-devices-query'
import { useStacksMutations } from './hooks/use-stacks-mutations'
import type { StackDevice, DeviceResult } from './types/stacks-types'

const EMPTY_SELECTION: string[] = []

export default function StacksPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>(EMPTY_SELECTION)
  const [processResults, setProcessResults] = useState<DeviceResult[] | null>(null)

  const { data, isLoading, error, refetch, isFetching } = useStackDevicesQuery()
  const { processStacks } = useStacksMutations()

  const devices: StackDevice[] = useMemo(() => data?.devices ?? [], [data?.devices])

  const allSelected = useMemo(
    () => devices.length > 0 && selectedIds.length === devices.length,
    [devices.length, selectedIds.length]
  )

  const someSelected = useMemo(
    () => selectedIds.length > 0 && selectedIds.length < devices.length,
    [selectedIds.length, devices.length]
  )

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(EMPTY_SELECTION)
    } else {
      setSelectedIds(devices.map((d) => d.id))
    }
  }, [allSelected, devices])

  const toggleDevice = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])

  const handleProcess = useCallback(() => {
    if (selectedIds.length === 0) return
    setProcessResults(null)
    processStacks.mutate(
      { device_ids: selectedIds },
      {
        onSuccess: (data) => {
          setProcessResults(data.results)
          setSelectedIds(EMPTY_SELECTION)
        },
      }
    )
  }, [selectedIds, processStacks])

  const handleRefresh = useCallback(() => {
    setProcessResults(null)
    refetch()
  }, [refetch])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Layers className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Device Stacks</h1>
            <p className="text-gray-600 mt-1">
              Detect devices with multiple serial numbers, split them, and build Virtual Chassis groups.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Info alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          The list below shows all Nautobot devices whose serial field contains a comma, indicating
          multiple serial numbers (stacked units). Select the devices you want to process and select
          <strong> Process selected</strong>. The action splits each device into separate entries and
          groups them into a Nautobot Virtual Chassis.
        </AlertDescription>
      </Alert>

      {/* Results panel */}
      {processResults && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-green-400/80 to-green-500/80 text-white py-2 px-4 rounded-t-lg flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Processing results</span>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-3">
            {processResults.map((result) => (
              <div
                key={result.device_id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  result.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{result.device_name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{result.message}</p>
                  {result.created_devices.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Created: {result.created_devices.join(', ')}
                    </p>
                  )}
                  {result.virtual_chassis_name && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Virtual Chassis: <strong>{result.virtual_chassis_name}</strong>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Devices table */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="text-sm font-medium">Potential stack devices</span>
            {data && (
              <Badge variant="secondary" className="bg-blue-200 text-blue-900 text-xs">
                {data.count}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleProcess}
            disabled={selectedIds.length === 0 || processStacks.isPending}
              className="bg-white text-blue-700 hover:bg-blue-50 h-7 px-3 text-xs font-medium"
          >
            <Play className="h-3 w-3 mr-1" />
            {processStacks.isPending
              ? 'Processing…'
              : `Process selected (${selectedIds.length})`}
          </Button>
        </div>

        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {error && (
            <Alert className="bg-red-50 border-red-200 mb-4">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Failed to load devices. Check that Nautobot is reachable.
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-400" />
              <p className="text-lg font-medium">Loading devices…</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckSquare className="h-8 w-8 mx-auto mb-3 text-green-400" />
              <p className="text-lg font-medium">No stack devices found</p>
              <p className="text-sm mt-1">
                All devices in Nautobot have a single serial number.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all devices"
                        className={someSelected ? 'data-[state=checked]:bg-blue-400' : ''}
                      />
                    </th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-700">Device name</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-700">Serial numbers</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-700">Device type</th>
                    <th className="text-left py-2 font-medium text-gray-700">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => {
                    const isSelected = selectedIds.includes(device.id)
                    const serials = device.serial
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)

                    return (
                      <tr
                        key={device.id}
                        className={`border-b border-gray-100 last:border-0 cursor-pointer hover:bg-blue-50/40 transition-colors ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => toggleDevice(device.id)}
                      >
                        <td className="py-2.5 pr-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleDevice(device.id)}
                            aria-label={`Select ${device.name}`}
                          />
                        </td>
                        <td className="py-2.5 pr-4 font-medium text-gray-900">
                          {device.name}
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {serials.map((s) => (
                              <Badge
                                key={s}
                                variant="outline"
                                className="text-xs font-mono"
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-600">
                          {device.device_type
                            ? `${device.device_type.manufacturer?.name ?? ''} ${device.device_type.model}`.trim()
                            : '—'}
                        </td>
                        <td className="py-2.5 text-gray-600">
                          {device.location?.name ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
