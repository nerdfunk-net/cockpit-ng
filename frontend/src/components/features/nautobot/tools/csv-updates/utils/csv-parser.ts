import type { ObjectType, CSVConfig, ValidationResult } from '../types'

/**
 * Parse a single CSV line respecting quotes and delimiters
 */
export function parseCSVLine(line: string, config: CSVConfig): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === config.quoteChar) {
      inQuotes = !inQuotes
    } else if (char === config.delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Parse CSV file content into headers and rows
 */
export function parseCSVContent(
  text: string,
  config: CSVConfig
): { headers: string[]; rows: string[][] } {
  const lines = text.split('\n').filter(line => line.trim())

  if (lines.length === 0) {
    throw new Error('CSV file is empty')
  }

  const firstLine = lines[0]
  if (!firstLine) {
    throw new Error('CSV file has no valid header line')
  }

  const headers = parseCSVLine(firstLine, config)
  const rows = lines.slice(1).map(line => parseCSVLine(line, config))

  return { headers, rows }
}

/**
 * Get required headers for each object type
 */
export function getRequiredHeaders(type: ObjectType): string[] {
  const requiredHeaders: Record<ObjectType, string[]> = {
    devices: ['name', 'id', 'device_type__model', 'location__name'],
    'ip-prefixes': ['prefix', 'id', 'namespace__name'],
    'ip-addresses': ['address', 'id', 'parent__namespace__name'],
    locations: ['name', 'id', 'location_type__name'],
  }

  return requiredHeaders[type]
}

/**
 * Validate CSV headers against required fields
 */
export function validateHeaders(
  headers: string[],
  type: ObjectType
): ValidationResult[] {
  const results: ValidationResult[] = []
  const required = getRequiredHeaders(type)
  const missingHeaders = required.filter(h => !headers.includes(h))

  if (missingHeaders.length > 0) {
    results.push({
      type: 'error',
      message: `Missing required headers: ${missingHeaders.join(', ')}`,
    })
  } else {
    results.push({
      type: 'success',
      message: 'All required headers are present',
    })
  }

  return results
}

/**
 * Validate for empty rows
 */
export function validateEmptyRows(rows: string[][]): ValidationResult[] {
  const results: ValidationResult[] = []
  const emptyRows = rows.filter(row => row.every(cell => !cell.trim()))

  if (emptyRows.length > 0) {
    results.push({
      type: 'warning',
      message: `Found ${emptyRows.length} empty row(s)`,
    })
  }

  return results
}

/**
 * Validate UUID format in ID column
 */
export function validateIds(
  headers: string[],
  rows: string[][]
): ValidationResult[] {
  const results: ValidationResult[] = []
  const idColumnIndex = headers.indexOf('id')

  if (idColumnIndex === -1) {
    return results
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let invalidIdCount = 0

  rows.forEach((row, index) => {
    const id = row[idColumnIndex]?.trim()
    if (id && !uuidRegex.test(id)) {
      invalidIdCount++
      if (invalidIdCount <= 5) {
        results.push({
          type: 'error',
          message: `Invalid UUID format in row ${index + 2}: ${id}`,
          rowNumber: index + 2,
        })
      }
    }
  })

  if (invalidIdCount > 5) {
    results.push({
      type: 'error',
      message: `... and ${invalidIdCount - 5} more invalid UUIDs`,
    })
  }

  if (invalidIdCount === 0) {
    results.push({
      type: 'success',
      message: 'All IDs have valid UUID format',
    })
  }

  return results
}

/**
 * Validate IP addresses format
 */
export function validateIpAddresses(
  headers: string[],
  rows: string[][],
  type: ObjectType
): ValidationResult[] {
  const results: ValidationResult[] = []

  if (type !== 'ip-prefixes' && type !== 'ip-addresses') {
    return results
  }

  const addressField = type === 'ip-prefixes' ? 'prefix' : 'address'
  const addressColumnIndex = headers.indexOf(addressField)

  if (addressColumnIndex === -1) {
    return results
  }

  let invalidCount = 0
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/

  rows.forEach((row, index) => {
    const address = row[addressColumnIndex]?.trim()
    if (address && !ipRegex.test(address)) {
      invalidCount++
      if (invalidCount <= 3) {
        results.push({
          type: 'warning',
          message: `Invalid IP format in row ${index + 2}: ${address}`,
          rowNumber: index + 2,
        })
      }
    }
  })

  if (invalidCount > 3) {
    results.push({
      type: 'warning',
      message: `... and ${invalidCount - 3} more invalid IP addresses`,
    })
  }

  return results
}

/**
 * Run all validations on CSV data
 */
export function validateCSVData(
  type: ObjectType,
  headers: string[],
  rows: string[][]
): ValidationResult[] {
  const results: ValidationResult[] = []

  results.push(...validateHeaders(headers, type))
  results.push(...validateEmptyRows(rows))
  results.push(...validateIds(headers, rows))
  results.push(...validateIpAddresses(headers, rows, type))

  return results
}
