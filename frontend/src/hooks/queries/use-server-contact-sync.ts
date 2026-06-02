import { useCallback } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ServerContact, ServerResponse } from '@/components/features/server-clients/server/types'

interface SyncParams {
  server: ServerResponse
  contacts: ServerContact[]
}

function normalizeServerContacts(
  contact: ServerResponse['contact']
): ServerContact[] {
  if (!contact) return []
  if (Array.isArray(contact)) return contact
  return [contact as ServerContact]
}

function contactChanged(previous: ServerContact, next: ServerContact): boolean {
  return (
    previous.id !== next.id ||
    previous.role.id !== next.role.id
  )
}

export function useServerContactSync() {
  const { apiCall } = useApi()

  const syncContacts = useCallback(
    async ({ server, contacts }: SyncParams): Promise<ServerContact[]> => {
      const hasNautobotId = !!server.nautobot_uuid
      const previous = normalizeServerContacts(server.contact)
      const previousByAssociation = new Map(
        previous
          .filter((entry) => entry.association_id)
          .map((entry) => [entry.association_id as string, entry])
      )
      const nextAssociationIds = new Set(
        contacts
          .map((entry) => entry.association_id)
          .filter((id): id is string => !!id)
      )

      if (!hasNautobotId) {
        return contacts.map((entry) => {
          const prev =
            (entry.association_id
              ? previousByAssociation.get(entry.association_id)
              : undefined) ??
            previous.find((p) => p.id === entry.id)
          return {
            ...entry,
            association_id: entry.association_id ?? prev?.association_id ?? null,
          }
        })
      }

      const associatedObjectType = server.is_virtual
        ? 'virtualization.virtualmachine'
        : 'dcim.device'

      for (const prev of previous) {
        if (prev.association_id && !nextAssociationIds.has(prev.association_id)) {
          await apiCall(`nautobot/contact-associations/${prev.association_id}`, {
            method: 'DELETE',
          })
        }
      }

      const synced: ServerContact[] = []

      for (const contact of contacts) {
        const prev = contact.association_id
          ? previousByAssociation.get(contact.association_id)
          : previous.find((p) => p.id === contact.id && !p.association_id)

        if (contact.association_id) {
          if (prev && contactChanged(prev, contact)) {
            await apiCall('nautobot/contact-associations/', {
              method: 'PATCH',
              body: JSON.stringify({
                items: [
                  {
                    id: contact.association_id,
                    contact_id: contact.id,
                    role: {
                      id: contact.role.id,
                      name: contact.role.name,
                    },
                  },
                ],
              }),
            })
          }
          synced.push({
            ...contact,
            association_id: contact.association_id,
          })
          continue
        }

        const created = await apiCall<{ id: string }>('nautobot/contact-associations/', {
          method: 'POST',
          body: JSON.stringify({
            contact_id: contact.id,
            associated_object_type: associatedObjectType,
            associated_object_id: server.nautobot_uuid,
            role: {
              name: contact.role.name,
            },
          }),
        })

        synced.push({
          ...contact,
          association_id: created.id,
        })
      }

      return synced
    },
    [apiCall]
  )

  return { syncContacts }
}
