'use client'

import { useState, useCallback, useEffect } from 'react'
import { Settings2 } from 'lucide-react'
import { IconChip } from '@/components/shared/icon-chip'
import type { DefaultsFields } from './types'
import { EMPTY_DEFAULTS_FIELDS } from './utils/defaults-fields-constants'
import { ProfileTree } from './components/profile-tree'
import { DefaultsSettingsForm } from './components/defaults-settings-form'
import { AddProfileDialog } from './dialogs/add-profile-dialog'
import { RenameProfileDialog } from './dialogs/rename-profile-dialog'
import { useProfilesQuery } from './hooks/use-profiles-query'
import { useProfileQuery } from './hooks/use-profile-query'
import { useProfileMutations } from './hooks/use-profile-mutations'
import { EMPTY_PROFILES } from './utils/constants'
import type { Profile } from './types'

export function ProfilesSettings() {
  const { data: profiles = EMPTY_PROFILES } = useProfilesQuery()
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Profile | null>(null)

  // Default the selection to the built-in "Network" profile once the list loads
  useEffect(() => {
    if (selectedProfileId !== null || profiles.length === 0) return
    const network = profiles.find(p => p.built_in_key === 'network')
    const fallback = profiles[0]
    if (network) {
      setSelectedProfileId(network.id)
    } else if (fallback) {
      setSelectedProfileId(fallback.id)
    }
  }, [profiles, selectedProfileId])

  const { data: selectedProfile, isLoading: isLoadingProfile } =
    useProfileQuery(selectedProfileId)
  const { updateProfile } = useProfileMutations()

  const handleSave = useCallback(
    (values: DefaultsFields) => {
      if (selectedProfileId === null) return
      updateProfile.mutate({ id: selectedProfileId, fields: values })
    },
    [selectedProfileId, updateProfile]
  )

  const handleCreated = useCallback((profileId: number) => {
    setSelectedProfileId(profileId)
  }, [])

  const handleRenameOpenChange = useCallback((open: boolean) => {
    if (!open) setRenameTarget(null)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <IconChip>
          <Settings2 className="h-6 w-6" />
        </IconChip>
        <div>
          <h1 className="text-3xl font-bold">Profiles</h1>
          <p className="text-muted-foreground">
            Manage named sets of default values used when creating devices, interfaces,
            and IP objects in Nautobot
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        <ProfileTree
          selectedProfileId={selectedProfileId}
          onSelect={setSelectedProfileId}
          onAddClick={() => setShowAddDialog(true)}
          onRenameClick={setRenameTarget}
        />

        <DefaultsSettingsForm
          title={
            selectedProfile ? `${selectedProfile.name} Default Values` : 'Default Values'
          }
          description="Default values used when creating devices, interfaces, and IP objects in Nautobot for this profile"
          loadingMessage="Loading profile..."
          headerIcon={Settings2}
          defaults={selectedProfile}
          isLoadingDefaults={isLoadingProfile}
          isSaving={updateProfile.isPending}
          emptyDefaults={EMPTY_DEFAULTS_FIELDS}
          onSave={handleSave}
        />
      </div>

      <AddProfileDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onCreated={handleCreated}
      />

      <RenameProfileDialog
        open={renameTarget !== null}
        onOpenChange={handleRenameOpenChange}
        profile={renameTarget}
      />
    </div>
  )
}
