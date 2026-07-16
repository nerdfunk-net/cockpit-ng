'use client'

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { EMPTY_DEFAULTS_FIELDS } from '../utils/defaults-fields-constants'
import { useProfileMutations } from '../hooks/use-profile-mutations'

interface AddProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (profileId: number) => void
}

export function AddProfileDialog({
  open,
  onOpenChange,
  onCreated,
}: AddProfileDialogProps) {
  const { createProfile } = useProfileMutations()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen)
      if (!nextOpen) {
        setName('')
        setError(null)
      }
    },
    [onOpenChange]
  )

  const handleSubmit = useCallback(async () => {
    setError(null)
    try {
      const created = await createProfile.mutateAsync({
        name,
        fields: EMPTY_DEFAULTS_FIELDS,
      })
      onCreated(created.id)
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile')
    }
  }, [name, createProfile, onCreated, handleOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Profile</DialogTitle>
          <DialogDescription>
            Create a new profile with its own set of default values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="new-profile-name">Profile Name</Label>
          <Input
            id="new-profile-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. VPN"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={createProfile.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createProfile.isPending || !name.trim()}
          >
            {createProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
