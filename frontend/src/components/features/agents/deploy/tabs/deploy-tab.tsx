import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Play, GitCommit, Zap } from 'lucide-react'
import { AgentSelector } from '../ui/agent-selector'
import type { Agent } from '../types'

interface DeployTabProps {
  agents: Agent[]
  selectedAgentId: string | null
  onAgentChange: (agentId: string) => void
  isAgentsLoading: boolean
  deployPath: string
  onDeployPathChange: (path: string) => void
  canExecute: boolean
  isDryRunning: boolean
  isDeploying: boolean
  isActivating: boolean
  onDryRun: () => void
  onDeployToGit: () => void
  onActivate: () => void
  selectedInventoryId: number | null
}

export function DeployTab({
  agents,
  selectedAgentId,
  onAgentChange,
  isAgentsLoading,
  deployPath,
  onDeployPathChange,
  canExecute,
  isDryRunning,
  isDeploying,
  isActivating,
  onDryRun,
  onDeployToGit,
  onActivate,
  selectedInventoryId
}: DeployTabProps) {
  return (
    <div className="space-y-6">
      {/* Inventory Warning */}
      {!selectedInventoryId && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertDescription className="text-amber-800">
            <strong>No inventory selected.</strong> Agent deployment requires a saved inventory.
            Please load a saved inventory from the Devices tab before deploying.
          </AlertDescription>
        </Alert>
      )}
      {/* Agent Selection */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Agent Repository</span>
          </div>
          <div className="text-xs text-blue-100">
            Select the agent and path for config deployment
          </div>
        </div>
        <div className="p-6 space-y-4">
          <AgentSelector
            agents={agents}
            selectedAgentId={selectedAgentId}
            onChange={onAgentChange}
            loading={isAgentsLoading}
          />
          
          <div className="space-y-2">
            <Label htmlFor="deploy-path">
              Path
            </Label>
            <Input
              id="deploy-path"
              type="text"
              placeholder="e.g., /etc/telegraf/telegraf.d"
              value={deployPath}
              onChange={(e) => onDeployPathChange(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Absolute path on the target device where the rendered configuration will be deployed
            </p>
          </div>
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
                Please select devices, a template, and an agent before proceeding
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
