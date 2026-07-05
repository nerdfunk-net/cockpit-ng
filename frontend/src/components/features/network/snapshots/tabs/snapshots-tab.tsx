/**
 * Execute Snapshot Tab
 * Configure and execute network snapshots
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Play, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useGitRepositories } from '@/components/features/shared/git/hooks'
import { useSnapshots } from '../hooks/use-snapshots'
import { CredentialSelector } from '../../automation/netmiko/ui/credential-selector'
import type { SnapshotCommand } from '../types/snapshot-types'
import type { DeviceInfo } from '@/components/shared/device-selector'
import type { StoredCredential } from '../../automation/netmiko/types'

interface SnapshotsTabProps {
  selectedTemplateId: number | null
  selectedTemplateName: string | null
  commands: Omit<SnapshotCommand, 'id' | 'template_id' | 'created_at'>[]
  selectedDevices: DeviceInfo[]
  snapshotPath: string
  snapshotGitRepoId: number | null
  onSnapshotPathChange: (path: string) => void
  onSnapshotGitRepoIdChange: (repoId: number | null) => void
  // Credential props
  storedCredentials: StoredCredential[]
  selectedCredentialId: string
  username: string
  password: string
  onCredentialChange: (credId: string) => void
  onUsernameChange: (username: string) => void
  onPasswordChange: (password: string) => void
}

export function SnapshotsTab({
  selectedTemplateId,
  selectedTemplateName,
  commands,
  selectedDevices,
  snapshotPath,
  snapshotGitRepoId,
  onSnapshotPathChange,
  onSnapshotGitRepoIdChange,
  storedCredentials,
  selectedCredentialId,
  username,
  password,
  onCredentialChange,
  onUsernameChange,
  onPasswordChange,
}: SnapshotsTabProps) {
  const { repositories, loading: reposLoading } = useGitRepositories()
  const { executeSnapshot } = useSnapshots()
  const { toast } = useToast()

  const [executing, setExecuting] = useState(false)

  const handleExecuteSnapshot = async () => {
    if (!snapshotGitRepoId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a Git repository',
        variant: 'destructive',
      })
      return
    }

    if (commands.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'No commands to execute',
        variant: 'destructive',
      })
      return
    }

    if (!snapshotPath.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a snapshot path',
        variant: 'destructive',
      })
      return
    }

    setExecuting(true)
    try {
      // Prepare credential payload
      const credentialPayload =
        selectedCredentialId === 'manual'
          ? { username, password }
          : { credential_id: parseInt(selectedCredentialId) }

      // Generate a snapshot name from timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
      const snapshotName = `snapshot-${timestamp}`

      await executeSnapshot({
        name: snapshotName,
        description: undefined,
        commands,
        git_repository_id: snapshotGitRepoId,
        snapshot_path: snapshotPath,
        devices: selectedDevices,
        template_id: selectedTemplateId || undefined,
        template_name: selectedTemplateName || undefined,
        ...credentialPayload,
      })

      toast({
        title: 'Snapshot Executed',
        description: 'Snapshot has been executed successfully',
      })
    } catch (error) {
      toast({
        title: 'Execution Failed',
        description:
          error instanceof Error ? error.message : 'Failed to execute snapshot',
        variant: 'destructive',
      })
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Execute Snapshot */}
      <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
        <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Execute Snapshot</span>
          </div>
          <div className="text-xs text-panel-header-muted">
            Configure and execute a new snapshot for selected devices
          </div>
        </div>
        <div className="p-6 panel-content space-y-6">
          {/* Path Configuration */}
          <div className="rounded-lg border border-warning-border bg-warning/30 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-warning-foreground">
                Snapshot Path
              </span>
            </div>

            <div className="bg-warning/50 border border-warning-border rounded-md px-3 py-2 space-y-1">
              <p className="text-xs text-warning-foreground leading-relaxed">
                <span className="font-semibold">Available variables:</span>
              </p>
              <p className="text-xs text-warning-foreground leading-relaxed">
                Template: {'{template_name}'}
              </p>
              <p className="text-xs text-warning-foreground leading-relaxed">
                Device: {'{device_name}'}, {'{hostname}'}, {'{serial}'}, {'{asset_tag}'}
              </p>
              <p className="text-xs text-warning-foreground leading-relaxed">
                Location: {'{location.name}'}, {'{location.parent.name}'},{' '}
                {'{location.parent.parent.name}'}
              </p>
              <p className="text-xs text-warning-foreground leading-relaxed">
                Platform: {'{platform.name}'}, {'{platform.manufacturer.name}'},{' '}
                {'{device_type.model}'}
              </p>
              <p className="text-xs text-warning-foreground leading-relaxed">
                Other: {'{role.name}'}, {'{status.name}'}, {'{tenant.name}'},{' '}
                {'{rack.name}'}, {'{custom_field_data.FIELD_NAME}'}
              </p>
            </div>

            <div className="space-y-2">
              <Input
                id="snapshot-path"
                value={snapshotPath}
                onChange={e => onSnapshotPathChange(e.target.value)}
                placeholder="snapshots/{device_name}-{template_name}"
                className="h-9 bg-card border-warning-border font-mono text-sm focus:ring-warning-border focus:border-warning-border"
              />
            </div>
          </div>

          {/* Credentials Selection */}
          <div className="rounded-lg border border-info-border bg-info/30 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-info-foreground">
                SSH Credentials
              </span>
            </div>

            <CredentialSelector
              storedCredentials={storedCredentials}
              selectedCredentialId={selectedCredentialId}
              username={username}
              password={password}
              onCredentialChange={onCredentialChange}
              onUsernameChange={onUsernameChange}
              onPasswordChange={onPasswordChange}
            />
          </div>

          {/* Git Repository Selection */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Git Repository
              </span>
            </div>

            <div className="space-y-2">
              <Select
                value={snapshotGitRepoId?.toString() || 'none'}
                onValueChange={value =>
                  onSnapshotGitRepoIdChange(value === 'none' ? null : parseInt(value))
                }
                disabled={reposLoading}
              >
                <SelectTrigger id="git-repo" className="h-9 bg-card border-border">
                  <SelectValue placeholder="Select a git repository..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No git repository</SelectItem>
                  {repositories.map(repo => (
                    <SelectItem key={repo.id} value={repo.id.toString()}>
                      {repo.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select a git repository to store snapshot results
              </p>
            </div>
          </div>

          {/* Execute Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleExecuteSnapshot}
              disabled={
                executing ||
                !snapshotPath.trim() ||
                commands.length === 0 ||
                selectedDevices.length === 0 ||
                !snapshotGitRepoId ||
                (selectedCredentialId === 'manual' && (!username || !password))
              }
              >
              {executing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Execute Snapshot
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
