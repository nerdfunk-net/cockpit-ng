'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Search, Radar, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useApi } from '@/hooks/use-api'
import { useCheckmkDiscoveryMutations } from '../hooks/queries/use-checkmk-discovery-mutations'
import type { Device } from '@/types/features/checkmk/sync-devices'

const DISCOVERY_MODES = [
  { value: 'fix_all', label: 'Accept all' },
  { value: 'new', label: 'Monitor undecided services' },
  { value: 'remove', label: 'Remove vanished services' },
  { value: 'refresh', label: 'Rescan (background)' },
  { value: 'tabula_rasa', label: 'Remove all and find new (background)' },
  { value: 'only_host_labels', label: 'Update host labels' },
  { value: 'only_service_labels', label: 'Update service labels' },
]

export function DiscoveryTab() {
  const { apiCall } = useApi()
  const { startBulkDiscovery } = useCheckmkDiscoveryMutations()

  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [discoveryMode, setDiscoveryMode] = useState('fix_all')
  const [deviceNameFilter, setDeviceNameFilter] = useState('')

  // Filtered devices based on name
  const filteredDevices = useMemo(() => {
    return devices.filter(device =>
      device.name.toLowerCase().includes(deviceNameFilter.toLowerCase())
    )
  }, [devices, deviceNameFilter])

  // Load devices from Nautobot
  const loadDevices = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiCall<{ devices: Device[] }>('nautobot/devices')
      if (response && Array.isArray(response.devices)) {
        setDevices(response.devices)
      }
    } catch (error) {
      console.error('Error loading devices:', error)
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  // Handle device selection
  const handleSelectDevice = (deviceId: string, checked: boolean) => {
    setSelectedDevices(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(deviceId)
      } else {
        newSet.delete(deviceId)
      }
      return newSet
    })
  }

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDevices(new Set(filteredDevices.map(d => d.id)))
    } else {
      setSelectedDevices(new Set())
    }
  }

  // Handle start bulk discovery
  const handleStartBulkDiscovery = () => {
    if (selectedDevices.size === 0) return

    const hostnames = Array.from(selectedDevices)
      .map(id => devices.find(d => d.id === id))
      .filter((d): d is Device => d !== undefined)
      .map(d => d.name)

    startBulkDiscovery.mutate({
      hostnames,
      options: {
        monitor_undecided_services: true,
        remove_vanished_services: true,
        update_service_labels: true,
        update_service_parameters: true,
        update_host_labels: true,
      },
      do_full_scan: true,
      bulk_size: 10,
      ignore_errors: true,
    })
  }

  // Handle single device discovery
  const handleStartDiscovery = (device: Device, _mode: string) => {
    startBulkDiscovery.mutate({
      hostnames: [device.name],
      options: {
        monitor_undecided_services: true,
        remove_vanished_services: true,
        update_service_labels: true,
        update_service_parameters: true,
        update_host_labels: true,
      },
      do_full_scan: true,
      bulk_size: 10,
      ignore_errors: true,
    })
  }

  const allSelected = filteredDevices.length > 0 && filteredDevices.every(device => selectedDevices.has(device.id))

  // Auto-load devices when tab is opened
  useEffect(() => {
    loadDevices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  return (
    <div className="space-y-6">
      {/* Device Management Section */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        {/* Blue Header */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">Device Synchronization Management</h3>
                <p className="text-blue-100 text-xs">
                  Showing {filteredDevices.length} of {devices.length} devices
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadDevices}
                className="text-white hover:bg-white/20 text-xs h-7"
                disabled={loading}
                title="Load devices from Nautobot"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                ) : (
                  <Search className="h-3 w-3 mr-1" />
                )}
                Load Devices
              </Button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="p-4 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="p-2 text-left w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="p-2 text-left">
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-slate-700">Device Name</span>
                      <input
                        type="text"
                        placeholder="Filter by name..."
                        value={deviceNameFilter}
                        onChange={(e) => setDeviceNameFilter(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </th>
                  <th className="p-2 text-left text-xs font-medium text-slate-700">Role</th>
                  <th className="p-2 text-left text-xs font-medium text-slate-700">Location</th>
                  <th className="p-2 text-left text-xs font-medium text-slate-700">IP Address</th>
                  <th className="p-2 text-left text-xs font-medium text-slate-700">Status</th>
                  <th className="p-2 text-center text-xs font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                      {devices.length === 0 ? 'No devices loaded. Click "Load Devices" to start.' : 'No devices found'}
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((device) => (
                    <tr key={device.id} className="hover:bg-slate-50">
                      <td className="p-2">
                        <Checkbox
                          checked={selectedDevices.has(device.id)}
                          onCheckedChange={(checked) => handleSelectDevice(device.id, checked as boolean)}
                        />
                      </td>
                      <td className="p-2 text-sm">{device.name}</td>
                      <td className="p-2 text-sm">{device.role?.name || 'N/A'}</td>
                      <td className="p-2 text-sm">{device.location?.name || 'N/A'}</td>
                      <td className="p-2 text-sm">{device.primary_ip4?.address || 'N/A'}</td>
                      <td className="p-2">
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          {device.status?.name || 'Unknown'}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Start Discovery"
                                className="h-8 w-8 p-0"
                              >
                                <Radar className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Discovery Mode</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'fix_all')}>
                                Accept all
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'new')}>
                                Monitor undecided services
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'remove')}>
                                Remove vanished services
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'refresh')}>
                                Rescan (background)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'tabula_rasa')}>
                                Remove all and find new (background)
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'only_host_labels')}>
                                Update host labels
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStartDiscovery(device, 'only_service_labels')}>
                                Update service labels
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer with Bulk Actions */}
        {devices.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {selectedDevices.size > 0 ? (
                  <>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      {selectedDevices.size} device{selectedDevices.size !== 1 ? 's' : ''} selected
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDevices(new Set())}
                      className="h-8"
                    >
                      Clear Selection
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-gray-500">No devices selected</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="discovery-mode" className="text-sm">Discovery Mode:</Label>
                  <Select value={discoveryMode} onValueChange={setDiscoveryMode}>
                    <SelectTrigger id="discovery-mode" className="w-[280px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISCOVERY_MODES.map(mode => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleStartBulkDiscovery}
                  disabled={startBulkDiscovery.isPending || selectedDevices.size === 0}
                  className="gap-2"
                >
                  {startBulkDiscovery.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <Radar className="h-4 w-4" />
                  Start Service Discovery
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
