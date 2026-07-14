'use client'

import { useEffect } from 'react'
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusIcon } from '@/components/shared/status-icon'
import { useCheckDevices } from '../hooks/use-check-devices'

interface CheckDevicesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceNames: string[]
}

export function CheckDevicesDialog({
  open,
  onOpenChange,
  deviceNames,
}: CheckDevicesDialogProps) {
  const { isChecking, progress, results, runCheck } = useCheckDevices()

  useEffect(() => {
    if (open) runCheck(deviceNames)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const foundCount = results.filter(r => r.found).length
  const notFoundCount = results.filter(r => !r.found).length
  const progressPercent =
    progress.total > 0 ? (progress.checked / progress.total) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Check Devices
          </DialogTitle>
        </DialogHeader>

        {/* Checking state */}
        {isChecking && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Progress value={progressPercent} className="h-2 w-full" />
            <span className="text-sm text-muted-foreground">
              Checking {progress.checked} / {progress.total} device(s)…
            </span>
          </div>
        )}

        {/* Empty selection */}
        {!isChecking && deviceNames.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No devices selected to check.
          </div>
        )}

        {/* Results */}
        {!isChecking && results.length > 0 && (
          <>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-success-foreground">
                <CheckCircle2 className="h-4 w-4" />
                {foundCount} found
              </span>
              {notFoundCount > 0 && (
                <span className="flex items-center gap-1.5 text-error-foreground">
                  <XCircle className="h-4 w-4" />
                  {notFoundCount} not found
                </span>
              )}
            </div>

            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-5" />
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Device name
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Nautobot
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {results.map(entry => (
                    <tr
                      key={entry.deviceName}
                      className={entry.found ? '' : 'bg-error/40'}
                    >
                      <td className="px-3 py-2 text-center">
                        <StatusIcon
                          variant={entry.found ? 'success' : 'error'}
                          className="h-3.5 w-3.5 inline"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {entry.deviceName}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {entry.found ? (
                          <span className="text-success-foreground">found</span>
                        ) : (
                          <span className="text-destructive italic">not found</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <DialogFooter className="pt-4 border-t mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
