/**
 * Manage Snapshots Tab
 * View, compare, and manage network snapshots
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { GitCompare, Eye, Edit, Trash2, RefreshCw } from 'lucide-react'
import { CompareSnapshotsDialog } from '../dialogs/compare-snapshots-dialog'
import { useSnapshots } from '../hooks/use-snapshots'

export function ManageSnapshotsTab() {
  const { snapshots, loading, loadSnapshots } = useSnapshots()
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<number[]>([])
  const [showCompareDialog, setShowCompareDialog] = useState(false)

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  const handleSelectSnapshot = useCallback((snapshotId: number, checked: boolean) => {
    setSelectedSnapshotIds(prev => {
      if (checked) {
        // Only allow 2 snapshots to be selected at once
        if (prev.length >= 2) {
          return [prev[1]!, snapshotId] // Replace oldest selection
        }
        return [...prev, snapshotId]
      } else {
        return prev.filter(id => id !== snapshotId)
      }
    })
  }, [])

  const handleCompare = () => {
    if (selectedSnapshotIds.length === 2) {
      setShowCompareDialog(true)
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'completed') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          Completed
        </Badge>
      )
    } else if (status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>
    } else if (status === 'running') {
      return <Badge>Running</Badge>
    } else {
      return <Badge variant="secondary">Pending</Badge>
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Snapshots List */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Snapshots</span>
            {snapshots.length > 0 && (
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                {snapshots.length}
              </Badge>
            )}
          </div>
          <Button
            onClick={() => loadSnapshots()}
            variant="ghost"
            size="sm"
            disabled={loading}
            className="h-7 text-white hover:bg-white/20 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {loading && snapshots.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading snapshots...
            </div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No snapshots found. Execute a snapshot to get started.
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Devices</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Success/Failed</TableHead>
                      <TableHead>Executed By</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshots.map(snapshot => (
                      <TableRow
                        key={snapshot.id}
                        className={selectedSnapshotIds.includes(snapshot.id) ? 'bg-blue-50' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedSnapshotIds.includes(snapshot.id)}
                            onCheckedChange={(checked) => handleSelectSnapshot(snapshot.id, checked as boolean)}
                            disabled={!selectedSnapshotIds.includes(snapshot.id) && selectedSnapshotIds.length >= 2}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{snapshot.name}</TableCell>
                        <TableCell>{snapshot.template_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{snapshot.device_count}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(snapshot.status)}</TableCell>
                        <TableCell>
                          <span className="text-green-600 font-medium">{snapshot.success_count}</span>
                          {' / '}
                          <span className="text-red-600 font-medium">{snapshot.failed_count}</span>
                        </TableCell>
                        <TableCell>{snapshot.executed_by}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(snapshot.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              title="View snapshot"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              title="Edit snapshot"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete snapshot"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Compare Button */}
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleCompare}
                  disabled={selectedSnapshotIds.length !== 2}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <GitCompare className="mr-2 h-4 w-4" />
                  Compare Selected ({selectedSnapshotIds.length}/2)
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CompareSnapshotsDialog
        open={showCompareDialog}
        onOpenChange={setShowCompareDialog}
        snapshotIds={selectedSnapshotIds}
        onClose={() => setShowCompareDialog(false)}
      />
    </div>
  )
}
