'use client'

import { useState } from 'react'
import { Layers, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useServerMutations } from '@/hooks/queries/use-server-mutations'
import { useToast } from '@/hooks/use-toast'
import { SelectClusterDialog } from '../dialogs/select-cluster-dialog'
import type { ServerCluster, ServerResponse } from '../types'

interface ClusterRowProps {
  server: ServerResponse
}

export function ClusterRow({ server }: ClusterRowProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { updateServer } = useServerMutations()
  const { toast } = useToast()

  const handleConfirm = async (cluster: ServerCluster) => {
    await updateServer.mutateAsync(
      { id: server.id, data: { cluster } },
      {
        onSuccess: () => {
          toast({
            title: 'Cluster saved',
            description: `${cluster.name} is set for this server.`,
          })
          setDialogOpen(false)
        },
      }
    )
  }

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Cluster</span>
        {server.cluster ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground truncate">
              {server.cluster.name}
            </span>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              title="Change cluster"
              className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit h-7 text-xs"
            disabled={updateServer.isPending}
            onClick={() => setDialogOpen(true)}
          >
            Manage cluster
          </Button>
        )}
      </div>

      <SelectClusterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        headerIcon={Layers}
        title="Manage cluster"
        description={
          <>
            Select the Nautobot cluster for{' '}
            <span className="font-medium text-foreground">{server.hostname}</span>.
          </>
        }
        confirmLabel="Save"
        submittingLabel="Saving…"
        isSubmitting={updateServer.isPending}
        initialClusterId={server.cluster?.id}
        onConfirm={handleConfirm}
      />
    </>
  )
}
