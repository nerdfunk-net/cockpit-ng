'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, X, ChevronLeft, ChevronRight, RotateCcw, Server, Eye, RefreshCw, ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'

// Types
interface CheckMKHost {
  host_name: string
  folder: string
  attributes: Record<string, unknown>
  effective_attributes?: Record<string, unknown> | null
  labels?: Record<string, string>
}

interface FilterOptions {
  folders: Set<string>
  labels: Set<string>
}

interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

// Helper component to render CheckMK inventory data structure
const InventoryRenderer = ({ data, depth = 0 }: { data: unknown; depth?: number }): React.ReactNode => {
  if (data === null || data === undefined) {
    return <span className="text-gray-400 italic">-</span>
  }

  if (typeof data !== 'object') {
    if (typeof data === 'boolean') {
      return <span className="text-purple-600 font-medium">{data.toString()}</span>
    }
    if (typeof data === 'number') {
      return <span className="text-blue-600 font-medium">{data}</span>
    }
    if (typeof data === 'string') {
      return <span className="text-green-600">{data}</span>
    }
    return <span className="text-gray-500">{String(data)}</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-gray-400 italic">empty</span>
    }
    return (
      <div className="space-y-2 w-full">
        {data.map((item, index) => (
          <div key={index} className="flex items-start gap-3 w-full">
            <span className="text-gray-500 font-medium select-none min-w-[40px]">[{index}]</span>
            <div className="flex-1 min-w-0">
              <InventoryRenderer data={item} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Handle CheckMK inventory structure
  const objData = data as Record<string, unknown>

  // Check if this is a CheckMK inventory node (has Attributes, Nodes, Table)
  if ('Attributes' in objData || 'Nodes' in objData || 'Table' in objData) {
    const hasAttributes = objData.Attributes && (objData.Attributes as Record<string, unknown>).Pairs
    const hasNodes = objData.Nodes && Object.keys(objData.Nodes as Record<string, unknown>).length > 0
    const hasTable = objData.Table && (objData.Table as Record<string, unknown>).Rows &&
                     ((objData.Table as Record<string, unknown>).Rows as unknown[]).length > 0

    return (
      <div className="space-y-4 w-full">
        {hasAttributes ? (
          <div>
            <div className="text-sm font-semibold text-gray-600 mb-2">Attributes</div>
            <div className="space-y-1 pl-4 border-l-2 border-blue-200">
              <InventoryRenderer data={(objData.Attributes as Record<string, unknown>).Pairs} depth={depth + 1} />
            </div>
          </div>
        ) : null}

        {hasNodes ? (
          <div>
            <div className="text-sm font-semibold text-gray-600 mb-2">Subsections</div>
            <div className="space-y-3 pl-4">
              {Object.entries(objData.Nodes as Record<string, unknown>).map(([key, value]) => (
                <div key={key} className="border-l-2 border-purple-200 pl-4">
                  <div className="font-semibold text-purple-700 mb-2">{key}</div>
                  <InventoryRenderer data={value} depth={depth + 1} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {hasTable ? (
          <div>
            <div className="text-sm font-semibold text-gray-600 mb-2">Table</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    {(() => {
                      const keyColumns = (objData.Table as Record<string, unknown>).KeyColumns as string[] | undefined
                      if (keyColumns) {
                        return keyColumns.map((col) => (
                          <th key={col} className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700">
                            {col}
                          </th>
                        ))
                      }
                      return null
                    })()}
                    {(() => {
                      const rows = (objData.Table as Record<string, unknown>).Rows as Record<string, unknown>[]
                      const keyColumns = (objData.Table as Record<string, unknown>).KeyColumns as string[] | undefined
                      if (rows[0]) {
                        return Object.keys(rows[0])
                          .filter(k => !keyColumns || !keyColumns.includes(k))
                          .map((col) => (
                            <th key={col} className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700">
                              {col}
                            </th>
                          ))
                      }
                      return null
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {((objData.Table as Record<string, unknown>).Rows as Record<string, unknown>[]).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {Object.entries(row).map(([key, value]) => (
                        <td key={key} className="border border-gray-300 px-2 py-1">
                          <InventoryRenderer data={value} depth={depth + 1} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  // Regular object rendering
  const entries = Object.entries(objData)
  if (entries.length === 0) {
    return <span className="text-gray-400 italic">empty</span>
  }

  return (
    <div className="space-y-1 w-full">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-3 w-full">
          <span className="font-medium text-gray-700 min-w-[120px] flex-shrink-0">{key}:</span>
          <div className="flex-1 min-w-0 break-words">
            <InventoryRenderer data={value} depth={depth + 1} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Helper component to render structured JSON data with color grouping
const JsonRenderer = ({ data, depth = 0, groupIndex = 0 }: { data: unknown; depth?: number; groupIndex?: number }): React.ReactNode => {
  if (data === null) return <span className="text-gray-400 italic">null</span>
  if (data === undefined) return <span className="text-gray-400 italic">undefined</span>

  if (typeof data === 'boolean') {
    return <span className="text-purple-600 font-medium">{data.toString()}</span>
  }

  if (typeof data === 'number') {
    return <span className="text-blue-600 font-medium">{data}</span>
  }

  if (typeof data === 'string') {
    return <span className="text-green-600">{data}</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-gray-400">[ ]</span>
    }
    return (
      <div className="space-y-2 w-full">
        {data.map((item, index) => (
          <div key={index} className="flex items-start gap-3 w-full">
            <span className="text-gray-500 font-medium select-none min-w-[40px]">[{index}]</span>
            <div className="flex-1 min-w-0">
              <JsonRenderer data={item} depth={depth + 1} groupIndex={groupIndex} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    if (entries.length === 0) {
      return <span className="text-gray-400">{'{}'}</span>
    }

    // Color palette for groups - different shades of blue
    const bgColors = [
      'bg-blue-50/50',
      'bg-sky-50/50',
      'bg-cyan-50/50',
      'bg-indigo-50/50',
    ]

    const borderColors = [
      'border-blue-100',
      'border-sky-100',
      'border-cyan-100',
      'border-indigo-100',
    ]

    return (
      <div className={depth === 0 ? 'space-y-2' : 'space-y-2 w-full'}>
        {entries.map(([key, value], index) => {
          const currentGroupIndex = depth === 0 ? index % bgColors.length : groupIndex
          const bgColor = depth === 0 ? bgColors[currentGroupIndex] : ''
          const borderColor = depth === 0 ? borderColors[currentGroupIndex] : ''

          return (
            <div
              key={key}
              className={`flex items-start gap-4 w-full ${depth === 0 ? `p-3 rounded-lg border ${bgColor} ${borderColor}` : ''}`}
            >
              <span className={`font-semibold text-gray-700 flex-shrink-0 break-words ${depth === 0 ? 'w-[240px]' : 'min-w-[160px]'}`}>{key}:</span>
              <div className="flex-1 min-w-0 break-words">
                <JsonRenderer data={value} depth={depth + 1} groupIndex={currentGroupIndex} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return <span className="text-gray-500">{String(data)}</span>
}

export default function HostsInventoryPage() {
  const { apiCall } = useApi()
  const { isAuthenticated, token } = useAuthStore()

  // Authentication state
  const [authReady, setAuthReady] = useState(false)

  // State
  const [hosts, setHosts] = useState<CheckMKHost[]>([])
  const [filteredHosts, setFilteredHosts] = useState<CheckMKHost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

  // Selection state
  const [selectedHosts, setSelectedHosts] = useState<Set<string>>(new Set())

  // Host details modal state
  const [isHostModalOpen, setIsHostModalOpen] = useState(false)
  const [selectedHostForView, setSelectedHostForView] = useState<CheckMKHost | null>(null)
  const [hostDetails, setHostDetails] = useState<Record<string, unknown> | null>(null)
  const [loadingHostDetails, setLoadingHostDetails] = useState(false)
  const [showEffectiveAttributes, setShowEffectiveAttributes] = useState(false)

  // Inventory modal state
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false)
  const [selectedHostForInventory, setSelectedHostForInventory] = useState<CheckMKHost | null>(null)
  const [inventoryData, setInventoryData] = useState<Record<string, unknown> | null>(null)
  const [loadingInventory, setLoadingInventory] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  // Filter state
  const [hostNameFilter, setHostNameFilter] = useState('')
  const [folderFilter, setFolderFilter] = useState('')

  // Multi-select folder filter state (checkbox-based)
  const [folderFilters, setFolderFilters] = useState<Record<string, boolean>>({})

  // Sorting state
  const [sortColumn, setSortColumn] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none')

  // Filter options
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    folders: new Set(),
    labels: new Set(),
  })

  // Show status message
  const showMessage = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatusMessage(prev => {
      if (prev?.text === text && prev?.type === type) {
        return prev
      }
      return { type, text }
    })

    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        setStatusMessage(prev => {
          if (prev?.text === text) {
            return null
          }
          return prev
        })
      }, 5000)
    }
  }, [])

  // Load hosts from API
  const loadHosts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiCall<{ hosts?: CheckMKHost[] }>('checkmk/hosts')

      if (response?.hosts) {
        const newHosts = response.hosts
        setHosts(newHosts)

        // Extract filter options
        const newFilterOptions: FilterOptions = {
          folders: new Set(),
          labels: new Set(),
        }

        newHosts.forEach((host: CheckMKHost) => {
          if (host.folder) newFilterOptions.folders.add(host.folder)
          if (host.labels) {
            Object.keys(host.labels).forEach(label => {
              newFilterOptions.labels.add(label)
            })
          }
        })

        setFilterOptions(newFilterOptions)

        // Initialize folder filters (all selected by default)
        const initialFolderFilters: Record<string, boolean> = {}
        newFilterOptions.folders.forEach(folder => {
          initialFolderFilters[folder] = true
        })
        setFolderFilters(initialFolderFilters)

        setStatusMessage(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load hosts'
      setError(message)
      showMessage(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [apiCall, showMessage])

  const handleReloadHosts = useCallback(() => {
    void loadHosts()
  }, [loadHosts])

  // Apply filters and sorting
  const applyFilters = useCallback(() => {
    let filtered = hosts.filter(host => {
      // Host name filter
      if (hostNameFilter) {
        const hostName = (host.host_name || '').toLowerCase()
        if (!hostName.includes(hostNameFilter.toLowerCase())) {
          return false
        }
      }

      // Multi-select folder filter (checkbox-based)
      if (Object.keys(folderFilters).length > 0) {
        const hostFolder = host.folder || ''
        if (!(hostFolder in folderFilters)) return true
        if (!folderFilters[hostFolder]) return false
      }

      return true
    })

    // Apply sorting
    if (sortColumn && sortOrder !== 'none') {
      filtered = filtered.slice().sort((a, b) => {
        let aVal: string, bVal: string

        switch (sortColumn) {
          case 'name':
            aVal = a.host_name || ''
            bVal = b.host_name || ''
            break
          case 'folder':
            aVal = a.folder || ''
            bVal = b.folder || ''
            break
          default:
            return 0
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }

    setFilteredHosts(filtered)
    setCurrentPage(0)
  }, [hosts, hostNameFilter, folderFilters, sortColumn, sortOrder])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setHostNameFilter('')
    setFolderFilter('')
    setSortColumn('')
    setSortOrder('none')
    setCurrentPage(0)
    setFilteredHosts(hosts)

    // Reset folder filters to all selected
    const resetFolderFilters: Record<string, boolean> = {}
    filterOptions.folders.forEach(folder => {
      resetFolderFilters[folder] = true
    })
    setFolderFilters(resetFolderFilters)
  }, [hosts, filterOptions.folders])

  // Load host details
  const loadHostDetails = useCallback(async (hostname: string, effectiveAttributes: boolean) => {
    try {
      setLoadingHostDetails(true)

      const params = new URLSearchParams()
      if (effectiveAttributes) {
        params.append('effective_attributes', 'true')
      }

      const endpoint = `checkmk/hosts/${encodeURIComponent(hostname)}${params.toString() ? '?' + params.toString() : ''}`
      const response = await apiCall<{ success: boolean; data: Record<string, unknown> }>(endpoint)

      if (response?.data) {
        setHostDetails(response.data)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load host details'
      showMessage(`Failed to load details for ${hostname}: ${message}`, 'error')
    } finally {
      setLoadingHostDetails(false)
    }
  }, [apiCall, showMessage])

  // Load inventory data
  const loadInventory = useCallback(async (hostname: string) => {
    try {
      setLoadingInventory(true)

      const endpoint = `checkmk/inventory/${encodeURIComponent(hostname)}`
      const response = await apiCall<{ success: boolean; data: Record<string, unknown> }>(endpoint)

      if (response?.data) {
        setInventoryData(response.data)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load inventory'
      showMessage(`Failed to load inventory for ${hostname}: ${message}`, 'error')
    } finally {
      setLoadingInventory(false)
    }
  }, [apiCall, showMessage])

  // Actions
  const handleViewHost = useCallback((host: CheckMKHost) => {
    setSelectedHostForView(host)
    setIsHostModalOpen(true)
    setShowEffectiveAttributes(false)
    void loadHostDetails(host.host_name, false)
  }, [loadHostDetails])

  const handleViewInventory = useCallback((host: CheckMKHost) => {
    setSelectedHostForInventory(host)
    setIsInventoryModalOpen(true)
    void loadInventory(host.host_name)
  }, [loadInventory])

  const handleSyncToNautobot = useCallback(async (host: CheckMKHost) => {
    try {
      showMessage(`Syncing ${host.host_name} to Nautobot...`, 'info')

      // TODO: Implement sync endpoint
      await apiCall(`checkmk/sync-to-nautobot/${encodeURIComponent(host.host_name)}`, {
        method: 'POST'
      })

      showMessage(`Successfully synced ${host.host_name} to Nautobot`, 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync to Nautobot'
      showMessage(`Failed to sync ${host.host_name}: ${message}`, 'error')
    }
  }, [apiCall, showMessage])

  // Pagination
  const totalPages = Math.ceil(filteredHosts.length / pageSize)
  const paginatedHosts = useMemo(() => {
    const start = currentPage * pageSize
    const end = start + pageSize
    return filteredHosts.slice(start, end)
  }, [filteredHosts, currentPage, pageSize])

  // Selection handlers
  const handleSelectHost = useCallback((hostName: string, checked: boolean) => {
    setSelectedHosts(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(hostName)
      } else {
        newSet.delete(hostName)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedHosts(new Set(paginatedHosts.map(host => host.host_name)))
    } else {
      setSelectedHosts(new Set())
    }
  }, [paginatedHosts])

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

  // Mark handleSort as used
  void handleSort

  // Effects
  useEffect(() => {
    if (isAuthenticated && token) {
      setAuthReady(true)
      void loadHosts()
    }
  }, [isAuthenticated, loadHosts, token])

  useEffect(() => {
    applyFilters()
  }, [applyFilters, hosts, hostNameFilter, folderFilter, sortColumn, sortOrder])

  // Reload host details when effective attributes toggle changes
  useEffect(() => {
    if (isHostModalOpen && selectedHostForView) {
      void loadHostDetails(selectedHostForView.host_name, showEffectiveAttributes)
    }
  }, [showEffectiveAttributes, isHostModalOpen, selectedHostForView, loadHostDetails])

  const activeFiltersCount = [
    hostNameFilter,
    folderFilter
  ].filter(Boolean).length +
  (Object.keys(folderFilters).length > 0 && Object.values(folderFilters).filter(Boolean).length < filterOptions.folders.size ? 1 : 0)

  if (!authReady || (loading && hosts.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">
            {!authReady ? 'Establishing authentication...' : 'Loading hosts...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Server className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Hosts & Inventory</h1>
            <p className="text-gray-600 mt-1">View and manage CheckMK hosts and inventory data</p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <Card className={`min-w-[400px] max-w-[600px] shadow-lg ${
            statusMessage.type === 'error' ? 'border-red-500 bg-red-50' :
            'border-blue-500 bg-blue-50'
          }`}>
            <CardContent className="p-4">
              <div className={`flex items-start gap-3 ${
                statusMessage.type === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                <div className="flex-shrink-0 mt-0.5">
                  {statusMessage.type === 'error' && <X className="h-5 w-5" />}
                  {statusMessage.type === 'info' && <span className="text-lg">ℹ</span>}
                </div>
                <span className="flex-1 text-sm font-medium break-words">{statusMessage.text}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusMessage(null)}
                  className="ml-2 h-6 w-6 p-0 flex-shrink-0 hover:bg-transparent"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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

      {/* Hosts table */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">CheckMK Hosts Management</h3>
                {activeFiltersCount > 0 || sortColumn ? (
                  <p className="text-blue-100 text-xs">
                    Showing {filteredHosts.length} of {hosts.length} hosts
                    {activeFiltersCount > 0 && ` (${activeFiltersCount} filter${activeFiltersCount > 1 ? 's' : ''} active)`}
                    {sortColumn && ` - Sorted by ${sortColumn.replace('_', ' ')} (${sortOrder})`}
                  </p>
                ) : (
                  <p className="text-blue-100 text-xs">
                    Showing all {hosts.length} hosts
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {activeFiltersCount > 0 && (
                <>
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
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReloadHosts}
                className="text-white hover:bg-white/20 text-xs h-7"
                disabled={loading}
                title="Reload hosts from CheckMK"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                ) : (
                  <Search className="h-3 w-3 mr-1" />
                )}
                Load Hosts
              </Button>
            </div>
          </div>
        </div>
        <div className="p-4 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium w-12">
                    <Checkbox
                      checked={paginatedHosts.length > 0 && paginatedHosts.every(host => selectedHosts.has(host.host_name))}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all hosts"
                    />
                  </th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Host Name</div>
                      <div>
                        <Input
                          placeholder="Filter by name..."
                          value={hostNameFilter}
                          onChange={(e) => setHostNameFilter(e.target.value)}
                          className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>IP Address</div>
                      <div className="h-8" />
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Folder</div>
                      <div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs justify-between w-full">
                              Folder Filter
                              {Object.values(folderFilters).filter(Boolean).length < filterOptions.folders.size && Object.keys(folderFilters).length > 0 && (
                                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                                  {Object.values(folderFilters).filter(Boolean).length}
                                </Badge>
                              )}
                              <ChevronDown className="h-4 w-4 ml-auto" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuLabel className="text-xs">Filter by Folder</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem
                              checked={Object.values(folderFilters).every(Boolean)}
                              onCheckedChange={(checked) => {
                                const newFilters: Record<string, boolean> = {}
                                filterOptions.folders.forEach(folder => {
                                  newFilters[folder] = !!checked
                                })
                                setFolderFilters(newFilters)
                                setCurrentPage(0)
                              }}
                            >
                              Select all
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator />
                            {Array.from(filterOptions.folders).sort().map((folder) => (
                              <DropdownMenuCheckboxItem
                                key={`hosts-inventory-folder-${folder}`}
                                checked={folderFilters[folder] || false}
                                onCheckedChange={(checked) =>
                                  setFolderFilters(prev => ({ ...prev, [folder]: !!checked }))
                                }
                              >
                                {folder}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Status</div>
                      <div className="h-8" />
                    </div>
                  </th>
                  <th className="text-left p-2 font-medium">
                    <div className="space-y-1">
                      <div>Actions</div>
                      <div className="h-8" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedHosts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      No hosts found
                    </td>
                  </tr>
                ) : (
                  paginatedHosts.map((host) => {
                    // Extract values from attributes
                    const ipAddress = (host.attributes?.ipaddress as string) || 'N/A'
                    const isCluster = host.attributes?.tag_agent === 'cmk-agent-cluster'

                    return (
                      <tr
                        key={`hosts-inventory-host-${host.host_name}`}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <td className="p-2 w-12">
                          <Checkbox
                            checked={selectedHosts.has(host.host_name)}
                            onCheckedChange={(checked) => handleSelectHost(host.host_name, !!checked)}
                            aria-label={`Select ${host.host_name}`}
                          />
                        </td>
                        <td className="p-2 font-medium">
                          {host.host_name}
                          {isCluster && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Cluster
                            </Badge>
                          )}
                        </td>
                        <td className="p-2">{ipAddress}</td>
                        <td className="p-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {host.folder || '/'}
                          </code>
                        </td>
                        <td className="p-2">
                          <Badge variant="default">
                            Active
                          </Badge>
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewHost(host)}
                              title="View Host in CheckMK"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Host
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewInventory(host)}
                              title="View Inventory"
                            >
                              <Server className="h-3 w-3 mr-1" />
                              Inventory
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSyncToNautobot(host)}
                              title="Sync to Nautobot"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Sync
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
              Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, filteredHosts.length)} of {filteredHosts.length} entries
            </div>

            <div className="flex items-center gap-1">
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

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(0, Math.min(totalPages - 5, currentPage - 2)) + i
                    if (pageNum >= totalPages) return null

                    return (
                      <Button
                        key={`hosts-inventory-page-${pageNum}`}
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

      {/* Host Details Modal */}
      <Dialog open={isHostModalOpen} onOpenChange={setIsHostModalOpen}>
        <DialogContent className="!max-w-[64vw] !w-[64vw] max-h-[90vh] overflow-hidden flex flex-col p-0" style={{ maxWidth: '64vw', width: '64vw' }}>
          <DialogHeader className="sr-only">
            <DialogTitle>Host Details - {selectedHostForView?.host_name}</DialogTitle>
            <DialogDescription>View detailed information and attributes for the selected host</DialogDescription>
          </DialogHeader>
          {/* Blue Header */}
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 px-6">
            <div>
              <h2 className="text-lg font-semibold">Host Details</h2>
              <p className="text-blue-100 text-sm">{selectedHostForView?.host_name}</p>
            </div>
          </div>

          {/* Controls Section */}
          <div className="bg-gray-50 border-b px-6 py-3">
            <div className="flex items-center gap-3">
              <Label htmlFor="effective-attrs" className="text-sm font-medium text-gray-700">
                Show Effective Attributes:
              </Label>
              <Select
                value={showEffectiveAttributes ? 'true' : 'false'}
                onValueChange={(value) => setShowEffectiveAttributes(value === 'true')}
              >
                <SelectTrigger className="w-24 h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">False</SelectItem>
                  <SelectItem value="true">True</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Host Details Content */}
          <div className="flex-1 overflow-y-auto bg-white">
            {loadingHostDetails ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading host details...</p>
                </div>
              </div>
            ) : hostDetails ? (
              <div className="p-6">
                {/* Host Info Section */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  {(() => {
                    if (hostDetails.id && typeof hostDetails.id === 'string') {
                      return (
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg p-4 border border-blue-200">
                          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Host Name</div>
                          <div className="font-mono text-lg font-semibold text-gray-900">{hostDetails.id}</div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {(() => {
                    const extensions = hostDetails.extensions as Record<string, unknown> | undefined
                    const folder = extensions?.folder
                    if (folder && typeof folder === 'string') {
                      return (
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-lg p-4 border border-purple-200">
                          <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">Folder</div>
                          <div className="font-mono text-lg font-semibold text-gray-900">
                            {folder}
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>

                {/* Attributes Section */}
                {(() => {
                  const extensions = hostDetails.extensions as Record<string, unknown> | undefined
                  if (extensions?.attributes) {
                    return (
                      <div className="mb-6">
                        <div className="flex items-center mb-4 pb-2 border-b-2 border-blue-500">
                          <h3 className="text-lg font-bold text-gray-900">
                            {showEffectiveAttributes ? 'Effective Attributes' : 'Attributes'}
                          </h3>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                          <JsonRenderer data={extensions.attributes} />
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Effective Attributes Section (separate) */}
                {(() => {
                  const extensions = hostDetails.extensions as Record<string, unknown> | undefined
                  if (showEffectiveAttributes && extensions?.effective_attributes) {
                    return (
                      <div className="mb-6">
                        <div className="flex items-center mb-4 pb-2 border-b-2 border-indigo-500">
                          <h3 className="text-lg font-bold text-indigo-700">Effective Attributes</h3>
                        </div>
                        <div className="bg-indigo-50/50 rounded-lg p-6 border border-indigo-200">
                          <JsonRenderer data={extensions.effective_attributes} />
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Cluster Info */}
                {(() => {
                  const extensions = hostDetails.extensions as Record<string, unknown> | undefined
                  if (extensions?.is_cluster) {
                    return (
                      <div className="mb-6">
                        <div className="flex items-center mb-4 pb-2 border-b-2 border-amber-500">
                          <h3 className="text-lg font-bold text-amber-700">Cluster Information</h3>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-gray-700">Status:</span>
                              <Badge className="bg-amber-500 hover:bg-amber-600">Cluster</Badge>
                            </div>
                            {extensions.cluster_nodes ? (
                              <div>
                                <div className="text-sm font-semibold text-gray-700 mb-2">Cluster Nodes:</div>
                                <div className="bg-white rounded p-4 border border-amber-200">
                                  <JsonRenderer data={extensions.cluster_nodes} />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Raw JSON Section */}
                <div>
                  <details className="group">
                    <summary className="flex items-center gap-2 text-sm font-semibold text-gray-600 uppercase tracking-wide cursor-pointer hover:text-blue-600 transition-colors select-none py-3">
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      Raw JSON Response
                    </summary>
                    <div className="mt-3 bg-gray-900 rounded-lg p-4 overflow-auto max-h-96 border border-gray-700">
                      <pre className="text-xs text-green-400 font-mono leading-relaxed">
                        {JSON.stringify(hostDetails, null, 2)}
                      </pre>
                    </div>
                  </details>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No host details available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Inventory Modal */}
      <Dialog open={isInventoryModalOpen} onOpenChange={setIsInventoryModalOpen}>
        <DialogContent className="!max-w-[64vw] !w-[64vw] max-h-[90vh] overflow-hidden flex flex-col p-0" style={{ maxWidth: '64vw', width: '64vw' }}>
          <DialogHeader className="sr-only">
            <DialogTitle>Inventory - {selectedHostForInventory?.host_name}</DialogTitle>
            <DialogDescription>View inventory data for the selected host</DialogDescription>
          </DialogHeader>
          {/* Blue Header */}
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 px-6">
            <div>
              <h2 className="text-lg font-semibold">Host Inventory</h2>
              <p className="text-blue-100 text-sm">{selectedHostForInventory?.host_name}</p>
            </div>
          </div>

          {/* Inventory Content */}
          <div className="flex-1 overflow-y-auto bg-white">
            {loadingInventory ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading inventory...</p>
                </div>
              </div>
            ) : inventoryData ? (
              <div className="p-6">
                {/* Check if result exists and has data */}
                {(inventoryData.result as Record<string, unknown>) &&
                 Object.keys(inventoryData.result as Record<string, unknown>).length > 0 ? (
                  (() => {
                    const result = inventoryData.result as Record<string, unknown>
                    const hostname = Object.keys(result)[0]
                    if (!hostname) return null
                    const hostData = result[hostname] as Record<string, unknown>
                    const nodes = (hostData?.Nodes as Record<string, unknown>) || {}

                    return (
                      <>
                        {/* Render all top-level nodes dynamically */}
                        {Object.entries(nodes).map(([nodeName, nodeData]) => {
                          // Determine color scheme based on node name
                          let borderColor = 'border-gray-500'
                          let textColor = 'text-gray-900'
                          let bgColor = 'bg-gray-50/50'

                          if (nodeName === 'hardware') {
                            borderColor = 'border-blue-500'
                            textColor = 'text-gray-900'
                            bgColor = 'bg-gray-50'
                          } else if (nodeName === 'networking') {
                            borderColor = 'border-green-500'
                            textColor = 'text-green-700'
                            bgColor = 'bg-green-50/50'
                          } else if (nodeName === 'software') {
                            borderColor = 'border-purple-500'
                            textColor = 'text-purple-700'
                            bgColor = 'bg-purple-50/50'
                          }

                          return (
                            <div key={nodeName} className="mb-6">
                              <div className={`flex items-center mb-4 pb-2 border-b-2 ${borderColor}`}>
                                <h3 className={`text-lg font-bold capitalize ${textColor}`}>{nodeName}</h3>
                              </div>
                              <div className={`${bgColor} rounded-lg p-6 border ${borderColor.replace('border-', 'border-')}`}>
                                <InventoryRenderer data={nodeData} />
                              </div>
                            </div>
                          )
                        })}

                        {/* Show message if no nodes */}
                        {Object.keys(nodes).length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No inventory nodes available for this host
                          </div>
                        )}

                        {/* Raw JSON Section */}
                        <div>
                          <details className="group">
                            <summary className="flex items-center gap-2 text-sm font-semibold text-gray-600 uppercase tracking-wide cursor-pointer hover:text-blue-600 transition-colors select-none py-3">
                              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                              Raw JSON Response
                            </summary>
                            <div className="mt-3 bg-gray-900 rounded-lg p-4 overflow-auto max-h-96 border border-gray-700">
                              <pre className="text-xs text-green-400 font-mono leading-relaxed">
                                {JSON.stringify(inventoryData, null, 2)}
                              </pre>
                            </div>
                          </details>
                        </div>
                      </>
                    )
                  })()
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No inventory data available for this host
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No inventory data available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
