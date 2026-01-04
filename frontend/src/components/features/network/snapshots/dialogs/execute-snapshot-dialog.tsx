/**
 * Execute Snapshot Dialog
 * Dialog for executing snapshots on selected devices
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSnapshots } from '../hooks/use-snapshots'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import type { DeviceInfo } from '@/components/shared/device-selector'
import type { GitRepository } from '../types/snapshot-types'

interface ExecuteSnapshotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateId: number | null
  selectedDevices: DeviceInfo[]
  onExecuteSuccess: () => void
}

const EMPTY_REPOS: GitRepository[] = []

export function ExecuteSnapshotDialog({
  open,
  onOpenChange,
  templateId,
  selectedDevices,
  onExecuteSuccess,
}: ExecuteSnapshotDialogProps) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
  const defaultName = `snapshot-${timestamp}`

  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState('')
  const [gitRepoId, setGitRepoId] = useState<string>('')
  const [snapshotPath, setSnapshotPath] = useState('snapshots/{device}/{timestamp}.json')
  const [gitRepos, setGitRepos] = useState<GitRepository[]>(EMPTY_REPOS)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [executing, setExecuting] = useState(false)

  const { executeSnapshot } = useSnapshots()
  const { apiCall } = useApi()
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadGitRepositories()
    }
  }, [open])

  const loadGitRepositories = async () => {
    setLoadingRepos(true)
    try {
      const response = await apiCall<{ repositories: GitRepository[] }>('git-repositories')
      setGitRepos(response.repositories || EMPTY_REPOS)
    } catch (error) {
      console.error('Failed to load git repositories:', error)
      toast({
        title: 'Error',
        description: 'Failed to load Git repositories',
        variant: 'destructive',
      })
    } finally {
      setLoadingRepos(false)
    }
  }

  const handleExecute = async () => {
    if (!name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a snapshot name',
        variant: 'destructive',
      })
      return
    }

    if (!gitRepoId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a Git repository',
        variant: 'destructive',
      })
      return
    }

    if (!templateId) {
      toast({
        title: 'Validation Error',
        description: 'No template selected',
        variant: 'destructive',
      })
      return
    }

    setExecuting(true)
    try {
      await executeSnapshot({
        template_id: templateId,
        name: name.trim(),
        description: description.trim() || undefined,
        git_repository_id: parseInt(gitRepoId),
        snapshot_path: snapshotPath,
        devices: selectedDevices,
      })

      onExecuteSuccess()
    } catch (error) {
      toast({
        title: 'Execution Failed',
        description: error instanceof Error ? error.message : 'Failed to execute snapshot',
        variant: 'destructive',
      })
    } finally {
      setExecuting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Execute Snapshot</DialogTitle>
          <DialogDescription>
            Execute snapshot on {selectedDevices.length} selected device{selectedDevices.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="snapshot-name">Snapshot Name *</Label>
            <Input
              id="snapshot-name"
              placeholder="e.g., snapshot-2024-01-01"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Supports placeholders: {'{device}'}, {'{timestamp}'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="snapshot-description">Description</Label>
            <Textarea
              id="snapshot-description"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="git-repo">Git Repository *</Label>
            <Select value={gitRepoId} onValueChange={setGitRepoId} disabled={loadingRepos}>
              <SelectTrigger id="git-repo">
                <SelectValue placeholder="Select a Git repository..." />
              </SelectTrigger>
              <SelectContent>
                {gitRepos.map(repo => (
                  <SelectItem key={repo.id} value={repo.id.toString()}>
                    {repo.name} ({repo.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="snapshot-path">Snapshot Path Template *</Label>
            <Input
              id="snapshot-path"
              value={snapshotPath}
              onChange={(e) => setSnapshotPath(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Available placeholders: {'{device}'}, {'{timestamp}'}, {'{custom_field.net}'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={executing}>
            Cancel
          </Button>
          <Button onClick={handleExecute} disabled={executing}>
            {executing ? 'Executing...' : 'Execute Snapshot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
