'use client'

import { useState } from 'react'
import { Pencil, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useServerMutations } from '@/hooks/queries/use-server-mutations'
import { useToast } from '@/hooks/use-toast'
import { SelectContactDialog } from '../dialogs/select-contact-dialog'
import type { ServerContact, ServerResponse } from '../types'

interface ContactRowProps {
  server: ServerResponse
}

export function ContactRow({ server }: ContactRowProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { updateServer } = useServerMutations()
  const { toast } = useToast()

  const handleConfirm = async (contact: ServerContact | null) => {
    await updateServer.mutateAsync(
      { id: server.id, data: { contact } },
      {
        onSuccess: () => {
          toast({
            title: contact ? 'Contact saved' : 'Contact cleared',
            description: contact
              ? `${contact.name} is set for this server.`
              : 'No contact is set for this server.',
          })
          setDialogOpen(false)
        },
      }
    )
  }

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Contact</span>
        {server.contact ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-gray-800 truncate">
              {server.contact.name}
            </span>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              title="Change contact"
              className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
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
            Manage contact
          </Button>
        )}
      </div>

      <SelectContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        headerIcon={UserRound}
        title="Manage contact"
        description={
          <>
            Select the Nautobot contact for{' '}
            <span className="font-medium text-foreground">{server.hostname}</span>.
          </>
        }
        confirmLabel="Save"
        submittingLabel="Saving…"
        isSubmitting={updateServer.isPending}
        initialContactId={server.contact?.id}
        onConfirm={handleConfirm}
      />
    </>
  )
}
