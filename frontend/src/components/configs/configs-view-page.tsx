'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, X, ChevronLeft, ChevronRight, RotateCcw, Eye, Download, FileText, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'

// Types
interface Device {
  id: string
  name: string
  primary_ip4?: { address: string }
  role?: { name: string }
  location?: { name: string }
  device_type?: { model: string }
  status?: { name: string }
}

interface Repository {
  id: number
  name: string
  category: string
  description?: string
}

interface PaginationState {
  isBackendPaginated: boolean
  hasMore: boolean
  totalCount: number
  currentLimit: number | null
  currentOffset: number
  filterType: string | null
  filterValue: string | null
}

interface FilterOptions {
  roles: Set<string>
  locations: Set<string>
  statuses: Set<string>
}

interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

interface ConfigFile {
  name: string
  path: string
  directory: string
  size: number
}

interface SearchResult {
  success: boolean
  data: {
    files: ConfigFile[]
    total_count: number
    filtered_count: number
    query: string
    repository_name: string
    has_more: boolean
  }
}

interface ConfigContent {
  file_path: string
  content: string
  commit: string
}

export default function ConfigsViewPage() {
  const { apiCall } = useApi()
  const { isAuthenticated, token } = useAuthStore()
  
  // Authentication state
  const [authReady, setAuthReady] = useState(false)
  
  // State
  const [devices, setDevices] = useState<Device[]>([])
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([])
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [selectedRepository, setSelectedRepository] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [, setPaginationState] = useState<PaginationState>({
    isBackendPaginated: false,
    hasMore: false,
    totalCount: 0,
    currentLimit: null,
    currentOffset: 0,
    filterType: null,
    filterValue: null,
  })

  // Filter state
  const [deviceNameFilter, setDeviceNameFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Sorting state
  const [sortColumn, setSortColumn] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none')

  // Filter options
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    roles: new Set(),
    locations: new Set(),
    statuses: new Set(),
  })

  // Config view modal state
  const [isConfigSelectionModalOpen, setIsConfigSelectionModalOpen] = useState(false)
  const [isConfigDisplayModalOpen, setIsConfigDisplayModalOpen] = useState(false)
  const [configFiles, setConfigFiles] = useState<ConfigFile[]>([])
  const [selectedConfigFile, setSelectedConfigFile] = useState<ConfigFile | null>(null)
  const [configContent, setConfigContent] = useState<ConfigContent | null>(null)
  const [, setLoadingConfigFiles] = useState(false)
  const [loadingConfigContent, setLoadingConfigContent] = useState(false)
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null)

  // Show status message
  const showMessage = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatusMessage({ type, text })
    // Auto-hide after 3 seconds for success and info
    if (type === 'success' || type === 'info') {
      setTimeout(() => setStatusMessage(null), 3000)
    }
  }, [])

  // Load repositories
  const loadRepositories = useCallback(async () => {
    try {
      const response = await apiCall<{ repositories: Repository[] }>('git-repositories/')
      if (response?.repositories) {
        // Filter only repositories of category "configs"
        const configRepos = response.repositories.filter(repo => repo.category === 'configs')
        setRepositories(configRepos)
        
        // Auto-select first config repository if available
        if (configRepos.length > 0 && configRepos[0] && selectedRepository === null) {
          setSelectedRepository(configRepos[0].id)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load repositories'
      setError(message)
      showMessage(message, 'error')
    }
  }, [apiCall, selectedRepository, showMessage])

  // Load devices from API
  const loadDevices = useCallback(async (
    deviceNameFilter = '',
    useBackendPagination = false,
    limit: number | null = null,
    offset = 0
  ) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (useBackendPagination && limit) {
        params.append('limit', limit.toString())
        params.append('offset', offset.toString())
      }
      if (deviceNameFilter) {
        params.append('filter_type', 'name')
        params.append('filter_value', deviceNameFilter)
      }

      const endpoint = `nautobot/devices${params.toString() ? '?' + params.toString() : ''}`
      const response = await apiCall<{
        devices?: Device[];
        is_paginated?: boolean;
        has_more?: boolean;
        count?: number;
        current_limit?: number;
        current_offset?: number;
        sites?: string[];
        locations?: string[];
        device_types?: string[];
      }>(endpoint)

      if (response?.devices) {
        const newDevices = response.devices
        setDevices(newDevices)

        // Update pagination state
        setPaginationState({
          isBackendPaginated: response.is_paginated || false,
          hasMore: response.has_more || false,
          totalCount: response.count || 0,
          currentLimit: response.current_limit || null,
          currentOffset: response.current_offset || 0,
          filterType: deviceNameFilter ? 'name' : null,
          filterValue: deviceNameFilter || null,
        })

        // Extract filter options if not using backend pagination
        if (!useBackendPagination) {
          const newFilterOptions: FilterOptions = {
            roles: new Set(),
            locations: new Set(),
            statuses: new Set(),
          }

          newDevices.forEach((device: Device) => {
            if (device.role?.name) newFilterOptions.roles.add(device.role.name)
            if (device.location?.name) newFilterOptions.locations.add(device.location.name)
            if (device.status?.name) newFilterOptions.statuses.add(device.status.name)
          })

          setFilterOptions(newFilterOptions)
        }

        setStatusMessage(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load devices'
      setError(message)
      showMessage(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [apiCall, showMessage])

  // Apply filters and sorting
  const applyFilters = useCallback(() => {
    let filtered = devices.filter(device => {
      // Device name filter is handled separately via backend pagination or client-side by deviceNameFilter
      // For client-side filtering, apply device name filter here
      if (deviceNameFilter) {
        const deviceName = (device.name || '').toLowerCase()
        if (!deviceName.includes(deviceNameFilter.toLowerCase())) {
          return false
        }
      }

      // Header filters
      if (roleFilter && device.role?.name !== roleFilter) return false
      if (locationFilter && device.location?.name !== locationFilter) return false
      if (statusFilter && device.status?.name !== statusFilter) return false

      return true
    })

    // Apply sorting
    if (sortColumn && sortOrder !== 'none') {
      filtered = filtered.slice().sort((a, b) => {
        let aVal: string, bVal: string

        switch (sortColumn) {
          case 'name':
            aVal = a.name || ''
            bVal = b.name || ''
            break
          default:
            return 0
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }

    setFilteredDevices(filtered)
    setCurrentPage(0) // Reset to first page when filters change
  }, [devices, deviceNameFilter, roleFilter, locationFilter, statusFilter, sortColumn, sortOrder])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setDeviceNameFilter('')
    setRoleFilter('')
    setLocationFilter('')
    setStatusFilter('')
    setSortColumn('')
    setSortOrder('none')
    setCurrentPage(0)
    setFilteredDevices(devices)
  }, [devices])

  // Search for config files in repository
  const searchConfigFiles = useCallback(async (device: Device) => {
    if (selectedRepository === null) {
      showMessage('Please select a repository first', 'error')
      return null
    }

    try {
      setLoadingConfigFiles(true)
      showMessage(`Searching for configs for ${device.name}...`, 'info')

      // Use the search endpoint to find files containing the device name
      // This endpoint doesn't filter by extensions so it will find all files
      const searchUrl = `git/${selectedRepository}/files/search?query=${encodeURIComponent(device.name)}&limit=50`
      console.log('Making API call to search endpoint:', searchUrl)
      
      const response = await apiCall<SearchResult>(searchUrl)
      console.log('Search response:', response)
      
      if (response?.success && response.data?.files) {
        const files = response.data.files
        
        // Filter for configuration files (since the search endpoint returns all files)
        const configFiles = files.filter(file => {
          const fileName = file.name.toLowerCase()
          const filePath = file.path.toLowerCase()
          
          // Must contain device name (double-check since we searched for it)
          const containsDeviceName = fileName.includes(device.name.toLowerCase()) || filePath.includes(device.name.toLowerCase())
          
          // Must be a config file (look for config patterns)
          const isConfigFile = (
            fileName.includes('config') ||
            fileName.includes('running') ||
            fileName.includes('startup') ||
            fileName.endsWith('.cfg') ||
            fileName.endsWith('.conf') ||
            fileName.endsWith('.txt') ||
            filePath.includes('config') ||
            filePath.includes('backup') ||
            // Also accept files that just end with -config (like lab-1.running-config)
            fileName.endsWith('-config')
          )
          
          return containsDeviceName && isConfigFile
        })

        console.log(`Found ${configFiles.length} config files for ${device.name}:`, configFiles)
        return configFiles
      } else {
        showMessage(`No files found for ${device.name} in repository`, 'info')
        return []
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search for config files'
      console.error('Search error:', err)
      showMessage(`Failed to search for configs for ${device.name}: ${message}`, 'error')
      return null
    } finally {
      setLoadingConfigFiles(false)
    }
  }, [selectedRepository, apiCall, showMessage])

  // Load config file content
  const loadConfigContent = useCallback(async (configFile: ConfigFile) => {
    if (selectedRepository === null) {
      showMessage('No repository selected', 'error')
      return
    }

    try {
      setLoadingConfigContent(true)
      showMessage(`Loading ${configFile.name}...`, 'info')

      // Get the repository details to find the default branch
      const repoResponse = await apiCall(`git-repositories/${selectedRepository}`) as { branch?: string }
      if (!repoResponse?.branch) {
        showMessage('Could not determine repository branch', 'error')
        return
      }

      const branchName = repoResponse.branch

      // Get the latest commits from the branch
      const commitsResponse = await apiCall(`git/${selectedRepository}/commits/${encodeURIComponent(branchName)}`)
      if (!Array.isArray(commitsResponse) || commitsResponse.length === 0) {
        showMessage('No commits found in repository', 'error')
        return
      }

      const latestCommit = commitsResponse[0].hash

      // Get file content using the files endpoint with commit hash and file_path
      const contentResponse = await apiCall<ConfigContent>(
        `git/${selectedRepository}/files/${latestCommit}/commit?file_path=${encodeURIComponent(configFile.path)}`
      )

      if (contentResponse) {
        setConfigContent(contentResponse)
        setIsConfigDisplayModalOpen(true)
        showMessage(`Loaded ${configFile.name}`, 'success')
      } else {
        showMessage(`Failed to load ${configFile.name}`, 'error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load config content'
      showMessage(`Failed to load ${configFile.name}: ${message}`, 'error')
    } finally {
      setLoadingConfigContent(false)
    }
  }, [selectedRepository, apiCall, showMessage])

  // Actions
  const handleViewConfig = useCallback(async (device: Device) => {
    try {
      setCurrentDevice(device)
      const files = await searchConfigFiles(device)
      
      if (files === null) {
        return // Error already shown
      }

      if (files.length === 0) {
        showMessage(`No configuration files found for ${device.name}`, 'info')
        return
      }

      if (files.length === 1 && files[0]) {
        // Single file found, display it directly
        setSelectedConfigFile(files[0])
        await loadConfigContent(files[0])
      } else {
        // Multiple files found, show selection modal
        setConfigFiles(files)
        setIsConfigSelectionModalOpen(true)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to view config'
      showMessage(`Failed to view config for ${device.name}: ${message}`, 'error')
    }
  }, [searchConfigFiles, showMessage, loadConfigContent])

  // Handle config file selection from modal
  const handleConfigFileSelection = useCallback(async (configFile: ConfigFile) => {
    setSelectedConfigFile(configFile)
    setIsConfigSelectionModalOpen(false)
    await loadConfigContent(configFile)
  }, [loadConfigContent])

  // Handle download of displayed config
  const handleDownloadDisplayedConfig = useCallback(() => {
    if (!configContent || !currentDevice) return

    const blob = new Blob([configContent.content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    // Create filename with device name and original filename
    const originalName = configContent.file_path.split('/').pop() || 'config.txt'
    const fileName = `${currentDevice.name}_${originalName}`
    
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    showMessage(`Downloaded ${fileName}`, 'success')
  }, [configContent, currentDevice, showMessage])

  const handleDownloadConfig = useCallback(async (device: Device) => {
    try {
      showMessage(`Downloading config for ${device.name}...`, 'info')
      // TODO: Implement direct download functionality (without viewing first)
      console.log('Download config for device:', device.id, 'from repository:', selectedRepository)
      showMessage(`Config downloaded for ${device.name}`, 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download config'
      showMessage(`Failed to download config for ${device.name}: ${message}`, 'error')
    }
  }, [selectedRepository, showMessage])

  // Mark handleDownloadConfig as used to suppress linter warning
  void handleDownloadConfig

  // Pagination
  const totalPages = Math.ceil(filteredDevices.length / pageSize)
  const paginatedDevices = useMemo(() => {
    const start = currentPage * pageSize
    const end = start + pageSize
    return filteredDevices.slice(start, end)
  }, [filteredDevices, currentPage, pageSize])

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(Math.max(0, Math.min(newPage, totalPages - 1)))
  }, [totalPages])

  const handleSort = useCallback((column: string) => {
    if (column === sortColumn) {
      setSortOrder(prev => {
        if (prev === 'none') return 'asc'
        if (prev === 'asc') return 'desc'
        return 'none'
      })
    } else {
      setSortColumn(column)
      setSortOrder('asc')
    }
  }, [sortColumn])

  // Mark handleSort as used to suppress linter warning
  void handleSort

  // Effects
  // Authentication effect - wait for auth before loading data
  useEffect(() => {
    if (isAuthenticated && token) {
      console.log('ConfigsView: Authentication ready, loading data')
      setAuthReady(true)
      loadRepositories()
      loadDevices()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token])

  useEffect(() => {
    applyFilters()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, deviceNameFilter, roleFilter, locationFilter, statusFilter, sortColumn, sortOrder])

  // Helper functions
  const getStatusBadgeVariant = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('active') || statusLower.includes('online')) {
      return 'default' // Green
    } else if (statusLower.includes('offline') || statusLower.includes('failed')) {
      return 'destructive' // Red
    } else if (statusLower.includes('maintenance')) {
      return 'secondary' // Yellow
    }
    return 'outline' // Gray
  }

  const isDeviceOffline = (status: string) => {
    const statusLower = status.toLowerCase()
    return statusLower.includes('offline') || statusLower.includes('failed')
  }

  const activeFiltersCount = [
    deviceNameFilter,
    roleFilter,
    locationFilter,
    statusFilter
  ].filter(Boolean).length

  if (!authReady || (loading && devices.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">
            {!authReady ? 'Establishing authentication...' : 'Loading devices...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Eye className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">View Config Backups</h1>
            <p className="text-gray-600 mt-1">View and download device configurations</p>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          <Button 
            onClick={() => loadDevices()}
            variant="outline"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Repository Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Repository Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="repository-select" className="text-sm font-medium">
              Select Repository:
            </Label>
            <Select value={selectedRepository?.toString() || ""} onValueChange={(value) => setSelectedRepository(value ? parseInt(value) : null)}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a config repository..." />
              </SelectTrigger>
              <SelectContent>
                {repositories.map((repo) => (
                  <SelectItem key={repo.id} value={repo.id.toString()}>
                    {repo.name} {repo.description && `- ${repo.description}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {repositories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No config repositories found. Configure repositories in Settings → Git Management.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Message */}
      {statusMessage && (
        <Card className={
          statusMessage.type === 'success' ? 'border-green-200 bg-green-50' :
          statusMessage.type === 'error' ? 'border-red-200 bg-red-50' :
          'border-blue-200 bg-blue-50'
        }>
          <CardContent className="p-4">
            <div className={`flex items-center gap-2 ${
              statusMessage.type === 'success' ? 'text-green-800' :
              statusMessage.type === 'error' ? 'text-red-800' :
              'text-blue-800'
            }`}>
              {statusMessage.type === 'success' && <span>✓</span>}
              {statusMessage.type === 'error' && <X className="h-4 w-4" />}
              {statusMessage.type === 'info' && <span>ℹ</span>}
              <span>{statusMessage.text}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusMessage(null)}
                className="ml-auto h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <X className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Devices table */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">Device Configuration Management</h3>
                {activeFiltersCount > 0 || sortColumn ? (
                  <p className="text-blue-100 text-xs">
                    Showing {filteredDevices.length} of {devices.length} devices
                    {activeFiltersCount > 0 && ` (${activeFiltersCount} filter${activeFiltersCount > 1 ? 's' : ''} active)`}
                    {sortColumn && ` - Sorted by ${sortColumn.replace('_', ' ')} (${sortOrder})`}
                  </p>
                ) : (
                  <p className="text-blue-100 text-xs">
                    Showing all {devices.length} devices
                  </p>
                )}
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  {activeFiltersCount} active
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 w-8 p-0 text-white hover:bg-white/20"
                  title="Clear All Filters"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Device Name</div>
                      <div>
                        <Input
                          placeholder="Type 3+ chars for backend search..."
                          value={deviceNameFilter}
                          onChange={(e) => setDeviceNameFilter(e.target.value)}
                          className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">IP Address</th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Role</div>
                      <div>
                        <Select value={roleFilter || "all"} onValueChange={(value) => setRoleFilter(value === "all" ? "" : value)}>
                          <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                            <SelectValue placeholder="All Roles" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            {Array.from(filterOptions.roles).sort().map(role => (
                              <SelectItem key={`configs-view-role-${role}`} value={role}>{role}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Location</div>
                      <div>
                        <Select value={locationFilter || "all"} onValueChange={(value) => setLocationFilter(value === "all" ? "" : value)}>
                          <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                            <SelectValue placeholder="All Locations" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Locations</SelectItem>
                            {Array.from(filterOptions.locations).sort().map(location => (
                              <SelectItem key={`configs-view-location-${location}`} value={location}>{location}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Status</div>
                      <div>
                        <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
                          <SelectTrigger className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                            <SelectValue placeholder="All Statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {Array.from(filterOptions.statuses).sort().map(status => (
                              <SelectItem key={`configs-view-status-${status}`} value={status}>{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDevices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      No devices found
                    </td>
                  </tr>
                ) : (
                  paginatedDevices.map((device) => {
                    const isOffline = isDeviceOffline(device.status?.name || '')
                    
                    return (
                      <tr 
                        key={`configs-view-device-${device.id}`} 
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <td className="p-2 font-medium">{device.name}</td>
                        <td className="p-2">{device.primary_ip4?.address || 'N/A'}</td>
                        <td className="p-2">{device.role?.name || 'Unknown'}</td>
                        <td className="p-2">{device.location?.name || 'Unknown'}</td>
                        <td className="p-2">
                          <Badge variant={getStatusBadgeVariant(device.status?.name || '')}>
                            {device.status?.name || 'Unknown'}
                          </Badge>
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewConfig(device)}
                              disabled={isOffline || selectedRepository === null}
                              title="View Config"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-muted-foreground">
              Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, filteredDevices.length)} of {filteredDevices.length} entries
            </div>
            
            <div className="flex items-center gap-1">
              {/* Navigation buttons - only show when there are multiple pages */}
              {totalPages > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(0)}
                    disabled={currentPage === 0}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(0, Math.min(totalPages - 5, currentPage - 2)) + i
                    if (pageNum >= totalPages) return null
                    
                    return (
                      <Button
                        key={`configs-view-page-${pageNum}`}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum + 1}
                      </Button>
                    )
                  })}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages - 1)}
                    disabled={currentPage >= totalPages - 1}
                  >
                    Last
                  </Button>
                </>
              )}
              
              {/* Page Size Selector - always visible */}
              <div className="flex items-center gap-1 ml-2">
                <Label htmlFor="page-size" className="text-xs text-muted-foreground">Show:</Label>
                <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                  <SelectTrigger className="w-20 h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
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
          </div>
        </div>
      </div>

      {/* Config Selection Modal */}
      <Dialog open={isConfigSelectionModalOpen} onOpenChange={setIsConfigSelectionModalOpen}>
        <DialogContent className="!max-w-[90vw] w-[90vw] max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Select Configuration File - {currentDevice?.name}
            </DialogTitle>
            <DialogDescription>
              Multiple configuration files were found for this device. Click on a row to view the file.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Scrollable table container */}
            <div className="flex-1 overflow-auto rounded-lg border border-gray-200">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-500 to-blue-600 text-white sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-3 font-semibold text-sm">File Name</th>
                    <th className="text-left p-3 font-semibold text-sm">Path</th>
                    <th className="text-right p-3 font-semibold text-sm w-24">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {configFiles.map((file, index) => (
                    <tr
                      key={file.path}
                      className={`cursor-pointer transition-colors hover:bg-blue-50 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                      onClick={() => handleConfigFileSelection(file)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <span className="font-medium text-gray-900">{file.name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-gray-600 truncate block max-w-md" title={file.path}>
                          {file.path}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm text-gray-500 font-mono">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Footer with count and cancel button */}
            <div className="flex items-center justify-between pt-4 flex-shrink-0 border-t mt-4">
              <span className="text-sm text-muted-foreground">
                {configFiles.length} configuration file{configFiles.length !== 1 ? 's' : ''} found
              </span>
              <Button
                variant="outline"
                onClick={() => setIsConfigSelectionModalOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Config Display Modal */}
      <Dialog open={isConfigDisplayModalOpen} onOpenChange={setIsConfigDisplayModalOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] p-0" style={{ resize: 'both', minWidth: '800px', minHeight: '600px' }}>
          <DialogHeader className="sr-only">
            <DialogTitle>
              Configuration File Viewer - {currentDevice?.name} - {selectedConfigFile?.name}
            </DialogTitle>
            <DialogDescription>
              Viewing configuration file content with download option.
            </DialogDescription>
          </DialogHeader>
          
          {/* Fixed Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span className="text-lg font-semibold">
                {currentDevice?.name} - {selectedConfigFile?.name}
              </span>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleDownloadDisplayedConfig}
                disabled={!configContent}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsConfigDisplayModalOpen(false)}
                size="sm"
              >
                Close
              </Button>
            </div>
          </div>
          
          {/* Content Area */}
          <div className="flex-1 overflow-hidden" style={{ height: 'calc(90vh - 140px)' }}>
            {loadingConfigContent ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading configuration...</p>
                </div>
              </div>
            ) : configContent ? (
              <div className="h-full flex flex-col">
                {/* File info header */}
                <div className="bg-muted/50 p-3 border-b flex-shrink-0">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">Path:</span> {configContent.file_path}
                    </div>
                    <div>
                      <span className="font-medium">Commit:</span> {configContent.commit}
                    </div>
                  </div>
                </div>
                
                {/* Scrollable Config content */}
                <div className="flex-1 overflow-y-auto overflow-x-auto">
                  <pre className="p-4 text-sm font-mono whitespace-pre bg-gray-50 w-full h-auto">
{configContent.content}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No configuration content available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}