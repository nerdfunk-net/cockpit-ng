'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HelpCircle } from 'lucide-react'

interface ConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onAbort: () => void
}

export function ConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  onAbort,
}: ConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-amber-500" />
            No Tags or Custom Fields Added
          </DialogTitle>
          <DialogDescription>
            You haven&apos;t added any tags or custom fields to this device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tags and custom fields help you organize and categorize your devices in Nautobot.
            While they are optional, adding them now can make it easier to find and manage this device later.
          </p>

          <p className="text-sm font-medium text-foreground">
            Do you want to proceed with onboarding without tags or custom fields?
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onAbort}>
              Abort Onboarding
            </Button>
            <Button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700">
              Start Onboarding
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
