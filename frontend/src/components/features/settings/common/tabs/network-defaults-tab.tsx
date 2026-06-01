'use client'

import { Database } from 'lucide-react'
import { DefaultsSettingsForm } from '../components/defaults-settings-form'
import { useNetworkDefaultsQuery } from '../hooks/use-network-defaults-query'
import { useNetworkDefaultsMutations } from '../hooks/use-network-defaults-mutations'
import { EMPTY_DEFAULTS_FIELDS } from '../utils/defaults-fields-constants'

export function NetworkDefaultsTab() {
  const { data: defaults, isLoading } = useNetworkDefaultsQuery()
  const { saveDefaults } = useNetworkDefaultsMutations()

  return (
    <DefaultsSettingsForm
      title="Network Default Values"
      description="Default values used when creating devices, interfaces, and IP objects in Nautobot"
      loadingMessage="Loading network defaults..."
      headerIcon={Database}
      defaults={defaults}
      isLoadingDefaults={isLoading}
      isSaving={saveDefaults.isPending}
      emptyDefaults={EMPTY_DEFAULTS_FIELDS}
      onSave={values => saveDefaults.mutate(values)}
    />
  )
}
