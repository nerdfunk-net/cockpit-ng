import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import type { ValidationError } from '../types'

interface YamlValidationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  error: ValidationError | null
  filename?: string
}

export function YamlValidationDialog({
  open,
  onOpenChange,
  error,
  filename = 'YAML file',
}: YamlValidationDialogProps) {
  if (!error) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>YAML Validation Error</span>
          </DialogTitle>
          <DialogDescription>
            The {filename} contains syntax errors that need to be fixed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-800 mb-2">Error Details:</h4>
            <div className="space-y-2 text-sm">
              {error.line && error.column && (
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-red-700">Location:</span>
                  <span className="text-red-900">
                    Line {error.line}, Column {error.column}
                  </span>
                </div>
              )}
              {error.error && (
                <div className="space-y-1">
                  <span className="font-medium text-red-700">Error Message:</span>
                  <pre className="bg-white border border-red-300 rounded p-3 text-xs overflow-x-auto text-red-900 whitespace-pre-wrap">
                    {error.error}
                  </pre>
                </div>
              )}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Common YAML Issues:</h4>
            <ul className="text-sm text-blue-900 space-y-1 list-disc list-inside">
              <li>Check for proper indentation (use spaces, not tabs)</li>
              <li>Ensure colons are followed by a space</li>
              <li>Verify quotes are properly closed</li>
              <li>Check for special characters that need escaping</li>
            </ul>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
