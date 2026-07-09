import { parseCSVContent } from '@/components/features/nautobot/shared/csv/utils/csv-parser'
import type { CSVConfig } from '@/components/features/nautobot/shared/csv/types'
import {
  DEVICE_NAME_FIELD_KEY,
  INTERFACE_CONFIG_FIELD_KEYS,
  INTERFACE_NAME_FIELD_KEY,
  INTERFACE_STATUS_FIELD_KEY,
  INTERFACE_TYPE_FIELD_KEY,
  PRIMARY_IP_FIELD_KEY,
} from '../constants'
import type {
  DeviceUpdatePayload,
  LiveUpdateInterfaceEntry,
  LiveUpdateRow,
  ParsedCsvSource,
} from '../types'

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
 * Groups the flat, one-row-per-interface LiveUpdateRow list into one device
 * update object per device for the `tasks/update-devices` JSON endpoint.
 *
 * Every row with a non-empty Interface Name becomes its own entry in that
 * device's `interfaces` array — not just the row picked as "primary" — so the
 * backend can create any interface that doesn't already exist (falling back to
 * the configured default interface type when the row didn't map one) and
 * patch existing interfaces with only the attributes the row actually
 * supplies. Plain device-level fields are taken from the first row in the
 * device's group that has a non-empty value for it.
 */
export function buildDeviceUpdateJson(
  selectedRows: LiveUpdateRow[],
  primaryIpByDevice: Record<string, string | null>
): DeviceUpdatePayload[] {
  const deviceOrder: string[] = []
  const deviceRecords = new Map<string, Record<string, string>>()
  const deviceInterfaces = new Map<string, LiveUpdateInterfaceEntry[]>()

  for (const row of selectedRows) {
    if (!row.deviceName) continue

    if (!deviceRecords.has(row.deviceName)) {
      deviceRecords.set(row.deviceName, {})
      deviceInterfaces.set(row.deviceName, [])
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

    const interfaceName = row.fields[INTERFACE_NAME_FIELD_KEY]?.trim()
    if (!interfaceName) continue

    const entry: LiveUpdateInterfaceEntry = { name: interfaceName }
    const type = row.fields[INTERFACE_TYPE_FIELD_KEY]?.trim()
    if (type) entry.type = type
    const status = row.fields[INTERFACE_STATUS_FIELD_KEY]?.trim()
    if (status) entry.status = status
    const ipAddress = row.fields[PRIMARY_IP_FIELD_KEY]?.trim()
    if (ipAddress) entry.ip_address = ipAddress
    if (primaryIpByDevice[row.deviceName] === row.id) entry.is_primary_ipv4 = true

    deviceInterfaces.get(row.deviceName)?.push(entry)
  }

  return deviceOrder.map(deviceName => ({
    ...(deviceRecords.get(deviceName) ?? {}),
    name: deviceName,
    interfaces: deviceInterfaces.get(deviceName) ?? [],
  }))
}
