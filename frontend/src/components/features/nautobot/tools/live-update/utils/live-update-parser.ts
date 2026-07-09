import { parseCSVContent } from '@/components/features/nautobot/shared/csv/utils/csv-parser'
import type { CSVConfig } from '@/components/features/nautobot/shared/csv/types'
import {
  DEVICE_NAME_FIELD_KEY,
  INTERFACE_CONFIG_FIELD_KEYS,
  PRIMARY_IP_FIELD_KEY,
} from '../constants'
import type { LiveUpdateRow, ParsedCsvSource } from '../types'

interface CombineResult {
  data: ParsedCsvSource | null
  error: string | null
}

/**
 * Parses each selected agent key's text as its own CSV block and concatenates
 * the rows. All selected keys must share identical headers — mismatched
 * headers can't be merged into a single mapping/table, so this reports an
 * error instead of guessing which columns line up.
 */
export function combineAgentKeys(
  agentKeys: Record<string, string>,
  selectedKeys: string[],
  config: CSVConfig
): CombineResult {
  if (selectedKeys.length === 0) {
    return { data: null, error: 'Select at least one key to continue.' }
  }

  let headers: string[] | null = null
  const rows: string[][] = []

  for (const key of selectedKeys) {
    const text = agentKeys[key]
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
        error: `Key "${key}" has different columns (${parsed.headers.join(', ')}) than the previously selected key(s) (${headers.join(', ')}). Selected keys must share identical headers.`,
      }
    }

    rows.push(...parsed.rows)
  }

  return { data: { headers: headers ?? [], rows }, error: null }
}

/**
 * Maps parsed CSV rows through the column mapping into flat LiveUpdateRow
 * objects — one row per CSV line, matching the interface/IP grain of the
 * source data so each row can carry its own "use as primary IP" selection.
 */
export function buildLiveUpdateRows(
  source: ParsedCsvSource,
  fieldMapping: Record<string, string | null>
): LiveUpdateRow[] {
  const mappedColumns = source.headers
    .map((header, index) => ({ header, index, field: fieldMapping[header] }))
    .filter((entry): entry is { header: string; index: number; field: string } =>
      Boolean(entry.field)
    )

  return source.rows.map((row, rowIndex) => {
    const fields: Record<string, string> = {}
    for (const { index, field } of mappedColumns) {
      fields[field] = row[index] ?? ''
    }

    const deviceName = fields[DEVICE_NAME_FIELD_KEY] ?? ''
    const ipAddress = fields[PRIMARY_IP_FIELD_KEY]

    return {
      id: `row-${rowIndex}`,
      deviceName,
      fields,
      hasIpAddress: Boolean(ipAddress && ipAddress.trim()),
    }
  })
}

/**
 * Collapses the flat, one-row-per-interface LiveUpdateRow list into one CSV
 * row per device for the `update-devices-from-csv` backend task.
 *
 * The backend only special-cases a literal `primary_ip4` column (not
 * `interface_ip_address`) to set a device's primary IP, and only recognizes
 * literal `interface_name`/`interface_type`/`interface_status` headers to
 * build the interface that IP attaches to — so the row the user picked as
 * "primary" per device supplies those three fields plus a renamed
 * `primary_ip4`, while any other mapped field is taken from the first row
 * in the device's group that has a non-empty value for it.
 */
export function buildDeviceUpdateCsv(
  selectedRows: LiveUpdateRow[],
  primaryIpByDevice: Record<string, string | null>
): ParsedCsvSource {
  const deviceOrder: string[] = []
  const deviceRecords = new Map<string, Record<string, string>>()

  for (const row of selectedRows) {
    if (!row.deviceName) continue

    if (!deviceRecords.has(row.deviceName)) {
      deviceRecords.set(row.deviceName, { [DEVICE_NAME_FIELD_KEY]: row.deviceName })
      deviceOrder.push(row.deviceName)
    }
    const record = deviceRecords.get(row.deviceName)

    for (const [field, value] of Object.entries(row.fields)) {
      if (field === DEVICE_NAME_FIELD_KEY) continue
      if (field === PRIMARY_IP_FIELD_KEY) continue
      if (INTERFACE_CONFIG_FIELD_KEYS.includes(field)) continue
      if (!value || !record || record[field]) continue
      record[field] = value
    }
  }

  for (const row of selectedRows) {
    if (!row.deviceName) continue
    if (primaryIpByDevice[row.deviceName] !== row.id) continue

    const ipAddress = row.fields[PRIMARY_IP_FIELD_KEY]
    if (!ipAddress || !ipAddress.trim()) continue

    const record = deviceRecords.get(row.deviceName)
    if (!record) continue

    record.primary_ip4 = ipAddress.trim()
    for (const field of INTERFACE_CONFIG_FIELD_KEYS) {
      const value = row.fields[field]
      if (value) record[field] = value
    }
  }

  const headerSet = new Set<string>([DEVICE_NAME_FIELD_KEY])
  for (const record of deviceRecords.values()) {
    for (const key of Object.keys(record)) headerSet.add(key)
  }
  const headers = Array.from(headerSet)

  const rows = deviceOrder.map(deviceName => {
    const record = deviceRecords.get(deviceName) ?? {}
    return headers.map(header => record[header] ?? '')
  })

  return { headers, rows }
}
