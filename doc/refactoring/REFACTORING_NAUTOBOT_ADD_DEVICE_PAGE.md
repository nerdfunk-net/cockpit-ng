# Add Device Page Refactoring Plan (UPDATED)

> [!IMPORTANT]
> **REFACTORING COMPLETED** ✅
>
> This application has been successfully refactored according to the plan outlined in this document. The refactoring included:
> - Migration from manual state management to TanStack Query for all data fetching
> - Implementation of react-hook-form with Zod validation for type-safe form handling
> - Component extraction following single responsibility principle
> - Creation of custom hooks with proper memoization to prevent infinite loops
> - Comprehensive styling updates matching the Inventory app design system
> - All TypeScript and ESLint errors resolved
> - Full documentation of linter exceptions and architectural decisions
>
> **Date Completed:** January 2026
>
> The sections below document the original refactoring plan and implementation strategy for future reference.

---

**File:** `src/components/features/nautobot/add-device/add-device-page.tsx`
**Current Size:** 2,046 lines
**Target Size:** ~300-350 lines (main orchestrator)
**Priority:** CRITICAL ⚠️
**Estimated Effort:** 4-5 days
**Architecture:** TanStack Query + react-hook-form + Zod

---

## ⚠️ IMPORTANT: Architectural Requirements

This refactoring **MUST** follow these codebase standards:

1. **TanStack Query for ALL data fetching** - No manual `useState + useEffect`
2. **react-hook-form + Zod for validation** - Type-safe form validation
3. **Query key factory** - Centralized in `/lib/query-keys.ts`
4. **Mutation hooks** - For all write operations
5. **React Best Practices** - Memoized returns, stable constants
6. **Feature-based organization** - `/hooks/queries/` for TanStack hooks

---

## Current State Analysis

### Complexity Metrics
- **49 useState hooks** - Extreme state management complexity
- **9 useEffect hooks** - Multiple side effects (ANTI-PATTERN)
- **15 useCallback hooks** - Heavy memoization needs
- **2 useMemo hooks**
- **11+ inline interface definitions**
- **Total Hooks:** 75 (Target: < 10 per component)

### Architectural Violations

❌ **Manual data fetching** - All API calls use `useState + useEffect`
❌ **No form library** - Manual field state management
❌ **Manual validation** - No schema validation
❌ **No query caching** - Data refetched on every mount
❌ **No mutation hooks** - Form submission uses raw fetch
❌ **Non-memoized hook returns** - Causes infinite loops

### Responsibilities Identified

The current component handles:
1. **Device Form Management** - Basic device fields (name, role, status, location, device type, platform, software version, serial)
2. **Interface Management** - Dynamic array of interfaces with full CRUD operations
3. **Dropdown Data Loading** - Multiple API calls for roles, statuses, locations, device types, platforms, software versions, interface types, namespaces
4. **Search/Filter Logic** - Custom searchable dropdowns for locations, device types, and software versions
5. **Modal Management** - Properties modal, Tags modal, Custom Fields modal
6. **CSV Import Integration** - Already extracted to hook but requires callback
7. **Form Validation** - Complex validation logic
8. **Form Submission** - API calls and workflow status handling
9. **Prefix Configuration** - IP prefix settings
10. **VLAN Management** - Loading and selecting VLANs for interfaces
11. **Tags Management** - Loading and selecting device tags
12. **Custom Fields Management** - Loading and managing custom fields
13. **Defaults Application** - Applying Nautobot defaults

### Existing Modular Structure

✅ **Already Extracted:**
- `components/csv-upload-modal.tsx` (790 lines)
- `components/bulk-update-modal.tsx` (507 lines)
- `hooks/use-csv-upload.ts` (571 lines)
- `types.ts` (175 lines)

---

## Refactoring Strategy

### Phase 0: Query Keys Setup (Day 1, Morning - START HERE)
**Estimated Time:** 1 hour
**CRITICAL:** Must be done before any other work

#### 0.1 Update `/frontend/src/lib/query-keys.ts`

Add Nautobot query keys to the centralized factory:

```typescript
// lib/query-keys.ts - Add to existing file
export const queryKeys = {
  // ... existing keys ...

  nautobot: {
    all: ['nautobot'] as const,

    // Dropdown data (static-ish, cache for 5 minutes)
    dropdowns: () => [...queryKeys.nautobot.all, 'dropdowns'] as const,
    roles: () => [...queryKeys.nautobot.all, 'roles'] as const,
    statuses: (type: string) => [...queryKeys.nautobot.all, 'statuses', type] as const,
    locations: () => [...queryKeys.nautobot.all, 'locations'] as const,
    deviceTypes: () => [...queryKeys.nautobot.all, 'device-types'] as const,
    platforms: () => [...queryKeys.nautobot.all, 'platforms'] as const,
    softwareVersions: () => [...queryKeys.nautobot.all, 'software-versions'] as const,
    interfaceTypes: () => [...queryKeys.nautobot.all, 'interface-types'] as const,
    namespaces: () => [...queryKeys.nautobot.all, 'namespaces'] as const,
    defaults: () => [...queryKeys.nautobot.all, 'defaults'] as const,

    // Dynamic data (short cache or no cache)
    tags: (contentType: string) => [...queryKeys.nautobot.all, 'tags', contentType] as const,
    customFields: (contentType: string) => [...queryKeys.nautobot.all, 'custom-fields', contentType] as const,
    customFieldChoices: (fieldKey: string) => [...queryKeys.nautobot.all, 'custom-field-choices', fieldKey] as const,
    vlans: (filters?: { location?: string; global?: boolean }) =>
      filters
        ? [...queryKeys.nautobot.all, 'vlans', filters] as const
        : [...queryKeys.nautobot.all, 'vlans'] as const,
  },
} as const
```

**Why this matters:**
- Type-safe query keys prevent typos
- Centralized invalidation (e.g., `queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.all })`)
- Hierarchical structure enables partial invalidation

---

### Phase 1: Type Extraction & Constants (Day 1, Morning)
**Estimated Time:** 2 hours

#### 1.1 Move Inline Interfaces to `types.ts`

Extract these interfaces from the main file:

```typescript
// types.ts - Add to existing file
export interface DropdownOption {
  id: string
  name: string
  display?: string
  value?: string
}

export interface DeviceType {
  id: string
  model: string
  manufacturer: {
    id: string
    name?: string
    display?: string
  }
  display?: string
}

export interface Platform {
  id: string
  name: string
  display?: string
}

export interface SoftwareVersion {
  id: string
  version: string
  platform?: {
    id: string
    name?: string
  }
  display?: string
}

export interface LocationItem {
  id: string
  name: string
  parent?: {
    id: string
    name?: string
  }
  display?: string
  hierarchicalPath?: string  // Computed field
}

export interface VlanItem {
  id: string
  vid: number
  name: string
  display?: string
  location?: {
    id: string
    name?: string
  }
}

export interface InterfaceData {
  id: string
  name: string
  type: string
  status: string
  ip_address: string
  namespace: string
  enabled?: boolean
  mgmt_only?: boolean
  mac_address?: string
  mtu?: number
  description?: string
  mode?: string
  untagged_vlan?: string
  tagged_vlans?: string[]
  parent_interface?: string
  bridge?: string
  lag?: string
  tags?: string
  is_primary?: boolean
}

export interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

export interface TagItem {
  id: string
  name: string
  color?: string
  display?: string
}

export interface CustomField {
  key: string
  label: string
  type?: {
    value: string
    label: string
  }
  required?: boolean
  default?: any
}

export interface NautobotDefaults {
  device_role: string
  device_status: string
  location: string
  platform: string
  interface_status: string
  namespace: string
}

// Response types for TanStack Query
export interface NautobotDropdownsResponse {
  roles: DropdownOption[]
  statuses: DropdownOption[]
  locations: LocationItem[]
  deviceTypes: DeviceType[]
  platforms: Platform[]
  softwareVersions: SoftwareVersion[]
  interfaceTypes: DropdownOption[]
  interfaceStatuses: DropdownOption[]
  namespaces: DropdownOption[]
  nautobotDefaults: NautobotDefaults | null
}

export interface DeviceSubmissionData {
  name: string
  serial?: string
  role: string
  status: string
  location: string
  device_type: string
  platform?: string
  software_version?: string
  tags?: string[]
  custom_fields?: Record<string, string>
  interfaces: InterfaceData[]
  add_prefix: boolean
  default_prefix_length: string
}

export interface DeviceSubmissionResult {
  success: boolean
  message: string
  messageType: 'success' | 'error' | 'warning'
  deviceId?: string
  summary?: {
    interfaces_created: number
    ip_addresses_created: number
  }
}
```

#### 1.2 Create `constants.ts`

**CRITICAL:** Use constants outside components to prevent re-render loops

```typescript
// constants.ts
import type { DropdownOption, DeviceType, LocationItem, SoftwareVersion, Platform, InterfaceData } from './types'

// Empty arrays (used as default parameters)
export const EMPTY_DROPDOWN_OPTIONS: DropdownOption[] = []
export const EMPTY_DEVICE_TYPES: DeviceType[] = []
export const EMPTY_LOCATIONS: LocationItem[] = []
export const EMPTY_SOFTWARE_VERSIONS: SoftwareVersion[] = []
export const EMPTY_PLATFORMS: Platform[] = []
export const EMPTY_INTERFACES: InterfaceData[] = []
export const EMPTY_STRING_ARRAY: string[] = []
export const EMPTY_OBJECT: Record<string, string> = {}

// Default interface template
export const DEFAULT_INTERFACE: Omit<InterfaceData, 'id'> = {
  name: '',
  type: '',
  status: '',
  ip_address: '',
  namespace: '',
  enabled: true,
  mgmt_only: false,
  is_primary: false,
} as const

// Prefix length options
export const PREFIX_LENGTH_OPTIONS = [
  '/8', '/16', '/24', '/25', '/26', '/27', '/28', '/29', '/30', '/31', '/32'
] as const

// VLAN mode options
export const VLAN_MODES = [
  { value: '', label: 'None' },
  { value: 'access', label: 'Access' },
  { value: 'tagged', label: 'Tagged' },
  { value: 'tagged-all', label: 'Tagged All' },
] as const

// TanStack Query options
export const QUERY_STALE_TIMES = {
  STATIC: 5 * 60 * 1000,      // 5 minutes for mostly static data
  SEMI_STATIC: 2 * 60 * 1000, // 2 minutes for semi-static
  DYNAMIC: 30 * 1000,          // 30 seconds for dynamic
  REALTIME: 0,                 // No cache for real-time data
} as const
```

---

### Phase 2: TanStack Query Hooks (Day 1, Afternoon - Day 2, Morning)
**Estimated Time:** 6-7 hours

#### 2.1 Create `/hooks/queries/use-nautobot-dropdowns-query.ts`

**Purpose:** Fetch all dropdown data with TanStack Query
**Complexity Reduction:** Removes 10 state variables, 1 useEffect, all loading logic

```typescript
// hooks/queries/use-nautobot-dropdowns-query.ts
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES } from '../../constants'
import type { NautobotDropdownsResponse } from '../../types'

interface UseNautobotDropdownsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNautobotDropdownsQueryOptions = {
  enabled: true,
}

/**
 * Fetches all Nautobot dropdown data in parallel
 * Cached for 5 minutes (static data)
 */
export function useNautobotDropdownsQuery(
  options: UseNautobotDropdownsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobot.dropdowns(),
    queryFn: async (): Promise<NautobotDropdownsResponse> => {
      // Parallel API calls for all dropdown data
      const [
        roles,
        statuses,
        locations,
        deviceTypes,
        platforms,
        softwareVersions,
        interfaceTypes,
        interfaceStatuses,
        namespaces,
        nautobotDefaults,
      ] = await Promise.all([
        apiCall('nautobot/roles', { method: 'GET' }),
        apiCall('nautobot/statuses/device', { method: 'GET' }),
        apiCall('nautobot/locations', { method: 'GET' }),
        apiCall('nautobot/device-types', { method: 'GET' }),
        apiCall('nautobot/platforms', { method: 'GET' }),
        apiCall('nautobot/software-versions', { method: 'GET' }),
        apiCall('nautobot/interface-types', { method: 'GET' }),
        apiCall('nautobot/statuses/interface', { method: 'GET' }),
        apiCall('nautobot/namespaces', { method: 'GET' }),
        apiCall('nautobot/defaults', { method: 'GET' }).catch(() => null),
      ])

      return {
        roles: roles || [],
        statuses: statuses || [],
        locations: locations || [],
        deviceTypes: deviceTypes || [],
        platforms: platforms || [],
        softwareVersions: softwareVersions || [],
        interfaceTypes: interfaceTypes || [],
        interfaceStatuses: interfaceStatuses || [],
        namespaces: namespaces || [],
        nautobotDefaults,
      }
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.STATIC,
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  })
}
```

**State Removed from Main Component:**
- `roles`, `statuses`, `locations`, `deviceTypes`, `platforms`, `softwareVersions`
- `interfaceTypes`, `interfaceStatuses`, `namespaces`, `nautobotDefaults`
- `isLoadingData`

---

#### 2.2 Create `/hooks/queries/use-tags-query.ts`

**Purpose:** Fetch device tags on-demand (modal open)
**Complexity Reduction:** Removes tags loading state and logic

```typescript
// hooks/queries/use-tags-query.ts
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES } from '../../constants'
import type { TagItem } from '../../types'

interface UseTagsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseTagsQueryOptions = {
  enabled: false, // Only fetch when modal is open
}

export function useTagsQuery(options: UseTagsQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = false } = options

  return useQuery({
    queryKey: queryKeys.nautobot.tags('devices'),
    queryFn: async (): Promise<TagItem[]> => {
      const data = await apiCall<TagItem[]>('nautobot/tags/devices', { method: 'GET' })
      return data || []
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.SEMI_STATIC,
  })
}
```

---

#### 2.3 Create `/hooks/queries/use-custom-fields-query.ts`

**Purpose:** Fetch custom fields on-demand (modal open)

```typescript
// hooks/queries/use-custom-fields-query.ts
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES } from '../../constants'
import type { CustomField } from '../../types'

interface UseCustomFieldsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCustomFieldsQueryOptions = {
  enabled: false,
}

export function useCustomFieldsQuery(
  options: UseCustomFieldsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = false } = options

  return useQuery({
    queryKey: queryKeys.nautobot.customFields('devices'),
    queryFn: async (): Promise<CustomField[]> => {
      const data = await apiCall<CustomField[]>('nautobot/custom-fields/devices', { method: 'GET' })
      return data || []
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.SEMI_STATIC,
  })
}

// Separate query for custom field choices
export function useCustomFieldChoicesQuery(fieldKey: string, enabled = false) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.nautobot.customFieldChoices(fieldKey),
    queryFn: async (): Promise<string[]> => {
      const data = await apiCall<string[]>(`nautobot/custom-field-choices/${fieldKey}`, { method: 'GET' })
      return data || []
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.SEMI_STATIC,
  })
}
```

---

#### 2.4 Create `/hooks/queries/use-vlans-query.ts`

**Purpose:** Fetch VLANs for a specific location

```typescript
// hooks/queries/use-vlans-query.ts
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES } from '../../constants'
import type { VlanItem } from '../../types'

interface UseVlansQueryOptions {
  locationName?: string
  includeGlobal?: boolean
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseVlansQueryOptions = {
  includeGlobal: true,
  enabled: false,
}

export function useVlansQuery(options: UseVlansQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { locationName, includeGlobal = true, enabled = false } = options

  return useQuery({
    queryKey: queryKeys.nautobot.vlans({ location: locationName, global: includeGlobal }),
    queryFn: async (): Promise<VlanItem[]> => {
      let url = 'nautobot/vlans'
      const params = new URLSearchParams()

      if (includeGlobal) {
        params.append('get_global_vlans', 'true')
      }
      if (locationName) {
        params.append('location', locationName)
      }

      const queryString = params.toString()
      const fullUrl = queryString ? `${url}?${queryString}` : url

      const data = await apiCall<VlanItem[]>(fullUrl, { method: 'GET' })
      return data || []
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.DYNAMIC,
  })
}
```

---

#### 2.5 Create `/hooks/queries/use-device-mutations.ts`

**Purpose:** Device submission with TanStack Query mutations
**CRITICAL:** Replaces manual fetch in handleSubmit

```typescript
// hooks/queries/use-device-mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { DeviceSubmissionData, DeviceSubmissionResult } from '../../types'

export function useDeviceMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createDevice = useMutation({
    mutationFn: async (data: DeviceSubmissionData): Promise<DeviceSubmissionResult> => {
      try {
        const response = await apiCall('nautobot/add-device', {
          method: 'POST',
          body: JSON.stringify(data),
        })

        // Parse workflow result
        const workflowStatus = response.workflow_status
        const summary = response.summary

        const statusMessages: string[] = []
        let hasErrors = false
        let hasWarnings = false

        // Device creation
        if (workflowStatus?.create_device === 'SUCCESS') {
          statusMessages.push(`✓ Device "${data.name}" created successfully`)
        } else if (workflowStatus?.create_device === 'FAILURE') {
          statusMessages.push(`✗ Failed to create device "${data.name}"`)
          hasErrors = true
        }

        // Interfaces
        if (summary?.interfaces_created > 0) {
          statusMessages.push(`✓ Created ${summary.interfaces_created} interface(s)`)
        } else if (data.interfaces.length > 0) {
          statusMessages.push(`⚠ No interfaces were created`)
          hasWarnings = true
        }

        // IP addresses
        if (summary?.ip_addresses_created > 0) {
          statusMessages.push(`✓ Created ${summary.ip_addresses_created} IP address(es)`)
        }

        return {
          success: !hasErrors,
          message: statusMessages.join('\n'),
          messageType: hasErrors ? 'error' : hasWarnings ? 'warning' : 'success',
          deviceId: response.device_id,
          summary,
        }
      } catch (error) {
        return {
          success: false,
          message: `Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          messageType: 'error',
        }
      }
    },
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.all })

        toast({
          title: 'Success',
          description: result.message,
        })
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        })
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return { createDevice }
}
```

---

### Phase 3: Form Management with react-hook-form + Zod (Day 2, Afternoon)
**Estimated Time:** 4-5 hours

#### 3.1 Create `validation.ts`

**Purpose:** Zod schemas for type-safe validation
**Replaces:** Manual validation function

```typescript
// validation.ts
import { z } from 'zod'

// Interface schema
export const interfaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Interface name is required'),
  type: z.string().min(1, 'Interface type is required'),
  status: z.string().min(1, 'Interface status is required'),
  ip_address: z.string().refine((val) => {
    if (!val.trim()) return true // Allow empty
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
    return ipPattern.test(val.trim())
  }, 'Invalid IP address format (use x.x.x.x or x.x.x.x/mask)'),
  namespace: z.string().refine((val, ctx) => {
    const ipAddress = ctx.parent?.ip_address
    if (ipAddress && ipAddress.trim() && !val) {
      return false // Namespace required when IP is provided
    }
    return true
  }, 'Namespace is required when IP address is provided'),
  enabled: z.boolean().optional(),
  mgmt_only: z.boolean().optional(),
  mac_address: z.string().optional(),
  mtu: z.number().optional(),
  description: z.string().optional(),
  mode: z.string().optional(),
  untagged_vlan: z.string().optional(),
  tagged_vlans: z.array(z.string()).optional(),
  parent_interface: z.string().optional(),
  bridge: z.string().optional(),
  lag: z.string().optional(),
  tags: z.string().optional(),
  is_primary: z.boolean().optional(),
})

// Device form schema
export const deviceFormSchema = z.object({
  deviceName: z.string().min(1, 'Device name is required'),
  serialNumber: z.string().optional(),
  selectedRole: z.string().min(1, 'Device role is required'),
  selectedStatus: z.string().min(1, 'Device status is required'),
  selectedLocation: z.string().min(1, 'Location is required'),
  selectedDeviceType: z.string().min(1, 'Device type is required'),
  selectedPlatform: z.string().optional(),
  selectedSoftwareVersion: z.string().optional(),
  selectedTags: z.array(z.string()).default([]),
  customFieldValues: z.record(z.string()).default({}),
  addPrefix: z.boolean().default(true),
  defaultPrefixLength: z.string().default('/24'),
  interfaces: z.array(interfaceSchema).min(1, 'At least one interface is required'),
})

// Infer TypeScript types from schemas
export type DeviceFormValues = z.infer<typeof deviceFormSchema>
export type InterfaceFormValues = z.infer<typeof interfaceSchema>
```

---

#### 3.2 Create `/hooks/use-device-form.ts`

**Purpose:** react-hook-form integration
**Replaces:** Manual state management

```typescript
// hooks/use-device-form.ts
import { useForm, UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { deviceFormSchema, type DeviceFormValues } from '../validation'
import { DEFAULT_INTERFACE } from '../constants'
import type { NautobotDefaults } from '../types'

interface UseDeviceFormOptions {
  defaults?: NautobotDefaults | null
}

const DEFAULT_OPTIONS: UseDeviceFormOptions = {}

export function useDeviceForm(
  options: UseDeviceFormOptions = DEFAULT_OPTIONS
): UseFormReturn<DeviceFormValues> {
  const { defaults } = options

  const defaultValues: DeviceFormValues = useMemo(() => ({
    deviceName: '',
    serialNumber: '',
    selectedRole: defaults?.device_role || '',
    selectedStatus: defaults?.device_status || '',
    selectedLocation: defaults?.location || '',
    selectedDeviceType: '',
    selectedPlatform: defaults?.platform || '',
    selectedSoftwareVersion: '',
    selectedTags: [],
    customFieldValues: {},
    addPrefix: true,
    defaultPrefixLength: '/24',
    interfaces: [
      {
        id: '1',
        ...DEFAULT_INTERFACE,
        status: defaults?.interface_status || '',
        namespace: defaults?.namespace || '',
      },
    ],
  }), [defaults])

  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues,
    mode: 'onChange', // Validate on change
  })

  return form
}
```

---

### Phase 4: Custom Hooks (Day 3, Morning)
**Estimated Time:** 4-5 hours

#### 4.1 Create `/hooks/use-searchable-dropdown.ts`

**Purpose:** Reusable searchable dropdown logic
**FIXED:** Properly memoized, stable dependencies

```typescript
// hooks/use-searchable-dropdown.ts
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { EMPTY_STRING_ARRAY } from '../constants'

export interface SearchableDropdownState<T> {
  searchQuery: string
  setSearchQuery: (query: string) => void
  filteredItems: T[]
  showDropdown: boolean
  setShowDropdown: (show: boolean) => void
  selectItem: (item: T) => void
  selectedItem: T | null
  containerRef: React.RefObject<HTMLDivElement>
  displayValue: string
}

interface UseSearchableDropdownOptions<T> {
  items: T[]
  selectedId: string
  onSelect: (id: string) => void
  getDisplayText: (item: T) => string
  filterPredicate: (item: T, query: string) => boolean
}

const DEFAULT_OPTIONS = {} as any

/**
 * Searchable dropdown hook with click-outside handling
 * @param options - Configuration options
 * @returns Memoized dropdown state
 */
export function useSearchableDropdown<T extends { id: string }>(
  options: UseSearchableDropdownOptions<T>
): SearchableDropdownState<T> {
  const {
    items,
    selectedId,
    onSelect,
    getDisplayText,
    filterPredicate,
  } = options

  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const lowerQuery = searchQuery.toLowerCase()
    return items.filter(item => filterPredicate(item, lowerQuery))
  }, [items, searchQuery, filterPredicate])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectItem = useCallback((item: T) => {
    onSelect(item.id)
    setSearchQuery(getDisplayText(item))
    setShowDropdown(false)
  }, [onSelect, getDisplayText])

  const selectedItem = useMemo(
    () => items.find(item => item.id === selectedId) || null,
    [items, selectedId]
  )

  const displayValue = useMemo(() => {
    if (searchQuery) return searchQuery
    return selectedItem ? getDisplayText(selectedItem) : ''
  }, [searchQuery, selectedItem, getDisplayText])

  // CRITICAL: Memoize return object to prevent infinite loops
  return useMemo(() => ({
    searchQuery,
    setSearchQuery,
    filteredItems,
    showDropdown,
    setShowDropdown,
    selectItem,
    selectedItem,
    containerRef,
    displayValue,
  }), [searchQuery, filteredItems, showDropdown, selectItem, selectedItem, displayValue])
}
```

---

#### 4.2 Create `/hooks/use-tags-manager.ts`

**Purpose:** Tags modal state management
**Uses:** TanStack Query for data fetching

```typescript
// hooks/use-tags-manager.ts
import { useState, useCallback, useMemo } from 'react'
import { useTagsQuery } from './queries/use-tags-query'
import { EMPTY_STRING_ARRAY } from '../constants'

export interface TagsManagerHook {
  availableTags: TagItem[]
  selectedTags: string[]
  isLoading: boolean
  showModal: boolean
  openModal: () => void
  closeModal: () => void
  toggleTag: (tagId: string) => void
  setSelectedTags: (tags: string[]) => void
  clearSelectedTags: () => void
}

export function useTagsManager(): TagsManagerHook {
  const [selectedTags, setSelectedTags] = useState<string[]>(EMPTY_STRING_ARRAY)
  const [showModal, setShowModal] = useState(false)

  // Fetch tags only when modal is open
  const { data: availableTags = EMPTY_STRING_ARRAY, isLoading } = useTagsQuery({
    enabled: showModal,
  })

  const openModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
  }, [])

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }, [])

  const clearSelectedTags = useCallback(() => {
    setSelectedTags(EMPTY_STRING_ARRAY)
  }, [])

  // CRITICAL: Memoize return
  return useMemo(() => ({
    availableTags,
    selectedTags,
    isLoading,
    showModal,
    openModal,
    closeModal,
    toggleTag,
    setSelectedTags,
    clearSelectedTags,
  }), [availableTags, selectedTags, isLoading, showModal, openModal, closeModal, toggleTag, clearSelectedTags])
}
```

---

#### 4.3 Create `/hooks/use-custom-fields-manager.ts`

**Purpose:** Custom fields modal with choices loading

```typescript
// hooks/use-custom-fields-manager.ts
import { useState, useCallback, useMemo } from 'react'
import { useCustomFieldsQuery, useCustomFieldChoicesQuery } from './queries/use-custom-fields-query'
import { EMPTY_OBJECT } from '../constants'
import type { CustomField } from '../types'

export interface CustomFieldsManagerHook {
  customFields: CustomField[]
  customFieldValues: Record<string, string>
  customFieldChoices: Record<string, string[]>
  isLoading: boolean
  showModal: boolean
  openModal: () => void
  closeModal: () => void
  updateFieldValue: (key: string, value: string) => void
  setCustomFieldValues: (values: Record<string, string>) => void
  clearFieldValues: () => void
}

export function useCustomFieldsManager(): CustomFieldsManagerHook {
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(EMPTY_OBJECT)
  const [showModal, setShowModal] = useState(false)

  // Fetch custom fields when modal opens
  const { data: customFields = [], isLoading } = useCustomFieldsQuery({
    enabled: showModal,
  })

  // TODO: Load choices for select fields
  // This would require using useQueries for multiple choice queries

  const openModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
  }, [])

  const updateFieldValue = useCallback((key: string, value: string) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const clearFieldValues = useCallback(() => {
    setCustomFieldValues(EMPTY_OBJECT)
  }, [])

  return useMemo(() => ({
    customFields,
    customFieldValues,
    customFieldChoices: {}, // TODO: Implement with useQueries
    isLoading,
    showModal,
    openModal,
    closeModal,
    updateFieldValue,
    setCustomFieldValues,
    clearFieldValues,
  }), [customFields, customFieldValues, isLoading, showModal, openModal, closeModal, updateFieldValue, clearFieldValues])
}
```

---

#### 4.4 Create `/hooks/use-properties-modal.ts`

**Purpose:** Interface properties modal with VLAN loading

```typescript
// hooks/use-properties-modal.ts
import { useState, useCallback, useMemo } from 'react'
import { useVlansQuery } from './queries/use-vlans-query'
import type { VlanItem } from '../types'

export interface PropertiesModalHook {
  showModal: boolean
  currentInterfaceId: string | null
  vlans: VlanItem[]
  isLoadingVlans: boolean
  openModal: (interfaceId: string, locationName?: string) => void
  closeModal: () => void
}

export function usePropertiesModal(): PropertiesModalHook {
  const [showModal, setShowModal] = useState(false)
  const [currentInterfaceId, setCurrentInterfaceId] = useState<string | null>(null)
  const [locationName, setLocationName] = useState<string | undefined>(undefined)

  // Fetch VLANs when modal is open
  const { data: vlans = [], isLoading: isLoadingVlans } = useVlansQuery({
    locationName,
    includeGlobal: true,
    enabled: showModal && !!locationName,
  })

  const openModal = useCallback((interfaceId: string, location?: string) => {
    setCurrentInterfaceId(interfaceId)
    setLocationName(location)
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setCurrentInterfaceId(null)
    setLocationName(undefined)
  }, [])

  return useMemo(() => ({
    showModal,
    currentInterfaceId,
    vlans,
    isLoadingVlans,
    openModal,
    closeModal,
  }), [showModal, currentInterfaceId, vlans, isLoadingVlans, openModal, closeModal])
}
```

---

### Phase 5: Component Extraction (Day 3, Afternoon - Day 4, Morning)
**Estimated Time:** 6 hours

#### 5.1 Create `components/device-info-form.tsx`

**Purpose:** Device information form section
**Lines:** ~250 lines

```typescript
// components/device-info-form.tsx
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { UseFormReturn } from 'react-hook-form'
import { SearchableDropdownInput } from './searchable-dropdown-input'
import type { DeviceFormValues } from '../validation'
import type { NautobotDropdownsResponse, LocationItem, DeviceType, SoftwareVersion } from '../types'
import type { SearchableDropdownState } from '../hooks/use-searchable-dropdown'

interface DeviceInfoFormProps {
  form: UseFormReturn<DeviceFormValues>
  dropdownData: NautobotDropdownsResponse
  locationDropdown: SearchableDropdownState<LocationItem>
  deviceTypeDropdown: SearchableDropdownState<DeviceType>
  softwareVersionDropdown: SearchableDropdownState<SoftwareVersion>
  isLoading: boolean
  onOpenTags: () => void
  onOpenCustomFields: () => void
  selectedTagsCount: number
}

export function DeviceInfoForm({
  form,
  dropdownData,
  locationDropdown,
  deviceTypeDropdown,
  softwareVersionDropdown,
  isLoading,
  onOpenTags,
  onOpenCustomFields,
  selectedTagsCount,
}: DeviceInfoFormProps) {
  const { register, setValue, watch, formState: { errors } } = form

  return (
    <div className="rounded-xl border shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Device Information</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenTags}
            disabled={isLoading}
          >
            Tags {selectedTagsCount > 0 && `(${selectedTagsCount})`}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenCustomFields}
            disabled={isLoading}
          >
            Custom Fields
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Device Name */}
        <div className="space-y-1">
          <Label htmlFor="deviceName" className="text-xs font-medium">
            Device Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="deviceName"
            {...register('deviceName')}
            disabled={isLoading}
          />
          {errors.deviceName && (
            <p className="text-xs text-destructive">{errors.deviceName.message}</p>
          )}
        </div>

        {/* Serial Number */}
        <div className="space-y-1">
          <Label htmlFor="serialNumber" className="text-xs font-medium">
            Serial Number
          </Label>
          <Input
            id="serialNumber"
            {...register('serialNumber')}
            disabled={isLoading}
          />
        </div>

        {/* Role */}
        <div className="space-y-1">
          <Label htmlFor="selectedRole" className="text-xs font-medium">
            Device Role <span className="text-destructive">*</span>
          </Label>
          <Select
            value={watch('selectedRole')}
            onValueChange={(value) => setValue('selectedRole', value)}
            disabled={isLoading}
          >
            <SelectTrigger id="selectedRole">
              <SelectValue placeholder="Select role..." />
            </SelectTrigger>
            <SelectContent>
              {dropdownData.roles.map(role => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.selectedRole && (
            <p className="text-xs text-destructive">{errors.selectedRole.message}</p>
          )}
        </div>

        {/* Status */}
        <div className="space-y-1">
          <Label htmlFor="selectedStatus" className="text-xs font-medium">
            Device Status <span className="text-destructive">*</span>
          </Label>
          <Select
            value={watch('selectedStatus')}
            onValueChange={(value) => setValue('selectedStatus', value)}
            disabled={isLoading}
          >
            <SelectTrigger id="selectedStatus">
              <SelectValue placeholder="Select status..." />
            </SelectTrigger>
            <SelectContent>
              {dropdownData.statuses.map(status => (
                <SelectItem key={status.id} value={status.id}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.selectedStatus && (
            <p className="text-xs text-destructive">{errors.selectedStatus.message}</p>
          )}
        </div>

        {/* Location (Searchable) */}
        <SearchableDropdownInput
          id="selectedLocation"
          label="Location"
          placeholder="Search location..."
          required
          disabled={isLoading}
          dropdownState={locationDropdown}
          renderItem={(loc) => <div>{loc.hierarchicalPath || loc.name}</div>}
          getItemKey={(loc) => loc.id}
        />

        {/* Device Type (Searchable) */}
        <SearchableDropdownInput
          id="selectedDeviceType"
          label="Device Type"
          placeholder="Search device type..."
          required
          disabled={isLoading}
          dropdownState={deviceTypeDropdown}
          renderItem={(dt) => (
            <div>
              <div className="font-medium">{dt.model}</div>
              <div className="text-xs text-muted-foreground">
                {dt.manufacturer.name || dt.manufacturer.display}
              </div>
            </div>
          )}
          getItemKey={(dt) => dt.id}
        />

        {/* Platform */}
        <div className="space-y-1">
          <Label htmlFor="selectedPlatform" className="text-xs font-medium">
            Platform
          </Label>
          <Select
            value={watch('selectedPlatform')}
            onValueChange={(value) => setValue('selectedPlatform', value)}
            disabled={isLoading}
          >
            <SelectTrigger id="selectedPlatform">
              <SelectValue placeholder="Select platform..." />
            </SelectTrigger>
            <SelectContent>
              {dropdownData.platforms.map(platform => (
                <SelectItem key={platform.id} value={platform.id}>
                  {platform.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Software Version (Searchable) */}
        <SearchableDropdownInput
          id="selectedSoftwareVersion"
          label="Software Version"
          placeholder="Search version..."
          disabled={isLoading}
          dropdownState={softwareVersionDropdown}
          renderItem={(sv) => (
            <div>
              {sv.platform?.name && (
                <span className="text-xs text-muted-foreground">{sv.platform.name} </span>
              )}
              {sv.version}
            </div>
          )}
          getItemKey={(sv) => sv.id}
        />
      </div>
    </div>
  )
}
```

---

#### 5.2 Create `components/searchable-dropdown-input.tsx`

**Purpose:** Reusable searchable dropdown component

```typescript
// components/searchable-dropdown-input.tsx
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { SearchableDropdownState } from '../hooks/use-searchable-dropdown'

interface SearchableDropdownInputProps<T> {
  id: string
  label: string
  placeholder: string
  required?: boolean
  disabled?: boolean
  dropdownState: SearchableDropdownState<T>
  renderItem: (item: T) => React.ReactNode
  getItemKey: (item: T) => string
}

export function SearchableDropdownInput<T>({
  id,
  label,
  placeholder,
  required = false,
  disabled = false,
  dropdownState,
  renderItem,
  getItemKey,
}: SearchableDropdownInputProps<T>) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative" ref={dropdownState.containerRef}>
        <Input
          id={id}
          placeholder={placeholder}
          value={dropdownState.displayValue}
          onChange={(e) => {
            dropdownState.setSearchQuery(e.target.value)
            dropdownState.setShowDropdown(true)
          }}
          onFocus={() => dropdownState.setShowDropdown(true)}
          disabled={disabled}
        />
        {dropdownState.showDropdown && dropdownState.filteredItems.length > 0 && (
          <div className="absolute z-[100] mt-1 w-full bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {dropdownState.filteredItems.map(item => (
              <div
                key={getItemKey(item)}
                className="px-3 py-2 hover:bg-accent cursor-pointer text-sm border-b last:border-b-0"
                onClick={() => dropdownState.selectItem(item)}
              >
                {renderItem(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

---

#### 5.3 Create remaining components

Similar patterns for:
- `components/prefix-configuration.tsx` (~80 lines)
- `components/interface-list.tsx` (~300 lines with react-hook-form arrays)
- `components/interface-properties-modal.tsx` (~300 lines)
- `components/tags-modal.tsx` (~100 lines)
- `components/custom-fields-modal.tsx` (~150 lines)

---

### Phase 6: Utilities (Day 4, Afternoon)
**Estimated Time:** 2 hours

#### 6.1 Create `utils.ts`

```typescript
// utils.ts
import type { LocationItem } from './types'

/**
 * Builds hierarchical path for a location
 */
export function buildLocationPath(
  location: LocationItem,
  allLocations: LocationItem[]
): string {
  const path: string[] = [location.name]
  let current = location

  while (current.parent) {
    const parent = allLocations.find(loc => loc.id === current.parent?.id)
    if (!parent) break
    path.unshift(parent.name)
    current = parent
  }

  return path.join(' > ')
}

/**
 * Adds hierarchicalPath to all locations
 */
export function buildLocationHierarchy(
  locations: LocationItem[]
): LocationItem[] {
  return locations.map(loc => ({
    ...loc,
    hierarchicalPath: buildLocationPath(loc, locations),
  }))
}

/**
 * Converts DeviceFormValues to DeviceSubmissionData
 */
export function formatDeviceSubmissionData(
  formData: DeviceFormValues
): DeviceSubmissionData {
  return {
    name: formData.deviceName,
    serial: formData.serialNumber || undefined,
    role: formData.selectedRole,
    status: formData.selectedStatus,
    location: formData.selectedLocation,
    device_type: formData.selectedDeviceType,
    platform: formData.selectedPlatform || undefined,
    software_version: formData.selectedSoftwareVersion || undefined,
    tags: formData.selectedTags.length > 0 ? formData.selectedTags : undefined,
    custom_fields: Object.keys(formData.customFieldValues).length > 0
      ? formData.customFieldValues
      : undefined,
    interfaces: formData.interfaces,
    add_prefix: formData.addPrefix,
    default_prefix_length: formData.defaultPrefixLength,
  }
}
```

---

### Phase 7: Main Component Refactoring (Day 4, Afternoon - Day 5)
**Estimated Time:** 4-5 hours

#### 7.1 Refactored Main Component

**Target Size:** 300-350 lines

```typescript
// add-device-page.tsx (Refactored)
'use client'

import { useState, useCallback, useMemo } from 'react'
import { Server, Plus, X, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form } from '@/components/ui/form'

// TanStack Query Hooks
import { useNautobotDropdownsQuery } from './hooks/queries/use-nautobot-dropdowns-query'
import { useDeviceMutations } from './hooks/queries/use-device-mutations'

// Custom Hooks
import { useDeviceForm } from './hooks/use-device-form'
import { useSearchableDropdown } from './hooks/use-searchable-dropdown'
import { useTagsManager } from './hooks/use-tags-manager'
import { useCustomFieldsManager } from './hooks/use-custom-fields-manager'
import { usePropertiesModal } from './hooks/use-properties-modal'
import { useCSVUpload } from './hooks/use-csv-upload'

// Components
import { DeviceInfoForm } from './components/device-info-form'
import { PrefixConfiguration } from './components/prefix-configuration'
import { InterfaceList } from './components/interface-list'
import { InterfacePropertiesModal } from './components/interface-properties-modal'
import { TagsModal } from './components/tags-modal'
import { CustomFieldsModal } from './components/custom-fields-modal'
import { CSVUploadModal } from './components/csv-upload-modal'

// Utils
import { buildLocationHierarchy, formatDeviceSubmissionData } from './utils'
import { EMPTY_DROPDOWN_OPTIONS, EMPTY_LOCATIONS, EMPTY_DEVICE_TYPES, EMPTY_SOFTWARE_VERSIONS } from './constants'
import type { StatusMessage } from './types'

export function AddDevicePage() {
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

  // Fetch all dropdown data with TanStack Query
  const {
    data: dropdownData = {
      roles: EMPTY_DROPDOWN_OPTIONS,
      statuses: EMPTY_DROPDOWN_OPTIONS,
      locations: EMPTY_LOCATIONS,
      deviceTypes: EMPTY_DEVICE_TYPES,
      platforms: EMPTY_DROPDOWN_OPTIONS,
      softwareVersions: EMPTY_SOFTWARE_VERSIONS,
      interfaceTypes: EMPTY_DROPDOWN_OPTIONS,
      interfaceStatuses: EMPTY_DROPDOWN_OPTIONS,
      namespaces: EMPTY_DROPDOWN_OPTIONS,
      nautobotDefaults: null,
    },
    isLoading: isLoadingDropdowns,
  } = useNautobotDropdownsQuery()

  // Device form with react-hook-form + Zod
  const form = useDeviceForm({ defaults: dropdownData.nautobotDefaults })
  const { watch, reset, handleSubmit: formHandleSubmit } = form

  // Device mutation
  const { createDevice } = useDeviceMutations()

  // Searchable dropdowns with memoized predicates
  const locationFilterPredicate = useCallback(
    (loc: LocationItem, query: string) =>
      (loc.hierarchicalPath || loc.name).toLowerCase().includes(query),
    []
  )

  const deviceTypeFilterPredicate = useCallback(
    (dt: DeviceType, query: string) =>
      (dt.display || dt.model).toLowerCase().includes(query),
    []
  )

  const softwareVersionFilterPredicate = useCallback(
    (sv: SoftwareVersion, query: string) =>
      `${sv.platform?.name || ''} ${sv.version}`.toLowerCase().includes(query),
    []
  )

  const locationDropdown = useSearchableDropdown({
    items: useMemo(() => buildLocationHierarchy(dropdownData.locations), [dropdownData.locations]),
    selectedId: watch('selectedLocation'),
    onSelect: (id) => form.setValue('selectedLocation', id),
    getDisplayText: (loc) => loc.hierarchicalPath || loc.name,
    filterPredicate: locationFilterPredicate,
  })

  const deviceTypeDropdown = useSearchableDropdown({
    items: dropdownData.deviceTypes,
    selectedId: watch('selectedDeviceType'),
    onSelect: (id) => form.setValue('selectedDeviceType', id),
    getDisplayText: (dt) => dt.display || dt.model,
    filterPredicate: deviceTypeFilterPredicate,
  })

  const softwareVersionDropdown = useSearchableDropdown({
    items: dropdownData.softwareVersions,
    selectedId: watch('selectedSoftwareVersion'),
    onSelect: (id) => form.setValue('selectedSoftwareVersion', id),
    getDisplayText: (sv) => `${sv.platform?.name || ''} ${sv.version}`.trim(),
    filterPredicate: softwareVersionFilterPredicate,
  })

  // Modal managers
  const tagsManager = useTagsManager()
  const customFieldsManager = useCustomFieldsManager()
  const propertiesModal = usePropertiesModal()

  // CSV Upload
  const csvUpload = useCSVUpload({
    nautobotDefaults: dropdownData.nautobotDefaults,
    onImportDevice: async (device) => {
      // Implementation
      return { success: true, errors: [] }
    },
  })

  // Form submission
  const onSubmit = useCallback(
    async (data: DeviceFormValues) => {
      setStatusMessage({ type: 'info', message: 'Starting device addition workflow...' })

      const submissionData = formatDeviceSubmissionData(data)
      const result = await createDevice.mutateAsync(submissionData)

      setStatusMessage({
        type: result.messageType,
        message: result.message,
      })

      if (result.success) {
        reset() // Clear form on success
        setTimeout(() => setStatusMessage(null), 3000)
      }
    },
    [createDevice, reset]
  )

  const handleClearForm = useCallback(() => {
    reset()
    tagsManager.clearSelectedTags()
    customFieldsManager.clearFieldValues()
    setStatusMessage(null)
  }, [reset, tagsManager, customFieldsManager])

  // Loading state
  if (isLoadingDropdowns) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading form data...</p>
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={formHandleSubmit(onSubmit)} className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Server className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Add Device to Nautobot</h1>
              <p className="text-muted-foreground">Add a new network device or bare metal server</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => csvUpload.setShowModal(true)}
            disabled={createDevice.isPending}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Import from CSV
          </Button>
        </div>

        {/* Status Messages */}
        {statusMessage && (
          <Alert className={`border-${statusMessage.type === 'error' ? 'red' : statusMessage.type === 'success' ? 'green' : 'blue'}-500`}>
            <AlertDescription>{statusMessage.message}</AlertDescription>
          </Alert>
        )}

        {/* Device Information */}
        <DeviceInfoForm
          form={form}
          dropdownData={dropdownData}
          locationDropdown={locationDropdown}
          deviceTypeDropdown={deviceTypeDropdown}
          softwareVersionDropdown={softwareVersionDropdown}
          isLoading={createDevice.isPending}
          onOpenTags={tagsManager.openModal}
          onOpenCustomFields={customFieldsManager.openModal}
          selectedTagsCount={tagsManager.selectedTags.length}
        />

        {/* Prefix Configuration */}
        <PrefixConfiguration form={form} isLoading={createDevice.isPending} />

        {/* Network Interfaces */}
        <InterfaceList
          form={form}
          dropdownData={dropdownData}
          onOpenProperties={(id) => {
            const location = dropdownData.locations.find(l => l.id === watch('selectedLocation'))
            propertiesModal.openModal(id, location?.name)
          }}
          isLoading={createDevice.isPending}
        />

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            onClick={handleClearForm}
            disabled={createDevice.isPending}
            variant="outline"
            size="lg"
          >
            <X className="h-4 w-4 mr-2" />
            Clear Form
          </Button>
          <Button
            type="submit"
            disabled={createDevice.isPending}
            size="lg"
          >
            {createDevice.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding Device...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Device
              </>
            )}
          </Button>
        </div>

        {/* Modals */}
        <InterfacePropertiesModal
          form={form}
          interfaceId={propertiesModal.currentInterfaceId}
          vlans={propertiesModal.vlans}
          isLoadingVlans={propertiesModal.isLoadingVlans}
          show={propertiesModal.showModal}
          onClose={propertiesModal.closeModal}
        />

        <TagsModal
          show={tagsManager.showModal}
          onClose={tagsManager.closeModal}
          availableTags={tagsManager.availableTags}
          selectedTags={tagsManager.selectedTags}
          onToggleTag={tagsManager.toggleTag}
          isLoading={tagsManager.isLoading}
        />

        <CustomFieldsModal
          show={customFieldsManager.showModal}
          onClose={customFieldsManager.closeModal}
          customFields={customFieldsManager.customFields}
          customFieldValues={customFieldsManager.customFieldValues}
          onUpdateField={customFieldsManager.updateFieldValue}
          isLoading={customFieldsManager.isLoading}
        />

        <CSVUploadModal {...csvUpload} />
      </form>
    </Form>
  )
}
```

---

## Final File Structure

```
add-device/
├── components/
│   ├── device-info-form.tsx              (~250 lines) ✨ NEW
│   ├── prefix-configuration.tsx          (~80 lines) ✨ NEW
│   ├── interface-list.tsx                (~300 lines) ✨ NEW
│   ├── interface-properties-modal.tsx    (~300 lines) ✨ NEW
│   ├── tags-modal.tsx                    (~100 lines) ✨ NEW
│   ├── custom-fields-modal.tsx           (~150 lines) ✨ NEW
│   ├── searchable-dropdown-input.tsx     (~80 lines) ✨ NEW
│   ├── csv-upload-modal.tsx              (790 lines) ✅ EXISTS
│   ├── bulk-update-modal.tsx             (507 lines) ✅ EXISTS
│   └── index.ts                          (barrel exports)
├── hooks/
│   ├── queries/                          ✨ NEW DIRECTORY
│   │   ├── use-nautobot-dropdowns-query.ts    (~100 lines)
│   │   ├── use-tags-query.ts                  (~40 lines)
│   │   ├── use-custom-fields-query.ts         (~60 lines)
│   │   ├── use-vlans-query.ts                 (~50 lines)
│   │   ├── use-device-mutations.ts            (~120 lines)
│   │   └── index.ts                           (barrel exports)
│   ├── use-device-form.ts                (~80 lines) ✨ NEW
│   ├── use-searchable-dropdown.ts        (~120 lines) ✨ NEW
│   ├── use-tags-manager.ts               (~80 lines) ✨ NEW
│   ├── use-custom-fields-manager.ts      (~80 lines) ✨ NEW
│   ├── use-properties-modal.ts           (~60 lines) ✨ NEW
│   ├── use-csv-upload.ts                 (571 lines) ✅ EXISTS
│   └── index.ts                          (barrel exports)
├── types.ts                               (175 → ~350 lines) 📝 UPDATED
├── constants.ts                           (~60 lines) ✨ NEW
├── validation.ts                          (~100 lines) ✨ NEW
├── utils.ts                               (~80 lines) ✨ NEW
├── index.ts                               (exports main component)
├── add-device-page.tsx                    (2046 → ~350 lines) 📉 REFACTORED
└── add-device-page.test.tsx               (update imports)
```

---

## Metrics Summary

### Before Refactoring
- **Main Component:** 2,046 lines
- **State Variables:** 49 (manual useState)
- **useEffect Hooks:** 9 (ANTI-PATTERN)
- **useCallback Hooks:** 15
- **Total Hooks:** 75
- **Inline Interfaces:** 11
- **Manual data fetching:** All API calls
- **Manual validation:** String-based errors
- **Form library:** None

### After Refactoring
- **Main Component:** ~350 lines (83% reduction)
- **State Variables:** 1 (statusMessage only)
- **useEffect Hooks:** 0 (100% reduction - TanStack Query handles it)
- **useCallback Hooks:** 4
- **Total Hooks:** ~8
- **TanStack Query hooks:** 5 queries + 1 mutation
- **react-hook-form:** Type-safe validation
- **Zod schemas:** Compile-time type safety

### New Structure
- **5 TanStack Query hooks** (queries/ directory)
- **5 Custom hooks** (state management)
- **7 Components** (single responsibility)
- **4 Utility files** (validation, utils, constants, types)
- **Total Files:** 24 (from 5)

---

## Success Criteria

✅ Main component reduced to < 400 lines
✅ No manual `useState + useEffect` for data fetching
✅ TanStack Query for ALL server state
✅ react-hook-form + Zod for validation
✅ Query key factory in `/lib/query-keys.ts`
✅ Memoized hook returns (no infinite loops)
✅ Stable constants outside components
✅ All tests passing
✅ No regression in functionality
✅ Improved type safety
✅ Better code organization
✅ Documentation updated
✅ Code review approved

---

## Migration Checklist

### Phase 0: Query Keys Setup
- [ ] Update `/lib/query-keys.ts` with Nautobot keys
- [ ] Test query key factory types

### Phase 1: Types & Constants
- [ ] Move interfaces to `types.ts`
- [ ] Create `constants.ts` with stable references
- [ ] Create `validation.ts` with Zod schemas
- [ ] Verify no type errors

### Phase 2: TanStack Query Hooks
- [ ] Create `hooks/queries/` directory
- [ ] Create `use-nautobot-dropdowns-query.ts`
- [ ] Create `use-tags-query.ts`
- [ ] Create `use-custom-fields-query.ts`
- [ ] Create `use-vlans-query.ts`
- [ ] Create `use-device-mutations.ts`
- [ ] Test each query hook independently

### Phase 3: Form Management
- [ ] Create `use-device-form.ts` with react-hook-form
- [ ] Test form validation with Zod

### Phase 4: Custom Hooks
- [ ] Create `use-searchable-dropdown.ts` (memoized)
- [ ] Create `use-tags-manager.ts`
- [ ] Create `use-custom-fields-manager.ts`
- [ ] Create `use-properties-modal.ts`
- [ ] Test each hook for infinite loops

### Phase 5: Components
- [ ] Create `device-info-form.tsx`
- [ ] Create `prefix-configuration.tsx`
- [ ] Create `interface-list.tsx`
- [ ] Create `interface-properties-modal.tsx`
- [ ] Create `tags-modal.tsx`
- [ ] Create `custom-fields-modal.tsx`
- [ ] Create `searchable-dropdown-input.tsx`
- [ ] Create barrel exports `components/index.ts`

### Phase 6: Utilities
- [ ] Create `utils.ts`
- [ ] Test utility functions

### Phase 7: Main Component
- [ ] Refactor main component to orchestrator
- [ ] Replace all manual state with TanStack Query
- [ ] Replace manual validation with Zod
- [ ] Test form submission flow
- [ ] Verify all features work

### Post-Refactoring
- [ ] Run full test suite
- [ ] Manual testing of all features
- [ ] Check for infinite loops
- [ ] Check for memory leaks
- [ ] Performance testing
- [ ] Code review
- [ ] Update documentation
- [ ] Merge to main

---

## Timeline

| Phase | Duration | Completion |
|-------|----------|------------|
| Phase 0: Query Keys Setup | 1 hour | Day 1 AM |
| Phase 1: Types & Constants | 2 hours | Day 1 AM |
| Phase 2: TanStack Query Hooks | 7 hours | Day 1 PM - Day 2 AM |
| Phase 3: Form Management | 5 hours | Day 2 PM |
| Phase 4: Custom Hooks | 5 hours | Day 3 AM |
| Phase 5: Components | 6 hours | Day 3 PM - Day 4 AM |
| Phase 6: Utilities | 2 hours | Day 4 PM |
| Phase 7: Main Component | 5 hours | Day 4 PM - Day 5 AM |
| Testing & QA | 6 hours | Day 5 AM-PM |
| **Total** | **39 hours** | **5 days** |

---

**Status:** Ready for Implementation
**Priority:** CRITICAL ⚠️
**Estimated Completion:** 5 working days
**Architecture:** TanStack Query + react-hook-form + Zod
**Dependencies:** None
**Blockers:** None
