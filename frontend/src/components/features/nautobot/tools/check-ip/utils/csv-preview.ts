const REQUIRED_COLUMNS = ['ip_address', 'name']

function parseRow(line: string, delimiter: string, quoteChar: string): string[] {
  const result: string[] = []
  let field = ''
  let inQuote = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === quoteChar) {
        if (line[i + 1] !== undefined && line[i + 1] === quoteChar) {
          field += quoteChar
          i++
        } else {
          inQuote = false
        }
      } else {
        field += ch
      }
    } else {
      if (ch === quoteChar) {
        inQuote = true
      } else if (ch === delimiter) {
        result.push(field.trim())
        field = ''
      } else {
        field += ch
      }
    }
  }
  result.push(field.trim())
  return result
}

export interface CSVPreviewResult {
  headers: string[]
  rows: string[][]
  totalDataRows: number
  missingColumns: string[]
  isValid: boolean
  error?: string
}

export function previewCSV(
  content: string,
  delimiter: string,
  quoteChar: string,
  maxPreviewRows = 5
): CSVPreviewResult {
  const lines = content
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return {
      headers: [],
      rows: [],
      totalDataRows: 0,
      missingColumns: REQUIRED_COLUMNS,
      isValid: false,
      error: 'File is empty',
    }
  }

  const [headerLine, ...dataLines] = lines as [string, ...string[]]
  const headers = parseRow(headerLine, delimiter, quoteChar).map(h => h.toLowerCase().trim())
  const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col))

  return {
    headers,
    rows: dataLines.slice(0, maxPreviewRows).map(l => parseRow(l, delimiter, quoteChar)),
    totalDataRows: dataLines.length,
    missingColumns,
    isValid: missingColumns.length === 0,
  }
}
