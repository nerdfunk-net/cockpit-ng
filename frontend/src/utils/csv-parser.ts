/**
 * CSV parsing utilities
 *
 * This module provides utilities for parsing CSV data with proper handling
 * of quotes, delimiters, and escaped characters.
 */

/**
 * Parse a single CSV line into an array of values
 *
 * Handles:
 * - Custom delimiters
 * - Quoted fields (with quote character)
 * - Escaped quotes (two quotes in a row)
 * - Trimming of whitespace
 *
 * @param line - CSV line to parse
 * @param delimiter - Delimiter character (default: comma)
 * @param quoteChar - Quote character (default: double quote)
 * @returns Array of parsed values
 *
 * @example
 * ```typescript
 * parseCSVLine('name,ip,location')
 * // Returns: ['name', 'ip', 'location']
 *
 * parseCSVLine('"Router 1","192.168.1.1","Data Center"')
 * // Returns: ['Router 1', '192.168.1.1', 'Data Center']
 *
 * parseCSVLine('name;"quoted ""value""";location', ';')
 * // Returns: ['name', 'quoted "value"', 'location']
 * ```
 */
export function parseCSVLine(
  line: string,
  delimiter: string = ',',
  quoteChar: string = '"'
): string[] {
  const values: string[] = []
  let currentValue = ''
  let inQuotes = false
  let i = 0

  while (i < line.length) {
    const char = line[i]

    if (char === quoteChar) {
      if (inQuotes && line[i + 1] === quoteChar) {
        // Escaped quote (two quotes in a row)
        currentValue += quoteChar
        i += 2
        continue
      }
      // Toggle quote state
      inQuotes = !inQuotes
      i++
      continue
    }

    if (char === delimiter && !inQuotes) {
      // End of field
      values.push(currentValue.trim())
      currentValue = ''
      i++
      continue
    }

    // Regular character
    currentValue += char
    i++
  }

  // Add the last field
  values.push(currentValue.trim())

  return values
}

/**
 * Parse an entire CSV file content into rows
 *
 * @param content - CSV file content as string
 * @param delimiter - Delimiter character (default: comma)
 * @param quoteChar - Quote character (default: double quote)
 * @param skipHeader - Whether to skip the first row (default: false)
 * @returns Array of rows, each row is an array of values
 *
 * @example
 * ```typescript
 * const csv = `name,ip,location
 * Router1,192.168.1.1,DC1
 * Router2,192.168.1.2,DC2`
 *
 * parseCSV(csv, ',', '"', true)
 * // Returns: [
 * //   ['Router1', '192.168.1.1', 'DC1'],
 * //   ['Router2', '192.168.1.2', 'DC2']
 * // ]
 * ```
 */
export function parseCSV(
  content: string,
  delimiter: string = ',',
  quoteChar: string = '"',
  skipHeader: boolean = false
): string[][] {
  const lines = content.split('\n').filter(line => line.trim().length > 0)
  const startIndex = skipHeader ? 1 : 0

  return lines.slice(startIndex).map(line => parseCSVLine(line, delimiter, quoteChar))
}
