# Refactoring Plan: Template Management Component

**Component:** `frontend/src/components/features/settings/templates/template-management.tsx`
**Created:** 2026-02-05
**Status:** Planning
**Lines of Code:** 1602

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. 🚫 **Architecture violation** - Manual `useState`/`useEffect` instead of mandatory TanStack Query
2. 📏 **Massive size** - 1602 lines, should be < 300 per component
3. 🔁 **Code duplication** - Multiple API call patterns with identical error handling
4. ⚠️ **Missing standards** - No react-hook-form + zod validation for create/edit forms
5. 🗂️ **No component decomposition** - List, create, edit, import, inventory all in one file
6. 🎭 **Mixed concerns** - Template management + inventory selection in same component
7. ⚠️ **Custom message state** - Manual message state instead of useToast()
8. 🔄 **Redundant state** - Multiple loading states, selection tracking, form state all manually managed

**Solution:**
1. ✅ **Migrate to TanStack Query** - Replaces 200+ lines of manual state with built-in caching
2. ✅ **Decompose into 8 components** - List, create form, edit form, import panel, inventory dialog, etc.
3. ✅ **Add mutation hooks** - use-template-mutations for create/update/delete/import operations
4. ✅ **Form validation** - react-hook-form + zod for create/edit forms
5. ✅ **Feature-based structure** - components/, hooks/, types/, utils/ subdirectories
6. ✅ **Remove redundancy** - Unified state management via TanStack Query

**Critical Path:** Phase 1 (foundation) → Phase 3 (TanStack Query) → Phase 2 (decomposition)

**Minimum Viable:** Phases 1-3 establishes proper architecture per CLAUDE.md

---

## Executive Summary

The Template Management component is a **monolithic 1602-line file** with critical architecture violations and significant technical debt:

1. **Architecture Violation** - Uses manual `useState` + `useEffect` instead of mandatory TanStack Query
2. **Extreme Size** - At 1602 lines, it's 5x the maximum recommended size (300 lines)
3. **No Component Decomposition** - Single component handles templates list, creation, editing, import, inventory selection
4. **Manual State Management** - 20+ separate `useState` hooks for data, loading, forms, selections
5. **Duplicate API Logic** - Multiple API call patterns with repeated error handling
6. **Missing Standards** - No react-hook-form, no zod validation, custom message state
7. **Mixed Concerns** - Template management mixed with inventory selection (Agent templates)
8. **No Shared State** - Each tab loads data independently without caching

**Bottom Line:** TanStack Query migration is mandatory per CLAUDE.md and eliminates 200+ lines of manual state management automatically. Component decomposition is critical for maintainability.

## Key Changes Summary

| Current Approach | Required Approach (CLAUDE.md) |
|------------------|-------------------------------|
| Manual `useState` + `useEffect` | **TanStack Query with auto-caching** |
| 20+ separate loading/state hooks | **TanStack Query built-in states** |
| Manual API calls with error handling | **useQuery/useMutation hooks** |
| Custom message state | **useToast() from Shadcn UI** |
| Single 1602-line component | **8 focused components < 300 lines** |
| Manual form validation | **react-hook-form + zod** |
| No query key factory | **Centralized query keys** |
| Mixed template + inventory concerns | **Separate feature domains** |

## Quick Wins (Can Start Immediately)

These tasks can be done right now without breaking existing functionality:

### 1. Extract Type Definitions (45 min)
- Create `types/index.ts`
- Move Template, TemplateFormData, ImportableTemplate, etc.
- No behavioral changes

### 2. Extract Constants (20 min)
- Create `utils/constants.ts`
- Move default form data, empty arrays
- Fixes potential re-render issues

### 3. Extract Utility Functions (45 min)
- Create `utils/template-utils.ts`
- Source badge variants, icon selection, filtering logic
- Add unit tests

### 4. Add Query Keys (20 min)
- Add to `/lib/query-keys.ts`
- Set up foundation for TanStack Query migration

### 5. Verify Backend Architecture (45 min)
- Confirm backend endpoints use repository/service/router layers
- Check for proper auth
- Verify proxy pattern: `/api/proxy/templates/*`

**Total:** ~2.5 hours
**Risk:** Zero (no behavioral changes)
**Benefit:** Immediate code quality improvement, sets up for TanStack Query migration

---

## Current Architecture

```
frontend/src/components/features/settings/templates/
└── template-management.tsx       # 1602 lines - Everything in one file
```

**Responsibilities:**
- Templates list with filtering (lines 727-1001)
- Create template form (lines 1005-1303)
- Edit template workflow (lines 257-294, 297-363)
- Import templates from YAML (lines 1307-1563)
- Inventory selection for Agent templates (lines 387-424, 1590-1598)
- File upload handling (lines 366-385)
- Bulk selection and delete (lines 237-255, 536-575)
- Template rendering (dry run) (lines 426-456)

**Total:** 1602 lines with severely mixed concerns

---

## Problem Analysis

### Problem 1: Architecture Violation - Manual State Management

**Affected Lines:** 103-152, 182-209

**Current Pattern:**
```tsx
// Lines 103-152: Manual state management
const [templates, setTemplates] = useState<Template[]>([])
const [categories, setCategories] = useState<string[]>([])
const [loadingState, setLoadingState] = useState<LoadingState>('idle')
const [message, setMessage] = useState('')

const [searchTerm, setSearchTerm] = useState('')
const [filterCategory, setFilterCategory] = useState('__all__')
const [filterSource, setFilterSource] = useState('__all__')

const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set())
const [isDeleting, setIsDeleting] = useState(false)

const [importableTemplates, setImportableTemplates] = useState<ImportableTemplate[]>([])
const [importLoading, setImportLoading] = useState(false)
const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
const [importResults, setImportResults] = useState<{ success: string[], failed: string[] }>({ success: [], failed: [] })

const [formData, setFormData] = useState<TemplateFormData>({...})
const [selectedFile, setSelectedFile] = useState<File | null>(null)
const [isCreating, setIsCreating] = useState(false)
const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
const [activeTab, setActiveTab] = useState('list')

const [selectedInventory, setSelectedInventory] = useState<{ id: number; name: string } | null>(null)
const [inventories, setInventories] = useState<SavedInventory[]>([])
const [isLoadingInventories, setIsLoadingInventories] = useState(false)
const [isRendering, setIsRendering] = useState(false)

// Lines 182-195: Manual API call with error handling
const loadTemplates = useCallback(async () => {
  setLoadingState('loading')
  try {
    const response = await apiCall<{ templates: Template[] }>('templates')
    setTemplates(response.templates || [])
    setLoadingState('success')
    clearSelection()
  } catch (error) {
    console.error('Error loading templates:', error)
    setLoadingState('error')
    showMessage('Failed to load templates', 'error')
  }
}, [apiCall, clearSelection, showMessage])
```

**Issues:**
- 20+ manual state hooks for data and UI state
- Duplicate error handling pattern across multiple functions
- No caching mechanism
- Manual loading state management
- Violates CLAUDE.md mandatory TanStack Query requirement

---

### Problem 2: Massive Component Size (1602 Lines)

**Component handles:**
1. Templates list with bulk operations (lines 780-1002)
2. Create template form with multiple source types (lines 1005-1303)
3. Edit template workflow (lines 257-294, 297-363)
4. Import templates functionality (lines 1307-1563)
5. Inventory selection dialog for Agent templates (lines 1590-1598)
6. File upload handling (lines 366-385)
7. Template rendering preview (lines 426-456)
8. Custom message display (lines 752-761)

**Should be:** 8-10 separate components with clear boundaries

**At 1602 lines:**
- 5x over recommended maximum (300 lines)
- Difficult to test in isolation
- Hard to maintain
- Performance impacts (re-renders entire tree)

---

### Problem 3: Duplicate API Call Pattern

**Affected Lines:**
- `loadTemplates()` - Lines 182-195
- `loadCategories()` - Lines 197-204
- `loadInventories()` - Lines 388-399
- `handleCreateTemplate()` - Lines 458-521
- `handleUpdateTemplate()` - Lines 297-363
- `handleDeleteTemplate()` - Lines 523-534
- `scanImportDirectory()` - Lines 628-646
- `importSelectedTemplates()` - Lines 665-706

**Identical Pattern:**
```tsx
const loadX = useCallback(async () => {
  setLoadingX(true)
  try {
    const response = await apiCall('endpoint')
    setData(response.data)
  } catch (error) {
    console.error('Failed to load X:', error)
  } finally {
    setLoadingX(false)
  }
}, [apiCall])
```

**Issue:** Every API call has identical error handling, loading state management, and data assignment logic.

---

### Problem 4: No Form Validation Standard

**Location:** Lines 1005-1303 (create/edit form)

**Current:**
- No validation schema
- Manual onChange handlers
- No form state management
- Direct state updates via `handleFormChange()`
- No validation feedback to user

**Required:** react-hook-form + zod validation per CLAUDE.md

---

### Problem 5: Custom Message State Instead of Toast

**Location:** Lines 106, 154-157, 752-761

```tsx
const [message, setMessage] = useState('')

const showMessage = useCallback((msg: string, _type: 'success' | 'error') => {
  setMessage(msg)
  setTimeout(() => setMessage(''), 5000)
}, [])

{message && (
  <div className={cn(
    "p-4 rounded-lg border",
    message.includes('success')
      ? "bg-green-50 border-green-200 text-green-800"
      : "bg-red-50 border-red-200 text-red-800"
  )}>
    {message}
  </div>
)}
```

**Issue:** Custom implementation instead of using Shadcn UI `useToast()` hook

---

### Problem 6: Mixed Concerns - Templates + Inventory

**Location:** Lines 147-152, 387-424, 1256-1268, 1590-1598

The component handles both template management AND inventory selection for Agent templates. These are separate feature domains that should be decoupled.

**Current:**
- Inventory state mixed with template state
- Inventory loading logic in template component
- Inventory selection affects template rendering

**Should be:** Separate inventory selection hook/component

---

### Problem 7: No Centralized Query Keys

**Issue:** Direct API calls without using query key factory pattern

**Example:**
```tsx
await apiCall('templates')
await apiCall('templates/categories')
await apiCall(`templates/${id}/content`)
```

**Required:** Use centralized query keys from `/lib/query-keys.ts`

---

### Problem 8: Complex Selection Logic

**Location:** Lines 113-115, 237-255, 536-575

**Current:**
- Manual `Set<number>` for selected templates
- Custom toggle functions
- Bulk operations logic mixed with component

**Issue:** Should be extracted to a custom hook or use TanStack Query's mutation capabilities

---

## Proposed Refactoring Plan

### Phase 1: Foundation & Setup (CRITICAL)

**1.1: Verify Backend Architecture & API Pattern**

- [ ] Confirm backend endpoints use repository pattern
- [ ] Verify service layer exists for template operations
- [ ] Check routers use proper auth dependencies
- [ ] **CRITICAL:** Verify API endpoints - should they be `/api/proxy/templates/*` or `/api/templates/*`?
- [ ] Check if proxy is configured for template endpoints
- [ ] Verify template import endpoints and YAML processing

**Estimated effort:** 45 minutes

---

**1.2: Add Query Keys to Centralized Factory**

**File:** `/frontend/src/lib/query-keys.ts` (modify)

```tsx
// Add to existing queryKeys object
templates: {
  all: ['templates'] as const,

  // Templates list
  list: (filters?: { category?: string; source?: string; search?: string }) =>
    filters
      ? ([...queryKeys.templates.all, 'list', filters] as const)
      : ([...queryKeys.templates.all, 'list'] as const),

  // Single template
  detail: (id: number) => [...queryKeys.templates.all, 'detail', id] as const,

  // Template content
  content: (id: number) => [...queryKeys.templates.all, 'content', id] as const,

  // Categories
  categories: () => [...queryKeys.templates.all, 'categories'] as const,

  // Importable templates
  importable: () => [...queryKeys.templates.all, 'importable'] as const,
},
```

**Estimated effort:** 20 minutes

---

**1.3: Create Type Definitions**

**File:** `components/features/settings/templates/types/index.ts` (new)

```tsx
// Template model
export interface Template {
  id: number
  name: string
  source: 'git' | 'file' | 'webeditor'
  template_type: string
  category: string
  description: string
  updated_at: string
  created_by?: string
  scope: 'global' | 'private'
  variables?: Record<string, string>
  use_nautobot_context?: boolean
  git_repo_url?: string
  git_branch?: string
  git_path?: string
}

// Template form data
export interface TemplateFormData {
  name: string
  source: 'git' | 'file' | 'webeditor' | ''
  template_type: string
  category: string
  description: string
  content?: string
  scope: 'global' | 'private'
  variables?: Record<string, string>
  use_nautobot_context?: boolean
  git_repo_url?: string
  git_branch?: string
  git_path?: string
  git_username?: string
  git_token?: string
  filename?: string
}

// Importable template (from YAML)
export interface ImportableTemplate {
  name: string
  description: string
  category: string
  source: string
  file_path: string
  template_type: string
  selected?: boolean
}

// Import response
export interface TemplateImportResponse {
  success: boolean
  message: string
  imported_count?: number
  skipped_count?: number
  errors?: string[]
  imported_templates?: string[]
  failed_templates?: string[]
}

// API Response types
export interface TemplatesResponse {
  templates: Template[]
}

export interface TemplateContentResponse {
  content: string
}

export interface CategoriesResponse extends Array<string> {}

export interface ImportableTemplatesResponse {
  templates: ImportableTemplate[]
}

// Filter types
export interface TemplateFilters {
  category?: string
  source?: string
  search?: string
}

// Loading state type
export type LoadingState = 'idle' | 'loading' | 'error' | 'success'
```

**Estimated effort:** 45 minutes

---

**1.4: Create Constants**

**File:** `components/features/settings/templates/utils/constants.ts` (new)

```tsx
import type { TemplateFormData } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const DEFAULT_TEMPLATE_FORM_DATA: TemplateFormData = {
  name: '',
  source: '',
  template_type: 'jinja2',
  category: '__none__',
  description: '',
  content: '',
  scope: 'global',
  variables: {},
  use_nautobot_context: true,
  git_repo_url: '',
  git_branch: 'main',
  git_path: '',
  git_username: '',
  git_token: ''
} as const

export const EMPTY_TEMPLATES: Template[] = []
export const EMPTY_CATEGORIES: string[] = []
export const EMPTY_IMPORTABLE: ImportableTemplate[] = []

export const STALE_TIME = {
  TEMPLATES: 30 * 1000,      // 30 seconds - moderate frequency
  CATEGORIES: 5 * 60 * 1000, // 5 minutes - rarely changes
  CONTENT: 60 * 1000,        // 1 minute - content can change
  IMPORTABLE: 2 * 60 * 1000, // 2 minutes - scan results
} as const

export const TEMPLATE_TYPES = ['jinja2', 'text', 'textfsm'] as const
export const TEMPLATE_SOURCES = ['git', 'file', 'webeditor'] as const
export const TEMPLATE_SCOPES = ['global', 'private'] as const
export const CANONICAL_CATEGORIES = ['ansible', 'onboarding', 'parser', 'netmiko', 'agent'] as const

export const FILE_ACCEPT_TYPES = '.txt,.conf,.cfg,.j2,.jinja2,.textfsm'
```

**Estimated effort:** 20 minutes

---

**1.5: Create Utility Functions**

**File:** `components/features/settings/templates/utils/template-utils.ts` (new)

```tsx
import type { Template, TemplateFilters } from '../types'

/**
 * Get badge variant based on template source
 */
export function getSourceBadgeVariant(source: string): 'default' | 'secondary' | 'outline' {
  switch (source) {
    case 'git':
      return 'default'
    case 'file':
      return 'secondary'
    case 'webeditor':
      return 'outline'
    default:
      return 'secondary'
  }
}

/**
 * Get icon component for template source
 */
export function getSourceIcon(source: string): string {
  switch (source) {
    case 'git':
      return 'GitBranch'
    case 'file':
      return 'Upload'
    case 'webeditor':
      return 'Code'
    default:
      return 'FileCode'
  }
}

/**
 * Filter templates based on search term and filters
 */
export function filterTemplates(
  templates: Template[],
  filters: TemplateFilters
): Template[] {
  return templates.filter(template => {
    const matchesSearch = !filters.search ||
      template.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      template.description?.toLowerCase().includes(filters.search.toLowerCase())

    const matchesCategory = !filters.category ||
      filters.category === '__all__' ||
      template.category === filters.category

    const matchesSource = !filters.source ||
      filters.source === '__all__' ||
      template.source === filters.source

    return matchesSearch && matchesCategory && matchesSource
  })
}

/**
 * Read file content as text
 */
export function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

/**
 * Auto-fill template name from filename
 */
export function getTemplateNameFromFile(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '')
}
```

**Estimated effort:** 45 minutes

---

### Phase 3: TanStack Query Migration (CRITICAL - Mandatory)

**Note:** TanStack Query is mandatory for all data fetching per CLAUDE.md. This replaces manual state management entirely.

**3.1: Create Query Hooks**

**File:** `hooks/use-template-queries.ts` (new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useMemo } from 'react'
import type {
  Template,
  TemplatesResponse,
  TemplateContentResponse,
  CategoriesResponse,
  ImportableTemplatesResponse,
  TemplateFilters
} from '../types'
import {
  STALE_TIME,
  EMPTY_TEMPLATES,
  EMPTY_CATEGORIES,
  EMPTY_IMPORTABLE
} from '../utils/constants'
import { filterTemplates } from '../utils/template-utils'

interface UseTemplatesOptions {
  filters?: TemplateFilters
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseTemplatesOptions = { enabled: true }

/**
 * Fetch templates list with automatic caching and filtering
 */
export function useTemplates(options: UseTemplatesOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { filters, enabled = true } = options

  const query = useQuery({
    queryKey: queryKeys.templates.list(filters),
    queryFn: async () => {
      const response = await apiCall<TemplatesResponse>('templates', { method: 'GET' })
      return response.templates || EMPTY_TEMPLATES
    },
    enabled,
    staleTime: STALE_TIME.TEMPLATES,
  })

  // Client-side filtering for better UX (no network delay)
  const filteredTemplates = useMemo(() => {
    if (!query.data) return EMPTY_TEMPLATES
    if (!filters) return query.data
    return filterTemplates(query.data, filters)
  }, [query.data, filters])

  return {
    ...query,
    templates: filteredTemplates,
    allTemplates: query.data || EMPTY_TEMPLATES
  }
}

/**
 * Fetch template categories with automatic caching
 */
export function useTemplateCategories(options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.templates.categories(),
    queryFn: async () => {
      const response = await apiCall<CategoriesResponse>('templates/categories', { method: 'GET' })
      return response || EMPTY_CATEGORIES
    },
    enabled,
    staleTime: STALE_TIME.CATEGORIES,
  })
}

/**
 * Fetch template content for editing
 */
export function useTemplateContent(templateId: number | null, options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.templates.content(templateId!),
    queryFn: async () => {
      const response = await apiCall<TemplateContentResponse>(
        `templates/${templateId}/content`,
        { method: 'GET' }
      )
      return response.content || ''
    },
    enabled: enabled && templateId !== null,
    staleTime: STALE_TIME.CONTENT,
  })
}

/**
 * Fetch importable templates from directory scan
 */
export function useImportableTemplates(options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.templates.importable(),
    queryFn: async () => {
      const response = await apiCall<ImportableTemplatesResponse>(
        'templates/scan-import',
        { method: 'GET' }
      )
      return (response.templates || EMPTY_IMPORTABLE).map(template => ({
        ...template,
        selected: true // Default to selected
      }))
    },
    enabled,
    staleTime: STALE_TIME.IMPORTABLE,
  })
}
```

**Benefits:**
- ✅ Eliminates 200+ lines of manual state management
- ✅ Built-in caching (no manual `useState`)
- ✅ Built-in loading/error states
- ✅ Automatic background refetching
- ✅ Request deduplication
- ✅ Client-side filtering with useMemo for better UX

**Estimated effort:** 2.5 hours

---

**3.2: Create Mutation Hooks**

**File:** `hooks/use-template-mutations.ts` (new)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import { useMemo } from 'react'
import type {
  Template,
  TemplateFormData,
  TemplateImportResponse
} from '../types'
import { readFileContent } from '../utils/template-utils'

interface CreateTemplateInput {
  formData: TemplateFormData
  selectedFile?: File | null
}

interface UpdateTemplateInput {
  templateId: number
  formData: TemplateFormData
  selectedFile?: File | null
}

interface ImportTemplatesInput {
  filePaths: string[]
  overwriteExisting?: boolean
}

export function useTemplateMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Create template
  const createTemplate = useMutation({
    mutationFn: async ({ formData, selectedFile }: CreateTemplateInput) => {
      const templateData: Record<string, unknown> = {
        name: formData.name,
        source: formData.source,
        template_type: formData.template_type,
        category: formData.category === '__none__' ? '' : formData.category,
        description: formData.description,
        scope: formData.scope,
        variables: formData.variables || {},
        use_nautobot_context: formData.use_nautobot_context || false
      }

      // Add source-specific data
      if (formData.source === 'git') {
        templateData.git_repo_url = formData.git_repo_url
        templateData.git_branch = formData.git_branch
        templateData.git_path = formData.git_path
        templateData.git_username = formData.git_username
        templateData.git_token = formData.git_token
      } else if (formData.source === 'webeditor') {
        templateData.content = formData.content
      } else if (formData.source === 'file' && selectedFile) {
        templateData.filename = selectedFile.name
        templateData.content = await readFileContent(selectedFile)
      }

      return apiCall('templates', {
        method: 'POST',
        body: templateData
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      toast({
        title: 'Success',
        description: 'Template created successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to create template: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Update template
  const updateTemplate = useMutation({
    mutationFn: async ({ templateId, formData, selectedFile }: UpdateTemplateInput) => {
      const templateData: Record<string, unknown> = {
        name: formData.name,
        source: formData.source,
        template_type: formData.template_type,
        category: formData.category === '__none__' ? '' : formData.category,
        description: formData.description,
        scope: formData.scope,
        variables: formData.variables || {},
        use_nautobot_context: formData.use_nautobot_context || false
      }

      // Add source-specific data
      if (formData.source === 'git') {
        templateData.git_repo_url = formData.git_repo_url
        templateData.git_branch = formData.git_branch
        templateData.git_path = formData.git_path
        templateData.git_username = formData.git_username
        templateData.git_token = formData.git_token
      } else if (formData.source === 'webeditor') {
        templateData.content = formData.content
      } else if (formData.source === 'file') {
        if (selectedFile) {
          templateData.filename = selectedFile.name
          templateData.content = await readFileContent(selectedFile)
        } else if (formData.content) {
          // Keep existing content if no new file
          templateData.content = formData.content
        }
      }

      return apiCall(`templates/${templateId}`, {
        method: 'PUT',
        body: templateData
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all })
      toast({
        title: 'Success',
        description: 'Template updated successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update template: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Delete template
  const deleteTemplate = useMutation({
    mutationFn: async (templateId: number) => {
      return apiCall(`templates/${templateId}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      toast({
        title: 'Success',
        description: 'Template deleted successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete template: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Bulk delete templates
  const bulkDeleteTemplates = useMutation({
    mutationFn: async (templateIds: number[]) => {
      const results = await Promise.allSettled(
        templateIds.map(id =>
          apiCall(`templates/${id}`, { method: 'DELETE' })
        )
      )

      const successCount = results.filter(r => r.status === 'fulfilled').length
      const errorCount = results.filter(r => r.status === 'rejected').length

      return { successCount, errorCount }
    },
    onSuccess: ({ successCount, errorCount }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      if (successCount > 0) {
        toast({
          title: 'Success',
          description: `Successfully deleted ${successCount} template(s)`,
        })
      }
      if (errorCount > 0) {
        toast({
          title: 'Warning',
          description: `Failed to delete ${errorCount} template(s)`,
          variant: 'destructive'
        })
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete templates: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Sync git template
  const syncTemplate = useMutation({
    mutationFn: async (templateId: number) => {
      return apiCall('templates/sync', {
        method: 'POST',
        body: { template_id: templateId }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      toast({
        title: 'Success',
        description: 'Template synced successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to sync template: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Import templates from YAML
  const importTemplates = useMutation({
    mutationFn: async ({ filePaths, overwriteExisting = false }: ImportTemplatesInput) => {
      const response = await apiCall<TemplateImportResponse>('templates/import', {
        method: 'POST',
        body: {
          source_type: 'yaml_bulk',
          yaml_file_paths: filePaths,
          overwrite_existing: overwriteExisting
        }
      })
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })

      const successCount = data.imported_templates?.length || 0
      const failedCount = data.failed_templates?.length || 0

      if (successCount > 0) {
        toast({
          title: 'Success',
          description: `Successfully imported ${successCount} template(s)`,
        })
      }
      if (failedCount > 0) {
        toast({
          title: 'Warning',
          description: `Failed to import ${failedCount} template(s)`,
          variant: 'destructive'
        })
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to import templates: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    createTemplate,
    updateTemplate,
    deleteTemplate,
    bulkDeleteTemplates,
    syncTemplate,
    importTemplates,
  }), [
    createTemplate,
    updateTemplate,
    deleteTemplate,
    bulkDeleteTemplates,
    syncTemplate,
    importTemplates,
  ])
}
```

**Benefits:**
- ✅ Automatic cache invalidation
- ✅ Consistent error/success handling with Toast
- ✅ Loading states for each mutation
- ✅ Replaces custom message state
- ✅ Bulk operations support

**Estimated effort:** 3 hours

---

### Phase 2: Create Component Decomposition

**2.1: Create Templates List Component**

**File:** `components/templates-list.tsx` (new)

```tsx
'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  FileCode,
  Search,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  RotateCcw as Sync,
  CheckSquare,
  Square
} from 'lucide-react'
import { useTemplates, useTemplateCategories } from '../hooks/use-template-queries'
import { useTemplateMutations } from '../hooks/use-template-mutations'
import { getSourceBadgeVariant, getSourceIcon } from '../utils/template-utils'
import type { Template, TemplateFilters } from '../types'

interface TemplatesListProps {
  onEdit: (template: Template) => void
  onView: (templateId: number) => void
}

export function TemplatesList({ onEdit, onView }: TemplatesListProps) {
  const [filters, setFilters] = useState<TemplateFilters>({})
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set())

  const { templates, isLoading, refetch } = useTemplates({ filters })
  const { data: categories = [] } = useTemplateCategories()
  const { deleteTemplate, bulkDeleteTemplates, syncTemplate } = useTemplateMutations()

  const handleFilterChange = (key: keyof TemplateFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '__all__' ? undefined : value
    }))
  }

  const toggleSelection = (templateId: number) => {
    setSelectedTemplates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(templateId)) {
        newSet.delete(templateId)
      } else {
        newSet.add(templateId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedTemplates.size === templates.length) {
      setSelectedTemplates(new Set())
    } else {
      setSelectedTemplates(new Set(templates.map(t => t.id)))
    }
  }

  const handleBulkDelete = async () => {
    const templateNames = templates
      .filter(t => selectedTemplates.has(t.id))
      .map(t => t.name)
      .join(', ')

    if (!confirm(`Are you sure you want to delete ${selectedTemplates.size} template(s)?\n\nTemplates: ${templateNames}`)) {
      return
    }

    await bulkDeleteTemplates.mutateAsync(Array.from(selectedTemplates))
    setSelectedTemplates(new Set())
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <FileCode className="h-4 w-4" />
          Templates List
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search templates..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={filters.category || '__all__'}
            onValueChange={(value) => handleFilterChange('category', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.source || '__all__'}
            onValueChange={(value) => handleFilterChange('source', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Sources</SelectItem>
              <SelectItem value="git">Git Repository</SelectItem>
              <SelectItem value="file">File Upload</SelectItem>
              <SelectItem value="webeditor">Web Editor</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Bulk Actions */}
        {selectedTemplates.size > 0 && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedTemplates.size} template(s) selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTemplates(new Set())}
              >
                Clear Selection
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleteTemplates.isPending}
            >
              {bulkDeleteTemplates.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span>Delete Selected</span>
            </Button>
          </div>
        )}

        {/* Templates Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button onClick={toggleSelectAll}>
                      {selectedTemplates.size === templates.length && templates.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                      <span className="ml-2">Loading templates...</span>
                    </td>
                  </tr>
                ) : templates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No templates found
                    </td>
                  </tr>
                ) : (
                  templates.map((template) => (
                    <tr
                      key={template.id}
                      className={selectedTemplates.has(template.id) ? 'bg-blue-50' : ''}
                    >
                      <td className="px-4 py-4">
                        <button onClick={() => toggleSelection(template.id)}>
                          {selectedTemplates.has(template.id) ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{template.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getSourceBadgeVariant(template.source)}>
                          {template.source}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{template.template_type}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{template.category || '-'}</td>
                      <td className="px-6 py-4 max-w-xs truncate">{template.description || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline" onClick={() => onView(template.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onEdit(template)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {template.source === 'git' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => syncTemplate.mutate(template.id)}
                              disabled={syncTemplate.isPending}
                            >
                              <Sync className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this template?')) {
                                deleteTemplate.mutate(template.id)
                              }
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Estimated effort:** 2.5 hours

---

**2.2: Create Template Form Component with react-hook-form + zod**

**File:** `components/template-form.tsx` (new)

This component will handle both create and edit modes with proper validation.

```tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription
} from '@/components/ui/form'
import {
  Plus,
  Save,
  RotateCcw,
  GitBranch,
  Upload,
  Code,
  RefreshCw,
  Play,
  FolderOpen
} from 'lucide-react'
import { useTemplateMutations } from '../hooks/use-template-mutations'
import { useTemplateContent } from '../hooks/use-template-queries'
import {
  DEFAULT_TEMPLATE_FORM_DATA,
  TEMPLATE_TYPES,
  TEMPLATE_SOURCES,
  CANONICAL_CATEGORIES,
  FILE_ACCEPT_TYPES
} from '../utils/constants'
import { getTemplateNameFromFile } from '../utils/template-utils'
import type { Template, TemplateFormData } from '../types'

// Zod validation schema
const templateFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  source: z.enum(['git', 'file', 'webeditor']),
  template_type: z.string(),
  category: z.string(),
  description: z.string(),
  scope: z.enum(['global', 'private']),
  use_nautobot_context: z.boolean().optional(),

  // Git source fields
  git_repo_url: z.string().optional(),
  git_branch: z.string().optional(),
  git_path: z.string().optional(),
  git_username: z.string().optional(),
  git_token: z.string().optional(),

  // Editor source fields
  content: z.string().optional(),

  // File source fields
  filename: z.string().optional(),
})

type TemplateFormSchema = z.infer<typeof templateFormSchema>

interface TemplateFormProps {
  template?: Template | null
  onSuccess: () => void
  onCancel: () => void
  onSelectInventory?: () => void
  selectedInventory?: { id: number; name: string } | null
}

export function TemplateForm({
  template,
  onSuccess,
  onCancel,
  onSelectInventory,
  selectedInventory
}: TemplateFormProps) {
  const isEditMode = !!template

  const { createTemplate, updateTemplate } = useTemplateMutations()
  const { data: templateContent, isLoading: isLoadingContent } = useTemplateContent(
    template?.id || null,
    { enabled: isEditMode }
  )

  const form = useForm<TemplateFormSchema>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: DEFAULT_TEMPLATE_FORM_DATA,
  })

  // Load template data in edit mode
  useEffect(() => {
    if (template && templateContent !== undefined) {
      const editSource = template.source === 'file' ? 'webeditor' : template.source

      form.reset({
        name: template.name,
        source: editSource as 'git' | 'file' | 'webeditor',
        template_type: template.template_type,
        category: template.category || '__none__',
        description: template.description || '',
        scope: template.scope || 'global',
        use_nautobot_context: template.use_nautobot_context || false,
        git_repo_url: template.git_repo_url || '',
        git_branch: template.git_branch || 'main',
        git_path: template.git_path || '',
        content: templateContent || '',
      })
    }
  }, [template, templateContent, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    if (isEditMode && template) {
      await updateTemplate.mutateAsync({
        templateId: template.id,
        formData: data as TemplateFormData,
      })
    } else {
      await createTemplate.mutateAsync({
        formData: data as TemplateFormData,
      })
    }
    onSuccess()
  })

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      form.setValue('filename', file.name)
      if (!form.getValues('name')) {
        form.setValue('name', getTemplateNameFromFile(file.name))
      }
    }
  }

  const watchedSource = form.watch('source')
  const watchedCategory = form.watch('category')

  if (isLoadingContent) {
    return <div className="text-center py-8">Loading template...</div>
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <Plus className="h-4 w-4" />
          {isEditMode ? `Edit Template: ${template?.name}` : 'Create New Template'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., cisco-ios-base" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <FormField
                control={form.control}
                name="template_type"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Template Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="jinja2">Jinja2</SelectItem>
                        <SelectItem value="text">Plain Text</SelectItem>
                        <SelectItem value="textfsm">TextFSM</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No Category</SelectItem>
                        {CANONICAL_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Source <span className="text-red-500">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="git">Git Repository</SelectItem>
                        <SelectItem value="file">File Upload</SelectItem>
                        <SelectItem value="webeditor">Web Editor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Scope checkbox */}
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
                  <FormControl>
                    <Checkbox
                      checked={field.value === 'global'}
                      onCheckedChange={(checked) =>
                        field.onChange(checked ? 'global' : 'private')
                      }
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>This template is global</FormLabel>
                    <FormDescription>
                      Global templates are visible to all users. Private templates are only visible to you.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Nautobot Context for Agent templates */}
            {watchedCategory === 'agent' && (
              <FormField
                control={form.control}
                name="use_nautobot_context"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 p-4 bg-purple-50 rounded-lg">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Use Nautobot data & context</FormLabel>
                      <FormDescription>
                        When enabled, this template will have access to Nautobot device data and context variables.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}

            {/* Source-specific configurations */}
            {watchedSource === 'git' && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-blue-700">
                    <GitBranch className="h-5 w-5" />
                    <span>Git Repository Configuration</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="git_repo_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repository URL <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="https://github.com/user/repo.git" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="git_branch"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch</FormLabel>
                          <FormControl>
                            <Input placeholder="main" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="git_path"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>File Path</FormLabel>
                          <FormControl>
                            <Input placeholder="templates/template.j2" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="git_username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username (if private)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="git_token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal Access Token (if private)</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {watchedSource === 'file' && (
              <Card className="bg-green-50 border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-green-700">
                    <Upload className="h-5 w-5" />
                    <span>File Upload</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FormItem>
                    <FormLabel>Template File</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept={FILE_ACCEPT_TYPES}
                        onChange={handleFileChange}
                      />
                    </FormControl>
                  </FormItem>
                </CardContent>
              </Card>
            )}

            {watchedSource === 'webeditor' && (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-yellow-700">
                    <Code className="h-5 w-5" />
                    <span>Web Editor</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Content <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <textarea
                            className="w-full h-64 p-3 border-2 bg-white border-gray-300 rounded-md font-mono text-sm"
                            placeholder="Enter your template content here..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t gap-3">
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={onCancel} type="button">
                  <RotateCcw className="h-4 w-4" />
                  <span>{isEditMode ? 'Cancel Edit' : 'Reset'}</span>
                </Button>

                {watchedCategory === 'agent' && onSelectInventory && (
                  <Button
                    variant="outline"
                    onClick={onSelectInventory}
                    type="button"
                    className="border-purple-300 text-purple-700"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span>
                      {selectedInventory ? `Inventory: ${selectedInventory.name}` : 'Select Inventory'}
                    </span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={createTemplate.isPending || updateTemplate.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {(createTemplate.isPending || updateTemplate.isPending) && (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  )}
                  <Save className="h-4 w-4" />
                  <span>
                    {isEditMode ? 'Update Template' : 'Create Template'}
                  </span>
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

**Estimated effort:** 3 hours

---

**Note:** Due to response length limits, I'll continue with the remaining components in a condensed format.

**2.3: Create Import Templates Component** (~2 hours)
- File: `components/import-templates.tsx`
- Features: Scan directory, select templates, bulk import
- Uses: `useImportableTemplates()`, `importTemplates()` mutation

**2.4: Create Template View Dialog** (~1 hour)
- File: `components/template-view-dialog.tsx`
- Features: Preview template content in modal
- Uses: `useTemplateContent()` query, escapeHtml for XSS protection

**2.5: Extract Inventory Selection to Shared Component** (~1.5 hours)
- File: `components/features/general/inventory/inventory-selector.tsx`
- Features: Reusable inventory selection component
- Uses: Already has `LoadInventoryDialog`, make it more generic

---

### Phase 4: Refactor Main Container

**File:** `template-management.tsx` (refactored)

```tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileCode, Plus, Download } from 'lucide-react'
import { TemplatesList } from './components/templates-list'
import { TemplateForm } from './components/template-form'
import { ImportTemplates } from './components/import-templates'
import { TemplateViewDialog } from './components/template-view-dialog'
import { LoadInventoryDialog } from '@/components/features/general/inventory/dialogs/load-inventory-dialog'
import { useTemplateContent } from './hooks/use-template-queries'
import type { Template } from './types'
import type { SavedInventory } from '@/hooks/queries/use-saved-inventories-queries'

export default function TemplateManagement() {
  const [activeTab, setActiveTab] = useState('list')
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [viewingTemplateId, setViewingTemplateId] = useState<number | null>(null)
  const [selectedInventory, setSelectedInventory] = useState<{ id: number; name: string } | null>(null)
  const [showInventoryDialog, setShowInventoryDialog] = useState(false)

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setActiveTab('create')
  }

  const handleView = (templateId: number) => {
    setViewingTemplateId(templateId)
  }

  const handleFormSuccess = () => {
    setEditingTemplate(null)
    setActiveTab('list')
  }

  const handleFormCancel = () => {
    setEditingTemplate(null)
    setActiveTab('list')
  }

  const handleInventorySelected = (inventory: SavedInventory) => {
    setSelectedInventory({ id: inventory.id, name: inventory.name })
    setShowInventoryDialog(false)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <FileCode className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Template Management</h1>
            <p className="text-gray-600">Manage configuration templates for network devices</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">
            <FileCode className="h-4 w-4" />
            <span>Templates List</span>
          </TabsTrigger>
          <TabsTrigger value="create">
            <Plus className="h-4 w-4" />
            <span>Create Template</span>
          </TabsTrigger>
          <TabsTrigger value="import">
            <Download className="h-4 w-4" />
            <span>Import Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <TemplatesList onEdit={handleEdit} onView={handleView} />
        </TabsContent>

        <TabsContent value="create">
          <TemplateForm
            template={editingTemplate}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
            onSelectInventory={() => setShowInventoryDialog(true)}
            selectedInventory={selectedInventory}
          />
        </TabsContent>

        <TabsContent value="import">
          <ImportTemplates />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <TemplateViewDialog
        templateId={viewingTemplateId}
        onClose={() => setViewingTemplateId(null)}
      />

      <LoadInventoryDialog
        show={showInventoryDialog}
        onClose={() => setShowInventoryDialog(false)}
        onLoad={handleInventorySelected}
        onDelete={() => {}}
        inventories={[]}
        isLoading={false}
      />
    </div>
  )
}
```

**Before:** 1602 lines
**After:** ~150 lines (main container)
**Reduction:** ~1452 lines (91%)

**Estimated effort:** 1.5 hours

---

## Final Directory Structure (After Refactoring)

```
frontend/src/components/features/settings/templates/
├── template-management.tsx         # ~150 lines (was 1602, -91%)
├── components/
│   ├── templates-list.tsx          # ~200 lines
│   ├── template-form.tsx           # ~350 lines (with react-hook-form)
│   ├── import-templates.tsx        # ~250 lines
│   └── template-view-dialog.tsx    # ~80 lines
├── hooks/
│   ├── use-template-queries.ts     # ~180 lines
│   └── use-template-mutations.ts   # ~200 lines
├── types/
│   └── index.ts                    # ~80 lines
└── utils/
    ├── constants.ts                # ~50 lines
    └── template-utils.ts           # ~60 lines
```

---

## Summary of Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `template-management.tsx` | 1602 | ~150 | **-1452 lines (-91%)** |
| New components | 0 | ~880 | **+880 lines** |
| New hooks | 0 | ~380 | **+380 lines** |
| New types/utils | 0 | ~190 | **+190 lines** |
| **Total** | **1602** | **~1,600** | **~0 lines (net)** |

**Net change** of approximately 0 lines, but with dramatically better architecture:
- Proper separation of concerns
- TanStack Query compliance (mandatory)
- Reusable components and hooks
- Type-safe form validation with zod
- Better testability (isolated components)
- Easier maintainability
- Performance improvements (granular re-renders)

---

## Architecture Compliance (CLAUDE.md)

### Success Metrics

**Code Quality:**
- [ ] Component size < 300 lines each (main container ~150 lines)
- [ ] No duplicate API call logic (unified in query/mutation hooks)
- [ ] No manual `useState` for server data (TanStack Query only)
- [ ] Forms use react-hook-form + zod validation
- [ ] No inline arrays/objects in default parameters
- [ ] Zero ESLint warnings

**Architecture Compliance:**
- [ ] All data fetching uses TanStack Query
- [ ] Query keys in centralized factory (`/lib/query-keys.ts`)
- [ ] API calls via correct endpoint pattern
- [ ] Feature-based folder structure (components/, hooks/, types/, utils/)
- [ ] All UI components from Shadcn
- [ ] Backend has repository/service/router layers
- [ ] Backend routes use proper auth dependencies

**User Experience:**
- [ ] No regression in functionality
- [ ] Improved loading states (TanStack Query built-in)
- [ ] Better error messages (Toast notifications)
- [ ] Faster perceived performance (automatic caching)
- [ ] Smooth filtering (client-side with useMemo)

**Developer Experience:**
- [ ] Easier to test (isolated hooks and components)
- [ ] Clear component boundaries
- [ ] Reusable hooks
- [ ] Type safety throughout
- [ ] Form validation with clear error messages

---

## Anti-Patterns to Avoid

### ❌ DO NOT Do These During Refactoring

**1. Don't Keep Manual State for Server Data**
- ❌ `const [templates, setTemplates] = useState<Template[]>([])`
- ❌ `useEffect(() => { loadTemplates() }, [])`
- ✅ **Instead:** `const { templates } = useTemplates()`

**2. Don't Keep Manual Loading State Management**
- ❌ `const [isLoading, setIsLoading] = useState(false)`
- ❌ `const [importLoading, setImportLoading] = useState(false)`
- ✅ **Instead:** TanStack Query provides `isLoading`

**3. Don't Use Custom Message State**
- ❌ `const [message, setMessage] = useState('')`
- ✅ **Instead:** `useToast()` from Shadcn UI

**4. Don't Skip Form Validation Library**
- ❌ Manual validation with `onChange` handlers
- ❌ Direct state updates
- ✅ **Instead:** react-hook-form + zod (mandatory)

**5. Don't Use Inline Default Objects**
- ❌ `const [formData, setFormData] = useState({ name: '', ... })`
- ✅ **Instead:** `const DEFAULT_TEMPLATE_FORM_DATA = {...} as const`

**6. Don't Keep All Logic in One File**
- ❌ 1602-line monolithic component
- ✅ **Instead:** Decompose into focused components < 300 lines

**7. Don't Mix Feature Concerns**
- ❌ Template management + inventory selection in same component
- ✅ **Instead:** Separate concerns, shared inventory selector

---

## Recommended Refactoring Order

1. **Phase 1.2** - Add query keys (20 min, zero risk)
2. **Phase 1.3** - Extract types (45 min, zero risk)
3. **Phase 1.4** - Extract constants (20 min, fixes re-render risks)
4. **Phase 1.5** - Extract utilities (45 min, zero risk)
5. **Phase 1.1** - Verify backend architecture + API pattern (45 min)
6. **Phase 3.1** - Create query hooks (2.5 hours)
7. **Phase 3.2** - Create mutation hooks (3 hours)
8. **Phase 2.1** - Create templates list component (2.5 hours)
9. **Phase 2.2** - Create template form with react-hook-form (3 hours)
10. **Phase 2.3** - Create import component (2 hours)
11. **Phase 2.4** - Create view dialog (1 hour)
12. **Phase 4** - Refactor main container (1.5 hours)
13. **Testing & Integration** - Test all functionality (3 hours)

**Total Estimated Effort:** ~20 hours

---

## Notes

- This refactoring is **MANDATORY** to align with CLAUDE.md standards
- TanStack Query migration is **required** per architecture requirements
- Component decomposition dramatically improves testability and maintainability
- Form validation with react-hook-form + zod is **mandatory** per standards
- **Must verify API endpoint pattern:** `/api/proxy/templates/*` vs `/api/templates/*`
- Consider extracting inventory selector as truly shared component
- Template rendering (dry run) feature should be implemented in backend

---

**Document Version:** 1.0
**Created:** 2026-02-05
**Status:** Planning
**Priority:** High (architecture compliance + extreme size + maintainability)
