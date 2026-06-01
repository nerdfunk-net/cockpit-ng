'use client'

import { Server } from 'lucide-react'
import { DefaultsSettingsForm } from '../components/defaults-settings-form'
import { useServerDefaultsQuery } from '../hooks/use-server-defaults-query'
import { useServerDefaultsMutations } from '../hooks/use-server-defaults-mutations'
import { EMPTY_DEFAULTS_FIELDS } from '../utils/defaults-fields-constants'

export function ServerDefaultsTab() {
  const { data: defaults, isLoading } = useServerDefaultsQuery()
  const { saveDefaults } = useServerDefaultsMutations()

  return (
    <DefaultsSettingsForm
      title="Server Default Values"
      description="Default values used when creating servers and related objects in Nautobot"
      loadingMessage="Loading server defaults..."
      headerIcon={Server}
      defaults={defaults}
      isLoadingDefaults={isLoading}
      isSaving={saveDefaults.isPending}
      emptyDefaults={EMPTY_DEFAULTS_FIELDS}
      onSave={values => saveDefaults.mutate(values)}
    />
  )
}
