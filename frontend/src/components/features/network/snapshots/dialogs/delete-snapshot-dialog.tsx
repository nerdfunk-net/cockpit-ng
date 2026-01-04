/**
 * Delete Snapshot Dialog
 * Confirm snapshot deletion with options to remove from DB only or DB & Files
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface DeleteSnapshotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshotId: number
  snapshotName: string
  onDeleteDbOnly: (snapshotId: number) => Promise<void>
  onDeleteDbAndFiles: (snapshotId: number) => Promise<void>
}

export function DeleteSnapshotDialog({
  open,
  onOpenChange,
  snapshotId,
  snapshotName,
  onDeleteDbOnly,
  onDeleteDbAndFiles,
}: DeleteSnapshotDialogProps) {
  const [deleting, setDeleting] = useState(false)

  const handleDeleteDbOnly = async () => {
    setDeleting(true)
    try {
      await onDeleteDbOnly(snapshotId)
      onOpenChange(false)
    } catch (error) {
      console.error('Delete failed:', error)
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteDbAndFiles = async () => {
    setDeleting(true)
    try {
      await onDeleteDbAndFiles(snapshotId)
      onOpenChange(false)
    } catch (error) {
      console.error('Delete failed:', error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Delete Snapshot
          </DialogTitle>
          <DialogDescription>
            Choose how to delete the snapshot &quot;{snapshotName}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              You can remove the snapshot from the database only, or remove both the database entry and all associated files from the Git repository.
            </AlertDescription>
          </Alert>

          <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
            <div>
              <h4 className="font-medium text-sm mb-1">Remove from DB</h4>
              <p className="text-sm text-muted-foreground">
                Removes the snapshot record from the database. Files in Git remain untouched.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-1">Remove DB & Files</h4>
              <p className="text-sm text-muted-foreground">
                Removes the snapshot record from the database AND deletes all snapshot files from the Git repository.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleDeleteDbOnly}
            disabled={deleting}
            className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 hover:border-orange-400"
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Remove from DB'
            )}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteDbAndFiles}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Remove DB & Files'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
