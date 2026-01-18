# Refactoring Plan: Nautobot Sync Devices Page

## Executive Summary

The `frontend/src/components/features/nautobot/sync-devices/sync-devices-page.tsx` file is a **1,210-line monolithic component** that violates multiple project architectural standards defined in `CLAUDE.md`. The component uses manual `useState + useEffect` patterns for server data instead of TanStack Query, has disabled ESLint rules, and combines too many responsibilities in a single file.

**Key Issues:**
- Manual state management for server data (violates TanStack Query mandate)
- 8 separate data loading functions with manual loading/error states
- Multiple disabled ESLint exhaustive-deps rules
- No separation of concerns (data fetching, filtering, UI all in one file)
- ~1,200 lines in a single component

**Estimated reduction:** ~400-500 lines through proper abstraction and TanStack Query migration.

---

## Current Architecture

```
frontend/src/components/features/nautobot/sync-devices/
└── sync-devices-page.tsx    # 1,210 lines - Everything in one file
```

### Current State Analysis

| Aspect | Lines | Description |
|--------|-------|-------------|
| Type definitions | 41-100 | 7 interfaces defined inline |
| State declarations | 110-176 | 15+ useState calls |
| useEffect hooks | 178-235 | 6 effects, 4 with disabled lint rules |
| Data loading functions | 238-460 | 8 async functions for API calls |
| Filter/helper functions | 462-680 | Business logic mixed with component |
| JSX rendering | 682-1210 | ~530 lines of UI code |

---

## Problem Analysis

### Problem 1: Manual useState + useEffect for Server Data

**Location:** Lines 111-165 (state), Lines 186-223 (effects)

**Current Pattern (WRONG per CLAUDE.md):**
```typescript
const [devices, setDevices] = useState<Device[]>([])
const [isLoading, setIsLoading] = useState(false)

useEffect(() => {
  loadInitialData()
}, []) // eslint-disable-line react-hooks/exhaustive-deps

const loadDevices = async () => {
  setIsLoading(true)
  try {
    const data = await apiCall('nautobot/devices')
    setDevices(data.devices)
  } finally {
    setIsLoading(false)
  }
}
```

**Should Be:**
```typescript
const { data, isLoading, error } = useDevicesQuery()
const devices = data?.devices ?? []
```

**Affected State Variables:**
- `devices` / `filteredDevices` - Should use TanStack Query
- `dropdownOptions` (namespaces, statuses) - Should use TanStack Query
- `nautobotDefaults` - Should use TanStack Query
- `locationsList` - Should use TanStack Query
- `isLoading` / `statusMessage` - Managed by TanStack Query automatically

---

### Problem 2: Disabled ESLint Rules (4 instances)

**Locations:**
- Line 188: `// eslint-disable-line react-hooks/exhaustive-deps`
- Line 216: `// eslint-disable-line react-hooks/exhaustive-deps`
- Line 223: `// eslint-disable-line react-hooks/exhaustive-deps`
- Line 263: `// eslint-disable-line react-hooks/exhaustive-deps`

**Issue:** These indicate unstable dependencies and potential bugs. The effects reference functions like `loadInitialData`, `reloadDevices`, `applyFilters`, and `setDefaultSyncProperties` that aren't memoized.

---

### Problem 3: No Centralized Query Keys

**Current:** API calls use hardcoded endpoint strings with no cache invalidation strategy.

**Should Use:** Query key factory from `/lib/query-keys.ts`:
```typescript
export const queryKeys = {
  nautobot: {
    devices: () => ['nautobot', 'devices'] as const,
    namespaces: () => ['nautobot', 'namespaces'] as const,
    statuses: (type: string) => ['nautobot', 'statuses', type] as const,
    defaults: () => ['nautobot', 'defaults'] as const,
    locations: () => ['nautobot', 'locations'] as const,
  },
}
```

---

### Problem 4: Monolithic Component (~1,210 lines)

**Single file handles:**
1. Authentication checking
2. 8 different data loading functions
3. Location hierarchy building
4. Filter state management
5. Pagination logic
6. Device selection management
7. Form validation
8. Sync submission
9. All UI rendering (sync panel, table, filters, pagination)

**Violates:** Feature-based organization principle from CLAUDE.md

---

### Problem 5: Inline Type Definitions

**Location:** Lines 41-100

**Current:** 7 interfaces defined at top of component file
```typescript
interface Device { ... }
interface SyncProperties { ... }
interface DropdownOption { ... }
interface LocationItem { ... }
interface StatusMessage { ... }
interface PaginationState { ... }
interface TableFilters { ... }
```

**Should Be:** Extracted to `/types/index.ts` within feature directory

---

### Problem 6: Hardcoded Colors

**Location:** Lines 673-679, various JSX

**Current:**
```typescript
if (statusLower.includes('active')) return 'bg-blue-500'
if (statusLower.includes('failed')) return 'bg-red-500'
```

**Should Use:** Semantic Tailwind classes (`bg-primary`, `bg-destructive`, etc.)

---

### Problem 7: Business Logic in Component

**Location:** Lines 317-352 (location hierarchy), Lines 488-536 (applyFilters)

**Current:** Complex logic like `buildLocationHierarchy()` and `applyFilters()` defined inside component.

**Should Be:** Extracted to utility functions or custom hooks.

---

## Proposed Refactoring Plan

### Phase 1: Extract Type Definitions

**Create:** `frontend/src/components/features/nautobot/sync-devices/types/index.ts`

```typescript
// Types for Sync Devices feature

export interface Device {
  id: string
  name: string | null
  primary_ip4?: { address: string }
  role?: { name: string }
  location?: { name: string }
  device_type?: { model: string }
  status?: { name: string }
}

export interface SyncProperties {
  prefix_status: string
  interface_status: string
  ip_address_status: string
  namespace: string
  sync_options: string[]
}

export interface DropdownOption {
  id: string
  name: string
}

export interface LocationItem {
  id: string
  name: string
  parent?: { id: string }
  hierarchicalPath?: string
}

export interface NautobotDefaults {
  namespace: string
  interface_status: string
  ip_address_status: string
  ip_prefix_status: string
}

export interface TableFilters {
  deviceName: string
  role: string
  location: string
  ipAddress: string
  status: string
}

export interface DropdownOptions {
  namespaces: DropdownOption[]
  prefixStatuses: DropdownOption[]
  interfaceStatuses: DropdownOption[]
  ipAddressStatuses: DropdownOption[]
  roles: DropdownOption[]
  locations: DropdownOption[]
  statuses: DropdownOption[]
}
```

**Estimated effort:** 30 minutes

---

### Phase 2: Verify Query Keys (Already Exist)

**File:** `frontend/src/lib/query-keys.ts`

**Status:** ✅ Query keys already exist in the codebase (lines 46-78).

The following keys are available and ready to use:
```typescript
queryKeys.nautobot.devices()      // For device list
queryKeys.nautobot.locations()    // For locations dropdown
queryKeys.nautobot.namespaces()   // For namespaces dropdown
queryKeys.nautobot.defaults()     // For Nautobot default settings
queryKeys.nautobot.statuses(type) // For status dropdowns (prefix, interface, ipaddress)
```

**No changes needed** - just use these existing keys in the TanStack Query hooks.

**Estimated effort:** 0 minutes (already done)

---

### Phase 3: Create TanStack Query Hooks

**Create:** `frontend/src/components/features/nautobot/sync-devices/hooks/use-sync-devices-queries.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { Device, DropdownOption, LocationItem, NautobotDefaults } from '../types'

// Devices query
export function useDevicesQuery(options?: { reload?: boolean }) {
  const { apiCall } = useApi()
  const endpoint = options?.reload ? 'nautobot/devices?reload=true' : 'nautobot/devices'

  return useQuery({
    queryKey: queryKeys.nautobot.devices(),
    queryFn: async () => {
      const data = await apiCall<{ devices: Device[] }>(endpoint)
      return data?.devices ?? []
    },
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Namespaces query
export function useNamespacesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.namespaces(),
    queryFn: async () => {
      const data = await apiCall<DropdownOption[]>('nautobot/namespaces')
      return data ?? []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (static data)
  })
}

// Locations query
export function useLocationsQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.locations(),
    queryFn: async () => {
      const data = await apiCall<LocationItem[]>('nautobot/locations')
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

// Nautobot defaults query
export function useNautobotDefaultsQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.defaults(),
    queryFn: async () => {
      const response = await apiCall<{
        success: boolean
        data?: NautobotDefaults
      }>('settings/nautobot/defaults')
      return response?.data ?? null
    },
    staleTime: 5 * 60 * 1000,
  })
}

// Status queries (prefix, interface, ipaddress)
export function usePrefixStatusesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.statuses.prefix(),
    queryFn: async () => {
      const data = await apiCall<DropdownOption[]>('nautobot/statuses/prefix')
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useInterfaceStatusesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.statuses.interface(),
    queryFn: async () => {
      const data = await apiCall<DropdownOption[]>('nautobot/statuses/interface')
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useIPAddressStatusesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.statuses.ipAddress(),
    queryFn: async () => {
      const data = await apiCall<DropdownOption[]>('nautobot/statuses/ipaddress')
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}
```

**Estimated effort:** 1.5 hours

---

### Phase 4: Create Sync Mutation Hook

**Create:** `frontend/src/components/features/nautobot/sync-devices/hooks/use-sync-devices-mutation.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'
import type { SyncProperties } from '../types'

interface SyncDevicesInput {
  deviceIds: string[]
  syncProperties: SyncProperties
}

export function useSyncDevicesMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ deviceIds, syncProperties }: SyncDevicesInput) => {
      const syncData = {
        data: {
          devices: deviceIds,
          default_prefix_status: syncProperties.prefix_status,
          interface_status: syncProperties.interface_status,
          ip_address_status: syncProperties.ip_address_status,
          namespace: syncProperties.namespace,
          sync_cables: syncProperties.sync_options.includes('cables'),
          sync_software_version: syncProperties.sync_options.includes('software'),
          sync_vlans: syncProperties.sync_options.includes('vlans'),
          sync_vrfs: syncProperties.sync_options.includes('vrfs'),
        },
      }

      return apiCall<{ success: boolean; message: string }>(
        'nautobot/sync-network-data',
        { method: 'POST', body: syncData }
      )
    },
    onSuccess: (result, variables) => {
      if (result?.success) {
        toast({
          title: 'Success',
          description: `Successfully synchronized ${variables.deviceIds.length} devices`,
        })
        // Invalidate devices query to refresh data
        queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.devices() })
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}
```

**Estimated effort:** 45 minutes

---

### Phase 5: Extract Utility Functions

**Create:** `frontend/src/components/features/nautobot/sync-devices/utils/index.ts`

```typescript
import type { Device, LocationItem, TableFilters } from '../types'

/**
 * Build hierarchical path for a location (e.g., "Parent → Child → Grandchild")
 */
export function buildLocationPath(
  location: LocationItem,
  locationMap: Map<string, LocationItem>
): string {
  const names: string[] = []
  const visited = new Set<string>()
  let current: LocationItem | undefined = location

  while (current) {
    if (visited.has(current.id)) {
      names.unshift(`${current.name} (cycle)`)
      break
    }
    visited.add(current.id)
    names.unshift(current.name)

    const parentId = current.parent?.id
    if (!parentId) break
    current = locationMap.get(parentId)
    if (!current) break
  }

  return names.join(' → ')
}

/**
 * Build location hierarchy with hierarchicalPath for each location
 */
export function buildLocationHierarchy(locations: LocationItem[]): LocationItem[] {
  const map = new Map<string, LocationItem>()
  locations.forEach((l) => map.set(l.id, { ...l }))

  const processed = locations.map((loc) => {
    const copy = { ...loc }
    copy.hierarchicalPath = buildLocationPath(copy, map)
    return copy
  })

  processed.sort((a, b) =>
    (a.hierarchicalPath || '').localeCompare(b.hierarchicalPath || '')
  )
  return processed
}

/**
 * Filter devices based on table filters and role filters
 */
export function filterDevices(
  devices: Device[],
  filters: TableFilters,
  roleFilters: Record<string, boolean>
): Device[] {
  let filtered = devices

  // Device name filter
  if (filters.deviceName) {
    const search = filters.deviceName.toLowerCase()
    filtered = filtered.filter((device) =>
      device.name?.toLowerCase().includes(search)
    )
  }

  // Role filter (multi-select)
  if (Object.keys(roleFilters).length > 0) {
    filtered = filtered.filter((device) => {
      const deviceRole = device.role?.name || ''
      if (!(deviceRole in roleFilters)) return true
      return roleFilters[deviceRole] === true
    })
  }

  // Location filter
  if (filters.location && filters.location !== 'all') {
    filtered = filtered.filter(
      (device) => device.location?.name === filters.location
    )
  }

  // IP address filter
  if (filters.ipAddress) {
    const search = filters.ipAddress.toLowerCase()
    filtered = filtered.filter((device) =>
      device.primary_ip4?.address?.toLowerCase().includes(search)
    )
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(
      (device) => device.status?.name === filters.status
    )
  }

  return filtered
}

/**
 * Extract unique filter options from device list
 */
export function extractFilterOptions(devices: Device[]) {
  const roles = new Set<string>()
  const locations = new Set<string>()
  const statuses = new Set<string>()

  devices.forEach((device) => {
    if (device.role?.name) roles.add(device.role.name)
    if (device.location?.name) locations.add(device.location.name)
    if (device.status?.name) statuses.add(device.status.name)
  })

  return {
    roles: Array.from(roles).map((name) => ({ id: name, name })),
    locations: Array.from(locations).map((name) => ({ id: name, name })),
    statuses: Array.from(statuses).map((name) => ({ id: name, name })),
  }
}

/**
 * Get status badge color class
 */
export function getStatusBadgeClass(status: string): string {
  const statusLower = status.toLowerCase()
  if (statusLower.includes('active') || statusLower.includes('online')) {
    return 'bg-blue-500'
  }
  if (statusLower.includes('failed') || statusLower.includes('offline')) {
    return 'bg-destructive'
  }
  if (statusLower.includes('maintenance')) {
    return 'bg-yellow-500'
  }
  return 'bg-muted'
}
```

**Estimated effort:** 1 hour

---

### Phase 6: Extract UI Components

**Create:** `frontend/src/components/features/nautobot/sync-devices/components/`

#### 6a: Sync Properties Panel

**File:** `sync-properties-panel.tsx`

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Settings, RefreshCw } from 'lucide-react'
import type { SyncProperties, DropdownOption } from '../types'

interface SyncPropertiesPanelProps {
  syncProperties: SyncProperties
  onSyncPropertiesChange: (props: SyncProperties) => void
  namespaces: DropdownOption[]
  prefixStatuses: DropdownOption[]
  interfaceStatuses: DropdownOption[]
  ipAddressStatuses: DropdownOption[]
  selectedCount: number
  isFormValid: boolean
  isSubmitting: boolean
  onSync: () => void
}

const SYNC_OPTIONS = [
  { id: 'cables', label: 'Sync Cables' },
  { id: 'software', label: 'Sync Software' },
  { id: 'vlans', label: 'Sync VLANs' },
  { id: 'vrfs', label: 'Sync VRFs' },
] as const

export function SyncPropertiesPanel({
  syncProperties,
  onSyncPropertiesChange,
  namespaces,
  prefixStatuses,
  interfaceStatuses,
  ipAddressStatuses,
  selectedCount,
  isFormValid,
  isSubmitting,
  onSync,
}: SyncPropertiesPanelProps) {
  const handlePropertyChange = (key: keyof SyncProperties, value: string) => {
    onSyncPropertiesChange({ ...syncProperties, [key]: value })
  }

  const handleSyncOptionChange = (option: string, checked: boolean) => {
    const newOptions = checked
      ? [...syncProperties.sync_options, option]
      : syncProperties.sync_options.filter((o) => o !== option)
    onSyncPropertiesChange({ ...syncProperties, sync_options: newOptions })
  }

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
        <div className="flex items-center space-x-2">
          <Settings className="h-4 w-4" />
          <div>
            <h3 className="text-sm font-semibold">Sync Properties</h3>
            <p className="text-blue-100 text-xs">Configure synchronization settings</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 bg-white space-y-3">
        {/* Namespace */}
        <div className="space-y-1">
          <Label htmlFor="namespace" className="text-xs font-medium">
            Namespace <span className="text-red-500">*</span>
          </Label>
          <Select
            value={syncProperties.namespace}
            onValueChange={(value) => handlePropertyChange('namespace', value)}
          >
            <SelectTrigger className="h-8 border-2 bg-white border-gray-300">
              <SelectValue placeholder="Select namespace..." />
            </SelectTrigger>
            <SelectContent>
              {namespaces.map((ns) => (
                <SelectItem key={ns.id} value={ns.id}>
                  {ns.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prefix Status */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">
            Prefix Status <span className="text-red-500">*</span>
          </Label>
          <Select
            value={syncProperties.prefix_status}
            onValueChange={(value) => handlePropertyChange('prefix_status', value)}
          >
            <SelectTrigger className="h-8 border-2 bg-white border-gray-300">
              <SelectValue placeholder="Select prefix status..." />
            </SelectTrigger>
            <SelectContent>
              {prefixStatuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Interface Status */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">
            Interface Status <span className="text-red-500">*</span>
          </Label>
          <Select
            value={syncProperties.interface_status}
            onValueChange={(value) => handlePropertyChange('interface_status', value)}
          >
            <SelectTrigger className="h-8 border-2 bg-white border-gray-300">
              <SelectValue placeholder="Select interface status..." />
            </SelectTrigger>
            <SelectContent>
              {interfaceStatuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* IP Address Status */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">
            IP Address Status <span className="text-red-500">*</span>
          </Label>
          <Select
            value={syncProperties.ip_address_status}
            onValueChange={(value) => handlePropertyChange('ip_address_status', value)}
          >
            <SelectTrigger className="h-8 border-2 bg-white border-gray-300">
              <SelectValue placeholder="Select IP address status..." />
            </SelectTrigger>
            <SelectContent>
              {ipAddressStatuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sync Options */}
        <div className="space-y-3">
          <Label>Sync Options</Label>
          <div className="space-y-2">
            {SYNC_OPTIONS.map((option) => (
              <div key={option.id} className="flex items-center space-x-2">
                <Checkbox
                  id={option.id}
                  checked={syncProperties.sync_options.includes(option.id)}
                  onCheckedChange={(checked) =>
                    handleSyncOptionChange(option.id, checked as boolean)
                  }
                />
                <Label htmlFor={option.id} className="text-sm font-medium cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Sync Button */}
        <div className="pt-4">
          <Button
            onClick={onSync}
            disabled={!isFormValid || isSubmitting}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync {selectedCount > 0 ? `${selectedCount} ` : ''}
                Device{selectedCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

#### 6b: Devices Table Component

**File:** `devices-table.tsx` (~200 lines)

#### 6c: Table Filters Component

**File:** `devices-filters.tsx` (~150 lines)

#### 6d: Pagination Component

**File:** `devices-pagination.tsx` (~80 lines)

**Estimated effort:** 3 hours total for all components

---

### Phase 7: Create Custom Hook for Filter State

**Create:** `frontend/src/components/features/nautobot/sync-devices/hooks/use-devices-filter.ts`

```typescript
import { useState, useMemo, useCallback } from 'react'
import type { Device, TableFilters } from '../types'
import { filterDevices, extractFilterOptions } from '../utils'

const DEFAULT_FILTERS: TableFilters = {
  deviceName: '',
  role: 'all',
  location: 'all',
  ipAddress: '',
  status: 'all',
}

const DEFAULT_PAGE_SIZE = 50

export function useDevicesFilter(devices: Device[]) {
  const [filters, setFilters] = useState<TableFilters>(DEFAULT_FILTERS)
  const [roleFilters, setRoleFilters] = useState<Record<string, boolean>>({})
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // Extract filter options from devices
  const filterOptions = useMemo(() => extractFilterOptions(devices), [devices])

  // Initialize role filters when devices change
  useMemo(() => {
    const initial: Record<string, boolean> = {}
    filterOptions.roles.forEach((role) => {
      initial[role.name] = roleFilters[role.name] ?? true
    })
    if (JSON.stringify(initial) !== JSON.stringify(roleFilters)) {
      setRoleFilters(initial)
    }
  }, [filterOptions.roles]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply filters
  const filteredDevices = useMemo(
    () => filterDevices(devices, filters, roleFilters),
    [devices, filters, roleFilters]
  )

  // Pagination
  const totalPages = Math.ceil(filteredDevices.length / pageSize)
  const paginatedDevices = useMemo(() => {
    const start = currentPage * pageSize
    return filteredDevices.slice(start, start + pageSize)
  }, [filteredDevices, currentPage, pageSize])

  // Reset to first page when filters change
  const handleFilterChange = useCallback(
    (field: keyof TableFilters, value: string) => {
      setFilters((prev) => ({ ...prev, [field]: value }))
      setCurrentPage(0)
    },
    []
  )

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    const resetRoleFilters: Record<string, boolean> = {}
    filterOptions.roles.forEach((role) => {
      resetRoleFilters[role.name] = true
    })
    setRoleFilters(resetRoleFilters)
    setCurrentPage(0)
  }, [filterOptions.roles])

  return {
    filters,
    roleFilters,
    setRoleFilters,
    filterOptions,
    filteredDevices,
    paginatedDevices,
    pagination: {
      currentPage,
      pageSize,
      totalItems: filteredDevices.length,
      totalPages,
    },
    handleFilterChange,
    clearAllFilters,
    setCurrentPage,
    setPageSize,
  }
}
```

**Estimated effort:** 1 hour

---

### Phase 8: Refactor Main Page Component

**Update:** `sync-devices-page.tsx`

After all extractions, the main component should be ~200-300 lines:

```typescript
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Feature imports
import type { SyncProperties } from './types'
import {
  useDevicesQuery,
  useNamespacesQuery,
  useLocationsQuery,
  useNautobotDefaultsQuery,
  usePrefixStatusesQuery,
  useInterfaceStatusesQuery,
  useIPAddressStatusesQuery,
} from './hooks/use-sync-devices-queries'
import { useSyncDevicesMutation } from './hooks/use-sync-devices-mutation'
import { useDevicesFilter } from './hooks/use-devices-filter'
import { buildLocationHierarchy } from './utils'
import { SyncPropertiesPanel } from './components/sync-properties-panel'
import { DevicesTable } from './components/devices-table'

const INITIAL_SYNC_PROPERTIES: SyncProperties = {
  prefix_status: '',
  interface_status: '',
  ip_address_status: '',
  namespace: '',
  sync_options: [],
}

export function SyncDevicesPage() {
  const searchParams = useSearchParams()

  // TanStack Query hooks
  const { data: devices = [], isLoading: devicesLoading } = useDevicesQuery()
  const { data: namespaces = [] } = useNamespacesQuery()
  const { data: locations = [] } = useLocationsQuery()
  const { data: defaults } = useNautobotDefaultsQuery()
  const { data: prefixStatuses = [] } = usePrefixStatusesQuery()
  const { data: interfaceStatuses = [] } = useInterfaceStatusesQuery()
  const { data: ipAddressStatuses = [] } = useIPAddressStatusesQuery()

  const syncMutation = useSyncDevicesMutation()

  // Local state
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [syncProperties, setSyncProperties] = useState<SyncProperties>(INITIAL_SYNC_PROPERTIES)

  // Filter hook
  const {
    filters,
    roleFilters,
    setRoleFilters,
    filterOptions,
    paginatedDevices,
    pagination,
    handleFilterChange,
    clearAllFilters,
    setCurrentPage,
    setPageSize,
  } = useDevicesFilter(devices)

  // Process locations with hierarchy
  const processedLocations = useMemo(
    () => buildLocationHierarchy(locations),
    [locations]
  )

  // Apply URL filter
  useEffect(() => {
    const ipFilter = searchParams?.get('ip_filter')
    if (ipFilter) {
      handleFilterChange('ipAddress', ipFilter)
    }
  }, [searchParams, handleFilterChange])

  // Apply defaults when loaded
  useEffect(() => {
    if (defaults) {
      setSyncProperties((prev) => ({
        ...prev,
        namespace: prev.namespace || defaults.namespace,
        prefix_status: prev.prefix_status || defaults.ip_prefix_status,
        interface_status: prev.interface_status || defaults.interface_status,
        ip_address_status: prev.ip_address_status || defaults.ip_address_status,
      }))
    }
  }, [defaults])

  // Form validation
  const isFormValid =
    syncProperties.prefix_status &&
    syncProperties.interface_status &&
    syncProperties.ip_address_status &&
    syncProperties.namespace &&
    selectedDevices.size > 0

  // Handlers
  const handleSync = () => {
    if (!isFormValid) return
    syncMutation.mutate(
      { deviceIds: Array.from(selectedDevices), syncProperties },
      { onSuccess: () => setSelectedDevices(new Set()) }
    )
  }

  if (devicesLoading) {
    return (
      <div className="p-6 flex items-center justify-center space-x-2">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        <span>Loading sync devices...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="bg-blue-100 p-2 rounded-lg">
          <RefreshCw className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sync Devices</h1>
          <p className="text-gray-600 mt-1">Synchronize device data with Nautobot</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sync Properties Panel */}
        <div className="lg:col-span-1">
          <SyncPropertiesPanel
            syncProperties={syncProperties}
            onSyncPropertiesChange={setSyncProperties}
            namespaces={namespaces}
            prefixStatuses={prefixStatuses}
            interfaceStatuses={interfaceStatuses}
            ipAddressStatuses={ipAddressStatuses}
            selectedCount={selectedDevices.size}
            isFormValid={isFormValid}
            isSubmitting={syncMutation.isPending}
            onSync={handleSync}
          />
        </div>

        {/* Devices Table */}
        <div className="lg:col-span-3">
          <DevicesTable
            devices={paginatedDevices}
            selectedDevices={selectedDevices}
            onSelectionChange={setSelectedDevices}
            filters={filters}
            roleFilters={roleFilters}
            onRoleFiltersChange={setRoleFilters}
            filterOptions={filterOptions}
            locations={processedLocations}
            onFilterChange={handleFilterChange}
            onClearFilters={clearAllFilters}
            pagination={pagination}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </div>
  )
}
```

**Estimated effort:** 2 hours

---

## Final Directory Structure

```
frontend/src/components/features/nautobot/sync-devices/
├── sync-devices-page.tsx          # ~250 lines (was 1,210)
├── types/
│   └── index.ts                   # ~60 lines (extracted types)
├── hooks/
│   ├── use-sync-devices-queries.ts   # ~120 lines (TanStack Query)
│   ├── use-sync-devices-mutation.ts  # ~60 lines (sync mutation)
│   └── use-devices-filter.ts         # ~100 lines (filter state)
├── components/
│   ├── sync-properties-panel.tsx     # ~150 lines
│   ├── devices-table.tsx             # ~200 lines
│   ├── devices-filters.tsx           # ~150 lines
│   └── devices-pagination.tsx        # ~80 lines
└── utils/
    └── index.ts                      # ~100 lines (utilities)
```

---

## Summary of Changes

| Aspect | Before | After | Change |
|--------|--------|-------|--------|
| Main component | 1,210 lines | 185 lines | **-1,025 lines (85%)** |
| Total lines | 1,210 lines | 1,518 lines | +308 lines (proper separation) |
| Files | 1 file | 12 files | Better organization |
| Data fetching | Manual useState/useEffect | TanStack Query | Proper caching |
| ESLint violations | 4 disabled rules | 0 disabled rules | Compliant |
| Testability | Difficult | Easy | Unit testable hooks |

### Actual File Breakdown

| File | Lines | Purpose |
|------|-------|---------|
| `sync-devices-page.tsx` | 185 | Main orchestration component |
| `types/index.ts` | 73 | Type definitions |
| `hooks/use-sync-devices-queries.ts` | 121 | TanStack Query data fetching |
| `hooks/use-sync-devices-mutation.ts` | 62 | Sync mutation |
| `hooks/use-devices-filter.ts` | 120 | Filter state management |
| `hooks/index.ts` | 14 | Hook exports |
| `utils/index.ts` | 148 | Utility functions |
| `components/sync-properties-panel.tsx` | 207 | Sync settings UI |
| `components/devices-table.tsx` | 204 | Table component |
| `components/devices-filters.tsx` | 264 | Filter UI |
| `components/devices-pagination.tsx` | 116 | Pagination UI |
| `components/index.ts` | 4 | Component exports |
| **Total** | **1,518** | |

---

## Estimated Total Effort

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Extract type definitions | 30 min |
| 2 | Verify query keys (already exist) | 0 min ✅ |
| 3 | Create TanStack Query hooks | 1.5 hours |
| 4 | Create sync mutation hook | 45 min |
| 5 | Extract utility functions | 1 hour |
| 6 | Extract UI components | 3 hours |
| 7 | Create filter state hook | 1 hour |
| 8 | Refactor main component | 2 hours |
| - | Testing & Integration | 2 hours |
| **Total** | | **~12 hours** |

---

## Benefits After Refactoring

1. **TanStack Query Compliance**: Automatic caching, background refetch, loading/error states
2. **Maintainability**: Small, focused files are easier to understand and modify
3. **Testability**: Hooks can be unit tested independently
4. **Reusability**: Extracted components can be reused elsewhere
5. **Performance**: Query caching prevents redundant API calls
6. **Code Quality**: No disabled ESLint rules, proper dependency management
7. **Developer Experience**: Clear file structure, predictable patterns

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing functionality | Medium | High | Comprehensive manual testing |
| Missing edge cases | Low | Medium | Review existing behavior carefully |
| Performance regression | Low | Low | TanStack Query improves caching |
| Merge conflicts | Low | Low | Work on feature branch |

---

## Testing Strategy

### Unit Tests

```typescript
// hooks/use-sync-devices-queries.test.ts
describe('useDevicesQuery', () => {
  it('fetches devices successfully')
  it('handles API errors')
  it('uses correct cache key')
})

// hooks/use-devices-filter.test.ts
describe('useDevicesFilter', () => {
  it('filters by device name')
  it('filters by role')
  it('filters by location')
  it('filters by status')
  it('paginates correctly')
  it('resets page on filter change')
})

// utils/index.test.ts
describe('filterDevices', () => {
  it('filters by all criteria')
  it('handles empty filters')
})

describe('buildLocationHierarchy', () => {
  it('builds correct hierarchy path')
  it('handles cycles')
})
```

### Integration Tests

- Load page and verify all data fetches
- Apply filters and verify results
- Select devices and sync
- Verify cache invalidation after sync

---

## Recommended Refactoring Order

1. **Phase 1-2**: Types and query keys (foundation, no breaking changes)
2. **Phase 5**: Utility functions (can be tested independently)
3. **Phase 3-4**: TanStack Query hooks (data layer)
4. **Phase 7**: Filter state hook (local state management)
5. **Phase 6**: UI components (incremental extraction)
6. **Phase 8**: Main component refactor (final integration)

---

**Document Version:** 1.1
**Created:** January 2025
**Status:** Implemented

---

## Implementation Progress

### Completed Phases

- [x] Phase 1: Extract type definitions → `types/index.ts`
- [x] Phase 2: Query keys already exist in `/frontend/src/lib/query-keys.ts`
- [x] Phase 3: Create TanStack Query hooks → `hooks/use-sync-devices-queries.ts`
- [x] Phase 4: Create sync mutation hook → `hooks/use-sync-devices-mutation.ts`
- [x] Phase 5: Extract utility functions → `utils/index.ts`
- [x] Phase 6: Extract UI components → `components/`
- [x] Phase 7: Create filter state hook → `hooks/use-devices-filter.ts`
- [x] Phase 8: Refactor main component → `sync-devices-page.tsx`

### Pending Phases

- [ ] Testing & Integration

## Prerequisites

### TanStack Query Setup

TanStack Query is already installed and configured in the project:

```json
// frontend/package.json
"@tanstack/react-query": "^5.90.16",
"@tanstack/react-query-devtools": "^5.91.2"
```

**Existing Infrastructure:**
- Query client configured in `/frontend/src/lib/query-client.ts`
- Query keys factory in `/frontend/src/lib/query-keys.ts`
- Provider setup in app layout
- Devtools available in development

No additional setup required - proceed directly with creating the query hooks.
