import { useBuiltInProfileQuery } from './use-built-in-profile-query'

interface UseNetworkDefaultsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNetworkDefaultsQueryOptions = {}

/** Thin alias over the Network built-in profile; same return shape as before the Profiles migration. */
export function useNetworkDefaultsQuery(
  options: UseNetworkDefaultsQueryOptions = DEFAULT_OPTIONS
) {
  return useBuiltInProfileQuery('network', options)
}
