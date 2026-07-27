'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useUserDeletionImpact, useRbacUsers } from '../../hooks/use-rbac-queries'
import { useRbacMutations } from '../../hooks/use-rbac-mutations'
import { RBACLoading } from '../rbac-loading'
import { ApiError } from '@/hooks/use-api'
import type { User } from '../../types'
import { EMPTY_USERS } from '../../utils/constants'

interface DeleteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
}

export function DeleteUserDialog({ open, onOpenChange, user }: DeleteUserDialogProps) {
  const { deleteUser } = useRbacMutations()
  const { data: allUsers = EMPTY_USERS } = useRbacUsers({ enabled: open })
  const {
    data: impact,
    isLoading: isImpactLoading,
    isError: isImpactError,
    refetch: refetchImpact,
  } = useUserDeletionImpact(user?.id ?? null, { enabled: open && !!user })

  const [reassignToUserId, setReassignToUserId] = useState('')
  const [confirmPrivateDelete, setConfirmPrivateDelete] = useState(false)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)

  // Reset local state each time the dialog is (re)opened for a user
  useEffect(() => {
    if (open) {
      setReassignToUserId('')
      setConfirmPrivateDelete(false)
      setConflictMessage(null)
    }
  }, [open, user])

  const reassignCandidates = useMemo(
    () => allUsers.filter(candidate => candidate.id !== user?.id),
    [allUsers, user]
  )

  const requiresReassignment = impact?.requires_global_reassignment ?? false
  const requiresPrivateConfirmation = impact?.requires_private_confirmation ?? false
  const canConfirm =
    !!impact &&
    (!requiresReassignment || reassignToUserId !== '') &&
    (!requiresPrivateConfirmation || confirmPrivateDelete)

  const handleCancel = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleConfirm = useCallback(async () => {
    if (!user) return
    setConflictMessage(null)
    try {
      await deleteUser.mutateAsync({
        userId: user.id,
        reassignGlobalItemsToUserId: reassignToUserId
          ? Number(reassignToUserId)
          : undefined,
        deletePrivateItems: confirmPrivateDelete,
      })
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflictMessage(
          "This user's templates/schedules changed since this dialog opened " +
            '— review the updated impact below and confirm again.'
        )
        refetchImpact()
        return
      }
      // Any other error already surfaced via the mutation's onError toast.
    }
  }, [
    user,
    reassignToUserId,
    confirmPrivateDelete,
    deleteUser,
    onOpenChange,
    refetchImpact,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete User{user ? `: ${user.username}` : ''}</DialogTitle>
          <DialogDescription>
            This permanently deletes the user account and its RBAC assignments.
          </DialogDescription>
        </DialogHeader>

        {isImpactLoading && (
          <RBACLoading message="Checking owned templates and schedules..." />
        )}

        {isImpactError && (
          <Alert className="status-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Could not determine what this deletion would affect. Try again.
            </AlertDescription>
          </Alert>
        )}

        {impact && (
          <div className="space-y-4">
            {conflictMessage && (
              <Alert className="status-error">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{conflictMessage}</AlertDescription>
              </Alert>
            )}

            {!requiresReassignment && !requiresPrivateConfirmation && (
              <p className="text-sm text-muted-foreground">
                This user owns no global or private job templates/schedules. Are
                you sure you want to delete <strong>{user?.username}</strong>?
              </p>
            )}

            {requiresReassignment && (
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>{user?.username}</strong> created{' '}
                  {impact.global_templates.length} global template(s) and{' '}
                  {impact.global_schedules.length} global schedule(s). Choose who
                  should become the new owner:
                </p>
                <ul className="text-sm text-muted-foreground list-disc pl-5">
                  {impact.global_templates.map(template => (
                    <li key={`tmpl-${template.id}`}>Template: {template.name}</li>
                  ))}
                  {impact.global_schedules.map(schedule => (
                    <li key={`sched-${schedule.id}`}>
                      Schedule: {schedule.job_identifier}
                    </li>
                  ))}
                </ul>
                <div className="space-y-1">
                  <Label htmlFor="reassign-to-user">Reassign to</Label>
                  <Select value={reassignToUserId} onValueChange={setReassignToUserId}>
                    <SelectTrigger id="reassign-to-user">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {reassignCandidates.map(candidate => (
                        <SelectItem key={candidate.id} value={String(candidate.id)}>
                          {candidate.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {requiresPrivateConfirmation && (
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>{user?.username}</strong> owns{' '}
                  {impact.private_templates.length} private template(s) and{' '}
                  {impact.private_schedules.length} private schedule(s). These
                  will be permanently deleted:
                </p>
                <ul className="text-sm text-muted-foreground list-disc pl-5">
                  {impact.private_templates.map(template => (
                    <li key={`ptmpl-${template.id}`}>Template: {template.name}</li>
                  ))}
                  {impact.private_schedules.map(schedule => (
                    <li key={`psched-${schedule.id}`}>
                      Schedule: {schedule.job_identifier}
                    </li>
                  ))}
                </ul>

                {impact.cascade_schedules_from_other_users.length > 0 && (
                  <Alert className="status-error">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {impact.cascade_schedules_from_other_users.length} schedule(s)
                      belonging to other users reference these templates and will
                      also be removed.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="confirm-private-delete"
                    checked={confirmPrivateDelete}
                    onCheckedChange={checked =>
                      setConfirmPrivateDelete(checked === true)
                    }
                  />
                  <Label
                    htmlFor="confirm-private-delete"
                    className="text-sm font-normal"
                  >
                    I understand these will be permanently deleted
                  </Label>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm || deleteUser.isPending}
            onClick={handleConfirm}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
