import type { CheckResult } from '../types'

export const DEFAULT_DELIMITER = ';'
export const DEFAULT_QUOTE_CHAR = '"'
export const POLLING_INTERVAL = 2000 // milliseconds
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// React best practice: Extract default arrays/objects to prevent re-render loops
export const EMPTY_RESULTS: CheckResult[] = []

export const DEFAULT_CSV_OPTIONS = {
  delimiter: DEFAULT_DELIMITER,
  quoteChar: DEFAULT_QUOTE_CHAR,
} as const
