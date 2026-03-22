'use client'

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface ErrorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: string
}

export function ErrorModal({ open, onOpenChange, message }: ErrorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Device Creation Failed
          </DialogTitle>
          <DialogDescription className="sr-only">
            Error details for device creation failure
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 whitespace-pre-wrap">{message}</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)} variant="default">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
