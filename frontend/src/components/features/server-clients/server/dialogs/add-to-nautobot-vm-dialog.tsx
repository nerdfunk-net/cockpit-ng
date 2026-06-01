'use client'

import { Monitor } from 'lucide-react'
import { SelectClusterDialog } from './select-cluster-dialog'
import type { ServerCluster } from '../types'

interface AddToNautobotVmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hostname: string
  isSubmitting: boolean
  onConfirm: (cluster: ServerCluster) => Promise<void>
}

export function AddToNautobotVmDialog({
  open,
  onOpenChange,
  hostname,
  isSubmitting,
  onConfirm,
}: AddToNautobotVmDialogProps) {
  return (
    <SelectClusterDialog
      open={open}
      onOpenChange={onOpenChange}
      headerIcon={Monitor}
      title="Add to Nautobot"
      description={
        <>
          Create virtual machine{' '}
          <span className="font-medium text-foreground">{hostname}</span> in Nautobot. Role,
          status, and platform come from Server Defaults.
        </>
      }
      confirmLabel="Add to Nautobot"
      submittingLabel="Creating…"
      isSubmitting={isSubmitting}
      onConfirm={onConfirm}
    />
  )
}
