import { useMemo } from 'react'
import { useProfilesQuery } from './use-profiles-query'
import { EMPTY_DEFAULTS_FIELDS } from '../utils/defaults-fields-constants'
import { pickDefaultsFields } from '../utils/pick-defaults-fields'
import type { DefaultsFields, Profile } from '../types'

type BuiltInKey = 'network' | 'server'

interface UseBuiltInProfileQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseBuiltInProfileQueryOptions = {}

/**
 * Resolve the built-in Network or Server profile's 13 value fields by
 * `built_in_key`, never by hard-coded id (profile ids differ per DB).
 */
export function useBuiltInProfileQuery(
  builtInKey: BuiltInKey,
  options: UseBuiltInProfileQueryOptions = DEFAULT_OPTIONS
) {
  const { data: profiles, ...rest } = useProfilesQuery(options)

  const fields = useMemo(() => {
    const profile = profiles?.find((p: Profile) => p.built_in_key === builtInKey)
    return profile ? pickDefaultsFields(profile) : EMPTY_DEFAULTS_FIELDS
  }, [profiles, builtInKey])

  return { ...rest, data: fields as DefaultsFields }
}
