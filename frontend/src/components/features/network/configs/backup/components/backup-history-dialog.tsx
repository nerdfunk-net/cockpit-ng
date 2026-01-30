'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Loader2 } from 'lucide-react'
import { useBackupHistory } from '../hooks/use-backup-devices'
import { useBackupMutations } from '../hooks/use-backup-mutations'
import type { Device } from '../types'

const EMPTY_HISTORY_ARRAY: never[] = []

interface BackupHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  device: Device | null
}

export function BackupHistoryDialog({
  open,
  onOpenChange,
  device
}: BackupHistoryDialogProps) {
  const { data: history = EMPTY_HISTORY_ARRAY, isLoading } = useBackupHistory(
    device?.id || '',
    { enabled: open && !!device }
  )
  const { downloadBackup, restoreBackup } = useBackupMutations()

  const handleDownload = (backupId: string) => {
    if (!device) return
    downloadBackup.mutate({ deviceId: device.id, backupId })
  }

  const handleRestore = (backupId: string) => {
    if (!device) return
    if (!confirm('Are you sure you want to restore this configuration?')) return
    restoreBackup.mutate({ deviceId: device.id, backupId })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Backup History - {device?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
              <p className="mt-2 text-sm text-muted-foreground">Loading history...</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Date</th>
                  <th className="text-left p-2 font-medium">Size</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="text-left p-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center p-8 text-muted-foreground">
                      No backup history found
                    </td>
                  </tr>
                ) : (
                  history.map((entry) => (
                    <tr key={`backup-history-${entry.id}`} className="border-b hover:bg-muted/50">
                      <td className="p-2">{entry.date}</td>
                      <td className="p-2">{entry.size}</td>
                      <td className="p-2">
                        <Badge
                          variant={
                            entry.status === 'success' ? 'default' :
                            entry.status === 'failed' ? 'destructive' :
                            'secondary'
                          }
                        >
                          {entry.status}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(entry.id)}
                            disabled={downloadBackup.isPending}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(entry.id)}
                            disabled={restoreBackup.isPending}
                          >
                            Restore
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
