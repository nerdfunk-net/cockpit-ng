import type { LiveUpdateStep } from '../types'

/**
 * Only fields the `update-devices-from-csv` backend task actually knows how to
 * apply: plain device fields, plus interface_name/type/status (used to build
 * interface_config) and interface_ip_address (renamed to primary_ip4 for the
 * row picked as primary — see buildDeviceUpdateCsv). Fields the backend has no
 * special handling for (e.g. interface_description) are intentionally left out
 * since sending them would PATCH an invalid field onto the device.
 */
export const LIVE_UPDATE_FIELDS: { key: string; label: string }[] = [
  { key: 'name', label: 'Device Name' },
  { key: 'status', label: 'Status' },
  { key: 'role', label: 'Role' },
  { key: 'location', label: 'Location' },
  { key: 'device_type', label: 'Device Type' },
  { key: 'platform', label: 'Platform' },
  { key: 'serial', label: 'Serial Number' },
  { key: 'asset_tag', label: 'Asset Tag' },
  { key: 'comments', label: 'Comments' },
  { key: 'interface_name', label: 'Interface Name' },
  { key: 'interface_type', label: 'Interface Type' },
  { key: 'interface_status', label: 'Interface Status' },
  { key: 'interface_ip_address', label: 'Interface IP Address' },
]

export const DEVICE_NAME_FIELD_KEY = 'name'
export const PRIMARY_IP_FIELD_KEY = 'interface_ip_address'

/** Interface columns the backend only recognizes by these literal header names. */
export const INTERFACE_CONFIG_FIELD_KEYS = [
  'interface_name',
  'interface_type',
  'interface_status',
]

export const WIZARD_STEP_ORDER: LiveUpdateStep[] = [
  'source',
  'keys',
  'mapping',
  'table',
  'processing',
  'summary',
]

/** Steps shown in the step indicator — processing/summary are terminal, not navigable. */
export const INDICATOR_STEPS: LiveUpdateStep[] = ['source', 'keys', 'mapping', 'table']

export const STEP_LABELS: Record<LiveUpdateStep, string> = {
  source: 'Source',
  keys: 'Select Keys',
  mapping: 'Mapping',
  table: 'Data',
  processing: 'Updating',
  summary: 'Results',
}

export const CSV_CONFIG = { delimiter: ',', quoteChar: '"' } as const
