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
