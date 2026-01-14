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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/lib/auth-store'

import { HostDetailsModal } from '../modals/host-details-modal'
import { InventoryModal } from '../modals/inventory-modal'
import { SyncToNautobotModal } from '../modals/sync-to-nautobot-modal'

import { useCheckmkHostsQuery } from './queries/use-checkmk-hosts-query'
import { useHostsFilter } from './hooks/use-hosts-filter'
import { useHostsPagination } from './hooks/use-hosts-pagination'
import { useHostsSelection } from './hooks/use-hosts-selection'
import { useCheckmkConfig } from './hooks/use-checkmk-config'
import { useStatusMessage } from './hooks/use-status-message'
import { useModalState } from './hooks/use-modal-state'
import { useNautobotSync } from './hooks/use-nautobot-sync'

// Types imported from centralized location
import type { CheckMKHost, FilterOptions } from '@/types/checkmk/types'

export default function HostsInventoryPage() {
  const { isAuthenticated, token } = useAuthStore()

  // Derived authentication state
  const authReady = isAuthenticated && !!token

  // Custom hooks
  const { statusMessage, showMessage, clearMessage } = useStatusMessage()
  const {
    isHostModalOpen,
    selectedHostForView,
    openHostModal,
    closeHostModal,
    isInventoryModalOpen,
    selectedHostForInventory,
    openInventoryModal,
    closeInventoryModal
  } = useModalState()

  // Fetch hosts using TanStack Query
  const { data, isLoading, error: queryError, refetch } = useCheckmkHostsQuery({
    enabled: authReady
  })

  // Extract hosts from query data
  const hosts = useMemo(() => data?.hosts || [], [data])

  // Extract filter options from hosts
  const filterOptions = useMemo<FilterOptions>(() => {
    const options: FilterOptions = {
      folders: new Set(),
      labels: new Set(),
    }

    hosts.forEach((host: CheckMKHost) => {
      if (host.folder) options.folders.add(host.folder)
      if (host.labels) {
        Object.keys(host.labels).forEach(label => {
          options.labels.add(label)
        })
      }
    })

    return options
  }, [hosts])

  // Track user's explicit folder filter changes (overrides default "all selected")
  const [folderFilterOverrides, setFolderFilterOverrides] = useState<Record<string, boolean>>({})

  // Derive folderFilters from filterOptions + user overrides
  // All folders are selected by default, unless user has explicitly changed them
  const folderFilters = useMemo<Record<string, boolean>>(() => {
    const filters: Record<string, boolean> = {}
    filterOptions.folders.forEach(folder => {
      // Use user override if exists, otherwise default to true (selected)
      filters[folder] = folderFilterOverrides[folder] ?? true
    })
    return filters
  }, [filterOptions.folders, folderFilterOverrides])

  // Wrapper to update folder filters (stores user override)
  const setFolderFilters = useCallback((updater: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => {
    if (typeof updater === 'function') {
      setFolderFilterOverrides(() => {
        const currentFilters = { ...folderFilters }
        const newFilters = updater(currentFilters)
        // Store as overrides
        return newFilters
      })
    } else {
      setFolderFilterOverrides(updater)
    }
  }, [folderFilters])

  // Convert query error to string for backward compatibility
  const error = queryError instanceof Error ? queryError.message : null

  // Reload hosts function for backward compatibility
  const reloadHosts = useCallback(() => {
    void refetch()
  }, [refetch])

  const { selectedHosts, handleSelectHost, handleSelectAll } = useHostsSelection()
  const { checkmkConfig, loadCheckmkConfig } = useCheckmkConfig()
  
  // Nautobot sync hook
  const {
    isSyncModalOpen,
    selectedHostForSync,
    nautobotDevice,
    checkingNautobot,
    nautobotMetadata,
    propertyMappings,
    loadingMetadata,
    inventoryData,
    loadingInventory,
    ipAddressStatuses,
    ipAddressRoles,
    handleSyncToNautobot,
    updatePropertyMapping,
    updatePropertyMappings,
    updateInterfaceMappings,
    executeSyncToNautobot,
    closeSyncModal
  } = useNautobotSync({ checkmkConfig, onMessage: showMessage })
  
  const {
    filteredHosts,
    hostNameFilter,
    sortColumn,
    sortOrder,
    activeFiltersCount,
    setHostNameFilter,
    setFolderFilters: setFolderFiltersFromHook,
    resetFilters,
  } = useHostsFilter(hosts, filterOptions, undefined)

  const {
    currentPage,
    pageSize,
    totalPages,
    paginatedHosts,
    handlePageChange,
    setPageSize,
  } = useHostsPagination(filteredHosts)

  // Sync folderFilters to filter hook
  useEffect(() => {
    setFolderFiltersFromHook(folderFilters)
  }, [folderFilters, setFolderFiltersFromHook])

  // Actions - now using modal hook functions
  const handleViewHost = useCallback((host: CheckMKHost) => {
    openHostModal(host)
  }, [openHostModal])

  const handleViewInventory = useCallback((host: CheckMKHost) => {
    openInventoryModal(host)
  }, [openInventoryModal])

  // Load CheckMK config on mount
  useEffect(() => {
    void loadCheckmkConfig()
  }, [loadCheckmkConfig])

  // TanStack Query automatically loads hosts when authReady is true (enabled prop)

  if (!authReady || (isLoading && hosts.length === 0)) {
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
                  onClick={() => clearMessage()}
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
                onClick={reloadHosts}
                className="text-white hover:bg-white/20 text-xs h-7"
                disabled={isLoading}
                title="Reload hosts from CheckMK"
              >
                {isLoading ? (
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
                      onCheckedChange={(checked) => handleSelectAll(!!checked, paginatedHosts)}
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
                                handlePageChange(0)
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
      <HostDetailsModal
        open={isHostModalOpen}
        onOpenChange={closeHostModal}
        host={selectedHostForView}
      />

      {/* Inventory Modal */}
      <InventoryModal
        open={isInventoryModalOpen}
        onOpenChange={closeInventoryModal}
        host={selectedHostForInventory}
      />

      {/* Sync to Nautobot Modal */}
      <SyncToNautobotModal
        open={isSyncModalOpen}
        onOpenChange={closeSyncModal}
        host={selectedHostForSync}
        nautobotDevice={nautobotDevice}
        checkingNautobot={checkingNautobot}
        nautobotMetadata={nautobotMetadata}
        propertyMappings={propertyMappings}
        loadingMetadata={loadingMetadata}
        inventoryData={inventoryData}
        loadingInventory={loadingInventory}
        ipAddressStatuses={ipAddressStatuses}
        ipAddressRoles={ipAddressRoles}
        onSync={executeSyncToNautobot}
        onUpdateMapping={updatePropertyMapping}
        onUpdatePropertyMappings={updatePropertyMappings}
        onUpdateInterfaceMappings={updateInterfaceMappings}
      />
    </div>
  )
}
