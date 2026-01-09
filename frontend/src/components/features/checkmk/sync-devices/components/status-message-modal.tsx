import { AlertCircle, CheckCircle, Info } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { StatusMessage } from '../types/sync-devices.types'

interface StatusMessageModalProps {
  statusMessage: StatusMessage | null
  isOpen: boolean
  onClose: () => void
}

export function StatusMessageModal({ statusMessage, isOpen, onClose }: StatusMessageModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {statusMessage?.type === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
            {statusMessage?.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {statusMessage?.type === 'warning' && <AlertCircle className="h-5 w-5 text-yellow-500" />}
            {statusMessage?.type === 'info' && <Info className="h-5 w-5 text-blue-500" />}
            <span>
              {statusMessage?.type === 'error' ? 'Error' :
               statusMessage?.type === 'success' ? 'Success' :
               statusMessage?.type === 'warning' ? 'Warning' :
               'Information'}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{statusMessage?.message}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
