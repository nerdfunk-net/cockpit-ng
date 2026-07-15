import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import type { SnmpEntryError } from '../types'

interface SnmpSemanticValidationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  errors: SnmpEntryError[]
  onSaveAnyway: () => void
}

export function SnmpSemanticValidationDialog({
  open,
  onOpenChange,
  errors,
  onSaveAnyway,
}: SnmpSemanticValidationDialogProps) {
  if (errors.length === 0) return null

  function handleSaveAnyway() {
    onSaveAnyway()
    onOpenChange(false)
  }

  function handleFixFirst() {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-warning-foreground">
            <AlertTriangle className="h-5 w-5" />
            <span>SNMP Configuration Issues</span>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 mt-2 text-left">
              <p className="text-sm text-muted-foreground">
                The YAML syntax is valid, but the following SNMP entries have configuration
                problems:
              </p>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {errors.map(({ entryKey, errors: entryErrors }) => (
                  <div
                    key={entryKey}
                    className="rounded-md border border-warning-border bg-warning p-3"
                  >
                    <p className="text-sm font-semibold text-warning-foreground mb-1">{entryKey}</p>
                    <ul className="text-sm text-warning-foreground list-disc list-inside space-y-0.5">
                      {entryErrors.map(err => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Would you like to fix the configuration or save it as-is?
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleFixFirst}>
            Fix First
          </Button>
          <Button variant="destructive" onClick={handleSaveAnyway}>
            Save Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
