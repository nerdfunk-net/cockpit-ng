# Refactoring Plan: CheckMK Settings Component

**Component:** `frontend/src/components/features/settings/connections/checkmk/checkmk-settings.tsx`
**Created:** 2026-01-25
**Updated:** 2026-01-25
**Status:** Planning
**Total Lines of Code:** 989 (single monolithic component)

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. 🚫 **Architecture violation** - Manual `useState` + `useEffect` instead of mandatory TanStack Query
2. 📦 **Monolithic component** - 989 lines with multiple responsibilities (connection settings, 2 YAML editors, help dialog, validation)
3. ⚠️ **Missing standards** - No react-hook-form + zod for connection form, custom message system instead of toast
4. 🔁 **Code duplication** - YAML validation logic duplicated across tabs
5. 🗂️ **Poor structure** - Single file instead of feature-based organization (components/, hooks/, dialogs/)
6. 🎨 **Inline dialogs** - Two large dialogs (help, validation) embedded in main component

**Solution:**
1. ✅ **Migrate to TanStack Query** - Replaces manual loading/saving with automatic caching/mutations
2. ✅ **Decompose component** - Extract dialogs, create reusable YAML editor component
3. ✅ **Add mutation hooks** - use-checkmk-mutations for save/validate/test operations
4. ✅ **Use toast notifications** - Replace custom message state with `useToast()`
5. ✅ **Feature-based structure** - components/, hooks/, dialogs/, types/, utils/
6. ✅ **Form validation** - react-hook-form + zod for connection settings form
7. ✅ **Reusable YAML editor** - Shared component for both YAML tabs

**Critical Path:** Phase 1 (foundation) → Phase 3 (TanStack Query) → Phase 2 (components) → Phase 4 (refactor main component)

**Minimum Viable:** Phases 1-3 establishes proper architecture per CLAUDE.md

---

## Executive Summary

The CheckMK Settings component contains **989 lines** in a single monolithic file with **critical architecture violations** and poor separation of concerns:

1. **Architecture Violation** - Uses manual state management (`useState` + `useEffect`) instead of mandatory TanStack Query
2. **Monolithic Structure** - Single 989-line component handling connection settings, 2 YAML editors, help dialog, validation
3. **Custom Message System** - Manual state with `setTimeout` instead of Shadcn toast notifications
4. **Missing Standards** - No react-hook-form + zod for connection form, inline dialogs, poor component boundaries
5. **Duplicate Logic** - YAML validation and save logic duplicated across tabs

**Bottom Line:** TanStack Query migration is not optional—it's mandatory per CLAUDE.md. Component decomposition will reduce from 989 lines to ~200-250 lines for main component plus reusable infrastructure.

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Manual `useState` + `useEffect` | **TanStack Query with auto-caching** |
| Manual loading states | **useQuery/useMutation built-in states** |
| Custom message with `setTimeout` | **Toast notifications (useToast)** |
| Manual error handling | **TanStack Query built-in error handling** |
| 989-line monolithic component | **Feature-based structure with decomposed components** |
| Inline dialogs (2 dialogs) | **Separate dialog components in dialogs/** |
| No form validation | **react-hook-form + zod** |
| Inline callbacks without memoization | **Proper useCallback with stable dependencies** |

---

## Current Architecture

```
frontend/src/components/features/settings/connections/checkmk/
└── checkmk-settings.tsx             # 989 lines - Everything in one file
    ├── Connection Settings Form     # ~177 lines
    ├── CheckMK Config YAML Tab      # ~79 lines
    ├── Queries YAML Tab             # ~68 lines
    ├── Help Dialog                  # ~277 lines
    ├── Validation Error Dialog      # ~57 lines
    ├── Loading/Message Logic        # ~70 lines
    └── State Management             # ~261 lines
```

**Total:** 989 lines in single file

---

## Problem Analysis

### Problem 1: Architecture Violation - Manual State Instead of TanStack Query

**Affected Lines:** 40-64, 77-143

**Current Pattern:**
```tsx
// Lines 40-46
const [settings, setSettings] = useState<CheckMKSettings>({
  url: '',
  site: '',
  username: '',
  password: '',
  verify_ssl: true
})

// Lines 53-55
const [checkmkYaml, setCheckmkYaml] = useState('')
const [checkmkQueriesYaml, setCheckmkQueriesYaml] = useState('')
const [yamlLoading, setYamlLoading] = useState(false)

// Lines 77-90
const loadSettings = useCallback(async () => {
  try {
    setIsLoading(true)
    const data: ApiResponse = await apiCall('settings/checkmk')
    if (data.success && data.data) {
      setSettings(data.data)
    }
  } catch (error) {
    console.error('Error loading CheckMK settings:', error)
    showMessage('Failed to load settings', 'error')
  } finally {
    setIsLoading(false)
  }
}, [apiCall, showMessage])

// Lines 92-137
const loadYamlFiles = useCallback(async () => {
  try {
    setYamlLoading(true)
    // Manual Promise.allSettled logic
    const [checkmkResponse, queriesResponse] = await Promise.allSettled([
      apiCall('config/checkmk.yaml'),
      apiCall('config/checkmk_queries.yaml')
    ])
    // Manual response handling for each file...
  } catch (error) {
    showMessage('Failed to load YAML configuration files', 'error')
  } finally {
    setYamlLoading(false)
  }
}, [apiCall, showMessage])

// Lines 140-143
useEffect(() => {
  loadSettings()
  loadYamlFiles()
}, [loadSettings, loadYamlFiles])
```

**Issue:**
- Manual loading state management
- Custom error handling
- No caching
- No automatic refetching
- Violates CLAUDE.md mandate to use TanStack Query

**Should Be:**
```tsx
// With TanStack Query
const { data: settings, isLoading: settingsLoading } = useCheckMKSettingsQuery()
const { data: checkmkYaml, isLoading: yamlLoading } = useCheckMKYamlQuery()
const { data: queriesYaml } = useCheckMKQueriesQuery()
const { mutate: saveSettings } = useSaveCheckMKSettingsMutation()
const { mutate: testConnection } = useTestCheckMKConnectionMutation()
```

**Benefits:**
- ✅ Automatic caching
- ✅ Built-in loading/error states
- ✅ No manual `useEffect`
- ✅ Automatic background refetching
- ✅ Proper error handling with toast

---

### Problem 2: Custom Message System Instead of Toast

**Affected Lines:** 48-49, 67-75

**Current Pattern:**
```tsx
const [status, setStatus] = useState<StatusType>('idle')
const [message, setMessage] = useState('')

const showMessage = useCallback((msg: string, type: 'success' | 'error') => {
  setMessage(msg)
  setStatus(type === 'success' ? 'success' : 'error')

  setTimeout(() => {
    setMessage('')
    setStatus('idle')
  }, 5000)
}, [])

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

**Affected Lines:** Entire file (989 lines)

**Current Responsibilities:**
1. Connection settings form (lines 320-496)
2. CheckMK config YAML editor (lines 498-577)
3. Queries YAML editor (lines 579-647)
4. Help dialog (lines 650-927)
5. Validation error dialog (lines 929-986)
6. State management for all above (lines 40-64)
7. API calls for load/save/validate/test (lines 77-263)

**Issue:**
- Single component doing too many things
- Hard to test individual pieces
- YAML editor logic duplicated between tabs
- Poor separation of concerns
- Help dialog is 277 lines of inline JSX

**Should Be:**
```
components/
├── checkmk-settings.tsx             # ~200-250 lines - Main component with tabs
├── connection-settings-form.tsx     # ~150 lines - Connection form (react-hook-form + zod)
└── yaml-editor-card.tsx            # ~100 lines - Reusable YAML editor

dialogs/
├── checkmk-help-dialog.tsx          # ~280 lines - Help content
└── yaml-validation-dialog.tsx       # ~60 lines - Validation errors

hooks/
├── use-checkmk-settings-query.ts    # ~40 lines - TanStack Query hook
├── use-checkmk-yaml-queries.ts      # ~80 lines - YAML file queries
└── use-checkmk-mutations.ts         # ~150 lines - Save/validate/test mutations

types/
└── index.ts                         # ~60 lines - Type definitions

utils/
└── constants.ts                     # ~30 lines - Constants
```

---

### Problem 4: Connection Form - No Form Validation

**Affected Lines:** 320-496

**Current Pattern:**
```tsx
// Manual state for each field
const [settings, setSettings] = useState<CheckMKSettings>({
  url: '',
  site: '',
  username: '',
  password: '',
  verify_ssl: true
})

// Manual update function
const updateSetting = (key: keyof CheckMKSettings, value: string | boolean) => {
  setSettings(prev => ({ ...prev, [key]: value }))
}

// Manual validation in buttons
disabled={!settings.url || !settings.site || !settings.username || !settings.password}
```

**Issue:**
- No react-hook-form
- No zod validation
- Manual state management for form fields
- Manual validation logic
- Violates CLAUDE.md form standards

**Should Be:**
```tsx
const settingsSchema = z.object({
  url: z.string().url('Invalid URL').min(1, 'URL is required'),
  site: z.string().min(1, 'Site is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  verify_ssl: z.boolean(),
})

const form = useForm({
  resolver: zodResolver(settingsSchema),
  defaultValues: DEFAULT_SETTINGS,
})
```

---

### Problem 5: Inline Dialogs - Poor Component Boundaries

**Affected Lines:** 650-927 (help), 929-986 (validation)

**Issue:**
- Two large dialogs embedded in main component
- ~334 lines of dialog code in main component
- Cannot reuse help dialog elsewhere
- Makes main component harder to read
- Help dialog has extensive CheckMK-specific content

**Should Be:**
```tsx
// In main component
<CheckMKHelpDialog
  open={showHelpDialog}
  onOpenChange={setShowHelpDialog}
/>

<YamlValidationDialog
  open={showValidationDialog}
  onOpenChange={setShowValidationDialog}
  error={validationError}
  filename={currentFilename}
/>
```

---

### Problem 6: YAML Editor Duplication

**Affected Lines:** 498-577, 579-647

**Issue:**
- Two nearly identical YAML editor tabs
- Same validation logic duplicated
- Same save logic duplicated
- Different only by filename and content state

**Should Be:**
```tsx
<YamlEditorCard
  title="CheckMK Configuration (checkmk.yaml)"
  value={checkmkYaml}
  onChange={setCheckmkYaml}
  onSave={() => saveYamlFile('checkmk.yaml', checkmkYaml)}
  onValidate={() => validateYaml(checkmkYaml, 'checkmk.yaml')}
  onReload={refetchCheckmkYaml}
  isLoading={yamlLoading}
  showHelp={true}
  onHelpClick={() => setShowHelpDialog(true)}
/>
```

---

### Problem 7: Missing Type Definitions

**Issue:**
- Inline type definitions scattered throughout
- No centralized types file
- Type definitions in component file (lines 22-36)

**Current Types (inline):**
```tsx
// Lines 22-34
interface CheckMKSettings {
  url: string
  site: string
  username: string
  password: string
  verify_ssl: boolean
}

interface ApiResponse {
  success: boolean
  data?: CheckMKSettings
  message?: string
}

type StatusType = 'idle' | 'testing' | 'success' | 'error' | 'saving'
```

**Should Have:**
```tsx
// types/index.ts
export interface CheckMKSettings {
  url: string
  site: string
  username: string
  password: string
  verify_ssl: boolean
}

export interface ValidationError {
  message: string
  error?: string
  line?: number
  column?: number
}

export interface YamlFile {
  filename: 'checkmk.yaml' | 'checkmk_queries.yaml'
  content: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
}

export interface ValidationResponse {
  success: boolean
  valid: boolean
  message?: string
  error?: string
  line?: number
  column?: number
}

export interface TestConnectionResponse {
  success: boolean
  message?: string
}
```

---

### Problem 8: No Query Keys Defined

**Issue:**
- No query keys in centralized factory (`/lib/query-keys.ts`)
- Cannot invalidate cache properly
- Missing foundation for TanStack Query

**Should Have:**
```tsx
// In /frontend/src/lib/query-keys.ts
checkmkSettings: {
  all: ['checkmkSettings'] as const,
  settings: () => [...queryKeys.checkmkSettings.all, 'settings'] as const,
  yaml: () => [...queryKeys.checkmkSettings.all, 'yaml'] as const,
  checkmkYaml: () => [...queryKeys.checkmkSettings.yaml(), 'checkmk'] as const,
  queriesYaml: () => [...queryKeys.checkmkSettings.yaml(), 'queries'] as const,
},
```

---

## Proposed Refactoring Plan

### Phase 1: Foundation & Setup (CRITICAL)

**1.1: Verify Backend Architecture**

- [ ] Confirm backend endpoints use repository pattern
- [ ] Verify `/settings/checkmk` endpoint exists (GET/POST)
- [ ] Check `/settings/test/checkmk` endpoint for testing connection
- [ ] Verify `/config/checkmk.yaml` and `/config/checkmk_queries.yaml` endpoints
- [ ] Check `/config/validate` endpoint for YAML validation
- [ ] Ensure proper error handling in backend

**Estimated effort:** 30 minutes

---

**1.2: Add Query Keys to Centralized Factory**

**File:** `/frontend/src/lib/query-keys.ts` (modify)

```tsx
// Add to existing queryKeys object
checkmkSettings: {
  all: ['checkmkSettings'] as const,
  settings: () => [...queryKeys.checkmkSettings.all, 'settings'] as const,
  yaml: () => [...queryKeys.checkmkSettings.all, 'yaml'] as const,
  checkmkYaml: () => [...queryKeys.checkmkSettings.yaml(), 'checkmk'] as const,
  queriesYaml: () => [...queryKeys.checkmkSettings.yaml(), 'queries'] as const,
},
```

**Estimated effort:** 15 minutes

---

**1.3: Create Type Definitions**

**File:** `components/features/settings/connections/checkmk/types/index.ts` (new)

```tsx
export interface CheckMKSettings {
  url: string
  site: string
  username: string
  password: string
  verify_ssl: boolean
}

export interface ValidationError {
  message: string
  error?: string
  line?: number
  column?: number
}

export interface YamlFile {
  filename: 'checkmk.yaml' | 'checkmk_queries.yaml'
  content: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
}

export interface ValidationResponse {
  success: boolean
  valid: boolean
  message?: string
  error?: string
  line?: number
  column?: number
}

export interface TestConnectionResponse {
  success: boolean
  message?: string
}

export interface SaveYamlResponse {
  success: boolean
  message?: string
}

export interface LoadYamlResponse {
  success: boolean
  data?: string
  message?: string
}
```

**Estimated effort:** 30 minutes

---

**1.4: Create Constants**

**File:** `components/features/settings/connections/checkmk/utils/constants.ts` (new)

```tsx
import type { CheckMKSettings } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const DEFAULT_CHECKMK_SETTINGS: CheckMKSettings = {
  url: '',
  site: '',
  username: '',
  password: '',
  verify_ssl: true,
} as const

export const EMPTY_STRING = ''

export const YAML_FILES = {
  CHECKMK: 'checkmk.yaml',
  QUERIES: 'checkmk_queries.yaml',
} as const

export const CACHE_TIME = {
  SETTINGS: 5 * 60 * 1000,  // 5 minutes
  YAML: 2 * 60 * 1000,      // 2 minutes
} as const

export const MESSAGE_TIMEOUT = 5000 as const

export const TAB_VALUES = {
  CONNECTION: 'connection',
  CHECKMK_CONFIG: 'checkmk-config',
  QUERIES: 'queries',
} as const
```

**Estimated effort:** 20 minutes

---

### Phase 3: TanStack Query Migration (CRITICAL - Mandatory)

**3.1: Create Query Hooks**

**File:** `hooks/use-checkmk-settings-query.ts` (new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiResponse, CheckMKSettings } from '../types'
import { CACHE_TIME } from '../utils/constants'

interface UseCheckMKSettingsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCheckMKSettingsQueryOptions = { enabled: true }

/**
 * Fetch CheckMK connection settings with automatic caching
 */
export function useCheckMKSettingsQuery(
  options: UseCheckMKSettingsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.checkmkSettings.settings(),
    queryFn: async () => {
      const response = await apiCall<ApiResponse<CheckMKSettings>>('settings/checkmk')

      if (response.success && response.data) {
        return response.data
      }

      throw new Error('Failed to load CheckMK settings')
    },
    enabled,
    staleTime: CACHE_TIME.SETTINGS,
  })
}
```

**Estimated effort:** 30 minutes

---

**3.2: Create YAML Query Hooks**

**File:** `hooks/use-checkmk-yaml-queries.ts` (new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { LoadYamlResponse } from '../types'
import { CACHE_TIME, YAML_FILES } from '../utils/constants'

interface UseYamlQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseYamlQueryOptions = { enabled: true }

/**
 * Fetch CheckMK YAML configuration file
 */
export function useCheckMKYamlQuery(options: UseYamlQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.checkmkSettings.checkmkYaml(),
    queryFn: async () => {
      try {
        const response = await apiCall<LoadYamlResponse>(`config/${YAML_FILES.CHECKMK}`)

        if (response.success && response.data) {
          return response.data
        }

        // File doesn't exist, return empty string
        return ''
      } catch (error) {
        console.warn('Failed to load checkmk.yaml:', error)
        return ''
      }
    },
    enabled,
    staleTime: CACHE_TIME.YAML,
  })
}

/**
 * Fetch CheckMK queries YAML configuration file
 */
export function useCheckMKQueriesQuery(options: UseYamlQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.checkmkSettings.queriesYaml(),
    queryFn: async () => {
      try {
        const response = await apiCall<LoadYamlResponse>(`config/${YAML_FILES.QUERIES}`)

        if (response.success && response.data) {
          return response.data
        }

        // File doesn't exist, return empty string
        return ''
      } catch (error) {
        console.warn('Failed to load checkmk_queries.yaml:', error)
        return ''
      }
    },
    enabled,
    staleTime: CACHE_TIME.YAML,
  })
}
```

**Estimated effort:** 45 minutes

---

**3.3: Create Mutation Hooks**

**File:** `hooks/use-checkmk-mutations.ts` (new)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type {
  CheckMKSettings,
  ValidationResponse,
  TestConnectionResponse,
  SaveYamlResponse,
  ApiResponse,
} from '../types'
import { useMemo } from 'react'

export function useCheckMKMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  /**
   * Save CheckMK connection settings
   */
  const saveSettings = useMutation({
    mutationFn: async (settings: CheckMKSettings) => {
      const response = await apiCall<ApiResponse<CheckMKSettings>>('settings/checkmk', {
        method: 'POST',
        body: JSON.stringify(settings),
      })

      if (!response.success) {
        throw new Error(response.message || 'Failed to save settings')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checkmkSettings.settings() })
      toast({
        title: 'Success',
        description: 'CheckMK settings saved successfully!',
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
   * Test CheckMK connection
   */
  const testConnection = useMutation({
    mutationFn: async (settings: CheckMKSettings) => {
      const response = await apiCall<TestConnectionResponse>('settings/test/checkmk', {
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
   * Validate YAML content
   */
  const validateYaml = useMutation({
    mutationFn: async ({ content, filename }: { content: string; filename: string }) => {
      const response = await apiCall<ValidationResponse>('config/validate', {
        method: 'POST',
        body: JSON.stringify({ content }),
      })

      if (!response.success || !response.valid) {
        throw {
          message: response.message || 'Invalid YAML',
          error: response.error,
          line: response.line,
          column: response.column,
          filename,
        }
      }

      return response
    },
    onSuccess: (_, variables) => {
      toast({
        title: 'Validation Successful',
        description: `${variables.filename} is valid YAML`,
      })
    },
    onError: (error: any) => {
      // Error will be handled by component (show dialog)
      console.error('YAML validation error:', error)
    },
  })

  /**
   * Save YAML file
   */
  const saveYaml = useMutation({
    mutationFn: async ({ filename, content }: { filename: string; content: string }) => {
      const response = await apiCall<SaveYamlResponse>(`config/${filename}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })

      if (!response.success) {
        throw new Error(response.message || `Failed to save ${filename}`)
      }

      return { filename, response }
    },
    onSuccess: ({ filename }) => {
      // Invalidate appropriate query based on filename
      if (filename === 'checkmk.yaml') {
        queryClient.invalidateQueries({ queryKey: queryKeys.checkmkSettings.checkmkYaml() })
      } else if (filename === 'checkmk_queries.yaml') {
        queryClient.invalidateQueries({ queryKey: queryKeys.checkmkSettings.queriesYaml() })
      }

      toast({
        title: 'Success',
        description: `${filename} saved successfully!`,
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
      validateYaml,
      saveYaml,
    }),
    [saveSettings, testConnection, validateYaml, saveYaml]
  )
}
```

**Benefits:**
- ✅ Automatic cache invalidation
- ✅ Built-in optimistic updates support
- ✅ Consistent error/success handling with toast
- ✅ Loading states for each mutation

**Estimated effort:** 2 hours

---

### Phase 2: Create Reusable Components

**2.1: Create YAML Validation Dialog**

**File:** `dialogs/yaml-validation-dialog.tsx` (new)

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import type { ValidationError } from '../types'

interface YamlValidationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  error: ValidationError | null
  filename?: string
}

export function YamlValidationDialog({
  open,
  onOpenChange,
  error,
  filename = 'YAML file',
}: YamlValidationDialogProps) {
  if (!error) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>YAML Validation Error</span>
          </DialogTitle>
          <DialogDescription>
            The {filename} contains syntax errors that need to be fixed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-800 mb-2">Error Details:</h4>
            <div className="space-y-2 text-sm">
              {error.line && error.column && (
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-red-700">Location:</span>
                  <span className="text-red-900">
                    Line {error.line}, Column {error.column}
                  </span>
                </div>
              )}
              {error.error && (
                <div className="space-y-1">
                  <span className="font-medium text-red-700">Error Message:</span>
                  <pre className="bg-white border border-red-300 rounded p-3 text-xs overflow-x-auto text-red-900 whitespace-pre-wrap">
                    {error.error}
                  </pre>
                </div>
              )}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Common YAML Issues:</h4>
            <ul className="text-sm text-blue-900 space-y-1 list-disc list-inside">
              <li>Check for proper indentation (use spaces, not tabs)</li>
              <li>Ensure colons are followed by a space</li>
              <li>Verify quotes are properly closed</li>
              <li>Check for special characters that need escaping</li>
            </ul>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Estimated effort:** 30 minutes

---

**2.2: Create CheckMK Help Dialog**

**File:** `dialogs/checkmk-help-dialog.tsx` (new)

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'

interface CheckMKHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CheckMKHelpDialog({ open, onOpenChange }: CheckMKHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[54rem] !max-w-[54rem] w-[85vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            <span>CheckMK Configuration Help</span>
          </DialogTitle>
          <DialogDescription>
            Understanding the Nautobot to CheckMK synchronization and configuration options
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Copy all help content from lines 663-920 of original file */}
          {/* This is the exact same content, just extracted to a separate component */}
          {/* ... (full help content here) ... */}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Note:** This component will contain all the help content from the original file (lines 663-920)

**Estimated effort:** 45 minutes

---

**2.3: Create Reusable YAML Editor Card**

**File:** `components/yaml-editor-card.tsx` (new)

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, CheckCircle, RotateCcw, FileText, HelpCircle } from 'lucide-react'

interface YamlEditorCardProps {
  title: string
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onValidate: () => void
  onReload: () => void
  isLoading?: boolean
  isValidating?: boolean
  isSaving?: boolean
  showHelp?: boolean
  onHelpClick?: () => void
  description?: string
}

export function YamlEditorCard({
  title,
  value,
  onChange,
  onSave,
  onValidate,
  onReload,
  isLoading = false,
  isValidating = false,
  isSaving = false,
  showHelp = false,
  onHelpClick,
  description = 'Edit the YAML configuration file.',
}: YamlEditorCardProps) {
  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            <span>{title}</span>
          </div>
          {showHelp && onHelpClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onHelpClick}
              className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
              title="Show help and examples"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Configuration Content</Label>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="YAML content will be loaded here..."
            className="w-full h-96 font-mono text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500">{description}</p>
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onReload}
            disabled={isLoading || isValidating || isSaving}
            className="flex items-center space-x-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            <span>Reload</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onValidate}
            disabled={isLoading || isValidating || isSaving || !value}
            className="flex items-center space-x-2"
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <span>Check YAML</span>
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={isLoading || isValidating || isSaving}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span>Save Configuration</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Benefits:**
- ✅ Reusable for both YAML tabs
- ✅ Eliminates code duplication
- ✅ Consistent UI across editors
- ✅ Easy to add new YAML editors

**Estimated effort:** 1 hour

---

**2.4: Create Connection Settings Form (with react-hook-form + zod)**

**File:** `components/connection-settings-form.tsx` (new)

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form'
import { Loader2, CheckCircle, XCircle, Server, Settings, RotateCcw } from 'lucide-react'
import type { CheckMKSettings } from '../types'
import { useMemo } from 'react'

const settingsSchema = z.object({
  url: z.string().url('Invalid URL').min(1, 'URL is required'),
  site: z.string().min(1, 'Site is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  verify_ssl: z.boolean(),
})

type SettingsFormData = z.infer<typeof settingsSchema>

interface ConnectionSettingsFormProps {
  settings: CheckMKSettings
  onSave: (settings: CheckMKSettings) => void
  onTest: (settings: CheckMKSettings) => void
  onReset: () => void
  isSaving?: boolean
  isTesting?: boolean
  testStatus?: 'idle' | 'success' | 'error'
  testMessage?: string
}

export function ConnectionSettingsForm({
  settings,
  onSave,
  onTest,
  onReset,
  isSaving = false,
  isTesting = false,
  testStatus = 'idle',
  testMessage = '',
}: ConnectionSettingsFormProps) {
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
    values: settings, // Sync with external settings
  })

  const handleSave = form.handleSubmit((data) => {
    onSave(data)
  })

  const handleTest = form.handleSubmit((data) => {
    onTest(data)
  })

  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
        <CardTitle className="flex items-center space-x-2 text-sm font-medium">
          <Settings className="h-4 w-4" />
          <span>CheckMK Connection Settings</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
        <Form {...form}>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CheckMK URL */}
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      CheckMK Server URL <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://checkmk.example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The base URL of your CheckMK instance
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Site */}
              <FormField
                control={form.control}
                name="site"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Site <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter your CheckMK site name (e.g., 'cmk')"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The CheckMK site name (usually &apos;cmk&apos; for default installations)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Username */}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Username <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter your CheckMK username"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Your CheckMK login username</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Password <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your CheckMK password"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Your CheckMK login password or API key
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* SSL Verification */}
              <FormField
                control={form.control}
                name="verify_ssl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SSL Verification</FormLabel>
                    <div className="flex items-center space-x-2 p-3 bg-white rounded-lg border border-gray-200">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <label className="text-sm text-gray-700">
                        Verify SSL certificates
                      </label>
                    </div>
                    <FormDescription>
                      Uncheck only for development environments
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Test Connection Button */}
            <div className="pt-4 border-t border-gray-200">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTest}
                      disabled={isTesting || !form.formState.isValid}
                      className="flex items-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      {isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Server className="h-4 w-4" />
                      )}
                      <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                    </Button>

                    {/* Connection Status */}
                    {testStatus === 'success' && (
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Connection successful!</span>
                      </div>
                    )}

                    {testStatus === 'error' && testMessage && (
                      <div className="flex items-center space-x-2 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">{testMessage}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-blue-600 font-medium">
                    Test your connection before saving
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onReset}
                  className="flex items-center space-x-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Reset to Defaults</span>
                </Button>

                <Button
                  type="submit"
                  disabled={isSaving || !form.formState.isValid}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 text-base font-medium"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
```

**Benefits:**
- ✅ Proper form validation with react-hook-form + zod
- ✅ Type-safe form data
- ✅ Built-in error handling
- ✅ Accessible form fields
- ✅ Clean separation from main component

**Estimated effort:** 1.5 hours

---

### Phase 4: Refactor Main Component

**File:** `checkmk-settings.tsx`

**Changes:**
1. Remove manual state management (use TanStack Query)
2. Replace custom message system with toast
3. Extract dialogs to separate components
4. Use ConnectionSettingsForm component
5. Use YamlEditorCard for both YAML tabs
6. Reduce from 989 lines to ~200-250 lines
7. Use proper hooks and memoization

**Example refactored code:**

```tsx
'use client'

import { useState, useCallback, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Settings, FileText, Shield } from 'lucide-react'
import { useCheckMKSettingsQuery } from './hooks/use-checkmk-settings-query'
import { useCheckMKYamlQuery, useCheckMKQueriesQuery } from './hooks/use-checkmk-yaml-queries'
import { useCheckMKMutations } from './hooks/use-checkmk-mutations'
import { ConnectionSettingsForm } from './components/connection-settings-form'
import { YamlEditorCard } from './components/yaml-editor-card'
import { CheckMKHelpDialog } from './dialogs/checkmk-help-dialog'
import { YamlValidationDialog } from './dialogs/yaml-validation-dialog'
import type { CheckMKSettings, ValidationError } from './types'
import { DEFAULT_CHECKMK_SETTINGS, TAB_VALUES, YAML_FILES, EMPTY_STRING } from './utils/constants'

export default function CheckMKSettingsForm() {
  // TanStack Query - no manual state management needed
  const {
    data: settings = DEFAULT_CHECKMK_SETTINGS,
    isLoading: settingsLoading,
  } = useCheckMKSettingsQuery()

  const {
    data: checkmkYaml = EMPTY_STRING,
    isLoading: checkmkYamlLoading,
    refetch: refetchCheckmkYaml,
  } = useCheckMKYamlQuery()

  const {
    data: queriesYaml = EMPTY_STRING,
    isLoading: queriesYamlLoading,
    refetch: refetchQueriesYaml,
  } = useCheckMKQueriesQuery()

  const { saveSettings, testConnection, validateYaml, saveYaml } = useCheckMKMutations()

  // Local state for UI only (not server data)
  const [localCheckmkYaml, setLocalCheckmkYaml] = useState(checkmkYaml)
  const [localQueriesYaml, setLocalQueriesYaml] = useState(queriesYaml)
  const [activeTab, setActiveTab] = useState(TAB_VALUES.CONNECTION)
  const [validationError, setValidationError] = useState<ValidationError | null>(null)
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

  // Update local content when query data changes
  useMemo(() => {
    setLocalCheckmkYaml(checkmkYaml)
  }, [checkmkYaml])

  useMemo(() => {
    setLocalQueriesYaml(queriesYaml)
  }, [queriesYaml])

  // Callbacks with useCallback for stability
  const handleSaveSettings = useCallback(
    (data: CheckMKSettings) => {
      saveSettings.mutate(data)
    },
    [saveSettings]
  )

  const handleTestConnection = useCallback(
    async (data: CheckMKSettings) => {
      setTestStatus('idle')
      setTestMessage('')

      testConnection.mutate(data, {
        onSuccess: () => {
          setTestStatus('success')
          setTestMessage('Connection successful!')
          setTimeout(() => {
            setTestStatus('idle')
            setTestMessage('')
          }, 5000)
        },
        onError: (error: Error) => {
          setTestStatus('error')
          setTestMessage(error.message)
          setTimeout(() => {
            setTestStatus('idle')
            setTestMessage('')
          }, 5000)
        },
      })
    },
    [testConnection]
  )

  const handleResetSettings = useCallback(() => {
    // Reset form will be handled by ConnectionSettingsForm
  }, [])

  const handleValidateCheckmk = useCallback(() => {
    setValidationError(null)
    validateYaml.mutate(
      { content: localCheckmkYaml, filename: YAML_FILES.CHECKMK },
      {
        onError: (error: any) => {
          setValidationError(error)
          setShowValidationDialog(true)
        },
      }
    )
  }, [localCheckmkYaml, validateYaml])

  const handleValidateQueries = useCallback(() => {
    setValidationError(null)
    validateYaml.mutate(
      { content: localQueriesYaml, filename: YAML_FILES.QUERIES },
      {
        onError: (error: any) => {
          setValidationError(error)
          setShowValidationDialog(true)
        },
      }
    )
  }, [localQueriesYaml, validateYaml])

  const handleSaveCheckmk = useCallback(() => {
    saveYaml.mutate({ filename: YAML_FILES.CHECKMK, content: localCheckmkYaml })
  }, [localCheckmkYaml, saveYaml])

  const handleSaveQueries = useCallback(() => {
    saveYaml.mutate({ filename: YAML_FILES.QUERIES, content: localQueriesYaml })
  }, [localQueriesYaml, saveYaml])

  const handleReloadCheckmk = useCallback(() => {
    refetchCheckmkYaml()
  }, [refetchCheckmkYaml])

  const handleReloadQueries = useCallback(() => {
    refetchQueriesYaml()
  }, [refetchQueriesYaml])

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">CheckMK Settings</h1>
            <p className="text-gray-600">
              Configure your CheckMK server connection and configuration files
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value={TAB_VALUES.CONNECTION} className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Connection</span>
          </TabsTrigger>
          <TabsTrigger value={TAB_VALUES.CHECKMK_CONFIG} className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>CheckMK Config</span>
          </TabsTrigger>
          <TabsTrigger value={TAB_VALUES.QUERIES} className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Queries</span>
          </TabsTrigger>
        </TabsList>

        {/* Connection Settings Tab */}
        <TabsContent value={TAB_VALUES.CONNECTION} className="space-y-6">
          <ConnectionSettingsForm
            settings={settings}
            onSave={handleSaveSettings}
            onTest={handleTestConnection}
            onReset={handleResetSettings}
            isSaving={saveSettings.isPending}
            isTesting={testConnection.isPending}
            testStatus={testStatus}
            testMessage={testMessage}
          />
        </TabsContent>

        {/* CheckMK Configuration Tab */}
        <TabsContent value={TAB_VALUES.CHECKMK_CONFIG} className="space-y-6">
          <YamlEditorCard
            title={`CheckMK Configuration (${YAML_FILES.CHECKMK})`}
            value={localCheckmkYaml}
            onChange={setLocalCheckmkYaml}
            onSave={handleSaveCheckmk}
            onValidate={handleValidateCheckmk}
            onReload={handleReloadCheckmk}
            isLoading={checkmkYamlLoading}
            isValidating={validateYaml.isPending}
            isSaving={saveYaml.isPending}
            showHelp={true}
            onHelpClick={() => setShowHelpDialog(true)}
            description="Edit the CheckMK configuration YAML file. This controls site mapping, folder structure, and host tag groups."
          />
        </TabsContent>

        {/* Queries Tab */}
        <TabsContent value={TAB_VALUES.QUERIES} className="space-y-6">
          <YamlEditorCard
            title={`CheckMK Queries Configuration (${YAML_FILES.QUERIES})`}
            value={localQueriesYaml}
            onChange={setLocalQueriesYaml}
            onSave={handleSaveQueries}
            onValidate={handleValidateQueries}
            onReload={handleReloadQueries}
            isLoading={queriesYamlLoading}
            isValidating={validateYaml.isPending}
            isSaving={saveYaml.isPending}
            description="Edit the CheckMK queries configuration YAML file. This defines custom queries and filters for CheckMK."
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CheckMKHelpDialog open={showHelpDialog} onOpenChange={setShowHelpDialog} />

      <YamlValidationDialog
        open={showValidationDialog}
        onOpenChange={setShowValidationDialog}
        error={validationError}
        filename={validationError?.filename}
      />
    </div>
  )
}
```

**Before:** 989 lines
**After:** ~200-250 lines
**Reduction:** ~740 lines (75%)

**Key Changes:**
- ✅ No manual state management (TanStack Query)
- ✅ No custom message system (toast)
- ✅ Extracted dialogs (2 separate components)
- ✅ Reusable YAML editor component
- ✅ Proper form validation with react-hook-form + zod
- ✅ Proper memoization with constants
- ✅ Clean component boundaries

**Estimated effort:** 2.5 hours

---

## Final Directory Structure (After Refactoring)

```
frontend/src/components/features/settings/connections/checkmk/
├── checkmk-settings.tsx             # ~200-250 lines (was 989, -75%)
├── components/
│   ├── connection-settings-form.tsx # ~180 lines (new, react-hook-form + zod)
│   └── yaml-editor-card.tsx         # ~100 lines (new, reusable)
├── dialogs/
│   ├── checkmk-help-dialog.tsx      # ~280 lines (new)
│   └── yaml-validation-dialog.tsx   # ~60 lines (new)
├── hooks/
│   ├── use-checkmk-settings-query.ts    # ~40 lines (new)
│   ├── use-checkmk-yaml-queries.ts      # ~80 lines (new)
│   └── use-checkmk-mutations.ts         # ~150 lines (new)
├── types/
│   └── index.ts                     # ~60 lines (new)
└── utils/
    └── constants.ts                 # ~30 lines (new)
```

**Total:** ~1,180 lines (was 989)
**Main Component:** 200-250 lines (was 989, -75%)
**New Infrastructure:** ~930 lines (reusable patterns)

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `checkmk-settings.tsx` | 989 | ~200-250 | **-740 lines (-75%)** |
| **Subtotal (existing)** | **989** | **~200-250** | **-740 lines (-75%)** |
| **New files** | **0** | **~930** | **+930 lines** |
| **Grand Total** | **989** | **~1,130-1,180** | **+140 to +190 lines (+14% to +19%)** |

**Net increase:** ~140-190 lines (14-19%), but with significantly better architecture:
- TanStack Query for server state management
- Reusable YAML editor component
- Proper form validation with react-hook-form + zod
- Toast notifications instead of custom messages
- Better type safety
- Easier testing
- Improved maintainability

---

## Estimated Total Effort

| Phase | Description | Effort |
|-------|-------------|--------|
| 1.1 | Verify backend architecture | 30 min |
| 1.2 | Add query keys to factory | 15 min |
| 1.3 | Create type definitions | 30 min |
| 1.4 | Create constants | 20 min |
| 3.1 | Create settings query hook | 30 min |
| 3.2 | Create YAML query hooks | 45 min |
| 3.3 | Create mutation hooks | 2 hours |
| 2.1 | Create YAML validation dialog | 30 min |
| 2.2 | Create CheckMK help dialog | 45 min |
| 2.3 | Create reusable YAML editor card | 1 hour |
| 2.4 | Create connection settings form (react-hook-form + zod) | 1.5 hours |
| 4 | Refactor main component | 2.5 hours |
| - | Testing & Integration | 2 hours |
| **Total** | | **~13-14 hours** |

---

## Benefits After Refactoring

### Code Quality
1. **Architecture Compliance**: Uses TanStack Query as mandated by CLAUDE.md
2. **Separation of Concerns**: Clear component boundaries, single responsibility
3. **Type Safety**: Centralized type definitions, no inline types
4. **Consistency**: Uses standard patterns (toast, react-hook-form, zod)
5. **Reusability**: YAML editor component can be used elsewhere

### User Experience
1. **Better Error Handling**: Consistent toast notifications
2. **Improved Loading States**: TanStack Query built-in states
3. **No Regression**: All functionality preserved
4. **Better Form Validation**: Immediate feedback with zod

### Developer Experience
1. **Easier Testing**: Isolated components and hooks
2. **Simpler Components**: Main component reduced by 75%
3. **Reusable Patterns**: YAML editor can be used for other config files
4. **Better Maintainability**: Changes isolated to specific files

### Performance
1. **Automatic Caching**: TanStack Query reduces API calls
2. **No Memory Leaks**: Proper cleanup with TanStack Query
3. **Optimized Renders**: Proper memoization with constants

---

## TanStack Query Assessment

**Is TanStack Query a good idea for this component?**

✅ **YES - Highly Recommended**

**Reasons:**
1. **Multiple data sources**: Settings + 2 YAML files = 3 separate queries
2. **Independent refetching**: Each YAML file can be reloaded independently
3. **Automatic caching**: Reduces API calls when switching tabs
4. **Built-in error handling**: Better UX with automatic retry and error states
5. **Mutation support**: Save/test/validate operations benefit from mutation hooks
6. **CLAUDE.md compliance**: Mandatory architecture requirement

**Specific Benefits for CheckMK Settings:**
- **Tab switching**: Cached data prevents unnecessary refetches when switching between tabs
- **Connection testing**: Mutation hook provides clean loading states
- **YAML validation**: Mutation hook handles validation with proper error states
- **File reloading**: Query refetch is simpler than manual state management
- **Background refetch**: Automatically updates if files change externally

**Without TanStack Query (current):**
- ❌ Manual `useState` for each data source (3 sources)
- ❌ Manual loading states (4 loading flags)
- ❌ Custom error handling logic
- ❌ No caching (refetches on every mount)
- ❌ Complex Promise.allSettled logic

**With TanStack Query (proposed):**
- ✅ Declarative queries (3 hooks)
- ✅ Built-in loading states
- ✅ Automatic error handling
- ✅ Automatic caching
- ✅ Simple parallel queries

---

## Success Metrics

**Code Quality:**
- [x] Main component < 300 lines (target: ~200-250)
- [ ] No manual `useState` + `useEffect` for server data
- [ ] Connection form uses react-hook-form + zod
- [ ] No inline arrays/objects in default parameters
- [ ] Toast notifications instead of custom messages
- [ ] Zero ESLint warnings

**Architecture Compliance:**
- [ ] All data fetching uses TanStack Query
- [ ] Query keys in centralized factory (`/lib/query-keys.ts`)
- [ ] API calls via `/api/proxy/settings/*` and `/api/proxy/config/*`
- [ ] Feature-based folder structure (components/, hooks/, dialogs/, types/, utils/)
- [ ] All UI components from Shadcn
- [ ] Backend has repository/service/router layers

**User Experience:**
- [ ] No regression in functionality
- [ ] Improved loading states (TanStack Query)
- [ ] Better error messages (toast)
- [ ] Faster perceived performance (caching)
- [ ] Connection test workflow preserved
- [ ] YAML validation workflow preserved

**Developer Experience:**
- [ ] Easier to test (isolated hooks and components)
- [ ] Clear component boundaries
- [ ] Reusable YAML editor component
- [ ] Good documentation
- [ ] Type safety throughout

---

## Comparison with Common Settings Refactoring

| Metric | Common Settings (SNMP) | CheckMK Settings |
|--------|------------------------|------------------|
| Lines of Code | 796 (1 file) | 989 (1 file) |
| Critical Issue | Monolithic + no TanStack Query | Monolithic + no TanStack Query |
| Components | 1 large component | 1 large component |
| YAML Editors | 1 | 2 (duplicated logic) |
| Dialogs | 3 (validation, help, import) | 2 (validation, help) |
| Forms | Manual state | Manual state |
| Refactoring Priority | **MEDIUM** | **MEDIUM** |
| Estimated Effort | ~12-13 hours | ~13-14 hours |
| Main Approach | TanStack Query + decomposition | TanStack Query + decomposition |
| Code Reduction | -75% main component | -75% main component |
| New Infrastructure | ~560 lines | ~930 lines |
| Reusable Components | Git import (app-wide) | YAML editor (config files) |

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

**Common Settings (SNMP):**
- Single YAML file (SNMP mapping)
- Git import workflow (complex)
- Help dialog is SNMP-specific

**CheckMK Settings:**
- Two YAML files (config + queries)
- Connection settings form (requires validation)
- Test connection functionality
- Help dialog is CheckMK-specific (extensive)
- More mutation types (save, test, validate)

---

## Notes

- This refactoring is **recommended** - improves maintainability and compliance with CLAUDE.md
- YAML editor component is **reusable** for other config files (Nautobot settings, etc.)
- Connection form uses proper validation - can be template for other connection forms
- Consider using the same YAML editor pattern for other configuration pages
- Document the new patterns in coding guidelines for consistency
- Priority: **MEDIUM** (after critical refactorings, similar to RBAC and Common Settings)

---

**Document Version:** 1.0
**Created:** 2026-01-25
**Status:** Planning
**Priority:** Medium (tech debt, architecture compliance)
