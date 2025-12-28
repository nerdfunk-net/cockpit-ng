import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { XCircle } from 'lucide-react'
import type { ErrorDetails } from '../types'

interface ErrorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  errorDetails: ErrorDetails | null
}

export function ErrorDialog({ open, onOpenChange, errorDetails }: ErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            {errorDetails?.title || 'Error'}
          </DialogTitle>
          <DialogDescription>
            {errorDetails?.message}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {errorDetails?.details && errorDetails.details.length > 0 && (
            <div className="space-y-2 p-4 bg-red-50 border border-red-200 rounded-md">
              <Label className="text-sm font-semibold text-red-900">Details:</Label>
              <ul className="space-y-1 text-sm text-red-800">
                {errorDetails.details.map((detail) => (
                  <li key={detail} className="flex items-start gap-2">
                    <span className="text-red-600 mt-0.5">•</span>
                    <span className="flex-1 font-mono">{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-900">
              <strong>Tip:</strong> Make sure all variables used in the template are either:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-blue-800 ml-4">
              <li>• Provided in the &quot;Variables&quot; section above</li>
              <li>• Available from Nautobot context (enable &quot;Use Nautobot Context&quot;)</li>
              <li>• Part of the standard variables (user_variables, nautobot)</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                console.log('Full error details:', errorDetails)
              }}
            >
              View in Console
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
