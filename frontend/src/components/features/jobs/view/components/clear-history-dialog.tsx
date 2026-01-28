'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ClearHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  hasActiveFilters: boolean
  filterDescription: string
}

export function ClearHistoryDialog({
  open,
  onOpenChange,
  onConfirm,
  hasActiveFilters,
  filterDescription,
}: ClearHistoryDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear Job History</AlertDialogTitle>
          <AlertDialogDescription>
            {hasActiveFilters ? (
              <>
                Are you sure you want to clear job history matching: <strong>{filterDescription}</strong>?
                <br /><br />
                This action cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to clear <strong>all</strong> job history?
                <br /><br />
                This action cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Clear History
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
