'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Server } from 'lucide-react'
import type { DeviceType } from '@/components/features/nautobot/add-device/types'

interface AddToNautobotDeviceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hostname: string
  deviceTypes: DeviceType[]
  isLoadingTypes: boolean
  isSubmitting: boolean
  onConfirm: (deviceTypeId: string) => Promise<void>
}

function formatDeviceTypeLabel(dt: DeviceType): string {
  const manufacturer = dt.manufacturer?.name ?? dt.manufacturer?.display ?? ''
  const model = dt.model ?? dt.display ?? dt.id
  return manufacturer ? `${manufacturer} — ${model}` : model
}

export function AddToNautobotDeviceDialog({
  open,
  onOpenChange,
  hostname,
  deviceTypes,
  isLoadingTypes,
  isSubmitting,
  onConfirm,
}: AddToNautobotDeviceDialogProps) {
  const [deviceTypeId, setDeviceTypeId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!deviceTypeId) {
      setError('Please select a device type.')
      return
    }
    setError(null)
    try {
      await onConfirm(deviceTypeId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add device to Nautobot.')
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDeviceTypeId('')
      setError(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-600" />
            Add to Nautobot
          </DialogTitle>
          <DialogDescription>
            Create device <span className="font-medium text-foreground">{hostname}</span> in
            Nautobot. Role, status, location, and platform come from Server Defaults and this
            server record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="nautobot-device-type" className="text-sm font-medium">
            Device type <span className="text-destructive">*</span>
          </Label>
          {isLoadingTypes ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading device types…
            </div>
          ) : (
            <Select value={deviceTypeId} onValueChange={setDeviceTypeId} disabled={isSubmitting}>
              <SelectTrigger id="nautobot-device-type">
                <SelectValue placeholder="Select device type…" />
              </SelectTrigger>
              <SelectContent>
                {deviceTypes.map(dt => (
                  <SelectItem key={dt.id} value={dt.id}>
                    {formatDeviceTypeLabel(dt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || isLoadingTypes || !deviceTypeId}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating…
              </>
            ) : (
              'Add to Nautobot'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
