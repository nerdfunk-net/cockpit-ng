import { parseCSVContent } from './csv-parser'
import type { CSVConfig, ParsedCSVData } from '../types'

interface CombineResult {
  data: ParsedCSVData | null
  error: string | null
}

/**
 * Parses each selected agent-returned key's raw text as its own CSV block and
 * concatenates the rows. All keys must share identical headers — mismatched
 * headers can't be merged into a single mapping/table, so this reports an
 * error instead of guessing which columns line up.
 */
export function combineAgentKeys(
  agentData: Record<string, string>,
  config: CSVConfig
): CombineResult {
  const keys = Object.keys(agentData)
  if (keys.length === 0) {
    return { data: null, error: 'The agent returned no data.' }
  }

  let headers: string[] | null = null
  const rows: string[][] = []

  for (const key of keys) {
    const text = agentData[key]
    if (!text || !text.trim()) {
      return { data: null, error: `Key "${key}" has no data.` }
    }

    let parsed: { headers: string[]; rows: string[][] }
    try {
      parsed = parseCSVContent(text, config)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse CSV data'
      return { data: null, error: `Key "${key}": ${message}` }
    }

    if (headers === null) {
      headers = parsed.headers
    } else if (
      headers.length !== parsed.headers.length ||
      headers.some((header, index) => header !== parsed.headers[index])
    ) {
      return {
        data: null,
        error: `Key "${key}" has different columns (${parsed.headers.join(', ')}) than the previously selected key(s) (${headers.join(', ')}). Selected identifiers must return identical headers.`,
      }
    }

    rows.push(...parsed.rows)
  }

  const finalHeaders = headers ?? []
  return {
    data: { headers: finalHeaders, rows, rowCount: rows.length },
    error: null,
  }
}
