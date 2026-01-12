import type { CSVConfig, ParsedCSVData, ValidationResult } from './types'

export const DEFAULT_CSV_CONFIG: CSVConfig = {
  delimiter: ',',
  quoteChar: '"',
}

export const EMPTY_PARSED_DATA: ParsedCSVData = {
  headers: [],
  rows: [],
  rowCount: 0,
}

export const EMPTY_VALIDATION_RESULTS: ValidationResult[] = []

export const OBJECT_TYPE_LABELS: Record<string, string> = {
  devices: 'Devices',
  'ip-prefixes': 'IP Prefixes',
  'ip-addresses': 'IP Addresses',
  locations: 'Locations',
}
