import type { useApi } from '@/hooks/use-api'
import type { DefaultsFields, Profile, ProfileListApiResponse } from '../types'
import { pickDefaultsFields } from './pick-defaults-fields'

type ApiCallFn = ReturnType<typeof useApi>['apiCall']
type BuiltInKey = 'network' | 'server'

/**
 * Resolve a built-in profile's 13 value fields for callers that cannot use
 * hooks (Promise.all inside a queryFn, useEffect/useCallback bodies). Mirrors
 * the legacy `settings/network|server/defaults` response contract: null on
 * any failure or missing built-in row, the field values otherwise.
 */
export async function fetchBuiltInProfileFields(
  apiCall: ApiCallFn,
  builtInKey: BuiltInKey
): Promise<DefaultsFields | null> {
  try {
    const response = await apiCall<ProfileListApiResponse>('settings/profiles')
    if (!response.success || !response.data) return null

    const profile = response.data.find((p: Profile) => p.built_in_key === builtInKey)
    return profile ? pickDefaultsFields(profile) : null
  } catch {
    return null
  }
}
