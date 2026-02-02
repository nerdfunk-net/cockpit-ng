# TIG-Stack Deploy App - Frontend Implementation Plan

## Overview
Create a new "Deploy" app under the TIG-Stack menu that replicates the Netmiko app structure for consistent UI/UX. The app will have three tabs: Devices, Variables & Templates, and Deploy.

## Architecture Pattern
Following the Netmiko app pattern at `/frontend/src/components/features/network/automation/netmiko/`, we'll create a modular, maintainable structure using:
- Feature-based organization
- Custom hooks for state management
- Separation of concerns (UI, logic, data)
- Shadcn UI components
- Reusable dialogs and panels

---

## Implementation Steps

### 1. Create Directory Structure

**Location:** `/frontend/src/components/features/tig-stack/deploy/`

```
deploy/
├── index.ts                                    # Barrel exports
├── tig-deploy-page.tsx                         # Main page component
├── types/
│   └── index.ts                                # Type definitions
├── utils/
│   └── deploy-utils.ts                         # Pure utility functions
├── hooks/
│   ├── use-credential-manager.ts               # Credential state (reuse from Netmiko)
│   ├── use-template-manager.ts                 # Template state (reuse from Netmiko)
│   ├── use-variable-manager.ts                 # Variable state (reuse from Netmiko)
│   ├── use-git-repository-selector.ts          # Git repo selection state
│   └── use-deploy-execution.ts                 # Deploy/dry-run logic
├── ui/
│   ├── repository-selector.tsx                 # Git repo dropdown
│   └── deploy-action-buttons.tsx               # Deploy buttons panel
├── tabs/
│   ├── device-selection-tab.tsx                # Device picker (reuse Netmiko's)
│   ├── variables-and-templates-tab.tsx         # Variables/templates (reuse)
│   └── deploy-tab.tsx                          # Deploy operations tab
├── dialogs/
│   ├── dry-run-result-dialog.tsx               # Show rendered config
│   ├── deploy-confirmation-dialog.tsx          # Confirm before deploy
│   └── error-dialog.tsx                        # Error display (reuse)
└── components/
    ├── deploy-results.tsx                      # Deployment result display
    └── config-preview.tsx                      # Config preview component
```

### 2. Create Route Page

**File:** `/frontend/src/app/(dashboard)/tig-stack/deploy/page.tsx`

```typescript
import { TigDeployPage } from '@/components/features/tig-stack/deploy'

export default function TigStackDeployRoute() {
  return <TigDeployPage />
}
```

### 3. Define Types

**File:** `/frontend/src/components/features/tig-stack/deploy/types/index.ts`

```typescript
// Reuse from Netmiko where applicable
export interface DeployConfig {
  deviceIds: string[]
  templateId: number
  variables: Record<string, string>
  repositoryId: number
  useNautobotContext: boolean
}

export interface DryRunResult {
  deviceId: string
  deviceName: string
  renderedConfig: string
  success: boolean
  error?: string
}

export interface DeployResult {
  deviceId: string
  deviceName: string
  success: boolean
  gitCommitHash?: string
  activationStatus?: 'pending' | 'success' | 'failed'
  error?: string
}

export interface DeployExecutionSummary {
  total: number
  successful: number
  failed: number
}

// Git repository interface (reuse from /types/git.ts)
export { GitRepository } from '@/types/git'
```

### 4. Implement Custom Hooks

#### Hook: `use-git-repository-selector.ts`

```typescript
import { useState, useEffect, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { GitRepository, RepositoriesResponse } from '@/types/git'

export function useGitRepositorySelector() {
  const [repositories, setRepositories] = useState<GitRepository[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const { apiCall } = useApi()

  useEffect(() => {
    const loadRepositories = async () => {
      try {
        const response = await apiCall<RepositoriesResponse>('git-repositories')
        const activeRepos = response.repositories.filter(r => r.is_active)
        setRepositories(activeRepos)

        // Auto-select first TIG-Stack category repo
        const tigRepo = activeRepos.find(r => r.category === 'tig-stack')
        if (tigRepo) {
          setSelectedRepoId(tigRepo.id)
        } else if (activeRepos.length > 0) {
          setSelectedRepoId(activeRepos[0].id)
        }
      } catch (error) {
        console.error('Failed to load git repositories:', error)
      } finally {
        setLoading(false)
      }
    }

    loadRepositories()
  }, [apiCall])

  const selectedRepository = useMemo(
    () => repositories.find(r => r.id === selectedRepoId) || null,
    [repositories, selectedRepoId]
  )

  return useMemo(() => ({
    repositories,
    selectedRepoId,
    selectedRepository,
    setSelectedRepoId,
    loading
  }), [repositories, selectedRepoId, selectedRepository, loading])
}
```

#### Hook: `use-deploy-execution.ts`

```typescript
import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { DryRunResult, DeployResult, DeployExecutionSummary } from '../types'

export function useDeployExecution() {
  const [isDryRunning, setIsDryRunning] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [isActivating, setIsActivating] = useState(false)

  const [dryRunResults, setDryRunResults] = useState<DryRunResult[]>([])
  const [deployResults, setDeployResults] = useState<DeployResult[]>([])
  const [showDryRunDialog, setShowDryRunDialog] = useState(false)
  const [showDeployResults, setShowDeployResults] = useState(false)

  const { apiCall } = useApi()

  const executeDryRun = useCallback(async (config: DeployConfig) => {
    setIsDryRunning(true)
    try {
      // API call: POST /tig-stack/deploy/dry-run
      const response = await apiCall<{ results: DryRunResult[] }>(
        'tig-stack/deploy/dry-run',
        {
          method: 'POST',
          body: JSON.stringify(config)
        }
      )
      setDryRunResults(response.results)
      setShowDryRunDialog(true)
    } catch (error) {
      console.error('Dry run failed:', error)
      throw error
    } finally {
      setIsDryRunning(false)
    }
  }, [apiCall])

  const executeDeployToGit = useCallback(async (config: DeployConfig) => {
    setIsDeploying(true)
    try {
      // API call: POST /tig-stack/deploy/to-git
      const response = await apiCall<{ results: DeployResult[] }>(
        'tig-stack/deploy/to-git',
        {
          method: 'POST',
          body: JSON.stringify(config)
        }
      )
      setDeployResults(response.results)
      setShowDeployResults(true)
    } catch (error) {
      console.error('Deploy to git failed:', error)
      throw error
    } finally {
      setIsDeploying(false)
    }
  }, [apiCall])

  const executeActivate = useCallback(async (config: DeployConfig) => {
    setIsActivating(true)
    try {
      // API call: POST /tig-stack/deploy/activate
      const response = await apiCall<{ results: DeployResult[] }>(
        'tig-stack/deploy/activate',
        {
          method: 'POST',
          body: JSON.stringify(config)
        }
      )
      setDeployResults(response.results)
      setShowDeployResults(true)
    } catch (error) {
      console.error('Activation failed:', error)
      throw error
    } finally {
      setIsActivating(false)
    }
  }, [apiCall])

  const resetResults = useCallback(() => {
    setDryRunResults([])
    setDeployResults([])
    setShowDryRunDialog(false)
    setShowDeployResults(false)
  }, [])

  const deploymentSummary = useMemo<DeployExecutionSummary>(() => {
    const results = deployResults.length > 0 ? deployResults : dryRunResults
    return {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  }, [dryRunResults, deployResults])

  return useMemo(() => ({
    isDryRunning,
    isDeploying,
    isActivating,
    dryRunResults,
    deployResults,
    showDryRunDialog,
    showDeployResults,
    deploymentSummary,
    setShowDryRunDialog,
    setShowDeployResults,
    executeDryRun,
    executeDeployToGit,
    executeActivate,
    resetResults
  }), [
    isDryRunning,
    isDeploying,
    isActivating,
    dryRunResults,
    deployResults,
    showDryRunDialog,
    showDeployResults,
    deploymentSummary,
    executeDryRun,
    executeDeployToGit,
    executeActivate,
    resetResults
  ])
}
```

### 5. Create Tab Components

#### Tab 1: Device Selection (Reuse)

**File:** `tabs/device-selection-tab.tsx`

```typescript
// Thin wrapper around shared device selection component
import { UnifiedDeviceSelectionTab } from '@/components/features/shared/device-selection'
import type { DeviceInfo } from '@/components/features/shared/device-selection/types'

interface DeviceSelectionTabProps {
  selectedDeviceIds: string[]
  selectedDevices: DeviceInfo[]
  onDevicesSelected: (devices: DeviceInfo[]) => void
}

export function DeviceSelectionTab({
  selectedDeviceIds,
  selectedDevices,
  onDevicesSelected
}: DeviceSelectionTabProps) {
  return (
    <UnifiedDeviceSelectionTab
      selectedDeviceIds={selectedDeviceIds}
      selectedDevices={selectedDevices}
      onDevicesSelected={onDevicesSelected}
      showBulkActions={false}
    />
  )
}
```

#### Tab 2: Variables & Templates (Reuse)

**File:** `tabs/variables-and-templates-tab.tsx`

```typescript
// Reuse from Netmiko with same functionality
import { VariablesAndTemplatesTab as NetmikoVariablesTab } from '@/components/features/network/automation/netmiko/tabs/variables-and-templates-tab'

export function VariablesAndTemplatesTab(props: any) {
  return <NetmikoVariablesTab {...props} />
}
```

#### Tab 3: Deploy Tab (NEW)

**File:** `tabs/deploy-tab.tsx`

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GitBranch, Play, GitCommit, Zap } from 'lucide-react'
import { RepositorySelector } from '../ui/repository-selector'
import type { GitRepository } from '../types'

interface DeployTabProps {
  repositories: GitRepository[]
  selectedRepoId: number | null
  onRepositoryChange: (repoId: number) => void
  isRepositoriesLoading: boolean
  canExecute: boolean
  isDryRunning: boolean
  isDeploying: boolean
  isActivating: boolean
  onDryRun: () => void
  onDeployToGit: () => void
  onActivate: () => void
}

export function DeployTab({
  repositories,
  selectedRepoId,
  onRepositoryChange,
  isRepositoriesLoading,
  canExecute,
  isDryRunning,
  isDeploying,
  isActivating,
  onDryRun,
  onDeployToGit,
  onActivate
}: DeployTabProps) {
  return (
    <div className="space-y-6">
      {/* Repository Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Git Repository</CardTitle>
          <CardDescription>
            Select the target repository for config deployment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RepositorySelector
            repositories={repositories}
            selectedRepoId={selectedRepoId}
            onChange={onRepositoryChange}
            loading={isRepositoriesLoading}
          />
        </CardContent>
      </Card>

      {/* Deploy Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment Actions</CardTitle>
          <CardDescription>
            Render templates, deploy to git, or activate changes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canExecute && (
            <Alert>
              <AlertDescription>
                Please select devices, a template, and a repository before proceeding
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
            {/* Dry Run */}
            <Button
              onClick={onDryRun}
              disabled={!canExecute || isDryRunning}
              variant="outline"
              className="w-full justify-start"
            >
              <Play className="mr-2 h-4 w-4" />
              {isDryRunning ? 'Rendering...' : 'Dry Run (Render Only)'}
            </Button>

            {/* Deploy to Git */}
            <Button
              onClick={onDeployToGit}
              disabled={!canExecute || isDeploying}
              variant="default"
              className="w-full justify-start"
            >
              <GitCommit className="mr-2 h-4 w-4" />
              {isDeploying ? 'Deploying...' : 'Deploy to Git'}
            </Button>

            {/* Activate */}
            <Button
              onClick={onActivate}
              disabled={!canExecute || isActivating}
              variant="destructive"
              className="w-full justify-start"
            >
              <Zap className="mr-2 h-4 w-4" />
              {isActivating ? 'Activating...' : 'Activate (via Cockpit Agent)'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 6. Create UI Components

#### Component: `ui/repository-selector.tsx`

```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import type { GitRepository } from '../types'

interface RepositorySelectorProps {
  repositories: GitRepository[]
  selectedRepoId: number | null
  onChange: (repoId: number) => void
  loading?: boolean
}

export function RepositorySelector({
  repositories,
  selectedRepoId,
  onChange,
  loading = false
}: RepositorySelectorProps) {
  if (loading) {
    return <Skeleton className="h-10 w-full" />
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="repository">Repository</Label>
      <Select
        value={selectedRepoId?.toString() || ''}
        onValueChange={(value) => onChange(Number(value))}
      >
        <SelectTrigger id="repository">
          <SelectValue placeholder="Select a repository" />
        </SelectTrigger>
        <SelectContent>
          {repositories.map((repo) => (
            <SelectItem key={repo.id} value={repo.id.toString()}>
              {repo.name} ({repo.branch})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

### 7. Create Dialogs

#### Dialog: `dialogs/dry-run-result-dialog.tsx`

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle } from 'lucide-react'
import type { DryRunResult } from '../types'

interface DryRunResultDialogProps {
  show: boolean
  onClose: () => void
  results: DryRunResult[]
}

export function DryRunResultDialog({
  show,
  onClose,
  results
}: DryRunResultDialogProps) {
  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Dry Run Results - Rendered Configs</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={results[0]?.deviceId || ''} className="w-full">
          <TabsList className="w-full overflow-x-auto">
            {results.map((result) => (
              <TabsTrigger key={result.deviceId} value={result.deviceId}>
                {result.success ? (
                  <CheckCircle className="mr-1 h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="mr-1 h-3 w-3 text-red-500" />
                )}
                {result.deviceName}
              </TabsTrigger>
            ))}
          </TabsList>

          {results.map((result) => (
            <TabsContent key={result.deviceId} value={result.deviceId}>
              <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
                {result.success ? (
                  <pre className="text-sm font-mono whitespace-pre-wrap">
                    {result.renderedConfig}
                  </pre>
                ) : (
                  <div className="text-red-600">
                    <p className="font-semibold">Rendering Failed</p>
                    <p className="mt-2">{result.error}</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
```

### 8. Main Page Component

**File:** `tig-deploy-page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

// Tabs
import { DeviceSelectionTab } from './tabs/device-selection-tab'
import { VariablesAndTemplatesTab } from './tabs/variables-and-templates-tab'
import { DeployTab } from './tabs/deploy-tab'

// Hooks
import { useCredentialManager } from './hooks/use-credential-manager'
import { useTemplateManager } from './hooks/use-template-manager'
import { useVariableManager } from './hooks/use-variable-manager'
import { useGitRepositorySelector } from './hooks/use-git-repository-selector'
import { useDeployExecution } from './hooks/use-deploy-execution'

// Dialogs
import { DryRunResultDialog } from './dialogs/dry-run-result-dialog'
import { ErrorDialog } from './dialogs/error-dialog'

// Types
import type { DeviceInfo } from '@/components/features/shared/device-selection/types'
import type { DeployConfig } from './types'

export function TigDeployPage() {
  const { toast } = useToast()

  // Device selection state
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])
  const [selectedDevices, setSelectedDevices] = useState<DeviceInfo[]>([])

  // Initialize hooks
  const credentialManager = useCredentialManager()
  const templateManager = useTemplateManager('tig-stack')  // Filter by category
  const variableManager = useVariableManager()
  const repoSelector = useGitRepositorySelector()
  const deployExecution = useDeployExecution()

  // Error dialog state
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDetails, setErrorDetails] = useState<{
    title: string
    message: string
    details?: string[]
  } | null>(null)

  // Check if execution is allowed
  const canExecute =
    selectedDeviceIds.length > 0 &&
    templateManager.selectedTemplateId !== 'none' &&
    repoSelector.selectedRepoId !== null

  // Build config for API calls
  const buildDeployConfig = (): DeployConfig => ({
    deviceIds: selectedDeviceIds,
    templateId: Number(templateManager.selectedTemplateId),
    variables: variableManager.variables.reduce((acc, v) => {
      if (v.name && v.value) acc[v.name] = v.value
      return acc
    }, {} as Record<string, string>),
    repositoryId: repoSelector.selectedRepoId!,
    useNautobotContext: variableManager.useNautobotContext
  })

  // Action handlers
  const handleDryRun = async () => {
    try {
      const config = buildDeployConfig()
      await deployExecution.executeDryRun(config)
    } catch (error) {
      setErrorDetails({
        title: 'Dry Run Failed',
        message: 'Failed to render templates',
        details: [(error as Error).message]
      })
      setShowErrorDialog(true)
    }
  }

  const handleDeployToGit = async () => {
    try {
      const config = buildDeployConfig()
      await deployExecution.executeDeployToGit(config)
      toast({
        title: 'Success',
        description: 'Configs deployed to git repository'
      })
    } catch (error) {
      setErrorDetails({
        title: 'Deploy Failed',
        message: 'Failed to deploy configs to git',
        details: [(error as Error).message]
      })
      setShowErrorDialog(true)
    }
  }

  const handleActivate = async () => {
    try {
      const config = buildDeployConfig()
      await deployExecution.executeActivate(config)
      toast({
        title: 'Success',
        description: 'Configs activated via Cockpit Agent'
      })
    } catch (error) {
      setErrorDetails({
        title: 'Activation Failed',
        message: 'Failed to activate configs',
        details: [(error as Error).message]
      })
      setShowErrorDialog(true)
    }
  }

  const handleDevicesSelected = (devices: DeviceInfo[]) => {
    setSelectedDeviceIds(devices.map(d => d.id))
    setSelectedDevices(devices)
    deployExecution.resetResults()
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>TIG-Stack Deploy</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="devices" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="devices">Devices</TabsTrigger>
              <TabsTrigger value="variables">Variables & Templates</TabsTrigger>
              <TabsTrigger value="deploy">Deploy</TabsTrigger>
            </TabsList>

            <TabsContent value="devices">
              <DeviceSelectionTab
                selectedDeviceIds={selectedDeviceIds}
                selectedDevices={selectedDevices}
                onDevicesSelected={handleDevicesSelected}
              />
            </TabsContent>

            <TabsContent value="variables">
              <VariablesAndTemplatesTab
                variables={variableManager.variables}
                useNautobotContext={variableManager.useNautobotContext}
                onVariablesChange={variableManager.addVariable}
                onUseNautobotContextChange={(checked) =>
                  variableManager.updateVariable(0, 'useNautobotContext', checked)
                }
                templates={templateManager.templates}
                selectedTemplateId={templateManager.selectedTemplateId}
                onTemplateChange={templateManager.handleTemplateChange}
                selectedDevices={selectedDevices}
                onError={(details) => {
                  setErrorDetails(details)
                  setShowErrorDialog(true)
                }}
              />
            </TabsContent>

            <TabsContent value="deploy">
              <DeployTab
                repositories={repoSelector.repositories}
                selectedRepoId={repoSelector.selectedRepoId}
                onRepositoryChange={repoSelector.setSelectedRepoId}
                isRepositoriesLoading={repoSelector.loading}
                canExecute={canExecute}
                isDryRunning={deployExecution.isDryRunning}
                isDeploying={deployExecution.isDeploying}
                isActivating={deployExecution.isActivating}
                onDryRun={handleDryRun}
                onDeployToGit={handleDeployToGit}
                onActivate={handleActivate}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <DryRunResultDialog
        show={deployExecution.showDryRunDialog}
        onClose={() => deployExecution.setShowDryRunDialog(false)}
        results={deployExecution.dryRunResults}
      />

      <ErrorDialog
        show={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        title={errorDetails?.title || ''}
        message={errorDetails?.message || ''}
        details={errorDetails?.details}
      />
    </div>
  )
}
```

### 9. Create Templates App (Standalone)

**File:** `/frontend/src/app/(dashboard)/tig-stack/templates/page.tsx`

```typescript
import { TemplatesPage } from '@/components/features/automation/templates'

export default function TigStackTemplatesRoute() {
  return <TemplatesPage category="tig-stack" />
}
```

**Note:** The templates page can reuse the existing `/automation/templates` component, filtered by category.

### 10. Update Sidebar Navigation

**File:** `/frontend/src/components/layout/app-sidebar.tsx`

Add new section after CheckMK (around line 94):

```typescript
{
  title: 'TIG-Stack',
  items: [
    { label: 'Deploy', href: '/tig-stack/deploy', icon: GitCommit },
    { label: 'Templates', href: '/tig-stack/templates', icon: FileText },
  ],
},
```

Import the new icon:

```typescript
import { GitCommit } from 'lucide-react'  // Add to line 11-45 imports
```

---

## Critical Files to Create/Modify

### New Files (26 files)
1. `/frontend/src/app/(dashboard)/tig-stack/deploy/page.tsx`
2. `/frontend/src/app/(dashboard)/tig-stack/templates/page.tsx`
3. `/frontend/src/components/features/tig-stack/deploy/index.ts`
4. `/frontend/src/components/features/tig-stack/deploy/tig-deploy-page.tsx`
5. `/frontend/src/components/features/tig-stack/deploy/types/index.ts`
6. `/frontend/src/components/features/tig-stack/deploy/utils/deploy-utils.ts`
7. `/frontend/src/components/features/tig-stack/deploy/hooks/use-credential-manager.ts` (reuse)
8. `/frontend/src/components/features/tig-stack/deploy/hooks/use-template-manager.ts` (reuse)
9. `/frontend/src/components/features/tig-stack/deploy/hooks/use-variable-manager.ts` (reuse)
10. `/frontend/src/components/features/tig-stack/deploy/hooks/use-git-repository-selector.ts` (new)
11. `/frontend/src/components/features/tig-stack/deploy/hooks/use-deploy-execution.ts` (new)
12. `/frontend/src/components/features/tig-stack/deploy/ui/repository-selector.tsx`
13. `/frontend/src/components/features/tig-stack/deploy/ui/deploy-action-buttons.tsx`
14. `/frontend/src/components/features/tig-stack/deploy/tabs/device-selection-tab.tsx`
15. `/frontend/src/components/features/tig-stack/deploy/tabs/variables-and-templates-tab.tsx`
16. `/frontend/src/components/features/tig-stack/deploy/tabs/deploy-tab.tsx`
17. `/frontend/src/components/features/tig-stack/deploy/dialogs/dry-run-result-dialog.tsx`
18. `/frontend/src/components/features/tig-stack/deploy/dialogs/deploy-confirmation-dialog.tsx`
19. `/frontend/src/components/features/tig-stack/deploy/dialogs/error-dialog.tsx` (reuse)
20. `/frontend/src/components/features/tig-stack/deploy/components/deploy-results.tsx`
21. `/frontend/src/components/features/tig-stack/deploy/components/config-preview.tsx`

### Modified Files (1 file)
1. `/frontend/src/components/layout/app-sidebar.tsx` - Add TIG-Stack menu section

---

## Reusable Components from Netmiko

The following components can be directly reused or minimally adapted:

1. **Device Selection** - `/components/features/shared/device-selection/` (already shared)
2. **Credential Manager Hook** - Reuse from Netmiko
3. **Template Manager Hook** - Reuse with category filter
4. **Variable Manager Hook** - Reuse as-is
5. **Error Dialog** - Reuse as-is
6. **Variable Manager Panel** - Reuse as-is
7. **Template Selection Panel** - Reuse as-is

---

## Backend API Endpoints (Placeholder)

These endpoints will be needed but are not implemented in this phase:

1. `POST /tig-stack/deploy/dry-run` - Render templates without execution
2. `POST /tig-stack/deploy/to-git` - Deploy configs to git repository
3. `POST /tig-stack/deploy/activate` - Activate configs via Cockpit Agent
4. `GET /git-repositories` - Already exists (reuse)
5. `GET /templates?category=tig-stack` - Already exists (reuse)

---

## Testing & Verification

### Manual Testing Checklist

1. **Navigation**
   - [ ] Sidebar shows "TIG-Stack" section with "Deploy" and "Templates" links
   - [ ] Clicking "Deploy" navigates to `/tig-stack/deploy`
   - [ ] Clicking "Templates" navigates to `/tig-stack/templates`

2. **Device Selection Tab**
   - [ ] Device selection grid displays correctly
   - [ ] Can select/deselect devices
   - [ ] Selected device count updates

3. **Variables & Templates Tab**
   - [ ] Templates load and filter by "tig-stack" category
   - [ ] Can add/remove variables
   - [ ] Can select template from dropdown
   - [ ] Template preview shows content

4. **Deploy Tab**
   - [ ] Git repositories load and populate dropdown
   - [ ] Repository selection works
   - [ ] Buttons are disabled when requirements not met
   - [ ] Dry Run button triggers dry run (shows placeholder for now)
   - [ ] Deploy to Git button works (shows placeholder for now)
   - [ ] Activate button works (shows placeholder for now)

5. **Dialogs**
   - [ ] Dry run result dialog displays rendered configs per device
   - [ ] Error dialog shows errors correctly
   - [ ] Dialogs close properly

### Browser Console Verification

- No React hydration errors
- No missing dependency warnings in useEffect
- No infinite re-render loops

### Responsive Design

- Test on desktop (1920x1080)
- Test on tablet (768px width)
- Test on mobile (375px width)

---

## Implementation Order

1. **Phase 1: Structure** - Create directory structure and routing
2. **Phase 2: Types & Utils** - Define TypeScript interfaces
3. **Phase 3: Hooks** - Implement custom hooks
4. **Phase 4: UI Components** - Build repository selector and action buttons
5. **Phase 5: Tabs** - Create three tab components
6. **Phase 6: Dialogs** - Build dry run result and error dialogs
7. **Phase 7: Main Page** - Assemble main page component
8. **Phase 8: Navigation** - Update sidebar
9. **Phase 9: Templates App** - Add standalone templates page
10. **Phase 10: Testing** - Manual testing and bug fixes

---

## Notes & Considerations

1. **Backend Dependency**: The app will call placeholder endpoints. Mock responses should be handled gracefully with proper error messages.

2. **Code Reuse**: Maximize reuse of Netmiko components to maintain consistency and reduce code duplication.

3. **State Management**: Follow React best practices with proper memoization to prevent re-render loops.

4. **Type Safety**: Ensure all components are fully typed with TypeScript.

5. **Accessibility**: Use proper ARIA labels and keyboard navigation support.

6. **Error Handling**: All API calls should have try-catch blocks with user-friendly error messages.

7. **Loading States**: Show loading indicators during async operations.

8. **Success Feedback**: Use toast notifications for successful operations.

---

## Future Enhancements (Post-Backend Implementation)

1. Real-time deployment status updates via WebSocket
2. Deployment history view
3. Config diff view before deployment
4. Rollback functionality
5. Scheduled deployments
6. Approval workflow for production deployments
7. Deployment logs viewer
8. Integration with CI/CD pipelines
