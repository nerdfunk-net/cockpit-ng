/**
 * Execute Snapshot Dialog
 * Dialog for executing snapshots on selected devices
 */

'use client'

import { useState } from 'react'
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
import { useSnapshots } from '../hooks/use-snapshots'
import { useToast } from '@/hooks/use-toast'
import type { DeviceInfo } from '@/components/shared/device-selector'
import type { SnapshotCommand } from '../types/snapshot-types'

interface ExecuteSnapshotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateId: number | null
  templateName: string | null
  selectedDevices: DeviceInfo[]
  commands: Omit<SnapshotCommand, 'id' | 'template_id' | 'created_at'>[]
  snapshotPath: string
  snapshotGitRepoId: number | null
  selectedCredentialId: string
  username: string
  password: string
  onExecuteSuccess: () => void
}

export function ExecuteSnapshotDialog({
  open,
  onOpenChange,
  templateId,
  templateName,
  selectedDevices,
  commands,
  snapshotPath,
  snapshotGitRepoId,
  selectedCredentialId,
  username,
  password,
  onExecuteSuccess,
}: ExecuteSnapshotDialogProps) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
  const defaultName = `snapshot-${timestamp}`

  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState('')
  const [executing, setExecuting] = useState(false)

  const { executeSnapshot } = useSnapshots()
  const { toast } = useToast()

  const handleExecute = async () => {
    if (!name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a snapshot name',
        variant: 'destructive',
      })
      return
    }

    if (!snapshotGitRepoId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a Git repository in the Execute Snapshot tab',
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

    setExecuting(true)
    try {
      // Prepare credential payload
      const credentialPayload = selectedCredentialId === 'manual'
        ? { username, password }
        : { credential_id: parseInt(selectedCredentialId) }

      await executeSnapshot({
        name: name.trim(),
        description: description.trim() || undefined,
        commands,
        git_repository_id: snapshotGitRepoId,
        snapshot_path: snapshotPath,
        devices: selectedDevices,
        template_id: templateId ?? undefined,
        template_name: templateName ?? undefined,
        ...credentialPayload,
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
            Execute snapshot on {selectedDevices.length} selected device{selectedDevices.length !== 1 ? 's' : ''} with {commands.length} command{commands.length !== 1 ? 's' : ''}
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
              This will be the snapshot identifier in the database
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="snapshot-description">Description</Label>
            <Textarea
              id="snapshot-description"
              placeholder="Optional description of this snapshot"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md space-y-1">
            <p className="text-sm font-medium text-blue-900">Configuration Summary</p>
            <p className="text-xs text-blue-700">Git Repository: {snapshotGitRepoId ? `ID ${snapshotGitRepoId}` : 'None'}</p>
            <p className="text-xs text-blue-700">Path: {snapshotPath}</p>
            <p className="text-xs text-blue-700">Commands: {commands.length}</p>
            <p className="text-xs text-blue-700">Credentials: {selectedCredentialId === 'manual' ? 'Manual' : `Stored (ID ${selectedCredentialId})`}</p>
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
