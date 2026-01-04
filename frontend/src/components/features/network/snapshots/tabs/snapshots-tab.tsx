/**
 * Snapshots Tab
 * Execute snapshots and compare results
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Play, GitCompare, RefreshCw } from 'lucide-react'
import { ExecuteSnapshotDialog } from '../dialogs/execute-snapshot-dialog'
import { CompareSnapshotsDialog } from '../dialogs/compare-snapshots-dialog'
import { useSnapshots } from '../hooks/use-snapshots'
import { useToast } from '@/hooks/use-toast'
import type { SnapshotCommand } from '../types/snapshot-types'
import type { DeviceInfo } from '@/components/shared/device-selector'

interface SnapshotsTabProps {
  selectedTemplateId: number | null
  commands: Omit<SnapshotCommand, 'id' | 'template_id' | 'created_at'>[]
  selectedDevices: DeviceInfo[]
}

export function SnapshotsTab({
  selectedTemplateId,
  commands,
  selectedDevices,
}: SnapshotsTabProps) {
  const { snapshots, loading, loadSnapshots } = useSnapshots()
  const [showExecuteDialog, setShowExecuteDialog] = useState(false)
  const [showCompareDialog, setShowCompareDialog] = useState(false)
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<number[]>([])
  const { toast } = useToast()

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  const handleExecuteSuccess = async () => {
    setShowExecuteDialog(false)
    await loadSnapshots()
    toast({
      title: 'Snapshot Started',
      description: 'Snapshot execution has been started',
    })
  }

  const handleCompare = (snapshotId: number) => {
    if (selectedSnapshotIds.includes(snapshotId)) {
      setSelectedSnapshotIds(selectedSnapshotIds.filter(id => id !== snapshotId))
    } else {
      if (selectedSnapshotIds.length >= 2) {
        // Replace oldest selection
        setSelectedSnapshotIds([selectedSnapshotIds[1]!, snapshotId])
      } else {
        setSelectedSnapshotIds([...selectedSnapshotIds, snapshotId])
      }
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      running: 'default',
      completed: 'outline',
      failed: 'destructive',
    }
    return (
      <Badge variant={variants[status] || 'default'}>
        {status}
      </Badge>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Snapshot Actions</span>
          </div>
          <div className="text-xs text-blue-100">
            Execute a new snapshot or compare existing snapshots
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 flex gap-4">
          <Button
            onClick={() => setShowExecuteDialog(true)}
            disabled={!selectedTemplateId || commands.length === 0 || selectedDevices.length === 0}
          >
            <Play className="mr-2 h-4 w-4" />
            Execute Snapshot
          </Button>
          <Button
            onClick={() => setShowCompareDialog(true)}
            disabled={selectedSnapshotIds.length !== 2}
            variant="outline"
          >
            <GitCompare className="mr-2 h-4 w-4" />
            Compare Selected ({selectedSnapshotIds.length}/2)
          </Button>
          <Button
            onClick={() => loadSnapshots()}
            variant="ghost"
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Snapshots List */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Recent Snapshots</span>
          </div>
          <div className="text-xs text-blue-100">
            Click on snapshots to select them for comparison
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {loading && snapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading snapshots...
            </div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No snapshots found. Execute a snapshot to get started.
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Success/Failed</TableHead>
                    <TableHead>Executed By</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map(snapshot => (
                    <TableRow
                      key={snapshot.id}
                      className={`cursor-pointer ${
                        selectedSnapshotIds.includes(snapshot.id)
                          ? 'bg-muted'
                          : ''
                      }`}
                      onClick={() => handleCompare(snapshot.id)}
                    >
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {selectedSnapshotIds.includes(snapshot.id) && (
                            <div className="w-4 h-4 rounded-full bg-primary" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{snapshot.name}</TableCell>
                      <TableCell>{snapshot.template_name || '-'}</TableCell>
                      <TableCell>{snapshot.device_count}</TableCell>
                      <TableCell>{getStatusBadge(snapshot.status)}</TableCell>
                      <TableCell>
                        <span className="text-green-600">{snapshot.success_count}</span>
                        {' / '}
                        <span className="text-red-600">{snapshot.failed_count}</span>
                      </TableCell>
                      <TableCell>{snapshot.executed_by}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(snapshot.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <ExecuteSnapshotDialog
        open={showExecuteDialog}
        onOpenChange={setShowExecuteDialog}
        templateId={selectedTemplateId}
        selectedDevices={selectedDevices}
        onExecuteSuccess={handleExecuteSuccess}
      />
      <CompareSnapshotsDialog
        open={showCompareDialog}
        onOpenChange={setShowCompareDialog}
        snapshotIds={selectedSnapshotIds}
        onClose={() => setSelectedSnapshotIds([])}
      />
    </div>
  )
}
