import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { IpAddressMultipleAssignmentWarning } from '@/types/features/nautobot/offboard'

interface IpAssignmentWarningModalProps {
  isOpen: boolean
  warnings: IpAddressMultipleAssignmentWarning[]
  decisions: Record<string, boolean>
  onDecision: (deviceId: string, remove: boolean) => void
  onConfirm: () => void
  onCancel: () => void
}

export function IpAssignmentWarningModal({
  isOpen,
  warnings,
  decisions,
  onDecision,
  onConfirm,
  onCancel,
}: IpAssignmentWarningModalProps) {
  const allDecided = warnings.every(w => decisions[w.deviceId] !== undefined)

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Shared IP Address Detected
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            The following device{warnings.length > 1 ? 's have' : ' has'} a primary IP address
            assigned to multiple devices. Decide whether to remove the IP from Nautobot or keep it.
          </p>

          {warnings.map(warning => {
            const otherDevices = warning.assignments.filter(
              a => a.interface.device.name !== warning.deviceName
            )
            const decision = decisions[warning.deviceId]

            return (
              <div key={warning.deviceId} className="rounded-md border p-4 space-y-3">
                <div>
                  <p className="font-medium text-sm">{warning.deviceName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{warning.ipAddress}</p>
                </div>

                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Also assigned to:</p>
                  <ul className="space-y-0.5">
                    {otherDevices.map(a => (
                      <li key={`${a.interface.device.name}:${a.interface.name}`} className="text-sm">
                        <span className="font-medium">{a.interface.device.name}</span>
                        <span className="text-muted-foreground"> — {a.interface.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={decision === true ? 'destructive' : 'outline'}
                    onClick={() => onDecision(warning.deviceId, true)}
                  >
                    Remove IP
                  </Button>
                  <Button
                    size="sm"
                    variant={decision === false ? 'default' : 'outline'}
                    onClick={() => onDecision(warning.deviceId, false)}
                  >
                    Keep IP
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!allDecided}>
            Proceed
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
