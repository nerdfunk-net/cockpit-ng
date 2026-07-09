export type DataSourceMode = 'csv' | 'agent'

export type LiveUpdateStep =
  | 'source'
  | 'keys'
  | 'mapping'
  | 'table'
  | 'processing'
  | 'summary'

export interface ParsedCsvSource {
  headers: string[]
  rows: string[][]
}

export interface LiveUpdateRow {
  id: string
  deviceName: string
  /** Mapped field key -> cell value (includes the device-name field). */
  fields: Record<string, string>
  hasIpAddress: boolean
}

/** One entry in a device's `interfaces` array sent to `tasks/update-devices`. */
export interface LiveUpdateInterfaceEntry {
  name: string
  type?: string
  status?: string
  ip_address?: string
  is_primary_ipv4?: boolean
}

/** One device update object sent to `tasks/update-devices` (JSON mode). */
export interface DeviceUpdatePayload {
  name: string
  interfaces: LiveUpdateInterfaceEntry[]
  [key: string]: unknown
}
