'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'
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
import { useVMDropdownsQuery } from '@/components/features/nautobot/add-vm/hooks/queries/use-vm-dropdowns-query'
import { EMPTY_CLUSTERS } from '@/components/features/nautobot/add-vm/constants'
import type { ServerCluster } from '../types'

interface SelectClusterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  submittingLabel?: string
  isSubmitting: boolean
  initialClusterId?: string
  headerIcon?: LucideIcon
  onConfirm: (cluster: ServerCluster) => Promise<void>
}

export function SelectClusterDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  submittingLabel = 'Saving…',
  isSubmitting,
  initialClusterId,
  headerIcon: HeaderIcon,
  onConfirm,
}: SelectClusterDialogProps) {
  const [clusterId, setClusterId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: dropdownData, isLoading } = useVMDropdownsQuery()
  const clusters = dropdownData?.clusters ?? EMPTY_CLUSTERS

  useEffect(() => {
    if (open) {
      setClusterId(initialClusterId ?? '')
      setError(null)
    }
  }, [open, initialClusterId])

  const handleConfirm = async () => {
    if (!clusterId) {
      setError('Please select a cluster.')
      return
    }
    const match = clusters.find(c => c.id === clusterId)
    setError(null)
    try {
      await onConfirm({
        id: clusterId,
        name: match?.name ?? clusterId,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save cluster.')
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
            {HeaderIcon && <HeaderIcon className="h-5 w-5 text-blue-600" />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="server-cluster-select" className="text-sm font-medium">
            Cluster <span className="text-destructive">*</span>
          </Label>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading clusters…
            </div>
          ) : (
            <Select value={clusterId} onValueChange={setClusterId} disabled={isSubmitting}>
              <SelectTrigger id="server-cluster-select">
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
                {submittingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
