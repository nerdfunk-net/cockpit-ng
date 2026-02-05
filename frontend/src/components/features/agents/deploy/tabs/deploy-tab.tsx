import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Play, GitCommit, Zap } from 'lucide-react'
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
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Git Repository</span>
          </div>
          <div className="text-xs text-blue-100">
            Select the target repository for config deployment
          </div>
        </div>
        <div className="p-6">
          <RepositorySelector
            repositories={repositories}
            selectedRepoId={selectedRepoId}
            onChange={onRepositoryChange}
            loading={isRepositoriesLoading}
          />
        </div>
      </div>

      {/* Deploy Actions */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Deployment Actions</span>
          </div>
          <div className="text-xs text-blue-100">
            Render templates, deploy to git, or activate changes
          </div>
        </div>
        <div className="p-6 space-y-4">
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
        </div>
      </div>
    </div>
  )
}
