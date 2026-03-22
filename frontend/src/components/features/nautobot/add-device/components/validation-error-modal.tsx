'use client'

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface ValidationErrorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  errors: string[]
}

export function ValidationErrorModal({ open, onOpenChange, errors }: ValidationErrorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Form Validation Failed
          </DialogTitle>
          <DialogDescription>
            Please correct the following errors before submitting the form:
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          <div className="space-y-2 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
            {errors.map((error) => (
              <div key={error} className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
