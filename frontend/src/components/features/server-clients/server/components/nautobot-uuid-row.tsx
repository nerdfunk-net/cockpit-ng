'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddToNautobotVmDialog } from '../dialogs/add-to-nautobot-vm-dialog'
import { AddToNautobotDeviceDialog } from '../dialogs/add-to-nautobot-device-dialog'
import { useAddServerToNautobot } from '../hooks/use-add-server-to-nautobot'
import type { ServerResponse } from '../types'

interface NautobotUuidRowProps {
  server: ServerResponse
}

export function NautobotUuidRow({ server }: NautobotUuidRowProps) {
  const {
    openAddDialog,
    addVirtualServer,
    addBareMetalServer,
    vmDialogOpen,
    setVmDialogOpen,
    deviceDialogOpen,
    setDeviceDialogOpen,
    isPending,
    defaultsLoading,
    deviceDropdownsLoading,
    deviceTypes,
  } = useAddServerToNautobot(server)

  if (server.nautobot_uuid) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Nautobot UUID</span>
        <span className="text-sm font-medium text-foreground truncate font-mono">
          {server.nautobot_uuid}
        </span>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Nautobot UUID</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit h-7 text-xs"
          disabled={isPending || defaultsLoading}
          onClick={openAddDialog}
        >
          {isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              Adding…
            </>
          ) : (
            'Add to nautobot'
          )}
        </Button>
      </div>

      <AddToNautobotVmDialog
        open={vmDialogOpen}
        onOpenChange={setVmDialogOpen}
        hostname={server.hostname}
        isSubmitting={isPending}
        onConfirm={addVirtualServer}
      />

      <AddToNautobotDeviceDialog
        open={deviceDialogOpen}
        onOpenChange={setDeviceDialogOpen}
        hostname={server.hostname}
        deviceTypes={deviceTypes}
        isLoadingTypes={deviceDropdownsLoading}
        isSubmitting={isPending}
        onConfirm={addBareMetalServer}
      />
    </>
  )
}
