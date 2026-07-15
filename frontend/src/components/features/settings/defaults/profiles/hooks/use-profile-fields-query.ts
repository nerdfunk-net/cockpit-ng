/**
 * Thin re-export used by other features (e.g. Nautobot / Tools / CSV Updates)
 * that need a profile's field values by id without depending on the Settings
 * / Defaults / Profiles admin UI internals.
 */
export { useProfileQuery as useProfileFieldsQuery } from './use-profile-query'
