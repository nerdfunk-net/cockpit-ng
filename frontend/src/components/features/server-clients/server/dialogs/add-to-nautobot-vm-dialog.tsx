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
import { Loader2, Monitor } from 'lucide-react'
import { useVMDropdownsQuery } from '@/components/features/nautobot/add-vm/hooks/queries/use-vm-dropdowns-query'
import { EMPTY_CLUSTERS } from '@/components/features/nautobot/add-vm/constants'

interface AddToNautobotVmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hostname: string
  isSubmitting: boolean
  onConfirm: (clusterId: string) => Promise<void>
}

export function AddToNautobotVmDialog({
  open,
  onOpenChange,
  hostname,
  isSubmitting,
  onConfirm,
}: AddToNautobotVmDialogProps) {
  const [clusterId, setClusterId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: dropdownData, isLoading } = useVMDropdownsQuery()
  const clusters = dropdownData?.clusters ?? EMPTY_CLUSTERS

  const handleConfirm = async () => {
    if (!clusterId) {
      setError('Please select a cluster.')
      return
    }
    setError(null)
    try {
      await onConfirm(clusterId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add virtual machine to Nautobot.')
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setClusterId('')
      setError(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-blue-600" />
            Add to Nautobot
          </DialogTitle>
          <DialogDescription>
            Create virtual machine <span className="font-medium text-foreground">{hostname}</span>{' '}
            in Nautobot. Role, status, and platform come from Server Defaults.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="nautobot-cluster" className="text-sm font-medium">
            Cluster <span className="text-destructive">*</span>
          </Label>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading clusters…
            </div>
          ) : (
            <Select value={clusterId} onValueChange={setClusterId} disabled={isSubmitting}>
              <SelectTrigger id="nautobot-cluster">
                <SelectValue placeholder="Select cluster…" />
              </SelectTrigger>
              <SelectContent>
                {clusters.map(cluster => (
                  <SelectItem key={cluster.id} value={cluster.id}>
                    {cluster.name}
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
          <Button onClick={handleConfirm} disabled={isSubmitting || isLoading || !clusterId}>
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
