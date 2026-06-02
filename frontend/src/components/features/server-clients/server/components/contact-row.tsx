'use client'

import { useCallback, useMemo, useState } from 'react'
import { Minus, Pencil, Plus, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useServerMutations } from '@/hooks/queries/use-server-mutations'
import { useToast } from '@/hooks/use-toast'
import { useServerContactSync } from '@/hooks/queries/use-server-contact-sync'
import { SelectContactDialog } from '../dialogs/select-contact-dialog'
import type { ServerContact, ServerResponse } from '../types'

interface ContactRowProps {
  server: ServerResponse
}

function normalizeServerContacts(
  contact: ServerResponse['contact']
): ServerContact[] {
  if (!contact) return []
  if (Array.isArray(contact)) return contact
  return [contact as ServerContact]
}

export function ContactRow({ server }: ContactRowProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const { updateServer } = useServerMutations()
  const { toast } = useToast()
  const { syncContacts } = useServerContactSync()

  const contacts = useMemo(() => normalizeServerContacts(server.contact), [server.contact])

  const persistContacts = useCallback(
    async (nextContacts: ServerContact[]) => {
      const syncedContacts = await syncContacts({ server, contacts: nextContacts })
      await updateServer.mutateAsync({
        id: server.id,
        data: { contact: syncedContacts.length > 0 ? syncedContacts : [] },
      })
      return syncedContacts
    },
    [server, syncContacts, updateServer]
  )

  const openAddDialog = () => {
    setEditIndex(null)
    setDialogOpen(true)
  }

  const openEditDialog = (index: number) => {
    setEditIndex(index)
    setDialogOpen(true)
  }

  const handleConfirm = async (contact: ServerContact | null) => {
    try {
      let nextContacts: ServerContact[]

      if (contact === null) {
        if (editIndex === null) {
          setDialogOpen(false)
          return
        }
        nextContacts = contacts.filter((_, index) => index !== editIndex)
      } else if (editIndex === null) {
        nextContacts = [...contacts, contact]
      } else {
        nextContacts = contacts.map((entry, index) =>
          index === editIndex ? contact : entry
        )
      }

      const syncedContacts = await persistContacts(nextContacts)
      toast({
        title: 'Contacts saved',
        description:
          syncedContacts.length > 0
            ? `${syncedContacts.length} contact(s) linked to this server.`
            : 'All contacts were removed from this server.',
      })
      setDialogOpen(false)
      setEditIndex(null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to sync contacts with Nautobot.'
      toast({
        title: 'Failed to save contacts',
        description: message,
        variant: 'destructive',
      })
      throw error
    }
  }

  const handleRemove = async (index: number) => {
    try {
      const nextContacts = contacts.filter((_, i) => i !== index)
      const syncedContacts = await persistContacts(nextContacts)
      toast({
        title: 'Contact removed',
        description:
          syncedContacts.length > 0
            ? `${syncedContacts.length} contact(s) remain on this server.`
            : 'No contacts remain on this server.',
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to remove contact.'
      toast({
        title: 'Failed to remove contact',
        description: message,
        variant: 'destructive',
      })
    }
  }

  const editingContact = editIndex !== null ? contacts[editIndex] : undefined

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Contacts</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={updateServer.isPending}
            onClick={openAddDialog}
            title="Add contact"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {contacts.length > 0 ? (
          <div className="rounded-md border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-2 py-1.5 bg-muted/40 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>Contact</span>
              <span>Role</span>
              <span className="sr-only">Actions</span>
            </div>
            {contacts.map((contact, index) => (
              <div
                key={`${contact.id}-${contact.association_id ?? index}`}
                className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center px-2 py-1.5 border-t border-border text-sm"
              >
                <span className="font-medium text-gray-800 truncate">{contact.name}</span>
                <span className="text-muted-foreground truncate">{contact.role.name}</span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => openEditDialog(index)}
                    title="Edit contact"
                    disabled={updateServer.isPending}
                    className="shrink-0 p-1 text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    title="Remove contact"
                    disabled={updateServer.isPending}
                    className="shrink-0 p-1 text-gray-400 hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No contacts assigned.</p>
        )}
      </div>

      <SelectContactDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditIndex(null)
        }}
        headerIcon={UserRound}
        title={editIndex === null ? 'Add contact' : 'Edit contact'}
        description={
          <>
            Select the Nautobot contact and role for{' '}
            <span className="font-medium text-foreground">{server.hostname}</span>.
          </>
        }
        confirmLabel="Save"
        submittingLabel="Saving…"
        isSubmitting={updateServer.isPending}
        initialContactId={editingContact?.id}
        initialRoleId={editingContact?.role?.id}
        initialAssociationId={editingContact?.association_id ?? undefined}
        allowClear={editIndex !== null}
        onConfirm={handleConfirm}
      />
    </>
  )
}
