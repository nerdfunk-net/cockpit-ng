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
