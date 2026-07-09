import type { DefaultsFields } from '../types/defaults-fields'

export const EMPTY_DEFAULTS_FIELDS: DefaultsFields = {
  location: '',
  platform: '',
  interface_status: '',
  interface_type: '',
  device_status: '',
  ip_address_status: '',
  ip_prefix_status: '',
  namespace: '',
  device_role: '',
  secret_group: '',
  csv_delimiter: ',',
  csv_quote_char: '"',
} as const

export const DEFAULTS_FIELDS_CACHE_TIME = 5 * 60 * 1000
