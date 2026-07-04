'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import {
  useNautobotContactsQuery,
  type NautobotContactItem,
} from '@/hooks/queries/use-nautobot-contacts-query'
import {
  useNautobotContactRolesQuery,
  type NautobotContactRoleItem,
} from '@/hooks/queries/use-nautobot-contact-roles-query'
import type { ServerContact } from '../types'

interface SelectContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  submittingLabel?: string
  isSubmitting: boolean
  initialContactId?: string
  initialRoleId?: string
  initialAssociationId?: string
  allowClear?: boolean
  headerIcon?: LucideIcon
  onConfirm: (contact: ServerContact | null) => Promise<void>
}

const NO_CONTACT_VALUE = '__no_contact__'
const EMPTY_CONTACTS: NautobotContactItem[] = []
const EMPTY_CONTACT_ROLES: NautobotContactRoleItem[] = []

export function SelectContactDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  submittingLabel = 'Saving…',
  isSubmitting,
  initialContactId,
  initialRoleId,
  initialAssociationId,
  allowClear = false,
  headerIcon: HeaderIcon,
  onConfirm,
}: SelectContactDialogProps) {
  const [contactId, setContactId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { data: contacts = EMPTY_CONTACTS, isLoading } = useNautobotContactsQuery(open)
  const {
    data: roles = EMPTY_CONTACT_ROLES,
    isLoading: isRolesLoading,
  } = useNautobotContactRolesQuery(open)

  const normalizedContacts = useMemo(
    () => contacts.map((contact) => ({ ...contact, label: contact.name ?? contact.display ?? contact.id })),
    [contacts]
  )

  const normalizedRoles = useMemo(
    () =>
      roles.map((role) => ({
        ...role,
        label: role.name ?? role.display ?? role.id,
      })),
    [roles]
  )

  useEffect(() => {
    if (open) {
      setContactId(initialContactId ?? '')
      setRoleId(initialRoleId ?? '')
      setError(null)
    }
  }, [open, initialContactId, initialRoleId])

  const handleConfirm = async () => {
    if (!contactId) {
      setError('Please select a contact.')
      return
    }
    if (contactId === NO_CONTACT_VALUE) {
      setError(null)
      try {
        await onConfirm(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to clear contact.')
      }
      return
    }
    if (!roleId) {
      setError('Please select a role.')
      return
    }
    const match = normalizedContacts.find((contact) => contact.id === contactId)
    const role = normalizedRoles.find((r) => r.id === roleId)
    setError(null)
    try {
      await onConfirm({
        id: contactId,
        name: match?.label ?? contactId,
        role: {
          id: roleId,
          name: role?.label ?? roleId,
        },
        ...(initialAssociationId ? { association_id: initialAssociationId } : {}),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save contact.')
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setContactId('')
      setError(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {HeaderIcon && <HeaderIcon className="h-5 w-5 text-primary" />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="server-contact-select" className="text-sm font-medium">
            Contact <span className="text-destructive">*</span>
          </Label>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading contacts…
            </div>
          ) : (
            <Select value={contactId} onValueChange={setContactId} disabled={isSubmitting}>
              <SelectTrigger id="server-contact-select">
                <SelectValue placeholder="Select contact…" />
              </SelectTrigger>
              <SelectContent>
                {allowClear && <SelectItem value={NO_CONTACT_VALUE}>Remove contact</SelectItem>}
                {normalizedContacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {contactId && contactId !== NO_CONTACT_VALUE && (
          <div className="space-y-2 py-2">
            <Label htmlFor="server-contact-role-select" className="text-sm font-medium">
              Role <span className="text-destructive">*</span>
            </Label>
            {isRolesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading roles…
              </div>
            ) : (
              <Select value={roleId} onValueChange={setRoleId} disabled={isSubmitting}>
                <SelectTrigger id="server-contact-role-select">
                  <SelectValue placeholder="Select role…" />
                </SelectTrigger>
                <SelectContent>
                  {normalizedRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {error && !roleId && contactId !== NO_CONTACT_VALUE && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              isLoading ||
              isRolesLoading ||
              !contactId ||
              (contactId !== NO_CONTACT_VALUE && !roleId)
            }
          >
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
