import { RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Device } from '../types/sync-devices.types'

interface AddDeviceModalProps {
  device: Device | null
  isOpen: boolean
  isAdding: boolean
  onConfirm: (device: Device) => void
  onCancel: () => void
}

export function AddDeviceModal({ device, isOpen, isAdding, onConfirm, onCancel }: AddDeviceModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Device Not Found in CheckMK</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            The device <strong>{device?.name}</strong> was not found in CheckMK.
            Would you like to add it to CheckMK?
          </p>
          <div className="flex items-center justify-end space-x-2">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isAdding}
            >
              No
            </Button>
            <Button
              onClick={() => device && onConfirm(device)}
              disabled={isAdding}
              className="bg-green-600 hover:bg-green-700"
            >
              {isAdding ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Yes, Add Device'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
