import {
  DEVICE_NAME_FIELD_KEY,
  INTERFACE_CONFIG_FIELD_KEYS,
  INTERFACE_NAME_FIELD_KEY,
  INTERFACE_STATUS_FIELD_KEY,
  INTERFACE_TYPE_FIELD_KEY,
  PRIMARY_IP_FIELD_KEY,
} from '../constants'
import type {
  DefaultProperty,
  DeviceCsvRow,
  DeviceInterfaceEntry,
  DeviceUpdatePayload,
  ParsedCSVData,
} from '../types'

/**
 * Maps parsed CSV rows through the column mapping into flat DeviceCsvRow
 * objects — one row per CSV line, matching the interface/IP grain of the
 * source data so each row can carry its own "use as primary IP" selection.
 */
export function buildDeviceRows(
  parsedData: ParsedCSVData,
  fieldMapping: Record<string, string | null>
): DeviceCsvRow[] {
  const mappedColumns = parsedData.headers
    .map((header, index) => ({ header, index, field: fieldMapping[header] }))
    .filter((entry): entry is { header: string; index: number; field: string } =>
      Boolean(entry.field)
    )

  return parsedData.rows.map((row, rowIndex) => {
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
 * Groups the flat, one-row-per-interface DeviceCsvRow list into one device
 * update object per device for the `tasks/update-devices` JSON endpoint.
 *
 * Every row with a non-empty Interface Name becomes its own entry in that
 * device's `interfaces` array. Plain device-level fields are taken from the
 * first row in the device's group that has a non-empty value for it.
 */
export function buildDeviceUpdatePayloads(
  selectedRows: DeviceCsvRow[],
  primaryIpByDevice: Record<string, string | null>
): DeviceUpdatePayload[] {
  const deviceOrder: string[] = []
  const deviceRecords = new Map<string, Record<string, string>>()
  const deviceInterfaces = new Map<string, DeviceInterfaceEntry[]>()

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

    const entry: DeviceInterfaceEntry = { name: interfaceName }
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

/**
 * Fills in values missing from a device payload (and its interfaces) from
 * Network Defaults — mirrors the server-side interface_type fallback in
 * update_devices_task.py, extended to every default the caller supplies.
 * Never overwrites a value the CSV/mapping already supplied.
 */
export function applyDeviceDefaults(
  payload: DeviceUpdatePayload,
  defaults: DefaultProperty[]
): DeviceUpdatePayload {
  const interfaceDefaults = defaults.filter(
    d => d.field === INTERFACE_STATUS_FIELD_KEY || d.field === INTERFACE_TYPE_FIELD_KEY
  )
  const deviceDefaults = defaults.filter(
    d => d.field !== INTERFACE_STATUS_FIELD_KEY && d.field !== INTERFACE_TYPE_FIELD_KEY
  )

  const next: DeviceUpdatePayload = { ...payload }
  for (const d of deviceDefaults) {
    if (!next[d.field]) next[d.field] = d.value
  }

  if (interfaceDefaults.length > 0) {
    next.interfaces = next.interfaces.map(iface => {
      const patched = { ...iface }
      for (const d of interfaceDefaults) {
        if (d.field === INTERFACE_STATUS_FIELD_KEY && !patched.status) {
          patched.status = d.value
        }
        if (d.field === INTERFACE_TYPE_FIELD_KEY && !patched.type) {
          patched.type = d.value
        }
      }
      return patched
    })
  }

  return next
}
