import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle } from 'lucide-react'
import type { ValidationError } from '../types'

interface SnmpValidationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  error: ValidationError | null
}

export function SnmpValidationDialog({
  open,
  onOpenChange,
  error
}: SnmpValidationDialogProps) {
  if (!error) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>YAML Validation Error</span>
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-2 mt-4">
              <p className="font-semibold">{error.message}</p>
              {error.error && (
                <p className="text-sm text-gray-600">{error.error}</p>
              )}
              {error.line && (
                <p className="text-sm text-gray-600">
                  Line {error.line}
                  {error.column && `, Column ${error.column}`}
                </p>
              )}
              <p className="text-sm text-gray-500 mt-4">
                Common YAML syntax issues:
              </p>
              <ul className="text-sm text-gray-500 list-disc list-inside">
                <li>Incorrect indentation (use spaces, not tabs)</li>
                <li>Missing quotes around special characters</li>
                <li>Invalid key-value pair format</li>
                <li>Unclosed brackets or braces</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
