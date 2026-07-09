/** Shared field shape for network and server defaults settings. */
export interface DefaultsFields {
  location: string
  platform: string
  interface_status: string
  interface_type: string
  device_status: string
  ip_address_status: string
  ip_prefix_status: string
  namespace: string
  device_role: string
  secret_group: string
  csv_delimiter: string
  csv_quote_char: string
}

export interface DefaultsApiResponse {
  success: boolean
  data?: DefaultsFields
  message?: string
}
