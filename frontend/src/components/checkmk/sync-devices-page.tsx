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
import { RefreshCw, Search, Eye, GitCompare, RotateCw, Filter, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, CheckCircle, AlertCircle, Info, Plus, ChevronDown } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'

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
  const [addingDevices, setAddingDevices] = useState<Set<string>>(new Set())
  const [syncingDevices, setSyncingDevices] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [filters, setFilters] = useState({
    name: '',
    role: '',
    status: '',
    location: '',
    checkmk_status: ''
  })
  const [checkmkStatusFilters, setCheckmkStatusFilters] = useState({
    equal: true,
    diff: true,
    missing: true
  })
  const [selectedDeviceForView, setSelectedDeviceForView] = useState<Device | null>(null)
  const [selectedDeviceForDiff, setSelectedDeviceForDiff] = useState<Device | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string } | null>(null)
  const [totalDeviceCount, setTotalDeviceCount] = useState<number>(0)
  const [progressVisible, setProgressVisible] = useState(false)

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
    setProgressVisible(true)
    
    // First, get device count for progress indication (only if we don't have devices yet)
    let deviceCount = totalDeviceCount
    if (devices.length === 0) {
      try {
        const countResponse = await fetch('/api/proxy/nb2cmk/devices', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (countResponse.ok) {
          const countData = await countResponse.json()
          deviceCount = countData.devices?.length || 0
          setTotalDeviceCount(deviceCount)
        }
      } catch (error) {
        console.error('Error getting device count:', error)
      }
    } else {
      // Use existing device count for subsequent checks
      deviceCount = devices.length
      setTotalDeviceCount(deviceCount)
    }

    // Set status message with device count
    setStatusMessage({ 
      type: 'info', 
      message: deviceCount > 0 
        ? `Comparing ${deviceCount.toLocaleString()} devices with CheckMK - this may take a moment...`
        : 'Loading devices and comparing with CheckMK...'
    })
    
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
        setTotalDeviceCount(data.devices?.length || 0)
        setStatusMessage({
          type: 'success',
          message: `Successfully compared ${data.devices?.length || 0} devices with CheckMK`
        })
        // Auto-hide success message after 3 seconds
        setTimeout(() => setStatusMessage(null), 3000)
      } else {
        setStatusMessage({ type: 'error', message: 'Failed to fetch device differences' })
      }
    } catch (error) {
      console.error('Error fetching device differences:', error)
      setStatusMessage({ type: 'error', message: 'Error fetching device differences' })
    } finally {
      setIsLoading(false)
      setProgressVisible(false)
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

  const handleAddDevice = async (device: Device) => {
    if (!token) {
      setStatusMessage({ type: 'error', message: 'Authentication required' })
      return
    }

    // Add device to loading set
    setAddingDevices(prev => new Set(prev.add(device.id)))
    
    try {
      const response = await fetch(`/api/proxy/nb2cmk/device/${device.id}/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        setStatusMessage({ 
          type: 'success', 
          message: `Successfully added ${result.hostname} to CheckMK`
        })
        
        // Update device status to 'equal' since it's now added
        setDevices(prevDevices => 
          prevDevices.map(d => 
            d.id === device.id 
              ? { ...d, checkmk_status: 'equal' }
              : d
          )
        )
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => setStatusMessage(null), 3000)
      } else {
        const errorData = await response.json()
        setStatusMessage({ 
          type: 'error', 
          message: `Failed to add device: ${errorData.detail || 'Unknown error'}`
        })
      }
    } catch (error) {
      console.error('Error adding device:', error)
      setStatusMessage({ 
        type: 'error', 
        message: 'Error adding device to CheckMK'
      })
    } finally {
      // Remove device from loading set
      setAddingDevices(prev => {
        const newSet = new Set(prev)
        newSet.delete(device.id)
        return newSet
      })
    }
  }

  const handleSyncDevice = async (device: Device) => {
    if (!token) {
      setStatusMessage({ type: 'error', message: 'Authentication required' })
      return
    }

    // Add device to syncing set
    setSyncingDevices(prev => new Set(prev.add(device.id)))
    
    try {
      const response = await fetch(`/api/proxy/nb2cmk/device/${device.id}/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        setStatusMessage({ 
          type: 'success', 
          message: `Successfully synced ${result.hostname} in CheckMK${result.folder_changed ? ' (moved to new folder)' : ''}`
        })
        
        // Update device status to 'equal' since it's now synced
        setDevices(prevDevices => 
          prevDevices.map(d => 
            d.id === device.id 
              ? { ...d, checkmk_status: 'equal' }
              : d
          )
        )
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => setStatusMessage(null), 3000)
      } else {
        const errorData = await response.json()
        setStatusMessage({ 
          type: 'error', 
          message: `Failed to sync device: ${errorData.detail || 'Unknown error'}`
        })
      }
    } catch (error) {
      console.error('Error syncing device:', error)
      setStatusMessage({ 
        type: 'error', 
        message: 'Error syncing device in CheckMK'
      })
    } finally {
      // Remove device from syncing set
      setSyncingDevices(prev => {
        const newSet = new Set(prev)
        newSet.delete(device.id)
        return newSet
      })
    }
  }

  // Filter devices based on column filters
  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      // Check CheckMK status checkbox filters
      const statusMatch = 
        (checkmkStatusFilters.equal && device.checkmk_status === 'equal') ||
        (checkmkStatusFilters.diff && device.checkmk_status === 'diff') ||
        (checkmkStatusFilters.missing && device.checkmk_status === 'missing') ||
        (!checkmkStatusFilters.equal && !checkmkStatusFilters.diff && !checkmkStatusFilters.missing) ||
        (device.checkmk_status !== 'equal' && device.checkmk_status !== 'diff' && device.checkmk_status !== 'missing')
      
      return (
        device.name.toLowerCase().includes(filters.name.toLowerCase()) &&
        device.role.toLowerCase().includes(filters.role.toLowerCase()) &&
        device.status.toLowerCase().includes(filters.status.toLowerCase()) &&
        device.location.toLowerCase().includes(filters.location.toLowerCase()) &&
        statusMatch
      )
    })
  }, [devices, filters, checkmkStatusFilters])

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

  const clearAllFilters = () => {
    setFilters({
      name: '',
      role: '',
      status: '',
      location: '',
      checkmk_status: ''
    })
    setCheckmkStatusFilters({
      equal: true,
      diff: true,
      missing: true
    })
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
      case 'missing':
        return <Badge variant="destructive">Missing</Badge>
      case 'error':
        return <Badge variant="secondary">Error</Badge>
      case 'unknown':
        return <Badge variant="outline">Unknown</Badge>
      default:
        return <Badge variant="outline">{checkmkStatus}</Badge>
    }
  }

  // Always render the full interface - don't show separate loading page

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">CheckMK Sync Devices</h1>
          <p className="text-gray-600 mt-1">Compare and synchronize devices between Nautobot and CheckMK</p>
        </div>
      </div>

      {/* Status Messages - Reserve space to prevent layout shift */}
      <div className="min-h-[60px]">
        {statusMessage && (
          <Alert className={`${
            statusMessage.type === 'error' ? 'border-red-500 bg-red-50' :
            statusMessage.type === 'success' ? 'border-green-500 bg-green-50' :
            statusMessage.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
            'border-blue-500 bg-blue-50'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2">
                {statusMessage.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />}
                {statusMessage.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />}
                {statusMessage.type === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />}
                {statusMessage.type === 'info' && <Info className="h-4 w-4 text-blue-500 mt-0.5" />}
                <div className="flex-1">
                  <AlertDescription className="text-sm">
                    {statusMessage.message}
                  </AlertDescription>
                  {/* Progress Bar */}
                  {progressVisible && (
                    <div className="mt-3">
                      <Progress 
                        value={undefined}
                        className="w-full h-2"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Processing devices...</span>
                        {totalDeviceCount > 0 && (
                          <span>{totalDeviceCount.toLocaleString()} devices</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusMessage(null)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        )}
      </div>

      {/* Main Content */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">CheckMK Device Comparison</h3>
                <p className="text-blue-100 text-xs">Compare Nautobot devices with CheckMK hosts</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-white hover:bg-white/20 text-xs h-6"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            </div>
          </div>
        </div>
        <div className="p-0">
          {/* Filters Row */}
          <div className="bg-gray-50 border-b p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Device Name Filter */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Device Name</Label>
                <Input
                  placeholder="Filter by name..."
                  value={filters.name}
                  onChange={(e) => handleFilterChange('name', e.target.value)}
                  className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                />
              </div>

              {/* Role Filter */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Role</Label>
                <Input
                  placeholder="Filter by role..."
                  value={filters.role}
                  onChange={(e) => handleFilterChange('role', e.target.value)}
                  className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                />
              </div>

              {/* Status Filter */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Status</Label>
                <Input
                  placeholder="Filter by status..."
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                />
              </div>

              {/* Location Filter */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Location</Label>
                <Input
                  placeholder="Filter by location..."
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                />
              </div>

              {/* CheckMK Status Filter */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">CheckMK Status</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs justify-between min-w-[120px]">
                      Status Filter
                      {Object.values(checkmkStatusFilters).filter(Boolean).length < 3 && (
                        <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                          {Object.values(checkmkStatusFilters).filter(Boolean).length}
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    <DropdownMenuLabel className="text-xs">Filter by Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={checkmkStatusFilters.equal}
                      onCheckedChange={(checked) => 
                        setCheckmkStatusFilters(prev => ({ ...prev, equal: !!checked }))
                      }
                    >
                      Equal
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={checkmkStatusFilters.diff}
                      onCheckedChange={(checked) => 
                        setCheckmkStatusFilters(prev => ({ ...prev, diff: !!checked }))
                      }
                    >
                      Diff
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={checkmkStatusFilters.missing}
                      onCheckedChange={(checked) => 
                        setCheckmkStatusFilters(prev => ({ ...prev, missing: !!checked }))
                      }
                    >
                      Missing
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Actions */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Actions</Label>
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleCheck} 
                    disabled={isLoading}
                    size="sm"
                    className="h-8 bg-blue-600 hover:bg-blue-700"
                  >
                    {isLoading ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Search className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <Checkbox
                      checked={currentDevices.length > 0 && currentDevices.every(device => selectedDevices.has(device.id))}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Device Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">CheckMK</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">{devices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No devices found. Click the search button to load devices from Nautobot.
                    </td>
                  </tr>
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No devices match the current filters.
                    </td>
                  </tr>
                ) : (
                  currentDevices.map((device, index) => (
                    <tr key={device.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedDevices.has(device.id)}
                          onCheckedChange={(checked) => 
                            handleSelectDevice(device.id, checked as boolean)
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {device.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {device.role}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(device.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {device.location}
                      </td>
                      <td className="px-4 py-3">
                        {getCheckMKStatusBadge(device.checkmk_status)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* View Button - Always visible and enabled */}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedDeviceForView(device)}
                            title="View device details"
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {/* Add Button - Only for missing devices */}
                          {device.checkmk_status === 'missing' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleAddDevice(device)}
                              disabled={addingDevices.has(device.id)}
                              title="Add device to CheckMK"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                            >
                              {addingDevices.has(device.id) ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          
                          {/* Compare and Sync Buttons - Only for diff devices */}
                          {device.checkmk_status === 'diff' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedDeviceForDiff(device)}
                                title="Show differences"
                                className="h-8 w-8 p-0"
                              >
                                <GitCompare className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleSyncDevice(device)}
                                disabled={syncingDevices.has(device.id)}
                                title="Sync device changes"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                              >
                                {syncingDevices.has(device.id) ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCw className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredDevices.length)} of {filteredDevices.length} devices
                {filteredDevices.length !== devices.length && (
                  <span className="text-gray-500"> (filtered from {devices.length} total)</span>
                )}
              </span>
              <Select value={itemsPerPage.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-20 h-8">
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
              <span className="text-sm text-gray-600">per page</span>
            </div>

            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, currentPage - 2)
                const pageNum = startPage + i
                if (pageNum > totalPages) return null
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-8"
                  >
                    {pageNum}
                  </Button>
                )
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white p-4 border-t">
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                <Button 
                  onClick={handleCheck} 
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {isLoading ? 'Checking...' : 'Check'}
                </Button>
                <div className="text-sm text-gray-600 flex items-center">
                  {selectedDevices.size > 0 && (
                    <span>{selectedDevices.size} device(s) selected</span>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
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
          </div>
        </div>
      </div>

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

