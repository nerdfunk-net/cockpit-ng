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
import { Play } from 'lucide-react'
import { ExecuteSnapshotDialog } from '../dialogs/execute-snapshot-dialog'
import { useToast } from '@/hooks/use-toast'
import { useGitRepositories } from '@/hooks/git'
import type { SnapshotCommand } from '../types/snapshot-types'
import type { DeviceInfo } from '@/components/shared/device-selector'

interface SnapshotsTabProps {
  selectedTemplateId: number | null
  commands: Omit<SnapshotCommand, 'id' | 'template_id' | 'created_at'>[]
  selectedDevices: DeviceInfo[]
  snapshotPath: string
  snapshotGitRepoId: number | null
  onSnapshotPathChange: (path: string) => void
  onSnapshotGitRepoIdChange: (repoId: number | null) => void
}

export function SnapshotsTab({
  selectedTemplateId,
  commands,
  selectedDevices,
  snapshotPath,
  snapshotGitRepoId,
  onSnapshotPathChange,
  onSnapshotGitRepoIdChange,
}: SnapshotsTabProps) {
  const { repositories, loading: reposLoading } = useGitRepositories()
  const [showExecuteDialog, setShowExecuteDialog] = useState(false)
  const { toast } = useToast()

  const handleExecuteSuccess = async () => {
    setShowExecuteDialog(false)
    toast({
      title: 'Snapshot Started',
      description: 'Snapshot execution has been started',
    })
  }

  return (
    <div className="space-y-6">
      {/* Execute Snapshot */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Execute Snapshot</span>
          </div>
          <div className="text-xs text-blue-100">
            Configure and execute a new snapshot for selected devices
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
          {/* Path Configuration */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-amber-900">Snapshot Path</span>
            </div>

            <div className="bg-amber-100/50 border border-amber-200 rounded-md px-3 py-2 space-y-1">
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">Available variables:</span>
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Template: {'{template_name}'}
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Device: {'{device_name}'}, {'{hostname}'}, {'{serial}'}, {'{asset_tag}'}
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Location: {'{location.name}'}, {'{location.parent.name}'}, {'{location.parent.parent.name}'}
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Platform: {'{platform.name}'}, {'{platform.manufacturer.name}'}, {'{device_type.model}'}
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Other: {'{role.name}'}, {'{status.name}'}, {'{tenant.name}'}, {'{rack.name}'}, {'{custom_field_data.FIELD_NAME}'}
              </p>
            </div>

            <div className="space-y-2">
              <Input
                id="snapshot-path"
                value={snapshotPath}
                onChange={(e) => onSnapshotPathChange(e.target.value)}
                placeholder="snapshots/{device_name}-{template_name}"
                className="h-9 bg-white border-amber-200 font-mono text-sm focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Git Repository Selection */}
          <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-teal-900">Git Repository</span>
            </div>

            <div className="space-y-2">
              <Select
                value={snapshotGitRepoId?.toString() || 'none'}
                onValueChange={(value) => onSnapshotGitRepoIdChange(value === 'none' ? null : parseInt(value))}
                disabled={reposLoading}
              >
                <SelectTrigger id="git-repo" className="h-9 bg-white border-teal-200">
                  <SelectValue placeholder="Select a git repository..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No git repository</SelectItem>
                  {repositories.map((repo) => (
                    <SelectItem key={repo.id} value={repo.id.toString()}>
                      {repo.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-teal-700">
                Select a git repository to store snapshot results
              </p>
            </div>
          </div>

          {/* Execute Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setShowExecuteDialog(true)}
              disabled={!selectedTemplateId || commands.length === 0 || selectedDevices.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Play className="mr-2 h-4 w-4" />
              Execute Snapshot
            </Button>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ExecuteSnapshotDialog
        open={showExecuteDialog}
        onOpenChange={setShowExecuteDialog}
        onExecuteSuccess={handleExecuteSuccess}
        templateId={selectedTemplateId}
        selectedDevices={selectedDevices}
      />
    </div>
  )
}
