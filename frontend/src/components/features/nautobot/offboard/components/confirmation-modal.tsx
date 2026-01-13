import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmationModalProps {
  isOpen: boolean
  selectedCount: number
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationModal({ isOpen, selectedCount, onConfirm, onCancel }: ConfirmationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Device Offboarding</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>
            Are you sure you want to offboard <strong>{selectedCount}</strong> device{selectedCount !== 1 ? 's' : ''}?
          </p>
          <p className="text-sm text-gray-500 mt-2">
            This action will remove the selected devices and their associated data according to your settings.
          </p>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Remove
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
