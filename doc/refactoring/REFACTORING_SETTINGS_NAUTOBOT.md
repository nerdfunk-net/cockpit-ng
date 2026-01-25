# Refactoring Plan: Nautobot Settings Component

**Component:** `frontend/src/components/features/settings/connections/nautobot/nautobot-settings.tsx`
**Created:** 2026-01-25
**Status:** Planning
**Total Lines of Code:** 1,404 (single monolithic component)

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. 🚫 **Architecture violation** - Manual `useState` + `useEffect` instead of mandatory TanStack Query
2. 📦 **Monolithic component** - 1,404 lines with multiple responsibilities (connection, defaults, offboarding, custom fields, location search)
3. ⚠️ **Missing standards** - No react-hook-form + zod for any of the 3 forms, custom message system instead of toast
4. 🔁 **Code duplication** - Location search dropdown logic duplicated (defaults + offboarding)
5. 🗂️ **Poor structure** - Single file instead of feature-based organization (components/, hooks/, dialogs/)
6. 🎨 **Complex inline logic** - Custom fields table, location hierarchy building embedded in main component
7. 🔄 **Multiple loading states** - 4 separate loading states manually managed

**Solution:**
1. ✅ **Migrate to TanStack Query** - Replaces manual loading/saving with automatic caching/mutations
2. ✅ **Decompose component** - Extract 3 form components, location search component, custom fields component
3. ✅ **Add query/mutation hooks** - use-nautobot-queries for all data fetching, use-nautobot-mutations for save/test operations
4. ✅ **Use toast notifications** - Replace custom message state with `useToast()`
5. ✅ **Feature-based structure** - components/, hooks/, types/, utils/
6. ✅ **Form validation** - react-hook-form + zod for all 3 forms (connection, defaults, offboarding)
7. ✅ **Shared components** - Reusable location search dropdown component

**Critical Path:** Phase 1 (foundation) → Phase 3 (TanStack Query) → Phase 2 (components) → Phase 4 (refactor main component)

**Minimum Viable:** Phases 1-3 establishes proper architecture per CLAUDE.md

---

## Executive Summary

The Nautobot Settings component contains **1,404 lines** in a single monolithic file with **critical architecture violations** and poor separation of concerns:

1. **Architecture Violation** - Uses manual state management (`useState` + `useEffect`) instead of mandatory TanStack Query
2. **Monolithic Structure** - Single 1,404-line component handling connection settings, defaults (11 fields), offboarding (custom fields + location search)
3. **Custom Message System** - Manual state with `setTimeout` instead of Shadcn toast notifications
4. **Missing Standards** - No react-hook-form + zod for 3 complex forms, inline field logic, poor component boundaries
5. **Duplicate Logic** - Location search dropdown implemented twice with identical logic
6. **Complex State** - 4 separate loading states, 9 option lists, custom fields with choices

**Bottom Line:** TanStack Query migration is not optional—it's mandatory per CLAUDE.md. Component decomposition will reduce from 1,404 lines to ~250-300 lines for main component plus reusable infrastructure.

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Manual `useState` + `useEffect` | **TanStack Query with auto-caching** |
| Manual loading states (4 separate) | **useQuery/useMutation built-in states** |
| Custom message with `setTimeout` | **Toast notifications (useToast)** |
| Manual error handling | **TanStack Query built-in error handling** |
| 1,404-line monolithic component | **Feature-based structure with decomposed components** |
| No form validation | **react-hook-form + zod for all 3 forms** |
| Inline callbacks without memoization | **Proper useCallback with stable dependencies** |
| Duplicate location search logic | **Reusable LocationSearchDropdown component** |

---

## Current Architecture

```
frontend/src/components/features/settings/connections/nautobot/
└── nautobot-settings.tsx            # 1,404 lines - Everything in one file
    ├── Connection Settings Form     # ~158 lines
    ├── Defaults Form (11 fields)    # ~329 lines
    ├── Offboarding Form             # ~285 lines
    ├── Custom Fields Logic          # ~135 lines
    ├── Location Search Logic        # ~110 lines (duplicated)
    ├── Loading/Message Logic        # ~50 lines
    └── State Management             # ~337 lines
```

**Total:** 1,404 lines in single file

---

## Problem Analysis

### Problem 1: Architecture Violation - Manual State Instead of TanStack Query

**Affected Lines:** 98-148, 164-234, 237-567

**Current Pattern:**
```tsx
// Lines 98-148 - Manual state for everything
const [settings, setSettings] = useState<NautobotSettings>({...})
const [defaults, setDefaults] = useState<NautobotDefaults>({...})
const [offboardingSettings, setOffboardingSettings] = useState<DeviceOffboardingSettings>({...})
const [isLoading, setIsLoading] = useState(true)
const [defaultsLoading, setDefaultsLoading] = useState(true)
const [optionsLoading, setOptionsLoading] = useState(true)
const [offboardingLoading, setOffboardingLoading] = useState(true)

// Lines 126-134 - Manual state for 9 option lists
const [deviceStatuses, setDeviceStatuses] = useState<NautobotOption[]>([])
const [interfaceStatuses, setInterfaceStatuses] = useState<NautobotOption[]>([])
const [ipAddressStatuses, setIpAddressStatuses] = useState<NautobotOption[]>([])
const [ipPrefixStatuses, setIpPrefixStatuses] = useState<NautobotOption[]>([])
const [namespaces, setNamespaces] = useState<NautobotOption[]>([])
const [deviceRoles, setDeviceRoles] = useState<NautobotOption[]>([])
const [platforms, setPlatforms] = useState<NautobotOption[]>([])
const [locations, setLocations] = useState<LocationItem[]>([])
const [secretGroups, setSecretGroups] = useState<NautobotOption[]>([])

// Lines 237-250 - Manual loading
const loadSettings = async () => {
  try {
    setIsLoading(true)
    const data: ApiResponse = await apiCall('settings/nautobot')
    if (data.success && data.data) {
      setSettings(data.data as NautobotSettings)
    }
  } catch (error) {
    showMessage('Failed to load settings', 'error')
  } finally {
    setIsLoading(false)
  }
}

// Lines 469-505 - Manual loading of 9 option lists in parallel
const loadNautobotOptions = async () => {
  try {
    setOptionsLoading(true)
    const [deviceStatusesRes, interfaceStatusesRes, ...] = await Promise.all([
      apiCall('nautobot/statuses/device'),
      // ... 8 more API calls
    ])
    setDeviceStatuses(Array.isArray(deviceStatusesRes) ? deviceStatusesRes : [])
    // ... 8 more setters
  } finally {
    setOptionsLoading(false)
  }
}
```

**Issue:**
- Manual loading state management (4 separate states)
- Manual state for 9 option lists
- Custom error handling
- No caching
- No automatic refetching
- Violates CLAUDE.md mandate to use TanStack Query

**Should Be:**
```tsx
// With TanStack Query
const { data: settings, isLoading: settingsLoading } = useNautobotSettingsQuery()
const { data: defaults } = useNautobotDefaultsQuery()
const { data: offboarding } = useNautobotOffboardingQuery()
const { data: options, isLoading: optionsLoading } = useNautobotOptionsQuery()
const { mutate: saveSettings } = useSaveNautobotSettingsMutation()
const { mutate: testConnection } = useTestNautobotConnectionMutation()
```

**Benefits:**
- ✅ Automatic caching
- ✅ Built-in loading/error states
- ✅ No manual `useEffect`
- ✅ Automatic background refetching
- ✅ Proper error handling with toast
- ✅ Single `isLoading` state per query

---

### Problem 2: Custom Message System Instead of Toast

**Affected Lines:** 119-120, 369-377

**Current Pattern:**
```tsx
const [status, setStatus] = useState<StatusType>('idle')
const [message, setMessage] = useState('')

const showMessage = (msg: string, type: 'success' | 'error') => {
  setMessage(msg)
  setStatus(type === 'success' ? 'success' : 'error')

  setTimeout(() => {
    setMessage('')
    setStatus('idle')
  }, 5000)
}

// Usage
showMessage('Failed to load settings', 'error')
```

**Issue:**
- Custom state management for messages
- Manual `setTimeout` cleanup
- Potential memory leaks if component unmounts
- Not using Shadcn toast system
- Inconsistent with rest of app

**Should Be:**
```tsx
const { toast } = useToast()

// Usage
toast({
  title: 'Error',
  description: 'Failed to load settings',
  variant: 'destructive'
})
```

---

### Problem 3: Monolithic Component with Multiple Responsibilities

**Affected Lines:** Entire file (1,404 lines)

**Current Responsibilities:**
1. Connection settings form (lines 624-782)
2. Defaults form with 11 fields (lines 784-1114)
3. Offboarding form (lines 1116-1400)
4. Custom fields table logic (lines 1272-1384)
5. Location search dropdown (lines 803-839, 1130-1163) - duplicated
6. Location hierarchy building (lines 387-432)
7. State management for all above (lines 98-234)
8. API calls for load/save/test (lines 237-567)

**Issue:**
- Single component doing too many things
- Hard to test individual pieces
- Location search dropdown logic duplicated (2 instances)
- Custom fields logic tightly coupled
- Poor separation of concerns

**Should Be:**
```
components/
├── nautobot-settings.tsx            # ~250-300 lines - Main component with tabs
├── connection-settings-form.tsx     # ~150 lines - Connection form (react-hook-form + zod)
├── defaults-settings-form.tsx       # ~250 lines - Defaults form (react-hook-form + zod)
├── offboarding-settings-form.tsx    # ~200 lines - Offboarding form (react-hook-form + zod)
├── location-search-dropdown.tsx     # ~100 lines - Reusable location search
└── custom-fields-table.tsx          # ~150 lines - Custom fields editor

hooks/
├── use-nautobot-settings-query.ts   # ~40 lines - Connection settings query
├── use-nautobot-defaults-query.ts   # ~40 lines - Defaults query
├── use-nautobot-offboarding-query.ts # ~40 lines - Offboarding query
├── use-nautobot-options-query.ts    # ~100 lines - All dropdown options (9 lists)
└── use-nautobot-mutations.ts        # ~200 lines - Save/test mutations

types/
└── index.ts                         # ~150 lines - Type definitions

utils/
├── constants.ts                     # ~60 lines - Constants
└── location-utils.ts                # ~80 lines - Location hierarchy building
```

---

### Problem 4: No Form Validation for Any of 3 Forms

**Affected Lines:** 624-782 (connection), 784-1114 (defaults), 1116-1400 (offboarding)

**Current Pattern:**
```tsx
// Manual state for each form
const [settings, setSettings] = useState<NautobotSettings>({...})
const [defaults, setDefaults] = useState<NautobotDefaults>({...})
const [offboardingSettings, setOffboardingSettings] = useState<DeviceOffboardingSettings>({...})

// Manual update functions
const updateSetting = (key: keyof NautobotSettings, value: string | number | boolean) => {
  setSettings(prev => ({ ...prev, [key]: value }))
}

const updateDefault = (key: keyof NautobotDefaults, value: string) => {
  setDefaults(prev => ({ ...prev, [key]: value }))
}

// Manual validation in buttons
disabled={!settings.url || !settings.token}
```

**Issue:**
- No react-hook-form
- No zod validation
- Manual state management for 3 separate forms
- Manual validation logic
- Violates CLAUDE.md form standards

**Should Be:**
```tsx
// Connection Form
const connectionSchema = z.object({
  url: z.string().url('Invalid URL').min(1, 'URL is required'),
  token: z.string().min(1, 'Token is required'),
  timeout: z.number().min(5).max(300),
  verify_ssl: z.boolean(),
})

const connectionForm = useForm({
  resolver: zodResolver(connectionSchema),
  defaultValues: DEFAULT_CONNECTION_SETTINGS,
})

// Defaults Form
const defaultsSchema = z.object({
  location: z.string().optional(),
  platform: z.string().optional(),
  // ... 9 more fields
})

const defaultsForm = useForm({
  resolver: zodResolver(defaultsSchema),
  defaultValues: DEFAULT_NAUTOBOT_DEFAULTS,
})

// Offboarding Form
const offboardingSchema = z.object({
  remove_all_custom_fields: z.boolean(),
  clear_device_name: z.boolean(),
  keep_serial: z.boolean(),
  location_id: z.string().optional(),
  status_id: z.string().optional(),
  role_id: z.string().optional(),
  custom_field_settings: z.record(z.string()),
})

const offboardingForm = useForm({
  resolver: zodResolver(offboardingSchema),
  defaultValues: DEFAULT_OFFBOARDING_SETTINGS,
})
```

---

### Problem 5: Duplicate Location Search Logic

**Affected Lines:** 803-839 (defaults), 1130-1163 (offboarding), 150-234 (state/effects)

**Issue:**
- Location search dropdown implemented twice with identical logic
- Separate state for each instance (lines 151-158)
- Separate effects for filtering (lines 173-197)
- Separate click-outside handlers (lines 219-234)
- ~150 lines of duplicated code

**Should Be:**
```tsx
// Reusable component
<LocationSearchDropdown
  value={defaults.location}
  onChange={(locationId) => form.setValue('location', locationId)}
  locations={locations}
  placeholder="Search location..."
/>
```

---

### Problem 6: Complex Custom Fields Logic Embedded in Main Component

**Affected Lines:** 146-148, 532-567, 1272-1384

**Issue:**
- Custom fields state managed in main component
- Custom field choices loaded inline (lines 532-567)
- Complex table rendering with 100+ lines inline (lines 1272-1384)
- Tight coupling makes testing difficult

**Should Be:**
```tsx
// Separate component
<CustomFieldsTable
  customFields={customFields}
  customFieldChoices={customFieldChoices}
  values={offboardingForm.watch('custom_field_settings')}
  onChange={(fieldName, value) => {
    const settings = offboardingForm.watch('custom_field_settings')
    offboardingForm.setValue('custom_field_settings', {
      ...settings,
      [fieldName]: value
    })
  }}
  disabled={offboardingForm.watch('remove_all_custom_fields')}
/>
```

---

### Problem 7: Location Hierarchy Building in Main Component

**Affected Lines:** 387-432

**Issue:**
- Complex utility functions embedded in main component
- ~50 lines of location hierarchy logic
- Should be in utils file for reusability and testing

**Should Be:**
```tsx
// In utils/location-utils.ts
export function buildLocationHierarchy(locations: LocationItem[]): LocationItem[] {
  const locationMap = new Map()
  locations.forEach(location => locationMap.set(location.id, location))

  const processedLocations = locations.map(location => ({
    ...location,
    hierarchicalPath: buildLocationPath(location, locationMap)
  }))

  return processedLocations.sort((a, b) =>
    (a.hierarchicalPath || '').localeCompare(b.hierarchicalPath || '')
  )
}
```

---

### Problem 8: Missing Type Definitions

**Issue:**
- Inline type definitions scattered throughout (lines 15-95)
- No centralized types file
- Complex interfaces defined at component level

**Current Types (inline):**
```tsx
// Lines 15-95 - All defined in component file
interface NautobotSettings { ... }
interface NautobotDefaults { ... }
interface NautobotOption { ... }
interface LocationItem { ... }
interface CustomField { ... }
interface CustomFieldChoice { ... }
interface DeviceOffboardingSettings { ... }
```

**Should Have:**
```tsx
// types/index.ts
export interface NautobotSettings {
  url: string
  token: string
  timeout: number
  verify_ssl: boolean
}

export interface NautobotDefaults {
  location: string
  platform: string
  interface_status: string
  device_status: string
  ip_address_status: string
  ip_prefix_status: string
  namespace: string
  device_role: string
  secret_group: string
  csv_delimiter: string
  csv_quote_char: string
}

export interface NautobotOption {
  id: string
  name: string
  color?: string
  description?: string
}

export interface LocationItem {
  id: string
  name: string
  display?: string
  parent?: {
    id: string
    name: string
  }
  hierarchicalPath?: string
}

export interface CustomField {
  id: string
  name?: string
  key?: string
  type: {
    value: string
  }
  description?: string
  required?: boolean
  default?: string
}

export interface CustomFieldChoice {
  id: string
  value: string
  display: string
  weight: number
  custom_field: {
    id: string
    object_type: string
    url: string
  }
}

export interface DeviceOffboardingSettings {
  remove_all_custom_fields: boolean
  clear_device_name: boolean
  keep_serial: boolean
  location_id: string
  status_id: string
  role_id: string
  custom_field_settings: { [key: string]: string }
}

export interface NautobotOptionsData {
  deviceStatuses: NautobotOption[]
  interfaceStatuses: NautobotOption[]
  ipAddressStatuses: NautobotOption[]
  ipPrefixStatuses: NautobotOption[]
  namespaces: NautobotOption[]
  deviceRoles: NautobotOption[]
  platforms: NautobotOption[]
  locations: LocationItem[]
  secretGroups: NautobotOption[]
}
```

---

### Problem 9: No Query Keys Defined

**Issue:**
- No query keys in centralized factory (`/lib/query-keys.ts`)
- Cannot invalidate cache properly
- Missing foundation for TanStack Query

**Should Have:**
```tsx
// In /frontend/src/lib/query-keys.ts
nautobotSettings: {
  all: ['nautobotSettings'] as const,
  settings: () => [...queryKeys.nautobotSettings.all, 'settings'] as const,
  defaults: () => [...queryKeys.nautobotSettings.all, 'defaults'] as const,
  offboarding: () => [...queryKeys.nautobotSettings.all, 'offboarding'] as const,
  options: () => [...queryKeys.nautobotSettings.all, 'options'] as const,
  customFields: () => [...queryKeys.nautobotSettings.all, 'customFields'] as const,
},
```

---

## Proposed Refactoring Plan

### Phase 1: Foundation & Setup (CRITICAL)

**1.1: Verify Backend Architecture**

- [ ] Confirm backend endpoints use repository pattern
- [ ] Verify `/settings/nautobot` endpoint exists (GET/POST)
- [ ] Check `/settings/nautobot/defaults` endpoint (GET/POST)
- [ ] Verify `/settings/offboarding` endpoint (GET/POST)
- [ ] Check `/settings/test/nautobot` endpoint for testing connection
- [ ] Verify all Nautobot dropdown endpoints (9 endpoints)
- [ ] Ensure proper error handling in backend

---

**1.2: Add Query Keys to Centralized Factory**

**File:** `/frontend/src/lib/query-keys.ts` (modify)

```tsx
// Add to existing queryKeys object
nautobotSettings: {
  all: ['nautobotSettings'] as const,
  settings: () => [...queryKeys.nautobotSettings.all, 'settings'] as const,
  defaults: () => [...queryKeys.nautobotSettings.all, 'defaults'] as const,
  offboarding: () => [...queryKeys.nautobotSettings.all, 'offboarding'] as const,
  options: () => [...queryKeys.nautobotSettings.all, 'options'] as const,
  customFields: () => [...queryKeys.nautobotSettings.all, 'customFields'] as const,
  customFieldChoices: (fieldName: string) =>
    [...queryKeys.nautobotSettings.customFields(), 'choices', fieldName] as const,
},
```

---

**1.3: Create Type Definitions**

**File:** `components/features/settings/connections/nautobot/types/index.ts` (new)

```tsx
export interface NautobotSettings {
  url: string
  token: string
  timeout: number
  verify_ssl: boolean
}

export interface NautobotDefaults {
  location: string
  platform: string
  interface_status: string
  device_status: string
  ip_address_status: string
  ip_prefix_status: string
  namespace: string
  device_role: string
  secret_group: string
  csv_delimiter: string
  csv_quote_char: string
}

export interface NautobotOption {
  id: string
  name: string
  color?: string
  description?: string
}

export interface LocationItem {
  id: string
  name: string
  display?: string
  parent?: {
    id: string
    name: string
  }
  hierarchicalPath?: string
}

export interface CustomField {
  id: string
  name?: string
  key?: string
  type: {
    value: string
  }
  description?: string
  required?: boolean
  default?: string
}

export interface CustomFieldChoice {
  id: string
  value: string
  display: string
  weight: number
  custom_field: {
    id: string
    object_type: string
    url: string
  }
}

export interface DeviceOffboardingSettings {
  remove_all_custom_fields: boolean
  clear_device_name: boolean
  keep_serial: boolean
  location_id: string
  status_id: string
  role_id: string
  custom_field_settings: { [key: string]: string }
}

export interface NautobotOptionsData {
  deviceStatuses: NautobotOption[]
  interfaceStatuses: NautobotOption[]
  ipAddressStatuses: NautobotOption[]
  ipPrefixStatuses: NautobotOption[]
  namespaces: NautobotOption[]
  deviceRoles: NautobotOption[]
  platforms: NautobotOption[]
  locations: LocationItem[]
  secretGroups: NautobotOption[]
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
}

export interface TestConnectionResponse {
  success: boolean
  message?: string
}
```

---

**1.4: Create Constants**

**File:** `utils/constants.ts` (new)

```tsx
import type { NautobotSettings, NautobotDefaults, DeviceOffboardingSettings } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const DEFAULT_NAUTOBOT_SETTINGS: NautobotSettings = {
  url: '',
  token: '',
  timeout: 30,
  verify_ssl: true,
} as const

export const DEFAULT_NAUTOBOT_DEFAULTS: NautobotDefaults = {
  location: '',
  platform: '',
  interface_status: '',
  device_status: '',
  ip_address_status: '',
  ip_prefix_status: '',
  namespace: '',
  device_role: '',
  secret_group: '',
  csv_delimiter: ',',
  csv_quote_char: '"',
} as const

export const DEFAULT_OFFBOARDING_SETTINGS: DeviceOffboardingSettings = {
  remove_all_custom_fields: false,
  clear_device_name: false,
  keep_serial: false,
  location_id: '',
  status_id: '',
  role_id: '',
  custom_field_settings: {},
} as const

export const EMPTY_ARRAY: never[] = []

export const CACHE_TIME = {
  SETTINGS: 5 * 60 * 1000,  // 5 minutes
  DEFAULTS: 5 * 60 * 1000,  // 5 minutes
  OPTIONS: 10 * 60 * 1000,  // 10 minutes (dropdown options rarely change)
  OFFBOARDING: 5 * 60 * 1000,  // 5 minutes
  CUSTOM_FIELDS: 10 * 60 * 1000,  // 10 minutes
} as const

export const MESSAGE_TIMEOUT = 5000 as const

export const TAB_VALUES = {
  CONNECTION: 'connection',
  DEFAULTS: 'defaults',
  OFFBOARDING: 'offboarding',
} as const
```

---

**1.5: Create Location Utilities**

**File:** `utils/location-utils.ts` (new)

```tsx
import type { LocationItem } from '../types'

/**
 * Builds hierarchical path for each location
 */
export function buildLocationHierarchy(locations: LocationItem[]): LocationItem[] {
  // Create a map for quick location lookup by ID
  const locationMap = new Map<string, LocationItem>()
  locations.forEach(location => {
    locationMap.set(location.id, location)
  })

  // Build hierarchical path for each location
  const processedLocations = locations.map(location => {
    const hierarchicalPath = buildLocationPath(location, locationMap)
    return {
      ...location,
      hierarchicalPath
    }
  })

  // Sort locations by their hierarchical path
  return processedLocations.sort((a, b) =>
    (a.hierarchicalPath || '').localeCompare(b.hierarchicalPath || '')
  )
}

/**
 * Builds full hierarchical path for a single location
 */
export function buildLocationPath(
  location: LocationItem,
  locationMap: Map<string, LocationItem>
): string {
  const path: string[] = []
  let current = location

  // Traverse up the hierarchy to build the full path
  while (current) {
    path.unshift(current.name) // Add to beginning of array

    // Move to parent if it exists
    if (current.parent?.id) {
      const parent = locationMap.get(current.parent.id)
      if (parent && !path.includes(parent.name)) { // Prevent circular references
        current = parent
      } else {
        break
      }
    } else {
      break // No parent, we've reached the root
    }
  }

  // Join path with arrows, or return just the name if it's a root location
  return path.length > 1 ? path.join(' → ') : (path[0] || '')
}

/**
 * Filters locations by search query
 */
export function filterLocations(
  locations: LocationItem[],
  searchQuery: string
): LocationItem[] {
  if (!searchQuery.trim()) {
    return locations
  }

  const searchLower = searchQuery.toLowerCase()
  return locations.filter(location =>
    location.hierarchicalPath?.toLowerCase().includes(searchLower)
  )
}
```

---

### Phase 3: TanStack Query Migration (CRITICAL - Mandatory)

**3.1: Create Settings Query Hooks**

**File:** `hooks/use-nautobot-settings-query.ts` (new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiResponse, NautobotSettings } from '../types'
import { CACHE_TIME } from '../utils/constants'

interface UseNautobotSettingsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNautobotSettingsQueryOptions = { enabled: true }

/**
 * Fetch Nautobot connection settings with automatic caching
 */
export function useNautobotSettingsQuery(
  options: UseNautobotSettingsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobotSettings.settings(),
    queryFn: async () => {
      const response = await apiCall<ApiResponse<NautobotSettings>>('settings/nautobot')

      if (response.success && response.data) {
        return response.data
      }

      throw new Error('Failed to load Nautobot settings')
    },
    enabled,
    staleTime: CACHE_TIME.SETTINGS,
  })
}
```

---

**3.2: Create Defaults Query Hook**

**File:** `hooks/use-nautobot-defaults-query.ts` (new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiResponse, NautobotDefaults } from '../types'
import { CACHE_TIME } from '../utils/constants'

interface UseNautobotDefaultsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNautobotDefaultsQueryOptions = { enabled: true }

/**
 * Fetch Nautobot default values with automatic caching
 */
export function useNautobotDefaultsQuery(
  options: UseNautobotDefaultsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobotSettings.defaults(),
    queryFn: async () => {
      const response = await apiCall<ApiResponse<NautobotDefaults>>('settings/nautobot/defaults')

      if (response.success && response.data) {
        return response.data
      }

      throw new Error('Failed to load Nautobot defaults')
    },
    enabled,
    staleTime: CACHE_TIME.DEFAULTS,
  })
}
```

---

**3.3: Create Offboarding Query Hook**

**File:** `hooks/use-nautobot-offboarding-query.ts` (new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiResponse, DeviceOffboardingSettings } from '../types'
import { CACHE_TIME } from '../utils/constants'

interface UseNautobotOffboardingQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNautobotOffboardingQueryOptions = { enabled: true }

/**
 * Fetch device offboarding settings with automatic caching
 */
export function useNautobotOffboardingQuery(
  options: UseNautobotOffboardingQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobotSettings.offboarding(),
    queryFn: async () => {
      const response = await apiCall<ApiResponse<DeviceOffboardingSettings>>('settings/offboarding')

      if (response.success && response.data) {
        return response.data
      }

      throw new Error('Failed to load offboarding settings')
    },
    enabled,
    staleTime: CACHE_TIME.OFFBOARDING,
  })
}
```

---

**3.4: Create Options Query Hook (Consolidates 9 API Calls)**

**File:** `hooks/use-nautobot-options-query.ts` (new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { NautobotOptionsData, NautobotOption, LocationItem } from '../types'
import { CACHE_TIME, EMPTY_ARRAY } from '../utils/constants'
import { buildLocationHierarchy } from '../utils/location-utils'

interface UseNautobotOptionsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNautobotOptionsQueryOptions = { enabled: true }

/**
 * Fetch all Nautobot dropdown options in parallel with automatic caching
 * Consolidates 9 separate API calls into a single query
 */
export function useNautobotOptionsQuery(
  options: UseNautobotOptionsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobotSettings.options(),
    queryFn: async (): Promise<NautobotOptionsData> => {
      // Load all options in parallel
      const [
        deviceStatusesRes,
        interfaceStatusesRes,
        ipAddressStatusesRes,
        ipPrefixStatusesRes,
        namespacesRes,
        deviceRolesRes,
        platformsRes,
        locationsRes,
        secretGroupsRes,
      ] = await Promise.all([
        apiCall('nautobot/statuses/device'),
        apiCall('nautobot/statuses/interface'),
        apiCall('nautobot/statuses/ipaddress'),
        apiCall('nautobot/statuses/prefix'),
        apiCall('nautobot/namespaces'),
        apiCall('nautobot/roles/devices'),
        apiCall('nautobot/platforms'),
        apiCall('nautobot/locations'),
        apiCall('nautobot/secret-groups'),
      ])

      // Build location hierarchy
      const rawLocations = Array.isArray(locationsRes) ? locationsRes : EMPTY_ARRAY
      const processedLocations = buildLocationHierarchy(rawLocations as LocationItem[])

      return {
        deviceStatuses: Array.isArray(deviceStatusesRes) ? deviceStatusesRes : EMPTY_ARRAY,
        interfaceStatuses: Array.isArray(interfaceStatusesRes) ? interfaceStatusesRes : EMPTY_ARRAY,
        ipAddressStatuses: Array.isArray(ipAddressStatusesRes) ? ipAddressStatusesRes : EMPTY_ARRAY,
        ipPrefixStatuses: Array.isArray(ipPrefixStatusesRes) ? ipPrefixStatusesRes : EMPTY_ARRAY,
        namespaces: Array.isArray(namespacesRes) ? namespacesRes : EMPTY_ARRAY,
        deviceRoles: Array.isArray(deviceRolesRes) ? deviceRolesRes : EMPTY_ARRAY,
        platforms: Array.isArray(platformsRes) ? platformsRes : EMPTY_ARRAY,
        locations: processedLocations,
        secretGroups: Array.isArray(secretGroupsRes) ? secretGroupsRes : EMPTY_ARRAY,
      }
    },
    enabled,
    staleTime: CACHE_TIME.OPTIONS,
  })
}
```

---

**3.5: Create Custom Fields Query Hooks**

**File:** `hooks/use-nautobot-custom-fields-queries.ts` (new)

```tsx
import { useQuery, useQueries } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { CustomField, CustomFieldChoice } from '../types'
import { CACHE_TIME, EMPTY_ARRAY } from '../utils/constants'

interface UseCustomFieldsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCustomFieldsQueryOptions = { enabled: true }

/**
 * Fetch custom fields for devices
 */
export function useCustomFieldsQuery(
  options: UseCustomFieldsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobotSettings.customFields(),
    queryFn: async () => {
      const response = await apiCall('nautobot/custom-fields/devices')
      return Array.isArray(response) ? response as CustomField[] : EMPTY_ARRAY
    },
    enabled,
    staleTime: CACHE_TIME.CUSTOM_FIELDS,
  })
}

/**
 * Fetch custom field choices for all select-type fields
 */
export function useCustomFieldChoicesQueries(customFields: CustomField[]) {
  const { apiCall } = useApi()

  // Get all select-type fields
  const selectFields = customFields.filter(field => field.type?.value === 'select')

  return useQueries({
    queries: selectFields.map(field => {
      const fieldName = field.name || field.key || field.id

      return {
        queryKey: queryKeys.nautobotSettings.customFieldChoices(fieldName),
        queryFn: async () => {
          try {
            const choices = await apiCall(`nautobot/custom-field-choices/${fieldName}`)
            return {
              fieldName,
              choices: Array.isArray(choices) ? choices as CustomFieldChoice[] : EMPTY_ARRAY,
            }
          } catch (error) {
            console.error(`Error loading choices for ${fieldName}:`, error)
            return { fieldName, choices: EMPTY_ARRAY }
          }
        },
        staleTime: CACHE_TIME.CUSTOM_FIELDS,
      }
    }),
  })
}
```

---

**3.6: Create Mutation Hooks**

**File:** `hooks/use-nautobot-mutations.ts` (new)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type {
  NautobotSettings,
  NautobotDefaults,
  DeviceOffboardingSettings,
  ApiResponse,
  TestConnectionResponse,
} from '../types'
import { useMemo } from 'react'

export function useNautobotMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  /**
   * Save Nautobot connection settings
   */
  const saveSettings = useMutation({
    mutationFn: async (settings: NautobotSettings) => {
      const response = await apiCall<ApiResponse<NautobotSettings>>('settings/nautobot', {
        method: 'POST',
        body: JSON.stringify(settings),
      })

      if (!response.success) {
        throw new Error(response.message || 'Failed to save settings')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nautobotSettings.settings() })
      toast({
        title: 'Success',
        description: 'Nautobot settings saved successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  /**
   * Test Nautobot connection
   */
  const testConnection = useMutation({
    mutationFn: async (settings: NautobotSettings) => {
      const response = await apiCall<TestConnectionResponse>('settings/test/nautobot', {
        method: 'POST',
        body: JSON.stringify(settings),
      })

      if (!response.success) {
        throw new Error(response.message || 'Connection failed')
      }

      return response
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Connection successful!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Connection Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  /**
   * Save Nautobot defaults
   */
  const saveDefaults = useMutation({
    mutationFn: async (defaults: NautobotDefaults) => {
      const response = await apiCall<ApiResponse<NautobotDefaults>>('settings/nautobot/defaults', {
        method: 'POST',
        body: JSON.stringify(defaults),
      })

      if (!response.success) {
        throw new Error(response.message || 'Failed to save defaults')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nautobotSettings.defaults() })
      toast({
        title: 'Success',
        description: 'Nautobot defaults saved successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  /**
   * Save device offboarding settings
   */
  const saveOffboarding = useMutation({
    mutationFn: async (settings: DeviceOffboardingSettings) => {
      const response = await apiCall<ApiResponse<DeviceOffboardingSettings>>('settings/offboarding', {
        method: 'POST',
        body: JSON.stringify(settings),
      })

      if (!response.success) {
        throw new Error(response.message || 'Failed to save offboarding settings')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nautobotSettings.offboarding() })
      toast({
        title: 'Success',
        description: 'Device offboarding settings saved successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Memoize return object to prevent re-renders
  return useMemo(
    () => ({
      saveSettings,
      testConnection,
      saveDefaults,
      saveOffboarding,
    }),
    [saveSettings, testConnection, saveDefaults, saveOffboarding]
  )
}
```

**Benefits:**
- ✅ Automatic cache invalidation
- ✅ Built-in optimistic updates support
- ✅ Consistent error/success handling with toast
- ✅ Loading states for each mutation

---

### Phase 2: Create Reusable Components

**2.1: Create Location Search Dropdown (Reusable)**

**File:** `components/location-search-dropdown.tsx` (new)

```tsx
import { useState, useRef, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import type { LocationItem } from '../types'
import { filterLocations } from '../utils/location-utils'
import { EMPTY_ARRAY } from '../utils/constants'

interface LocationSearchDropdownProps {
  locations: LocationItem[]
  value: string
  onChange: (locationId: string) => void
  placeholder?: string
  disabled?: boolean
}

export function LocationSearchDropdown({
  locations = EMPTY_ARRAY,
  value,
  onChange,
  placeholder = 'Search location...',
  disabled = false,
}: LocationSearchDropdownProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Get display value from selected location
  const displayValue = useMemo(() => {
    if (!value) return ''
    const selectedLocation = locations.find(loc => loc.id === value)
    return selectedLocation?.hierarchicalPath || selectedLocation?.name || ''
  }, [value, locations])

  // Sync search query with display value when value changes
  useEffect(() => {
    if (value && !searchQuery) {
      setSearchQuery(displayValue)
    }
  }, [displayValue, value, searchQuery])

  // Filter locations based on search query
  const filteredLocations = useMemo(
    () => filterLocations(locations, searchQuery),
    [locations, searchQuery]
  )

  // Handle location selection
  const handleSelect = (location: LocationItem) => {
    setSearchQuery(location.hierarchicalPath || location.name)
    onChange(location.id)
    setShowDropdown(false)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.location-dropdown-container')) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
    return undefined
  }, [showDropdown])

  return (
    <div className="relative location-dropdown-container" ref={containerRef}>
      <Input
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value)
          setShowDropdown(true)
        }}
        onFocus={() => setShowDropdown(true)}
        disabled={disabled}
        className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
      />
      {showDropdown && !disabled && (
        <div
          className="fixed z-[9999] mt-1 bg-white border border-gray-300 rounded-md shadow-xl max-h-60 overflow-y-auto min-w-[300px]"
          style={{
            top: containerRef.current?.getBoundingClientRect().bottom ?? 0,
            left: containerRef.current?.getBoundingClientRect().left ?? 0,
            width: containerRef.current?.getBoundingClientRect().width ?? 'auto',
          }}
        >
          {filteredLocations.length > 0 ? (
            filteredLocations.map((location) => (
              <div
                key={location.id}
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                onClick={() => handleSelect(location)}
              >
                {location.hierarchicalPath}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500 italic">No locations found</div>
          )}
        </div>
      )}
    </div>
  )
}
```

---

**2.2: Create Custom Fields Table**

**File:** `components/custom-fields-table.tsx` (new)

```tsx
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Settings } from 'lucide-react'
import type { CustomField, CustomFieldChoice } from '../types'

interface CustomFieldsTableProps {
  customFields: CustomField[]
  customFieldChoices: { [key: string]: CustomFieldChoice[] }
  values: { [key: string]: string }
  onChange: (fieldName: string, value: string) => void
  disabled?: boolean
}

export function CustomFieldsTable({
  customFields,
  customFieldChoices,
  values,
  onChange,
  disabled = false,
}: CustomFieldsTableProps) {
  if (customFields.length === 0) {
    return (
      <div className="text-xs text-gray-500 text-center py-4 bg-white">
        No custom fields available
      </div>
    )
  }

  return (
    <div className="rounded-lg border shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-1 px-3">
        <div className="flex items-center space-x-2">
          <Settings className="h-3 w-3" />
          <div>
            <h3 className="text-xs font-semibold">Custom Fields</h3>
            <p className="text-blue-100 text-xs">
              Configure custom field settings for device offboarding
            </p>
          </div>
        </div>
      </div>
      <div className="bg-white">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-900">
                Custom Field
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-900">Value</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-900">
                Clear Custom Field
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customFields.map((field) => {
              const fieldName = field.name || field.key || field.id
              if (!fieldName) return null

              const isClearSelected = values[fieldName] === 'clear'
              const fieldValue = isClearSelected ? '' : values[fieldName] || ''

              return (
                <tr key={field.id} className="hover:bg-gray-50">
                  <td className="px-2 py-2">
                    <div>
                      <div className="text-xs font-medium text-gray-900">
                        {fieldName}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </div>
                      {field.description && (
                        <div className="text-xs text-gray-500">{field.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    {field.type?.value === 'select' ? (
                      <Select
                        value={fieldValue}
                        onValueChange={(value) => onChange(fieldName, value)}
                        disabled={disabled || isClearSelected}
                      >
                        <SelectTrigger className="h-6 text-xs">
                          <SelectValue placeholder="Select a value" />
                        </SelectTrigger>
                        <SelectContent>
                          {customFieldChoices[fieldName]?.map((choice) => (
                            <SelectItem key={choice.id} value={choice.value}>
                              {choice.display}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type="text"
                        placeholder={field.default || 'Enter value'}
                        value={fieldValue}
                        onChange={(e) => onChange(fieldName, e.target.value)}
                        disabled={disabled || isClearSelected}
                        className="h-6 text-xs"
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Checkbox
                      checked={isClearSelected}
                      onCheckedChange={(checked) =>
                        onChange(fieldName, checked ? 'clear' : '')
                      }
                      disabled={disabled}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

---

**2.3: Create Connection Settings Form (with react-hook-form + zod)**

**File:** `components/connection-settings-form.tsx` (new)

Similar to CheckMK connection form but with Nautobot-specific fields (url, token, timeout, verify_ssl).

---

**2.4: Create Defaults Settings Form (with react-hook-form + zod)**

**File:** `components/defaults-settings-form.tsx` (new)

Form with 11 fields using LocationSearchDropdown and Select components for all dropdowns.

---

**2.5: Create Offboarding Settings Form (with react-hook-form + zod)**

**File:** `components/offboarding-settings-form.tsx` (new)

Form with checkboxes, location/status/role selects, and CustomFieldsTable component.

---

### Phase 4: Refactor Main Component

**File:** `nautobot-settings.tsx`

Refactor from 1,404 lines to ~250-300 lines using all the components and hooks created above.

---

## Final Directory Structure (After Refactoring)

```
frontend/src/components/features/settings/connections/nautobot/
├── nautobot-settings.tsx            # ~250-300 lines (was 1,404, -78%)
├── components/
│   ├── connection-settings-form.tsx # ~150 lines (new, react-hook-form + zod)
│   ├── defaults-settings-form.tsx   # ~250 lines (new, react-hook-form + zod)
│   ├── offboarding-settings-form.tsx # ~200 lines (new, react-hook-form + zod)
│   ├── location-search-dropdown.tsx # ~100 lines (new, reusable)
│   └── custom-fields-table.tsx      # ~150 lines (new)
├── hooks/
│   ├── use-nautobot-settings-query.ts    # ~40 lines (new)
│   ├── use-nautobot-defaults-query.ts    # ~40 lines (new)
│   ├── use-nautobot-offboarding-query.ts # ~40 lines (new)
│   ├── use-nautobot-options-query.ts     # ~100 lines (new, consolidates 9 API calls)
│   ├── use-nautobot-custom-fields-queries.ts # ~80 lines (new)
│   └── use-nautobot-mutations.ts         # ~200 lines (new)
├── types/
│   └── index.ts                     # ~150 lines (new)
└── utils/
    ├── constants.ts                 # ~60 lines (new)
    └── location-utils.ts            # ~80 lines (new)
```

**Total:** ~1,840 lines (was 1,404)
**Main Component:** 250-300 lines (was 1,404, -78%)
**New Infrastructure:** ~1,540 lines (reusable patterns)

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `nautobot-settings.tsx` | 1,404 | ~250-300 | **-1,100 lines (-78%)** |
| **Subtotal (existing)** | **1,404** | **~250-300** | **-1,100 lines (-78%)** |
| **New files** | **0** | **~1,540** | **+1,540 lines** |
| **Grand Total** | **1,404** | **~1,790-1,840** | **+386 to +436 lines (+27% to +31%)** |

**Net increase:** ~386-436 lines (27-31%), but with significantly better architecture:
- TanStack Query for server state management (consolidates 9 API calls into 1 query)
- Reusable location search dropdown component
- Reusable custom fields table component
- Proper form validation with react-hook-form + zod for 3 forms
- Toast notifications instead of custom messages
- Better type safety throughout
- Location hierarchy utilities for reuse
- Easier testing
- Improved maintainability

---

## TanStack Query Assessment

**Is TanStack Query a good idea for this component?**

✅ **YES - Highly Recommended**

**Reasons:**
1. **Multiple data sources**: Settings + Defaults + Offboarding + 9 Option Lists + Custom Fields = 13+ separate queries
2. **Options consolidation**: 9 option API calls consolidated into single query with Promise.all
3. **Independent refetching**: Each section can be reloaded independently
4. **Automatic caching**: Reduces API calls when switching tabs (dropdown options cached for 10 minutes)
5. **Built-in error handling**: Better UX with automatic retry and error states
6. **CLAUDE.md compliance**: Mandatory architecture requirement

**Specific Benefits for Nautobot Settings:**
- **Tab switching**: Cached data prevents unnecessary refetches when switching between Connection/Defaults/Offboarding tabs
- **Dropdown options**: Single query loads all 9 option lists in parallel, cached for 10 minutes
- **Connection testing**: Mutation hook provides clean loading states
- **Custom fields**: Separate queries for fields and choices enable independent loading
- **Background refetch**: Automatically updates if options change externally

**Without TanStack Query (current):**
- ❌ Manual `useState` for 4+ data sources
- ❌ Manual loading states (4 loading flags)
- ❌ Custom error handling logic
- ❌ No caching (refetches on every mount)
- ❌ Complex Promise.all with manual state updates

**With TanStack Query (proposed):**
- ✅ Declarative queries (5 main hooks)
- ✅ Built-in loading states
- ✅ Automatic error handling
- ✅ Automatic caching
- ✅ Single options query consolidates 9 API calls

---

## Benefits After Refactoring

### Code Quality
1. **Architecture Compliance**: Uses TanStack Query as mandated by CLAUDE.md
2. **Separation of Concerns**: Clear component boundaries, single responsibility
3. **Type Safety**: Centralized type definitions, no inline types
4. **Consistency**: Uses standard patterns (toast, react-hook-form, zod)
5. **Reusability**: Location dropdown and custom fields table can be used elsewhere

### User Experience
1. **Better Error Handling**: Consistent toast notifications
2. **Improved Loading States**: TanStack Query built-in states
3. **No Regression**: All functionality preserved
4. **Better Form Validation**: Immediate feedback with zod

### Developer Experience
1. **Easier Testing**: Isolated components and hooks
2. **Simpler Components**: Main component reduced by 78%
3. **Reusable Patterns**: Location search and custom fields can be used for other features
4. **Better Maintainability**: Changes isolated to specific files
5. **Location Utilities**: Hierarchy building logic can be used elsewhere

### Performance
1. **Automatic Caching**: TanStack Query reduces API calls (options cached 10 minutes)
2. **No Memory Leaks**: Proper cleanup with TanStack Query
3. **Optimized Renders**: Proper memoization with constants
4. **Parallel Loading**: Options query loads 9 lists in parallel

---

## Success Metrics

**Code Quality:**
- [ ] Main component < 350 lines (target: ~250-300)
- [ ] No manual `useState` + `useEffect` for server data
- [ ] All 3 forms use react-hook-form + zod
- [ ] No inline arrays/objects in default parameters
- [ ] Toast notifications instead of custom messages
- [ ] Zero ESLint warnings

**Architecture Compliance:**
- [ ] All data fetching uses TanStack Query
- [ ] Query keys in centralized factory (`/lib/query-keys.ts`)
- [ ] API calls via `/api/proxy/settings/*` and `/api/proxy/nautobot/*`
- [ ] Feature-based folder structure (components/, hooks/, types/, utils/)
- [ ] All UI components from Shadcn
- [ ] Backend has repository/service/router layers

**User Experience:**
- [ ] No regression in functionality
- [ ] Improved loading states (TanStack Query)
- [ ] Better error messages (toast)
- [ ] Faster perceived performance (caching)
- [ ] All 3 tabs work correctly (Connection/Defaults/Offboarding)
- [ ] Location search dropdown works in both contexts

**Developer Experience:**
- [ ] Easier to test (isolated hooks and components)
- [ ] Clear component boundaries
- [ ] Reusable location search dropdown
- [ ] Reusable custom fields table
- [ ] Location utilities for hierarchy building
- [ ] Good documentation
- [ ] Type safety throughout

---

## Comparison with CheckMK Settings Refactoring

| Metric | CheckMK Settings | Nautobot Settings |
|--------|------------------|-------------------|
| Lines of Code | 989 (1 file) | 1,404 (1 file) |
| Critical Issue | Monolithic + no TanStack Query | Monolithic + no TanStack Query |
| Tabs | 3 (connection, 2 YAML) | 3 (connection, defaults, offboarding) |
| Forms | 1 form + 2 YAML editors | 3 complex forms |
| Dropdown Options | None | 9 option lists (manually managed) |
| Custom Logic | YAML validation, help dialog | Location hierarchy, custom fields table |
| Refactoring Priority | **MEDIUM** | **MEDIUM** |
| Main Approach | TanStack Query + decomposition | TanStack Query + decomposition |
| Code Reduction | -75% main component | -78% main component |
| New Infrastructure | ~930 lines | ~1,540 lines |
| Reusable Components | YAML editor | Location dropdown, custom fields table |

### Key Similarities

Both refactorings follow the same pattern:
1. ✅ Migrate to TanStack Query (mandatory per CLAUDE.md)
2. ✅ Feature-based folder structure (components/, hooks/, types/, utils/)
3. ✅ react-hook-form + zod for all forms
4. ✅ Extract constants to prevent re-render loops
5. ✅ Component decomposition
6. ✅ Centralized query keys in `/lib/query-keys.ts`
7. ✅ Toast notifications instead of custom messages

### Key Differences

**CheckMK Settings:**
- 2 YAML editors (duplicated logic eliminated with shared component)
- Connection test functionality
- Help dialog with extensive CheckMK documentation

**Nautobot Settings:**
- 3 complex forms requiring separate validation
- 9 dropdown option lists (consolidated into single query)
- Location search dropdown (duplicated, now reusable component)
- Custom fields table with dynamic choices
- Location hierarchy building utilities
- More complex state (13+ data sources vs 3)

---

## Notes

- This refactoring is **recommended** - improves maintainability and compliance with CLAUDE.md
- Location search dropdown is **reusable** for other features needing location selection
- Custom fields table is **reusable** for other offboarding/onboarding features
- Options query consolidates 9 API calls into 1 parallel query - significant performance improvement
- Location utilities can be used elsewhere in the app for hierarchy building
- Consider using the same form patterns for other settings pages
- Document the new patterns in coding guidelines for consistency
- Priority: **MEDIUM** (after critical refactorings, similar to CheckMK and RBAC)

---

**Document Version:** 1.0
**Created:** 2026-01-25
**Status:** Planning
**Priority:** Medium (tech debt, architecture compliance)
