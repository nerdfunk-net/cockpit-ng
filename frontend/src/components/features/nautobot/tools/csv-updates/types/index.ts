export type ObjectType = 'devices' | 'ip-prefixes' | 'ip-addresses' | 'locations'

export interface CSVConfig {
  delimiter: string
  quoteChar: string
}

export interface ParsedCSVData {
  headers: string[]
  rows: string[][]
  rowCount: number
}

export interface ValidationResult {
  type: 'success' | 'warning' | 'error'
  message: string
  rowNumber?: number
}

export interface UpdateResult {
  objectId: string
  objectName?: string
  success: boolean
  message: string
  changes?: Record<string, unknown>
}

export interface UpdateSummary {
  totalProcessed: number
  successful: number
  failed: number
  skipped: number
  results: UpdateResult[]
}

/** Strategy used to look up a device by name in Nautobot. */
export type MatchingStrategy = 'exact' | 'contains' | 'starts_with'

/** A single default property (field + value) configured by the user. */
export interface DefaultProperty {
  field: string
  value: string
  /** Stable list key (client-only; not sent to the API). */
  rowKey: string
}

/** How to transform the CSV name value before device lookup. */
export type NameTransformMode = 'regex' | 'replace'

/**
 * Name transform applied to the CSV name value before it is used for device lookup.
 * - regex:   re.search(pattern, name) — use captured group(1) if present, else full match
 * - replace: re.sub(pattern, replacement, name)
 * Leave `pattern` empty to disable the transform.
 */
export interface NameTransform {
  mode: NameTransformMode
  pattern: string
  /** Only used in replace mode. Empty string = delete the matched portion. */
  replacement: string
}

export type DataSourceMode = 'upload' | 'agent'

/** Raw CSV text keyed by "flowId::key" — one entry per identifier/result-key combo. */
export type AgentDataResult = Record<string, string>

/** One row per CSV line for the devices object type (not yet merged by device). */
export interface DeviceCsvRow {
  id: string
  deviceName: string
  /** Mapped field key -> cell value (includes the device-name field). */
  fields: Record<string, string>
  hasIpAddress: boolean
}

/** One entry in a device's `interfaces` array sent to `tasks/update-devices`. */
export interface DeviceInterfaceEntry {
  name: string
  type?: string
  status?: string
  ip_address?: string
  is_primary_ipv4?: boolean
}

/** One device update object sent to `tasks/update-devices` (JSON mode). */
export interface DeviceUpdatePayload {
  name: string
  interfaces: DeviceInterfaceEntry[]
  [key: string]: unknown
}

/** Unified row shape used by the Filter step, for any object type. */
export interface FilterRow {
  id: string
  displayName: string
  fields: Record<string, string>
  hasIpAddress?: boolean
}

/** Pagination state for the Filter step's row table (0-indexed page). */
export interface PaginationState {
  currentPage: number
  pageSize: number
  totalItems: number
  totalPages: number
}
