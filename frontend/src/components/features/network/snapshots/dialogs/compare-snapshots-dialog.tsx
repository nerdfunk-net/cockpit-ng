/**
 * Compare Snapshots Dialog
 * Dialog for comparing two snapshots
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useSnapshots } from '../hooks/use-snapshots'
import { useToast } from '@/hooks/use-toast'
import type { SnapshotCompareResponse } from '../types/snapshot-types'

interface CompareSnapshotsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshotIds: number[]
  onClose: () => void
}

export function CompareSnapshotsDialog({
  open,
  onOpenChange,
  snapshotIds,
  onClose,
}: CompareSnapshotsDialogProps) {
  const [comparison, setComparison] = useState<SnapshotCompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const { compareSnapshots } = useSnapshots()
  const { toast } = useToast()

  const loadComparison = useCallback(async () => {
    if (snapshotIds.length !== 2) return
    
    setLoading(true)
    try {
      const result = await compareSnapshots({
        snapshot_id_1: snapshotIds[0]!,
        snapshot_id_2: snapshotIds[1]!,
      })
      setComparison(result)
    } catch (error) {
      toast({
        title: 'Comparison Failed',
        description: error instanceof Error ? error.message : 'Failed to compare snapshots',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [snapshotIds, compareSnapshots, toast])

  useEffect(() => {
    if (open && snapshotIds.length === 2) {
      loadComparison()
    }
  }, [open, snapshotIds, loadComparison])

  const getDeviceStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      same: 'outline',
      different: 'default',
      missing_in_snapshot1: 'destructive',
      missing_in_snapshot2: 'destructive',
    }
    const labels: Record<string, string> = {
      same: 'Identical',
      different: 'Different',
      missing_in_snapshot1: 'Missing in Snapshot 1',
      missing_in_snapshot2: 'Missing in Snapshot 2',
    }
    return (
      <Badge variant={variants[status] || 'default'}>
        {labels[status] || status}
      </Badge>
    )
  }

  const getCommandStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      unchanged: 'outline',
      modified: 'default',
      added: 'secondary',
      removed: 'destructive',
    }
    return (
      <Badge variant={variants[status] || 'default'} className="text-xs">
        {status}
      </Badge>
    )
  }

  const handleClose = () => {
    onClose()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Snapshots</DialogTitle>
          <DialogDescription>
            Detailed comparison of two snapshots
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Loading comparison...</div>
        ) : !comparison ? (
          <div className="text-center py-8 text-muted-foreground">
            No comparison data available
          </div>
        ) : (
          <div className="space-y-6">
            {/* Snapshot Info */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Snapshot 1</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div><strong>Name:</strong> {comparison.snapshot1.name}</div>
                  <div><strong>Template:</strong> {comparison.snapshot1.template_name}</div>
                  <div><strong>Devices:</strong> {comparison.snapshot1.device_count}</div>
                  <div><strong>Date:</strong> {new Date(comparison.snapshot1.created_at).toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Snapshot 2</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div><strong>Name:</strong> {comparison.snapshot2.name}</div>
                  <div><strong>Template:</strong> {comparison.snapshot2.template_name}</div>
                  <div><strong>Devices:</strong> {comparison.snapshot2.device_count}</div>
                  <div><strong>Date:</strong> {new Date(comparison.snapshot2.created_at).toLocaleString()}</div>
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total</div>
                    <div className="text-2xl font-bold">{comparison.summary.total_devices}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Identical</div>
                    <div className="text-2xl font-bold text-green-600">{comparison.summary.same_count}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Different</div>
                    <div className="text-2xl font-bold text-orange-600">{comparison.summary.different_count}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Missing #1</div>
                    <div className="text-2xl font-bold text-red-600">{comparison.summary.missing_in_snapshot1}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Missing #2</div>
                    <div className="text-2xl font-bold text-red-600">{comparison.summary.missing_in_snapshot2}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Device Comparisons */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Device Comparisons</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {comparison.devices.map((device) => (
                    <AccordionItem key={device.device_name} value={`device-${device.device_name}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <span className="font-medium">{device.device_name}</span>
                          {getDeviceStatusBadge(device.status)}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {device.commands.length === 0 ? (
                          <div className="text-sm text-muted-foreground px-4">
                            No command data available
                          </div>
                        ) : (
                          <div className="space-y-2 px-4">
                            {device.commands.map((cmd) => (
                              <div key={cmd.command} className="border-l-2 border-muted pl-4 py-2">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-mono">{cmd.command}</span>
                                  {getCommandStatusBadge(cmd.status)}
                                </div>
                                {cmd.status === 'modified' && cmd.diff && (
                                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                    {JSON.stringify(cmd.diff, null, 2)}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
