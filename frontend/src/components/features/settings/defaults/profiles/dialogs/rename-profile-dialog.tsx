'use client'

import { useState, useCallback, useEffect } from 'react'
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
import { useProfileMutations } from '../hooks/use-profile-mutations'
import type { Profile } from '../types'

interface RenameProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: Profile | null
}

export function RenameProfileDialog({
  open,
  onOpenChange,
  profile,
}: RenameProfileDialogProps) {
  const { updateProfile } = useProfileMutations()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setError(null)
    }
  }, [profile])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen)
      if (!nextOpen) {
        setError(null)
      }
    },
    [onOpenChange]
  )

  const handleSubmit = useCallback(async () => {
    if (!profile) return
    setError(null)
    try {
      await updateProfile.mutateAsync({ id: profile.id, name })
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename profile')
    }
  }, [profile, name, updateProfile, handleOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Profile</DialogTitle>
          <DialogDescription>Choose a new name for this profile.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="rename-profile-name">Profile Name</Label>
          <Input
            id="rename-profile-name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={updateProfile.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={updateProfile.isPending || !name.trim()}
          >
            {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
