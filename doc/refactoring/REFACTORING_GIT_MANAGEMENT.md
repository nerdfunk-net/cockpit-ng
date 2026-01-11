# Git Management Refactoring Plan

**File:** `src/components/features/settings/git/git-management.tsx`
**Current Size:** 1,924 lines
**Target Size:** ~350-400 lines (main orchestrator)
**Priority:** HIGH
**Estimated Effort:** 3-4 days
**Architecture:** TanStack Query (✅ already implemented) + react-hook-form + Zod

---

## ⚠️ IMPORTANT: Architectural Status

### Already Implemented ✅
- **TanStack Query for data fetching** - `useGitRepositoriesQuery` already exists
- **TanStack Mutations** - `useGitMutations` already extracted with proper patterns
- **Query hooks pattern** - `/hooks/queries/use-git-repositories-query.ts` and `/hooks/queries/use-git-mutations.ts`

### Still Needed 🔨
- **react-hook-form + Zod** - Forms use manual state (formData, editFormData)
- **Component extraction** - Large inline dialogs and forms
- **Custom hooks** - Modal state management, form management
- **Types separation** - Interfaces defined inline
- **Constants** - Empty arrays used as defaults (anti-pattern)

---

## Current State Analysis

### Complexity Metrics
- **17 useState hooks** - Moderate state complexity
- **2 useEffect hooks** - Only for loading credentials
- **Total Lines:** 1,924 (Target: < 400)
- **Inline Interfaces:** 6 (GitRepository, GitCredential, GitStatus, GitFormData, DebugResult)
- **Large Dialogs:** 3 (Edit: ~180 lines, Debug: ~570 lines, Status: ~180 lines)

### Architectural Strengths ✅
1. **TanStack Query already used** for repositories list
2. **Mutations extracted** to dedicated hook with proper invalidation
3. **useApi hook** used correctly
4. **Toast notifications** properly integrated

### Responsibilities Identified

The current component handles:

1. **Repository List Display** - Card-based list with actions (lines 533-704)
2. **Repository Form (Create)** - Large form with credential management (lines 708-974)
3. **Repository Edit Dialog** - Full edit modal (lines 978-1160)
4. **Repository CRUD Operations** - Delete, sync, remove-and-sync
5. **Connection Testing** - Test repository access before creation
6. **Debug Functionality** - Complex multi-tab debug interface (lines 1162-1733)
   - Diagnostics tab with comprehensive checks
   - Read/Write/Delete/Push test tabs
7. **Status Viewing** - Repository git status display (lines 1735-1919)
8. **Credential Management** - Loading and filtering credentials
9. **Form State Management** - Two separate forms (create + edit)
10. **Message Display** - Success/error messaging

### Major Issues

❌ **Manual form state** - Two separate form state objects (formData, editFormData)
❌ **No form validation library** - Manual validation in handleFormSubmit
❌ **Massive inline dialogs** - Edit (182 lines), Debug (571 lines), Status (184 lines)
❌ **Repeated code** - Form fields duplicated between create and edit
❌ **Complex debug modal** - 5 tabs with similar patterns
❌ **Credential filtering logic** - Scattered throughout component
❌ **Non-memoized defaults** - Empty arrays created inline

---

## Refactoring Strategy

### Phase 1: Type Extraction & Constants (Day 1, Morning)
**Estimated Time:** 2 hours

#### 1.1 Move Inline Interfaces to `types.ts`

```typescript
// types.ts
export interface GitRepository {
  id: number
  name: string
  category: string
  url: string
  branch: string
  auth_type?: string
  credential_name?: string
  path?: string
  verify_ssl: boolean
  git_author_name?: string
  git_author_email?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  last_sync?: string
  sync_status?: string
}

export interface GitCredential {
  id?: number
  name: string
  username: string
  type: string
  source?: string
}

export interface GitStatus {
  repository_name: string
  repository_url: string
  repository_branch: string
  sync_status: string
  exists: boolean
  is_git_repo: boolean
  is_synced: boolean
  behind_count: number
  current_branch?: string
  modified_files?: string[]
  untracked_files?: string[]
  staged_files?: string[]
  commits?: GitCommit[]
  branches?: string[]
}

export interface GitCommit {
  hash: string
  message: string
  author: {
    name: string
    email: string
  }
  date: string
}

export interface GitFormData {
  name: string
  category: string
  url: string
  branch: string
  auth_type: string
  credential_name: string
  path: string
  verify_ssl: boolean
  git_author_name: string
  git_author_email: string
  description: string
}

export interface DebugResult {
  success: boolean
  message?: string
  error?: string
  error_type?: string
  details?: Record<string, unknown>
  diagnostics?: DebugDiagnostics
}

export interface DebugDiagnostics {
  repository_info: Record<string, unknown>
  access_test: Record<string, unknown>
  file_system: Record<string, unknown>
  git_status: Record<string, unknown>
  ssl_info: Record<string, unknown>
  credentials: Record<string, unknown>
  push_capability?: {
    status: string
    message: string
    can_push: boolean
    has_credentials: boolean
    has_remote: boolean
  }
}

export interface ConnectionTestRequest {
  url: string
  branch: string
  auth_type: string
  credential_name: string | null
  verify_ssl: boolean
}

export interface ConnectionTestResponse {
  success: boolean
  message: string
}

// Form submission types
export interface RepositoryCreateData extends GitFormData {
  is_active?: boolean
}

export interface RepositoryUpdateData extends GitFormData {
  is_active: boolean
}
```

#### 1.2 Create `constants.ts`

```typescript
// constants.ts
import type { GitFormData, GitCredential } from './types'

// Empty arrays (prevent re-render loops)
export const EMPTY_CREDENTIALS: GitCredential[] = []
export const EMPTY_STRING_ARRAY: string[] = []
export const EMPTY_BRANCHES: string[] = []

// Default form values
export const DEFAULT_FORM_DATA: GitFormData = {
  name: '',
  category: '',
  url: '',
  branch: 'main',
  auth_type: 'none',
  credential_name: '__none__',
  path: '',
  verify_ssl: true,
  git_author_name: '',
  git_author_email: '',
  description: '',
} as const

// Repository categories
export const REPOSITORY_CATEGORIES = [
  { value: 'device_configs', label: 'Device Configs' },
  { value: 'cockpit_configs', label: 'Cockpit Configs' },
  { value: 'templates', label: 'Templates' },
  { value: 'ansible', label: 'Ansible' },
] as const

// Authentication types
export const AUTH_TYPES = [
  { value: 'none', label: 'None (Public Repository)' },
  { value: 'token', label: 'Token' },
  { value: 'ssh_key', label: 'SSH Key' },
  { value: 'generic', label: 'Generic (Username/Password)' },
] as const

// Debug operation types
export type DebugOperation = 'read' | 'write' | 'delete' | 'push' | 'diagnostics'

// TanStack Query stale times
export const QUERY_STALE_TIMES = {
  CREDENTIALS: 5 * 60 * 1000,  // 5 minutes
} as const
```

---

### Phase 2: Form Validation with Zod (Day 1, Afternoon)
**Estimated Time:** 3 hours

#### 2.1 Create `validation.ts`

```typescript
// validation.ts
import { z } from 'zod'

// Repository form schema
export const repositoryFormSchema = z.object({
  name: z.string().min(1, 'Repository name is required'),
  category: z.enum(['device_configs', 'cockpit_configs', 'templates', 'ansible'], {
    errorMap: () => ({ message: 'Please select a category' }),
  }),
  url: z.string().url('Invalid repository URL'),
  branch: z.string().min(1, 'Branch name is required').default('main'),
  auth_type: z.enum(['none', 'token', 'ssh_key', 'generic']).default('none'),
  credential_name: z.string().default('__none__'),
  path: z.string().optional().default(''),
  verify_ssl: z.boolean().default(true),
  git_author_name: z.string().optional().default(''),
  git_author_email: z.string().email('Invalid email format').optional().or(z.literal('')).default(''),
  description: z.string().optional().default(''),
})

// Connection test schema
export const connectionTestSchema = z.object({
  url: z.string().url('Invalid repository URL'),
  branch: z.string().min(1, 'Branch name is required'),
  auth_type: z.enum(['none', 'token', 'ssh_key', 'generic']),
  credential_name: z.string().nullable(),
  verify_ssl: z.boolean(),
})

// Infer TypeScript types from schemas
export type RepositoryFormValues = z.infer<typeof repositoryFormSchema>
export type ConnectionTestValues = z.infer<typeof connectionTestSchema>
```

---

### Phase 3: Custom Hooks (Day 2, Morning)
**Estimated Time:** 4 hours

#### 3.1 Create `/hooks/use-repository-form.ts`

```typescript
// hooks/use-repository-form.ts
import { useForm, UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { repositoryFormSchema, type RepositoryFormValues } from '../validation'
import { DEFAULT_FORM_DATA } from '../constants'
import type { GitRepository } from '../types'

interface UseRepositoryFormOptions {
  defaultValues?: Partial<RepositoryFormValues>
  repository?: GitRepository  // For edit mode
}

const DEFAULT_OPTIONS: UseRepositoryFormOptions = {}

export function useRepositoryForm(
  options: UseRepositoryFormOptions = DEFAULT_OPTIONS
): UseFormReturn<RepositoryFormValues> {
  const { defaultValues, repository } = options

  const initialValues: RepositoryFormValues = useMemo(() => {
    if (repository) {
      // Edit mode - populate from repository
      return {
        name: repository.name,
        category: repository.category as any,
        url: repository.url,
        branch: repository.branch,
        auth_type: (repository.auth_type || 'none') as any,
        credential_name: repository.credential_name || '__none__',
        path: repository.path || '',
        verify_ssl: repository.verify_ssl,
        git_author_name: repository.git_author_name || '',
        git_author_email: repository.git_author_email || '',
        description: repository.description || '',
      }
    }

    return {
      ...DEFAULT_FORM_DATA,
      ...defaultValues,
    } as RepositoryFormValues
  }, [repository, defaultValues])

  const form = useForm<RepositoryFormValues>({
    resolver: zodResolver(repositoryFormSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  })

  return form
}
```

#### 3.2 Create `/hooks/use-credentials-query.ts`

```typescript
// hooks/use-credentials-query.ts
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIMES, EMPTY_CREDENTIALS } from '../constants'
import type { GitCredential } from '../types'

interface UseCredentialsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCredentialsQueryOptions = {
  enabled: true,
}

/**
 * Fetches credentials suitable for git authentication
 * Filters for token, ssh_key, and generic types
 */
export function useCredentialsQuery(
  options: UseCredentialsQueryOptions = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.credentials.list({ git: true }),
    queryFn: async (): Promise<GitCredential[]> => {
      try {
        const response = await apiCall<GitCredential[]>('credentials/?include_expired=false')
        // Filter for git-compatible credentials
        const filtered = (response || []).filter(
          c => c.type === 'token' || c.type === 'ssh_key' || c.type === 'generic'
        )
        return filtered
      } catch (error) {
        console.error('Error loading credentials:', error)
        return EMPTY_CREDENTIALS
      }
    },
    enabled,
    staleTime: QUERY_STALE_TIMES.CREDENTIALS,
  })
}
```

**Note:** Need to add to `/lib/query-keys.ts`:

```typescript
// lib/query-keys.ts - Add to existing file
export const queryKeys = {
  // ... existing keys ...

  credentials: {
    all: ['credentials'] as const,
    list: (filters?: { git?: boolean }) =>
      filters
        ? ([...queryKeys.credentials.all, 'list', filters] as const)
        : ([...queryKeys.credentials.all, 'list'] as const),
  },
} as const
```

#### 3.3 Create `/hooks/use-repository-status.ts`

```typescript
// hooks/use-repository-status.ts
import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { GitRepository, GitStatus } from '../types'

export interface RepositoryStatusHook {
  statusData: GitStatus | null
  isLoading: boolean
  showDialog: boolean
  openDialog: (repo: GitRepository) => Promise<void>
  closeDialog: () => void
}

export function useRepositoryStatus(): RepositoryStatusHook {
  const { apiCall } = useApi()
  const [statusData, setStatusData] = useState<GitStatus | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const openDialog = useCallback(async (repo: GitRepository) => {
    setStatusData(null)
    setShowDialog(true)
    setIsLoading(true)

    try {
      const response = await apiCall<{ success: boolean; data: GitStatus }>(
        `git/${repo.id}/status`
      )
      if (response.success) {
        setStatusData(response.data)
      } else {
        throw new Error('Failed to load repository status')
      }
    } catch (error) {
      console.error('Failed to load repository status:', error)
      setShowDialog(false)
    } finally {
      setIsLoading(false)
    }
  }, [apiCall])

  const closeDialog = useCallback(() => {
    setShowDialog(false)
    setStatusData(null)
  }, [])

  return useMemo(() => ({
    statusData,
    isLoading,
    showDialog,
    openDialog,
    closeDialog,
  }), [statusData, isLoading, showDialog, openDialog, closeDialog])
}
```

#### 3.4 Create `/hooks/use-repository-debug.ts`

```typescript
// hooks/use-repository-debug.ts
import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { GitRepository, DebugResult, DebugOperation } from '../types'

export interface RepositoryDebugHook {
  debugRepo: GitRepository | null
  debugResult: DebugResult | null
  debugTab: string
  isLoading: boolean
  showDialog: boolean
  openDialog: (repo: GitRepository) => void
  closeDialog: () => void
  setDebugTab: (tab: string) => void
  runOperation: (operation: DebugOperation) => Promise<void>
}

export function useRepositoryDebug(): RepositoryDebugHook {
  const { apiCall } = useApi()
  const [debugRepo, setDebugRepo] = useState<GitRepository | null>(null)
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null)
  const [debugTab, setDebugTab] = useState('diagnostics')
  const [showDialog, setShowDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const openDialog = useCallback((repo: GitRepository) => {
    setDebugRepo(repo)
    setDebugTab('diagnostics')
    setDebugResult(null)
    setShowDialog(true)
  }, [])

  const closeDialog = useCallback(() => {
    setShowDialog(false)
    setDebugRepo(null)
    setDebugResult(null)
  }, [])

  const runOperation = useCallback(async (operation: DebugOperation) => {
    if (!debugRepo) return

    setIsLoading(true)
    setDebugResult(null)

    try {
      const endpoint = operation === 'diagnostics'
        ? `git-repositories/${debugRepo.id}/debug/diagnostics`
        : `git-repositories/${debugRepo.id}/debug/${operation}`

      const method = operation === 'diagnostics' ? 'GET' : 'POST'

      const response = await apiCall(endpoint, { method })
      setDebugResult(response as DebugResult)
    } catch (error) {
      const err = error as Error
      setDebugResult({
        success: false,
        message: err.message || 'Debug operation failed',
        details: {
          error: err.message || 'Unknown error',
          error_type: 'FetchError',
        },
      })
    } finally {
      setIsLoading(false)
    }
  }, [debugRepo, apiCall])

  return useMemo(() => ({
    debugRepo,
    debugResult,
    debugTab,
    isLoading,
    showDialog,
    openDialog,
    closeDialog,
    setDebugTab,
    runOperation,
  }), [debugRepo, debugResult, debugTab, isLoading, showDialog, openDialog, closeDialog, runOperation])
}
```

#### 3.5 Create `/hooks/use-connection-test.ts`

```typescript
// hooks/use-connection-test.ts
import { useState, useCallback, useMemo } from 'react'
import { useGitMutations } from './queries/use-git-mutations'
import type { ConnectionTestValues } from '../validation'

export interface ConnectionTestHook {
  status: { type: 'success' | 'error'; text: string } | null
  isLoading: boolean
  testConnection: (data: ConnectionTestValues) => Promise<void>
  clearStatus: () => void
}

export function useConnectionTest(): ConnectionTestHook {
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { testConnection: testConnectionMutation } = useGitMutations()

  const testConnection = useCallback(async (data: ConnectionTestValues) => {
    setIsLoading(true)
    setStatus(null)

    try {
      const response = await testConnectionMutation.mutateAsync(data)
      setStatus({
        type: response.success ? 'success' : 'error',
        text: response.message,
      })
    } catch {
      setStatus({
        type: 'error',
        text: 'Connection test failed',
      })
    } finally {
      setIsLoading(false)
    }
  }, [testConnectionMutation])

  const clearStatus = useCallback(() => {
    setStatus(null)
  }, [])

  return useMemo(() => ({
    status,
    isLoading,
    testConnection,
    clearStatus,
  }), [status, isLoading, testConnection, clearStatus])
}
```

---

### Phase 4: Utility Functions (Day 2, Afternoon)
**Estimated Time:** 1 hour

#### 4.1 Create `utils.ts`

```typescript
// utils.ts
import type { GitCredential, RepositoryFormValues } from './types'

/**
 * Extract credential name from "id:name" format used by Select component
 */
export function extractCredentialName(credentialValue: string): string | null {
  if (credentialValue === '__none__') return null

  if (credentialValue.includes(':')) {
    return credentialValue.split(':')[1]
  }

  return credentialValue || null
}

/**
 * Build credential value in "id:name" format for Select component
 */
export function buildCredentialValue(
  credentials: GitCredential[],
  credentialName: string | undefined,
  authType: string
): string {
  if (!credentialName) return '__none__'

  // Determine expected credential type based on auth_type
  let expectedType = 'token'
  if (authType === 'ssh_key') {
    expectedType = 'ssh_key'
  } else if (authType === 'generic') {
    expectedType = 'generic'
  }

  const matchingCred = credentials.find(
    cred => cred.name === credentialName && cred.type === expectedType
  )

  if (matchingCred?.id) {
    return `${matchingCred.id}:${matchingCred.name}`
  } else if (matchingCred) {
    // Fallback for credentials without ID
    return credentialName
  }

  return '__none__'
}

/**
 * Filter credentials by authentication type
 */
export function filterCredentialsByAuthType(
  credentials: GitCredential[],
  authType: string
): GitCredential[] {
  if (authType === 'ssh_key') {
    return credentials.filter(cred => cred.type === 'ssh_key')
  } else if (authType === 'generic') {
    return credentials.filter(cred => cred.type === 'generic')
  } else {
    return credentials.filter(cred => cred.type === 'token')
  }
}

/**
 * Get label for credential select dropdown
 */
export function getCredentialLabel(authType: string): string {
  if (authType === 'ssh_key') return 'SSH Key Credential'
  if (authType === 'generic') return 'Generic Credential'
  return 'Token Credential'
}

/**
 * Get placeholder for credential select dropdown
 */
export function getCredentialPlaceholder(authType: string): string {
  if (authType === 'ssh_key') return 'Select SSH key credential'
  if (authType === 'generic') return 'Select generic credential'
  return 'Select token credential'
}

/**
 * Get category badge color
 */
export function getCategoryBadgeColor(category: string): string {
  switch (category) {
    case 'device_configs': return 'bg-blue-100 text-blue-800 hover:bg-blue-200'
    case 'cockpit_configs': return 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200'
    case 'templates': return 'bg-purple-100 text-purple-800 hover:bg-purple-200'
    case 'ansible': return 'bg-orange-100 text-orange-800 hover:bg-orange-200'
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
  }
}

/**
 * Get status badge color
 */
export function getStatusBadgeColor(isActive: boolean): string {
  return isActive
    ? 'bg-green-100 text-green-800 hover:bg-green-200'
    : 'bg-red-100 text-red-800 hover:bg-red-200'
}

/**
 * Format date string
 */
export function formatDate(dateString?: string): string {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString()
}

/**
 * Truncate URL for display
 */
export function truncateUrl(url: string, maxLength = 50): string {
  return url.length > maxLength ? url.substring(0, maxLength - 3) + '...' : url
}
```

---

### Phase 5: Component Extraction (Day 2, Afternoon - Day 3)
**Estimated Time:** 8 hours

#### 5.1 Create `components/repository-list.tsx`

**Purpose:** Repository list with cards
**Lines:** ~150 lines

```typescript
// components/repository-list.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, GitBranch } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RepositoryCard } from './repository-card'
import type { GitRepository } from '../types'

interface RepositoryListProps {
  repositories: GitRepository[]
  isLoading: boolean
  onRefresh: () => void
  onEdit: (repo: GitRepository) => void
  onSync: (repo: GitRepository) => void
  onRemoveAndSync: (repo: GitRepository) => void
  onViewStatus: (repo: GitRepository) => void
  onDebug: (repo: GitRepository) => void
  onDelete: (repo: GitRepository) => void
}

export function RepositoryList({
  repositories,
  isLoading,
  onRefresh,
  onEdit,
  onSync,
  onRemoveAndSync,
  onViewStatus,
  onDebug,
  onDelete,
}: RepositoryListProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 pl-8 pr-8 -mx-6 -mt-6 mb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white text-sm font-semibold">
            <GitBranch className="h-4 w-4" />
            Managed Repositories ({repositories.length})
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onRefresh}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-white hover:bg-white/20 shrink-0"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reload repository list</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">Loading repositories...</p>
          </div>
        ) : repositories.length === 0 ? (
          <div className="text-center py-8">
            <GitBranch className="h-12 w-12 mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">No repositories found</p>
            <p className="text-sm text-gray-400">Add a repository to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {repositories.map((repo) => (
              <RepositoryCard
                key={repo.id}
                repository={repo}
                onEdit={onEdit}
                onSync={onSync}
                onRemoveAndSync={onRemoveAndSync}
                onViewStatus={onViewStatus}
                onDebug={onDebug}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

#### 5.2 Create `components/repository-card.tsx`

**Purpose:** Individual repository card with actions
**Lines:** ~120 lines

```typescript
// components/repository-card.tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Edit,
  Download,
  RotateCcw,
  Eye,
  Bug,
  Trash2,
  ExternalLink,
  GitBranch,
  Clock,
} from 'lucide-react'
import { getCategoryBadgeColor, getStatusBadgeColor, formatDate, truncateUrl } from '../utils'
import type { GitRepository } from '../types'

interface RepositoryCardProps {
  repository: GitRepository
  onEdit: (repo: GitRepository) => void
  onSync: (repo: GitRepository) => void
  onRemoveAndSync: (repo: GitRepository) => void
  onViewStatus: (repo: GitRepository) => void
  onDebug: (repo: GitRepository) => void
  onDelete: (repo: GitRepository) => void
}

export function RepositoryCard({
  repository,
  onEdit,
  onSync,
  onRemoveAndSync,
  onViewStatus,
  onDebug,
  onDelete,
}: RepositoryCardProps) {
  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-gray-900">{repository.name}</h3>
            <Badge className={getCategoryBadgeColor(repository.category)}>
              {repository.category}
            </Badge>
            <Badge className={getStatusBadgeColor(repository.is_active)}>
              {repository.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <ExternalLink className="h-4 w-4" />
              <a
                href={repository.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 underline"
              >
                {truncateUrl(repository.url)}
              </a>
            </div>
            <div className="flex items-center gap-1">
              <GitBranch className="h-4 w-4" />
              {repository.branch}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Last sync: {formatDate(repository.last_sync)}
            </div>
          </div>
          {repository.description && (
            <p className="text-sm text-gray-600">{repository.description}</p>
          )}
        </div>
        <TooltipProvider>
          <div className="flex items-center gap-2 ml-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => onEdit(repository)} variant="outline" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit repository settings</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => onSync(repository)} variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sync repository (pull latest changes)</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onRemoveAndSync(repository)}
                  variant="outline"
                  size="sm"
                  className="text-orange-600 hover:text-orange-700"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove and re-clone repository</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => onViewStatus(repository)} variant="outline" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View repository status and details</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onDebug(repository)}
                  variant="outline"
                  size="sm"
                  className="text-purple-600 hover:text-purple-700"
                >
                  <Bug className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Debug repository (read/write/delete tests)</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onDelete(repository)}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete repository</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  )
}
```

#### 5.3 Create `components/repository-form.tsx`

**Purpose:** Reusable repository form (create & edit)
**Lines:** ~300 lines

```typescript
// components/repository-form.tsx
import { UseFormReturn } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { REPOSITORY_CATEGORIES, AUTH_TYPES } from '../constants'
import { CredentialSelect } from './credential-select'
import { ConnectionTestPanel } from './connection-test-panel'
import type { RepositoryFormValues } from '../validation'
import type { GitCredential } from '../types'

interface RepositoryFormProps {
  form: UseFormReturn<RepositoryFormValues>
  credentials: GitCredential[]
  isSubmitting: boolean
  showConnectionTest?: boolean
  onConnectionTest?: () => void
  connectionTestStatus?: { type: 'success' | 'error'; text: string } | null
  isTestingConnection?: boolean
}

export function RepositoryForm({
  form,
  credentials,
  isSubmitting,
  showConnectionTest = true,
  onConnectionTest,
  connectionTestStatus,
  isTestingConnection = false,
}: RepositoryFormProps) {
  const { register, watch, setValue, formState: { errors } } = form
  const authType = watch('auth_type')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Repository Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-semibold text-gray-800">
            Repository Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="My Config Repository"
            {...register('name')}
            className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            disabled={isSubmitting}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
          <p className="text-xs text-gray-600">Unique name to identify this repository</p>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category" className="text-sm font-semibold text-gray-800">
            Category <span className="text-destructive">*</span>
          </Label>
          <Select
            value={watch('category')}
            onValueChange={(value) => setValue('category', value as any)}
            disabled={isSubmitting}
          >
            <SelectTrigger id="category" className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {REPOSITORY_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-xs text-destructive">{errors.category.message}</p>
          )}
          <p className="text-xs text-gray-600">Purpose of this repository</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Repository URL */}
        <div className="space-y-2">
          <Label htmlFor="url" className="text-sm font-semibold text-gray-800">
            Repository URL <span className="text-destructive">*</span>
          </Label>
          <Input
            id="url"
            type="url"
            placeholder="https://github.com/username/repo.git"
            {...register('url')}
            className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            disabled={isSubmitting}
          />
          {errors.url && (
            <p className="text-xs text-destructive">{errors.url.message}</p>
          )}
          <p className="text-xs text-gray-600">Git repository URL</p>
        </div>

        {/* Branch */}
        <div className="space-y-2">
          <Label htmlFor="branch" className="text-sm font-semibold text-gray-800">
            Default Branch
          </Label>
          <Input
            id="branch"
            placeholder="main"
            {...register('branch')}
            className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-600">Default branch to use</p>
        </div>
      </div>

      {/* Authentication Type */}
      <div className="space-y-2">
        <Label htmlFor="auth_type" className="text-sm font-semibold text-gray-800">
          Authentication Type
        </Label>
        <Select
          value={authType}
          onValueChange={(value) => {
            setValue('auth_type', value as any)
            setValue('credential_name', '__none__')
          }}
          disabled={isSubmitting}
        >
          <SelectTrigger id="auth_type" className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200">
            <SelectValue placeholder="Select authentication type" />
          </SelectTrigger>
          <SelectContent>
            {AUTH_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-600">How to authenticate with this repository</p>
      </div>

      {/* Credential Select (conditional) */}
      {authType !== 'none' && (
        <CredentialSelect
          authType={authType}
          credentials={credentials}
          value={watch('credential_name')}
          onChange={(value) => setValue('credential_name', value)}
          disabled={isSubmitting}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Path */}
        <div className="space-y-2">
          <Label htmlFor="path" className="text-sm font-semibold text-gray-800">
            Path
          </Label>
          <Input
            id="path"
            placeholder="configs/"
            {...register('path')}
            className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-600">Path within repository (leave empty for root)</p>
        </div>

        {/* Verify SSL */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="verify-ssl"
              checked={watch('verify_ssl')}
              onCheckedChange={(checked) => setValue('verify_ssl', !!checked)}
              className="border-2 border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              disabled={isSubmitting}
            />
            <Label htmlFor="verify-ssl" className="text-sm font-semibold text-gray-800">
              Verify SSL certificates
            </Label>
          </div>
          <p className="text-xs text-gray-600">Disable for self-signed certificates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Git Author Name */}
        <div className="space-y-2">
          <Label htmlFor="git_author_name" className="text-sm font-semibold text-gray-800">
            Git Author Name
          </Label>
          <Input
            id="git_author_name"
            type="text"
            placeholder="e.g., Network Team (optional)"
            {...register('git_author_name')}
            className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-600">Name used for git commits (defaults to &quot;Cockpit-NG Automation&quot;)</p>
        </div>

        {/* Git Author Email */}
        <div className="space-y-2">
          <Label htmlFor="git_author_email" className="text-sm font-semibold text-gray-800">
            Git Author Email
          </Label>
          <Input
            id="git_author_email"
            type="email"
            placeholder="e.g., network@company.com (optional)"
            {...register('git_author_email')}
            className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            disabled={isSubmitting}
          />
          {errors.git_author_email && (
            <p className="text-xs text-destructive">{errors.git_author_email.message}</p>
          )}
          <p className="text-xs text-gray-600">Email used for git commits (defaults to &quot;noreply@cockpit-ng.local&quot;)</p>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-semibold text-gray-800">
          Description
        </Label>
        <Textarea
          id="description"
          placeholder="Optional description for this repository"
          rows={3}
          {...register('description')}
          className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 resize-none"
          disabled={isSubmitting}
        />
      </div>

      {/* Connection Test Panel (conditional) */}
      {showConnectionTest && (
        <>
          <Separator />
          <ConnectionTestPanel
            onTest={onConnectionTest}
            status={connectionTestStatus}
            isLoading={isTestingConnection}
            disabled={isSubmitting || !watch('url')}
          />
        </>
      )}
    </div>
  )
}
```

#### 5.4 Create remaining components

Similar patterns for:
- `components/credential-select.tsx` (~80 lines) - Credential dropdown with filtering
- `components/connection-test-panel.tsx` (~60 lines) - Connection test UI
- `components/repository-edit-dialog.tsx` (~120 lines) - Edit dialog wrapper
- `components/repository-status-dialog.tsx` (~200 lines) - Status viewer
- `components/repository-debug-dialog/` - Debug dialog components
  - `index.tsx` (~100 lines) - Main dialog wrapper with tabs
  - `diagnostics-tab.tsx` (~250 lines) - Diagnostics display
  - `test-operation-tab.tsx` (~100 lines) - Reusable test tab
  - `types.ts` - Tab-specific types

---

### Phase 6: Main Component Refactoring (Day 3)
**Estimated Time:** 4 hours

#### 6.1 Refactored Main Component

**Target Size:** 350-400 lines

```typescript
// git-management.tsx (Refactored)
'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Form } from '@/components/ui/form'
import { Github, GitBranch, Plus, RefreshCw } from 'lucide-react'

// TanStack Query Hooks
import { useGitRepositoriesQuery } from '@/hooks/queries/use-git-repositories-query'
import { useGitMutations } from '@/hooks/queries/use-git-mutations'
import { useCredentialsQuery } from './hooks/queries/use-credentials-query'

// Custom Hooks
import { useRepositoryForm } from './hooks/use-repository-form'
import { useRepositoryStatus } from './hooks/use-repository-status'
import { useRepositoryDebug } from './hooks/use-repository-debug'
import { useConnectionTest } from './hooks/use-connection-test'

// Components
import { RepositoryList } from './components/repository-list'
import { RepositoryForm } from './components/repository-form'
import { RepositoryEditDialog } from './components/repository-edit-dialog'
import { RepositoryStatusDialog } from './components/repository-status-dialog'
import { RepositoryDebugDialog } from './components/repository-debug-dialog'

// Utils
import { extractCredentialName } from './utils'
import { DEFAULT_FORM_DATA, EMPTY_CREDENTIALS } from './constants'
import type { GitRepository } from './types'

const GitManagement: React.FC = () => {
  // Message state
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // TanStack Query - Repositories
  const { data: reposData, isLoading: loadingRepos, refetch: refetchRepositories } = useGitRepositoriesQuery()
  const repositories = reposData?.repositories || []

  // TanStack Query - Mutations
  const {
    createRepository: createRepoMutation,
    updateRepository: updateRepoMutation,
    deleteRepository: deleteRepoMutation,
    syncRepository: syncRepoMutation,
    removeAndSyncRepository: removeAndSyncRepoMutation,
  } = useGitMutations()

  // TanStack Query - Credentials
  const { data: credentials = EMPTY_CREDENTIALS } = useCredentialsQuery()

  // Create form
  const createForm = useRepositoryForm()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Connection test
  const connectionTest = useConnectionTest()

  // Edit dialog
  const [editingRepo, setEditingRepo] = useState<GitRepository | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)

  // Status dialog
  const repositoryStatus = useRepositoryStatus()

  // Debug dialog
  const repositoryDebug = useRepositoryDebug()

  // Message helper
  const showMessage = useCallback((text: string, type: 'success' | 'error') => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }, [])

  // Form submission
  const handleFormSubmit = useCallback(async (data: RepositoryFormValues) => {
    setIsSubmitting(true)
    try {
      const credentialName = extractCredentialName(data.credential_name)

      await createRepoMutation.mutateAsync({
        ...data,
        auth_type: data.auth_type || 'none',
        credential_name: credentialName,
      })

      createForm.reset(DEFAULT_FORM_DATA)
      connectionTest.clearStatus()
    } catch {
      // Error already handled by mutation's onError
    } finally {
      setIsSubmitting(false)
    }
  }, [createRepoMutation, createForm, connectionTest])

  // Connection test handler
  const handleConnectionTest = useCallback(() => {
    const formData = createForm.getValues()
    const credentialName = extractCredentialName(formData.credential_name)

    connectionTest.testConnection({
      url: formData.url,
      branch: formData.branch || 'main',
      auth_type: formData.auth_type || 'none',
      credential_name: credentialName,
      verify_ssl: formData.verify_ssl,
    })
  }, [createForm, connectionTest])

  // Repository actions
  const handleEditRepository = useCallback((repo: GitRepository) => {
    setEditingRepo(repo)
    setShowEditDialog(true)
  }, [])

  const handleDeleteRepository = useCallback(async (repo: GitRepository) => {
    if (!confirm(`Are you sure you want to delete "${repo.name}"?`)) {
      return
    }

    try {
      await deleteRepoMutation.mutateAsync(repo.id)
    } catch {
      // Error already handled by mutation's onError
    }
  }, [deleteRepoMutation])

  const handleSyncRepository = useCallback(async (repo: GitRepository) => {
    try {
      await syncRepoMutation.mutateAsync(repo.id)
    } catch {
      // Error already handled by mutation's onError
    }
  }, [syncRepoMutation])

  const handleRemoveAndSyncRepository = useCallback(async (repo: GitRepository) => {
    if (!confirm(
      `Are you sure you want to remove and re-clone "${repo.name}"? This will permanently delete the local copy and create a fresh clone.`
    )) {
      return
    }

    try {
      await removeAndSyncRepoMutation.mutateAsync(repo.id)
    } catch {
      // Error already handled by mutation's onError
    }
  }, [removeAndSyncRepoMutation])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Github className="h-6 w-6" />
          Git Repository Management
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage Git repositories for configurations, templates, and other resources
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-md ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Repository List
          </TabsTrigger>
          <TabsTrigger value="add" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Repository
          </TabsTrigger>
        </TabsList>

        {/* Repository List Tab */}
        <TabsContent value="list" className="space-y-4">
          <RepositoryList
            repositories={repositories}
            isLoading={loadingRepos}
            onRefresh={refetchRepositories}
            onEdit={handleEditRepository}
            onSync={handleSyncRepository}
            onRemoveAndSync={handleRemoveAndSyncRepository}
            onViewStatus={repositoryStatus.openDialog}
            onDebug={repositoryDebug.openDialog}
            onDelete={handleDeleteRepository}
          />
        </TabsContent>

        {/* Add Repository Tab */}
        <TabsContent value="add" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Plus className="h-4 w-4" />
                Add New Git Repository
              </CardTitle>
              <CardDescription className="text-blue-50 text-sm">
                Configure a new Git repository for configurations, templates, or other resources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(handleFormSubmit)} className="space-y-6">
                  <RepositoryForm
                    form={createForm}
                    credentials={credentials}
                    isSubmitting={isSubmitting}
                    showConnectionTest
                    onConnectionTest={handleConnectionTest}
                    connectionTestStatus={connectionTest.status}
                    isTestingConnection={connectionTest.isLoading}
                  />

                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex gap-4">
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                      >
                        {isSubmitting ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Add Repository
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          createForm.reset(DEFAULT_FORM_DATA)
                          connectionTest.clearStatus()
                        }}
                        variant="outline"
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Reset Form
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RepositoryEditDialog
        repository={editingRepo}
        show={showEditDialog}
        onClose={() => {
          setShowEditDialog(false)
          setEditingRepo(null)
        }}
        credentials={credentials}
      />

      <RepositoryStatusDialog
        show={repositoryStatus.showDialog}
        onClose={repositoryStatus.closeDialog}
        statusData={repositoryStatus.statusData}
        isLoading={repositoryStatus.isLoading}
      />

      <RepositoryDebugDialog
        show={repositoryDebug.showDialog}
        onClose={repositoryDebug.closeDialog}
        repository={repositoryDebug.debugRepo}
        result={repositoryDebug.debugResult}
        currentTab={repositoryDebug.debugTab}
        onTabChange={repositoryDebug.setDebugTab}
        isLoading={repositoryDebug.isLoading}
        onRunOperation={repositoryDebug.runOperation}
      />
    </div>
  )
}

export default GitManagement
```

---

## Final File Structure

```
git/
├── components/
│   ├── repository-list.tsx               (~150 lines) ✨ NEW
│   ├── repository-card.tsx               (~120 lines) ✨ NEW
│   ├── repository-form.tsx               (~300 lines) ✨ NEW
│   ├── credential-select.tsx             (~80 lines) ✨ NEW
│   ├── connection-test-panel.tsx         (~60 lines) ✨ NEW
│   ├── repository-edit-dialog.tsx        (~120 lines) ✨ NEW
│   ├── repository-status-dialog.tsx      (~200 lines) ✨ NEW
│   ├── repository-debug-dialog/
│   │   ├── index.tsx                     (~100 lines) ✨ NEW
│   │   ├── diagnostics-tab.tsx           (~250 lines) ✨ NEW
│   │   ├── test-operation-tab.tsx        (~100 lines) ✨ NEW
│   │   └── types.ts                      (~30 lines) ✨ NEW
│   └── index.ts                          (barrel exports)
├── hooks/
│   ├── queries/                          📁 EXISTS
│   │   ├── use-git-repositories-query.ts (✅ EXISTS)
│   │   ├── use-git-mutations.ts          (✅ EXISTS)
│   │   ├── use-credentials-query.ts      (~50 lines) ✨ NEW
│   │   └── index.ts                      (barrel exports)
│   ├── use-repository-form.ts            (~80 lines) ✨ NEW
│   ├── use-repository-status.ts          (~60 lines) ✨ NEW
│   ├── use-repository-debug.ts           (~80 lines) ✨ NEW
│   ├── use-connection-test.ts            (~60 lines) ✨ NEW
│   └── index.ts                          (barrel exports)
├── types.ts                               (~150 lines) ✨ NEW
├── constants.ts                           (~80 lines) ✨ NEW
├── validation.ts                          (~50 lines) ✨ NEW
├── utils.ts                               (~150 lines) ✨ NEW
└── git-management.tsx                     (1924 → ~350 lines) 📉 REFACTORED
```

---

## Metrics Summary

### Before Refactoring
- **Main Component:** 1,924 lines
- **State Variables:** 17 (manual useState)
- **useEffect Hooks:** 2
- **Total Hooks:** 19
- **Inline Interfaces:** 6
- **Manual form management:** Two separate form states
- **Manual validation:** String checks
- **Form library:** None

### After Refactoring
- **Main Component:** ~350 lines (82% reduction)
- **State Variables:** 3 (message, editingRepo, showEditDialog)
- **useEffect Hooks:** 0 (handled by TanStack Query)
- **Total Hooks:** ~8
- **TanStack Query hooks:** 2 queries + 5 mutations (already exists)
- **react-hook-form:** Type-safe validation
- **Zod schemas:** Compile-time type safety

### New Structure
- **1 TanStack Query hook** (credentials)
- **4 Custom hooks** (form, status, debug, connection test)
- **11 Components** (single responsibility)
- **4 Utility files** (types, constants, validation, utils)
- **Total Files:** 21 (from 3)

---

## Success Criteria

✅ Main component reduced to < 400 lines
✅ No manual form state management
✅ react-hook-form + Zod for validation
✅ TanStack Query for credentials
✅ Memoized hook returns (no infinite loops)
✅ Stable constants outside components
✅ Component extraction (dialogs to separate files)
✅ All tests passing
✅ No regression in functionality
✅ Improved type safety
✅ Better code organization

---

## Migration Checklist

### Phase 1: Types & Constants
- [ ] Create `types.ts` with all interfaces
- [ ] Create `constants.ts` with stable references
- [ ] Create `validation.ts` with Zod schemas
- [ ] Verify no type errors

### Phase 2: Credentials Query
- [ ] Add credentials query keys to `/lib/query-keys.ts`
- [ ] Create `hooks/queries/use-credentials-query.ts`
- [ ] Test credentials query

### Phase 3: Custom Hooks
- [ ] Create `hooks/use-repository-form.ts`
- [ ] Create `hooks/use-repository-status.ts`
- [ ] Create `hooks/use-repository-debug.ts`
- [ ] Create `hooks/use-connection-test.ts`
- [ ] Test each hook for infinite loops

### Phase 4: Utility Functions
- [ ] Create `utils.ts` with helper functions
- [ ] Test utility functions

### Phase 5: Components
- [ ] Create `components/repository-list.tsx`
- [ ] Create `components/repository-card.tsx`
- [ ] Create `components/repository-form.tsx`
- [ ] Create `components/credential-select.tsx`
- [ ] Create `components/connection-test-panel.tsx`
- [ ] Create `components/repository-edit-dialog.tsx`
- [ ] Create `components/repository-status-dialog.tsx`
- [ ] Create `components/repository-debug-dialog/` directory
  - [ ] Create `index.tsx` (main dialog)
  - [ ] Create `diagnostics-tab.tsx`
  - [ ] Create `test-operation-tab.tsx`
  - [ ] Create `types.ts`
- [ ] Create barrel exports `components/index.ts`

### Phase 6: Main Component
- [ ] Refactor main component to orchestrator
- [ ] Replace manual form state with react-hook-form
- [ ] Replace manual validation with Zod
- [ ] Test all repository operations
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
| Phase 1: Types & Constants | 2 hours | Day 1 AM |
| Phase 2: Credentials Query | 1 hour | Day 1 AM |
| Phase 3: Custom Hooks | 4 hours | Day 2 AM |
| Phase 4: Utilities | 1 hour | Day 2 PM |
| Phase 5: Components | 8 hours | Day 2 PM - Day 3 |
| Phase 6: Main Component | 4 hours | Day 3 |
| Testing & QA | 4 hours | Day 3-4 |
| **Total** | **24 hours** | **3-4 days** |

---

## Key Differences from Add Device Page Refactoring

1. **TanStack Query Already Implemented** ✅
   - Repositories query exists
   - Mutations already extracted
   - Only need credentials query

2. **Smaller Form Complexity**
   - Single repository form (not dynamic interfaces)
   - Simpler validation requirements

3. **Focus on Dialog Extraction**
   - Large debug dialog (571 lines) → separate component directory
   - Status dialog → separate component
   - Edit dialog → separate component

4. **Credential Management**
   - Need credential filtering utilities
   - Credential select component

5. **Debug Functionality**
   - Complex multi-tab debug interface
   - Reusable test operation tab component

---

**Status:** Ready for Implementation
**Priority:** HIGH
**Estimated Completion:** 3-4 working days
**Architecture:** TanStack Query + react-hook-form + Zod
**Dependencies:** None
**Blockers:** None
