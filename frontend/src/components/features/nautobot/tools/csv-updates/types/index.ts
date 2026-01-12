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
