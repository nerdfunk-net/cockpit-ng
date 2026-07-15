'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Lock, Plus, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useProfilesQuery } from '../hooks/use-profiles-query'
import { useProfileMutations } from '../hooks/use-profile-mutations'
import { EMPTY_PROFILES } from '../utils/constants'
import type { Profile } from '../types'

interface ProfileTreeProps {
  selectedProfileId: number | null
  onSelect: (profileId: number) => void
  onAddClick: () => void
  onRenameClick: (profile: Profile) => void
}

function sortProfiles(profiles: Profile[]): Profile[] {
  const builtInOrder: Record<string, number> = { network: 0, server: 1 }
  const builtIns = profiles
    .filter(p => p.is_built_in)
    .sort((a, b) => (builtInOrder[a.built_in_key ?? ''] ?? 99) - (builtInOrder[b.built_in_key ?? ''] ?? 99))
  const custom = profiles.filter(p => !p.is_built_in)
  return [...builtIns, ...custom]
}

export function ProfileTree({
  selectedProfileId,
  onSelect,
  onAddClick,
  onRenameClick,
}: ProfileTreeProps) {
  const { data: profiles = EMPTY_PROFILES, isLoading } = useProfilesQuery()
  const { deleteProfile } = useProfileMutations()
  const { confirmDialog, openConfirm } = useConfirmDialog()

  const orderedProfiles = sortProfiles(profiles)

  const handleDeleteClick = (profile: Profile) => {
    openConfirm({
      title: 'Delete Profile',
      description: `Are you sure you want to delete the profile "${profile.name}"? This action cannot be undone.`,
      onConfirm: () => deleteProfile.mutate(profile.id),
      variant: 'destructive',
    })
  }

  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="panel-header border-b-0 rounded-none m-0 py-2 px-4">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span>Profiles</span>
          <Button size="sm" variant="secondary" onClick={onAddClick} className="h-7">
            <Plus className="h-3.5 w-3.5" />
            <span>Add Profile</span>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 panel-content">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-1">
            {orderedProfiles.map(profile => (
              <div
                key={profile.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(profile.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') onSelect(profile.id)
                }}
                className={cn(
                  'flex items-center justify-between rounded-md px-3 py-2 cursor-pointer text-sm',
                  selectedProfileId === profile.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {profile.is_built_in && (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{profile.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={profile.is_built_in}
                    title={
                      profile.is_built_in
                        ? 'Built-in profiles cannot be renamed'
                        : 'Rename profile'
                    }
                    onClick={e => {
                      e.stopPropagation()
                      onRenameClick(profile)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive"
                    disabled={profile.is_built_in}
                    title={
                      profile.is_built_in
                        ? 'Built-in profiles cannot be deleted'
                        : 'Delete profile'
                    }
                    onClick={e => {
                      e.stopPropagation()
                      handleDeleteClick(profile)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <ConfirmDialog {...confirmDialog} />
    </Card>
  )
}
