import { useBuiltInProfileQuery } from './use-built-in-profile-query'

interface UseServerDefaultsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseServerDefaultsQueryOptions = {}

/** Thin alias over the Server built-in profile; same return shape as before the Profiles migration. */
export function useServerDefaultsQuery(
  options: UseServerDefaultsQueryOptions = DEFAULT_OPTIONS
) {
  return useBuiltInProfileQuery('server', options)
}
