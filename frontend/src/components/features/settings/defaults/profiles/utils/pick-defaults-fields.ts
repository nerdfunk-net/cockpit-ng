import type { DefaultsFields, Profile } from '../types'

/** Strip identity fields (id, name, built_in_key, is_built_in), keeping only the 13 value fields. */
export function pickDefaultsFields(profile: Profile): DefaultsFields {
  return {
    location: profile.location,
    platform: profile.platform,
    interface_status: profile.interface_status,
    interface_type: profile.interface_type,
    device_status: profile.device_status,
    device_type: profile.device_type,
    ip_address_status: profile.ip_address_status,
    ip_prefix_status: profile.ip_prefix_status,
    namespace: profile.namespace,
    device_role: profile.device_role,
    secret_group: profile.secret_group,
    csv_delimiter: profile.csv_delimiter,
    csv_quote_char: profile.csv_quote_char,
  }
}
