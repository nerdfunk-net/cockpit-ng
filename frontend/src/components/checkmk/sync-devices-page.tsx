'use client'

import { useState, useMemo } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RefreshCw, Search, Eye, GitCompare, RotateCw } from 'lucide-react'

interface Device {
  id: string
  name: string
  role: string
  status: string
  location: string
  checkmk_status: string
  diff?: string
  normalized_config?: any
  checkmk_config?: any
}

export function CheckMKSyncDevicesPage() {
  const { token } = useAuthStore()
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [filters, setFilters] = useState({
    name: '',
    role: '',
    status: '',
    location: '',
    checkmk_status: ''
  })
  const [selectedDeviceForView, setSelectedDeviceForView] = useState<Device | null>(null)
  const [selectedDeviceForDiff, setSelectedDeviceForDiff] = useState<Device | null>(null)

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDevices(new Set(filteredDevices.map(device => device.id)))
    } else {
      setSelectedDevices(new Set())
    }
  }

  const handleSelectDevice = (deviceId: string, checked: boolean) => {
    const newSelected = new Set(selectedDevices)
    if (checked) {
      newSelected.add(deviceId)
    } else {
      newSelected.delete(deviceId)
    }
    setSelectedDevices(newSelected)
  }

  const handleCheck = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/proxy/nb2cmk/get_diff', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setDevices(data.devices || [])
      } else {
        console.error('Failed to fetch device differences')
      }
    } catch (error) {
      console.error('Error fetching device differences:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncDevices = async () => {
    if (selectedDevices.size === 0) {
      alert('Please select devices to sync')
      return
    }
    
    // Placeholder for sync functionality
    console.log('Syncing devices:', Array.from(selectedDevices))
  }

  // Filter devices based on column filters
  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      return (
        device.name.toLowerCase().includes(filters.name.toLowerCase()) &&
        device.role.toLowerCase().includes(filters.role.toLowerCase()) &&
        device.status.toLowerCase().includes(filters.status.toLowerCase()) &&
        device.location.toLowerCase().includes(filters.location.toLowerCase()) &&
        device.checkmk_status.toLowerCase().includes(filters.checkmk_status.toLowerCase())
      )
    })
  }, [devices, filters])

  // Pagination logic (use filtered devices)
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentDevices = filteredDevices.slice(startIndex, endIndex)

  // Reset to first page when filters change
  const handleFilterChange = (column: string, value: string) => {
    setFilters(prev => ({ ...prev, [column]: value }))
    setCurrentPage(1)
  }

  const handlePageSizeChange = (newSize: string) => {
    setItemsPerPage(parseInt(newSize))
    setCurrentPage(1)
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>
      case 'staged':
        return <Badge variant="outline">Staged</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getCheckMKStatusBadge = (checkmkStatus: string) => {
    switch (checkmkStatus.toLowerCase()) {
      case 'equal':
        return <Badge variant="default" className="bg-green-100 text-green-800">Synced</Badge>
      case 'diff':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Different</Badge>
      case 'host_not_found':
        return <Badge variant="destructive">Missing</Badge>
      case 'error':
        return <Badge variant="secondary">Error</Badge>
      case 'unknown':
        return <Badge variant="outline">Unknown</Badge>
      default:
        return <Badge variant="outline">{checkmkStatus}</Badge>
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">CheckMK Sync Devices</h1>
        <p className="mt-2 text-gray-600">
          Synchronize devices between Nautobot and CheckMK
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Devices in Nautobot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredDevices.length > 0 && selectedDevices.size === filteredDevices.length}
                        onCheckedChange={handleSelectAll}
                        indeterminate={selectedDevices.size > 0 && selectedDevices.size < filteredDevices.length ? true : undefined}
                      />
                    </TableHead>
                    <TableHead>
                      <div className="space-y-2">
                        <div>Name</div>
                        <Input
                          placeholder="Filter names..."
                          value={filters.name}
                          onChange={(e) => handleFilterChange('name', e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="space-y-2">
                        <div>Role</div>
                        <Input
                          placeholder="Filter roles..."
                          value={filters.role}
                          onChange={(e) => handleFilterChange('role', e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="space-y-2">
                        <div>Status</div>
                        <Input
                          placeholder="Filter status..."
                          value={filters.status}
                          onChange={(e) => handleFilterChange('status', e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="space-y-2">
                        <div>Location</div>
                        <Input
                          placeholder="Filter locations..."
                          value={filters.location}
                          onChange={(e) => handleFilterChange('location', e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="space-y-2">
                        <div>CheckMK</div>
                        <Input
                          placeholder="Filter CheckMK status..."
                          value={filters.checkmk_status}
                          onChange={(e) => handleFilterChange('checkmk_status', e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No devices found. Click "Check" to load devices from Nautobot.
                      </TableCell>
                    </TableRow>
                  ) : filteredDevices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No devices match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentDevices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedDevices.has(device.id)}
                            onCheckedChange={(checked) => 
                              handleSelectDevice(device.id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">{device.name}</TableCell>
                        <TableCell>{device.role}</TableCell>
                        <TableCell>{getStatusBadge(device.status)}</TableCell>
                        <TableCell>{device.location}</TableCell>
                        <TableCell>{getCheckMKStatusBadge(device.checkmk_status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedDeviceForView(device)}
                              title="View complete backend output"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              disabled={device.checkmk_status !== 'diff'}
                              onClick={() => setSelectedDeviceForDiff(device)}
                              title="Show differences"
                            >
                              <GitCompare className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              disabled={device.checkmk_status !== 'diff'}
                              title="Sync device (coming soon)"
                            >
                              <RotateCw className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {filteredDevices.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-700">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredDevices.length)} of {filteredDevices.length} entries
                    {filteredDevices.length !== devices.length && (
                      <span className="text-gray-500"> (filtered from {devices.length} total)</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">Show:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={handlePageSizeChange}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-4 pt-4 border-t">
              <Button 
                onClick={handleCheck} 
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {isLoading ? 'Checking...' : 'Check'}
              </Button>
              <Button 
                onClick={handleSyncDevices}
                disabled={selectedDevices.size === 0}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Sync Devices ({selectedDevices.size})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Device Dialog */}
      <Dialog open={!!selectedDeviceForView} onOpenChange={(open) => !open && setSelectedDeviceForView(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Device Details: {selectedDeviceForView?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><strong>Name:</strong> {selectedDeviceForView?.name}</div>
                <div><strong>Role:</strong> {selectedDeviceForView?.role}</div>
                <div><strong>Status:</strong> {selectedDeviceForView?.status}</div>
                <div><strong>Location:</strong> {selectedDeviceForView?.location}</div>
                <div><strong>CheckMK Status:</strong> {selectedDeviceForView && getCheckMKStatusBadge(selectedDeviceForView.checkmk_status)}</div>
              </div>
            </div>
            
            {selectedDeviceForView?.normalized_config && (
              <div>
                <h3 className="font-semibold mb-2">Normalized Config (Nautobot)</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(selectedDeviceForView.normalized_config, null, 2)}
                </pre>
              </div>
            )}
            
            {selectedDeviceForView?.checkmk_config && (
              <div>
                <h3 className="font-semibold mb-2">CheckMK Config</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(selectedDeviceForView.checkmk_config, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Show Diff Dialog */}
      <Dialog open={!!selectedDeviceForDiff} onOpenChange={(open) => !open && setSelectedDeviceForDiff(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configuration Differences: {selectedDeviceForDiff?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Differences Found</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <p className="text-sm whitespace-pre-wrap">{selectedDeviceForDiff?.diff || 'No differences found'}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}